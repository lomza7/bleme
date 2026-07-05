import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenText } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Guides pratiques : impayés, relances, mise en demeure",
  description:
    "Guides pratiques BLEME pour les pros : traiter une facture impayée étape par étape, rédiger une mise en demeure, réclamer l'indemnité forfaitaire de 40 €. Information claire, sources officielles.",
  alternates: { canonical: "/guides" },
};

const GUIDES = [
  {
    slug: "facture-impayee-que-faire",
    titre: "Facture impayée : que faire, étape par étape",
    resume:
      "Relance amiable, relance ferme, mise en demeure, recours : le calendrier complet, les délais légaux et les erreurs qui coûtent cher.",
  },
  {
    slug: "mise-en-demeure-de-payer",
    titre: "Mise en demeure de payer : mentions, envoi, effets",
    resume:
      "Les mentions indispensables, pourquoi le recommandé n'est pas un détail, et ce que la mise en demeure change juridiquement.",
  },
  {
    slug: "indemnite-forfaitaire-40-euros",
    titre: "Indemnité forfaitaire de 40 € : la pénalité automatique",
    resume:
      "Due de plein droit pour chaque facture en retard entre pros. Qui peut la réclamer, comment la chiffrer, et ses limites.",
  },
];

export default function GuidesPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Guides pratiques BLEME",
          url: "https://bleme-two.vercel.app/guides",
          hasPart: GUIDES.map((g) => ({
            "@type": "Article",
            headline: g.titre,
            url: `https://bleme-two.vercel.app/guides/${g.slug}`,
          })),
        }}
      />
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
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

      <main className="mx-auto max-w-3xl px-6 py-14">
        <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
          <BookOpenText className="size-6" />
        </span>
        <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
          Guides pratiques
        </h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          Impayés, relances, mise en demeure : l’essentiel du droit utile aux
          pros, en clair et sourcé. Sans jargon, sans conseil personnalisé.
        </p>

        <div className="mt-10 flex flex-col gap-4">
          {GUIDES.map((g) => (
            <Link
              key={g.slug}
              href={`/guides/${g.slug}`}
              className="group rounded-[1.75rem] border bg-card p-7 transition-all duration-500 ease-fluid hover:-translate-y-0.5 hover:shadow-lg hover:shadow-zinc-950/[0.05]"
            >
              <h2 className="text-lg font-semibold leading-snug">{g.titre}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {g.resume}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-strong">
                Lire le guide
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-8 text-sm text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">BLEME</span> · Vos
            blèmes de pro, pris au sérieux.
          </p>
          <Link href="/" className="hover:text-foreground">
            Retour au site
          </Link>
        </div>
      </footer>
    </div>
  );
}
