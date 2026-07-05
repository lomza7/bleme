"use client";

import { useActionState } from "react";
import { CalendarClock, CircleAlert, CircleCheck } from "lucide-react";
import { createRoutine, type HermesState } from "@/lib/admin/hermes-actions";

const INITIAL: HermesState = {};

const inputCls =
  "rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand";

export function RoutineCreateForm() {
  const [state, action, pending] = useActionState(createRoutine, INITIAL);
  return (
    <details className="group rounded-[1.75rem] border border-dashed bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-6 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <CalendarClock className="size-4 text-brand-strong" />
        Nouvelle routine (cron)
        <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Ouvrir</span>
      </summary>
      <form action={action} className="flex flex-col gap-3 border-t px-6 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            name="title"
            required
            maxLength={120}
            placeholder="Titre (ex. Rapport quotidien des dossiers dormants)"
            className={inputCls}
          />
          <input
            name="cron"
            placeholder="Cron (ex. 0 8 * * 1-5) — vide = manuel"
            className={`${inputCls} font-mono text-xs`}
          />
        </div>
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          placeholder="Ce que l'agent doit faire à chaque déclenchement…"
          className={inputCls}
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? "Création…" : "Créer la routine"}
          </button>
          {state.error ? (
            <p role="alert" className="flex items-center gap-2 text-xs text-red-600">
              <CircleAlert className="size-3.5" />
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p role="status" className="flex items-center gap-2 text-xs text-emerald-700">
              <CircleCheck className="size-3.5" />
              {state.success}
            </p>
          ) : null}
        </div>
      </form>
    </details>
  );
}
