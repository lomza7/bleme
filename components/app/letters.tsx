"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, FileText, LoaderCircle, PenLine } from "lucide-react";
import { generateLetter, type LetterState } from "@/lib/cases/letters";
import { LETTER_KINDS, LETTER_STATUS_LABEL } from "@/lib/cases/letter-meta";
import { AgentThinkingOverlay, writerFor } from "@/components/app/agent-thinking";

const INITIAL: LetterState = {};

/**
 * Boutons de génération de courriers. Par défaut, tous les kinds du type de
 * dossier ; `kinds` cible une sélection (ex. P1 = ['reminder_1'], P2 = prochain
 * cran d'escalade) ; `primary` affiche un gros bouton brand plutôt qu'une rangée
 * d'outline.
 */
export function GenerateLetterButtons({
  caseId,
  caseType,
  kinds,
  primary = false,
}: {
  caseId: string;
  caseType: string;
  kinds?: string[];
  primary?: boolean;
}) {
  const [state, action, pending] = useActionState(generateLetter, INITIAL);
  // Kind soumis : détermine quel agent afficher dans la superposition d'attente.
  const [activeKind, setActiveKind] = useState<string | null>(null);
  const entries: [string, { label: string }][] = kinds
    ? kinds.filter((k) => LETTER_KINDS[k]).map((k): [string, { label: string }] => [k, LETTER_KINDS[k]])
    : Object.entries(LETTER_KINDS).filter(([, m]) => m.caseTypes.includes(caseType));

  return (
    <div className="flex flex-col gap-3">
      <AgentThinkingOverlay agent={writerFor(caseType, activeKind ?? undefined)} open={pending} caseId={caseId} />
      <div className="flex flex-wrap gap-2">
        {entries.map(([kind, meta]) => (
          <form key={kind} action={action} onSubmit={() => setActiveKind(kind)}>
            <input type="hidden" name="caseId" value={caseId} />
            <input type="hidden" name="kind" value={kind} />
            <button
              type="submit"
              disabled={pending}
              className={
                primary
                  ? "inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
                  : "inline-flex items-center gap-2 rounded-full border bg-background px-3.5 py-2 text-sm font-medium transition-colors duration-300 hover:border-brand/60 hover:bg-brand-soft disabled:opacity-60"
              }
            >
              {pending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <PenLine className={`size-4 ${primary ? "" : "text-brand-strong"}`} />
              )}
              {primary ? `Préparer : ${meta.label.toLowerCase()}` : meta.label}
            </button>
          </form>
        ))}
      </div>
      {state.error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-red-600">
          <CircleAlert className="size-4 shrink-0" />
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800 ring-1 ring-amber-200">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {state.notice}
        </p>
      ) : null}
      {state.success && state.letterId ? (
        <Link
          href={`?`}
          className="flex items-center gap-2 text-sm font-medium text-brand-strong"
        >
          <FileText className="size-4" />
          Brouillon prêt — voir plus bas pour le relire et le valider
          <ArrowRight className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

/** Ligne d'un courrier dans la liste du dossier. */
export function LetterRow({
  letter,
  caseId,
}: {
  letter: { id: string; kind: string; status: string; subject: string; created_at: string };
  caseId: string;
}) {
  const meta = LETTER_KINDS[letter.kind] ?? { label: letter.kind };
  const sent = letter.status === "sent";
  const tone = sent
    ? "bg-emerald-100 text-emerald-800"
    : "bg-amber-100 text-amber-800";
  return (
    <Link
      href={`/app/dossiers/${caseId}/courrier/${letter.id}`}
      className="flex items-center gap-3 rounded-2xl border bg-background p-4 transition-colors duration-300 hover:border-brand/50 hover:bg-brand-soft/40"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
        <FileText className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{meta.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{letter.subject}</span>
      </span>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tone}`}>
        {LETTER_STATUS_LABEL[letter.status] ?? letter.status}
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
