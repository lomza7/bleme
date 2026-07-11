import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/integrations/crypto";
import { getAdapter } from "@/lib/integrations/registry";
import { isIntegrationError, type PivotInvoice } from "@/lib/integrations/types";
import { PROVIDERS, type ProviderId } from "@/lib/integrations/providers-meta";
import { notifyOrganization } from "@/lib/notifications/notify";
import { enqueueWebhook } from "@/lib/webhooks/enqueue";

/*
 * Synchronisation comptable d'une organisation, tous fournisseurs (service-role,
 * appelée par le cron /api/cron/compta-sync et le bouton « Synchroniser »).
 *
 * L'adaptateur (Pennylane / Axonaut / Sellsy) fait la récupération + la
 * normalisation vers le format pivot ; ce module reste agnostique et gère :
 *  - l'upsert idempotent (clé org+provider+external_id) ;
 *  - la détection « facture liée à un dossier passée payée » → notification
 *    (cloche + email), JAMAIS de clôture automatique (pilier produit) ;
 *  - la détection « nouvelle facture actionnable » → notification cloche ;
 *  - les suppressions upstream et le vieillissement passif upcoming→late ;
 *  - le curseur (inchangé en cas d'erreur d'écriture → lot rejoué).
 */

type IntegrationRow = {
  id: string;
  organization_id: string;
  provider: string;
  status?: string | null;
  sync_cursor: string | null;
};

type StoredInvoice = {
  external_id: string;
  paid: boolean;
  status: string | null;
  case_id: string | null;
  archived_at: string | null;
  invoice_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_siren: string | null;
  customer_address: unknown;
};

/** Statuts considérés « impayé actionnable » côté BLEME. */
export function isActionableUnpaid(inv: { paid: boolean | null; status: string | null }): boolean {
  return !inv.paid && ["late", "partially_paid"].includes(inv.status ?? "");
}

function providerLabel(provider: string): string {
  return PROVIDERS[provider as ProviderId]?.label ?? "votre compta";
}

/** PivotInvoice → ligne DB, en conservant les infos client déjà connues. */
function toRow(orgId: string, provider: string, inv: PivotInvoice, before: StoredInvoice | null) {
  const c = inv.customer;
  const name = c?.name ?? before?.customer_name ?? null;
  return {
    organization_id: orgId,
    provider,
    external_id: inv.externalId,
    invoice_number: inv.invoiceNumber ?? before?.invoice_number ?? null,
    label: inv.label?.slice(0, 300) ?? null,
    customer_external_id: c?.externalId ?? null,
    customer_name: name,
    customer_email: c?.email ?? before?.customer_email ?? null,
    customer_siren: c?.siren ?? before?.customer_siren ?? null,
    customer_address: c?.address
      ? {
          // `societe` seul : dupliquer le nom dans nom ET societe dédoublerait
          // le destinataire sur le recommandé.
          nom: "",
          societe: name ?? "",
          adresse: c.address.adresse,
          codePostal: c.address.codePostal,
          ville: c.address.ville,
        }
      : (before?.customer_address ?? null),
    amount_cents: inv.amountCents,
    remaining_cents: inv.remainingCents,
    currency: inv.currency ?? "EUR",
    issued_on: inv.issuedOn ?? null,
    deadline_on: inv.deadlineOn ?? null,
    status: inv.status,
    paid: inv.paid,
    synced_at: new Date().toISOString(),
  };
}

export async function syncOrg(
  sb: SupabaseClient,
  integration: IntegrationRow,
): Promise<{ ok: boolean; error?: string }> {
  const label = providerLabel(integration.provider);
  const adapter = getAdapter(integration.provider);
  if (!adapter) return await fail(sb, integration, `Fournisseur ${label} non pris en charge.`);

  const { data: secret } = await sb
    .from("org_integration_secrets")
    .select("token_encrypted")
    .eq("integration_id", integration.id)
    .maybeSingle();
  if (!secret) return await fail(sb, integration, `Connexion introuvable — reconnectez ${label}.`);

  let creds: string;
  try {
    creds = await decryptToken(secret.token_encrypted);
  } catch (e) {
    console.error("[compta-sync] déchiffrement des identifiants impossible", e);
    return await fail(sb, integration, `Impossible de lire la connexion — reconnectez ${label} ou contactez le support.`);
  }

  const syncStartedAt = new Date().toISOString();
  const firstImport =
    !integration.sync_cursor ||
    (adapter.cursorMaxAgeDays != null &&
      Date.now() - new Date(integration.sync_cursor).getTime() > adapter.cursorMaxAgeDays * 86_400_000);

  // Factures ouvertes déjà stockées : l'adaptateur peut avoir besoin de les
  // re-vérifier (passées payées/annulées) — Pennylane l'ignore (changelog).
  const { data: openRows } = await sb
    .from("accounting_invoices")
    .select("external_id")
    .eq("organization_id", integration.organization_id)
    .eq("provider", integration.provider)
    .eq("paid", false);
  const trackedExternalIds = (openRows ?? []).map((r) => r.external_id as string);

  const fetched = await adapter.fetchInvoices(creds, {
    firstImport,
    cursor: integration.sync_cursor,
    trackedExternalIds,
  });
  if (isIntegrationError(fetched)) return await fail(sb, integration, fetched.error);

  const invoices = fetched.invoices;
  const externalIds = invoices.map((i) => i.externalId);
  const { data: existingRows } = externalIds.length
    ? await sb
        .from("accounting_invoices")
        .select(
          "external_id, paid, status, case_id, archived_at, invoice_number, customer_name, customer_email, customer_siren, customer_address",
        )
        .eq("organization_id", integration.organization_id)
        .eq("provider", integration.provider)
        .in("external_id", externalIds)
    : { data: [] };
  const previous = new Map<string, StoredInvoice>(
    ((existingRows as StoredInvoice[]) ?? []).map((r) => [r.external_id, r]),
  );

  let hadWriteError = false;

  for (const inv of invoices) {
    // Brouillons et avoirs : jamais stockés.
    if (inv.status === "draft" || inv.status === "credit_note") continue;
    const before = previous.get(inv.externalId) ?? null;
    const row = toRow(integration.organization_id, integration.provider, inv, before);

    const { error: upsertErr } = await sb
      .from("accounting_invoices")
      .upsert(row, { onConflict: "organization_id,provider,external_id" });
    if (upsertErr) {
      hadWriteError = true;
      continue;
    }

    const displayName = row.customer_name ?? "un client";
    const numberLabel = row.invoice_number ? `nº ${row.invoice_number}` : "";
    const becamePaid = before && !before.paid && inv.paid === true;
    const becameActionable =
      !firstImport &&
      isActionableUnpaid({ paid: row.paid, status: row.status }) &&
      (!before || !isActionableUnpaid(before)) &&
      !before?.case_id &&
      !before?.archived_at; // facture écartée par l'utilisateur → on ne re-notifie pas

    if (becamePaid && before?.case_id) {
      await sb.from("case_events").insert({
        case_id: before.case_id,
        organization_id: integration.organization_id,
        event_type: "payment_detected",
        title: "Facture marquée payée dans votre compta",
        description: `${label} indique la facture ${numberLabel || "liée au dossier"} comme payée. Confirmez l’encaissement pour solder le dossier.`,
        source: "system",
      });
      await notifyOrganization(sb, {
        organizationId: integration.organization_id,
        caseId: before.case_id,
        kind: "integration",
        title: `Rentrée d’argent détectée — facture ${numberLabel || "payée"}`,
        body: `${label} marque la facture de ${displayName} comme payée. Ouvrez le dossier pour confirmer l’encaissement et le solder.`,
        href: `/app/dossiers/${before.case_id}`,
        email: true,
      });
      await enqueueWebhook(integration.organization_id, "invoice.payment_detected", { case_id: before.case_id });
    } else if (becameActionable) {
      await notifyOrganization(sb, {
        organizationId: integration.organization_id,
        kind: "integration",
        title: `Facture en retard détectée ${numberLabel}`.trim(),
        body: `${displayName} n’a pas réglé la facture ${numberLabel || "détectée"}. Créez le dossier en un clic depuis le Suivi.`,
        href: "/app/envois",
        email: false,
      });
    }
  }

  // Suppressions upstream (Pennylane) : on retire la ligne importée (le dossier
  // BLEME éventuel reste).
  if (fetched.deletedExternalIds.length > 0) {
    await sb
      .from("accounting_invoices")
      .delete()
      .eq("organization_id", integration.organization_id)
      .eq("provider", integration.provider)
      .in("external_id", fetched.deletedExternalIds);
  }

  // Vieillissement passif : une « upcoming » dont l'échéance est dépassée est
  // promue « late » localement (aucun événement fournisseur pour ça).
  const today = new Date().toISOString().slice(0, 10);
  const { data: newlyLate } = await sb
    .from("accounting_invoices")
    .select("id, invoice_number, customer_name, case_id")
    .eq("organization_id", integration.organization_id)
    .eq("provider", integration.provider)
    .eq("paid", false)
    .eq("status", "upcoming")
    .is("archived_at", null)
    .lt("deadline_on", today);
  for (const r of newlyLate ?? []) {
    const { error: promoteErr } = await sb
      .from("accounting_invoices")
      .update({ status: "late" })
      .eq("id", r.id)
      .eq("status", "upcoming");
    if (promoteErr || firstImport || r.case_id) continue;
    const numberLabel = r.invoice_number ? `nº ${r.invoice_number}` : "";
    await notifyOrganization(sb, {
      organizationId: integration.organization_id,
      kind: "integration",
      title: `Facture en retard détectée ${numberLabel}`.trim(),
      body: `L’échéance de la facture ${numberLabel || "importée"}${r.customer_name ? ` de ${r.customer_name}` : ""} est dépassée. Créez le dossier en un clic depuis le Suivi.`,
      href: "/app/envois",
      email: false,
    });
  }

  await sb
    .from("org_integrations")
    .update({
      status: "connected",
      last_sync_at: syncStartedAt,
      last_error: hadWriteError ? "Synchronisation partielle — reprise au prochain passage." : null,
      sync_cursor: hadWriteError ? integration.sync_cursor : fetched.nextCursor,
    })
    .eq("id", integration.id);
  return { ok: true };
}

async function fail(
  sb: SupabaseClient,
  integration: IntegrationRow,
  message: string,
): Promise<{ ok: false; error: string }> {
  const label = providerLabel(integration.provider);
  await sb
    .from("org_integrations")
    .update({ status: "error", last_error: message.slice(0, 300), last_sync_at: new Date().toISOString() })
    .eq("id", integration.id);
  if (integration.status !== "error") {
    await notifyOrganization(sb, {
      organizationId: integration.organization_id,
      kind: "alert",
      title: `Synchronisation ${label} en échec`,
      body: `${message} Vérifiez la connexion dans Paramètres → Connexions.`,
      href: "/app/parametres",
      email: false,
    });
  }
  return { ok: false, error: message };
}
