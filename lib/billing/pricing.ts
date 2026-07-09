export const CASE_PRICE_STANDARD_CENTS = 3900;
export const CASE_PRICE_PRO_CENTS = 1900;

export function formatEuros(cents: number): string {
  return `${(cents / 100).toLocaleString("fr-FR", {
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  })} €`;
}

export function hasActivePro(org: {
  billing_plan?: string | null;
  billing_status?: string | null;
  subscription_current_period_end?: string | null;
}): boolean {
  if (org.billing_plan !== "pro") return false;
  if (!["active", "trialing", "past_due"].includes(org.billing_status ?? "")) {
    return false;
  }
  if (!org.subscription_current_period_end) return true;
  return Date.parse(org.subscription_current_period_end) > Date.now();
}

export function casePriceForOrg(org: {
  billing_plan?: string | null;
  billing_status?: string | null;
  subscription_current_period_end?: string | null;
}): number {
  return hasActivePro(org) ? CASE_PRICE_PRO_CENTS : CASE_PRICE_STANDARD_CENTS;
}
