"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, UploadCloud } from "lucide-react";
import { uploadDocument, type DocState } from "@/lib/documents/actions";
import { AnalysisModal } from "@/components/app/analysis-modal";
import type { PieceAnalysis } from "@/lib/cases/analysis-types";

const INITIAL: DocState = {};

/** Zone de dépôt : clic ou glisser-déposer, envoi immédiat. Avec `kinds`,
 * propose de catégoriser la pièce (alimente la complétude du dossier). */
export function Uploader({
  scope,
  kinds,
}: {
  scope: string;
  kinds?: { value: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(uploadDocument, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [modal, setModal] = useState<PieceAnalysis | null>(null);
  const shown = useRef<PieceAnalysis | null>(null);

  // Ouvre la popup d'analyse dès qu'un upload renvoie une analyse.
  useEffect(() => {
    if (state.analysis && state.analysis !== shown.current) {
      shown.current = state.analysis;
      setModal(state.analysis);
    }
  }, [state.analysis]);

  function submitFiles(files: FileList | null) {
    if (!files || files.length === 0 || !inputRef.current) return;
    inputRef.current.files = files;
    formRef.current?.requestSubmit();
  }

  return (
    <>
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="scope" value={scope} />
      {kinds && kinds.length > 0 ? (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Type de pièce
          <select
            name="doc_kind"
            defaultValue={kinds[0].value}
            className="rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand"
          >
            {kinds.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        name="file"
        className="sr-only"
        accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,.txt,.eml,.doc,.docx"
        onChange={(e) => {
          if (e.target.files?.length) formRef.current?.requestSubmit();
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          submitFiles(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center gap-2 rounded-[1.75rem] border-2 border-dashed px-6 py-8 text-center transition-all duration-300 ${
          dragging
            ? "border-brand bg-brand-soft"
            : "border-brand/30 bg-brand-soft/40 hover:border-brand/60 hover:bg-brand-soft/70"
        } ${pending ? "opacity-60" : ""}`}
      >
        {pending ? (
          <LoaderCircle className="size-6 animate-spin text-brand-strong" />
        ) : (
          <UploadCloud className="size-6 text-brand-strong" />
        )}
        <span className="text-sm font-medium">
          {pending ? "Envoi en cours…" : "Glissez un fichier ici, ou cliquez"}
        </span>
        <span className="text-xs text-muted-foreground">
          PDF, photos, Word, email · 25 Mo max
        </span>
      </button>
      {state.error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-red-600">
          <CircleAlert className="size-4 shrink-0" />
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="flex items-center gap-2 text-sm text-emerald-700">
          <CircleCheck className="size-4 shrink-0" />
          {state.success}
        </p>
      ) : null}
    </form>
    {modal ? <AnalysisModal analysis={modal} onClose={() => setModal(null)} /> : null}
    </>
  );
}
