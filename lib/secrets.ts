import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";

/*
 * Coffre des clés d'API (table app_secrets, service-role uniquement).
 *
 * - getSecret(name) : résolution base d'abord, variable d'ENV en repli —
 *   une clé posée dans la console prend effet à l'appel suivant.
 * - Verrou du coffre : l'écran /admin/cles exige un mot de passe dédié
 *   (hash scrypt stocké sous VAULT_PASSWORD_HASH), qui ouvre une session
 *   de 15 minutes via cookie httpOnly signé (HMAC dérivé du hash : changer
 *   le mot de passe invalide les sessions en cours).
 */

const VAULT_HASH_NAME = "VAULT_PASSWORD_HASH";
const VAULT_COOKIE = "bleme_vault";
const VAULT_TTL_MS = 15 * 60 * 1000;

// ── Lecture des clés (utilisée par le code produit) ──────────────────────────

export async function getSecret(name: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("app_secrets")
    .select("value")
    .eq("name", name)
    .maybeSingle();
  if (data?.value) return data.value;
  // Repli ENV : lecture centralisée ici, le module secrets est le point d'accès sanctionné.
  return process.env[name] ?? null;
}

// ── Hachage du mot de passe du coffre ────────────────────────────────────────

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function getVaultHash(): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("app_secrets")
    .select("value")
    .eq("name", VAULT_HASH_NAME)
    .maybeSingle();
  return data?.value ?? null;
}

export async function setupVaultPassword(password: string, userId: string): Promise<boolean> {
  const existing = await getVaultHash();
  if (existing) return false;
  const supabase = createServiceClient();
  const { error } = await supabase.from("app_secrets").insert({
    name: VAULT_HASH_NAME,
    value: hashPassword(password),
    updated_by: userId,
  });
  return !error;
}

export async function checkVaultPassword(password: string): Promise<boolean> {
  const stored = await getVaultHash();
  return stored ? verifyPassword(password, stored) : false;
}

// ── Session de déverrouillage (cookie signé) ─────────────────────────────────

function sign(expires: number, vaultHash: string): string {
  return createHmac("sha256", vaultHash).update(String(expires)).digest("hex");
}

export async function openVaultSession(): Promise<void> {
  const vaultHash = await getVaultHash();
  if (!vaultHash) return;
  const expires = Date.now() + VAULT_TTL_MS;
  const store = await cookies();
  store.set(VAULT_COOKIE, `${expires}.${sign(expires, vaultHash)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: Math.floor(VAULT_TTL_MS / 1000),
  });
}

export async function closeVaultSession(): Promise<void> {
  const store = await cookies();
  store.delete(VAULT_COOKIE);
}

export async function isVaultUnlocked(): Promise<boolean> {
  const vaultHash = await getVaultHash();
  if (!vaultHash) return false;
  const store = await cookies();
  const raw = store.get(VAULT_COOKIE)?.value;
  if (!raw) return false;
  const [expiresStr, mac] = raw.split(".");
  const expires = Number(expiresStr);
  if (!expires || !mac || expires < Date.now()) return false;
  const expected = sign(expires, vaultHash);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export { VAULT_HASH_NAME };
