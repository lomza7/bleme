import "server-only";
import {
  changedInvoiceIds,
  downloadInvoicePdf as plDownloadPdf,
  euroStringToCents,
  getCustomer,
  getInvoicesByIds,
  isPennylaneError,
  listInvoices,
  verifyToken,
  type PennylaneCustomer,
  type PennylaneInvoice,
} from "@/lib/integrations/pennylane";
import type {
  ComptaAdapter,
  FetchOpts,
  FetchResult,
  IntegrationError,
  PivotCustomer,
  PivotInvoice,
  PivotStatus,
} from "@/lib/integrations/types";

/*
 * Adaptateur Pennylane : enveloppe le client bas niveau (lib/integrations/
 * pennylane.ts, inchangé et éprouvé en prod) et normalise vers le format
 * pivot. Détection des changements par le flux /changelogs.
 */

const IMPORT_MONTHS = 18;

function mapStatus(s: string | null | undefined, paid: boolean): PivotStatus {
  const v = s ?? "";
  if (paid) return "paid";
  if (["late", "upcoming", "partially_paid", "paid", "draft", "credit_note", "cancelled"].includes(v)) {
    return v as PivotStatus;
  }
  return "other";
}

function customerName(c: PennylaneCustomer | null): string | null {
  if (!c) return null;
  return c.name || [c.first_name, c.last_name].filter(Boolean).join(" ") || null;
}

function toPivotCustomer(c: PennylaneCustomer | null): PivotCustomer | null {
  if (!c) return null;
  const a = c.billing_address;
  return {
    name: customerName(c),
    email: c.emails?.[0] ?? null,
    siren: c.reg_no && /^\d{9}$/.test(c.reg_no) ? c.reg_no : null,
    address:
      a?.address && a?.postal_code && a?.city
        ? { adresse: a.address, codePostal: a.postal_code, ville: a.city }
        : null,
  };
}

/** Cache client + cadence anti-429 (25 req / 5 s côté Pennylane). */
function customerResolver(token: string) {
  const cache = new Map<string, PivotCustomer | null>();
  let last = 0;
  return async (id: string | null): Promise<PivotCustomer | null> => {
    if (!id) return null;
    if (cache.has(id)) return cache.get(id) ?? null;
    const wait = 220 - (Date.now() - last);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    const res = await getCustomer(token, id);
    const pivot = isPennylaneError(res) ? null : toPivotCustomer(res.customer);
    cache.set(id, pivot);
    return pivot;
  };
}

async function toPivot(
  invoices: PennylaneInvoice[],
  resolveCustomer: (id: string | null) => Promise<PivotCustomer | null>,
): Promise<PivotInvoice[]> {
  const out: PivotInvoice[] = [];
  for (const inv of invoices) {
    const paid = inv.paid === true;
    // Brouillons et avoirs sont des BOOLÉENS distincts du statut : un avoir
    // finalisé impayé porte un statut de paiement (late/upcoming), pas
    // 'credit_note' — on les écarte ici pour que le sync ne les stocke jamais.
    const status: PivotStatus =
      inv.draft === true ? "draft" : inv.credit_note === true ? "credit_note" : mapStatus(inv.status, paid);
    // Fiche client uniquement pour les factures non réglées (les payées de
    // l'historique sont la masse — on évite le N+1 dessus).
    const customer = !paid
      ? await resolveCustomer(inv.customer?.id != null ? String(inv.customer.id) : null)
      : null;
    out.push({
      externalId: String(inv.id),
      invoiceNumber: inv.invoice_number ?? null,
      label: inv.label ?? null,
      customer: customer
        ? { ...customer, externalId: inv.customer?.id != null ? String(inv.customer.id) : null }
        : null,
      amountCents: euroStringToCents(inv.amount),
      remainingCents: euroStringToCents(inv.remaining_amount_with_tax),
      currency: inv.currency ?? "EUR",
      issuedOn: inv.date ? inv.date.slice(0, 10) : null,
      deadlineOn: inv.deadline ? inv.deadline.slice(0, 10) : null,
      status,
      paid,
    });
  }
  return out;
}

export const pennylaneAdapter: ComptaAdapter = {
  provider: "pennylane",
  importMonths: IMPORT_MONTHS,
  cursorMaxAgeDays: 21, // rétention changelog Pennylane = 4 semaines

  async verifyCredentials(creds) {
    return verifyToken(creds);
  },

  parseConnectForm(formData) {
    const token = String(formData.get("token") ?? "").trim();
    if (token.length < 20) {
      return { error: "Collez le token API Pennylane (Paramètres → Connectivité → Développeurs)." };
    }
    return { creds: token };
  },

  async fetchInvoices(creds, opts: FetchOpts): Promise<FetchResult | IntegrationError> {
    const resolveCustomer = customerResolver(creds);
    if (opts.firstImport) {
      const since = new Date();
      since.setMonth(since.getMonth() - IMPORT_MONTHS);
      const res = await listInvoices(creds, { sinceDate: since.toISOString().slice(0, 10) });
      if (isPennylaneError(res)) return res;
      const invoices = await toPivot(res.invoices, resolveCustomer);
      // Marge d'1 h : les processed_at du changelog sont horodatés côté
      // Pennylane ; un léger chevauchement au prochain sync est idempotent.
      return { invoices, deletedExternalIds: [], nextCursor: new Date(Date.now() - 3600_000).toISOString() };
    }
    const changes = await changedInvoiceIds(creds, opts.cursor ?? new Date(Date.now() - 86_400_000).toISOString());
    if (isPennylaneError(changes)) return changes;
    if (changes.ids.length === 0) {
      return { invoices: [], deletedExternalIds: changes.deletedIds, nextCursor: changes.lastProcessedAt ?? opts.cursor };
    }
    const res = await getInvoicesByIds(creds, changes.ids);
    if (isPennylaneError(res)) return res;
    const invoices = await toPivot(res.invoices, resolveCustomer);
    return {
      invoices,
      deletedExternalIds: changes.deletedIds,
      nextCursor: changes.lastProcessedAt ?? opts.cursor,
    };
  },

  async downloadInvoicePdf(creds, externalId) {
    return plDownloadPdf(creds, externalId);
  },
};
