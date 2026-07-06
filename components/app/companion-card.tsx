"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";

const EASE = [0.16, 1, 0.3, 1] as const;

export type Companion = {
  key: string;
  prenom: string;
  role: string;
  message: string;
};

/*
 * Agent compagnon affiché sur le côté du parcours dossier. Il RÉAGIT à l'état
 * réel (message scripté) et change selon la phase / l'étape. Partagé par le
 * stepper Phase 1 et les flux Phase 2 / Phase 3.
 */
export function CompanionCard({ companion }: { companion: Companion }) {
  const reduce = useReducedMotion();
  const c = companion;
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-brand/20 bg-gradient-to-b from-brand-soft/60 to-card p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-brand-soft to-brand/15 ring-1 ring-brand/25">
          <SpriteAvatar src={`/agents/${c.key}.webp`} alt={c.prenom} className="h-12" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{c.prenom}</p>
          <p className="text-xs text-muted-foreground">{c.role}</p>
        </div>
        <span className="relative ml-auto flex size-2.5 shrink-0">
          <span className="absolute inline-flex size-2.5 animate-ping rounded-full bg-brand/50 motion-reduce:hidden" />
          <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
        </span>
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={c.message}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="mt-4 rounded-2xl bg-white p-4 text-[13px] leading-relaxed text-foreground shadow-sm ring-1 ring-black/5"
        >
          {c.message}
        </motion.p>
      </AnimatePresence>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/80">
        Vous validez toujours avant tout envoi.
      </p>
    </section>
  );
}
