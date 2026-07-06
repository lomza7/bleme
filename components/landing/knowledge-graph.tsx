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
 *
 * Ajout MOA : trois branches supplémentaires descendent du haut vers le
 * cœur, une par IA proposeuse (OpenAI, Anthropic, Mistral). Les sources
 * juridiques rejoignent le cœur par les côtés, les IA par le haut : tout
 * converge dans l'IA de BLEME, qui compare et synthétise.
 */

// Tuiles-icônes dispersées (fractions du viewBox 1200 × 560).
const TILES = [
  { icon: BookOpenText, label: "Codes en vigueur", x: 0.2, y: 0.32, delay: 0 },
  { icon: Gavel, label: "Jurisprudence judiciaire", x: 0.115, y: 0.54, delay: 0.4 },
  { icon: Landmark, label: "Jurisprudence administrative", x: 0.265, y: 0.76, delay: 0.8 },
  { icon: Newspaper, label: "Journal officiel", x: 0.8, y: 0.32, delay: 0.2 },
  { icon: Percent, label: "Taux et indemnités", x: 0.885, y: 0.54, delay: 0.6 },
  { icon: ScrollText, label: "Doctrine fiscale", x: 0.735, y: 0.76, delay: 1 },
] as const;

// Logos officiels des modèles (Simple Icons, viewBox 0 0 24 24), inlinés pour
// indiquer les IA qui font tourner le moteur. Aucune dépendance externe.
const OPENAI_LOGO =
  "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z";
const ANTHROPIC_LOGO =
  "M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z";
const MISTRAL_LOGO =
  "M17.143 3.429v3.428h-3.429v3.429h-3.428V6.857H6.857V3.43H3.43v13.714H0v3.428h10.286v-3.428H6.857v-3.429h3.429v3.429h3.429v-3.429h3.428v3.429h-3.428v3.428H24v-3.428h-3.43V3.429z";

// Les IA proposeuses, en branches venant du haut (fractions du conteneur).
const MODELS = [
  { name: "OpenAI", logo: OPENAI_LOGO, x: 0.32, y: 0.11, node: { x: 408, y: 74 }, delay: 0.2 },
  { name: "Anthropic", logo: ANTHROPIC_LOGO, x: 0.5, y: 0.05, node: { x: 600, y: 40 }, delay: 0 },
  { name: "Mistral", logo: MISTRAL_LOGO, x: 0.68, y: 0.11, node: { x: 792, y: 74 }, delay: 0.4 },
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

// Branche d'une IA (haut) vers le cœur : converge vers (600, 220).
function branchPath(node: { x: number; y: number }): string {
  return `M ${node.x} ${node.y} C ${node.x} ${node.y + 110}, 600 140, 600 220`;
}

const WORDMARKS = [
  "Légifrance",
  "Judilibre",
  "Cour de cassation",
  "Conseil d’État",
  "DILA",
  "BOFiP",
];

// Volumes réels et publics des bases officielles (à valider avant diffusion) :
// Judilibre 800 000+ décisions (courdecassation.fr / data.gouv.fr),
// Légifrance 78 codes (DILA), 6 sources officielles branchées.
const STATS = [
  { value: "800 000+", label: "décisions de justice" },
  { value: "78", label: "codes en vigueur" },
  { value: "6", label: "sources officielles" },
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
              Branchée sur le savoir juridique public et sur les meilleures IA,
              combinées et mises en concurrence.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Codes, jurisprudence, Journal officiel, doctrine fiscale convergent
              dans l’IA de BLEME : plusieurs modèles proposent en parallèle,
              comparent leurs réponses et synthétisent la meilleure, avant de se
              condenser dans vos dossiers.
            </p>
          </div>
        </Reveal>

        {/* Constellation desktop */}
        <Reveal delay={0.15} className="relative">
          <div className="relative mx-auto h-[440px] sm:h-[520px] lg:h-[600px] max-w-6xl">
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
                <linearGradient id="rayTop" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity="0" />
                  <stop offset="55%" stopColor="var(--brand)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.6" />
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

              {/* Branches des IA (haut → cœur) */}
              {MODELS.map((m) => (
                <path
                  key={`branch-${m.name}`}
                  d={branchPath(m.node)}
                  fill="none"
                  stroke="url(#rayTop)"
                  strokeWidth="1.5"
                />
              ))}

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
                {/* Impulsions des IA descendant vers le cœur */}
                {MODELS.map((m, i) => (
                  <circle key={`branch-p-${m.name}`} r="3" fill="var(--brand)">
                    <animateMotion
                      dur="3.4s"
                      begin={`${i * 1.1}s`}
                      repeatCount="indefinite"
                      keyPoints="0;1"
                      keyTimes="0;1"
                      path={branchPath(m.node)}
                    />
                    <animate
                      attributeName="opacity"
                      values="0;0.85;0.85;0"
                      keyTimes="0;0.2;0.85;1"
                      dur="3.4s"
                      begin={`${i * 1.1}s`}
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
              <div className="flex size-20 sm:size-24 lg:size-32 items-center justify-center rounded-full bg-white shadow-xl shadow-brand/20 ring-1 ring-black/5">
                <div className="flex size-14 sm:size-16 lg:size-[5.5rem] flex-col items-center justify-center rounded-full bg-gradient-to-b from-brand to-brand-strong text-brand-foreground">
                  <span className="text-base sm:text-lg lg:text-2xl font-bold tracking-tight">B.</span>
                  <span className="hidden lg:block text-[8px] font-medium uppercase tracking-[0.2em] opacity-85">
                    IA juridique
                  </span>
                </div>
              </div>
            </div>

            {/* Branches IA flottantes (proposeuses) */}
            {MODELS.map((m) => (
              <div
                key={m.name}
                className="anim-load absolute z-[1] -translate-x-1/2 -translate-y-1/2"
                style={
                  {
                    left: `${m.x * 100}%`,
                    top: `${m.y * 100}%`,
                    "--delay": `${0.3 + m.delay}s`,
                  } as React.CSSProperties
                }
                title={`Modèle ${m.name}`}
              >
                <div className="flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-3.5 shadow-lg shadow-zinc-950/[0.1] ring-1 ring-black/5 transition-all duration-500 ease-fluid hover:-translate-y-1 hover:shadow-xl">
                  <span className="flex size-7 items-center justify-center rounded-full bg-ink text-ink-foreground">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-3.5">
                      <path d={m.logo} />
                    </svg>
                  </span>
                  <span className="text-xs font-semibold tracking-tight">{m.name}</span>
                </div>
              </div>
            ))}

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
              Alimentée par les bases de données officielles françaises :
            </p>
            <dl className="mx-auto mt-6 flex max-w-xl flex-wrap items-start justify-center gap-x-12 gap-y-6">
              {STATS.map((s) => (
                <div key={s.label} className="flex flex-col items-center">
                  <dt className="text-2xl font-bold tracking-tight text-brand-strong tabular-nums sm:text-3xl">
                    {s.value}
                  </dt>
                  <dd className="mt-1 text-xs text-muted-foreground">{s.label}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-9 flex flex-wrap items-center justify-center gap-x-9 gap-y-4">
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
          </div>
        </Reveal>
      </div>
    </section>
  );
}
