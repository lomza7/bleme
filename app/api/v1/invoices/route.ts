import { z } from "zod";
import { authorize, requireScope } from "@/lib/api/auth";
import { orgDb } from "@/lib/api/db";
import { ApiError, ok, readJsonBody, runApi } from "@/lib/api/response";
import { INVOICE_COLUMNS, clampLimit, decodeCursor, encodeCursor, keysetOr } from "@/lib/api/resources";
import { pushInvoice } from "@/lib/api/invoices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PushInvoiceSchema = z.object({
  external_id: z.string().trim().min(1).max(200),
  invoice_number: z.string().trim().max(120).optional(),
  label: z.string().trim().max(200).optional(),
  customer_name: z.string().trim().max(200).optional(),
  customer_email: z.string().trim().toLowerCase().email().optional(),
  customer_siren: z.string().trim().regex(/^\d{9}$/).optional(),
  amount_cents: z.number().int().min(0).max(1_000_000_000).optional(),
  remaining_cents: z.number().int().min(0).max(1_000_000_000).optional(),
  currency: z.string().trim().length(3).optional(),
  issued_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  deadline_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paid: z.boolean().optional(),
  create_case: z.boolean().optional(),
  // Borné pour qu'un PDF accepté ici décode toujours sous le cap d'attachement
  // (10 Mo) : 13,6M chars base64 ≈ 10,2 Mo décodés — pas de rejet silencieux.
  pdf_base64: z.string().max(13_600_000).optional(),
});

// GET /api/v1/invoices — factures importées (scope compta.view). Pagination curseur.
export async function GET(req: Request): Promise<Response> {
  return runApi(async () => {
    const ctx = await authorize(req, "compta.view");
    const url = new URL(req.url);
    const limit = clampLimit(url.searchParams.get("limit"));
    const cursor = decodeCursor(url.searchParams.get("cursor"));
    const paid = url.searchParams.get("paid");
    const archived = url.searchParams.get("archived");
    const provider = url.searchParams.get("provider");

    // Filtres AVANT les transforms (order/limit) — contrainte du query builder.
    let q = orgDb(ctx.orgId).select("accounting_invoices", INVOICE_COLUMNS);
    if (paid === "true" || paid === "false") q = q.eq("paid", paid === "true");
    if (archived === "true") q = q.not("archived_at", "is", null);
    else if (archived === "false") q = q.is("archived_at", null);
    if (provider) q = q.eq("provider", provider);
    if (cursor) q = q.or(keysetOr(cursor));

    const { data, error } = await q
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);
    if (error) throw new ApiError("internal", 500, "Lecture impossible.");
    const rows = (data ?? []) as unknown as { created_at: string; id: string }[];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return ok({ data: page, next_cursor: hasMore ? encodeCursor(page[page.length - 1]) : null });
  });
}

// POST /api/v1/invoices — pousse une facture (scope compta.manage). Upsert
// idempotent sur external_id. create_case → dossier lié (exige aussi cases.create).
export async function POST(req: Request): Promise<Response> {
  return runApi(async () => {
    const ctx = await authorize(req, "compta.manage");
    // ~10 Mo de PDF en base64 + marge pour les autres champs.
    const input = PushInvoiceSchema.parse(await readJsonBody(req, 15 * 1024 * 1024));
    if (input.create_case) requireScope(ctx, "cases.create");

    const res = await pushInvoice(ctx.orgId, input, input.create_case ?? false);
    if (!res) throw new ApiError("internal", 500, "Import de la facture impossible.");
    return ok({
      ...res.invoice,
      case_id: res.case_id,
      // Statut explicite de la pièce jointe quand un PDF a été fourni.
      ...(res.pdf_attached !== null ? { pdf_attached: res.pdf_attached } : {}),
    });
  });
}
