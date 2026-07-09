import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/billing/stripe";
import { markCaseCheckoutPaid, syncSubscription } from "@/lib/billing/sync";
import { getSecret } from "@/lib/secrets";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const webhookSecret = await getSecret("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook Stripe non configuré." }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signature Stripe manquante." }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  const stripe = await getStripe();
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Signature Stripe invalide." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error: duplicate } = await supabase
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (duplicate?.code === "23505") {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (duplicate) {
    return NextResponse.json({ error: "Journal Stripe indisponible." }, { status: 500 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "payment" && session.metadata?.kind === "case") {
        await markCaseCheckoutPaid(session);
      }
      if (session.mode === "subscription" && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          typeof session.subscription === "string" ? session.subscription : session.subscription.id,
        );
        await syncSubscription(subscription);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
