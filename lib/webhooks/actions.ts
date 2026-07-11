"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { accessCan, getMyAccess } from "@/lib/permissions/server";
import { createServiceClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/integrations/crypto";
import { newSigningSecret } from "@/lib/webhooks/sign";
import { assertPublicHttpsUrl } from "@/lib/webhooks/ssrf";
import { WEBHOOK_EVENT_TYPES } from "@/lib/webhooks/events";
import { drainNow } from "@/lib/webhooks/deliver";

/*
 * Administration des endpoints webhook. Gardée par 'api.manage'. Écritures
 * service-role APRÈS vérification, toujours scopées à l'org courante. Le secret
 * de signature est chiffré et montré une seule fois (création / rotation).
 */

export type WebhookState = { error?: string; success?: string; secret?: string };

async function guard() {
  const access = await getMyAccess();
  if (!access?.organizationId || !accessCan(access, "api.manage")) return null;
  return access;
}

export async function createWebhookEndpoint(_prev: WebhookState, formData: FormData): Promise<WebhookState> {
  const access = await guard();
  if (!access?.organizationId) return { error: "Vous n'avez pas le droit de gérer les webhooks." };

  const url = String(formData.get("url") ?? "").trim();
  const events = formData.getAll("events").map(String).filter((e) => WEBHOOK_EVENT_TYPES.includes(e));
  if (events.length === 0) return { error: "Choisissez au moins un événement." };
  try {
    await assertPublicHttpsUrl(url);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "URL refusée." };
  }

  const sb = createServiceClient();
  const { data: ep, error } = await sb
    .from("webhook_endpoints")
    .insert({ organization_id: access.organizationId, url, enabled_events: events, created_by: access.userId })
    .select("id")
    .single();
  if (error || !ep) return { error: "Création impossible, réessayez." };

  const secret = newSigningSecret();
  const { error: secErr } = await sb
    .from("webhook_endpoint_secrets")
    .insert({ endpoint_id: ep.id, secret_encrypted: await encryptToken(secret) });
  if (secErr) {
    await sb.from("webhook_endpoints").delete().eq("id", ep.id);
    return { error: "Création impossible, réessayez." };
  }

  revalidatePath("/app/parametres/webhooks");
  return { success: "Endpoint créé. Copiez le secret maintenant : il ne sera plus affiché.", secret };
}

async function ownedEndpoint(sb: ReturnType<typeof createServiceClient>, orgId: string, id: string): Promise<boolean> {
  const { data } = await sb.from("webhook_endpoints").select("id").eq("id", id).eq("organization_id", orgId).maybeSingle();
  return !!data;
}

export async function rotateWebhookSecret(_prev: WebhookState, formData: FormData): Promise<WebhookState> {
  const access = await guard();
  if (!access?.organizationId) return { error: "Droit insuffisant." };
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Endpoint introuvable." };

  const sb = createServiceClient();
  if (!(await ownedEndpoint(sb, access.organizationId, id.data))) return { error: "Endpoint introuvable." };

  const secret = newSigningSecret();
  const { error } = await sb
    .from("webhook_endpoint_secrets")
    .upsert({ endpoint_id: id.data, secret_encrypted: await encryptToken(secret) }, { onConflict: "endpoint_id" });
  if (error) return { error: "Rotation impossible." };

  revalidatePath("/app/parametres/webhooks");
  return { success: "Nouveau secret généré. Copiez-le maintenant.", secret };
}

export async function setWebhookEnabled(_prev: WebhookState, formData: FormData): Promise<WebhookState> {
  const access = await guard();
  if (!access?.organizationId) return { error: "Droit insuffisant." };
  const id = z.uuid().safeParse(formData.get("id"));
  const enable = String(formData.get("enable") ?? "") === "true";
  if (!id.success) return { error: "Endpoint introuvable." };

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("webhook_endpoints")
    .update(
      enable
        ? { status: "active", failure_count: 0, disabled_at: null }
        : { status: "disabled", disabled_at: new Date().toISOString() },
    )
    .eq("id", id.data)
    .eq("organization_id", access.organizationId)
    .select("id");
  if (error || !data || data.length === 0) return { error: "Action impossible." };

  revalidatePath("/app/parametres/webhooks");
  return { success: enable ? "Endpoint réactivé." : "Endpoint désactivé." };
}

export async function deleteWebhookEndpoint(_prev: WebhookState, formData: FormData): Promise<WebhookState> {
  const access = await guard();
  if (!access?.organizationId) return { error: "Droit insuffisant." };
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Endpoint introuvable." };

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("webhook_endpoints")
    .delete()
    .eq("id", id.data)
    .eq("organization_id", access.organizationId)
    .select("id");
  if (error || !data || data.length === 0) return { error: "Suppression impossible." };

  revalidatePath("/app/parametres/webhooks");
  return { success: "Endpoint supprimé." };
}

export async function sendTestWebhook(_prev: WebhookState, formData: FormData): Promise<WebhookState> {
  const access = await guard();
  if (!access?.organizationId) return { error: "Droit insuffisant." };
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Endpoint introuvable." };

  const sb = createServiceClient();
  if (!(await ownedEndpoint(sb, access.organizationId, id.data))) return { error: "Endpoint introuvable." };

  const { data: del } = await sb
    .from("webhook_deliveries")
    .insert({
      endpoint_id: id.data,
      organization_id: access.organizationId,
      event_type: "ping",
      payload: { message: "Ping de test BLEME", ok: true },
    })
    .select("id")
    .single();
  if (del?.id) {
    const deliveryId = del.id as string;
    try {
      after(() => drainNow([deliveryId]));
    } catch {
      await drainNow([deliveryId]);
    }
  }
  revalidatePath("/app/parametres/webhooks");
  return { success: "Ping envoyé. Vérifiez le journal des livraisons." };
}
