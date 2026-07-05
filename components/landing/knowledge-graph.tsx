import {
  BookOpenText,
  Gavel,
  Landmark,
  Newspaper,
  Percent,
  ScrollText,
} from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

/*
 * « Branchée sur le savoir juridique public » : constellation lumineuse à
 * la Stitch. Fond crème, cœur BLEME rayonnant, fines courbes qui filent
 * vers les bords, tuiles-icônes flottantes, wordmarks des institutions en
 * pied. SVG + SMIL + CSS, aucun JavaScript.
 */

// Tuiles-icônes dispersées (fractions du viewBox 1200 × 560).
const TILES = [
  { icon: BookOpenText, label: "Codes en vigueur", x: 0.2, y: 0.28, delay: 0 },
  { icon: Gavel, label: "Jurisprudence judiciaire", x: 0.115, y: 0.52, delay: 0.4 },
  { icon: Landmark, label: "Jurisprudence administrative", x: 0.265, y: 0.74, delay: 0.8 },
  { icon: Newspaper, label: "Journal officiel", x: 0.8, y: 0.28, delay: 0.2 },
  { icon: Percent, label: "Taux et indemnités", x: 0.885, y: 0.52, delay: 0.6 },
  { icon: ScrollText, label: "Doctrine fiscale", x: 0.735, y: 0.74, delay: 1 },
] as const;

// Courbes rayonnant du cœur vers les bords (5 par côté).
const RAY_ENDS = [50, 165, 280, 395, 510];
const CORE = { x: 600, y: 280 };

function rayPath(side: "left" | "right", endY: number): string {
  const startX = side === "left" ? CORE.x - 64 : CORE.x + 64;
  const endX = side === "left" ? -40 : 1240;
  const c1x = side === "left" ? CORE.x - 240 : CORE.x + 240;
  const c2x = side === "left" ? 260 : 940;
  return `M ${startX} ${CORE.y} C ${c1x} ${CORE.y}, ${c2x} ${endY}, ${endX} ${endY}`;
}

const WORDMARKS = [
  "Légifrance",
  "Judilibre",
  "Cour de cassation",
  "Conseil d’État",
  "DILA",
  "BOFiP",
];

function FlagGlyph({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 overflow-hidden ${small ? "h-3 w-[18px] rounded-[2px]" : "h-5 w-7 rounded-[4px]"} ring-1 ring-black/10`}
    >
      <span className="h-full w-1/3 bg-[#000091]" />
      <span className="h-full w-1/3 bg-white" />
      <span className="h-full w-1/3 bg-[#E1000F]" />
    </span>
  );
}

export function KnowledgeGraph() {
  return (
    <section className="relative overflow-hidden bg-brand-soft/60">
      <div className="relative mx-auto max-w-6xl px-6 py-24 lg:py-28">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-white px-3.5 py-1.5 text-xs font-medium text-brand-strong">
              <span className="size-1.5 bg-brand" aria-hidden />
              Sources officielles françaises
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Branchée sur le savoir juridique public.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Codes, jurisprudence, Journal officiel, doctrine fiscale : tout
              converge dans l’IA de BLEME et se condense dans vos dossiers.
            </p>
          </div>
        </Reveal>

        {/* Constellation desktop */}
        <Reveal delay={0.15} className="relative">
          <div className="relative mx-auto h-[400px] sm:h-[480px] lg:h-[560px] max-w-6xl">
            {/* Halo central */}
            <div aria-hidden className="absolute left-1/2 top-1/2 size-[15rem] sm:size-[20rem] lg:size-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/15 blur-3xl" />
            <div aria-hidden className="absolute left-1/2 top-1/2 size-28 sm:size-36 lg:size-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/25 blur-2xl" />

            <svg
              aria-hidden
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 1200 560"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="rayLeft" x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.55" />
                  <stop offset="45%" stopColor="var(--brand)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="rayRight" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.55" />
                  <stop offset="45%" stopColor="var(--brand)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
                </linearGradient>
              </defs>

              {(["left", "right"] as const).map((side) =>
                RAY_ENDS.map((endY) => (
                  <path
                    key={`${side}-${endY}`}
                    d={rayPath(side, endY)}
                    fill="none"
                    stroke={side === "left" ? "url(#rayLeft)" : "url(#rayRight)"}
                    strokeWidth="1.5"
                  />
                )),
              )}

              {/* Impulsions discrètes remontant vers le cœur */}
              <g className="motion-reduce:hidden">
                {(["left", "right"] as const).map((side) =>
                  [0, 2, 4].map((idx, i) => (
                    <circle key={`${side}-p-${idx}`} r="3" fill="var(--brand)">
                      <animateMotion
                        dur="4s"
                        begin={`${i * 1.3 + (side === "right" ? 0.65 : 0)}s`}
                        repeatCount="indefinite"
                        keyPoints="1;0"
                        keyTimes="0;1"
                        path={rayPath(side, RAY_ENDS[idx])}
                      />
                      <animate
                        attributeName="opacity"
                        values="0;0.8;0.8;0"
                        keyTimes="0;0.2;0.85;1"
                        dur="4s"
                        begin={`${i * 1.3 + (side === "right" ? 0.65 : 0)}s`}
                        repeatCount="indefinite"
                      />
                    </circle>
                  )),
                )}
              </g>
            </svg>

            {/* Cœur BLEME */}
            <div
              className="absolute z-[1] -translate-x-1/2 -translate-y-1/2"
              style={{ left: "50%", top: "50%" }}
            >
              <div className="flex size-20 sm:size-24 lg:size-32 items-center justify-center rounded-full bg-white shadow-xl shadow-brand/20 ring-1 ring-black/5">
                <div className="flex size-14 sm:size-16 lg:size-[5.5rem] flex-col items-center justify-center rounded-full bg-gradient-to-b from-brand to-brand-strong text-brand-foreground">
                  <span className="text-base sm:text-lg lg:text-2xl font-bold tracking-tight">B.</span>
                  <span className="hidden lg:block text-[8px] font-medium uppercase tracking-[0.2em] opacity-85">
                    IA juridique
                  </span>
                </div>
              </div>
            </div>

            {/* Tuiles-icônes flottantes */}
            {TILES.map((t) => (
              <div
                key={t.label}
                className="anim-load absolute z-[1] -translate-x-1/2 -translate-y-1/2"
                style={
                  {
                    left: `${t.x * 100}%`,
                    top: `${t.y * 100}%`,
                    "--delay": `${0.3 + t.delay}s`,
                  } as React.CSSProperties
                }
                title={t.label}
              >
                <div className="flex size-11 sm:size-14 lg:size-16 items-center justify-center rounded-xl lg:rounded-2xl bg-white shadow-lg shadow-zinc-950/[0.1] ring-1 ring-black/5 transition-all duration-500 ease-fluid hover:-translate-y-1 hover:shadow-xl">
                  <t.icon className="size-5 sm:size-6 lg:size-7 text-brand-strong" />
                </div>
                <span className="sr-only">{t.label}</span>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Wordmarks des institutions */}
        <Reveal delay={0.25}>
          <div className="mt-2 text-center">
            <p className="text-sm text-muted-foreground">
              Alimentée par les API publiques officielles :
            </p>
            <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-9 gap-y-4">
              {WORDMARKS.map((w) => (
                <li
                  key={w}
                  className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground/60 transition-colors duration-300 hover:text-foreground"
                >
                  <FlagGlyph small />
                  {w}
                </li>
              ))}
            </ul>
            <p className="mx-auto mt-6 max-w-xl text-xs leading-relaxed text-muted-foreground/80">
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
