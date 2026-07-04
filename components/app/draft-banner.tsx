"use client";

import { useActionState, useEffect, useMemo, useSyncExternalStore } from "react";
import { ArrowRight, FileClock, X } from "lucide-react";
import { createCaseFromDraft } from "@/lib/cases/actions";

const DRAFT_KEY = "bleme.draft";

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function readDraft() {
  return localStorage.getItem(DRAFT_KEY);
}
function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
  listeners.forEach((l) => l());
}

type Draft = {
  kind: "unpaid" | "dispute" | "admin";
  partyName: string;
  amount: string;
};

/** Reprend le brouillon du wizard (localStorage) et le transforme en dossier. */
export function DraftBanner() {
  const raw = useSyncExternalStore(subscribe, readDraft, () => null);
  const [state, action, pending] = useActionState(createCaseFromDraft, {});

  const draft = useMemo<Draft | null>(() => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Draft;
      return parsed.kind && parsed.kind !== "admin" && parsed.partyName
        ? parsed
        : null;
    } catch {
      return null;
    }
  }, [raw]);

  // Création échouée : on restaure le brouillon retiré à la soumission.
  useEffect(() => {
    if (state.error && raw) localStorage.setItem(DRAFT_KEY, raw);
  }, [state.error, raw]);

  if (!draft || !raw) return null;

  return (
    <div className="flex flex-col gap-4 rounded-[1.75rem] bg-brand-soft p-6 ring-1 ring-brand/25 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand-strong">
          <FileClock className="size-5" />
        </span>
        <div>
          <p className="font-semibold">
            Votre brouillon vous attend : {draft.kind === "unpaid" ? "impayé" : "litige"} avec {draft.partyName}
            {draft.amount ? ` (${draft.amount} €)` : ""}.
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Votre récit et vos réponses sont conservés. Ouvrez le dossier pour
            continuer.
          </p>
          {state.error ? (
            <p className="mt-1 text-sm text-red-600">{state.error}</p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <form action={action} onSubmit={() => localStorage.removeItem(DRAFT_KEY)}>
          <input type="hidden" name="draft" value={raw} />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? "Ouverture…" : "Ouvrir le dossier"}
            <ArrowRight className="size-4" />
          </button>
        </form>
        <button
          type="button"
          onClick={clearDraft}
          aria-label="Ignorer le brouillon"
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:bg-black/5 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
