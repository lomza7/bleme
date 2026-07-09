import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/*
 * État de génération du Contexte (~60 octets) : pollé par le panneau quand une
 * régénération est en cours (marqueur living_brief_requested_at posé par
 * touchCase, soldé par la RPC). Client USER-SCOPED : l'isolation du poll
 * repose sur la RLS (pilier #4) — jamais de service client ici.
 */

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase
    .from("cases")
    .select("living_brief_version, living_brief_updated_at, living_brief_requested_at")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const requested = data.living_brief_requested_at ? Date.parse(data.living_brief_requested_at) : null;
  const updated = data.living_brief_updated_at ? Date.parse(data.living_brief_updated_at) : null;
  // « en cours » si demandé après la dernière écriture, dans une fenêtre de
  // 10 min (au-delà : génération perdue, on ne polle pas indéfiniment).
  const pending =
    requested !== null &&
    (updated === null || requested > updated) &&
    Date.now() - requested < 10 * 60 * 1000;

  return NextResponse.json(
    { version: data.living_brief_version ?? 0, pending },
    { headers: { "cache-control": "no-store" } },
  );
}
