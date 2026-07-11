import { z } from "zod";
import { authorize } from "@/lib/api/auth";
import { orgDb } from "@/lib/api/db";
import { ApiError, ok, runApi } from "@/lib/api/response";
import { LETTER_COLUMNS, TRACKING_COLUMNS } from "@/lib/api/resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/cases/{id}/letters — courriers d'un dossier + suivi d'envoi
// (scope cases.view). LECTURE SEULE : l'envoi n'est jamais disponible par API
// (pilier juridique #1 — validation humaine loggée requise).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return runApi(async () => {
    const ctx = await authorize(req, "cases.view");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new ApiError("not_found", 404, "Dossier introuvable.");

    const db = orgDb(ctx.orgId);
    // Vérifie l'appartenance du dossier à l'org avant d'exposer ses courriers.
    const { data: dossier } = await db.select("cases", "id").eq("id", id).maybeSingle();
    if (!dossier) throw new ApiError("not_found", 404, "Dossier introuvable.");

    const { data: letters } = await db
      .select("letters", LETTER_COLUMNS)
      .eq("case_id", id)
      .order("created_at", { ascending: true });
    const list = (letters ?? []) as unknown as { id: string }[];

    let events: { letter_id: string }[] = [];
    if (list.length > 0) {
      const { data: ev } = await db
        .select("letter_tracking_events", TRACKING_COLUMNS)
        .in("letter_id", list.map((l) => l.id))
        .order("occurred_at", { ascending: true });
      events = (ev ?? []) as unknown as { letter_id: string }[];
    }

    return ok({
      data: list.map((l) => ({ ...l, tracking: events.filter((e) => e.letter_id === l.id) })),
    });
  });
}
