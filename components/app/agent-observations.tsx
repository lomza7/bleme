"use client";

import { useActionState } from "react";
import { Check, CircleAlert, MessageCircleQuestion, Scale, SkipForward } from "lucide-react";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";
import { answerObservation, closeObservation } from "@/lib/cases/observation-actions";

/*
 * Prises de parole des agents aux passages de relais (doc 07) : questions,
 * observations factuelles et points de vigilance appuyés sur des sources
 * juridiques vérifiées. L'utilisateur répond (sa réponse fait foi et rejoint
 * la mémoire des agents), acte ou écarte — rien n'est bloquant. Vocabulaire
 * documentaire uniquement : jamais de pronostic ni de conseil.
 */

export type ObservationItem = {
  id: string;
  agent_key: string;
  kind: "question" | "observation" | "vigilance";
  title: string;
  detail_md: string | null;
  legal_refs: { reference: string; portee: string }[];
  status: "open" | "answered" | "acknowledged" | "dismissed";
  answer_text: string | null;
};

const AGENT_META: Record<string, { prenom: string; role: string }> = {
  marius: { prenom: "Marius", role: "Agent Impayés" },
  lena: { prenom: "Léna", role: "Agente Litiges" },
  jeanne: { prenom: "Jeanne", role: "Agente Avocat du diable" },
  nora: { prenom: "Nora", role: "Agente Preuves" },
  sacha: { prenom: "Sacha", role: "Agent Vigie" },
  basile: { prenom: "Basile", role: "Agent Démarches & recours" },
};

const KIND_META: Record<ObservationItem["kind"], { label: string; className: string }> = {
  question: { label: "Question", className: "bg-brand-soft text-brand-strong" },
  observation: { label: "Observation", className: "bg-muted text-muted-foreground" },
  vigilance: { label: "Point de vigilance", className: "bg-amber-100 text-amber-800" },
};

function LegalRefs({ refs }: { refs: ObservationItem["legal_refs"] }) {
  if (!refs.length) return null;
  return (
    <div className="mt-3 rounded-2xl bg-muted/50 p-4">
      <div className="flex items-center gap-2">
        <Scale className="size-4 text-brand-strong" />
        <p className="text-[13px] font-semibold">Repères juridiques (sources vérifiées)</p>
      </div>
      <ul className="mt-2 space-y-1.5">
        {refs.map((r, i) => (
          <li key={i} className="text-[13px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{r.reference}</span>
            {r.portee ? ` — ${r.portee}` : ""}
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-xs text-muted-foreground">
        Repère documentaire, pas un conseil juridique — à faire valider par un professionnel en cas de doute.
      </p>
    </div>
  );
}

function ObservationRow({ item }: { item: ObservationItem }) {
  const [answerState, answerAction, answering] = useActionState(answerObservation, {});
  const [closeState, closeAction, closing] = useActionState(closeObservation, {});
  const agent = AGENT_META[item.agent_key] ?? { prenom: item.agent_key, role: "Agent" };
  const kind = KIND_META[item.kind];
  const open = item.status === "open";

  return (
    <div className="rounded-2xl border bg-background p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-soft">
          <SpriteAvatar src={`/agents/${item.agent_key}.webp`} alt={agent.prenom} className="h-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{agent.prenom}</p>
          <p className="text-xs text-muted-foreground">{agent.role}</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${kind.className}`}>{kind.label}</span>
      </div>

      <p className="mt-3 text-sm font-medium leading-relaxed">{item.title}</p>
      {item.detail_md ? (
        <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{item.detail_md}</p>
      ) : null}
      <LegalRefs refs={item.legal_refs} />

      {item.status === "answered" && item.answer_text ? (
        <div className="mt-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <p className="text-xs font-semibold text-emerald-800">Votre réponse (fait foi)</p>
          <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-emerald-900">{item.answer_text}</p>
        </div>
      ) : null}

      {open ? (
        <div className="mt-4 flex flex-col gap-2.5">
          <form action={answerAction} className="flex flex-col gap-2.5">
            <input type="hidden" name="observationId" value={item.id} />
            <textarea
              name="answer"
              rows={2}
              required
              placeholder={item.kind === "question" ? "Votre réponse — elle fait foi pour la suite du dossier" : "Précisez si besoin (votre mot fait foi)"}
              className="w-full rounded-xl border bg-background p-3 text-sm leading-relaxed outline-none transition-colors focus:border-brand"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={answering || closing}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:bg-ink-soft active:scale-[0.98] disabled:opacity-60"
              >
                <Check className="size-4" />
                {answering ? "Envoi…" : "Répondre"}
              </button>
              <button
                type="submit"
                form={`close-${item.id}`}
                disabled={answering || closing}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground disabled:opacity-60"
              >
                <SkipForward className="size-4" />
                {closing ? "…" : item.kind === "question" ? "Passer" : "C'est noté"}
              </button>
            </div>
          </form>
          <form id={`close-${item.id}`} action={closeAction}>
            <input type="hidden" name="observationId" value={item.id} />
            <input type="hidden" name="intent" value={item.kind === "question" ? "dismissed" : "acknowledged"} />
          </form>
          {answerState.error ? <p className="text-sm text-red-600">{answerState.error}</p> : null}
          {closeState.error ? <p className="text-sm text-red-600">{closeState.error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function AgentObservations({ items }: { items: ObservationItem[] }) {
  if (!items.length) return null;
  const openCount = items.filter((i) => i.status === "open").length;

  return (
    <section className="mt-6 rounded-[1.75rem] border bg-card p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageCircleQuestion className="size-5 text-brand-strong" />
          <h2 className="text-lg font-semibold">La parole de vos agents</h2>
        </div>
        {openCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            <CircleAlert className="size-3.5" />
            {openCount} en attente
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Au passage du dossier, l’agent qui le reprend signale ce qui mérite votre attention. Rien n’est bloquant — et votre réponse fait foi.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {items.map((item) => (
          <ObservationRow key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
