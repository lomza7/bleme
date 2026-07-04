import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { CountUp } from "@/components/landing/count-up";
import { HeroPreview } from "@/components/landing/hero-preview";
import { Marquee } from "@/components/landing/marquee";
import { Reveal, RevealItem, RevealStagger } from "@/components/landing/reveal";
import { HowItWorks } from "@/components/landing/how-it-works";

const CTA_LABEL = "Créer mon premier dossier";

/*
 * Système de formes : boutons, badges et nav en pill (rounded-full),
 * cartes en rounded-[1.75rem], éléments internes en rounded-2xl.
 */

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Nav />
      <main className="flex-1">
        <Hero />
        <Marquee />
        <Piliers />
        <HowItWorks />
        <Suivi />
        <DashboardBand />
        <IaEtGardeFous />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

function PillCta({
  href,
  children,
  tone = "brand",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  tone?: "brand" | "light";
  className?: string;
}) {
  const tones = {
    brand:
      "bg-brand text-brand-foreground hover:bg-brand-strong [&>span]:bg-white/15",
    light:
      "bg-background text-foreground hover:bg-background/90 [&>span]:bg-foreground/8",
  };
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-3 rounded-full py-2.5 pl-6 pr-2.5 text-[15px] font-medium transition-all duration-500 ease-fluid active:scale-[0.98] ${tones[tone]} ${className}`}
    >
      {children}
      <span className="flex size-8 items-center justify-center rounded-full transition-transform duration-500 ease-fluid group-hover:translate-x-0.5 group-hover:scale-105">
        <ArrowRight className="size-4" />
      </span>
    </Link>
  );
}

function Nav() {
  return (
    <header className="fixed inset-x-4 top-4 z-40">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between rounded-full bg-background/80 pl-6 pr-2 shadow-lg shadow-zinc-950/[0.06] ring-1 ring-zinc-950/[0.07] backdrop-blur-xl">
        <Link href="/" className="text-lg font-bold tracking-tight">
          BLEME<span className="text-brand">.</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#comment" className="transition-colors duration-300 hover:text-foreground">
            Comment ça marche
          </a>
          <a href="#suivi" className="transition-colors duration-300 hover:text-foreground">
            Suivi
          </a>
          <a href="#tarifs" className="transition-colors duration-300 hover:text-foreground">
            Tarifs
          </a>
          <a href="#faq" className="transition-colors duration-300 hover:text-foreground">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-1.5">
          <Link
            href="/login"
            className="hidden rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground sm:block"
          >
            Se connecter
          </Link>
          <Link
            href="/nouveau"
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
          >
            {CTA_LABEL}
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-ink text-ink-foreground">
      <div aria-hidden className="absolute inset-0 bg-hero-grid [mask-image:radial-gradient(ellipse_75%_65%_at_50%_35%,black,transparent)]" />
      <div aria-hidden className="absolute -right-32 -top-48 size-[34rem] rounded-full bg-brand/25 blur-[140px]" />
      <div aria-hidden className="absolute -left-48 bottom-0 size-[26rem] rounded-full bg-brand/10 blur-[120px]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-24 pt-36 lg:grid-cols-12 lg:gap-10 lg:pb-32 lg:pt-44">
        <div className="lg:col-span-7">
          <Reveal onLoad>
            <h1 className="font-bold tracking-tight">
              <span className="block text-2xl leading-snug text-ink-foreground/55 sm:text-3xl">
                Impayés, litiges, démarches :
              </span>
              <span className="mt-2 block text-4xl leading-[1.06] sm:text-5xl lg:text-6xl">
                l’IA qui s’occupe de vos dossiers.
              </span>
            </h1>
          </Reveal>
          <Reveal onLoad delay={0.12}>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-muted">
              Racontez votre blème à voix haute. L’IA monte le dossier, prépare
              les courriers et suit chaque étape jusqu’au paiement.
            </p>
          </Reveal>
          <Reveal onLoad delay={0.22}>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <PillCta href="/nouveau">{CTA_LABEL}</PillCta>
              <a
                href="#comment"
                className="inline-flex items-center rounded-full px-5 py-3 text-[15px] font-medium text-ink-foreground/80 transition-colors duration-300 hover:text-ink-foreground"
              >
                Comment ça marche
              </a>
            </div>
          </Reveal>
        </div>
        <div className="lg:col-span-5">
          <HeroPreview />
        </div>
      </div>
    </section>
  );
}

function Piliers() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
      <Reveal>
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          Chaque année, les entrepreneurs laissent filer de l’argent. Sur trois
          fronts.
        </h2>
      </Reveal>
      <RevealStagger className="mt-14 grid gap-4 lg:grid-cols-2">
        <RevealItem className="lg:col-span-2">
          <div className="grid gap-10 rounded-[1.75rem] bg-ink p-9 text-ink-foreground sm:p-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-brand">
                Impayés
              </p>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                Les factures qu’on finit par abandonner.
              </h3>
              <p className="mt-4 max-w-[48ch] leading-relaxed text-ink-muted">
                Relance cordiale, relance ferme, mise en demeure en recommandé.
                Une cadence qui ne lâche rien, des courriers prêts au bon
                moment, et un dossier béton si ça doit aller plus loin.
              </p>
            </div>
            <ul className="flex flex-col justify-center gap-3">
              {[
                "Relances cadencées, envoyées après votre validation",
                "Mise en demeure conforme aux usages, prête pour recommandé",
                "Export complet pour avocat ou commissaire de justice",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-2xl bg-white/[0.06] px-5 py-4 text-[15px] ring-1 ring-white/10"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                  <span className="text-ink-foreground/85">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </RevealItem>
        <RevealItem>
          <div className="flex h-full flex-col rounded-[1.75rem] border bg-card p-9 transition-all duration-500 ease-fluid hover:-translate-y-1 hover:shadow-xl hover:shadow-zinc-950/[0.06]">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-brand">
              Litiges clients
            </p>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight">
              Les conflits où le client a gain de cause faute de preuves.
            </h3>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Malfaçons alléguées, devis contesté, réception refusée : BLEME
              classe vos preuves, reconstitue la chronologie et prépare une
              réponse circonstanciée. Votre dossier tient debout.
            </p>
          </div>
        </RevealItem>
        <RevealItem>
          <div className="flex h-full flex-col rounded-[1.75rem] bg-brand-soft p-9 transition-all duration-500 ease-fluid hover:-translate-y-1 hover:shadow-xl hover:shadow-zinc-950/[0.06]">
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-brand-strong">
                Amendes et démarches
              </p>
              <span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-medium text-brand-foreground">
                Bientôt
              </span>
            </div>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight">
              Les amendes payées sans discuter.
            </h3>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Beaucoup d’amendes professionnelles peuvent être contestées ou
              faire l’objet d’une demande gracieuse. BLEME préparera le
              recours et suivra la réponse de l’administration.
            </p>
          </div>
        </RevealItem>
      </RevealStagger>
    </section>
  );
}

function Suivi() {
  const jalons = [
    {
      nom: "Relance amiable",
      quand: "jour 0",
      duree: "réponse sous 5 j en moyenne",
    },
    {
      nom: "Relance ferme",
      quand: "jour 7",
      duree: "réponse sous 4 j en moyenne",
    },
    {
      nom: "Mise en demeure",
      quand: "jour 15",
      duree: "recommandé distribué sous 3 j",
    },
    {
      nom: "Escalade préparée",
      quand: "jour 30",
      duree: "dossier exporté en 1 clic",
    },
  ];
  return (
    <section id="suivi" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24 lg:py-32">
      <Reveal>
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          Vous savez toujours où en est le dossier. Et combien de temps chaque
          étape prend.
        </h2>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Chaque dossier avance sur une timeline claire, avec la durée moyenne
          constatée à chaque étape.
        </p>
      </Reveal>
      <RevealStagger className="relative mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6" stagger={0.14}>
        <span
          aria-hidden
          className="absolute left-2 top-[7px] hidden h-px w-[calc(100%-1rem)] bg-border lg:block"
        />
        {jalons.map((j) => (
          <RevealItem key={j.nom}>
            <div className="relative">
              <span className="relative z-[1] block size-3.5 rounded-full border-[3px] border-background bg-brand shadow-[0_0_0_1px_var(--border)]" />
              <p className="mt-5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {j.quand}
              </p>
              <h3 className="mt-1.5 text-lg font-semibold">{j.nom}</h3>
              <p className="mt-2 inline-block rounded-full bg-muted px-3 py-1 text-[13px] text-muted-foreground">
                {j.duree}
              </p>
            </div>
          </RevealItem>
        ))}
      </RevealStagger>
      <Reveal delay={0.3}>
        <p className="mt-12 text-[13px] text-muted-foreground/80">
          Durées indicatives constatées sur les dossiers types. Chaque dossier
          reste particulier, et la cadence s’adapte aux réponses reçues.
        </p>
      </Reveal>
    </section>
  );
}

function DashboardBand() {
  // Données d’illustration du dashboard.
  const stats = [
    { valeur: 12460, suffix: " €", label: "en jeu, suivis et relancés" },
    { valeur: 8320, suffix: " €", label: "récupérés depuis janvier" },
    { valeur: 2, suffix: "", label: "dossiers à risque, sans réponse" },
    { valeur: 1, suffix: "", label: "action en attente de validation" },
  ];
  return (
    <section className="relative overflow-hidden bg-ink text-ink-foreground">
      <div aria-hidden className="absolute -right-40 top-1/2 size-[28rem] -translate-y-1/2 rounded-full bg-brand/15 blur-[130px]" />
      <div className="relative mx-auto max-w-6xl px-6 py-24 lg:py-32">
        <Reveal>
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Vous pilotez vos chantiers. Pilotez aussi votre argent dehors.
            </h2>
            <p className="mt-4 text-lg text-ink-muted">
              Un écran. Fini les impayés qui dorment dans un coin de Gmail.
            </p>
          </div>
        </Reveal>
        <RevealStagger className="mt-16 grid grid-cols-2 gap-y-12 lg:grid-cols-4 lg:divide-x lg:divide-ink-soft" stagger={0.1}>
          {stats.map((s) => (
            <RevealItem key={s.label} className="lg:px-8 lg:first:pl-0 lg:last:pr-0">
              <p className="text-4xl font-bold tracking-tight sm:text-5xl">
                <CountUp value={s.valeur} suffix={s.suffix} />
              </p>
              <p className="mt-2.5 text-sm leading-snug text-ink-muted">
                {s.label}
              </p>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}

function IaEtGardeFous() {
  const fait = [
    "Écoute votre récit et en fait un dossier structuré",
    "Lit vos documents, en sort montants, dates et échéances, avec la source",
    "Rédige des brouillons à partir de modèles éprouvés",
    "Anticipe ce que l’autre partie pourrait répondre",
    "Suit les réponses et prépare la suite au bon moment",
  ];
  const faitPas = [
    "Prédire une décision de justice ou « vos chances de gagner »",
    "Envoyer quoi que ce soit sans votre validation",
    "Remplacer un avocat ou donner un conseil juridique personnalisé",
    "Encaisser l’argent à votre place",
    "Utiliser vos dossiers pour entraîner des modèles",
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
      <Reveal>
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          Une IA qui travaille comme une assistante, pas comme un oracle.
        </h2>
      </Reveal>
      <RevealStagger className="mt-12 grid gap-4 lg:grid-cols-2" stagger={0.12}>
        <RevealItem>
          <div className="h-full rounded-[1.75rem] border bg-card p-9">
            <h3 className="font-semibold">Ce qu’elle fait</h3>
            <ul className="mt-6 space-y-4">
              {fait.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[15px]">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </RevealItem>
        <RevealItem>
          <div className="h-full rounded-[1.75rem] border bg-card p-9">
            <h3 className="font-semibold">Ce qu’elle ne fait jamais</h3>
            <ul className="mt-6 space-y-4">
              {faitPas.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[15px]">
                  <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </RevealItem>
      </RevealStagger>
      <Reveal delay={0.15}>
        <p className="mt-10 max-w-[75ch] text-sm leading-relaxed text-muted-foreground">
          BLEME n’est ni un cabinet d’avocats, ni une société de recouvrement.
          BLEME organise vos dossiers, prépare vos brouillons et suit vos
          démarches. Les courriers partent en votre nom, après votre
          validation. Pour les situations complexes, votre dossier s’exporte en
          un clic vers le professionnel de votre choix.
        </p>
      </Reveal>
    </section>
  );
}

function Pricing() {
  const plans = [
    {
      nom: "Pro Starter",
      prix: "49 €",
      detail: "3 dossiers actifs, cadences automatiques, dashboard",
    },
    {
      nom: "Pro Business",
      prix: "99 €",
      detail:
        "10 dossiers actifs, recommandés intégrés, templates personnalisés",
    },
    {
      nom: "Pro Scale",
      prix: "199 €",
      detail: "Dossiers illimités, multi-utilisateurs, intégrations",
    },
  ];
  return (
    <section id="tarifs" className="border-y bg-muted/40">
      <div className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24 lg:py-32">
        <Reveal>
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Commencez par un dossier. Continuez si ça rapporte.
          </h2>
        </Reveal>
        <RevealStagger className="mt-12 grid gap-4 lg:grid-cols-5" stagger={0.12}>
          <RevealItem className="lg:col-span-2">
            <div className="flex h-full flex-col justify-between rounded-[1.75rem] bg-ink p-9 text-ink-foreground">
              <div>
                <h3 className="font-semibold">Premier dossier</h3>
                <p className="mt-3 text-5xl font-bold tracking-tight">
                  39 €
                  <span className="ml-2 text-base font-normal text-ink-muted">
                    tout compris
                  </span>
                </p>
                <p className="mt-4 leading-relaxed text-ink-muted">
                  Dossier complet, relances, mise en demeure, suivi 90 jours et
                  export. Sans abonnement. Remboursé si aucune relance n’est
                  générée.
                </p>
              </div>
              <PillCta href="/nouveau" className="mt-9 justify-center">
                {CTA_LABEL}
              </PillCta>
            </div>
          </RevealItem>
          <RevealItem className="lg:col-span-3">
            <div className="flex h-full flex-col overflow-hidden rounded-[1.75rem] border bg-card">
              {plans.map((p) => (
                <div
                  key={p.nom}
                  className="flex flex-1 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b px-8 py-6 transition-colors duration-300 hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <h3 className="font-semibold">{p.nom}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {p.detail}
                    </p>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">
                    {p.prix}
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      HT/mois
                    </span>
                  </p>
                </div>
              ))}
              <p className="bg-muted/50 px-8 py-4 text-[13px] leading-relaxed text-muted-foreground">
                Moins 20 % en facturation annuelle. Recommandés facturés au
                réel (environ 12 €). Vos données s’exportent à tout moment,
                même après résiliation.
              </p>
            </div>
          </RevealItem>
        </RevealStagger>
      </div>
    </section>
  );
}

function Faq() {
  const questions = [
    {
      q: "Est-ce que BLEME est un avocat ?",
      r: "Non. BLEME organise, rédige des brouillons et suit vos démarches. Pour un conseil juridique personnalisé, consultez un avocat. Le jour venu, votre dossier BLEME lui fera gagner un temps précieux.",
    },
    {
      q: "Est-ce légal d’envoyer une mise en demeure moi-même ?",
      r: "Oui. Tout créancier peut mettre en demeure son débiteur. BLEME prépare le courrier selon les usages, vous le relisez et l’envoyez en votre nom.",
    },
    {
      q: "Et si le client conteste la facture ?",
      r: "Sa réponse arrive dans le dossier, l’IA la résume et vous aide à documenter votre position : preuves à ajouter, points de vigilance. Si ça se durcit, vous exportez tout pour un professionnel.",
    },
    {
      q: "Où sont mes données ?",
      r: "En Europe. Export complet à tout moment, suppression sur demande, aucune revente, aucun entraînement d’IA sur vos dossiers.",
    },
    {
      q: "Il y a un engagement ?",
      r: "Non. Premier dossier sans abonnement, abonnements sans engagement, export libre même après départ.",
    },
  ];
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-6 py-24 lg:py-32">
      <Reveal>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Questions fréquentes
        </h2>
      </Reveal>
      <RevealStagger className="mt-10" stagger={0.06}>
        {questions.map((item) => (
          <RevealItem key={item.q}>
            <details className="group border-t py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="text-xl font-light text-muted-foreground transition-transform duration-500 ease-fluid group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-[65ch] leading-relaxed text-muted-foreground">
                {item.r}
              </p>
            </details>
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-brand text-brand-foreground">
      <div aria-hidden className="absolute -left-24 -top-32 size-[24rem] rounded-full bg-white/10 blur-[100px]" />
      <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-8 px-6 py-24 lg:flex-row lg:items-center lg:justify-between">
        <Reveal>
          <h2 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
            Votre plus vieux blème a déjà trop attendu.
          </h2>
          <p className="mt-3 text-lg opacity-90">
            Dans 15 minutes, la première relance est partie.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <PillCta href="/nouveau" tone="light" className="shrink-0">
            {CTA_LABEL}
          </PillCta>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>
          <span className="font-semibold text-foreground">BLEME</span> · Vos
          blèmes de pro, pris au sérieux.
        </p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <a href="#tarifs" className="transition-colors duration-300 hover:text-foreground">
            Tarifs
          </a>
          <a href="#faq" className="transition-colors duration-300 hover:text-foreground">
            FAQ
          </a>
          <Link href="/mentions-legales" className="transition-colors duration-300 hover:text-foreground">
            Mentions légales
          </Link>
          <Link href="/confidentialite" className="transition-colors duration-300 hover:text-foreground">
            Confidentialité
          </Link>
        </nav>
      </div>
    </footer>
  );
}
