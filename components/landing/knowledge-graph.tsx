import { Reveal } from "@/components/landing/reveal";

/*
 * « Branchée sur le savoir juridique public » : les institutions sources
 * (plaques officielles avec glyphe tricolore) convergent vers le cœur
 * BLEME par des flèches animées. SVG + SMIL + CSS, aucun JavaScript,
 * désactivé proprement en reduced-motion.
 */

type Source = {
  nom: string;
  detail: string;
  side: "left" | "right";
  slot: number;
  bleme?: boolean;
};

const SOURCES: Source[] = [
  { nom: "Légifrance", detail: "Codes et lois en vigueur, consolidés", side: "left", slot: 0 },
  { nom: "Judilibre · Cour de cassation", detail: "Jurisprudence judiciaire publiée", side: "left", slot: 1 },
  { nom: "Conseil d’État", detail: "Jurisprudence administrative", side: "left", slot: 2 },
  { nom: "Journal officiel · DILA", detail: "Lois, décrets, barèmes publiés", side: "right", slot: 0 },
  { nom: "BOFiP · Impôts", detail: "Doctrine fiscale officielle", side: "right", slot: 1 },
  { nom: "Modèles BLEME", detail: "Courriers éprouvés, conformes aux usages", side: "right", slot: 2, bleme: true },
];

// Géométrie (viewBox 1000 × 540) : constellation en arc autour du cœur.
const SLOT_Y = [80, 270, 460];
const X = { left: [215, 165, 215], right: [785, 835, 785] };
const CORE = { x: 500, y: 270, r: 92 };

function beamPath(side: "left" | "right", slot: number): string {
  const x = X[side][slot];
  const y = SLOT_Y[slot];
  const endX = side === "left" ? CORE.x - CORE.r : CORE.x + CORE.r;
  const c1x = side === "left" ? x + 130 : x - 130;
  const c2x = side === "left" ? CORE.x - CORE.r - 90 : CORE.x + CORE.r + 90;
  return `M ${x} ${y} C ${c1x} ${y}, ${c2x} ${CORE.y}, ${endX} ${CORE.y}`;
}

function FlagGlyph() {
  return (
    <span
      aria-hidden
      className="flex h-5 w-7 shrink-0 overflow-hidden rounded-[4px] ring-1 ring-black/15"
    >
      <span className="h-full w-1/3 bg-[#000091]" />
      <span className="h-full w-1/3 bg-white" />
      <span className="h-full w-1/3 bg-[#E1000F]" />
    </span>
  );
}

function Plaque({ source, detail = false }: { source: Source; detail?: boolean }) {
  const inner = (
    <>
      {source.bleme ? (
        <span className="flex h-5 w-7 shrink-0 items-center justify-center rounded-[4px] bg-white/20 text-[11px] font-bold">
          B.
        </span>
      ) : (
        <FlagGlyph />
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold tracking-tight">
          {source.nom}
        </span>
        {detail ? (
          <span className={source.bleme ? "block truncate text-xs opacity-85" : "block truncate text-xs text-zinc-500"}>
            {source.detail}
          </span>
        ) : null}
      </span>
    </>
  );
  return (
    <div
      className={
        source.bleme
          ? "flex w-max max-w-full items-center gap-3 rounded-xl bg-brand px-4 py-3 text-brand-foreground shadow-xl shadow-brand/25 transition-all duration-500 ease-fluid hover:-translate-y-0.5"
          : "flex w-max max-w-full items-center gap-3 rounded-xl bg-white px-4 py-3 text-zinc-900 shadow-xl shadow-zinc-950/30 transition-all duration-500 ease-fluid hover:-translate-y-0.5"
      }
    >
      {inner}
    </div>
  );
}

export function KnowledgeGraph() {
  return (
    <section className="relative overflow-hidden bg-ink text-ink-foreground">
      <div aria-hidden className="absolute left-1/2 top-1/2 size-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/15 blur-[140px]" />

      <div className="relative mx-auto max-w-6xl px-6 py-24 lg:py-32">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Branchée sur le savoir juridique public.
            </h2>
            <p className="mt-4 text-lg text-ink-muted">
              Codes, jurisprudence, Journal officiel, doctrine fiscale : tout
              converge dans l’IA de BLEME et se condense dans vos dossiers.
            </p>
          </div>
        </Reveal>

        {/* Diagramme desktop */}
        <Reveal delay={0.15} className="relative mt-4 hidden lg:block">
          <div className="relative mx-auto h-[540px] max-w-5xl">
            <svg
              aria-hidden
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 1000 540"
              preserveAspectRatio="none"
            >
              <defs>
                <radialGradient id="beamGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.9" />
                  <stop offset="55%" stopColor="var(--brand)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="white" stopOpacity="0.10" />
                </radialGradient>
                <marker
                  id="arrowHead"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="var(--brand)" />
                </marker>
              </defs>

              {/* Traits pleins discrets + flux en tirets + pointe de flèche */}
              {SOURCES.map((s) => (
                <g key={s.nom}>
                  <path
                    d={beamPath(s.side, s.slot)}
                    fill="none"
                    stroke="oklch(1 0 0 / 0.07)"
                    strokeWidth="1.5"
                  />
                  <path
                    className="anim-dash"
                    d={beamPath(s.side, s.slot)}
                    fill="none"
                    stroke="url(#beamGrad)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="7 9"
                    markerEnd="url(#arrowHead)"
                  />
                </g>
              ))}

              {/* Impulsions lumineuses */}
              <g className="motion-reduce:hidden">
                {SOURCES.map((s, i) => (
                  <g key={`pulse-${s.nom}`}>
                    <circle r="7" fill="var(--brand)" opacity="0.25">
                      <animateMotion
                        dur="3.2s"
                        begin={`${i * 0.5}s`}
                        repeatCount="indefinite"
                        path={beamPath(s.side, s.slot)}
                      />
                    </circle>
                    <circle r="3" fill="oklch(0.95 0.05 48)">
                      <animateMotion
                        dur="3.2s"
                        begin={`${i * 0.5}s`}
                        repeatCount="indefinite"
                        path={beamPath(s.side, s.slot)}
                      />
                      <animate
                        attributeName="opacity"
                        values="0;1;1;0"
                        keyTimes="0;0.12;0.85;1"
                        dur="3.2s"
                        begin={`${i * 0.5}s`}
                        repeatCount="indefinite"
                      />
                    </circle>
                  </g>
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
              <span
                aria-hidden
                className="anim-spin-slow absolute -inset-4 rounded-full border border-dashed border-brand/30"
              />
              <div className="relative flex size-44 flex-col items-center justify-center rounded-full bg-white/[0.06] p-2 ring-1 ring-white/15">
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-gradient-to-b from-brand to-brand-strong text-brand-foreground shadow-[0_0_70px_-8px_var(--brand)]">
                  <span className="text-2xl font-bold tracking-tight">
                    BLEME<span className="opacity-70">.</span>
                  </span>
                  <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] opacity-85">
                    IA juridique
                  </span>
                </div>
              </div>
            </div>

            {/* Plaques institutions */}
            {SOURCES.map((s) => (
              <div
                key={s.nom}
                className="absolute z-[1] -translate-y-1/2"
                style={{
                  right: s.side === "left" ? `${((1000 - X.left[s.slot]) / 1000) * 100}%` : undefined,
                  left: s.side === "right" ? `${(X.right[s.slot] / 1000) * 100}%` : undefined,
                  top: `${(SLOT_Y[s.slot] / 540) * 100}%`,
                }}
              >
                <Plaque source={s} />
              </div>
            ))}
          </div>
        </Reveal>

        {/* Version mobile : cœur + plaques empilées */}
        <div className="mt-12 lg:hidden">
          <div className="mx-auto w-max">
            <div className="relative">
              <span aria-hidden className="anim-ring absolute inset-0 rounded-full border border-brand/50" />
              <div className="relative flex size-32 flex-col items-center justify-center rounded-full bg-gradient-to-b from-brand to-brand-strong text-brand-foreground shadow-[0_0_50px_-10px_var(--brand)]">
                <span className="text-xl font-bold tracking-tight">
                  BLEME<span className="opacity-70">.</span>
                </span>
                <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] opacity-85">
                  IA juridique
                </span>
              </div>
            </div>
          </div>
          <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SOURCES.map((s) => (
              <li key={s.nom}>
                <Plaque source={s} detail />
              </li>
            ))}
          </ul>
        </div>

        <Reveal delay={0.25}>
          <div className="mt-10 text-center">
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
