import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookMarked,
  Check,
  Database,
  FileText,
  FolderCheck,
  Mail,
  MessagesSquare,
  Percent,
  Scale,
  ScanSearch,
  ShieldCheck,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { AGENTS, getAgent, type AgentStat, type SavoirIcone } from "@/lib/agents/data";
import { AgentStatusBadge, SkillBar } from "@/components/landing/agents";
import { CountUp } from "@/components/landing/count-up";
import { Reveal, RevealItem, RevealStagger } from "@/components/landing/reveal";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";
import { JsonLd } from "@/components/seo/json-ld";

/*
 * Fiche agent /agents/[slug] : bandeau de sélection de l'équipe, identité,
 * grands chiffres (réels : textes de loi, délais légaux, règles produit),
 * mission en 3 temps, mur de savoir façon « encarts preuves » (cartes
 * blanches + tuile d'icône flottante), garde-fous. Contenu : lib/agents/data.ts.
 */

const BASE = "https://bleme-two.vercel.app";

const ICONES: Record<SavoirIcone, LucideIcon> = {
  code: BookMarked,
  tribunal: Scale,
  pourcent: Percent,
  modeles: FileText,
  loupe: ScanSearch,
  messages: MessagesSquare,
  bouclier: ShieldCheck,
  horloge: Timer,
  courrier: Mail,
  dossier: FolderCheck,
};

export function generateStaticParams() {
  return AGENTS.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) return {};
  const title = `${agent.prenom}, ${agent.role} : l’équipe IA BLEME`;
  const description = agent.tagline;
  return {
    title,
    description,
    alternates: { canonical: `/agents/${agent.slug}` },
    openGraph: { title, description },
  };
}

function StatChiffre({ stat, className }: { stat: AgentStat; className?: string }) {
  if (stat.valeur !== undefined) {
    return <CountUp value={stat.valeur} suffix={stat.suffixe ?? ""} className={className} />;
  }
  return <span className={className}>{stat.chiffre}</span>;
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) notFound();

  const index = AGENTS.findIndex((a) => a.slug === agent.slug);
  const precedent = AGENTS[(index + AGENTS.length - 1) % AGENTS.length];
  const suivant = AGENTS[(index + 1) % AGENTS.length];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Accueil", item: `${BASE}/` },
            { "@type": "ListItem", position: 2, name: "L’équipe IA", item: `${BASE}/agents/marius` },
            { "@type": "ListItem", position: 3, name: `${agent.prenom}, ${agent.role}`, item: `${BASE}/agents/${agent.slug}` },
          ],
        }}
      />

      {/* En-tête */}
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-5">
            <Link href="/" className="text-lg font-bold tracking-tight">
              BLEME<span className="text-brand">.</span>
            </Link>
            <Link
              href="/#equipe"
              className="hidden items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              <ArrowLeft className="size-3.5" />
              Retour au site
            </Link>
          </div>
          <Link
            href="/nouveau"
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
          >
            Créer mon dossier
          </Link>
        </div>
      </header>

      {/* Bandeau équipe : les 6 agents, l'actif en évidence */}
      <nav aria-label="Choisir un agent" className="border-b bg-muted/40">
        <div className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-6 py-4">
          {AGENTS.map((a, i) => {
            const actif = a.slug === agent.slug;
            return (
              <Link
                key={a.slug}
                href={`/agents/${a.slug}`}
                aria-current={actif ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 text-sm transition-all duration-300 ease-fluid ${
                  actif
                    ? "bg-ink text-white shadow-md shadow-ink/20"
                    : "bg-white text-muted-foreground ring-1 ring-black/5 hover:text-foreground hover:ring-brand/30"
                }`}
              >
                <span
                  className={`flex size-9 items-center justify-center overflow-hidden rounded-full ${
                    actif ? "bg-white/15" : "bg-brand-soft"
                  }`}
                >
                  <SpriteAvatar
                    src={a.avatar}
                    alt=""
                    className="h-7"
                    delay={i * -0.45}
                  />
                </span>
                <span className="font-medium">{a.prenom}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <main>
        {/* Identité + grands chiffres */}
        <section className="relative overflow-hidden border-b">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[52rem] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl"
          />
          <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-14 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:py-20">
            <Reveal onLoad>
              <div className="flex flex-col items-start gap-6 sm:flex-row sm:gap-8">
                <span className="anim-bob flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-[1.75rem] bg-gradient-to-b from-brand-soft to-brand/15 ring-1 ring-brand/20 sm:size-36">
                  <SpriteAvatar
                    src={agent.avatar}
                    alt={`Avatar pixel art de ${agent.prenom}, ${agent.role}`}
                    className="h-24 sm:h-[7.5rem]"
                  />
                </span>
                <div className="min-w-0">
                  <AgentStatusBadge soon={agent.soon} />
                  <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
                    {agent.prenom}
                  </h1>
                  <p className="mt-1 text-lg font-semibold text-brand-strong">
                    {agent.role}
                  </p>
                  <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
                    {agent.tagline}
                  </p>
                  <div className="mt-6 max-w-sm space-y-2">
                    {agent.skills.map((s) => (
                      <SkillBar key={s.label} skill={s} />
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal onLoad delay={0.12}>
              <dl className="grid h-full grid-cols-1 content-center gap-3">
                {agent.stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-baseline gap-5 rounded-[1.5rem] border bg-card px-6 py-4"
                  >
                    <dt className="sr-only">{stat.label}</dt>
                    <dd className="order-first shrink-0 text-3xl font-bold tabular-nums tracking-tight text-brand-strong sm:text-4xl">
                      <StatChiffre stat={stat} />
                    </dd>
                    <dd className="text-[13px] leading-snug text-muted-foreground sm:text-sm">
                      {stat.label}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </section>

        {/* Mission en 3 temps */}
        <section className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <Reveal>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Ce que {agent.prenom} fait pour vous
            </h2>
          </Reveal>
          <RevealStagger className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {agent.mission.map((etape, i) => (
              <RevealItem key={etape.titre}>
                <div className="h-full rounded-[1.75rem] border bg-card p-6">
                  <span className="font-mono text-sm font-semibold text-brand">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2.5 font-semibold leading-snug">{etape.titre}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {etape.detail}
                  </p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </section>

        {/* Mur de savoir */}
        <section className="border-y bg-muted/60">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
            <Reveal>
              <div className="max-w-2xl">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
                  <Database className="size-3.5" />
                  Branché sur, en continu
                </p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                  Le savoir derrière {agent.prenom}.
                </h2>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  Pas une mémoire figée : des corpus de référence consultés à
                  chaque dossier, avec les articles, les délais et les montants
                  exacts. Voici ce qu’il y a dans sa bibliothèque.
                </p>
              </div>
            </Reveal>

            <RevealStagger className="mt-12 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2">
              {agent.savoir.map((s, i) => {
                const Icone = ICONES[s.icone];
                const gauche = i % 2 === 0;
                return (
                  <RevealItem key={s.titre}>
                    <div className="relative h-full">
                      <span
                        className={`absolute -top-5 z-[1] flex size-14 items-center justify-center rounded-2xl bg-white shadow-lg shadow-zinc-950/[0.12] ring-1 ring-black/5 ${
                          gauche ? "-left-2 -rotate-6 lg:-left-5" : "-right-2 rotate-6 lg:-right-5"
                        }`}
                      >
                        <Icone className="size-7 text-brand-strong" />
                      </span>
                      <div className="flex h-full flex-col rounded-3xl bg-white p-6 shadow-xl shadow-zinc-950/[0.06] ring-1 ring-black/5 sm:p-7">
                        <span className="self-start rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand-strong">
                          {s.corpus}
                        </span>
                        <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
                          <StatChiffre stat={s.stat} />
                        </p>
                        <p className="mt-1 text-[13px] font-medium text-muted-foreground">
                          {s.stat.label}
                        </p>
                        <h3 className="mt-5 border-t pt-4 font-semibold leading-snug">
                          {s.titre}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {s.description}
                        </p>
                      </div>
                    </div>
                  </RevealItem>
                );
              })}
            </RevealStagger>
          </div>
        </section>

        {/* Garde-fous */}
        <section className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <Reveal>
            <div className="grid grid-cols-1 items-center gap-8 rounded-[2rem] bg-ink p-8 text-white sm:p-10 lg:grid-cols-2">
              <div>
                <span className="flex size-11 items-center justify-center rounded-full bg-brand text-brand-foreground">
                  <ShieldCheck className="size-5" />
                </span>
                <h2 className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">
                  Un expert, pas un oracle.
                </h2>
                <p className="mt-3 max-w-md leading-relaxed text-white/70">
                  {agent.prenom} prépare, chiffre et propose, toujours sur des faits
                  sourcés. Ce qu’il ne fera jamais : envoyer quoi que ce soit à
                  votre place, ou prédire une décision de justice.
                </p>
              </div>
              <ul className="space-y-3">
                {[
                  "Rien ne part sans votre validation, tracée noir sur blanc",
                  "Chaque affirmation est sourcée, sinon marquée « à confirmer »",
                  "Vos corrections priment toujours sur ses extractions",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 rounded-2xl bg-white/10 px-5 py-4 text-[15px] ring-1 ring-white/10"
                  >
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                    <span className="text-white/85">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </section>

        {/* Navigation entre agents + CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { a: precedent, label: "Agent précédent", icone: "gauche" as const },
              { a: suivant, label: "Agent suivant", icone: "droite" as const },
            ].map(({ a, label, icone }) => (
              <Link
                key={label}
                href={`/agents/${a.slug}`}
                className={`group flex items-center gap-4 rounded-[1.75rem] border bg-card p-5 transition-all duration-500 ease-fluid hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg hover:shadow-brand/[0.06] ${
                  icone === "droite" ? "sm:flex-row-reverse sm:text-right" : ""
                }`}
              >
                <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-brand-soft to-brand/15 ring-1 ring-brand/20">
                  <SpriteAvatar src={a.avatar} alt="" className="h-11" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {icone === "gauche" && <ArrowLeft className="size-3 transition-transform duration-300 group-hover:-translate-x-0.5" />}
                    {label}
                    {icone === "droite" && <ArrowRight className="size-3 transition-transform duration-300 group-hover:translate-x-0.5" />}
                  </span>
                  <span className="mt-0.5 block truncate font-semibold">
                    {a.prenom} · {a.role}
                  </span>
                </span>
              </Link>
            ))}
          </div>

          <Reveal delay={0.1}>
            <div className="mt-10 flex flex-col items-center gap-4 rounded-[2rem] bg-brand-soft/60 px-8 py-10 text-center ring-1 ring-brand/20">
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Mettez {agent.prenom} au travail.
              </h2>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                Racontez votre blème une fois : l’équipe s’organise, vous
                validez. Le premier dossier se crée en quelques minutes.
              </p>
              <Link
                href="/nouveau"
                className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
              >
                Créer mon dossier
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p>
            <span className="font-semibold text-foreground">BLEME</span> · Vos
            blèmes de pro, pris au sérieux.
          </p>
          <p className="text-xs text-muted-foreground/80">
            Information générale, pas un conseil juridique personnalisé.
          </p>
        </div>
      </footer>
    </div>
  );
}
