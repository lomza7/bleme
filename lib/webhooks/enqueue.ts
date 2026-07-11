import "server-only";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { drainNow } from "@/lib/webhooks/deliver";

/*
 * Point d'entrée unique, posé à côté de notifyOrganization aux endroits qui
 * émettent un événement produit. Écrit une livraison durable par endpoint
 * souscrit, puis déclenche une 1ʳᵉ tentative immédiate hors chemin critique
 * (after()). NE THROW JAMAIS — un webhook sortant ne doit jamais casser un
 * envoi de courrier, un webhook entrant ou une détection de paiement.
 */
export async function enqueueWebhook(orgId: string, eventType: string, data: Record<string, unknown>): Promise<void> {
  try {
    const sb = createServiceClient();
    const { data: eps } = await sb
      .from("webhook_endpoints")
      .select("id")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .contains("enabled_events", [eventType]);
    const endpoints = (eps ?? []) as unknown as { id: string }[];
    if (endpoints.length === 0) return;

    const { data: inserted } = await sb
      .from("webhook_deliveries")
      .insert(endpoints.map((e) => ({ endpoint_id: e.id, organization_id: orgId, event_type: eventType, payload: data })))
      .select("id");
    const ids = ((inserted ?? []) as unknown as { id: string }[]).map((r) => r.id);
    if (ids.length === 0) return;

    try {
      after(() => drainNow(ids));
    } catch {
      // Hors contexte de requête (rare) : on livre en ligne plutôt que rien.
      await drainNow(ids);
    }
  } catch {
    // Silencieux : contrat « confort », jamais bloquant.
  }
}
