"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { can as hasCapability, type PermissionSet } from "@/lib/permissions/capabilities";
import { decryptToken, encryptToken } from "@/lib/integrations/crypto";
import { getAdapter } from "@/lib/integrations/registry";
import { isIntegrationError } from "@/lib/integrations/types";
import { PROVIDERS, SUPPORTED_PROVIDERS, type ProviderId } from "@/lib/integrations/providers-meta";
import { syncOrg } from "@/lib/integrations/sync";
import { touchCase } from "@/lib/cases/touch";

/*
 * Actions de l'intégration comptable, tous fournisseurs (Pennylane, Axonaut,
 * Sellsy). Les identifiants ne transitent que par ici : vérifiés contre l'API,
 * chiffrés (AES-256-GCM), stockés dans org_integration_secrets (service-role
 * only). Les écritures service-role sont TOUJOURS scoppées à l'organisation
 * résolue depuis la session (« RLS-bypass mais scopé org »).
 */

export type IntegrationState = { error?: string; success?: string };

function isProvider(v: unknown): v is ProviderId {
  return typeof v === "string" && (SUPPORTED_PROVIDERS as string[]).includes(v);
}

/**
 * Organisation du membre connecté (client user-scoped — RLS) + garde de droit :
 * toutes les actions de ce module MODIFIENT la compta (connexions, sync,
 * archivage, dossier depuis facture) et passent en service-role (bypass RLS),
 * donc on exige 'compta.manage' ici.
 */
async function currentOrg(): Promise<{ orgId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id, role, permissions")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!data) return { error: "Organisation introuvable." };
  if (!hasCapability(data.role, data.permissions as PermissionSet, "compta.manage")) {
    return { error: "Vous n'avez pas le droit de gérer la comptabilité." };
  }
  return { orgId: data.organization_id };
}

// Anti-rafale de la vérification d'identifiants (BLEME ne doit pas servir
// d'oracle de validation). Fenêtre glissante en mémoire, clé org:provider.
const connectAttempts = new Map<string, number[]>();
function allowConnectAttempt(orgId: string, provider: string): boolean {
  const key = `${orgId}:${provider}`;
  const now = Date.now();
  const recent = (connectAttempts.get(key) ?? []).filter((t) => now - t < 15 * 60_000);
  recent.push(now);
  connectAttempts.set(key, recent);
  return recent.length <= 8;
}

function revalidateAll() {
  revalidatePath("/app/parametres");
  revalidatePath("/app/envois");
  revalidatePath("/app");
}

export async function connectIntegration(
  _prev: IntegrationState,
  formData: FormData,
): Promise<IntegrationState> {
  const provider = formData.get("provider");
  if (!isProvider(provider)) return { error: "Fournisseur inconnu." };
  const adapter = getAdapter(provider);
  if (!adapter) return { error: "Fournisseur non pris en charge." };
  const label = PROVIDERS[provider].label;

  const parsed = adapter.parseConnectForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const org = await currentOrg();
  if ("error" in org) return { error: org.error };
  if (!allowConnectAttempt(org.orgId, provider)) {
    return { error: "Trop de tentatives — réessayez dans quelques minutes." };
  }

  // Vérification réelle contre l'API avant tout stockage.
  const check = await adapter.verifyCredentials(parsed.creds);
  if (isIntegrationError(check)) {
    console.warn(`[${provider}] connexion refusée`, { orgId: org.orgId, status: check.status });
    return { error: check.error };
  }

  // Chiffrement AVANT toute écriture : une reconnexion qui échoue ne doit
  // jamais laisser d'anciens identifiants actifs à l'insu de l'utilisateur.
  const encrypted = await encryptToken(parsed.creds).catch((e) => {
    console.error(`[${provider}] chiffrement impossible`, e);
    return null;
  });
  if (!encrypted) {
    return { error: "Connexion momentanément indisponible (chiffrement) — prévenez le support." };
  }

  const sb = createServiceClient();
  // Statut transitoire 'disconnected' (ignoré par le cron) tant que le secret
  // n'est pas écrit — 'connected' n'est posé qu'en dernier.
  const { data: integration, error: upErr } = await sb
    .from("org_integrations")
    .upsert(
      {
        organization_id: org.orgId,
        provider,
        status: "disconnected",
        company_name: check.companyName,
        connected_at: new Date().toISOString(),
        last_error: null,
        sync_cursor: null,
      },
      { onConflict: "organization_id,provider" },
    )
    .select("id, organization_id, provider, sync_cursor")
    .single();
  if (upErr || !integration) return { error: "Impossible d’enregistrer la connexion. Réessayez." };

  const { error: secretErr } = await sb
    .from("org_integration_secrets")
    .upsert({ integration_id: integration.id, token_encrypted: encrypted });
  if (secretErr) return { error: "Impossible d’enregistrer les identifiants. Réessayez." };

  await sb.from("org_integrations").update({ status: "connected" }).eq("id", integration.id);

  const sync = await syncOrg(sb, { ...integration, status: "connected", sync_cursor: null });

  revalidateAll();
  return sync.ok
    ? { success: `${label} connecté — vos factures impayées sont importées.` }
    : { success: `${label} connecté. Première synchronisation à réessayer : ${sync.error}` };
}

export async function disconnectIntegration(provider: string): Promise<void> {
  if (!isProvider(provider)) return;
  const org = await currentOrg();
  if ("error" in org) return;
  const sb = createServiceClient();
  // Minimisation : on retire les factures importées de CE fournisseur (les
  // dossiers créés restent). La connexion tombe → cascade sur le secret.
  await sb
    .from("accounting_invoices")
    .delete()
    .eq("organization_id", org.orgId)
    .eq("provider", provider);
  await sb.from("org_integrations").delete().eq("organization_id", org.orgId).eq("provider", provider);
  revalidateAll();
}

export async function syncIntegration(provider: string): Promise<void> {
  if (!isProvider(provider)) return;
  const org = await currentOrg();
  if ("error" in org) return;
  const sb = createServiceClient();
  const { data: integration } = await sb
    .from("org_integrations")
    .select("id, organization_id, provider, status, sync_cursor")
    .eq("organization_id", org.orgId)
    .eq("provider", provider)
    .maybeSingle();
  if (!integration) return;
  await syncOrg(sb, integration);
  revalidateAll();
}

/** Synchronise toutes les connexions comptables de l'organisation (cockpit). */
export async function syncAllIntegrations(): Promise<void> {
  const org = await currentOrg();
  if ("error" in org) return;
  const sb = createServiceClient();
  const { data: integrations } = await sb
    .from("org_integrations")
    .select("id, organization_id, provider, status, sync_cursor")
    .eq("organization_id", org.orgId)
    .neq("status", "disconnected");
  for (const integration of integrations ?? []) {
    await syncOrg(sb, integration);
  }
  revalidateAll();
}

/** Archive / désarchive une facture importée (l'écarte de la liste à traiter). */
export async function setInvoiceArchived(
  invoiceId: string,
  archived: boolean,
): Promise<{ ok: boolean }> {
  const id = z.uuid().safeParse(invoiceId);
  if (!id.success) return { ok: false };
  const org = await currentOrg();
  if ("error" in org) return { ok: false };
  const sb = createServiceClient();
  const { error } = await sb
    .from("accounting_invoices")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id.data)
    .eq("organization_id", org.orgId);
  if (error) return { ok: false };
  revalidateAll();
  return { ok: true };
}

function days(n: number): string {
  return new Date(Date.now() + n * 24 * 3600 * 1000).toISOString();
}

function euros(cents: number | null): string {
  return cents == null ? "—" : `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`;
}

/**
 * « Créer le dossier » depuis une facture importée : dossier pré-rempli
 * (client, montant, échéance), PDF de la facture joint en pièce. Toutes les
 * valeurs importées sont des SUGGESTIONS sourcées et modifiables — la
 * correction utilisateur prime (pilier n°3).
 */
export async function createCaseFromInvoice(formData: FormData): Promise<void> {
  const invoiceId = z.uuid().safeParse(formData.get("invoiceId"));
  if (!invoiceId.success) redirect("/app/envois?creation=echec");
  const org = await currentOrg();
  if ("error" in org) redirect("/app/envois?creation=echec");

  const sb = createServiceClient();
  const { data: invoice } = await sb
    .from("accounting_invoices")
    .select("*")
    .eq("id", invoiceId.data)
    .eq("organization_id", org.orgId)
    .maybeSingle();
  if (!invoice) redirect("/app/envois?creation=echec");
  if (invoice.case_id) redirect(`/app/dossiers/${invoice.case_id}`);

  const provider: string = invoice.provider ?? "pennylane";
  const label = PROVIDERS[provider as ProviderId]?.label ?? "votre compta";
  const customerName = invoice.customer_name ?? "Client à préciser";
  const numberLabel = invoice.invoice_number ? `nº ${invoice.invoice_number}` : "";
  const claimedCents = invoice.remaining_cents ?? invoice.amount_cents ?? 0;

  const summary = [
    `Dossier créé depuis ${label} — facture ${numberLabel || "importée"}${invoice.label ? ` (« ${invoice.label} »)` : ""}.`,
    `Montant total : ${euros(invoice.amount_cents)} · Reste dû : ${euros(invoice.remaining_cents ?? invoice.amount_cents)}.`,
    invoice.issued_on ? `Émise le ${new Date(invoice.issued_on).toLocaleDateString("fr-FR")}.` : null,
    invoice.deadline_on
      ? `Échéance : ${new Date(invoice.deadline_on).toLocaleDateString("fr-FR")}${
          new Date(invoice.deadline_on).getTime() < Date.now() ? " (dépassée)" : ""
        }.`
      : null,
    `Ces informations proviennent de votre logiciel comptable : vérifiez-les et corrigez-les si besoin — vos corrections font foi.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("cases")
    .insert({
      organization_id: org.orgId,
      case_type: "unpaid_invoice",
      title: `Facture impayée · ${customerName}`,
      status: "awaiting_user",
      debtor_name: customerName,
      debtor_siren: invoice.customer_siren,
      debtor_email: invoice.customer_email,
      debtor_address: invoice.customer_address,
      amount_claimed_cents: claimedCents,
      summary_md: summary,
      stage: 1,
      phase: 1,
      next_letter_kind: "reminder_1",
      next_action_label: "Vérifier les informations importées, puis préparer la relance",
      next_action_at: days(1),
      expected_recovery_at: days(28),
      source: isProvider(provider) ? provider : "pennylane",
    })
    .select("id")
    .single();
  if (error || !created) redirect("/app/envois?creation=echec");

  // Liaison IMMÉDIATE et conditionnelle (anti double-clic).
  const { data: claimed } = await sb
    .from("accounting_invoices")
    .update({ case_id: created.id })
    .eq("id", invoice.id)
    .is("case_id", null)
    .select("id");
  if (!claimed || claimed.length === 0) {
    await supabase.from("cases").delete().eq("id", created.id);
    const { data: winner } = await sb
      .from("accounting_invoices")
      .select("case_id")
      .eq("id", invoice.id)
      .maybeSingle();
    redirect(winner?.case_id ? `/app/dossiers/${winner.case_id}` : "/app/envois");
  }

  await supabase.from("case_events").insert({
    case_id: created.id,
    organization_id: org.orgId,
    event_type: "created",
    title: `Dossier créé depuis ${label}`,
    description: `Facture ${numberLabel || "importée"} — ${customerName}, reste dû ${euros(claimedCents)}.`,
    source: "user",
  });

  // PDF de la facture → pièce du dossier (URLs éphémères : téléchargement
  // immédiat). Un échec n'empêche pas la création.
  const adapter = getAdapter(provider);
  const { data: secretRow } = await sb
    .from("org_integration_secrets")
    .select("token_encrypted, org_integrations!inner(organization_id, provider)")
    .eq("org_integrations.organization_id", org.orgId)
    .eq("org_integrations.provider", provider)
    .maybeSingle();
  if (adapter && secretRow) {
    try {
      const creds = await decryptToken(secretRow.token_encrypted);
      const pdf = await adapter.downloadInvoicePdf(creds, invoice.external_id);
      if (!isIntegrationError(pdf)) {
        const safeName = (invoice.invoice_number ?? "facture").replace(/[^\p{L}\p{N}._-]/gu, "-");
        const path = `${org.orgId}/${created.id}/${crypto.randomUUID()}-facture-${safeName}.pdf`;
        const up = await sb.storage.from("documents").upload(path, pdf.buffer, {
          contentType: "application/pdf",
          upsert: false,
        });
        if (!up.error) {
          await sb.from("documents").insert({
            organization_id: org.orgId,
            case_id: created.id,
            file_name: invoice.invoice_number ? `Facture ${invoice.invoice_number}.pdf` : `Facture ${label}.pdf`,
            storage_path: path,
            mime_type: "application/pdf",
            size_bytes: pdf.buffer.length,
            doc_class: "integration",
            doc_kind: "facture",
          });
        }
      }
    } catch {
      // PDF non joint : l'utilisateur peut l'ajouter à la main.
    }
  }

  await touchCase(created.id, { type: "case_created", label: `Dossier créé depuis ${label}` }, { recompute: false });
  revalidatePath("/app");
  revalidatePath("/app/envois");
  redirect(`/app/dossiers/${created.id}`);
}
