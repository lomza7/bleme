"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, ShieldQuestion } from "lucide-react";
import type { WizardData } from "@/components/wizard/types";
import { VoiceCapture } from "@/components/app/voice-capture";
import { transcribePublic } from "@/lib/transcription/public-client";

const EASE = [0.16, 1, 0.3, 1] as const;

export function StoryStep({
  data,
  patch,
  onNext,
  light,
}: {
  data: WizardData;
  patch: (p: Partial<WizardData>) => void;
  onNext: () => void;
  light?: boolean;
}) {
  const reduce = useReducedMotion();
  // La voix passe désormais par une VRAIE transcription (VoiceCapture) qui produit
  // du texte ; le récit est donc toujours du texte validé (≥ 120 caractères).
  const storyDone = data.storyText.trim().length >= 120;
  const ready = storyDone && data.devilAnswer.trim().length >= 15;

  return (
    <div className="flex flex-1 flex-col justify-center py-4">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Racontez ce qui s’est passé
        {data.partyName ? ` avec ${data.partyName}` : ""}.
      </h1>
      <p
        className={`mt-3 max-w-xl ${light ? "text-muted-foreground" : "text-ink-muted"}`}
      >
        C’est le cœur de votre dossier : l’IA en tirera les faits, les dates et
        la chronologie.
      </p>

      <div className="mt-9">
        <VoiceCapture
          value={data.storyText}
          onChange={(t) => patch({ storyMode: "text", storyText: t })}
          transcriber={transcribePublic}
          light={light}
        />
        <p className={`mt-2 text-right text-xs ${light ? "text-muted-foreground" : "text-ink-muted/70"}`}>
          {data.storyText.trim().length > 0 && data.storyText.trim().length < 120
            ? `Encore un peu de contexte (${data.storyText.trim().length}/120 caractères minimum)`
            : data.storyText.trim().length >= 120
              ? "C’est bon, vous pouvez continuer"
              : ""}
        </p>
      </div>

      <AnimatePresence>
        {storyDone && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 24, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="mt-8 rounded-[1.75rem] bg-brand/10 p-7 ring-1 ring-brand/30"
          >
            <div className="flex items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/20 text-brand">
                <ShieldQuestion className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  La question qui fâche :{" "}
                  {data.kind === "dispute"
                    ? "qu’est-ce que l’autre partie vous reproche, au juste ?"
                    : data.kind === "admin"
                      ? "qu’est-ce que l’administration pourrait objecter à votre demande ?"
                      : `qu’est-ce que ${data.partyName || "l’autre partie"} pourrait répondre pour ne pas payer ?`}
                </p>
                <p
                  className={`mt-1.5 text-sm leading-relaxed ${light ? "text-muted-foreground" : "text-ink-muted"}`}
                >
                  Un dossier solide a anticipé la réponse d’en face. Retard,
                  malfaçon alléguée, désaccord sur le devis : dites tout, même
                  ce qui vous dessert.
                </p>
                <textarea
                  rows={3}
                  value={data.devilAnswer}
                  onChange={(e) => patch({ devilAnswer: e.target.value })}
                  placeholder="Soyez honnête, ça restera entre nous. C’est ce qui rend le dossier béton."
                  className={`mt-4 w-full rounded-2xl px-4 py-3.5 text-[15px] leading-relaxed transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand ${light ? "bg-card text-foreground border placeholder:text-muted-foreground" : "bg-white/[0.06] text-ink-foreground ring-1 ring-white/10 placeholder:text-ink-muted/60"}`}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        disabled={!ready}
        onClick={onNext}
        className="group mt-10 inline-flex w-max items-center gap-3 rounded-full bg-brand py-2.5 pl-6 pr-2.5 text-[15px] font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
      >
        Voir mon dossier
        <span className="flex size-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ease-fluid group-hover:translate-x-0.5">
          <ArrowRight className="size-4" />
        </span>
      </button>
    </div>
  );
}
