import "server-only";
import { createHash } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

/*
 * Rate-limit de la transcription vocale ANONYME (tunnel pré-signup). On ne
 * stocke jamais l'IP en clair : seulement sha256(pepper + IP), le pepper étant
 * la clé service-role (server-only, haute entropie) — hash non réversible sans
 * elle. Fenêtre glissante par IP.
 */

const WINDOW_MS = 60 * 60 * 1000; // 1 h
const MAX_PER_WINDOW = 8; // transcriptions/heure/IP (usage légitime = 1-3)

export function hashIp(ip: string): string {
  const pepper = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  return createHash("sha256").update(`${pepper}:${ip}`).digest("hex");
}

/**
 * Retourne true si l'IP peut encore transcrire, et enregistre l'usage.
 * En cas d'erreur DB, on AUTORISE (fail-open) : ne jamais bloquer un vrai
 * visiteur à cause d'un incident interne — le cap de taille reste le garde-fou dur.
 */
export async function allowAnonTranscribe(ip: string): Promise<boolean> {
  try {
    const sb = createServiceClient();
    const ipHash = hashIp(ip);
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { count } = await sb
      .from("anon_voice_usage")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_PER_WINDOW) return false;
    await sb.from("anon_voice_usage").insert({ ip_hash: ipHash });
    return true;
  } catch {
    return true;
  }
}
