import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

/*
 * Clés API par organisation. Le secret n'est JAMAIS stocké : on ne garde que
 * son hash sha256 peppered (non réversible), EXACTEMENT comme hashIp() dans
 * lib/transcription/rate-limit.ts — pepper = clé service-role (server-only,
 * haute entropie), déterministe, sans indirection coffre ni cache (donc pas de
 * hachage divergent entre instances). Le secret en clair n'est montré qu'une
 * seule fois, à la création.
 *
 * Format : blm_live_<43 caractères base64url>. key_prefix = les 8 premiers
 * caractères du corps, préfixés, pour l'affichage masqué.
 */

const LIVE = "blm_live_";
const PREFIX_LEN = 8; // caractères du corps repris dans key_prefix

function hashKey(secret: string): string {
  const pepper = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  return createHash("sha256").update(`${pepper}:${secret}`).digest("hex");
}

function prefixOf(secret: string): string {
  // blm_live_ + 8 premiers caractères du corps.
  return LIVE + secret.slice(LIVE.length, LIVE.length + PREFIX_LEN);
}

export type MintedKey = { id: string; secret: string; prefix: string };

/** Génère une clé, l'insère (service-role) et renvoie le secret en clair UNE fois. */
export async function mintApiKey(
  orgId: string,
  name: string,
  scopes: string[],
  userId: string | null,
): Promise<MintedKey | null> {
  const secret = LIVE + randomBytes(32).toString("base64url");
  const prefix = prefixOf(secret);
  const sb = createServiceClient();
  const { data: key, error } = await sb
    .from("api_keys")
    .insert({ organization_id: orgId, name, key_prefix: prefix, scopes, created_by: userId })
    .select("id")
    .single();
  if (error || !key) return null;
  const { error: secErr } = await sb
    .from("api_key_secrets")
    .insert({ api_key_id: key.id, key_hash: hashKey(secret) });
  if (secErr) {
    // Ne jamais laisser une clé sans hash (donc invérifiable) : on nettoie.
    await sb.from("api_keys").delete().eq("id", key.id);
    return null;
  }
  return { id: key.id, secret, prefix };
}

export type VerifiedKey = { keyId: string; orgId: string; scopes: string[] };

/**
 * Vérifie une clé présentée. Lookup O(1) par hash peppered indexé : un
 * attaquant sans le pepper ne peut pas forger un hash, donc l'égalité indexée
 * ne fuite rien. Fail-closed : toute erreur, clé inconnue, révoquée ou expirée
 * renvoie null (401 générique côté auth).
 */
export async function verifyApiKey(presented: string): Promise<VerifiedKey | null> {
  if (!presented.startsWith(LIVE) || presented.length < LIVE.length + PREFIX_LEN) return null;
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("api_key_secrets")
    .select("api_key_id, api_keys!inner(id, organization_id, scopes, revoked_at, expires_at, last_used_at)")
    .eq("key_hash", hashKey(presented))
    .maybeSingle();
  if (error || !data) return null;
  const k = data.api_keys as unknown as {
    id: string;
    organization_id: string;
    scopes: string[] | null;
    revoked_at: string | null;
    expires_at: string | null;
    last_used_at: string | null;
  } | null;
  if (!k || k.revoked_at) return null;
  if (k.expires_at && new Date(k.expires_at).getTime() <= Date.now()) return null;

  // last_used_at throttlé (≤ 1×/60 s) pour éviter une écriture par requête.
  if (!k.last_used_at || Date.now() - new Date(k.last_used_at).getTime() > 60_000) {
    await sb.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", k.id);
  }
  return { keyId: k.id, orgId: k.organization_id, scopes: k.scopes ?? [] };
}

/**
 * Révoque une clé (conservée pour l'audit), scopée à l'org. Renvoie true
 * SEULEMENT si une ligne a réellement été mise à jour : un UPDATE à 0 ligne
 * (mauvaise org, déjà révoquée) ne remonte pas d'erreur avec supabase-js, donc
 * on vérifie le nombre de lignes touchées — sinon on confirmerait à tort la
 * révocation d'une clé qui reste active (contrôle de sécurité silencieusement
 * inopérant).
 */
export async function revokeApiKey(orgId: string, keyId: string): Promise<boolean> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString(), revoked_reason: "user_revoked" })
    .eq("id", keyId)
    .eq("organization_id", orgId)
    .is("revoked_at", null)
    .select("id");
  return !error && (data?.length ?? 0) > 0;
}
