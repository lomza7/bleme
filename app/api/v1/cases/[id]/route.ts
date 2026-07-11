import { z } from "zod";
import { authorize } from "@/lib/api/auth";
import { orgDb } from "@/lib/api/db";
import { ApiError, ok, runApi } from "@/lib/api/response";
import { CASE_DETAIL_COLUMNS, DOCUMENT_COLUMNS, EVENT_COLUMNS, LETTER_COLUMNS } from "@/lib/api/resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/cases/{id} — détail d'un dossier (scope cases.view).
// 404 si le dossier n'appartient pas à l'org de la clé (pas de divulgation).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return runApi(async () => {
    const ctx = await authorize(req, "cases.view");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new ApiError("not_found", 404, "Dossier introuvable.");

    const db = orgDb(ctx.orgId);
    const { data: dossier } = await db.select("cases", CASE_DETAIL_COLUMNS).eq("id", id).maybeSingle();
    if (!dossier) throw new ApiError("not_found", 404, "Dossier introuvable.");

    const [{ data: letters }, { data: documents }, { data: events }] = await Promise.all([
      db.select("letters", LETTER_COLUMNS).eq("case_id", id).order("created_at", { ascending: true }),
      db.select("documents", DOCUMENT_COLUMNS).eq("case_id", id).order("created_at", { ascending: true }),
      db.select("case_events", EVENT_COLUMNS).eq("case_id", id).order("event_date", { ascending: true }),
    ]);

    return ok({
      ...(dossier as unknown as Record<string, unknown>),
      letters: letters ?? [],
      documents: documents ?? [],
      events: events ?? [],
    });
  });
}
