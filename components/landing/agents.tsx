/* eslint-disable @next/next/no-img-element */
import { Database } from "lucide-react";
import { Reveal, RevealItem, RevealStagger } from "@/components/landing/reveal";

/*
 * « Votre équipe IA, au complet » : fiches de personnage des agents
 * spécialisés — avatar pixel art, jauges de maîtrise, sources de données
 * connectées. Chaque agent correspond à un module réel du pipeline
 * (docs/07-agents-ia.md).
 */

type Skill = { label: string; niveau: 4 | 5 };

type Agent = {
  prenom: string;
  role: string;
  avatar: string;
  expertise: string;
  skills: Skill[];
  sources: string[];
  soon?: boolean;
};

const AGENTS: Agent[] = [
  {
    prenom: "Marius",
    role: "Agent Impayés",
    avatar: "/agents/marius.png",
    expertise:
      "Expert du recouvrement amiable. Il cadence les relances, chiffre indemnités et intérêts, et tient la mise en demeure prête au bon moment.",
    skills: [
      { label: "Recouvrement amiable", niveau: 5 },
      { label: "Délais et pénalités légales", niveau: 5 },
    ],
    sources: ["Légifrance · Code de commerce", "Taux et indemnités légaux", "Modèles éprouvés BLEME"],
  },
  {
    prenom: "Léna",
    role: "Agente Litiges",
    avatar: "/agents/lena.png",
    expertise:
      "Experte de la contestation client. Elle reconstitue la chronologie, répond point par point et rend le dossier inattaquable.",
    skills: [
      { label: "Droit des contrats", niveau: 5 },
      { label: "Argumentation documentée", niveau: 4 },
    ],
    sources: ["Judilibre · Cour de cassation", "Légifrance · Code civil", "Dossiers types litiges"],
  },
  {
    prenom: "Jeanne",
    role: "Agente Avocat du diable",
    avatar: "/agents/jeanne.png",
    expertise:
      "Experte du contre-argument. Elle cherche ce que l’autre partie pourrait répondre et pointe les faiblesses avant qu’elles ne coûtent.",
    skills: [
      { label: "Analyse contradictoire", niveau: 5 },
      { label: "Détection des angles morts", niveau: 5 },
    ],
    sources: ["Jurisprudence contradictoire", "Moyens de défense recensés", "Récits des deux parties"],
  },
  {
    prenom: "Nora",
    role: "Agente Preuves",
    avatar: "/agents/nora.png",
    expertise:
      "Experte du classement. Elle lit factures, emails, WhatsApp et photos, en extrait montants et dates, et repère ce qui manque au dossier.",
    skills: [
      { label: "Lecture multi-format", niveau: 5 },
      { label: "Extraction montants et dates", niveau: 4 },
    ],
    sources: ["Vision + OCR multi-format", "Exports WhatsApp et emails", "Référentiel de pièces BLEME"],
  },
  {
    prenom: "Sacha",
    role: "Agent Vigie",
    avatar: "/agents/sacha.png",
    expertise:
      "Expert du suivi. Il surveille échéances et réponses adverses, réveille les dossiers qui s’endorment et prépare la prochaine action.",
    skills: [
      { label: "Délais et prescription", niveau: 5 },
      { label: "Cadences de relance", niveau: 5 },
    ],
    sources: ["Prescription et délais légaux", "Suivi recommandés et AR", "Cadences éprouvées BLEME"],
  },
  {
    prenom: "Basile",
    role: "Agent Impôts & démarches",
    avatar: "/agents/basile.png",
    expertise:
      "Expert du dialogue avec l’administration. Il identifie les motifs de contestation ou de remise gracieuse, rédige le courrier motivé et relance si le silence dure.",
    skills: [
      { label: "Doctrine fiscale", niveau: 4 },
      { label: "Procédures administratives", niveau: 4 },
    ],
    sources: ["BOFiP · doctrine fiscale", "Code général des impôts", "Livre des procédures fiscales"],
    soon: true,
  },
];

function SkillBar({ skill }: { skill: Skill }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-ink-muted">{skill.label}</span>
      <span className="flex shrink-0 gap-1" aria-label={`${skill.label} : niveau ${skill.niveau} sur 5`}>
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={
              i < skill.niveau
                ? "h-1.5 w-4 rounded-full bg-brand"
                : "h-1.5 w-4 rounded-full bg-white/10"
            }
          />
        ))}
      </span>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className="group flex h-full flex-col rounded-[1.75rem] bg-ink p-7 text-ink-foreground transition-all duration-500 ease-fluid hover:-translate-y-1 hover:shadow-xl hover:shadow-zinc-950/[0.25]">
      <div className="flex items-start justify-between">
        <span className="flex size-[4.5rem] items-center justify-center overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-white/10 transition-transform duration-500 ease-fluid group-hover:-rotate-3 group-hover:scale-105">
          <img
            src={agent.avatar}
            alt={`Avatar pixel art de ${agent.prenom}, ${agent.role}`}
            width={64}
            height={64}
            className="size-16 [image-rendering:pixelated]"
          />
        </span>
        {agent.soon ? (
          <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-medium text-brand-foreground">
            Bientôt
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium text-ink-foreground/80 ring-1 ring-white/10">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70 motion-reduce:hidden" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
            En service
          </span>
        )}
      </div>

      <h3 className="mt-4 text-xl font-bold tracking-tight">{agent.prenom}</h3>
      <p className="mt-0.5 text-sm font-semibold text-brand">{agent.role}</p>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-muted">
        {agent.expertise}
      </p>

      {/* Niveaux de maîtrise */}
      <div className="mt-5 space-y-2 border-t border-white/10 pt-4">
        {agent.skills.map((s) => (
          <SkillBar key={s.label} skill={s} />
        ))}
      </div>

      {/* Sources connectées */}
      <div className="mt-4 border-t border-white/10 pt-4">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          <Database className="size-3" />
          Branché sur
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {agent.sources.map((src) => (
            <span
              key={src}
              className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-ink-foreground/75 ring-1 ring-white/10"
            >
              {src}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AgentsTeam() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Votre équipe IA, au complet.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Pas un chatbot généraliste : des agents spécialisés, chacun branché
            sur ses sources et entraîné sur son front. Ensemble, ils couvrent
            tout le blème, du premier récit jusqu’au paiement.
          </p>
        </div>
      </Reveal>

      <RevealStagger className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AGENTS.map((agent) => (
          <RevealItem key={agent.prenom}>
            <AgentCard agent={agent} />
          </RevealItem>
        ))}
      </RevealStagger>

      <Reveal delay={0.2}>
        <p className="mx-auto mt-10 max-w-2xl text-center text-[13px] leading-relaxed text-muted-foreground/80">
          Des agents spécialisés, pas des oracles : chacun prépare, classe et
          propose. Rien ne part sans votre validation, et aucun ne prédit une
          décision de justice.
        </p>
      </Reveal>
    </section>
  );
}
