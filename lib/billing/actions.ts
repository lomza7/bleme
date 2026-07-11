"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { can as hasCapability, type PermissionSet } from "@/lib/permissions/capabilities";
import { publicEnv } from "@/lib/env";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";
import { casePriceForOrg, hasActivePro } from "@/lib/billing/pricing";
import { getSecret } from "@/lib/secrets";

type BillingOrg = {
  id: string;
  name: string;
  stripe_customer_id: string | null;
  billing_plan: string | null;
  billing_status: string | null;
  subscription_current_period_end: string | null;
};

async function currentBillingContext(): Promise<
  | { user: { id: string; email?: string | null }; org: BillingOrg }
  | null
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role, permissions")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return null;
  // Gérer l'abonnement & le paiement = 'billing.manage' (chemins Stripe en
  // service-role, hors RLS).
  if (!hasCapability(membership.role, membership.permissions as PermissionSet, "billing.manage")) {
    return null;
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, stripe_customer_id, billing_plan, billing_status, subscription_current_period_end")
    .eq("id", membership.organization_id)
    .maybeSingle();
  if (!org) return null;

  return { user: { id: user.id, email: user.email }, org };
}

async function getOrCreateCustomer(
  org: BillingOrg,
  user: { id: string; email?: string | null },
): Promise<string> {
  if (org.stripe_customer_id) return org.stripe_customer_id;

  const stripe = await getStripe();
  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    name: org.name,
    metadata: {
      organizationId: org.id,
      userId: user.id,
    },
  });

  const service = createServiceClient();
  await service
    .from("organizations")
    .update({ stripe_customer_id: customer.id })
    .eq("id", org.id);

  return customer.id;
}

function appUrl(path: string): string {
  return `${publicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}${path}`;
}

export async function startProCheckout(formData: FormData): Promise<void> {
  const ctx = await currentBillingContext();
  if (!ctx) redirect("/login");
  if (!(await isStripeConfigured())) redirect("/app/abonnement?paiement=config");

  const interval = String(formData.get("interval") ?? "monthly");
  const priceId =
    interval === "yearly"
      ? await getSecret("STRIPE_PRO_YEARLY_PRICE_ID")
      : await getSecret("STRIPE_PRO_MONTHLY_PRICE_ID");
  if (!priceId) redirect("/app/abonnement?paiement=prix-manquant");

  const stripe = await getStripe();
  const customerId = await getOrCreateCustomer(ctx.org, ctx.user);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: ctx.org.id,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    locale: "fr",
    success_url: appUrl("/app/abonnement?checkout=success&session_id={CHECKOUT_SESSION_ID}"),
    cancel_url: appUrl("/app/abonnement?checkout=cancelled"),
    metadata: {
      kind: "subscription",
      organizationId: ctx.org.id,
    },
    subscription_data: {
      metadata: {
        organizationId: ctx.org.id,
      },
    },
  });

  if (!session.url) redirect("/app/abonnement?paiement=session");
  redirect(session.url);
}

export async function startBillingPortal(): Promise<void> {
  const ctx = await currentBillingContext();
  if (!ctx) redirect("/login");
  if (!ctx.org.stripe_customer_id || !(await isStripeConfigured())) {
    redirect("/app/abonnement?portal=indisponible");
  }

  const stripe = await getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: ctx.org.stripe_customer_id,
    return_url: appUrl("/app/abonnement"),
  });

  redirect(session.url);
}

export async function startCaseCheckout(
  caseId: string,
): Promise<void> {
  const ctx = await currentBillingContext();
  if (!ctx) redirect("/login");

  const supabase = await createClient();
  const { data: c } = await supabase
    .from("cases")
    .select("id, organization_id, title, billing_status, is_sample")
    .eq("id", caseId)
    .maybeSingle();
  if (!c || c.organization_id !== ctx.org.id) redirect("/app/dossiers");
  if (c.is_sample || ["paid", "included"].includes(c.billing_status ?? "")) {
    redirect(`/app/dossiers/${caseId}`);
  }
  if (!(await isStripeConfigured())) redirect(`/app/dossiers/${caseId}?paiement=config`);

  const amountCents = casePriceForOrg(ctx.org);
  const pro = hasActivePro(ctx.org);
  const stripe = await getStripe();
  const customerId = await getOrCreateCustomer(ctx.org, ctx.user);
  const metadata = {
    kind: "case",
    organizationId: ctx.org.id,
    caseId,
    amountCents: String(amountCents),
    proPrice: pro ? "true" : "false",
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    client_reference_id: ctx.org.id,
    locale: "fr",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: amountCents,
          product_data: {
            name: "Ouverture de dossier BLEME",
            description: c.title,
          },
        },
      },
    ],
    invoice_creation: { enabled: true },
    success_url: appUrl(`/app/dossiers/${caseId}?checkout=case-success&session_id={CHECKOUT_SESSION_ID}`),
    cancel_url: appUrl(`/app/dossiers/${caseId}?checkout=case-cancelled`),
    metadata,
    payment_intent_data: { metadata },
  });

  const service = createServiceClient();
  await service
    .from("cases")
    .update({
      billing_status: "pending",
      billing_amount_cents: amountCents,
      billing_currency: "EUR",
      stripe_checkout_session_id: session.id,
    })
    .eq("id", caseId)
    .eq("organization_id", ctx.org.id);

  if (!session.url) redirect(`/app/dossiers/${caseId}?paiement=session`);
  redirect(session.url);
}
