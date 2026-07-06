"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";

const EASE = [0.16, 1, 0.3, 1] as const;

export type Companion = {
  key: string;
  prenom: string;
  role: string;
  message: string;
};

/*
 * Parcours guidé du dossier en étapes (Preuves → Faits → Courrier). Un agent
 * compagnon reste sur le côté et RÉAGIT à ce que l'utilisateur intègre : son
 * message reflète l'état réel du dossier (pièce reconnue, ce qui manque,
 * brouillon prêt…). Il change selon l'étape.
 */
export function DossierSteps({
  stepLabels,
  panels,
  companions,
  defaultStep,
  side,
}: {
  stepLabels: string[];
  panels: ReactNode[];
  companions: Companion[];
  defaultStep: number;
  side: ReactNode;
}) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(Math.min(Math.max(0, defaultStep), panels.length - 1));
  const [dir, setDir] = useState(1);
  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(Math.min(Math.max(0, n), panels.length - 1));
  };
  const c = companions[step];

  return (
    <div>
      {/* Stepper */}
      <ol className="flex items-center gap-2">
        {stepLabels.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => go(i)}
                className="flex min-w-0 items-center gap-2 text-left"
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    current
                      ? "bg-brand text-brand-foreground"
                      : done
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                <span className={`hidden truncate text-sm font-medium sm:block ${current ? "" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </button>
              {i < stepLabels.length - 1 ? (
                <span className={`h-px flex-1 ${done ? "bg-emerald-300" : "bg-border"}`} />
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {/* Panneau de l'étape */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={reduce ? false : { opacity: 0, x: 28 * dir }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: -20 * dir }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              {panels[step]}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => go(step - 1)}
              disabled={step === 0}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-0"
            >
              <ArrowLeft className="size-4" />
              Retour
            </button>
            {step < panels.length - 1 ? (
              <button
                type="button"
                onClick={() => go(step + 1)}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-ink-soft active:scale-[0.98]"
              >
                Étape suivante
                <ArrowRight className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Compagnon + côté */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
          <section className="overflow-hidden rounded-[1.75rem] border border-brand/20 bg-gradient-to-b from-brand-soft/60 to-card p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-brand-soft to-brand/15 ring-1 ring-brand/25">
                <SpriteAvatar src={`/agents/${c.key}.webp`} alt={c.prenom} className="h-12" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{c.prenom}</p>
                <p className="text-xs text-muted-foreground">{c.role}</p>
              </div>
              <span className="ml-auto flex size-2.5 shrink-0">
                <span className="absolute inline-flex size-2.5 animate-ping rounded-full bg-brand/50 motion-reduce:hidden" />
                <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
              </span>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={`${step}:${c.message}`}
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

          {side}
        </aside>
      </div>
    </div>
  );
}
