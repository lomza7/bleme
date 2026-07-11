import "server-only";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

/*
 * Garde anti-SSRF pour les URL de webhook fournies par l'utilisateur. BLEME
 * émettra des requêtes vers ces URL : on interdit https non conforme et toute
 * cible interne. On résout une seule fois, on valide TOUTES les adresses, et
 * l'envoi épingle l'IP validée (lib/webhooks/deliver.ts) pour fermer la fenêtre
 * de DNS-rebinding.
 */

function stripBrackets(host: string): string {
  return host.replace(/^\[/, "").replace(/\]$/, ""); // hostname IPv6 vient entre crochets
}

export function isBlockedIp(ip: string): boolean {
  const fam = isIP(ip);
  if (fam === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + métadonnées cloud
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (fam === 6) {
    const ip6 = ip.toLowerCase();
    if (ip6 === "::1" || ip6 === "::") return true;
    if (ip6.startsWith("::ffff:")) return isBlockedIp(ip6.slice("::ffff:".length)); // IPv4-mapped
    const first = parseInt(ip6.split(":")[0] || "0", 16);
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if (first >= 0xfc00 && first <= 0xfdff) return true; // fc00::/7 ULA
    return false;
  }
  return true; // pas une IP reconnue → refus par prudence
}

export type SsrfResult =
  | { ok: true; host: string; addresses: string[] }
  | { ok: false; reason: "invalid" | "blocked" | "resolve_error"; message: string };

/** Résout et valide une URL de webhook, renvoyant les IP validées à épingler. */
export async function resolveWebhookUrl(raw: string): Promise<SsrfResult> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid", message: "URL invalide." };
  }
  if (u.protocol !== "https:") return { ok: false, reason: "invalid", message: "Seules les URL en https sont acceptées." };
  if (u.username || u.password) return { ok: false, reason: "invalid", message: "Les identifiants dans l'URL sont interdits." };

  const host = stripBrackets(u.hostname);
  // Littéral IP : pas de résolution, contrôle direct.
  if (isIP(host)) {
    if (isBlockedIp(host)) return { ok: false, reason: "blocked", message: "Cette URL pointe vers une adresse interne (interdit)." };
    return { ok: true, host, addresses: [host] };
  }

  let results: { address: string }[];
  try {
    results = await lookup(host, { all: true });
  } catch {
    return { ok: false, reason: "resolve_error", message: "Résolution DNS impossible." };
  }
  if (!results || results.length === 0) return { ok: false, reason: "resolve_error", message: "Hôte non résolu." };
  for (const r of results) {
    if (isBlockedIp(r.address)) return { ok: false, reason: "blocked", message: "Cette URL pointe vers une adresse interne (interdit)." };
  }
  return { ok: true, host, addresses: results.map((r) => r.address) };
}

/** Validation à la création (levante, message explicite). */
export async function assertPublicHttpsUrl(raw: string): Promise<void> {
  const res = await resolveWebhookUrl(raw);
  if (!res.ok) throw new Error(res.message);
}
