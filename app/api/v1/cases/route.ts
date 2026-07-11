import { z } from "zod";
import { authorize } from "@/lib/api/auth";
import { orgDb } from "@/lib/api/db";
import { ApiError, ok, readJsonBody, runApi } from "@/lib/api/response";
import {
  CASE_DETAIL_COLUMNS,
  CASE_LIST_COLUMNS,
  clampLimit,
  decodeCursor,
  encodeCursor,
  keysetOr,
} from "@/lib/api/resources";
import { createCaseCore } from "@/lib/cases/create";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateCaseSchema = z.object({
  case_type: z.enum(["unpaid_invoice", "client_dispute", "admin_request"]),
  debtor_name: z.string().trim().min(1).max(200),
  amount_claimed_cents: z.number().int().min(0).max(1_000_000_000).optional(),
  title: z.string().trim().max(200).optional(),
  summary: z.string().trim().max(5000).optional(),
  debtor_siren: z.string().trim().regex(/^\d{9}$/).optional(),
  debtor_email: z.string().trim().toLowerCase().email().optional(),
});

// GET /api/v1/cases — liste des dossiers (scope cases.view). Pagination curseur.
export async function GET(req: Request): Promise<Response> {
  return runApi(async () => {
    const ctx = await authorize(req, "cases.view");
    const url = new URL(req.url);
    const limit = clampLimit(url.searchParams.get("limit"));
    const cursor = decodeCursor(url.searchParams.get("cursor"));
    const status = url.searchParams.get("status");
    const caseType = url.searchParams.get("case_type");

    // Filtres AVANT les transforms (order/limit) — contrainte du query builder.
    let q = orgDb(ctx.orgId).select("cases", CASE_LIST_COLUMNS);
    if (status) q = q.eq("status", status);
    if (caseType) q = q.eq("case_type", caseType);
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

// POST /api/v1/cases — crée un dossier INERTE (scope cases.create). Aucun
// courrier, aucun envoi (pilier juridique #1). organization_id forcé, source='api'.
export async function POST(req: Request): Promise<Response> {
  return runApi(async () => {
    const ctx = await authorize(req, "cases.create");
    const input = CreateCaseSchema.parse(await readJsonBody(req, 256 * 1024));

    const created = await createCaseCore(
      ctx.orgId,
      {
        case_type: input.case_type,
        debtor_name: input.debtor_name,
        amount_claimed_cents: input.amount_claimed_cents,
        title: input.title,
        summary_md: input.summary ?? null,
        debtor_siren: input.debtor_siren ?? null,
        debtor_email: input.debtor_email ?? null,
      },
      { source: "api", eventTitle: "Dossier créé par l'API" },
    );
    if (!created) throw new ApiError("internal", 500, "Création du dossier impossible.");

    const { data } = await orgDb(ctx.orgId).select("cases", CASE_DETAIL_COLUMNS).eq("id", created.id).maybeSingle();
    return ok(data ?? { id: created.id }, 201);
  });
}
