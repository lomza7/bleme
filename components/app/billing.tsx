import { CheckCircle2, CreditCard, LoaderCircle, LockKeyhole, Sparkles } from "lucide-react";
import { startCaseCheckout } from "@/lib/billing/actions";
import { formatEuros } from "@/lib/billing/pricing";

export function CasePaymentBanner({
  caseId,
  billingStatus,
  priceCents,
  proPrice,
  stripeReady,
  checkout,
  paymentError,
}: {
  caseId: string;
  billingStatus?: string | null;
  priceCents: number;
  proPrice: boolean;
  stripeReady: boolean;
  checkout?: string;
  paymentError?: string;
}) {
  if (billingStatus === "paid" || billingStatus === "included") {
    return (
      <section className="mt-6 flex flex-col gap-3 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
          <div>
            <p className="text-sm font-semibold">Dossier ouvert</p>
            <p className="mt-0.5 text-sm text-emerald-800">
              Les courriers peuvent être validés et envoyés quand vous êtes prêt.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const pending = billingStatus === "pending" || checkout === "case-success";
  const includedThisMonth = priceCents === 0 && proPrice;

  return (
    <section className="mt-6 rounded-[1.75rem] border bg-card p-6 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
              {includedThisMonth ? (
                <Sparkles className="size-4" />
              ) : stripeReady ? (
                <CreditCard className="size-4" />
              ) : (
                <LockKeyhole className="size-4" />
              )}
            </span>
            <h2 className="text-lg font-semibold">Ouvrir le dossier</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {includedThisMonth
              ? "Votre forfait Pro inclut encore un dossier ce mois-ci. L’ouverture débloque la validation des courriers et le suivi, sans paiement Stripe."
              : "Vous pouvez préparer gratuitement. Le paiement débloque la validation des courriers et le suivi du dossier."}
          </p>
          {checkout === "case-included" ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
              <CheckCircle2 className="size-3.5" />
              Dossier ouvert avec votre forfait Pro.
            </p>
          ) : null}
          {pending ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
              <LoaderCircle className="size-3.5 animate-spin" />
              Paiement en cours de confirmation Stripe.
            </p>
          ) : null}
          {paymentError ? (
            <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
              Paiement indisponible : configuration Stripe incomplète.
            </p>
          ) : null}
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="text-2xl font-bold tracking-tight">
            {includedThisMonth ? "Inclus" : formatEuros(priceCents)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {includedThisMonth ? "1 dossier/mois avec Pro" : `HT/dossier${proPrice ? " · tarif Pro" : ""}`}
          </p>
          <form action={startCaseCheckout.bind(null, caseId)} className="mt-4">
            <button
              type="submit"
              disabled={!includedThisMonth && !stripeReady}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              {includedThisMonth ? <Sparkles className="size-4" /> : <CreditCard className="size-4" />}
              {includedThisMonth ? "Ouvrir avec Pro" : "Payer et ouvrir"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
