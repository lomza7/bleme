import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { SITE_URL } from "@/lib/site";

/*
 * Coquille des guides : header léger, fil d'Ariane, article en prose,
 * encart CTA, disclaimer, footer minimal. Pensé pour la lisibilité
 * (lecteurs) et l'extraction (moteurs classiques et génératifs).
 */

export function GuideShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
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

      <main className="mx-auto max-w-3xl px-6 py-12">
        <nav aria-label="Fil d’Ariane" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/" className="transition-colors duration-300 hover:text-foreground">
            Accueil
          </Link>
          <ChevronRight className="size-3.5" />
          <Link href="/guides" className="transition-colors duration-300 hover:text-foreground">
            Guides
          </Link>
        </nav>

        <article className="prose-bleme mt-6">
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Mis à jour le {updated} · Par l’équipe BLEME
          </p>
          {children}
        </article>

        <div className="mt-12 flex flex-col items-start gap-4 rounded-[1.75rem] bg-ink p-8 text-ink-foreground">
          <h2 className="text-xl font-bold tracking-tight">
            Votre blème, réglé sans y passer vos soirées.
          </h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            Racontez votre impayé ou votre litige à voix haute : BLEME monte le
            dossier, prépare les courriers et suit chaque étape. Vous validez,
            ça avance. Dès 9 €/mois, sans engagement.
          </p>
          <Link
            href="/nouveau"
            className="group inline-flex items-center gap-3 rounded-full bg-brand py-2.5 pl-6 pr-2.5 text-[15px] font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
          >
            Créer mon premier dossier
            <span className="flex size-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ease-fluid group-hover:translate-x-0.5">
              <ArrowRight className="size-4" />
            </span>
          </Link>
        </div>

        <p className="mt-8 text-xs leading-relaxed text-muted-foreground/80">
          Cet article présente une information générale à jour de sa date de
          publication, à partir de sources officielles (Légifrance,
          service-public.fr). Il ne constitue pas un conseil juridique
          personnalisé : pour une situation particulière, rapprochez-vous d’un
          professionnel du droit.
        </p>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-semibold text-foreground">BLEME</span> · Vos
            blèmes de pro, pris au sérieux.
          </p>
          <nav className="flex gap-5">
            <Link href="/guides" className="hover:text-foreground">
              Tous les guides
            </Link>
            <Link href="/" className="hover:text-foreground">
              bleme.fr
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function GuideFaq({
  items,
}: {
  items: { q: string; r: string }[];
}) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-bold tracking-tight">Questions fréquentes</h2>
      <div className="mt-4">
        {items.map((item) => (
          <details key={item.q} className="group border-t py-4 last:border-b">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
              {item.q}
              <span className="text-xl font-light text-muted-foreground transition-transform duration-500 ease-fluid group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-2 max-w-[65ch] text-[15px] leading-relaxed text-muted-foreground">
              {item.r}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function guideJsonLd({
  slug,
  title,
  description,
  updated,
  faq,
}: {
  slug: string;
  title: string;
  description: string;
  updated: string;
  faq: { q: string; r: string }[];
}) {
  const base = SITE_URL;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      description,
      dateModified: updated,
      inLanguage: "fr-FR",
      mainEntityOfPage: `${base}/guides/${slug}`,
      author: { "@type": "Organization", name: "BLEME", url: base },
      publisher: { "@type": "Organization", name: "BLEME", logo: { "@type": "ImageObject", url: `${base}/icon.png` } },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.r },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: base },
        { "@type": "ListItem", position: 2, name: "Guides", item: `${base}/guides` },
        { "@type": "ListItem", position: 3, name: title, item: `${base}/guides/${slug}` },
      ],
    },
  ];
}
