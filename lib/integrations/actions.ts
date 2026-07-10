"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { decryptToken, encryptToken } from "@/lib/integrations/crypto";
import { verifyToken, downloadInvoicePdf, isPennylaneError } from "@/lib/integrations/pennylane";
import { syncPennylaneOrg } from "@/lib/integrations/sync";
import { touchCase } from "@/lib/cases/touch";

/*
 * Actions de l'intégration comptable (Pennylane). Le token ne transite que
 * par ces actions : vérifié contre l'API, chiffré (AES-GCM), stocké dans
 * org_integration_secrets (service-role only). Les écritures service-role
 * sont TOUJOURS scoppées à l'organisation résolue depuis la session (même
 * doctrine que les webhooks : « RLS-bypass mais scopé org »).
 */

export type IntegrationState = { error?: string; success?: string };

/** Organisation du membre connecté (client user-scoped — RLS). */
async function currentOrg(): Promise<{ orgId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!data) return { error: "Organisation introuvable." };
  return { orgId: data.organization_id };
}

// Garde anti-rafale de la vérification de token (BLEME ne doit pas servir
// d'oracle de validation de tokens volés) : fenêtre glissante en mémoire par
// org — best-effort (par instance), suffisant pour casser les boucles.
const connectAttempts = new Map<string, number[]>();
function allowConnectAttempt(orgId: string): boolean {
  const now = Date.now();
  const recent = (connectAttempts.get(orgId) ?? []).filter((t) => now - t < 15 * 60_000);
  recent.push(now);
  connectAttempts.set(orgId, recent);
  return recent.length <= 8;
}

export async function connectPennylane(
  _prev: IntegrationState,
  formData: FormData,
): Promise<IntegrationState> {
  const token = z
    .string()
    .trim()
    .min(20, "Le token semble trop court.")
    .max(500)
    .safeParse(formData.get("token"));
  if (!token.success) {
    return { error: "Collez le token API généré dans Pennylane (Paramètres → Connectivité → Développeurs)." };
  }
  const org = await currentOrg();
  if ("error" in org) return { error: org.error };
  if (!allowConnectAttempt(org.orgId)) {
    return { error: "Trop de tentatives — réessayez dans quelques minutes." };
  }

  // Vérification réelle contre l'API avant tout stockage.
  const check = await verifyToken(token.data);
  if (isPennylaneError(check)) {
    console.warn("[pennylane] tentative de connexion refusée", { orgId: org.orgId, status: check.status });
    return {
      error:
        check.status === 401 || check.status === 403
          ? "Token refusé par Pennylane — vérifiez qu’il est copié en entier, encore actif, et généré sur un plan Essential ou supérieur."
          : check.error,
    };
  }

  // Chiffrement AVANT toute écriture : une rotation qui échoue ne doit jamais
  // laisser l'ancien token actif à l'insu de l'utilisateur.
  const encrypted = await encryptToken(token.data).catch((e) => {
    console.error("[pennylane] chiffrement du token impossible", e);
    return null;
  });
  if (!encrypted) {
    return { error: "Connexion momentanément indisponible (configuration du chiffrement) — prévenez le support." };
  }

  const sb = createServiceClient();
  // Statut transitoire 'disconnected' (ignoré par le cron) tant que le secret
  // n'est pas écrit — 'connected' n'est posé qu'en tout dernier.
  const { data: integration, error: upErr } = await sb
    .from("org_integrations")
    .upsert(
      {
        organization_id: org.orgId,
        provider: "pennylane",
        status: "disconnected",
        company_name: check.companyName,
        connected_at: new Date().toISOString(),
        last_error: null,
        // Reconnexion = repartir d'un import complet propre.
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
  if (secretErr) return { error: "Impossible d’enregistrer le token. Réessayez." };

  await sb.from("org_integrations").update({ status: "connected" }).eq("id", integration.id);

  // Premier import dans la foulée : l'utilisateur voit ses impayées tout de suite.
  const sync = await syncPennylaneOrg(sb, { ...integration, status: "connected", sync_cursor: null });

  revalidatePath("/app/parametres");
  revalidatePath("/app/envois");
  revalidatePath("/app");
  return sync.ok
    ? { success: "Pennylane connecté — vos factures impayées sont importées." }
    : { success: `Pennylane connecté. Première synchronisation à réessayer : ${sync.error}` };
}

export async function disconnectPennylane(): Promise<void> {
  const org = await currentOrg();
  if ("error" in org) return;
  const sb = createServiceClient();
  // Supprime la connexion ET les factures importées (minimisation : on ne
  // garde pas la compta d'un utilisateur déconnecté). Les dossiers créés
  // restent, évidemment.
  await sb
    .from("accounting_invoices")
    .delete()
    .eq("organization_id", org.orgId)
    .eq("provider", "pennylane");
  await sb
    .from("org_integrations")
    .delete()
    .eq("organization_id", org.orgId)
    .eq("provider", "pennylane");
  revalidatePath("/app/parametres");
  revalidatePath("/app/envois");
  revalidatePath("/app");
}

export async function syncPennylaneNow(): Promise<void> {
  const org = await currentOrg();
  if ("error" in org) return;
  const sb = createServiceClient();
  const { data: integration } = await sb
    .from("org_integrations")
    .select("id, organization_id, provider, sync_cursor")
    .eq("organization_id", org.orgId)
    .eq("provider", "pennylane")
    .maybeSingle();
  if (!integration) return;
  await syncPennylaneOrg(sb, integration);
  revalidatePath("/app/parametres");
  revalidatePath("/app/envois");
  revalidatePath("/app");
}

function days(n: number): string {
  return new Date(Date.now() + n * 24 * 3600 * 1000).toISOString();
}

function euros(cents: number | null): string {
  return cents == null ? "—" : `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`;
}

/**
 * « Créer le dossier » depuis une facture impayée importée : dossier
 * pré-rempli (client, montant, échéance), PDF de la facture joint en pièce.
 * Toutes les valeurs importées sont des SUGGESTIONS sourcées « Pennylane »,
 * modifiables partout — la correction utilisateur prime (pilier n°3).
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

  const customerName = invoice.customer_name ?? "Client à préciser";
  const numberLabel = invoice.invoice_number ? `nº ${invoice.invoice_number}` : "";
  const claimedCents = invoice.remaining_cents ?? invoice.amount_cents ?? 0;

  const summary = [
    `Dossier créé depuis Pennylane — facture ${numberLabel || "importée"}${invoice.label ? ` (« ${invoice.label} »)` : ""}.`,
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

  // Création du dossier via le client USER-scoped (RLS) : c'est un geste
  // utilisateur, au même titre que le wizard.
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
      source: "pennylane",
    })
    .select("id")
    .single();
  if (error || !created) redirect("/app/envois?creation=echec");

  // Liaison IMMÉDIATE et conditionnelle (anti double-clic) : si une autre
  // requête a déjà lié cette facture, on jette le dossier tout juste créé et
  // on rejoint le sien — jamais deux dossiers pour la même facture.
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
    title: "Dossier créé depuis Pennylane",
    description: `Facture ${numberLabel || "importée"} — ${customerName}, reste dû ${euros(claimedCents)}.`,
    source: "user",
  });

  // PDF de la facture → pièce du dossier (l'URL Pennylane expire en 30 min :
  // téléchargement immédiat). Un échec n'empêche pas la création du dossier.
  const { data: secretRow } = await sb
    .from("org_integration_secrets")
    .select("token_encrypted, org_integrations!inner(organization_id, provider)")
    .eq("org_integrations.organization_id", org.orgId)
    .eq("org_integrations.provider", "pennylane")
    .maybeSingle();
  if (secretRow) {
    try {
      const token = await decryptToken(secretRow.token_encrypted);
      const pdf = await downloadInvoicePdf(token, invoice.external_id);
      if (!isPennylaneError(pdf)) {
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
            file_name: invoice.invoice_number
              ? `Facture ${invoice.invoice_number}.pdf`
              : "Facture Pennylane.pdf",
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

  // recompute:false — on préserve la prochaine action posée ci-dessus.
  await touchCase(created.id, { type: "case_created", label: "Dossier créé depuis Pennylane" }, { recompute: false });
  revalidatePath("/app");
  revalidatePath("/app/envois");
  redirect(`/app/dossiers/${created.id}`);
}
