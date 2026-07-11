import "server-only";
import { request } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { createServiceClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/integrations/crypto";
import { notifyOrganization } from "@/lib/notifications/notify";
import { signatureHeader } from "@/lib/webhooks/sign";
import { resolveWebhookUrl } from "@/lib/webhooks/ssrf";

/*
 * Worker de livraison des webhooks. Réclame une livraison (pending/failed →
 * delivering) de façon atomique + horodatée (reprise des livraisons bloquées),
 * re-valide l'URL, ÉPINGLE l'IP validée pour l'envoi (ferme la fenêtre de
 * DNS-rebinding), signe et POST avec timeout + sans suivre de redirection.
 * Succès → succeeded ; échec transitoire → backoff jusqu'à 'dead' + compteur
 * d'échecs ATOMIQUE et auto-désactivation idempotente.
 */

type ServiceClient = ReturnType<typeof createServiceClient>;

const TIMEOUT_MS = 10_000;
const BACKOFF_SEC = [60, 300, 1800, 7200, 21600, 86400]; // 1m,5m,30m,2h,6h,24h
const DISABLE_AFTER = 15; // échecs consécutifs
const STALE_MS = 15 * 60 * 1000; // livraison coincée en 'delivering' → récupérée
const CONCURRENCY = 8;

type Claimed = {
  id: string;
  endpoint_id: string;
  organization_id: string;
  event_type: string;
  payload: unknown;
  attempts: number;
  created_at: string;
};

/** POST signé, connexion ÉPINGLÉE sur l'IP validée (SNI/cert = hostname). Ne suit
 *  aucune redirection, draine le corps, borne par timeout. Renvoie le code HTTP
 *  (0 = échec réseau/timeout). */
function postWebhook(urlStr: string, pinnedIp: string, headers: Record<string, string>, body: string): Promise<number> {
  return new Promise((resolve) => {
    let u: URL;
    try {
      u = new URL(urlStr);
    } catch {
      resolve(0);
      return;
    }
    const host = u.hostname.replace(/^\[/, "").replace(/\]$/, "");
    const family = isIP(pinnedIp) || 4;
    // Épingle l'IP validée. Gère les deux formes de callback : Node >= 20
    // (autoSelectFamily) appelle lookup avec { all:true } et exige un tableau ;
    // les versions/chemins sans all attendent la forme (address, family).
    const pinnedLookup: LookupFunction = (_hostname, opts, cb) => {
      if (opts && (opts as { all?: boolean }).all) {
        (cb as unknown as (e: Error | null, a: { address: string; family: number }[]) => void)(null, [
          { address: pinnedIp, family },
        ]);
      } else {
        cb(null, pinnedIp, family);
      }
    };
    const req = request(
      {
        protocol: "https:",
        hostname: host,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method: "POST",
        servername: host, // SNI + validation du certificat sur le hostname
        lookup: pinnedLookup,
        headers: { ...headers, "content-length": String(Buffer.byteLength(body)) },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const code = res.statusCode ?? 0;
        res.resume(); // draine et jette le corps (pas de fuite mémoire/socket)
        res.on("end", () => resolve(code));
        res.on("error", () => resolve(code));
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve(0);
    });
    req.on("error", () => resolve(0));
    req.write(body);
    req.end();
  });
}

async function deadDelivery(sb: ServiceClient, id: string, error: string): Promise<void> {
  await sb.from("webhook_deliveries").update({ status: "dead", error }).eq("id", id);
}

async function notifyDisabled(sb: ServiceClient, orgId: string, reason: string): Promise<void> {
  await notifyOrganization(sb, {
    organizationId: orgId,
    kind: "alert",
    title: "Webhook désactivé",
    body: `Un endpoint webhook a été désactivé (${reason}). Vérifiez son URL puis réactivez-le.`,
    href: "/app/parametres/webhooks",
    email: true,
  });
}

/** Désactivation immédiate (URL devenue interne) — notification une seule fois. */
async function disableNow(sb: ServiceClient, endpointId: string, orgId: string, reason: string): Promise<void> {
  const { data } = await sb
    .from("webhook_endpoints")
    .update({ status: "disabled", disabled_at: new Date().toISOString() })
    .eq("id", endpointId)
    .eq("status", "active")
    .select("id");
  if (data && data.length > 0) await notifyDisabled(sb, orgId, reason);
}

/** Échec RETRYABLE : backoff sur la livraison + incrément ATOMIQUE du compteur
 *  d'échecs de l'endpoint (auto-désactivation idempotente au seuil). */
async function markFailure(sb: ServiceClient, d: Claimed, error: string, code = 0): Promise<void> {
  const attempts = d.attempts + 1;
  const dead = attempts > BACKOFF_SEC.length;
  const nextRetry = dead ? null : new Date(Date.now() + BACKOFF_SEC[attempts - 1] * 1000).toISOString();
  await sb
    .from("webhook_deliveries")
    .update({ status: dead ? "dead" : "failed", response_code: code || null, attempts, next_retry_at: nextRetry, error })
    .eq("id", d.id);

  const { data } = await sb
    .rpc("webhook_endpoint_register_failure", { p_endpoint: d.endpoint_id, p_threshold: DISABLE_AFTER })
    .single();
  if ((data as { just_disabled: boolean } | null)?.just_disabled) {
    await notifyDisabled(sb, d.organization_id, "trop d'échecs consécutifs");
  }
}

async function deliverOne(sb: ServiceClient, deliveryId: string): Promise<void> {
  // Réclamation atomique + horodatée (reprise possible si le process meurt après).
  const { data: claimed } = await sb
    .from("webhook_deliveries")
    .update({ status: "delivering", claimed_at: new Date().toISOString() })
    .eq("id", deliveryId)
    .in("status", ["pending", "failed"])
    .select("id, endpoint_id, organization_id, event_type, payload, attempts, created_at");
  if (!claimed || claimed.length === 0) return;
  const d = claimed[0] as unknown as Claimed;

  const { data: epRow } = await sb
    .from("webhook_endpoints")
    .select("url, status")
    .eq("id", d.endpoint_id)
    .maybeSingle();
  const endpoint = epRow as unknown as { url: string; status: string } | null;
  if (!endpoint || endpoint.status !== "active") {
    await deadDelivery(sb, d.id, "endpoint inactif");
    return;
  }

  const { data: secRow } = await sb
    .from("webhook_endpoint_secrets")
    .select("secret_encrypted")
    .eq("endpoint_id", d.endpoint_id)
    .maybeSingle();
  const secretRow = secRow as unknown as { secret_encrypted: string } | null;
  if (!secretRow) {
    await deadDelivery(sb, d.id, "secret manquant");
    return;
  }

  // Résolution + validation, une seule fois ; l'IP validée sera épinglée.
  const ssrf = await resolveWebhookUrl(endpoint.url);
  if (!ssrf.ok) {
    if (ssrf.reason === "blocked") {
      await deadDelivery(sb, d.id, "URL interne refusée");
      await disableNow(sb, d.endpoint_id, d.organization_id, "URL non conforme");
    } else if (ssrf.reason === "invalid") {
      await deadDelivery(sb, d.id, "URL non conforme");
    } else {
      await markFailure(sb, d, "résolution DNS impossible"); // transitoire → retry
    }
    return;
  }

  let secret: string;
  try {
    secret = await decryptToken(secretRow.secret_encrypted);
  } catch {
    await deadDelivery(sb, d.id, "secret indéchiffrable"); // config, non retryable, pas d'auto-disable
    return;
  }

  const envelope = JSON.stringify({
    id: d.id,
    type: d.event_type,
    occurred_at: d.created_at,
    organization_id: d.organization_id,
    data: d.payload,
  });
  const code = await postWebhook(
    endpoint.url,
    ssrf.addresses[0],
    {
      "content-type": "application/json",
      "X-Bleme-Event": d.event_type,
      "X-Bleme-Id": d.id,
      "X-Bleme-Signature": signatureHeader(secret, envelope, Date.now()),
    },
    envelope,
  );

  if (code >= 200 && code < 300) {
    await sb
      .from("webhook_deliveries")
      .update({ status: "succeeded", response_code: code, attempts: d.attempts + 1, delivered_at: new Date().toISOString(), error: null })
      .eq("id", d.id);
    await sb
      .from("webhook_endpoints")
      .update({ failure_count: 0, last_delivery_at: new Date().toISOString() })
      .eq("id", d.endpoint_id);
  } else {
    await markFailure(sb, d, code ? `HTTP ${code}` : "échec réseau/timeout", code);
  }
}

async function runBounded(sb: ServiceClient, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    await Promise.allSettled(ids.slice(i, i + CONCURRENCY).map((id) => deliverOne(sb, id)));
  }
}

/** Livre immédiatement un lot (1ʳᵉ tentative, via after()). */
export async function drainNow(deliveryIds: string[]): Promise<void> {
  if (deliveryIds.length === 0) return;
  await runBounded(createServiceClient(), deliveryIds);
}

const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 j de journal, puis purge

/** Cron : purge le vieux journal, récupère les livraisons bloquées, rejoue les dues. */
export async function drainDue(limit = 100): Promise<number> {
  const sb = createServiceClient();
  // Purge bornée du journal terminal (croissance non bornée sinon).
  const { data: old } = await sb
    .from("webhook_deliveries")
    .select("id")
    .in("status", ["succeeded", "dead"])
    .lt("created_at", new Date(Date.now() - PURGE_AFTER_MS).toISOString())
    .limit(500);
  const oldIds = ((old ?? []) as unknown as { id: string }[]).map((r) => r.id);
  if (oldIds.length > 0) await sb.from("webhook_deliveries").delete().in("id", oldIds);

  // Récupère les livraisons coincées en 'delivering' (process mort après claim).
  await sb
    .from("webhook_deliveries")
    .update({ status: "failed", next_retry_at: new Date().toISOString() })
    .eq("status", "delivering")
    .lt("claimed_at", new Date(Date.now() - STALE_MS).toISOString());

  const nowIso = new Date().toISOString();
  const { data } = await sb
    .from("webhook_deliveries")
    .select("id")
    .in("status", ["pending", "failed"])
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(limit);
  const ids = ((data ?? []) as unknown as { id: string }[]).map((r) => r.id);
  await runBounded(sb, ids);
  return ids.length;
}
