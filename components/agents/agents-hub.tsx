import { FileCheck2 } from "lucide-react";
import { AGENTS } from "@/lib/agents/data";
import { Reveal } from "@/components/landing/reveal";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";

/*
 * Chapeau de la page /agents : « une vraie équipe, un seul interlocuteur ».
 * Graphe animé façon constellation (knowledge-graph) : les 6 agents en arc
 * convergent vers le cœur BLEME, qui alimente votre dossier. SVG + SMIL,
 * aucun JavaScript, impulsions coupées avec prefers-reduced-motion.
 */

// Positions des agents (fractions du viewBox 1000 × 380), en arc.
const POS = [
  { x: 0.07, y: 0.3 },
  { x: 0.24, y: 0.18 },
  { x: 0.41, y: 0.12 },
  { x: 0.59, y: 0.12 },
  { x: 0.76, y: 0.18 },
  { x: 0.93, y: 0.3 },
] as const;

const VB = { w: 1000, h: 380 };
const CORE = { x: 500, y: 235 };
const DOSSIER = { x: 500, y: 345 };

function convergePath(i: number): string {
  const x = POS[i].x * VB.w;
  const y = POS[i].y * VB.h + 34; // départ juste sous la tuile
  const c1y = y + 70;
  const c2x = CORE.x + (x - CORE.x) * 0.25;
  return `M ${x} ${y} C ${x} ${c1y}, ${c2x} 172, ${CORE.x} ${CORE.y - 32}`;
}

const DOSSIER_PATH = `M ${CORE.x} ${CORE.y + 32} L ${DOSSIER.x} ${DOSSIER.y - 14}`;

export function AgentsHub() {
  return (
    <section className="relative overflow-hidden border-b bg-brand-soft/40">
      <div className="relative mx-auto max-w-6xl px-6 pb-4 pt-14 sm:pb-6 lg:pt-16">
        <Reveal onLoad>
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-white px-3.5 py-1.5 text-xs font-medium text-brand-strong">
              <span className="size-1.5 bg-brand" aria-hidden />
              L’équipe IA, au grand complet
            </span>
            {/* h2 : le h1 de la page reste le nom de l'agent */}
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Une vraie équipe travaille sur votre dossier.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Six spécialistes entraînés chacun sur son front, coordonnés comme
              les services d’une entreprise. Vous n’avez jamais à choisir à qui
              parler : tout converge dans BLEME, qui vous parle d’une seule
              voix.
            </p>
          </div>
        </Reveal>

        {/* Graphe de convergence */}
        <Reveal onLoad delay={0.12}>
          <div className="relative mx-auto mt-6 h-[240px] max-w-4xl sm:h-[300px] lg:h-[340px]">
            {/* Halo derrière le cœur */}
            <div
              aria-hidden
              className="absolute left-1/2 top-[62%] size-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/15 blur-3xl sm:size-56"
            />

            <svg
              aria-hidden
              className="absolute inset-0 h-full w-full"
              viewBox={`0 0 ${VB.w} ${VB.h}`}
              preserveAspectRatio="none"
            >
              {AGENTS.map((_, i) => (
                <path
                  key={i}
                  d={convergePath(i)}
                  fill="none"
                  stroke="var(--brand)"
                  strokeOpacity="0.3"
                  strokeWidth="1.5"
                />
              ))}
              <path
                d={DOSSIER_PATH}
                fill="none"
                stroke="var(--brand)"
                strokeOpacity="0.45"
                strokeWidth="1.5"
                strokeDasharray="3 5"
              />

              {/* Impulsions : le travail des agents converge vers BLEME… */}
              <g className="motion-reduce:hidden">
                {AGENTS.map((_, i) => (
                  <circle key={i} r="3.5" fill="var(--brand)">
                    <animateMotion
                      dur="3.2s"
                      begin={`${i * 0.55}s`}
                      repeatCount="indefinite"
                      path={convergePath(i)}
                    />
                    <animate
                      attributeName="opacity"
                      values="0;0.85;0.85;0"
                      keyTimes="0;0.15;0.8;1"
                      dur="3.2s"
                      begin={`${i * 0.55}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                ))}
                {/* …puis BLEME alimente votre dossier */}
                {[0, 1.6].map((begin) => (
                  <circle key={begin} r="3.5" fill="var(--brand)">
                    <animateMotion
                      dur="3.2s"
                      begin={`${begin}s`}
                      repeatCount="indefinite"
                      path={DOSSIER_PATH}
                    />
                    <animate
                      attributeName="opacity"
                      values="0;0.9;0.9;0"
                      keyTimes="0;0.2;0.8;1"
                      dur="3.2s"
                      begin={`${begin}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                ))}
              </g>
            </svg>

            {/* Les 6 agents en arc */}
            {AGENTS.map((agent, i) => (
              <div
                key={agent.slug}
                className="anim-load absolute z-[1] -translate-x-1/2 -translate-y-1/2 text-center"
                style={
                  {
                    left: `${POS[i].x * 100}%`,
                    top: `${POS[i].y * 100}%`,
                    "--delay": `${0.25 + i * 0.1}s`,
                  } as React.CSSProperties
                }
              >
                <span className="mx-auto flex size-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-white to-brand-soft shadow-lg shadow-zinc-950/[0.1] ring-1 ring-black/5 sm:size-14 sm:rounded-2xl">
                  <SpriteAvatar
                    src={agent.avatar}
                    alt=""
                    className="h-8 sm:h-11"
                    delay={i * -0.45}
                  />
                </span>
                <span className="mt-1.5 hidden text-[11px] font-medium text-muted-foreground sm:block">
                  {agent.prenom}
                </span>
                <span className="sr-only">{`${agent.prenom}, ${agent.role}`}</span>
              </div>
            ))}

            {/* Cœur BLEME */}
            <div
              className="absolute z-[1] -translate-x-1/2 -translate-y-1/2"
              style={{ left: "50%", top: `${(CORE.y / VB.h) * 100}%` }}
            >
              <div className="flex size-16 items-center justify-center rounded-full bg-white shadow-xl shadow-brand/20 ring-1 ring-black/5 sm:size-20">
                <div className="flex size-11 flex-col items-center justify-center rounded-full bg-gradient-to-b from-brand to-brand-strong text-brand-foreground sm:size-14">
                  <span className="text-sm font-bold tracking-tight sm:text-base">B.</span>
                </div>
              </div>
            </div>

            {/* Votre dossier, une seule interface */}
            <div
              className="absolute z-[1] -translate-x-1/2 -translate-y-1/2"
              style={{ left: "50%", top: `${(DOSSIER.y / VB.h) * 100}%` }}
            >
              <span className="flex items-center gap-2 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-xs font-medium text-white shadow-lg shadow-ink/20 sm:text-[13px]">
                <FileCheck2 className="size-3.5 text-brand" />
                Votre dossier, une seule interface
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
