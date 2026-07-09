import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Check, Receipt, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/ui";
import { startBillingPortal, startProCheckout } from "@/lib/billing/actions";
import { formatEuros, hasActivePro } from "@/lib/billing/pricing";
import { getSecret } from "@/lib/secrets";

export const metadata: Metadata = { title: "Mon abonnement" };

const PLANS = [
  {
    nom: "Gratuit",
    prix: "0 €",
    suffixe: "pour toujours",
    inclus: [
      "Récit vocal et montage des preuves",
      "Boîte de réception et chronologie",
      "Brouillons visibles en entier",
      "1 dossier en préparation",
    ],
  },
  {
    nom: "Le dossier",
    prix: "39 €",
    suffixe: "HT/dossier · 19 € en Pro",
    populaire: true,
    inclus: [
      "Payé une fois, suivi jusqu’à résolution",
      "Relances email incluses et cadencées",
      "Mise en demeure prête à partir",
      "Export pro : synthèse + pièces",
    ],
  },
  {
    nom: "Pro",
    prix: "9 €",
    suffixe: "HT/mois, sans engagement",
    inclus: [
      "Dossiers à 19 € HT au lieu de 39 €",
      "Boîte de réception illimitée + libellés",
      "Veille des échéances et prescription",
      "Documents d’entreprise illimités",
    ],
  },
];

const STATUS_LABEL: Record<string, string> = {
  active: "Actif",
  trialing: "Essai actif",
  past_due: "Paiement à régulariser",
  canceled: "Résilié",
  unpaid: "Impayé",
  free: "Gratuit",
};

export default async function AbonnementPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; paiement?: string; portal?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const { data: org } = membership
    ? await supabase
        .from("organizations")
        .select("id, name, billing_plan, billing_status, subscription_current_period_end, subscription_cancel_at_period_end, stripe_customer_id")
        .eq("id", membership.organization_id)
        .maybeSingle()
    : { data: null };
  const proActive = org ? hasActivePro(org) : false;
  const [stripeSecret, monthlyPriceId, yearlyPriceId] = await Promise.all([
    getSecret("STRIPE_SECRET_KEY"),
    getSecret("STRIPE_PRO_MONTHLY_PRICE_ID"),
    getSecret("STRIPE_PRO_YEARLY_PRICE_ID"),
  ]);
  const stripeReady = Boolean(stripeSecret && monthlyPriceId);
  const yearlyReady = Boolean(stripeSecret && yearlyPriceId);
  const { data: payments } = org
    ? await supabase
        .from("billing_payments")
        .select("id, kind, status, amount_total_cents, currency, paid_at, created_at")
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Mon abonnement"
        sub="Commencez par un dossier, continuez si ça rapporte. Sans engagement, données exportables à vie."
      />

      {/* Statut actuel */}
      <div className="flex flex-col items-start gap-4 rounded-[1.75rem] bg-ink p-8 text-ink-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand/20 text-brand">
            <BadgeCheck className="size-5" />
          </span>
          <div>
            <p className="font-semibold">{proActive ? "Pro actif" : "Formule gratuite"}</p>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-muted">
              {proActive
                ? `Vos dossiers passent à 19 € HT. Statut Stripe : ${STATUS_LABEL[org?.billing_status ?? "active"] ?? org?.billing_status}.`
                : "Préparez gratuitement vos dossiers. Le paiement intervient à l'ouverture du dossier ou via Pro pour obtenir le tarif réduit."}
              {org?.subscription_cancel_at_period_end && org.subscription_current_period_end
                ? ` Résiliation prévue le ${new Date(org.subscription_current_period_end).toLocaleDateString("fr-FR")}.`
                : ""}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-brand px-3.5 py-1.5 text-xs font-medium text-brand-foreground">
          {proActive ? "Pro" : "Gratuit"}
        </span>
      </div>

      {query.checkout === "success" ? (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          Paiement reçu. Stripe finalise la synchronisation de votre abonnement.
        </p>
      ) : query.checkout === "cancelled" ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Paiement annulé : rien n’a été modifié.
        </p>
      ) : query.paiement ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          Stripe n’est pas encore complètement configuré pour l’abonnement Pro.
        </p>
      ) : null}

      {/* Plans */}
      <section>
        <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Les formules au lancement
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.nom}
              className={`relative flex flex-col rounded-[1.75rem] border bg-card p-7 ${
                p.populaire ? "ring-2 ring-brand" : ""
              }`}
            >
              {p.populaire ? (
                <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-[11px] font-medium text-brand-foreground">
                  <Sparkles className="size-3" />
                  Le plus choisi
                </span>
              ) : null}
              <h3 className="font-semibold">{p.nom}</h3>
              <p className="mt-2 text-3xl font-bold tracking-tight">
                {p.prix}
                <span className="text-sm font-normal text-muted-foreground"> {p.suffixe}</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.inclus.map((i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                    {i}
                  </li>
                ))}
              </ul>
              {p.nom === "Gratuit" ? (
                <button
                  type="button"
                  disabled
                  className="mt-6 rounded-full border px-5 py-2.5 text-sm font-medium text-muted-foreground opacity-70"
                >
                  Votre base actuelle
                </button>
              ) : p.nom === "Le dossier" ? (
                <Link
                  href="/app/nouveau"
                  className="mt-6 inline-flex justify-center rounded-full border px-5 py-2.5 text-sm font-medium transition-colors hover:border-brand/60 hover:bg-brand-soft"
                >
                  Créer un dossier
                </Link>
              ) : proActive ? (
                <form action={startBillingPortal} className="mt-6">
                  <button
                    type="submit"
                    className="w-full rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98]"
                  >
                    Gérer sur Stripe
                  </button>
                </form>
              ) : (
                <div className="mt-6 flex flex-col gap-2">
                  <form action={startProCheckout}>
                    <input type="hidden" name="interval" value="monthly" />
                    <button
                      type="submit"
                      disabled={!stripeReady}
                      className="w-full rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                    >
                      Passer Pro
                    </button>
                  </form>
                  {yearlyReady ? (
                    <form action={startProCheckout}>
                      <input type="hidden" name="interval" value="yearly" />
                      <button
                        type="submit"
                        className="w-full rounded-full border px-5 py-2.5 text-sm font-medium transition-colors hover:border-brand/60 hover:bg-brand-soft"
                      >
                        Pro annuel
                      </button>
                    </form>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Factures BLEME */}
      <section>
        <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Mes factures BLEME
        </h2>
        <div className="mt-3 flex flex-col items-start gap-4 rounded-[1.75rem] border bg-card p-8">
          <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
            <Receipt className="size-5" />
          </span>
          {payments && payments.length > 0 ? (
            <div className="w-full divide-y rounded-2xl border">
              {payments.map((payment) => (
                <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="font-medium">Dossier BLEME</span>
                  <span className="text-muted-foreground">
                    {payment.paid_at
                      ? new Date(payment.paid_at).toLocaleDateString("fr-FR")
                      : "En attente"}
                  </span>
                  <span className="font-semibold">
                    {formatEuros(Number(payment.amount_total_cents) || 0)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                Les paiements BLEME apparaîtront ici : abonnement, dossiers à
                l’unité, recommandés. Les factures fiscales restent émises par Stripe.
              </p>
              <p className="rounded-full bg-muted px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
                Aucun paiement pour l’instant.
              </p>
            </>
          )}
        </div>
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground/80">
        Pro en annuel : 90 € HT (2 mois offerts). Envois au réel, validés
        avant chaque paiement : relances email incluses, lettre suivie
        5 € HT, recommandé papier avec AR 10 € HT, recommandé électronique
        8 € HT (bientôt). Jamais de commission sur les sommes récupérées ;
        vos dossiers clôturés restent consultables et exportables sans
        limite.
      </p>
    </div>
  );
}
