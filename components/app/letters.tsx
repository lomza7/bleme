"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, FileText, LoaderCircle, PenLine } from "lucide-react";
import { generateLetter, type LetterState } from "@/lib/cases/letters";
import { LETTER_KINDS, LETTER_STATUS_LABEL } from "@/lib/cases/letter-meta";

const INITIAL: LetterState = {};

/** Boutons de génération de courriers, filtrés par type de dossier. */
export function GenerateLetterButtons({
  caseId,
  caseType,
}: {
  caseId: string;
  caseType: string;
}) {
  const [state, action, pending] = useActionState(generateLetter, INITIAL);
  const kinds = Object.entries(LETTER_KINDS).filter(([, m]) =>
    m.caseTypes.includes(caseType),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {kinds.map(([kind, meta]) => (
          <form key={kind} action={action}>
            <input type="hidden" name="caseId" value={caseId} />
            <input type="hidden" name="kind" value={kind} />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full border bg-background px-3.5 py-2 text-sm font-medium transition-colors duration-300 hover:border-brand/60 hover:bg-brand-soft disabled:opacity-60"
            >
              {pending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <PenLine className="size-4 text-brand-strong" />
              )}
              {meta.label}
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
