"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  VAULT_HASH_NAME,
  checkVaultPassword,
  closeVaultSession,
  getSecret,
  getVaultHash,
  isVaultUnlocked,
  openVaultSession,
  setupVaultPassword,
} from "@/lib/secrets";

/* Actions du coffre de clés : triple garde (admin + RLS service-only +
 * session de coffre déverrouillée pour toute lecture/écriture de clé). */

export type VaultState = { error?: string; success?: string };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  return data?.is_admin ? user : null;
}

const passwordSchema = z
  .string()
  .min(10, "10 caractères minimum pour le mot de passe du coffre.");

export async function createVaultPassword(
  _prev: VaultState,
  formData: FormData,
): Promise<VaultState> {
  const user = await requireAdmin();
  if (!user) return { error: "Accès réservé aux administrateurs." };

  const password = passwordSchema.safeParse(formData.get("password"));
  if (!password.success) return { error: password.error.issues[0].message };
  if (password.data !== String(formData.get("confirm"))) {
    return { error: "Les deux saisies ne correspondent pas." };
  }

  const ok = await setupVaultPassword(password.data, user.id);
  if (!ok) return { error: "Le coffre a déjà un mot de passe." };
  await openVaultSession();
  revalidatePath("/admin/cles");
  return { success: "Coffre créé et déverrouillé." };
}

export async function unlockVault(
  _prev: VaultState,
  formData: FormData,
): Promise<VaultState> {
  const user = await requireAdmin();
  if (!user) return { error: "Accès réservé aux administrateurs." };

  const ok = await checkVaultPassword(String(formData.get("password") ?? ""));
  if (!ok) return { error: "Mot de passe du coffre incorrect." };
  await openVaultSession();
  revalidatePath("/admin/cles");
  return { success: "Coffre déverrouillé pour 15 minutes." };
}

export async function lockVault(): Promise<void> {
  await closeVaultSession();
  revalidatePath("/admin/cles");
}

async function requireUnlockedAdmin() {
  const user = await requireAdmin();
  if (!user) return null;
  if (!(await isVaultUnlocked())) return null;
  return user;
}

const keySchema = z.object({
  name: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{2,63}$/, "Nom au format MAJUSCULES_ET_UNDERSCORES."),
  value: z.string().trim().min(4, "Valeur trop courte.").max(4096),
});

export async function setApiKey(
  _prev: VaultState,
  formData: FormData,
): Promise<VaultState> {
  const user = await requireUnlockedAdmin();
  if (!user) return { error: "Coffre verrouillé : déverrouillez-le d’abord." };

  const parsed = keySchema.safeParse({
    name: formData.get("name"),
    value: formData.get("value"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.name === VAULT_HASH_NAME) {
    return { error: "Ce nom est réservé au verrou du coffre." };
  }

  const service = createServiceClient();
  const { error } = await service.from("app_secrets").upsert({
    name: parsed.data.name,
    value: parsed.data.value,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Échec de l’enregistrement." };

  revalidatePath("/admin/cles");
  return { success: `${parsed.data.name} enregistrée : effective immédiatement.` };
}

export async function deleteApiKey(formData: FormData): Promise<void> {
  const user = await requireUnlockedAdmin();
  if (!user) return;
  const name = String(formData.get("name") ?? "");
  if (!name || name === VAULT_HASH_NAME) return;
  const service = createServiceClient();
  await service.from("app_secrets").delete().eq("name", name);
  revalidatePath("/admin/cles");
}

export async function testAnthropicKey(): Promise<VaultState> {
  const user = await requireUnlockedAdmin();
  if (!user) return { error: "Coffre verrouillé : déverrouillez-le d’abord." };

  const key = await getSecret("ANTHROPIC_API_KEY");
  if (!key || key === "local-placeholder") {
    return { error: "Aucune clé Anthropic réelle configurée (console ou ENV)." };
  }
  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    });
    if (res.ok) return { success: "Clé Anthropic valide : l’API répond." };
    if (res.status === 401) return { error: "Clé Anthropic refusée (401)." };
    return { error: `Réponse inattendue de l’API (${res.status}).` };
  } catch {
    return { error: "Impossible de joindre l’API Anthropic." };
  }
}

export async function testMerciFacteur(): Promise<VaultState> {
  const user = await requireUnlockedAdmin();
  if (!user) return { error: "Coffre verrouillé : déverrouillez-le d’abord." };
  const { getMerciFacteurToken } = await import("@/lib/courrier/merci-facteur");
  const result = await getMerciFacteurToken();
  if ("error" in result) return { error: result.error };
  return { success: "Identifiants Merci Facteur valides : access token obtenu (24 h)." };
}

/** Statut d'affichage : configurée en base, en ENV, ou absente (jamais la valeur en clair). */
export async function getKeysStatus() {
  const user = await requireAdmin();
  if (!user) return { unlocked: false, hasVault: false, keys: [] as KeyStatus[] };

  const [unlocked, vaultHash] = await Promise.all([isVaultUnlocked(), getVaultHash()]);
  if (!unlocked) return { unlocked: false, hasVault: Boolean(vaultHash), keys: [] as KeyStatus[] };

  const service = createServiceClient();
  const { data } = await service
    .from("app_secrets")
    .select("name, value, updated_at")
    .neq("name", VAULT_HASH_NAME)
    .order("name");

  const fromDb: KeyStatus[] = (data ?? []).map((k) => ({
    name: k.name,
    source: "console" as const,
    masked: mask(k.value),
    updatedAt: k.updated_at,
  }));
  const dbNames = new Set(fromDb.map((k) => k.name));

  for (const name of ENV_WATCHLIST) {
    const envValue = process.env[name];
    if (!dbNames.has(name) && envValue) {
      fromDb.push({ name, source: "env", masked: mask(envValue), updatedAt: null });
    }
  }
  return { unlocked: true, hasVault: true, keys: fromDb.sort((a, b) => a.name.localeCompare(b.name)) };
}

export type KeyStatus = {
  name: string;
  source: "console" | "env";
  masked: string;
  updatedAt: string | null;
};

const ENV_WATCHLIST = [
  "ANTHROPIC_API_KEY",
  "GROQ_API_KEY",
  "RESEND_API_KEY",
  "MERCI_FACTEUR_SERVICE_ID",
  "MERCI_FACTEUR_SECRET_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NOUS_API_KEY",
  "PAPERCLIP_URL",
  "BLEME_BRIDGE_URL",
  "BLEME_BRIDGE_TOKEN",
];

function mask(value: string): string {
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
