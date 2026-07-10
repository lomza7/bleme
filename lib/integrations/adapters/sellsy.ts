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
 * Adaptateur Sellsy (API v2). Auth : OAuth2 client_credentials (Personal) —
 * l'utilisateur crée un accès API dans Réglages → Portail Développeur → API V2
 * et colle client_id + client_secret (stockés en JSON chiffré). Le token
 * serveur→serveur (Bearer, ~24 h) est obtenu à chaque passe, sans redirection
 * ni refresh à persister. Détection de paiement par POLLING (statut).
 */

const TOKEN_URL = "https://login.sellsy.com/oauth2/access-tokens";
const BASE = "https://api.sellsy.com/v2";

type Creds = { client_id: string; client_secret: string };

function parseCreds(creds: string): Creds | null {
  try {
    const o = JSON.parse(creds) as Partial<Creds>;
    if (o.client_id && o.client_secret) return { client_id: o.client_id, client_secret: o.client_secret };
  } catch {
    /* ignore */
  }
  return null;
}

async function getToken(creds: Creds): Promise<string | IntegrationError> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grant_type: "client_credentials", ...creds }),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (body) console.error(`[sellsy] token ${res.status} :`, body.slice(0, 300));
      return {
        error: "Identifiants Sellsy refusés (client_id / client_secret). Reconnectez l’intégration.",
        status: res.status,
      };
    }
    const json = (await res.json().catch(() => ({}))) as { access_token?: string };
    if (!json.access_token) return { error: "Réponse de token Sellsy illisible." };
    return json.access_token;
  } catch {
    return { error: "Impossible de joindre l’authentification Sellsy." };
  }
}

async function sellsyFetch(
  token: string,
  method: "GET" | "POST",
  path: string,
  opts: { query?: Record<string, string>; body?: unknown } = {},
): Promise<unknown | IntegrationError> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        cache: "no-store",
      });
    } catch {
      return { error: "Impossible de joindre l’API Sellsy." };
    }
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      return { error: "Accès Sellsy refusé (token expiré ou droits insuffisants). Reconnectez l’intégration.", status: res.status };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (body) console.error(`[sellsy] ${res.status} sur ${path} :`, body.slice(0, 500));
      return { error: `L’API Sellsy a répondu ${res.status}.`, status: res.status };
    }
    return res.json().catch(() => ({ error: "Réponse Sellsy illisible." }));
  }
  return { error: "L’API Sellsy limite les requêtes (429) — réessayez." };
}

const invoiceSchema = z.looseObject({
  id: z.union([z.number(), z.string()]),
  number: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  company_name: z.string().nullable().optional(),
  amounts: z
    .looseObject({
      total_incl_tax: z.string().nullable().optional(),
      total_remaining_due_incl_tax: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  related: z
    .array(z.looseObject({ id: z.union([z.number(), z.string()]).nullable().optional(), type: z.string().nullable().optional() }))
    .nullable()
    .optional(),
});
type SellsyInvoice = z.infer<typeof invoiceSchema>;

const listSchema = z.looseObject({
  data: z.array(z.unknown()).optional().default([]),
  pagination: z.looseObject({ offset: z.string().nullable().optional() }).nullable().optional(),
});

function centsFromStr(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const v = Number(String(raw).replace(",", "."));
  return Number.isFinite(v) ? Math.round(v * 100) : null;
}

function mapStatus(s: string | null | undefined): { status: PivotStatus; paid: boolean } {
  switch (s) {
    case "paid":
      return { status: "paid", paid: true };
    case "late":
      return { status: "late", paid: false };
    case "payinprogress":
      return { status: "partially_paid", paid: false };
    case "due":
      return { status: "upcoming", paid: false };
    case "draft":
      return { status: "draft", paid: false };
    case "cancelled":
      return { status: "cancelled", paid: false };
    default:
      return { status: "other", paid: false };
  }
}

async function resolveCustomer(
  token: string,
  related: SellsyInvoice["related"],
  cache: Map<string, PivotCustomer | null>,
): Promise<PivotCustomer | null> {
  const rel = (related ?? []).find((r) => r.type === "company" || r.type === "individual");
  if (!rel || rel.id == null) return null;
  const key = `${rel.type}:${rel.id}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const path = rel.type === "company" ? `/companies/${rel.id}` : `/individuals/${rel.id}`;
  const raw = await sellsyFetch(token, "GET", path);
  let out: PivotCustomer | null = null;
  const parsed = z
    .looseObject({
      name: z.string().nullable().optional(),
      first_name: z.string().nullable().optional(),
      last_name: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      legal_france: z.looseObject({ siren: z.string().nullable().optional() }).nullable().optional(),
    })
    .safeParse(raw);
  if (parsed.success) {
    const c = parsed.data;
    const name = c.name || [c.first_name, c.last_name].filter(Boolean).join(" ") || null;
    const siren = c.legal_france?.siren && /^\d{9}$/.test(c.legal_france.siren) ? c.legal_france.siren : null;
    out = { externalId: String(rel.id), name, email: c.email ?? null, siren, address: null };
  }
  cache.set(key, out);
  return out;
}

async function toPivot(token: string, invoices: SellsyInvoice[]): Promise<PivotInvoice[]> {
  const cache = new Map<string, PivotCustomer | null>();
  const out: PivotInvoice[] = [];
  for (const inv of invoices) {
    const { status, paid } = mapStatus(inv.status);
    // Fiche client : uniquement pour les factures non réglées (économie de quota).
    let customer: PivotCustomer | null = null;
    if (!paid) customer = await resolveCustomer(token, inv.related, cache);
    if (!customer && inv.company_name) customer = { name: inv.company_name, email: null, siren: null, address: null };
    out.push({
      externalId: String(inv.id),
      invoiceNumber: inv.number ?? null,
      label: null,
      customer,
      amountCents: centsFromStr(inv.amounts?.total_incl_tax),
      remainingCents: centsFromStr(inv.amounts?.total_remaining_due_incl_tax ?? inv.amounts?.total_incl_tax),
      currency: inv.currency ?? "EUR",
      issuedOn: inv.date ? inv.date.slice(0, 10) : null,
      deadlineOn: inv.due_date ? inv.due_date.slice(0, 10) : null,
      status,
      paid,
    });
  }
  return out;
}

/** Recherche paginée (seek : offset = curseur base64 opaque). */
async function search(token: string, filters: Record<string, unknown>): Promise<SellsyInvoice[] | IntegrationError> {
  const all: SellsyInvoice[] = [];
  let offset: string | null = null;
  for (let page = 0; page < 50; page++) {
    const query: Record<string, string> = { limit: "100", order: "due_date" };
    if (offset) query.offset = offset;
    const raw = await sellsyFetch(token, "POST", "/invoices/search", { query, body: { filters } });
    if (typeof raw === "object" && raw !== null && "error" in raw) return raw as IntegrationError;
    const parsed = listSchema.safeParse(raw);
    if (!parsed.success) return { error: "Liste de factures Sellsy illisible." };
    for (const item of parsed.data.data) {
      const inv = invoiceSchema.safeParse(item);
      if (inv.success) all.push(inv.data);
    }
    const next = parsed.data.pagination?.offset ?? null;
    if (!next || parsed.data.data.length === 0) break;
    offset = next;
  }
  return all;
}

export const sellsyAdapter: ComptaAdapter = {
  provider: "sellsy",
  importMonths: 18,
  cursorMaxAgeDays: null,

  async verifyCredentials(creds) {
    const parsed = parseCreds(creds);
    if (!parsed) return { error: "Identifiants Sellsy incomplets." };
    const token = await getToken(parsed);
    if (typeof token !== "string") return token;
    // Un token obtenu = identifiants valides. Nom d'entreprise non exposé simplement.
    return { companyName: null };
  },

  parseConnectForm(formData) {
    const clientId = String(formData.get("client_id") ?? "").trim();
    const clientSecret = String(formData.get("client_secret") ?? "").trim();
    if (clientId.length < 6 || clientSecret.length < 6) {
      return { error: "Collez le Client ID et le Client Secret de votre accès API Sellsy." };
    }
    return { creds: JSON.stringify({ client_id: clientId, client_secret: clientSecret }) };
  },

  async fetchInvoices(creds, opts: FetchOpts): Promise<FetchResult | IntegrationError> {
    const parsed = parseCreds(creds);
    if (!parsed) return { error: "Identifiants Sellsy illisibles." };
    const token = await getToken(parsed);
    if (typeof token !== "string") return token;

    const collected = new Map<string, SellsyInvoice>();

    if (opts.firstImport) {
      const since = new Date();
      since.setMonth(since.getMonth() - this.importMonths);
      const open = await search(token, { status: ["due", "payinprogress", "late"] });
      if (!Array.isArray(open)) return open;
      const paid = await search(token, {
        status: ["paid"],
        date: { start: since.toISOString().slice(0, 10), end: new Date().toISOString().slice(0, 10) },
      });
      if (!Array.isArray(paid)) return paid;
      for (const inv of [...open, ...paid]) collected.set(String(inv.id), inv);
    } else {
      const open = await search(token, { status: ["due", "payinprogress", "late"] });
      if (!Array.isArray(open)) return open;
      for (const inv of open) collected.set(String(inv.id), inv);
      // Factures suivies non présentes dans la liste ouverte → re-vérif par id
      // (elles ont pu passer « payée » / « annulée »).
      for (const id of opts.trackedExternalIds) {
        if (collected.has(id)) continue;
        const raw = await sellsyFetch(token, "GET", `/invoices/${id}`);
        const inv = invoiceSchema.safeParse(raw);
        if (inv.success) collected.set(id, inv.data);
      }
    }

    const invoices = await toPivot(token, [...collected.values()]);
    return { invoices, deletedExternalIds: [], nextCursor: new Date().toISOString() };
  },

  async downloadInvoicePdf(creds, externalId) {
    const parsed = parseCreds(creds);
    if (!parsed) return { error: "Identifiants Sellsy illisibles." };
    const token = await getToken(parsed);
    if (typeof token !== "string") return token;
    // pdf_link est régénéré à chaque MAJ du document → relire la facture d'abord.
    const raw = await sellsyFetch(token, "GET", `/invoices/${externalId}`);
    const parsedInv = z.looseObject({ pdf_link: z.string().nullable().optional() }).safeParse(raw);
    const url = parsedInv.success ? parsedInv.data.pdf_link : null;
    if (!url) return { error: "PDF de la facture indisponible chez Sellsy." };
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return { error: `Téléchargement du PDF refusé (${res.status}).` };
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length === 0 || buffer.length > 25 * 1024 * 1024) return { error: "PDF vide ou trop lourd." };
      return { buffer, filename: `facture-sellsy-${externalId}.pdf` };
    } catch {
      return { error: "Téléchargement du PDF impossible." };
    }
  },
};
