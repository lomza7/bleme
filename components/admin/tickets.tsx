"use client";

import { useActionState } from "react";
import { CircleAlert, CircleCheck, TicketPlus } from "lucide-react";
import { createTicket, type HermesState } from "@/lib/admin/hermes-actions";

const INITIAL: HermesState = {};

const inputCls =
  "rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand";

export function TicketCreateForm({
  agents = [],
}: {
  agents?: { key: string; prenom: string }[];
}) {
  const [state, action, pending] = useActionState(createTicket, INITIAL);
  return (
    <details className="group rounded-[1.75rem] border border-dashed bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-6 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <TicketPlus className="size-4 text-brand-strong" />
        Nouveau ticket
        <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Ouvrir</span>
      </summary>
      <form action={action} className="flex flex-col gap-3 border-t px-6 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
          <input
            name="title"
            required
            maxLength={160}
            placeholder="Titre du ticket"
            className={inputCls}
          />
          <select name="agent" defaultValue="" className={inputCls}>
            <option value="">Sans assignation</option>
            {agents.map((a) => (
              <option key={a.key} value={a.key}>
                {a.prenom}
              </option>
            ))}
          </select>
        </div>
        <textarea
          name="description"
          rows={3}
          maxLength={4000}
          placeholder="Détail (optionnel)…"
          className={inputCls}
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? "Création…" : "Créer le ticket"}
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
