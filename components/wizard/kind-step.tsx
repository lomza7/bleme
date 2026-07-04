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

export function KindStep({
  onSelect,
}: {
  data: WizardData;
  onSelect: (kind: CaseKind) => void;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="flex flex-1 flex-col justify-center">
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
        className="mt-10 grid gap-4 lg:grid-cols-3"
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
            className="group relative flex flex-col rounded-[1.75rem] bg-white/[0.05] p-7 text-left ring-1 ring-white/10 transition-colors duration-500 ease-fluid hover:bg-white/[0.09] hover:ring-brand/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {k.soon && (
              <span className="absolute right-5 top-5 rounded-full bg-brand/90 px-2.5 py-0.5 text-[11px] font-medium text-brand-foreground">
                Bientôt
              </span>
            )}
            <span className="flex size-12 items-center justify-center rounded-2xl bg-brand/15 text-brand transition-transform duration-500 ease-fluid group-hover:-rotate-6 group-hover:scale-110">
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
  );
}
