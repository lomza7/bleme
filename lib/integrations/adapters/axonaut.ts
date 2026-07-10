import "server-only";
import { z } from "zod";
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
 * Adaptateur Axonaut (API v2). Auth : header `userApiKey`. Base
 * https://axonaut.com/api/v2. Factures filtrables par is_paid ; pas de statut
 * dans la réponse → déduit de paid_date/outstanding_amount/due_date. Détection
 * de paiement par POLLING (pas de webhook « payé »). PDF via public_path.
 */

const BASE = "https://axonaut.com/api/v2";
const PER_PAGE = 100;

async function axoFetch(
  key: string,
  path: string,
  query: Record<string, string> = {},
  page?: number,
): Promise<unknown | IntegrationError> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const headers: Record<string, string> = { userApiKey: key, accept: "application/json" };
  if (page != null) headers.page = String(page);
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { headers, cache: "no-store" });
    } catch {
      return { error: "Impossible de joindre l’API Axonaut." };
    }
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      return { error: "Clé API Axonaut refusée (invalide ou révoquée). Reconnectez l’intégration.", status: res.status };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (body) console.error(`[axonaut] ${res.status} sur ${path} :`, body.slice(0, 500));
      return { error: `L’API Axonaut a répondu ${res.status}.`, status: res.status };
    }
    return res.json().catch(() => ({ error: "Réponse Axonaut illisible." }));
  }
  return { error: "L’API Axonaut limite les requêtes (429) — réessayez." };
}

const invoiceSchema = z.looseObject({
  id: z.union([z.number(), z.string()]),
  number: z.string().nullable().optional(),
  date: z.union([z.string(), z.number()]).nullable().optional(),
  due_date: z.union([z.string(), z.number()]).nullable().optional(),
  paid_date: z.union([z.string(), z.number()]).nullable().optional(),
  total: z.number().nullable().optional(),
  outstanding_amount: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  company: z.looseObject({ id: z.union([z.number(), z.string()]).nullable().optional(), name: z.string().nullable().optional() }).nullable().optional(),
  billing_address: z
    .looseObject({ zip_code: z.string().nullable().optional(), city: z.string().nullable().optional() })
    .nullable()
    .optional(),
});
type AxoInvoice = z.infer<typeof invoiceSchema>;

const companySchema = z.looseObject({
  id: z.union([z.number(), z.string()]),
  name: z.string().nullable().optional(),
  address_street: z.string().nullable().optional(),
  address_zip_code: z.string().nullable().optional(),
  address_city: z.string().nullable().optional(),
  siret: z.string().nullable().optional(),
  employees: z
    .array(z.looseObject({ email: z.string().nullable().optional(), is_billing_contact: z.boolean().nullable().optional() }))
    .nullable()
    .optional(),
});

function euros(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n * 100) : null;
}
/**
 * Date Axonaut → « YYYY-MM-DD ». L'API renvoie selon les champs/versions soit
 * une chaîne « YYYY-MM-DD », soit un timestamp Unix (string|number) : on gère
 * les deux (défensif — un exemple de spec montrait de l'epoch, le client
 * officiel R parse du YYYY-MM-DD).
 */
function toIsoDate(v: string | number | null | undefined): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    const m = v.match(/^\d{4}-\d{2}-\d{2}/);
    if (m) return m[0];
    const t = Date.parse(v);
    if (Number.isFinite(t)) return new Date(t).toISOString().slice(0, 10);
    // Chaîne purement numérique = epoch en string.
    if (/^\d+$/.test(v)) return new Date(Number(v) * 1000).toISOString().slice(0, 10);
    return null;
  }
  return v > 0 ? new Date(v * 1000).toISOString().slice(0, 10) : null;
}
/** « DD/MM/YYYY » pour les filtres Axonaut. */
function ddmmyyyy(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

async function resolveCustomer(key: string, companyId: string | null): Promise<PivotCustomer | null> {
  if (!companyId) return null;
  const raw = await axoFetch(key, `/companies/${companyId}`);
  const parsed = companySchema.safeParse(raw);
  if (!parsed.success) return null;
  const c = parsed.data;
  const billing = (c.employees ?? []).find((e) => e.is_billing_contact && e.email);
  const email = billing?.email ?? (c.employees ?? []).find((e) => e.email)?.email ?? null;
  const siren = c.siret ? c.siret.replace(/\D/g, "").slice(0, 9) : null;
  return {
    externalId: companyId,
    name: c.name ?? null,
    email: email ?? null,
    siren: siren && siren.length === 9 ? siren : null,
    address:
      c.address_street && c.address_zip_code && c.address_city
        ? { adresse: c.address_street, codePostal: c.address_zip_code, ville: c.address_city }
        : null,
  };
}

function statusOf(inv: AxoInvoice): { status: PivotStatus; paid: boolean } {
  const paid = inv.paid_date != null && String(inv.paid_date) !== "";
  if (paid) return { status: "paid", paid: true };
  const total = inv.total ?? null;
  const outstanding = inv.outstanding_amount ?? null;
  if (outstanding != null && total != null && outstanding > 0 && outstanding < total) {
    return { status: "partially_paid", paid: false };
  }
  const deadline = toIsoDate(inv.due_date);
  if (deadline && deadline < new Date().toISOString().slice(0, 10)) return { status: "late", paid: false };
  return { status: "upcoming", paid: false };
}

async function toPivot(key: string, invoices: AxoInvoice[]): Promise<PivotInvoice[]> {
  const cache = new Map<string, PivotCustomer | null>();
  const out: PivotInvoice[] = [];
  for (const inv of invoices) {
    const { status, paid } = statusOf(inv);
    const companyId = inv.company?.id != null ? String(inv.company.id) : null;
    let customer: PivotCustomer | null = null;
    if (!paid && companyId) {
      if (cache.has(companyId)) customer = cache.get(companyId) ?? null;
      else {
        await new Promise((r) => setTimeout(r, 400)); // throttle conservateur
        customer = await resolveCustomer(key, companyId);
        cache.set(companyId, customer);
      }
    }
    // Repli : nom depuis la facture même si la fiche société n'a pas résolu.
    if (!customer && companyId && inv.company?.name) {
      customer = { externalId: companyId, name: inv.company.name, email: null, siren: null, address: null };
    }
    out.push({
      externalId: String(inv.id),
      invoiceNumber: inv.number ?? null,
      label: null,
      customer,
      amountCents: euros(inv.total),
      remainingCents: euros(inv.outstanding_amount ?? inv.total),
      currency: inv.currency ?? "EUR",
      issuedOn: toIsoDate(inv.date),
      deadlineOn: toIsoDate(inv.due_date),
      status,
      paid,
    });
  }
  return out;
}

/** Liste paginée (page en header, arrêt sous PER_PAGE). */
async function listAll(key: string, query: Record<string, string>): Promise<AxoInvoice[] | IntegrationError> {
  const all: AxoInvoice[] = [];
  for (let page = 1; page <= 50; page++) {
    const raw = await axoFetch(key, "/invoices", query, page);
    if (typeof raw === "object" && raw !== null && "error" in raw) return raw as IntegrationError;
    if (!Array.isArray(raw)) break;
    for (const item of raw) {
      const inv = invoiceSchema.safeParse(item);
      if (inv.success) all.push(inv.data);
    }
    if (raw.length < PER_PAGE) break;
  }
  return all;
}

export const axonautAdapter: ComptaAdapter = {
  provider: "axonaut",
  importMonths: 18,
  cursorMaxAgeDays: null, // pas de flux de changements → on re-liste, curseur = date de dernier sync

  async verifyCredentials(creds) {
    const raw = await axoFetch(creds, "/me");
    if (typeof raw === "object" && raw !== null && "error" in raw) return raw as IntegrationError;
    const me = z
      .looseObject({ account: z.array(z.looseObject({ company_name: z.string().nullable().optional() })).nullable().optional() })
      .safeParse(raw);
    return { companyName: me.success ? (me.data.account?.[0]?.company_name ?? null) : null };
  },

  parseConnectForm(formData) {
    const token = String(formData.get("token") ?? "").trim();
    if (token.length < 10) return { error: "Collez votre clé API Axonaut (roue crantée → onglet API)." };
    return { creds: token };
  },

  async fetchInvoices(creds, opts: FetchOpts): Promise<FetchResult | IntegrationError> {
    const nowIso = new Date().toISOString();
    const collected = new Map<string, AxoInvoice>();

    if (opts.firstImport) {
      const since = new Date();
      since.setMonth(since.getMonth() - this.importMonths);
      const open = await listAll(creds, { is_paid: "false" });
      if (!Array.isArray(open)) return open;
      const paid = await listAll(creds, { is_paid: "true", date_after: ddmmyyyy(since) });
      if (!Array.isArray(paid)) return paid;
      for (const inv of [...open, ...paid]) collected.set(String(inv.id), inv);
    } else {
      const open = await listAll(creds, { is_paid: "false" });
      if (!Array.isArray(open)) return open;
      for (const inv of open) collected.set(String(inv.id), inv);
      // Paiements récents depuis le dernier sync.
      const since = opts.cursor ? new Date(opts.cursor) : new Date(Date.now() - 7 * 86_400_000);
      const paid = await listAll(creds, { is_paid: "true", updated_after: ddmmyyyy(since) });
      if (!Array.isArray(paid)) return paid;
      for (const inv of paid) collected.set(String(inv.id), inv);
      // Factures suivies (dossier lié) non couvertes : re-vérification ciblée.
      for (const id of opts.trackedExternalIds) {
        if (collected.has(id)) continue;
        const raw = await axoFetch(creds, `/invoices/${id}`);
        const inv = invoiceSchema.safeParse(raw);
        if (inv.success) collected.set(id, inv.data);
      }
    }

    const invoices = await toPivot(creds, [...collected.values()]);
    return { invoices, deletedExternalIds: [], nextCursor: nowIso };
  },

  async downloadInvoicePdf(creds, externalId) {
    const raw = await axoFetch(creds, `/invoices/${externalId}`);
    const parsed = z.looseObject({ public_path: z.string().nullable().optional() }).safeParse(raw);
    const url = parsed.success ? parsed.data.public_path : null;
    if (!url) return { error: "PDF de la facture indisponible chez Axonaut." };
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return { error: `Téléchargement du PDF refusé (${res.status}).` };
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length === 0 || buffer.length > 25 * 1024 * 1024) return { error: "PDF vide ou trop lourd." };
      return { buffer, filename: `facture-axonaut-${externalId}.pdf` };
    } catch {
      return { error: "Téléchargement du PDF impossible." };
    }
  },
};
