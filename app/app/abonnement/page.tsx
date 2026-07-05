import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BadgeCheck, Check, Receipt, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/ui";

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
              Vous faites partie des premiers : tout est offert pendant la
              construction, dossiers compris. Au lancement, préparer restera
              gratuit ; le dossier coûtera 39 € HT (19 € HT avec Pro à
              9 € HT/mois).
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
        Pro en annuel : 90 € HT (2 mois offerts). Envois au réel, validés
        avant chaque paiement : relances email incluses, lettre suivie
        5 € HT, recommandé papier avec AR 12 € HT, recommandé électronique
        8 € HT (bientôt). Jamais de commission sur les sommes récupérées ;
        vos dossiers clôturés restent consultables et exportables sans
        limite.
      </p>
    </div>
  );
}
