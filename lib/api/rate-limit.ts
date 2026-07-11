import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/response";

/*
 * Rate-limit durable par clé (fenêtre fixe d'une minute), même esprit que la
 * transcription anonyme : compteur en base, incrément ATOMIQUE via la fonction
 * SQL api_key_bump (pas de course), fail-open sur incident DB — on ne casse
 * pas une intégration qui paie pour un hoquet interne ; le garde-fou dur reste
 * l'auth (fail-closed) + le cap de taille du body.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120; // requêtes / minute / clé

export async function enforceRateLimit(apiKeyId: string): Promise<void> {
  let count: number;
  try {
    const sb = createServiceClient();
    const windowStart = new Date(Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS).toISOString();
    const { data, error } = await sb.rpc("api_key_bump", { p_key: apiKeyId, p_window: windowStart });
    if (error) return; // fail-open
    count = typeof data === "number" ? data : Number(data);
  } catch {
    return; // fail-open
  }
  if (count > MAX_PER_WINDOW) {
    const retry = Math.ceil((WINDOW_MS - (Date.now() % WINDOW_MS)) / 1000);
    throw new ApiError("rate_limited", 429, "Trop de requêtes, réessayez dans un instant.", {
      "Retry-After": String(retry),
    });
  }
}
