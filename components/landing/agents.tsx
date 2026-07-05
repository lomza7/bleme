import Link from "next/link";
import { Armchair, ArrowRight, Check, Database } from "lucide-react";
import { AGENTS, type Agent, type AgentSkill } from "@/lib/agents/data";
import { CountUp } from "@/components/landing/count-up";
import { Reveal, RevealItem, RevealStagger } from "@/components/landing/reveal";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";

/*
 * « Votre équipe IA, au complet » : fiches de personnage des agents
 * spécialisés — avatar Petdex animé, jauges de maîtrise, sources de
 * données connectées. Chaque carte mène à la fiche /agents/[slug].
 * Données partagées : lib/agents/data.ts.
 */

export function SkillBar({ skill }: { skill: AgentSkill }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="truncate text-[11px] text-muted-foreground sm:text-xs">
        {skill.label}
      </span>
      <span className="flex shrink-0 gap-1" aria-label={`${skill.label} : niveau ${skill.niveau} sur 5`}>
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={
              i < skill.niveau
                ? "h-1.5 w-2.5 rounded-full bg-brand sm:w-3.5"
                : "h-1.5 w-2.5 rounded-full bg-muted sm:w-3.5"
            }
          />
        ))}
      </span>
    </div>
  );
}

export function AgentStatusBadge({ soon, compact }: { soon?: boolean; compact?: boolean }) {
  if (soon) {
    return (
      <span className={`rounded-full bg-brand font-medium text-brand-foreground ${compact ? "px-2 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-[11px]" : "px-2.5 py-1 text-[11px]"}`}>
        Bientôt
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 font-medium text-emerald-700 ring-1 ring-emerald-200 ${compact ? "px-2 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-[11px]" : "px-2.5 py-1 text-[11px]"}`}>
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60 motion-reduce:hidden" />
        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
      </span>
      En service
    </span>
  );
}

function AgentCard({ agent, index }: { agent: Agent; index: number }) {
  return (
    <Link
      href={`/agents/${agent.slug}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border bg-card p-4 transition-all duration-500 ease-fluid hover:-translate-y-1 hover:border-brand/40 hover:shadow-xl hover:shadow-brand/[0.08] sm:p-6"
    >
      {/* Halo discret qui s'allume au survol */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-brand/10 opacity-0 blur-2xl transition-opacity duration-700 group-hover:opacity-100"
      />

      <div className="relative flex items-start justify-between gap-2">
        <span
          className="anim-bob flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-brand-soft to-brand/15 ring-1 ring-brand/20 transition-transform duration-500 ease-fluid group-hover:-rotate-3 group-hover:scale-110 sm:size-[4.5rem]"
          style={{ "--delay": `${index * 0.4}s` } as React.CSSProperties}
        >
          <SpriteAvatar
            src={agent.avatar}
            alt={`Avatar pixel art de ${agent.prenom}, ${agent.role}`}
            className="h-12 sm:h-16"
            delay={index * -0.45}
          />
        </span>
        <AgentStatusBadge soon={agent.soon} compact />
      </div>

      <h3 className="relative mt-3 text-lg font-bold tracking-tight sm:mt-4 sm:text-xl">
        {agent.prenom}
      </h3>
      <p className="relative mt-0.5 text-[13px] font-semibold text-brand-strong sm:text-sm">
        {agent.role}
      </p>
      <p className="relative mt-2.5 hidden flex-1 text-sm leading-relaxed text-muted-foreground sm:block">
        {agent.expertise}
      </p>

      {/* Les 2 chiffres les plus parlants (détail complet sur la fiche) */}
      <div className="relative mt-3 flex-1 space-y-2 border-t pt-3 sm:mt-5 sm:flex-none sm:space-y-2.5 sm:pt-4">
        {agent.stats.slice(0, 2).map((stat) => (
          <div key={stat.label} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span className="shrink-0 text-lg font-bold tabular-nums tracking-tight text-brand-strong sm:text-xl">
              {stat.valeur !== undefined ? (
                <CountUp value={stat.valeur} suffix={stat.suffixe ?? ""} />
              ) : (
                stat.chiffre
              )}
            </span>
            <span className="min-w-0 flex-1 basis-28 text-[11px] leading-snug text-muted-foreground sm:text-xs">
              {stat.court ?? stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Sources connectées */}
      <div className="relative mt-3 border-t pt-3 sm:mt-4 sm:pt-4">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px]">
          <Database className="size-3 text-brand-strong" />
          Branché sur
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {agent.sources.map((src, i) => (
            <span
              key={src}
              className={`rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-black/5 sm:px-2.5 sm:py-1 sm:text-[11px] ${i > 1 ? "hidden sm:inline" : ""}`}
            >
              {src}
            </span>
          ))}
        </div>
      </div>

      {/* Lien vers la fiche */}
      <p className="relative mt-3 flex items-center gap-1.5 border-t pt-3 text-[13px] font-medium text-brand-strong sm:mt-4 sm:pt-4 sm:text-sm">
        <span>
          Voir sa fiche<span className="hidden sm:inline"> complète</span>
        </span>
        <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1 sm:size-4" />
      </p>
    </Link>
  );
}

export function AgentsTeam() {
  return (
    <section id="equipe" className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Votre équipe IA, au complet.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Pas un chatbot généraliste : des agents spécialisés, chacun branché
            sur ses sources et entraîné sur son front. Voici ce qui travaille
            pour vous en coulisses, du premier récit jusqu’au paiement.
          </p>
        </div>
      </Reveal>

      <RevealStagger className="mt-14 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {AGENTS.map((agent, i) => (
          <RevealItem key={agent.prenom}>
            <AgentCard agent={agent} index={i} />
          </RevealItem>
        ))}
      </RevealStagger>

      {/* Réassurance : l'équipe se coordonne seule */}
      <Reveal delay={0.15}>
        <div className="mt-10 grid grid-cols-1 items-center gap-8 rounded-[2rem] bg-brand-soft/60 p-8 ring-1 ring-brand/20 sm:p-10 lg:grid-cols-2">
          <div>
            <span className="flex size-11 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <Armchair className="size-5" />
            </span>
            <h3 className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">
              Et vous, dans tout ça ? Rien à piloter.
            </h3>
            <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">
              Vous ne parlez jamais à six agents : vous racontez votre blème
              une fois, et l’équipe se coordonne toute seule en coulisses.
              Cette page existe juste pour vous montrer ce qu’il y a sous le
              capot.
            </p>
          </div>
          <ul className="space-y-3">
            {[
              "Une seule interface : votre dossier, qui avance tout seul",
              "Les agents se passent le travail entre eux, sans vous solliciter",
              "Vous n’intervenez que pour l’essentiel : relire et valider",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-2xl bg-white px-5 py-4 text-[15px] shadow-sm ring-1 ring-black/5"
              >
                <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal delay={0.2}>
        <p className="mx-auto mt-8 max-w-2xl text-center text-[13px] leading-relaxed text-muted-foreground/80">
          Des agents spécialisés, pas des oracles : chacun prépare, classe et
          propose. Rien ne part sans votre validation, et aucun ne prédit une
          décision de justice.
        </p>
      </Reveal>
    </section>
  );
}
