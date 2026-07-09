import "server-only";

import Stripe from "stripe";
import { getSecret } from "@/lib/secrets";

let stripe: { key: string; client: Stripe } | null = null;

export async function isStripeConfigured(): Promise<boolean> {
  return Boolean(await getSecret("STRIPE_SECRET_KEY"));
}

export async function getStripe(): Promise<Stripe> {
  const key = await getSecret("STRIPE_SECRET_KEY");
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY manquant.");
  }
  if (!stripe || stripe.key !== key) {
    stripe = {
      key,
      client: new Stripe(key, {
        apiVersion: "2026-06-24.dahlia",
        typescript: true,
      }),
    };
  }
  return stripe.client;
}
