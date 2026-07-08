"use client";

import { useActionState, useState } from "react";
import { Clock, CircleAlert, LoaderCircle, MessageSquarePlus, Sparkles, ShieldQuestion } from "lucide-react";
import { relativeDays } from "@/lib/format";
import { LETTER_KINDS } from "@/lib/cases/letter-meta";
import { recordDebtorReply, generateAdaptedResponse, type ReplyState } from "@/lib/cases/replies";
import { escalateCase, type EscState } from "@/lib/cases/escalation";
import { GenerateLetterButtons } from "@/components/app/letters";
import { ReviewLetter } from "@/components/app/review-letter";
import { RecordPayment } from "@/components/app/record-payment";

const INITIAL: ReplyState = {};

type PendingLetter = {
  id: string;
  subject: string;
  body_md: string;
  status: string;
  channel: string | null;
  approved_at: string | null;
};

/*
 * Phase 2 — Relancer et négocier. Flux NON linéaire piloté par l'état réel :
 *  1. un brouillon à valider  → relecture + envoi INLINE ;
 *  2. un retour non traité    → « rédiger la réponse adaptée » (run réel) ;
 *  3. sinon (attente)         → date + prochain courrier, « relancer maintenant »,
 *     et « le client a répondu ? » pour capturer le texte reçu.
 */
export function Phase2Flow({
  caseId,
  caseType,
  nextKind,
  nextActionAt,
  pendingLetter,
  hasUnhandledReply,
}: {
  caseId: string;
  caseType: string;
  nextKind: string | null;
  nextActionAt: string | null;
  pendingLetter: PendingLetter | null;
  hasUnhandledReply: boolean;
}) {
  const [replyState, replyAction, replyPending] = useActionState(recordDebtorReply, INITIAL);
  const [adaptState, adaptAction, adaptPending] = useActionState(generateAdaptedResponse, INITIAL);
  const [escState, escAction, escPending] = useActionState(escalateCase, {} as EscState);
  const [showReply, setShowReply] = useState(false);

  // 1. Un brouillon attend la relecture/validation → envoi inline.
  if (pendingLetter) {
    return (
      <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
        <h2 className="text-lg font-semibold">Relisez et validez</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Le brouillon est prêt. Relisez-le, choisissez le mode d’envoi, puis validez pour l’envoyer en votre nom.
        </p>
        <div className="mt-5">
          <ReviewLetter letter={pendingLetter} caseId={caseId} embedded />
        </div>
      </section>
    );
  }

  // 2. Le client a répondu (texte capturé) → réponse adaptée.
  if (hasUnhandledReply) {
    return (
      <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-brand-strong" />
          <h2 className="text-lg font-semibold">Le client a répondu</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Son message est enregistré. On rédige une réponse adaptée à partir de ce qu’il dit et des faits de votre dossier.
        </p>
        <form action={adaptAction} className="mt-5">
          <input type="hidden" name="caseId" value={caseId} />
          <button
            type="submit"
            disabled={adaptPending}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
          >
            {adaptPending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Rédiger la réponse adaptée
          </button>
          {adaptState.error ? (
            <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-red-600">
              <CircleAlert className="size-4 shrink-0" />
              {adaptState.error}
            </p>
          ) : null}
        </form>
      </section>
    );
  }

  // 3. En attente : date + prochain courrier + relance + capture d'un retour.
  const nextLabel = nextKind ? LETTER_KINDS[nextKind]?.label ?? nextKind : null;
  return (
    <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
      <div className="flex items-center gap-2">
        <Clock className="size-5 text-brand-strong" />
        <h2 className="text-lg font-semibold">En attente du client</h2>
      </div>

      {nextLabel ? (
        <div className="mt-4 rounded-2xl bg-brand-soft p-4 ring-1 ring-brand/20">
          <p className="text-sm">
            <span className="font-medium">Prochaine relance : {nextLabel}</span>
            {nextActionAt ? <span className="text-muted-foreground"> · {relativeDays(nextActionAt)}</span> : null}
          </p>
          <div className="mt-3">
            <GenerateLetterButtons caseId={caseId} caseType={caseType} kinds={[nextKind!]} primary />
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Toutes les relances ont été envoyées. Passez à la phase suivante pour envisager l’escalade.
        </p>
      )}

      <div className="mt-6 border-t pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Le client a répondu ?</p>
          {!showReply ? (
            <button
              type="button"
              onClick={() => setShowReply(true)}
              className="inline-flex items-center gap-2 rounded-full border bg-background px-3.5 py-2 text-sm font-medium transition-colors hover:border-brand/60 hover:bg-brand-soft"
            >
              <MessageSquarePlus className="size-4 text-brand-strong" />
              Oui, enregistrer son message
            </button>
          ) : null}
        </div>
        {showReply ? (
          <form action={replyAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="caseId" value={caseId} />
            <select
              name="via"
              defaultValue="email"
              className="w-full rounded-2xl border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand sm:w-56"
            >
              <option value="email">Reçu par email</option>
              <option value="phone">Par téléphone</option>
              <option value="postal">Par courrier</option>
              <option value="other">Autre</option>
            </select>
            <textarea
              name="body"
              rows={5}
              placeholder="Collez ici, mot pour mot, ce que le client a répondu."
              className="w-full rounded-2xl border bg-background p-4 text-sm leading-relaxed outline-none transition-colors focus:border-brand"
            />
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={replyPending}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-ink-soft active:scale-[0.98] disabled:opacity-60"
              >
                {replyPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Enregistrer le retour
              </button>
              <button
                type="button"
                onClick={() => setShowReply(false)}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Annuler
              </button>
              {replyState.error ? (
                <span role="alert" className="flex items-center gap-2 text-sm text-red-600">
                  <CircleAlert className="size-4 shrink-0" />
                  {replyState.error}
                </span>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>

      <div className="mt-6 border-t pt-6">
        <RecordPayment caseId={caseId} />
      </div>

      {caseType === "client_dispute" ? (
        <div className="mt-6 border-t pt-6">
          <p className="text-sm font-medium">La contestation reste bloquée ?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Préparez l’escalade : revue de robustesse par Jeanne, puis un modèle (médiation, conciliateur, ou dossier transmissible à un professionnel).
          </p>
          <form action={escAction} className="mt-3">
            <input type="hidden" name="caseId" value={caseId} />
            <button
              type="submit"
              disabled={escPending}
              className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:border-brand/60 hover:bg-brand-soft active:scale-[0.98] disabled:opacity-60"
            >
              {escPending ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldQuestion className="size-4 text-brand-strong" />}
              Passer en escalade
            </button>
            {escState.error ? (
              <p role="alert" className="mt-2 flex items-center gap-2 text-sm text-red-600">
                <CircleAlert className="size-4 shrink-0" />
                {escState.error}
              </p>
            ) : null}
          </form>
        </div>
      ) : null}
    </section>
  );
}
