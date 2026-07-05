import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BadgeCheck, Check, Receipt, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/ui";

export const metadata: Metadata = { title: "Mon abonnement" };

const PLANS = [
  {
    nom: "Pro Starter",
    prix: "9 €",
    inclus: ["1 dossier actif", "Cadences automatiques", "Dashboard cash", "Exports illimités"],
  },
  {
    nom: "Pro Business",
    prix: "49 €",
    populaire: true,
    inclus: [
      "10 dossiers actifs",
      "Recommandés intégrés",
      "Templates personnalisés",
      "Support prioritaire",
    ],
  },
  {
    nom: "Pro Scale",
    prix: "99 €",
    inclus: ["Dossiers illimités", "Multi-utilisateurs", "Intégrations compta", "Onboarding dédié"],
  },
];

export default async function AbonnementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
            <p className="font-semibold">Accès de lancement</p>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-muted">
              Vous faites partie des premiers : l’accès est offert pendant la
              construction. Au lancement, l’abonnement démarre à 9 € par mois,
              remboursé si aucune relance n’est générée.
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-brand px-3.5 py-1.5 text-xs font-medium text-brand-foreground">
          Gratuit pendant la bêta
        </span>
      </div>

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
                <span className="text-sm font-normal text-muted-foreground"> HT/mois</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.inclus.map((i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                    {i}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled
                className="mt-6 rounded-full border px-5 py-2.5 text-sm font-medium text-muted-foreground opacity-70"
              >
                Disponible au lancement
              </button>
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
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            Toutes les factures émises par BLEME apparaîtront ici : abonnement,
            dossiers à l’unité, recommandés. Chacune sera téléchargeable en PDF
            et envoyée par email, prête pour votre comptable.
          </p>
          <p className="rounded-full bg-muted px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
            Aucune facture pour l’instant : l’accès bêta est gratuit.
          </p>
        </div>
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground/80">
        Moins 20 % en facturation annuelle. Frais variables au réel : recommandé
        papier ~12 €, lettre recommandée électronique ~7 €. Un « dossier
        actif » est un dossier ni résolu ni clôturé : vos dossiers terminés
        restent consultables et exportables sans limite.
      </p>
    </div>
  );
}
