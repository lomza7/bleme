import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/integrations/crypto";
import {
  changedInvoiceIds,
  euroStringToCents,
  getCustomer,
  getInvoicesByIds,
  isPennylaneError,
  listInvoices,
  type PennylaneCustomer,
  type PennylaneInvoice,
} from "@/lib/integrations/pennylane";
import { notifyOrganization } from "@/lib/notifications/notify";

/*
 * Synchronisation Pennylane d'une organisation (service-role, appelée par le
 * cron /api/cron/compta-sync et le bouton « Synchroniser maintenant »).
 *
 * Premier passage : import des factures finalisées des 18 derniers mois.
 * Passages suivants : /changelogs depuis le curseur → re-fetch des ids
 * modifiés → upsert + détections. Robustesse :
 *  - un curseur plus vieux que la rétention changelog (4 semaines) déclenche
 *    un ré-import complet (pas de trou silencieux) ;
 *  - une erreur d'écriture n'avance PAS le curseur (le lot sera rejoué —
 *    l'upsert et les détections par transition sont idempotents) ;
 *  - les suppressions côté Pennylane suppriment la ligne importée ;
 *  - les factures « upcoming » dont l'échéance passe sont promues « late »
 *    localement (aucun changelog n'est émis pour ce vieillissement passif).
 * Détections :
 *  - facture liée à un dossier qui passe « payée » → notification (cloche +
 *    email) — la clôture reste un geste utilisateur (recordPayment), JAMAIS
 *    automatique ;
 *  - facture qui devient actionnable (en retard / partiellement payée), sans
 *    dossier → notification cloche.
 */

const IMPORT_MONTHS = 18;
/** Au-delà, le changelog Pennylane (rétention 4 semaines) n'est plus fiable. */
const CURSOR_MAX_AGE_DAYS = 21;

type IntegrationRow = {
  id: string;
  organization_id: string;
  provider: string;
  status?: string | null;
  sync_cursor: string | null;
};

type StoredInvoice = {
  id: string;
  external_id: string;
  paid: boolean;
  status: string | null;
  case_id: string | null;
  invoice_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_siren: string | null;
  customer_address: unknown;
};

/** Statuts fournisseur considérés « impayé actionnable » côté BLEME. */
export function isActionableUnpaid(inv: { paid: boolean | null; status: string | null }): boolean {
  return !inv.paid && ["late", "partially_paid"].includes(inv.status ?? "");
}

/** Cache clients du run : succès uniquement (un 429 sera retenté au prochain sync). */
function customerCache(token: string) {
  const cache = new Map<string, PennylaneCustomer>();
  let lastCall = 0;
  return {
    async get(id: string | null): Promise<PennylaneCustomer | null> {
      if (!id) return null;
      const hit = cache.get(id);
      if (hit) return hit;
      // Cadence douce (≤ ~5 appels/s) : la limite Pennylane est 25 req/5 s.
      const wait = 220 - (Date.now() - lastCall);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastCall = Date.now();
      const res = await getCustomer(token, id);
      if (isPennylaneError(res)) return null;
      cache.set(id, res.customer);
      return res.customer;
    },
  };
}

function customerDisplayName(c: PennylaneCustomer | null): string | null {
  if (!c) return null;
  return c.name || [c.first_name, c.last_name].filter(Boolean).join(" ") || null;
}

function invoiceRow(
  organizationId: string,
  inv: PennylaneInvoice,
  customer: PennylaneCustomer | null,
  before: StoredInvoice | null,
) {
  const address = customer?.billing_address;
  const name = customerDisplayName(customer);
  return {
    organization_id: organizationId,
    provider: "pennylane",
    external_id: String(inv.id),
    invoice_number: inv.invoice_number ?? before?.invoice_number ?? null,
    label: inv.label?.slice(0, 300) ?? null,
    customer_external_id: inv.customer?.id != null ? String(inv.customer.id) : null,
    // Fiche client : les valeurs déjà connues sont CONSERVÉES quand on ne
    // re-consulte pas la fiche (sinon un re-sync les écraserait par null).
    customer_name: name ?? before?.customer_name ?? null,
    customer_email: customer?.emails?.[0] ?? before?.customer_email ?? null,
    customer_siren:
      (customer?.reg_no && /^\d{9}$/.test(customer.reg_no) ? customer.reg_no : null) ??
      before?.customer_siren ??
      null,
    customer_address:
      address?.address && address?.postal_code && address?.city
        ? {
            // `societe` seul : dupliquer le nom dans `nom` ET `societe`
            // dédoublerait le destinataire sur le recommandé.
            nom: "",
            societe: name ?? "",
            adresse: address.address,
            codePostal: address.postal_code,
            ville: address.city,
          }
        : (before?.customer_address ?? null),
    amount_cents: euroStringToCents(inv.amount),
    remaining_cents: euroStringToCents(inv.remaining_amount_with_tax),
    currency: inv.currency ?? "EUR",
    issued_on: inv.date ? inv.date.slice(0, 10) : null,
    deadline_on: inv.deadline ? inv.deadline.slice(0, 10) : null,
    status: inv.status ?? null,
    paid: inv.paid === true,
    synced_at: new Date().toISOString(),
  };
}

export async function syncPennylaneOrg(
  sb: SupabaseClient,
  integration: IntegrationRow,
): Promise<{ ok: boolean; error?: string }> {
  const { data: secret } = await sb
    .from("org_integration_secrets")
    .select("token_encrypted")
    .eq("integration_id", integration.id)
    .maybeSingle();
  if (!secret) return await fail(sb, integration, "Token de connexion introuvable — reconnectez Pennylane.");

  let token: string;
  try {
    token = await decryptToken(secret.token_encrypted);
  } catch (e) {
    // Détail (nom de clé interne…) réservé aux logs serveur.
    console.error("[compta-sync] déchiffrement du token impossible", e);
    return await fail(
      sb,
      integration,
      "Impossible de lire le token de connexion — reconnectez Pennylane ou contactez le support.",
    );
  }

  const customers = customerCache(token);
  const syncStartedAt = new Date().toISOString();
  const isFirstImport =
    !integration.sync_cursor ||
    Date.now() - new Date(integration.sync_cursor).getTime() >
      CURSOR_MAX_AGE_DAYS * 24 * 3600 * 1000;

  let invoices: PennylaneInvoice[];
  let deletedIds: string[] = [];
  let nextCursor: string;

  if (isFirstImport) {
    const since = new Date();
    since.setMonth(since.getMonth() - IMPORT_MONTHS);
    const res = await listInvoices(token, { sinceDate: since.toISOString().slice(0, 10) });
    if (isPennylaneError(res)) return await fail(sb, integration, res.error);
    invoices = res.invoices;
    // Marge d'une heure : l'horloge des processed_at est celle de Pennylane —
    // un léger chevauchement au prochain sync est idempotent, un trou non.
    nextCursor = new Date(Date.now() - 3600_000).toISOString();
  } else {
    const changes = await changedInvoiceIds(token, integration.sync_cursor!);
    if (isPennylaneError(changes)) return await fail(sb, integration, changes.error);
    deletedIds = changes.deletedIds;
    nextCursor = changes.lastProcessedAt ?? integration.sync_cursor!;
    if (changes.ids.length === 0) {
      invoices = [];
    } else {
      const res = await getInvoicesByIds(token, changes.ids);
      if (isPennylaneError(res)) return await fail(sb, integration, res.error);
      invoices = res.invoices;
    }
  }

  // État précédent (diff : transitions payée / actionnable, champs à conserver).
  const externalIds = invoices.map((i) => String(i.id));
  const { data: existingRows } = externalIds.length
    ? await sb
        .from("accounting_invoices")
        .select(
          "id, external_id, paid, status, case_id, invoice_number, customer_name, customer_email, customer_siren, customer_address",
        )
        .eq("organization_id", integration.organization_id)
        .eq("provider", "pennylane")
        .in("external_id", externalIds)
    : { data: [] };
  const previous = new Map<string, StoredInvoice>(
    ((existingRows as StoredInvoice[]) ?? []).map((r) => [r.external_id, r]),
  );

  let hadWriteError = false;

  for (const inv of invoices) {
    const externalId = String(inv.id);
    const before = previous.get(externalId) ?? null;
    // Fiche client : seulement quand elle manque ET que la facture le mérite
    // (impayée actionnable, ou liée à un dossier) — économie de requêtes sur
    // les gros historiques payés.
    const needCustomer =
      (!before || !before.customer_name) &&
      (isActionableUnpaid({ paid: inv.paid ?? false, status: inv.status ?? null }) ||
        Boolean(before?.case_id));
    const customer = needCustomer
      ? await customers.get(inv.customer?.id != null ? String(inv.customer.id) : null)
      : null;
    const row = invoiceRow(integration.organization_id, inv, customer, before);

    const { error: upsertErr } = await sb
      .from("accounting_invoices")
      .upsert(row, { onConflict: "organization_id,provider,external_id" });
    if (upsertErr) {
      // Le curseur n'avancera pas : ce lot sera rejoué (idempotent).
      hadWriteError = true;
      continue;
    }

    const displayName = row.customer_name ?? "un client";
    const numberLabel = row.invoice_number ? `nº ${row.invoice_number}` : "";
    const becamePaid = before && !before.paid && inv.paid === true;
    const becameActionable =
      !isFirstImport &&
      !row.paid &&
      isActionableUnpaid({ paid: row.paid, status: row.status }) &&
      (!before || !isActionableUnpaid(before)) &&
      !before?.case_id;

    if (becamePaid && before?.case_id) {
      // 🎉 Rentrée d'argent sur un dossier suivi : suggestion — jamais de
      // clôture automatique (pilier produit).
      await sb.from("case_events").insert({
        case_id: before.case_id,
        organization_id: integration.organization_id,
        event_type: "payment_detected",
        title: "Facture marquée payée dans votre compta",
        description: `Pennylane indique la facture ${numberLabel || "liée au dossier"} comme payée. Confirmez l’encaissement pour solder le dossier.`,
        source: "system",
      });
      await notifyOrganization(sb, {
        organizationId: integration.organization_id,
        caseId: before.case_id,
        kind: "integration",
        title: `Rentrée d’argent détectée — facture ${numberLabel || "payée"}`,
        body: `Pennylane marque la facture de ${displayName} comme payée. Ouvrez le dossier pour confirmer l’encaissement et le solder.`,
        href: `/app/dossiers/${before.case_id}`,
        email: true,
      });
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

  // Factures supprimées côté Pennylane : on retire la ligne importée (le
  // dossier BLEME éventuel reste, évidemment).
  if (deletedIds.length > 0) {
    await sb
      .from("accounting_invoices")
      .delete()
      .eq("organization_id", integration.organization_id)
      .eq("provider", "pennylane")
      .in("external_id", deletedIds);
  }

  // Vieillissement passif : une « upcoming » dont l'échéance est passée ne
  // génère AUCUN changelog — on la promeut « late » localement (le statut
  // Pennylane la confirmera au prochain vrai événement) + notification.
  const today = new Date().toISOString().slice(0, 10);
  const { data: newlyLate } = await sb
    .from("accounting_invoices")
    .select("id, invoice_number, customer_name, case_id")
    .eq("organization_id", integration.organization_id)
    .eq("provider", "pennylane")
    .eq("paid", false)
    .eq("status", "upcoming")
    .lt("deadline_on", today);
  for (const row of newlyLate ?? []) {
    const { error: promoteErr } = await sb
      .from("accounting_invoices")
      .update({ status: "late" })
      .eq("id", row.id)
      .eq("status", "upcoming");
    if (promoteErr || isFirstImport || row.case_id) continue;
    const numberLabel = row.invoice_number ? `nº ${row.invoice_number}` : "";
    await notifyOrganization(sb, {
      organizationId: integration.organization_id,
      kind: "integration",
      title: `Facture en retard détectée ${numberLabel}`.trim(),
      body: `L’échéance de la facture ${numberLabel || "importée"}${row.customer_name ? ` de ${row.customer_name}` : ""} est dépassée. Créez le dossier en un clic depuis le Suivi.`,
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
      // Erreur d'écriture → curseur inchangé, le lot sera rejoué.
      sync_cursor: hadWriteError ? integration.sync_cursor : nextCursor,
    })
    .eq("id", integration.id);
  return { ok: true };
}

async function fail(
  sb: SupabaseClient,
  integration: IntegrationRow,
  message: string,
): Promise<{ ok: false; error: string }> {
  await sb
    .from("org_integrations")
    .update({
      status: "error",
      last_error: message.slice(0, 300),
      last_sync_at: new Date().toISOString(),
    })
    .eq("id", integration.id);
  // Première bascule en erreur → l'utilisateur est prévenu (cloche) : sans
  // ça, les données vieillissent en silence jusqu'à sa prochaine visite des
  // Paramètres.
  if (integration.status !== "error") {
    await notifyOrganization(sb, {
      organizationId: integration.organization_id,
      kind: "alert",
      title: "Synchronisation Pennylane en échec",
      body: `${message} Vérifiez la connexion dans Paramètres → Connexions.`,
      href: "/app/parametres",
      email: false,
    });
  }
  return { ok: false, error: message };
}
