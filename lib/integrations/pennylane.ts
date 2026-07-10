import "server-only";
import { z } from "zod";

/*
 * Client API Pennylane v2 (https://pennylane.readme.io) — lecture seule.
 *
 * Périmètre BLEME : factures clients (impayées → dossier en 1 clic ; passage
 * à « payée » → suggestion de clôture) + fiche client (pré-remplissage). Le
 * token est un Company API Token collé par l'utilisateur (scopes conseillés :
 * customer_invoices:readonly + customers:readonly ; plan Essential+ requis).
 *
 * Particularités de l'API (confirmées, doc 15) :
 * - montants en STRINGS d'euros (« 1250.00 ») → conversion _cents ici ;
 * - PAS de filtre serveur sur paid/status → filtrage applicatif ;
 * - public_file_url du PDF expire en 30 min → téléchargement immédiat ;
 * - détection des changements par /changelogs (rétention 4 semaines) ;
 * - 25 requêtes / 5 s / token (on retente une fois sur 429).
 */

const BASE = "https://app.pennylane.com/api/external/v2";

export type PennylaneError = { error: string; status?: number };

function isErr<T extends object>(r: T | PennylaneError): r is PennylaneError {
  return "error" in r;
}

async function plFetch(
  token: string,
  path: string,
  params?: Record<string, string>,
): Promise<unknown | PennylaneError> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });
    } catch {
      return { error: "Impossible de joindre l’API Pennylane." };
    }
    if (res.status === 429 && attempt === 0) {
      const wait = Math.min(Number(res.headers.get("retry-after") ?? "3") * 1000, 10_000);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      return {
        error:
          "Token Pennylane refusé (expiré, révoqué ou permissions insuffisantes). Reconnectez l’intégration.",
        status: res.status,
      };
    }
    if (!res.ok) {
      // On capture le corps : les 400 Pennylane expliquent le champ fautif.
      const body = await res.text().catch(() => "");
      if (body) console.error(`[pennylane] ${res.status} sur ${path} :`, body.slice(0, 500));
      const detail = body ? ` ${body.replace(/\s+/g, " ").slice(0, 180)}` : "";
      return { error: `L’API Pennylane a répondu ${res.status}.${detail}`, status: res.status };
    }
    return res.json().catch(() => ({ error: "Réponse Pennylane illisible." }));
  }
  return { error: "L’API Pennylane limite les requêtes (429) — réessayez dans un instant." };
}

/** « 1250.00 » (euros, string) → 125000 (centimes). Null si illisible. */
export function euroStringToCents(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const value = Number(String(raw).replace(",", "."));
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

// ── Schémas (souples : l'API ajoute des champs sans préavis) ─────────────────

const invoiceSchema = z.looseObject({
  id: z.union([z.number(), z.string()]),
  invoice_number: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  amount: z.string().nullable().optional(),
  remaining_amount_with_tax: z.string().nullable().optional(),
  paid: z.boolean().nullable().optional(),
  status: z.string().nullable().optional(),
  draft: z.boolean().nullable().optional(),
  credit_note: z.boolean().nullable().optional(),
  public_file_url: z.string().nullable().optional(),
  filename: z.string().nullable().optional(),
  customer: z.looseObject({ id: z.union([z.number(), z.string()]).nullable().optional() }).nullable().optional(),
});
export type PennylaneInvoice = z.infer<typeof invoiceSchema>;

const listSchema = z.looseObject({
  items: z.array(z.unknown()).optional().default([]),
  has_more: z.boolean().optional().default(false),
  next_cursor: z.string().nullable().optional(),
});

const customerSchema = z.looseObject({
  id: z.union([z.number(), z.string()]),
  name: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  emails: z.array(z.string()).nullable().optional(),
  reg_no: z.string().nullable().optional(),
  billing_address: z
    .looseObject({
      address: z.string().nullable().optional(),
      postal_code: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type PennylaneCustomer = z.infer<typeof customerSchema>;

const changelogSchema = z.looseObject({
  items: z
    .array(
      z.looseObject({
        id: z.union([z.number(), z.string()]),
        operation: z.string().optional(),
        processed_at: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  has_more: z.boolean().optional().default(false),
  next_cursor: z.string().nullable().optional(),
});

// ── Opérations ───────────────────────────────────────────────────────────────

/** Vérifie le token (GET /me) et tente d'en extraire le nom de l'entreprise. */
export async function verifyToken(
  token: string,
): Promise<{ companyName: string | null } | PennylaneError> {
  const raw = await plFetch(token, "/me");
  if (typeof raw === "object" && raw !== null && "error" in raw) return raw as PennylaneError;
  const me = z
    .looseObject({
      company: z.looseObject({ name: z.string().nullable().optional() }).nullable().optional(),
      companies: z
        .array(z.looseObject({ name: z.string().nullable().optional() }))
        .nullable()
        .optional(),
    })
    .safeParse(raw);
  const companyName = me.success
    ? (me.data.company?.name ?? me.data.companies?.[0]?.name ?? null)
    : null;
  return { companyName };
}

/**
 * Factures clients finalisées (ni brouillon ni avoir), paginées. Le filtrage
 * « impayée » se fait chez l'appelant (pas de filtre serveur sur paid/status).
 */
export async function listInvoices(
  token: string,
  opts?: { sinceDate?: string; maxPages?: number },
): Promise<{ invoices: PennylaneInvoice[] } | PennylaneError> {
  // ⚠️ `draft` et `credit_note` NE SONT PAS des champs de filtre valides côté
  // Pennylane (400) — seul `date` l'est. Les brouillons et avoirs sont donc
  // écartés côté BLEME (dans le sync), pas dans la requête.
  const filters: { field: string; operator: string; value: unknown }[] = [];
  if (opts?.sinceDate) filters.push({ field: "date", operator: "gteq", value: opts.sinceDate });

  const invoices: PennylaneInvoice[] = [];
  let cursor: string | null = null;
  const maxPages = opts?.maxPages ?? 20;
  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = {
      limit: "100",
      sort: "-date",
    };
    if (filters.length > 0) params.filter = JSON.stringify(filters);
    if (cursor) params.cursor = cursor;
    const raw = await plFetch(token, "/customer_invoices", params);
    if (typeof raw === "object" && raw !== null && "error" in raw) return raw as PennylaneError;
    const parsed = listSchema.safeParse(raw);
    if (!parsed.success) return { error: "Liste de factures Pennylane illisible." };
    for (const item of parsed.data.items) {
      const inv = invoiceSchema.safeParse(item);
      if (inv.success) invoices.push(inv.data);
    }
    if (!parsed.data.has_more || !parsed.data.next_cursor) break;
    cursor = parsed.data.next_cursor;
  }
  return { invoices };
}

/** Factures par ids (re-fetch batch après un changelog). */
export async function getInvoicesByIds(
  token: string,
  ids: string[],
): Promise<{ invoices: PennylaneInvoice[] } | PennylaneError> {
  const invoices: PennylaneInvoice[] = [];
  // Lots de 50 ids pour rester loin des limites d'URL.
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const raw = await plFetch(token, "/customer_invoices", {
      limit: "100",
      filter: JSON.stringify([{ field: "id", operator: "in", value: batch }]),
    });
    if (typeof raw === "object" && raw !== null && "error" in raw) return raw as PennylaneError;
    const parsed = listSchema.safeParse(raw);
    if (!parsed.success) return { error: "Liste de factures Pennylane illisible." };
    for (const item of parsed.data.items) {
      const inv = invoiceSchema.safeParse(item);
      if (inv.success) invoices.push(inv.data);
    }
  }
  return { invoices };
}

/** Fiche client (nom, SIREN, emails, adresse) pour le pré-remplissage. */
export async function getCustomer(
  token: string,
  customerId: string,
): Promise<{ customer: PennylaneCustomer } | PennylaneError> {
  const raw = await plFetch(token, `/customers/${customerId}`);
  if (typeof raw === "object" && raw !== null && "error" in raw) return raw as PennylaneError;
  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success) return { error: "Fiche client Pennylane illisible." };
  return { customer: parsed.data };
}

/**
 * Ids des factures modifiées ET supprimées depuis `sinceISO` (endpoint
 * changelogs, tri processed_at ASC, rétention 4 semaines).
 */
export async function changedInvoiceIds(
  token: string,
  sinceISO: string,
): Promise<
  { ids: string[]; deletedIds: string[]; lastProcessedAt: string | null } | PennylaneError
> {
  const ids = new Set<string>();
  const deletedIds = new Set<string>();
  let lastProcessedAt: string | null = null;
  let cursor: string | null = null;
  for (let page = 0; page < 20; page++) {
    const params: Record<string, string> = { limit: "1000" };
    // start_date et cursor sont mutuellement exclusifs.
    if (cursor) params.cursor = cursor;
    else params.start_date = sinceISO;
    const raw = await plFetch(token, "/changelogs/customer_invoices", params);
    if (typeof raw === "object" && raw !== null && "error" in raw) return raw as PennylaneError;
    const parsed = changelogSchema.safeParse(raw);
    if (!parsed.success) return { error: "Changelog Pennylane illisible." };
    for (const item of parsed.data.items) {
      const id = String(item.id);
      if (item.operation === "delete") {
        deletedIds.add(id);
        ids.delete(id);
      } else {
        ids.add(id);
        deletedIds.delete(id);
      }
      if (item.processed_at) lastProcessedAt = item.processed_at;
    }
    if (!parsed.data.has_more || !parsed.data.next_cursor) break;
    cursor = parsed.data.next_cursor;
  }
  return { ids: [...ids], deletedIds: [...deletedIds], lastProcessedAt };
}

/**
 * Télécharge le PDF d'une facture (l'URL publique expire en 30 minutes → on
 * re-lit la facture puis on récupère le fichier immédiatement).
 */
export async function downloadInvoicePdf(
  token: string,
  externalId: string,
): Promise<{ buffer: Buffer; filename: string } | PennylaneError> {
  const raw = await plFetch(token, `/customer_invoices/${externalId}`);
  if (typeof raw === "object" && raw !== null && "error" in raw) return raw as PennylaneError;
  const parsed = invoiceSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.public_file_url) {
    return { error: "PDF de la facture indisponible chez Pennylane." };
  }
  try {
    const res = await fetch(parsed.data.public_file_url, { cache: "no-store" });
    if (!res.ok) return { error: `Téléchargement du PDF refusé (${res.status}).` };
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > 25 * 1024 * 1024) {
      return { error: "PDF de facture vide ou trop lourd." };
    }
    return { buffer, filename: parsed.data.filename || "facture.pdf" };
  } catch {
    return { error: "Téléchargement du PDF impossible." };
  }
}

export { isErr as isPennylaneError };
