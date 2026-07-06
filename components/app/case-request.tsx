"use client";

import { useActionState, useState } from "react";
import { CircleCheck, CircleAlert, LoaderCircle } from "lucide-react";
import { updateCaseRequest } from "@/lib/cases/actions";

const INITIAL: { error?: string; success?: string } = {};

/*
 * Étape « Demande » (Phase 1) : récap éditable de ce qui est réclamé — client,
 * montant, objet. La valeur du dossier prime (pilier #3) ; montant en euros
 * converti en centimes côté serveur.
 */
export function CaseRequest({
  caseId,
  debtorName,
  amountCents,
  subject,
}: {
  caseId: string;
  debtorName: string;
  amountCents: number;
  subject: string;
}) {
  const [state, action, pending] = useActionState(updateCaseRequest, INITIAL);
  const [name, setName] = useState(debtorName);
  const [amount, setAmount] = useState(amountCents ? (amountCents / 100).toString() : "");
  const [obj, setObj] = useState(subject);

  return (
    <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
      <h2 className="text-lg font-semibold">Votre demande</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ce que vous réclamez, à qui, et pour quel objet. C’est la base de toute la séquence — vous pouvez le corriger à tout moment.
      </p>
      <form action={action} className="mt-5 flex flex-col gap-4">
        <input type="hidden" name="caseId" value={caseId} />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Client / débiteur</span>
          <input
            name="debtorName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-2xl border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Montant réclamé (€)</span>
          <input
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="rounded-2xl border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Objet</span>
          <textarea
            name="subject"
            value={obj}
            onChange={(e) => setObj(e.target.value)}
            rows={4}
            placeholder="Ex. Facture 2026-051, prestation livrée le 12 mai, impayée depuis 45 jours."
            className="rounded-2xl border bg-background px-4 py-2.5 text-sm leading-relaxed outline-none transition-colors focus:border-brand"
          />
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-ink-soft active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Enregistrer la demande
          </button>
          {state.error ? (
            <span role="alert" className="flex items-center gap-2 text-sm text-red-600">
              <CircleAlert className="size-4 shrink-0" />
              {state.error}
            </span>
          ) : null}
          {state.success ? (
            <span role="status" className="flex items-center gap-2 text-sm text-emerald-700">
              <CircleCheck className="size-4 shrink-0" />
              {state.success}
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
