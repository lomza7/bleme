"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Download,
  Gavel,
  Handshake,
  LoaderCircle,
  Lock,
  ScanSearch,
  ShieldQuestion,
} from "lucide-react";
import {
  runDevilReview,
  generateEscalationDraft,
  escalateCase,
  recordSettlement,
  closeCase,
  type EscState,
} from "@/lib/cases/escalation";
import { recordPayment } from "@/lib/cases/actions";
import { ESCALATION_MODELS, type EscalationModel } from "@/lib/cases/escalation-templates";
import { ReviewLetter } from "@/components/app/review-letter";
import { PrintButton } from "@/components/app/print-button";

const INITIAL: EscState = {};

type PendingLetter = {
  id: string;
  subject: string;
  body_md: string;
  status: string;
  channel: string | null;
  approved_at: string | null;
};

type DevilReview = {
  points: { objection: string; remede: string }[];
  vigilances: string[];
};

/*
 * Phase 3 — Escalader et résoudre. Revue avocat du diable (Jeanne), modèles
 * d'escalade (recouvrement / injonction / échéancier), puis résolution. Aucun
 * vocabulaire de conseil : modèles et étapes documentaires uniquement.
 */
export function EscalationPanel({
  caseId,
  status,
  devilReview,
  escalationSummary,
  pendingLetter,
}: {
  caseId: string;
  status: string;
  devilReview: DevilReview | null;
  escalationSummary: string | null;
  pendingLetter: PendingLetter | null;
}) {
  const [devilState, devilAction, devilPending] = useActionState(runDevilReview, INITIAL);
  const [draftState, draftAction, draftPending] = useActionState(generateEscalationDraft, INITIAL);
  const [escState, escAction, escPending] = useActionState(escalateCase, INITIAL);
  const [payState, payAction, payPending] = useActionState(recordPayment, {});
  const [setState, setAction, setPending] = useActionState(recordSettlement, INITIAL);
  const [closeState, closeAction, closePending] = useActionState(closeCase, INITIAL);

  // Un modèle procédural (requête en injonction) se déroule / s'imprime, il ne
  // s'envoie pas en votre nom — on le distingue du reste par son sujet.
  const isProcedural = pendingLetter?.subject.startsWith("Modèle —");

  return (
    <div className="flex flex-col gap-4">
      {/* Brouillon d'escalade en cours → relecture/envoi (ou impression) inline */}
      {pendingLetter ? (
        <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
          <h2 className="text-lg font-semibold">{isProcedural ? "Modèle prêt" : "Relisez et validez"}</h2>
          {isProcedural ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                {ESCALATION_MODELS.payment_order_request.disclaimer}
              </p>
              <article className="mt-4 whitespace-pre-line rounded-2xl bg-muted/50 p-5 text-[14px] leading-relaxed">
                {pendingLetter.body_md}
              </article>
              <div className="mt-4">
                <PrintButton label="Imprimer le modèle" />
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Relisez, choisissez le mode d’envoi, puis validez pour l’envoyer en votre nom.
              </p>
              <div className="mt-5">
                <ReviewLetter letter={pendingLetter} caseId={caseId} embedded />
              </div>
            </>
          )}
        </section>
      ) : null}

      {/* 1. Revue avocat du diable (Jeanne) */}
      <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
        <div className="flex items-center gap-2">
          <ShieldQuestion className="size-5 text-brand-strong" />
          <h2 className="text-lg font-semibold">Passez le dossier au crible</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Jeanne examine le dossier du point de vue de la partie adverse : quelles objections, et quelle pièce corrige chaque point.
        </p>
        {devilReview ? (
          <div className="mt-5 flex flex-col gap-4">
            {devilReview.points.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {devilReview.points.map((p, i) => (
                  <li key={i} className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
                    <p className="text-[13px] font-medium text-amber-900">{p.objection}</p>
                    <p className="mt-1 flex items-start gap-1.5 text-[13px] text-amber-800">
                      <ArrowRight className="mt-0.5 size-3.5 shrink-0" />
                      {p.remede}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
            {devilReview.vigilances.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {devilReview.vigilances.map((v, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                    <span aria-hidden className="mt-0.5">•</span>
                    {v}
                  </li>
                ))}
              </ul>
            ) : null}
            <form action={devilAction}>
              <input type="hidden" name="caseId" value={caseId} />
              <button type="submit" disabled={devilPending} className="text-sm font-medium text-brand-strong disabled:opacity-60">
                {devilPending ? "Analyse en cours…" : "Relancer la revue"}
              </button>
            </form>
          </div>
        ) : (
          <form action={devilAction} className="mt-5">
            <input type="hidden" name="caseId" value={caseId} />
            <button
              type="submit"
              disabled={devilPending}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-ink-soft active:scale-[0.98] disabled:opacity-60"
            >
              {devilPending ? <LoaderCircle className="size-4 animate-spin" /> : <ScanSearch className="size-4" />}
              Lancer la revue
            </button>
            {devilState.error ? (
              <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-red-600">
                <CircleAlert className="size-4 shrink-0" />
                {devilState.error}
              </p>
            ) : null}
          </form>
        )}
      </section>

      {/* 2. Modèles d'escalade */}
      <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
        <div className="flex items-center gap-2">
          <Gavel className="size-5 text-brand-strong" />
          <h2 className="text-lg font-semibold">Modèles d’escalade</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Des modèles prêts à relire. À faire valider par un professionnel en cas de doute.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(Object.keys(ESCALATION_MODELS) as EscalationModel[]).map((model) => {
            const m = ESCALATION_MODELS[model];
            return (
              <form key={model} action={draftAction} className="flex flex-col rounded-2xl border bg-background p-4">
                <input type="hidden" name="caseId" value={caseId} />
                <input type="hidden" name="model" value={model} />
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {!m.sends ? <Lock className="size-3.5 text-muted-foreground" /> : null}
                  {m.label}
                </p>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{m.hint}</p>
                <button
                  type="submit"
                  disabled={draftPending}
                  className="mt-3 inline-flex items-center justify-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors hover:border-brand/60 hover:bg-brand-soft disabled:opacity-60"
                >
                  {draftPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
                  Préparer
                </button>
              </form>
            );
          })}
        </div>
        {draftState.error ? (
          <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-red-600">
            <CircleAlert className="size-4 shrink-0" />
            {draftState.error}
          </p>
        ) : null}

        {escalationSummary ? (
          <div className="mt-5 rounded-2xl bg-muted/40 p-4">
            <p className="text-sm font-medium">Synthèse d’escalade</p>
            <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{escalationSummary}</p>
          </div>
        ) : status !== "escalated" ? (
          <form action={escAction} className="mt-5 border-t pt-5">
            <input type="hidden" name="caseId" value={caseId} />
            <button type="submit" disabled={escPending} className="text-sm font-medium text-brand-strong disabled:opacity-60">
              {escPending ? "Préparation…" : "Passer le dossier en escalade et préparer une synthèse"}
            </button>
            {escState.error ? (
              <p role="alert" className="mt-2 flex items-center gap-2 text-sm text-red-600">
                <CircleAlert className="size-4 shrink-0" />
                {escState.error}
              </p>
            ) : null}
          </form>
        ) : null}
      </section>

      {/* 3. Résolution */}
      <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
        <div className="flex items-center gap-2">
          <Handshake className="size-5 text-brand-strong" />
          <h2 className="text-lg font-semibold">Conclure</h2>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Paiement reçu */}
          <form action={payAction} className="flex flex-col gap-2 rounded-2xl border bg-background p-4">
            <input type="hidden" name="caseId" value={caseId} />
            <p className="text-sm font-medium">Paiement reçu</p>
            <input
              name="amount"
              inputMode="decimal"
              placeholder="Montant (€)"
              className="rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button type="submit" disabled={payPending} className="rounded-full bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60">
              {payPending ? "…" : "Enregistrer"}
            </button>
            {payState.error ? <p className="text-xs text-red-600">{payState.error}</p> : null}
          </form>

          {/* Accord amiable */}
          <form action={setAction} className="flex flex-col gap-2 rounded-2xl border bg-background p-4">
            <input type="hidden" name="caseId" value={caseId} />
            <p className="text-sm font-medium">Accord amiable</p>
            <input
              name="note"
              placeholder="Ex. 3 × 800 € dès le 5 août"
              className="rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button type="submit" disabled={setPending} className="rounded-full border px-3.5 py-2 text-sm font-medium transition-colors hover:border-brand/60 hover:bg-brand-soft disabled:opacity-60">
              {setPending ? "…" : "Acter l’accord"}
            </button>
            {setState.error ? <p className="text-xs text-red-600">{setState.error}</p> : null}
          </form>

          {/* Clôturer */}
          <form action={closeAction} className="flex flex-col gap-2 rounded-2xl border bg-background p-4">
            <input type="hidden" name="caseId" value={caseId} />
            <p className="text-sm font-medium">Clôturer</p>
            <select name="reason" defaultValue="paid" className="rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-brand">
              <option value="paid">Payé</option>
              <option value="settlement">Accord trouvé</option>
              <option value="abandoned">Abandonné</option>
              <option value="other">Autre</option>
            </select>
            <button type="submit" disabled={closePending} className="rounded-full border px-3.5 py-2 text-sm font-medium transition-colors hover:border-foreground/30 disabled:opacity-60">
              {closePending ? "…" : "Clôturer le dossier"}
            </button>
            {closeState.error ? <p className="text-xs text-red-600">{closeState.error}</p> : null}
          </form>
        </div>
        {setState.success || closeState.success ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
            <CircleCheck className="size-4 shrink-0" />
            {setState.success || closeState.success}
          </p>
        ) : null}

        <div className="mt-5 border-t pt-5">
          <Link
            href={`/app/dossiers/${caseId}/export`}
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-strong"
          >
            <Download className="size-4" />
            Exporter le dossier (récap, courriers, preuve de validation)
          </Link>
        </div>
      </section>
    </div>
  );
}
