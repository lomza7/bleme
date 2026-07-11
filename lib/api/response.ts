import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

/*
 * Enveloppe de réponse commune à l'API publique (/api/v1). Premier helper
 * partagé du repo : les webhooks internes forgent chacun leur NextResponse,
 * mais l'API externe doit présenter un contrat stable et une gestion d'erreur
 * uniforme.
 *
 * Erreur : { "error": { "code": "...", "message": "...", "details"?: ... } }
 * Codes : unauthorized 401, forbidden 403, not_found 404, invalid_request 422,
 *         rate_limited 429, internal 500.
 */

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    message?: string,
    public headers?: Record<string, string>,
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}

export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function fail(code: string, status: number, message?: string, details?: unknown): NextResponse {
  return NextResponse.json({ error: { code, message, ...(details !== undefined ? { details } : {}) } }, { status });
}

/**
 * Exécute le corps d'un handler de route : attribue un X-Request-Id, traduit
 * ApiError et ZodError en réponses normalisées, et n'expose jamais un détail
 * interne sur une 500. On garde la signature de route NATIVE de Next
 * (export async function GET(req, { params })) et on enveloppe l'intérieur :
 *   export async function GET(req) { return runApi(async () => { ... }); }
 */
export async function runApi(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  const requestId = randomUUID();
  let res: NextResponse;
  try {
    res = await handler();
  } catch (e) {
    if (e instanceof ApiError) {
      res = fail(e.code, e.status, e.message);
      if (e.headers) for (const [k, v] of Object.entries(e.headers)) res.headers.set(k, v);
    } else if (e instanceof ZodError) {
      res = fail("invalid_request", 422, "Requête invalide.", e.issues);
    } else {
      console.error(`[api] ${requestId}`, e);
      res = fail("internal", 500, "Erreur interne.");
    }
  }
  res.headers.set("X-Request-Id", requestId);
  return res;
}
