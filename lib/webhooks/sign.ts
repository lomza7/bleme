import "server-only";
import { createHmac, randomBytes } from "node:crypto";

/*
 * Signature façon Stripe/Svix (que BLEME vérifie déjà en entrant) : HMAC-SHA256
 * sur `${t}.${rawBody}`, en-tête `X-Bleme-Signature: t=<unix>,v1=<hex>`. Le
 * consommateur recompose et compare en temps constant, et rejette si |now-t| >
 * 300 s (fenêtre anti-rejeu).
 */

export function newSigningSecret(): string {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

export function signBody(secret: string, timestampSec: number, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestampSec}.${rawBody}`).digest("hex");
}

export function signatureHeader(secret: string, rawBody: string, nowMs: number): string {
  const t = Math.floor(nowMs / 1000);
  return `t=${t},v1=${signBody(secret, t, rawBody)}`;
}
