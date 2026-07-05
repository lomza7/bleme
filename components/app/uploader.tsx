"use client";

import { useActionState, useRef, useState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, UploadCloud } from "lucide-react";
import { uploadDocument, type DocState } from "@/lib/documents/actions";

const INITIAL: DocState = {};

/** Zone de dépôt : clic ou glisser-déposer, envoi immédiat. */
export function Uploader({ scope }: { scope: string }) {
  const [state, action, pending] = useActionState(uploadDocument, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function submitFiles(files: FileList | null) {
    if (!files || files.length === 0 || !inputRef.current) return;
    inputRef.current.files = files;
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="scope" value={scope} />
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
  );
}
