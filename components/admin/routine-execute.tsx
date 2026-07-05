"use client";

import { useActionState } from "react";
import { CircleAlert, CircleCheck, Play } from "lucide-react";
import { executeRoutine, type HermesState } from "@/lib/admin/hermes-actions";

const INITIAL: HermesState = {};

/** Exécute la routine via le moteur Hermes de l'agent lié (rapport → ticket). */
export function ExecuteRoutineButton({ id, title }: { id: string; title: string }) {
  const [state, action, pending] = useActionState(executeRoutine, INITIAL);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="title" value={title} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors hover:border-brand/50 hover:text-brand-strong disabled:opacity-60"
      >
        <Play className="size-3" />
        {pending ? "Exécution…" : "Lancer maintenant"}
      </button>
      {state.error ? (
        <p role="alert" className="flex max-w-72 items-center gap-1.5 text-[11px] text-red-600">
          <CircleAlert className="size-3 shrink-0" />
          <span className="truncate">{state.error}</span>
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="flex max-w-96 items-center gap-1.5 text-[11px] text-emerald-700">
          <CircleCheck className="size-3 shrink-0" />
          <span className="truncate">{state.success}</span>
        </p>
      ) : null}
    </form>
  );
}
