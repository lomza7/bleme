"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Check,
  CircleAlert,
  FileSearch,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";
import type { PieceAnalysis } from "@/lib/cases/analysis-types";

const EASE = [0.16, 1, 0.3, 1] as const;
const STEP_ICON = [FileSearch, Tag, Sparkles, ShieldCheck];

/*
 * Popup d'analyse d'une pièce : l'agent (Nora) « traite » le document en direct
 * — lecture → classement → extraction → cohérence — puis révèle le résultat.
 * Les étapes se déroulent une par une (temps réel) ; les données affichées sont
 * réelles (renvoyées par l'upload).
 */
export function AnalysisModal({
  analysis,
  onClose,
}: {
  analysis: PieceAnalysis;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  // Étape en cours de traitement : 0..3, puis 4 = terminé.
  const [step, setStep] = useState(reduce ? 4 : 0);

  useEffect(() => {
    if (reduce) return;
    const timers = [0, 1, 2, 3].map((i) => setTimeout(() => setStep(i + 1), 650 + i * 850));
    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  const warns = analysis.coherence.filter((c) => c.level === "warn").length;
  const done = step >= 4;

  const STEPS = [
    { label: "Lecture du document", result: analysis.fileName },
    { label: "Classement", result: `Classée comme : ${analysis.kindLabel}` },
    { label: "Extraction des informations", result: null as string | null },
    { label: "Vérification de cohérence", result: null as string | null },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.button
        aria-label="Fermer"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        role="dialog"
        aria-modal
        initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-[1.75rem] border bg-card shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b bg-gradient-to-b from-brand-soft/70 to-card p-5">
          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-brand-soft to-brand/15 ring-1 ring-brand/25">
            <SpriteAvatar src="/agents/nora.webp" alt="Nora" className="h-10" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Nora analyse votre pièce</p>
            <p className="truncate text-xs text-muted-foreground">{analysis.fileName}</p>
          </div>
          {done ? (
            <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Fermer">
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-col gap-1 p-5">
          {STEPS.map((s, i) => {
            const Icon = STEP_ICON[i];
            const state = i < step ? "done" : i === step ? "busy" : "todo";
            if (state === "todo") return null;
            return (
              <motion.div
                key={s.label}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="flex items-start gap-3 rounded-2xl px-2 py-2"
              >
                <span
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
                    state === "busy" ? "bg-brand-soft text-brand-strong" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {state === "busy" ? <LoaderCircle className="size-4 animate-spin" /> : <Icon className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.label}{state === "busy" ? "…" : ""}</p>

                  {/* Résultat de l'étape (quand terminée) */}
                  {state === "done" && i === 0 ? (
                    <p className="truncate text-xs text-muted-foreground">{s.result}</p>
                  ) : null}
                  {state === "done" && i === 1 ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          analysis.kindConfirmed ? "bg-brand-soft text-brand-strong" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {analysis.kindLabel}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {analysis.kindConfirmed ? "confirmé par le contenu" : "type déclaré, à confirmer"}
                      </span>
                    </div>
                  ) : null}
                  {state === "done" && i === 2 ? (
                    analysis.facts.length ? (
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {analysis.facts.map((f) => (
                          <li key={f.field} className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">{f.label} :</span>
                            <span className="font-medium">{f.value}</span>
                            {f.confidence < 0.7 ? (
                              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">à vérifier</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">Aucune information chiffrée repérée.</p>
                    )
                  ) : null}
                  {state === "done" && i === 3 ? (
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {analysis.coherence.map((c, k) => (
                        <li key={k} className="flex items-start gap-1.5 text-xs">
                          {c.level === "warn" ? (
                            <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                          ) : (
                            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                          )}
                          <span className={c.level === "warn" ? "text-amber-800" : "text-muted-foreground"}>{c.message}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </div>

        {done ? (
          <div className="flex items-center justify-between gap-3 border-t bg-muted/40 p-5">
            <p className={`text-sm font-medium ${warns ? "text-amber-700" : "text-emerald-700"}`}>
              {warns
                ? `${warns} point${warns > 1 ? "s" : ""} à vérifier avant d'aller plus loin.`
                : "Pièce cohérente, intégrée au dossier."}
            </p>
            <button
              onClick={onClose}
              className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-ink-soft active:scale-[0.98]"
            >
              Compris
            </button>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
