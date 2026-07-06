"use client";

import { useState } from "react";
import { Check, PencilLine, Quote } from "lucide-react";
import { correctExtraction } from "@/lib/documents/actions";

const FIELD_LABEL: Record<string, string> = {
  amount_cents: "Montant",
  date: "Date",
  invoice_number: "N° de facture",
  party_name: "Partie",
};

/** Une valeur extraite d'une pièce : sourcée, avec confiance, et corrigeable. */
export function FactRow({
  fact,
  caseId,
}: {
  fact: {
    id: string;
    field_key: string;
    value_text: string | null;
    corrected_value: string | null;
    is_user_corrected: boolean;
    confidence: number;
    source_excerpt: string | null;
  };
  caseId: string;
}) {
  const [editing, setEditing] = useState(false);
  const value = fact.corrected_value ?? fact.value_text ?? "—";
  const low = fact.confidence < 0.7 && !fact.is_user_corrected;

  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {FIELD_LABEL[fact.field_key] ?? fact.field_key}
          </p>
          {editing ? (
            <form
              action={correctExtraction}
              className="mt-1.5 flex items-center gap-2"
            >
              <input type="hidden" name="id" value={fact.id} />
              <input type="hidden" name="caseId" value={caseId} />
              <input
                name="value"
                defaultValue={value}
                autoFocus
                className="w-40 rounded-lg border bg-background px-2.5 py-1 text-sm outline-none focus:border-brand"
              />
              <button
                type="submit"
                onClick={() => setEditing(false)}
                className="rounded-lg bg-brand p-1.5 text-brand-foreground"
                aria-label="Enregistrer"
              >
                <Check className="size-4" />
              </button>
            </form>
          ) : (
            <p className="mt-0.5 text-[15px] font-semibold">{value}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {fact.is_user_corrected ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
              corrigé
            </span>
          ) : low ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
              à vérifier
            </span>
          ) : null}
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Corriger"
            >
              <PencilLine className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
      {fact.source_excerpt ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground/80">
          <Quote className="mt-0.5 size-3 shrink-0" />
          <span className="line-clamp-2 italic">{fact.source_excerpt}</span>
        </p>
      ) : null}
    </div>
  );
}
