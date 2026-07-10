import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Dernier envoi réel par dossier (pour l'indicateur de suivi sur les cartes :
 * l'utilisateur voit où en est sa relance avant même d'ouvrir le dossier).
 */

export type LastSend = {
  case_id: string;
  kind: string;
  channel: string | null;
  sent_at: string | null;
  tracking_status: string | null;
  tracking_status_at: string | null;
};

export async function lastSendByCase(
  supabase: SupabaseClient,
  caseIds: string[],
): Promise<Record<string, LastSend>> {
  if (caseIds.length === 0) return {};
  const { data } = await supabase
    .from("letters")
    .select("case_id, kind, channel, sent_at, tracking_status, tracking_status_at")
    .in("case_id", caseIds)
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false });
  const map: Record<string, LastSend> = {};
  for (const l of (data as LastSend[]) ?? []) {
    if (!map[l.case_id]) map[l.case_id] = l;
  }
  return map;
}
