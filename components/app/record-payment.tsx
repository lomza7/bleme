"use client";

import { useActionState } from "react";
import { BanknoteArrowDown } from "lucide-react";
import { recordPayment } from "@/lib/cases/actions";

export function RecordPayment({ caseId }: { caseId: string }) {
  const [state, action, pending] = useActionState(recordPayment, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="caseId" value={caseId} />
      <label htmlFor="amount" className="text-sm font-medium">
        Paiement reçu ?
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id="amount"
            name="amount"
            inputMode="decimal"
            placeholder="1 200"
            required
            className="w-full rounded-2xl border bg-background px-4 py-2.5 pr-9 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            €
          </span>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
        >
          <BanknoteArrowDown className="size-4" />
          {pending ? "…" : "Enregistrer"}
        </button>
      </div>
      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Le dossier passe en « résolu » quand le total réclamé est encaissé.
      </p>
    </form>
  );
}
