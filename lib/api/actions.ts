"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { accessCan, getMyAccess } from "@/lib/permissions/server";
import { createClient } from "@/lib/supabase/server";
import { hasActivePro } from "@/lib/billing/pricing";
import { mintApiKey, revokeApiKey } from "@/lib/api/keys";
import { API_SCOPE_CAPS } from "@/lib/api/scopes";

// L'API est une fonctionnalité du forfait Pro (annoncée sur la page tarifs).
async function orgIsPro(orgId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("billing_plan, billing_status, subscription_current_period_end")
    .eq("id", orgId)
    .maybeSingle();
  return !!org && hasActivePro(org);
}

/*
 * Actions d'administration des clés API. Gardées par la capacité 'api.manage'
 * (owner/admin d'office). Les écritures passent par le service-role (dans
 * lib/api/keys) APRÈS cette vérification — jamais depuis une requête non gardée.
 */

export type ApiKeyState = { error?: string; success?: string; secret?: string; prefix?: string };

export async function createApiKeyAction(_prev: ApiKeyState, formData: FormData): Promise<ApiKeyState> {
  const access = await getMyAccess();
  if (!access?.organizationId || !accessCan(access, "api.manage")) {
    return { error: "Vous n'avez pas le droit de gérer les clés API." };
  }
  if (!(await orgIsPro(access.organizationId))) {
    return { error: "L'API est réservée au forfait Pro. Activez Pro pour créer une clé." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 80) return { error: "Donnez un nom à la clé (1 à 80 caractères)." };

  const requested = new Set(formData.getAll("scopes").map(String));
  // Sous-ensemble : scopes assignables ∩ droits du créateur (jamais au-delà).
  // 'letters.send' n'est pas dans API_SCOPE_CAPS → jamais assignable (pilier #1).
  const scopes = API_SCOPE_CAPS.filter((s) => requested.has(s) && accessCan(access, s));
  if (scopes.length === 0) return { error: "Choisissez au moins un droit pour la clé." };

  const minted = await mintApiKey(access.organizationId, name, scopes, access.userId);
  if (!minted) return { error: "Impossible de créer la clé, réessayez." };

  revalidatePath("/app/parametres/api");
  return {
    success: "Clé créée. Copiez-la maintenant : elle ne sera plus jamais affichée.",
    secret: minted.secret,
    prefix: minted.prefix,
  };
}

export async function revokeApiKeyAction(_prev: ApiKeyState, formData: FormData): Promise<ApiKeyState> {
  const access = await getMyAccess();
  if (!access?.organizationId || !accessCan(access, "api.manage")) {
    return { error: "Vous n'avez pas le droit de gérer les clés API." };
  }
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Clé introuvable." };

  const done = await revokeApiKey(access.organizationId, id.data);
  if (!done) return { error: "Révocation impossible." };

  revalidatePath("/app/parametres/api");
  return { success: "Clé révoquée." };
}
