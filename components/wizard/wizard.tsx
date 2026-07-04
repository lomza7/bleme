"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import {
  EMPTY_DATA,
  type WizardData,
  type WizardStep,
} from "@/components/wizard/types";
import { KindStep } from "@/components/wizard/kind-step";
import { DetailsStep } from "@/components/wizard/details-step";
import { StoryStep } from "@/components/wizard/story-step";
import { AccountStep } from "@/components/wizard/account-step";

const EASE = [0.16, 1, 0.3, 1] as const;

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "kind", label: "Votre blème" },
  { id: "details", label: "Les faits" },
  { id: "story", label: "Votre récit" },
  { id: "account", label: "Votre dossier" },
];

export function Wizard() {
  const [step, setStep] = useState<WizardStep>("kind");
  const [data, setData] = useState<WizardData>(EMPTY_DATA);
  const [direction, setDirection] = useState(1);
  const reduce = useReducedMotion();

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  function go(next: WizardStep) {
    setDirection(STEPS.findIndex((s) => s.id === next) >= stepIndex ? 1 : -1);
    setStep(next);
  }

  function patch(partial: Partial<WizardData>) {
    setData((d) => ({ ...d, ...partial }));
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-ink text-ink-foreground">
      <div aria-hidden className="absolute inset-0 bg-hero-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_20%,black,transparent)]" />
      <div aria-hidden className="absolute -right-40 -top-40 size-[30rem] rounded-full bg-brand/20 blur-[140px]" />

      {/* Barre haute : logo, progression, sortie */}
      <header className="relative z-10 mx-auto flex w-full max-w-3xl items-center justify-between gap-6 px-6 pt-7">
        <Link href="/" className="text-lg font-bold tracking-tight">
          BLEME<span className="text-brand">.</span>
        </Link>
        <ol className="hidden flex-1 items-center justify-center gap-2 sm:flex">
          {STEPS.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2">
              <span
                className={
                  i <= stepIndex
                    ? "text-xs font-medium text-ink-foreground"
                    : "text-xs text-ink-muted/70"
                }
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <span
                  className={
                    i < stepIndex
                      ? "h-px w-7 bg-brand transition-colors duration-500"
                      : "h-px w-7 bg-ink-soft transition-colors duration-500"
                  }
                />
              )}
            </li>
          ))}
        </ol>
        <Link
          href="/"
          className="text-sm text-ink-muted transition-colors duration-300 hover:text-ink-foreground"
        >
          Quitter
        </Link>
      </header>

      {/* Progression mobile */}
      <div className="relative z-10 mx-auto mt-5 h-1 w-full max-w-3xl overflow-hidden rounded-full bg-ink-soft/60 sm:hidden">
        <div
          className="h-full rounded-full bg-brand transition-all duration-700 ease-fluid"
          style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pb-16 pt-10 sm:pt-14">
        {step !== "kind" && (
          <button
            type="button"
            onClick={() =>
              go(STEPS[Math.max(0, stepIndex - 1)].id)
            }
            className="mb-6 inline-flex w-max items-center gap-2 rounded-full py-1 text-sm text-ink-muted transition-colors duration-300 hover:text-ink-foreground"
          >
            <ArrowLeft className="size-4" />
            Retour
          </button>
        )}

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            initial={
              reduce ? false : { opacity: 0, x: 36 * direction, filter: "blur(4px)" }
            }
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={
              reduce
                ? undefined
                : { opacity: 0, x: -28 * direction, filter: "blur(4px)" }
            }
            transition={{ duration: 0.45, ease: EASE }}
            className="flex flex-1 flex-col"
          >
            {step === "kind" && (
              <KindStep
                data={data}
                onSelect={(kind) => {
                  patch({ kind });
                  go("details");
                }}
              />
            )}
            {step === "details" && (
              <DetailsStep
                data={data}
                patch={patch}
                onNext={() => go("story")}
              />
            )}
            {step === "story" && (
              <StoryStep
                data={data}
                patch={patch}
                onNext={() => go("account")}
              />
            )}
            {step === "account" && <AccountStep data={data} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
