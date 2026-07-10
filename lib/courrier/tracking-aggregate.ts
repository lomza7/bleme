import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stageRank } from "@/lib/courrier/tracking";

/*
 * Statut agrégé d'un courrier (letters.tracking_status) : recalculé depuis
 * TOUS les événements de suivi plutôt que par comparaison au statut lu (un
 * read-then-write sous webhooks concurrents peut régresser — deux événements
 * simultanés lisent le même état périmé, le dernier écrit gagne). Ici, le
 * dernier écrivain voit au moins son propre événement + ceux déjà commités :
 * l'agrégat converge vers le rang maximal quel que soit l'ordre d'arrivée.
 */
export async function recomputeLetterTrackingStatus(
  sb: SupabaseClient,
  letterId: string,
): Promise<void> {
  const { data: rows } = await sb
    .from("letter_tracking_events")
    .select("stage, occurred_at")
    .eq("letter_id", letterId);
  let best: { stage: string; occurred_at: string } | null = null;
  for (const r of rows ?? []) {
    if (stageRank(r.stage) === 0) continue; // deposit_proof : document, pas un jalon
    if (!best || stageRank(r.stage) > stageRank(best.stage)) best = r;
  }
  if (!best) return;
  await sb
    .from("letters")
    .update({ tracking_status: best.stage, tracking_status_at: best.occurred_at })
    .eq("id", letterId);
}
