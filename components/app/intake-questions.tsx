"use client";

import { useState } from "react";
import { LoaderCircle, ShieldQuestion, Sparkles } from "lucide-react";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";
import { intakeQuestions } from "@/lib/intake/actions";

/*
 * Après le récit, Jeanne (avocate du diable) pose 2 à 4 questions ciblées pour
 * combler les trous du dossier. Les réponses sont agrégées et remontées (elles
 * alimentent les points de vigilance du dossier). Run réel, repli déterministe.
 */
export function IntakeQuestions({
  transcript,
  kind,
  partyName,
  onChange,
}: {
  transcript: string;
  kind: "unpaid" | "dispute";
  partyName: string;
  onChange: (answersText: string) => void;
}) {
  const [state, setState] = useState<"idle" | "loading" | "asked">("idle");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);

  async function ask() {
    setState("loading");
    const { questions: qs } = await intakeQuestions({ transcript, kind, partyName });
    setQuestions(qs);
    setAnswers(qs.map(() => ""));
    setState("asked");
  }

  function setAnswer(i: number, v: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[i] = v;
      onChange(questions.map((q, k) => `• ${q}\n${next[k]?.trim() || "—"}`).join("\n\n"));
      return next;
    });
  }

  if (state === "idle") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-brand-soft/50 p-5 ring-1 ring-brand/20">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-soft">
            <SpriteAvatar src="/agents/jeanne.webp" alt="Jeanne" className="h-7" />
          </span>
          <div>
            <p className="text-sm font-semibold">Laissez Jeanne passer votre récit au crible</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Elle repère ce qui manquerait face à la partie adverse et vous pose 2-3 questions.</p>
          </div>
        </div>
        <button type="button" onClick={ask} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:bg-ink-soft active:scale-[0.98]">
          <Sparkles className="size-4" />
          Vérifier
        </button>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-brand-soft/50 p-5 ring-1 ring-brand/20">
        <LoaderCircle className="size-5 animate-spin text-brand-strong" />
        <p className="text-sm text-muted-foreground">Jeanne lit votre récit et prépare ses questions…</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-brand-soft/40 p-5 ring-1 ring-brand/20">
      <div className="flex items-center gap-2">
        <ShieldQuestion className="size-4 text-brand-strong" />
        <p className="text-sm font-semibold">Les questions de Jeanne</p>
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">Répondez même brièvement — c’est ce qui rend le dossier béton. Optionnel.</p>
      <div className="mt-4 flex flex-col gap-4">
        {questions.map((q, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <p className="text-[13px] font-medium">{q}</p>
            <textarea
              rows={2}
              value={answers[i] ?? ""}
              onChange={(e) => setAnswer(i, e.target.value)}
              placeholder="Votre réponse (ou laissez vide)"
              className="w-full rounded-xl border bg-background p-3 text-sm leading-relaxed outline-none transition-colors focus:border-brand"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
