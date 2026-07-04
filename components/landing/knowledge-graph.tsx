import {
  BookMarked,
  BookOpenText,
  Gavel,
  Landmark,
  Newspaper,
  Percent,
} from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

/*
 * « Branchée sur le savoir juridique public » : hub animé, les sources
 * officielles convergent vers le cœur BLEME. Faisceaux SVG + impulsions
 * SMIL (aucun JS), désactivées en reduced-motion. Sur mobile : cœur +
 * grille de sources, sans diagramme.
 */

const SOURCES = [
  { icon: BookOpenText, titre: "Codes en vigueur", detail: "Légifrance, à jour en continu", side: "left", slot: 0 },
  { icon: Gavel, titre: "Jurisprudence judiciaire", detail: "décisions publiées des tribunaux", side: "left", slot: 1 },
  { icon: Landmark, titre: "Jurisprudence administrative", detail: "Conseil d’État et cours", side: "left", slot: 2 },
  { icon: Newspaper, titre: "Journal officiel", detail: "lois, décrets, barèmes", side: "right", slot: 0 },
  { icon: Percent, titre: "Taux et indemnités légaux", detail: "intérêt légal, indemnité de 40 €", side: "right", slot: 1 },
  { icon: BookMarked, titre: "Modèles éprouvés", detail: "courriers conformes aux usages", side: "right", slot: 2 },
] as const;

// Géométrie du diagramme (viewBox 1000 × 520).
const SLOT_Y = [90, 260, 430];
const LEFT_X = 190;
const RIGHT_X = 810;
const CORE = { x: 500, y: 260 };

function beamPath(side: "left" | "right", slot: number): string {
  const x = side === "left" ? LEFT_X : RIGHT_X;
  const y = SLOT_Y[slot];
  const cx = side === "left" ? 380 : 620;
  return `M ${x} ${y} C ${cx} ${y}, ${cx} ${CORE.y}, ${CORE.x} ${CORE.y}`;
}

export function KnowledgeGraph() {
  return (
    <section className="relative overflow-hidden bg-ink text-ink-foreground">
      <div aria-hidden className="absolute left-1/2 top-1/2 size-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/15 blur-[140px]" />

      <div className="relative mx-auto max-w-6xl px-6 py-24 lg:py-32">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Branchée sur le savoir juridique public.
            </h2>
            <p className="mt-4 text-lg text-ink-muted">
              Codes, jurisprudence des tribunaux, Journal officiel : les
              sources officielles convergent dans l’IA de BLEME et se
              condensent dans vos dossiers.
            </p>
          </div>
        </Reveal>

        {/* Diagramme desktop */}
        <Reveal delay={0.15} className="relative mt-6 hidden lg:block">
          <div className="relative mx-auto h-[520px] max-w-5xl">
            <svg
              aria-hidden
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 1000 520"
              preserveAspectRatio="none"
            >
              {SOURCES.map((s) => (
                <path
                  key={`p-${s.titre}`}
                  d={beamPath(s.side, s.slot)}
                  fill="none"
                  stroke="oklch(1 0 0 / 0.09)"
                  strokeWidth="1.5"
                />
              ))}
              <g className="motion-reduce:hidden">
                {SOURCES.map((s, i) => (
                  <circle key={`d-${s.titre}`} r="3.5" fill="var(--brand)">
                    <animateMotion
                      dur="2.8s"
                      begin={`${i * 0.45}s`}
                      repeatCount="indefinite"
                      path={beamPath(s.side, s.slot)}
                    />
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      keyTimes="0;0.15;0.8;1"
                      dur="2.8s"
                      begin={`${i * 0.45}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                ))}
              </g>
            </svg>

            {/* Cœur BLEME */}
            <div
              className="absolute z-[1] -translate-x-1/2 -translate-y-1/2"
              style={{ left: "50%", top: "50%" }}
            >
              <span aria-hidden className="anim-ring absolute inset-0 rounded-full border border-brand/50" />
              <span aria-hidden className="anim-ring absolute inset-0 rounded-full border border-brand/40 [animation-delay:1.1s]" />
              <div className="relative flex size-36 flex-col items-center justify-center rounded-full bg-gradient-to-b from-brand to-brand-strong text-brand-foreground shadow-[0_0_60px_-10px_var(--brand)]">
                <span className="text-xl font-bold tracking-tight">
                  BLEME<span className="opacity-70">.</span>
                </span>
                <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] opacity-80">
                  IA juridique
                </span>
              </div>
            </div>

            {/* Nœuds sources */}
            {SOURCES.map((s) => (
              <div
                key={s.titre}
                className="absolute z-[1] w-64 -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${((s.side === "left" ? LEFT_X : RIGHT_X) / 1000) * 100}%`,
                  top: `${(SLOT_Y[s.slot] / 520) * 100}%`,
                }}
              >
                <div className="flex items-start gap-3.5 rounded-2xl bg-white/[0.06] px-5 py-4 ring-1 ring-white/10 backdrop-blur-sm transition-all duration-500 ease-fluid hover:-translate-y-0.5 hover:bg-white/[0.09] hover:ring-brand/50">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                    <s.icon className="size-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{s.titre}</span>
                    <span className="block text-xs leading-relaxed text-ink-muted">
                      {s.detail}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Version mobile : cœur + grille */}
        <div className="mt-12 lg:hidden">
          <div className="mx-auto w-max">
            <div className="relative">
              <span aria-hidden className="anim-ring absolute inset-0 rounded-full border border-brand/50" />
              <div className="relative flex size-28 flex-col items-center justify-center rounded-full bg-gradient-to-b from-brand to-brand-strong text-brand-foreground shadow-[0_0_50px_-10px_var(--brand)]">
                <span className="text-lg font-bold tracking-tight">
                  BLEME<span className="opacity-70">.</span>
                </span>
                <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.16em] opacity-80">
                  IA juridique
                </span>
              </div>
            </div>
          </div>
          <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SOURCES.map((s) => (
              <li
                key={s.titre}
                className="flex items-start gap-3.5 rounded-2xl bg-white/[0.06] px-5 py-4 ring-1 ring-white/10"
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                  <s.icon className="size-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{s.titre}</span>
                  <span className="block text-xs leading-relaxed text-ink-muted">
                    {s.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Reveal delay={0.25}>
          <div className="mt-12 text-center">
            <p className="text-sm text-ink-muted">
              Alimentée par les API publiques officielles : Légifrance (PISTE),
              Judilibre (Cour de cassation), DILA.
            </p>
            <p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed text-ink-muted/70">
              Information générale issue de sources publiques, intégrée aux
              modèles de courriers. Ce n’est pas un conseil juridique
              personnalisé.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
