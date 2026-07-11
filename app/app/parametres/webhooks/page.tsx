import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { accessCan, getMyAccess } from "@/lib/permissions/server";
import { hasActivePro } from "@/lib/billing/pricing";
import { PageHeader } from "@/components/app/ui";
import { ProUpsell } from "@/components/app/pro-upsell";
import { WebhooksManager, type DeliveryRow, type WebhookEndpointRow } from "@/components/app/webhooks";

export const metadata: Metadata = { title: "Webhooks" };

export default async function WebhooksPage() {
  const access = await getMyAccess();
  if (!access?.organizationId || !accessCan(access, "api.manage")) redirect("/app/parametres");

  const supabase = await createClient();
  const [{ data: endpoints }, { data: deliveries }, { data: org }] = await Promise.all([
    supabase
      .from("webhook_endpoints")
      .select("id, url, description, enabled_events, status, failure_count, last_delivery_at, disabled_at, created_at")
      .eq("organization_id", access.organizationId)
      .order("created_at", { ascending: false })
      .returns<WebhookEndpointRow[]>(),
    supabase
      .from("webhook_deliveries")
      .select("id, endpoint_id, event_type, status, response_code, attempts, created_at, delivered_at")
      .eq("organization_id", access.organizationId)
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<DeliveryRow[]>(),
    supabase
      .from("organizations")
      .select("billing_plan, billing_status, subscription_current_period_end")
      .eq("id", access.organizationId)
      .maybeSingle(),
  ]);
  const isPro = !!org && hasActivePro(org);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/app/parametres"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Paramètres
      </Link>
      <PageHeader
        title="Webhooks"
        sub="BLEME notifie vos outils en temps réel (paiement détecté, réponse reçue, dossier résolu…). Chaque envoi est signé — vérifiez la signature avant de faire confiance au contenu."
      />
      {!isPro ? <ProUpsell feature="Les webhooks" /> : null}
      <WebhooksManager endpoints={endpoints ?? []} deliveries={deliveries ?? []} />
    </div>
  );
}
