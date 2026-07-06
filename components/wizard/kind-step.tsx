"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Banknote, Landmark, Scale } from "lucide-react";
import type { CaseKind, WizardData } from "@/components/wizard/types";

const EASE = [0.16, 1, 0.3, 1] as const;

const KINDS: {
  kind: CaseKind;
  icon: typeof Banknote;
  title: string;
  desc: string;
  chips: string[];
  soon?: boolean;
}[] = [
  {
    kind: "unpaid",
    icon: Banknote,
    title: "Facture impayée",
    desc: "Un client ne paie pas ce qu’il vous doit.",
    chips: ["Relances cadencées", "Mise en demeure", "Recommandé"],
  },
  {
    kind: "dispute",
    icon: Scale,
    title: "Litige client",
    desc: "Un client conteste, réclame ou bloque le paiement.",
    chips: ["Preuves classées", "Chronologie", "Réponse préparée"],
  },
  {
    kind: "admin",
    icon: Landmark,
    title: "Amende ou démarche",
    desc: "Une amende à contester, une demande gracieuse à monter.",
    chips: ["Contestation", "Demande gracieuse"],
    soon: true,
  },
];

// Fond ambiant : tout converge vers le centre (écho de la constellation
// « savoir juridique »). Courbes brand qui rentrent vers un cœur, impulsions
// qui remontent le flux, halo. SVG + SMIL, coupé sous prefers-reduced-motion.
const CENTER = { x: 600, y: 360 };
const FLOW_YS = [70, 250, 470, 650];

function flowPath(side: "left" | "right", y: number): string {
  const startX = side === "left" ? -60 : 1260;
  const c1x = side === "left" ? 320 : 880;
  const c2x = side === "left" ? 470 : 730;
  return `M ${startX} ${y} C ${c1x} ${y}, ${c2x} ${CENTER.y}, ${CENTER.x} ${CENTER.y}`;
}

function KindBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Halo du cœur */}
      <div className="absolute left-1/2 top-[46%] size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/10 blur-[130px]" />
      <div className="absolute left-1/2 top-[46%] size-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/20 blur-[80px]" />

      <svg className="absolute inset-0 h-full w-full opacity-70" viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="flowGlow" cx="600" cy="360" r="640" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.5" />
            <stop offset="42%" stopColor="var(--brand)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {(["left", "right"] as const).map((side) =>
          FLOW_YS.map((y) => (
            <path
              key={`${side}-${y}`}
              d={flowPath(side, y)}
              fill="none"
              stroke="url(#flowGlow)"
              strokeWidth="1.5"
            />
          )),
        )}

        <g className="motion-reduce:hidden">
          {(["left", "right"] as const).map((side) =>
            [0, 2].map((idx, i) => (
              <circle key={`${side}-p-${idx}`} r="2.5" fill="var(--brand)">
                <animateMotion
                  dur="4.5s"
                  begin={`${i * 1.6 + (side === "right" ? 0.8 : 0)}s`}
                  repeatCount="indefinite"
                  keyPoints="0;1"
                  keyTimes="0;1"
                  path={flowPath(side, FLOW_YS[idx])}
                />
                <animate
                  attributeName="opacity"
                  values="0;0.9;0.9;0"
                  keyTimes="0;0.2;0.85;1"
                  dur="4.5s"
                  begin={`${i * 1.6 + (side === "right" ? 0.8 : 0)}s`}
                  repeatCount="indefinite"
                />
              </circle>
            )),
          )}
        </g>
      </svg>
    </div>
  );
}

export function KindStep({
  onSelect,
}: {
  data: WizardData;
  onSelect: (kind: CaseKind) => void;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="relative flex flex-1 flex-col">
      <KindBackdrop />

      <div className="relative z-10 flex flex-1 flex-col justify-center">
        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-3xl font-bold tracking-tight sm:text-4xl"
        >
          C’est quoi, votre blème ?
        </motion.h1>
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
          className="mt-3 text-ink-muted"
        >
          Choisissez la situation qui vous ressemble. Deux minutes plus tard,
          votre dossier existe.
        </motion.p>

        <motion.div
          initial={reduce ? false : "hidden"}
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.09, delayChildren: 0.18 } },
          }}
          className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3"
        >
          {KINDS.map((k) => (
            <motion.button
              key={k.kind}
              type="button"
              onClick={() => onSelect(k.kind)}
              variants={{
                hidden: { opacity: 0, y: 28, scale: 0.97 },
                visible: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { duration: 0.55, ease: EASE },
                },
              }}
              whileHover={reduce ? undefined : { y: -6 }}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              className="group relative flex flex-col rounded-[1.75rem] bg-white/[0.05] p-7 text-left ring-1 ring-white/10 backdrop-blur-sm transition-all duration-500 ease-fluid hover:bg-white/[0.09] hover:shadow-2xl hover:shadow-brand/15 hover:ring-brand/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {k.soon && (
                <span className="absolute right-5 top-5 rounded-full bg-brand/90 px-2.5 py-0.5 text-[11px] font-medium text-brand-foreground">
                  Bientôt
                </span>
              )}
              <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-b from-brand to-brand-strong text-brand-foreground shadow-lg shadow-brand/25 transition-transform duration-500 ease-fluid group-hover:-rotate-6 group-hover:scale-110">
                <k.icon className="size-6" />
              </span>
              <span className="mt-5 text-lg font-semibold">{k.title}</span>
              <span className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                {k.desc}
              </span>
              <span className="mt-5 flex flex-wrap gap-1.5">
                {k.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] text-ink-foreground/70 ring-1 ring-white/10"
                  >
                    {chip}
                  </span>
                ))}
              </span>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand opacity-0 transition-all duration-500 ease-fluid group-hover:opacity-100">
                Commencer
                <ArrowRight className="size-4 transition-transform duration-500 ease-fluid group-hover:translate-x-0.5" />
              </span>
            </motion.button>
          ))}
        </motion.div>

        <motion.p
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.55, ease: EASE }}
          className="mt-8 text-[13px] text-ink-muted/80"
        >
          Sans engagement. Votre dossier se construit d’abord, le compte vient
          après.
        </motion.p>
      </div>
    </div>
  );
}
