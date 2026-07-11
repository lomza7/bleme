import "server-only";
import type { Capability } from "@/lib/permissions/capabilities";
import { verifyApiKey } from "@/lib/api/keys";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { ApiError } from "@/lib/api/response";

/*
 * Authentification de l'API publique par clé Bearer. La clé porte ses propres
 * scopes (sous-ensemble figé à la création) : c'est la clé qui décide, jamais
 * le rôle courant de son créateur. Header-only — une clé passée en query string
 * est refusée (elle finirait dans les logs/référents).
 */

export type ApiContext = { keyId: string; orgId: string; scopes: Set<string> };

export async function authenticate(req: Request): Promise<ApiContext> {
  const header = (req.headers.get("authorization") ?? "").trim();
  const m = /^Bearer\s+(\S+)$/i.exec(header);
  if (!m) throw new ApiError("unauthorized", 401, "Clé API manquante (en-tête Authorization: Bearer).");
  const key = await verifyApiKey(m[1]);
  if (!key) throw new ApiError("unauthorized", 401, "Clé API invalide, expirée ou révoquée.");
  return { keyId: key.keyId, orgId: key.orgId, scopes: new Set(key.scopes) };
}

export function requireScope(ctx: ApiContext, cap: Capability): void {
  if (!ctx.scopes.has(cap)) {
    throw new ApiError("forbidden", 403, `Cette clé n'a pas le droit « ${cap} ».`);
  }
}

/** Auth + rate-limit + scope, dans cet ordre. Renvoie le contexte scopé à l'org. */
export async function authorize(req: Request, cap: Capability): Promise<ApiContext> {
  const ctx = await authenticate(req);
  await enforceRateLimit(ctx.keyId);
  requireScope(ctx, cap);
  return ctx;
}
