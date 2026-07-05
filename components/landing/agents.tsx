import { Reveal, RevealItem, RevealStagger } from "@/components/landing/reveal";

/*
 * « Votre équipe IA, au complet » : personas des agents spécialisés,
 * façon équipe d'employés IA. Chaque agent correspond à un module réel
 * du pipeline (docs/07-agents-ia.md), personnifié pour la landing.
 */

type Agent = {
  prenom: string;
  role: string;
  expertise: string;
  chips: string[];
  gradient: string;
  soon?: boolean;
};

const AGENTS: Agent[] = [
  {
    prenom: "Marius",
    role: "Agent Impayés",
    expertise:
      "Expert du recouvrement amiable. Il cadence les relances, chiffre indemnités et intérêts, et tient la mise en demeure prête au bon moment.",
    chips: ["Relances cadencées", "Mise en demeure", "Indemnité 40 €"],
    gradient: "linear-gradient(135deg, oklch(0.62 0.15 41), oklch(0.44 0.13 41))",
  },
  {
    prenom: "Léna",
    role: "Agente Litiges",
    expertise:
      "Experte de la contestation client. Elle reconstitue la chronologie, répond point par point et rend le dossier inattaquable.",
    chips: ["Chronologie", "Réponse circonstanciée", "Dossier béton"],
    gradient: "linear-gradient(135deg, oklch(0.5 0.12 30), oklch(0.3 0.05 280))",
  },
  {
    prenom: "Jeanne",
    role: "Agente Avocat du diable",
    expertise:
      "Experte du contre-argument. Elle cherche ce que l’autre partie pourrait répondre et pointe les faiblesses avant qu’elles ne coûtent.",
    chips: ["Points de vigilance", "Anticipation", "La question qui fâche"],
    gradient: "linear-gradient(135deg, oklch(0.35 0.06 280), oklch(0.2 0.02 260))",
  },
  {
    prenom: "Nora",
    role: "Agente Preuves",
    expertise:
      "Experte du classement. Elle lit factures, emails, WhatsApp et photos, en extrait montants et dates, et repère ce qui manque au dossier.",
    chips: ["Extraction", "Classement", "Score de complétude"],
    gradient: "linear-gradient(135deg, oklch(0.7 0.12 55), oklch(0.5 0.14 41))",
  },
  {
    prenom: "Sacha",
    role: "Agent Vigie",
    expertise:
      "Expert du suivi. Il surveille échéances et réponses adverses, réveille les dossiers qui s’endorment et prépare la prochaine action.",
    chips: ["Échéances", "Réponses adverses", "Rappels"],
    gradient: "linear-gradient(135deg, oklch(0.55 0.1 50), oklch(0.28 0.04 270))",
  },
  {
    prenom: "Basile",
    role: "Agent Impôts & démarches",
    expertise:
      "Expert du dialogue avec l’administration. Il identifie les motifs de contestation ou de remise gracieuse, rédige le courrier motivé et relance si le silence dure.",
    chips: ["Contestation d’amende", "Demande gracieuse", "Relance auto"],
    gradient: "linear-gradient(135deg, oklch(0.45 0.09 41), oklch(0.25 0.03 260))",
    soon: true,
  },
];

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className="group flex h-full flex-col rounded-[1.75rem] bg-ink p-7 text-ink-foreground transition-all duration-500 ease-fluid hover:-translate-y-1 hover:shadow-xl hover:shadow-zinc-950/[0.25]">
      <div className="flex items-start justify-between">
        {/* Avatar */}
        <div className="relative">
          <span
            className="flex size-16 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] transition-transform duration-500 ease-fluid group-hover:-rotate-3 group-hover:scale-105"
            style={{ background: agent.gradient }}
            aria-hidden
          >
            {agent.prenom[0]}
          </span>
        </div>
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

      <h3 className="mt-5 text-xl font-bold tracking-tight">{agent.prenom}</h3>
      <p className="mt-0.5 text-sm font-semibold text-brand">{agent.role}</p>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-muted">
        {agent.expertise}
      </p>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {agent.chips.map((chip) => (
          <span
            key={chip}
            className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-ink-foreground/70 ring-1 ring-white/10"
          >
            {chip}
          </span>
        ))}
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
            Chaque agent est spécialisé sur un front précis. Ensemble, ils
            couvrent tout le blème, du premier récit jusqu’au paiement.
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
