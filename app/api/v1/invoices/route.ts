import { authorize } from "@/lib/api/auth";
import { orgDb } from "@/lib/api/db";
import { ApiError, ok, runApi } from "@/lib/api/response";
import { INVOICE_COLUMNS, clampLimit, decodeCursor, encodeCursor, keysetOr } from "@/lib/api/resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
