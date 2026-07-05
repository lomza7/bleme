"use client";

import { useActionState } from "react";
import { CircleAlert, CircleCheck, UserPlus } from "lucide-react";
import { createPcAgent, type HermesState } from "@/lib/admin/hermes-actions";

const INITIAL: HermesState = {};

const inputCls =
  "rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand";

/** Créer un agent Paperclip depuis la console, avec rattachement hiérarchique. */
export function PcAgentCreateForm({
  agents,
}: {
  agents: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createPcAgent, INITIAL);
  return (
    <details className="group rounded-[1.75rem] border border-dashed bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-6 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <UserPlus className="size-4 text-brand-strong" />
        Créer un agent
        <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Ouvrir</span>
      </summary>
      <form action={action} className="flex flex-col gap-3 border-t px-6 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            name="name"
            required
            minLength={2}
            maxLength={60}
            placeholder="Nom (ex. Greffier)"
            className={inputCls}
          />
          <input
            name="title"
            maxLength={80}
            placeholder="Titre (ex. Assistant de Marius)"
            className={inputCls}
          />
          <select name="reportsTo" defaultValue="" className={inputCls}>
            <option value="">Rattaché au Board</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                Rattaché à {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? "Création…" : "Créer l’agent"}
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
