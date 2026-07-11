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

/**
 * Lit et parse un corps JSON avec un plafond de taille DUR — vrai garde-fou
 * anti-OOM : on rejette tôt sur Content-Length s'il est présent, PUIS on lit le
 * corps en flux en cumulant les octets et en abandonnant dès dépassement (le
 * Content-Length pouvant être absent en chunked ou mensonger). On ne matérialise
 * jamais plus de maxBytes en mémoire. maxBytes selon l'endpoint.
 */
export async function readJsonBody(req: Request, maxBytes: number): Promise<unknown> {
  const cl = req.headers.get("content-length");
  if (cl && Number(cl) > maxBytes) {
    throw new ApiError("payload_too_large", 413, "Corps de requête trop volumineux.");
  }
  const reader = req.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ApiError("payload_too_large", 413, "Corps de requête trop volumineux.");
    }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw new ApiError("invalid_request", 422, "Corps JSON invalide.");
  }
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
