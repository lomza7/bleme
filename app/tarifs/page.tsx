import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  FileCheck2,
  Lock,
  Mail,
  MailCheck,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Reveal, RevealItem, RevealStagger } from "@/components/landing/reveal";
import { ImpayeTypeTabs, SimulateurAnnee } from "@/components/tarifs/simulateur";
import { JsonLd } from "@/components/seo/json-ld";

/*
 * Page tarifs : le modèle hybride (docs/09-pricing.md, révision v3).
 * 0 €/mois sans abonnement + dossier à l'unité, Pro 9 € avec un dossier
 * inclus par mois et les dossiers supplémentaires à prix réduit.
 */

const TITLE = "Tarifs : 0 €/mois, 19 € par dossier";
const DESCRIPTION =
  "BLEME coûte 0 € par mois sans abonnement : vous payez 19 € HT par dossier ouvert. Le forfait Pro à 9 € HT/mois inclut 1 dossier par mois, l'API, le stockage illimité des preuves et les dossiers supplémentaires à 10 € HT.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tarifs" },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const FAQ = [
  {
    q: "Qu'est-ce qui est vraiment gratuit ?",
    r: "Le compte et la préparation coûtent 0 € par mois : raconter votre blème à voix haute, importer vos preuves (photos, emails, exports WhatsApp), organiser la chronologie et relire les brouillons. Vous payez seulement quand vous ouvrez un dossier pour le suivre et valider les courriers.",
  },
  {
    q: "Que comprend exactement un dossier à 19 € ?",
    r: "Le dossier payé une fois est suivi jusqu'à sa résolution ou sa clôture : relances par email incluses et cadencées, mise en demeure préparée et mise à jour, suivi des réponses, chronologie complète et export professionnel (synthèse + pièces ordonnées). Seuls les envois postaux (lettre, recommandé) sont facturés en plus, au réel. Un dossier clôturé reste consultable et exportable à vie.",
  },
  {
    q: "Pourquoi prendre Pro si je peux rester à 0 €/mois ?",
    r: "Pro est pensé pour les pros qui ont des impayés récurrents ou veulent brancher leurs outils : 9 € HT/mois, 1 dossier inclus chaque mois, dossiers supplémentaires à 10 € HT, API et webhooks, stockage illimité des preuves et documents, exports faciles vers un avocat ou un comptable.",
  },
  {
    q: "Prenez-vous une commission sur les sommes récupérées ?",
    r: "Jamais. C'est le modèle des sociétés de recouvrement (10 à 20 % de votre argent) et ce n'est pas le nôtre : BLEME est un logiciel, à prix fixes et prévisibles. Ce que votre client vous paie vous revient à 100 %.",
  },
  {
    q: "Y a-t-il un engagement ou des frais cachés ?",
    r: "Non. Le Pro est sans engagement, résiliable en un clic. Chaque envoi payant affiche son prix avant votre validation : rien ne part, et rien n'est facturé, sans votre accord explicite. Vos données s'exportent librement à tout moment, y compris après résiliation.",
  },
  {
    q: "Combien coûte un impayé type, au total ?",
    r: "Pour une facture impayée classique sans abonnement : 19 € HT d'ouverture de dossier + 10 € HT de recommandé avec accusé de réception pour la mise en demeure, soit 29 € HT au total. Avec Pro, le premier dossier du mois est inclus : 9 € HT d'abonnement + 10 € HT de recommandé, soit 19 € HT le mois du dossier. En comparaison, une mise en demeure rédigée par un avocat se facture généralement 90 à 300 €, et une société de recouvrement prendrait 240 à 480 € de commission sur une facture de 2 400 €.",
  },
];

const ENVOIS = [
  {
    icon: Mail,
    nom: "Relances par email",
    prix: "Incluses",
    detail: "Cadencées et suivies (ouverture, réponse), sans limite, dans chaque dossier payé.",
    badge: null,
  },
  {
    icon: Send,
    nom: "Lettre simple suivie",
    prix: "5 € HT",
    detail: "Impression, mise sous pli et envoi postal suivi de vos courriers de relance.",
    badge: null,
  },
  {
    icon: MailCheck,
    nom: "Recommandé papier avec AR",
    prix: "10 € HT",
    detail: "L'envoi qui compte pour la mise en demeure : dépôt, distribution et accusé versés à la chronologie.",
    badge: null,
  },
  {
    icon: FileCheck2,
    nom: "Recommandé électronique qualifié (LRE)",
    prix: "8 € HT",
    detail: "Même valeur légale que le recommandé papier (art. L100 du CPCE), livré en quelques minutes.",
    badge: "Bientôt",
  },
];

const GARANTIES = [
  {
    icon: Scale,
    titre: "0 % de commission",
    texte: "Ce que votre client vous paie vous revient à 100 %. Prix fixes, prévisibles, déductibles.",
  },
  {
    icon: ShieldCheck,
    titre: "Rien ne part sans vous",
    texte: "Chaque envoi affiche son prix et attend votre validation. Aucune facturation surprise.",
  },
  {
    icon: Lock,
    titre: "Vos données vous suivent",
    texte: "Export complet à tout moment, même après résiliation. Aucun frais de sortie, jamais.",
  },
];

export default function TarifsPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.r },
          })),
        }}
      />

      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-lg font-bold tracking-tight">
            BLEME<span className="text-brand">.</span>
          </Link>
          <Link
            href="/nouveau"
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
          >
            Créer mon dossier
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        {/* Hero */}
        <Reveal onLoad>
          <div className="mx-auto max-w-2xl pt-16 text-center lg:pt-20">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              0 € par mois.
              <br />
              19 € par dossier.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              Restez sans abonnement si vos blèmes sont ponctuels. Passez Pro
              si vous voulez un dossier inclus chaque mois, l’API, le stockage
              illimité des preuves et des exports prêts pour vos pros.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-[13px] font-medium text-emerald-700 ring-1 ring-emerald-200">
              <Sparkles className="size-3.5" />
              Pendant la bêta, tout est offert, dossiers compris.
            </p>
          </div>
        </Reveal>

        {/* Les deux formules */}
        <RevealStagger className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-4 lg:grid-cols-2" stagger={0.12}>
          <RevealItem>
            <div className="flex h-full flex-col rounded-[2rem] border bg-card p-8 sm:p-9">
              <h2 className="text-lg font-semibold">Gratuit</h2>
              <p className="mt-3 text-5xl font-bold tracking-tight">
                0 €
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  pour toujours
                </span>
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                La formule simple : aucun abonnement, vous payez uniquement les
                dossiers que vous ouvrez.
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {[
                  "Racontez votre blème à voix haute, l’IA structure le dossier",
                  "Preuves centralisées : photos, emails, exports WhatsApp",
                  "Boîte de réception et chronologie du dossier",
                  "Brouillons de relances et de mise en demeure, visibles en entier",
                  "19 € HT par dossier ouvert, suivi jusqu’au bout",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-[15px]">
                    <Check className="mt-1 size-4 shrink-0 text-brand" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 rounded-2xl bg-muted px-5 py-3.5 text-[13px] leading-relaxed text-muted-foreground">
                0 € par mois, sans engagement. L’ouverture du dossier débloque
                les envois et le suivi.
              </p>
              <Link
                href="/nouveau"
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-medium transition-all duration-500 ease-fluid hover:border-brand/50 hover:text-brand-strong active:scale-[0.98]"
              >
                Commencer gratuitement
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </RevealItem>

          <RevealItem>
            <div className="relative flex h-full flex-col rounded-[2rem] bg-ink p-8 text-ink-foreground sm:p-9">
              <span className="absolute -top-3 left-8 inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-[11px] font-medium text-brand-foreground">
                <Sparkles className="size-3" />
                Pour les pros qui relancent souvent
              </span>
              <h2 className="text-lg font-semibold">Pro</h2>
              <p className="mt-3 text-5xl font-bold tracking-tight">
                9 €
                <span className="ml-2 text-base font-normal text-ink-muted">
                  HT/mois
                </span>
              </p>
              <p className="mt-4 leading-relaxed text-ink-muted">
                Le forfait pour ceux qui veulent traiter leurs dossiers en
                continu et connecter BLEME à leurs outils.
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {[
                  "1 dossier inclus chaque mois",
                  "Dossier supplémentaire à 10 € HT",
                  "Boîte de réception illimitée, libellés de tri",
                  "Veille des échéances et de la prescription",
                  "Stockage illimité des preuves et documents",
                  "API & webhooks pour connecter vos outils",
                  "Export facile vers avocat ou comptable",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-[15px]">
                    <Check className="mt-1 size-4 shrink-0 text-brand" />
                    <span className="text-ink-foreground/85">{f}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 rounded-2xl bg-white/10 px-5 py-3.5 text-[13px] leading-relaxed text-ink-muted ring-1 ring-white/10">
                Sans engagement, résiliable en un clic. 90 € HT/an en annuel
                (2 mois offerts). Le dossier inclus revient chaque mois.
              </p>
              <Link
                href="/signup?next=/app"
                className="group mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
              >
                Créer mon compte
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </RevealItem>
        </RevealStagger>

        {/* Le prix au dossier */}
        <Reveal>
          <section className="mx-auto mt-20 max-w-4xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Chaque dossier ouvert est suivi jusqu’au bout.
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
              Un prix fixe, quel que soit le montant en jeu : jamais un
              pourcentage de votre argent, jamais de commission de recouvrement.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-[1.75rem] border bg-card p-7">
                <p className="text-sm font-semibold text-muted-foreground">Sans abonnement</p>
                <p className="mt-2 text-4xl font-bold tracking-tight">
                  19 €<span className="text-base font-normal text-muted-foreground"> HT/dossier</span>
                </p>
              </div>
              <div className="rounded-[1.75rem] border-2 border-brand/40 bg-brand-soft/40 p-7">
                <p className="text-sm font-semibold text-brand-strong">Avec Pro (9 € HT/mois)</p>
                <p className="mt-2 text-4xl font-bold tracking-tight">
                  1 inclus<span className="text-base font-normal text-muted-foreground"> /mois</span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  puis 10 € HT par dossier supplémentaire
                </p>
              </div>
            </div>
            <ul className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              {[
                "Relances par email incluses, cadencées (J0, J+7…)",
                "Mise en demeure préparée, mise à jour, prête à partir",
                "Suivi jusqu’à résolution ou clôture, sans limite de durée",
                "Réponses du débiteur analysées et versées au dossier",
                "Chronologie complète, opposable, datée",
                "Export professionnel : synthèse + pièces ordonnées",
              ].map((f) => (
                <li key={f} className="flex items-start gap-3 text-[15px]">
                  <Check className="mt-1 size-4 shrink-0 text-brand" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground/80">
              Un dossier clôturé reste consultable et exportable à vie : le
              prix n’a jamais vos données en otage.
            </p>
          </section>
        </Reveal>

        {/* Les envois */}
        <Reveal>
          <section className="mx-auto mt-20 max-w-4xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Les envois, au réel, validés par vous.
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
              Chaque envoi affiche son prix avant votre validation. Rien ne
              part, et rien n’est facturé, sans votre accord.
            </p>
            <div className="mt-8 overflow-hidden rounded-[1.75rem] border bg-card">
              {ENVOIS.map((e, i) => (
                <div
                  key={e.nom}
                  className={`flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-5 sm:px-8 ${i > 0 ? "border-t" : ""}`}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
                    <e.icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1 basis-52">
                    <p className="flex items-center gap-2 font-semibold">
                      {e.nom}
                      {e.badge ? (
                        <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-medium text-brand-foreground">
                          {e.badge}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{e.detail}</p>
                  </div>
                  <p className="shrink-0 text-xl font-bold tabular-nums tracking-tight">
                    {e.prix}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* L'exemple chiffré, à onglets (à l'unité / Pro) */}
        <Reveal>
          <ImpayeTypeTabs />
        </Reveal>

        {/* Simulateur annuel : l'investissement, pas la dépense */}
        <Reveal>
          <SimulateurAnnee />
        </Reveal>

        {/* Le front administratif, désormais ouvert */}
        <Reveal>
          <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-3 rounded-[1.75rem] border border-dashed bg-card px-7 py-5">
            <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-medium text-brand-foreground">
              Nouveau
            </span>
            <p className="min-w-0 flex-1 basis-72 text-sm leading-relaxed text-muted-foreground">
              Le même réflexe s’applique désormais à l’administration : chaque
              année, plus d’un million de demandes de remise gracieuse sont
              déposées auprès de l’administration fiscale, et environ deux sur
              trois aboutissent à une remise partielle ou totale (rapport
              DGFiP au Parlement). Encore de l’argent qui se défend.
            </p>
          </div>
        </Reveal>

        {/* Garanties */}
        <RevealStagger className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {GARANTIES.map((g) => (
            <RevealItem key={g.titre}>
              <div className="h-full rounded-[1.75rem] border bg-card p-6">
                <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                  <g.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">{g.titre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {g.texte}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>

        {/* FAQ */}
        <Reveal>
          <section className="mx-auto mt-20 max-w-3xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Questions sur les tarifs
            </h2>
            <div className="mt-8 flex flex-col gap-3">
              {FAQ.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-[1.5rem] border bg-card px-6 py-5"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span className="shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {f.r}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </Reveal>

        {/* CTA final */}
        <Reveal>
          <div className="mx-auto mt-20 flex max-w-3xl flex-col items-center gap-4 rounded-[2rem] bg-brand-soft/60 px-8 py-12 text-center ring-1 ring-brand/20">
            <h2 className="text-2xl font-bold tracking-tight">
              Votre dossier se prépare gratuitement.
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Racontez votre blème, montez les preuves, relisez les brouillons.
              Vous déciderez de payer quand tout sera prêt à partir.
            </p>
            <Link
              href="/nouveau"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
            >
              Créer mon premier dossier
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </Reveal>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p>
            <span className="font-semibold text-foreground">BLEME</span> · Vos
            blèmes de pro, pris au sérieux.
          </p>
          <p className="text-xs text-muted-foreground/80">
            Prix HT. Tarifs d’envoi susceptibles d’évoluer avec les tarifs
            postaux.
          </p>
        </div>
      </footer>
    </div>
  );
}
