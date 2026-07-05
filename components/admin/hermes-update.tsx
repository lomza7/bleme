"use client";

import { useActionState } from "react";
import { CircleAlert, CircleCheck, RefreshCw, Undo2 } from "lucide-react";
import {
  rollbackHermes,
  updateHermes,
  type HermesState,
} from "@/lib/admin/hermes-actions";

const INITIAL: HermesState = {};

function Feedback({ state }: { state: HermesState }) {
  if (state.error) {
    return (
      <p role="alert" className="flex items-center gap-2 text-xs text-red-600">
        <CircleAlert className="size-3.5 shrink-0" />
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="flex items-center gap-2 text-xs text-emerald-700">
        <CircleCheck className="size-3.5 shrink-0" />
        {state.success}
      </p>
    );
  }
  return null;
}

export function HermesUpdateControls({
  behind,
  rollbackAvailable,
}: {
  behind: number | null;
  rollbackAvailable: boolean;
}) {
  const [updState, updAction, updPending] = useActionState(updateHermes, INITIAL);
  const [rbState, rbAction, rbPending] = useActionState(rollbackHermes, INITIAL);

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={updAction}>
          <button
            type="submit"
            disabled={updPending || behind === 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-[11px] font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-50"
          >
            <RefreshCw className={`size-3 ${updPending ? "animate-spin" : ""}`} />
            {updPending
              ? "Mise à jour…"
              : behind === 0
                ? "À la dernière version"
                : "Mettre à jour Hermes"}
          </button>
        </form>
        {rollbackAvailable ? (
          <form action={rbAction}>
            <button
              type="submit"
              disabled={rbPending}
              className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-amber-300 hover:text-amber-700 disabled:opacity-50"
            >
              <Undo2 className="size-3" />
              {rbPending ? "Retour…" : "Revenir à la version d’avant"}
            </button>
          </form>
        ) : null}
      </div>
      <Feedback state={updState} />
      <Feedback state={rbState} />
    </div>
  );
}
