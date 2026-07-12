export const CASE_PRICE_STANDARD_CENTS = 1900;
export const CASE_PRICE_PRO_EXTRA_CENTS = 1000;
export const CASE_PRICE_PRO_CENTS = CASE_PRICE_PRO_EXTRA_CENTS;
export const PRO_INCLUDED_CASES_PER_MONTH = 1;

export function billingMonthStartIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

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
}, opts?: { proIncludedCaseAvailable?: boolean }): number {
  if (!hasActivePro(org)) return CASE_PRICE_STANDARD_CENTS;
  return opts?.proIncludedCaseAvailable ? 0 : CASE_PRICE_PRO_EXTRA_CENTS;
}
