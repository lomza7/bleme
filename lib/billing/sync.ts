import "server-only";

import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";

function objectId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function secondsToIso(value: number | null | undefined): string | null {
  return value ? new Date(value * 1000).toISOString() : null;
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription): number | null {
  const ends = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number");
  return ends.length ? Math.min(...ends) : null;
}

async function organizationIdForCustomer(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const customerId = objectId(subscription.customer);
  const organizationId =
    subscription.metadata?.organizationId ?? (await organizationIdForCustomer(customerId));
  if (!organizationId) return;

  const status = subscription.status;
  const proActive = ["active", "trialing", "past_due"].includes(status);
  const firstItem = subscription.items.data[0];
  const supabase = createServiceClient();

  await supabase
    .from("organizations")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: firstItem?.price?.id ?? null,
      billing_plan: proActive ? "pro" : "free",
      billing_status: status,
      subscription_current_period_end: secondsToIso(subscriptionPeriodEnd(subscription)),
      subscription_cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      subscription_updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);
}

export async function markCaseCheckoutPaid(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== "paid") return;
  const caseId = session.metadata?.caseId;
  const organizationId = session.metadata?.organizationId ?? session.client_reference_id;
  if (!caseId || !organizationId) return;

  const paymentIntentId = objectId(session.payment_intent);
  const paidAt = new Date().toISOString();
  const amountTotal = session.amount_total ?? Number(session.metadata?.amountCents ?? 0);
  const amountSubtotal = session.amount_subtotal ?? Number(session.metadata?.amountCents ?? 0);
  const currency = (session.currency ?? "eur").toUpperCase();
  const supabase = createServiceClient();

  await supabase
    .from("billing_payments")
    .upsert(
      {
        organization_id: organizationId,
        case_id: caseId,
        kind: "case",
        status: "paid",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        amount_subtotal_cents: amountSubtotal,
        amount_total_cents: amountTotal,
        currency,
        paid_at: paidAt,
      },
      { onConflict: "stripe_checkout_session_id" },
    );

  await supabase
    .from("cases")
    .update({
      billing_status: "paid",
      billing_amount_cents: amountTotal,
      billing_currency: currency,
      billing_paid_at: paidAt,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq("id", caseId)
    .eq("organization_id", organizationId);

  await supabase.from("case_events").insert({
    case_id: caseId,
    organization_id: organizationId,
    event_type: "payment",
    title: "Dossier ouvert",
    description: `Paiement BLEME confirmé : ${(amountTotal / 100).toLocaleString("fr-FR")} ${currency}.`,
    source: "system",
  });
}
