"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Check,
  CircleAlert,
  FileSearch,
  LoaderCircle,
  Quote,
  ShieldCheck,
  Sparkles,
  Tag,
} from "lucide-react";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";
import {
  analyzeEmailForCase,
  confirmEmailMerge,
  type EditableFact,
  type EmailAnalysisResult,
} from "@/lib/inbox/actions";

const EASE = [0.16, 1, 0.3, 1] as const;
const STEP_ICON = [FileSearch, Tag, Sparkles, ShieldCheck];

// Liste présentationnelle (le module serveur completeness.ts est server-only).
const DOC_KINDS = [
  { value: "facture", label: "Facture" },
  { value: "devis_contrat", label: "Devis / contrat" },
  { value: "preuve_envoi", label: "Preuve d’envoi / réception" },
  { value: "preuve_livraison", label: "Preuve de livraison / photos" },
  { value: "echanges", label: "Échanges (email, SMS, WhatsApp)" },
  { value: "autre", label: "Autre pièce" },
];

const AGENT = {
  nora: { name: "Nora", src: "/agents/nora.webp" },
  lena: { name: "Léna", src: "/agents/lena.webp" },
} as const;

function eur(cents: number) {
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €`;
}

type Data = Exclude<EmailAnalysisResult, { error: string }>;

/*
 * Popup « l'agent analyse l'email » : au montage, appelle analyzeEmailForCase
 * (aucune écriture), révèle les étapes (lecture → classement → extraction →
 * cohérence) sur données réelles, laisse CORRIGER les valeurs, puis verse au
 * dossier via confirmEmailMerge à la validation explicite. Registre non-juridique.
 */
export function EmailAnalysisModal({
  itemId,
  caseId,
  caseTitle,
  caseType,
  onDone,
  onCancel,
}: {
  itemId: string;
  caseId: string;
  caseTitle: string;
  caseType: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"working" | "reveal" | "error">("working");
  const [data, setData] = useState<Data | null>(null);
  const [step, setStep] = useState(reduce ? 4 : 0);
  const [errMsg, setErrMsg] = useState("");
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [docKind, setDocKind] = useState("echanges");
  const [applyAmount, setApplyAmount] = useState(false);
  const [saving, setSaving] = useState(false);
  const started = useRef(false);

  const agentKey = data?.agent ?? (caseType === "client_dispute" ? "lena" : "nora");
  const agent = AGENT[agentKey];

  // Analyse (une fois), sans écriture. Les setState sont après await (pas de
  // mismatch, pas de set-state-in-effect synchrone).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const res = await analyzeEmailForCase({ itemId, caseId });
      if ("error" in res) {
        setErrMsg(res.error);
        setPhase("error");
        return;
      }
      setData(res);
      setDocKind(res.suggestedDocKind);
      setPhase("reveal");
    })();
  }, [itemId, caseId]);

  // Révélation par étapes (uniquement via setTimeout → jamais de setState synchrone).
  useEffect(() => {
    if (phase !== "reveal" || reduce) return;
    const timers = [0, 1, 2, 3].map((i) => setTimeout(() => setStep(i + 1), 500 + i * 700));
    return () => timers.forEach(clearTimeout);
  }, [phase, reduce]);

  function retry() {
    setErrMsg("");
    setStep(reduce ? 4 : 0);
    setPhase("working");
    (async () => {
      const res = await analyzeEmailForCase({ itemId, caseId });
      if ("error" in res) {
        setErrMsg(res.error);
        setPhase("error");
        return;
      }
      setData(res);
      setDocKind(res.suggestedDocKind);
      setPhase("reveal");
    })();
  }

  async function confirmMerge() {
    if (!data || saving) return;
    setSaving(true);
    setErrMsg("");
    const facts: EditableFact[] = data.facts.map((f, i) => {
      const edited = edits[i];
      const corrected =
        edited !== undefined && edited.trim() && edited.trim() !== f.value_text ? edited.trim() : null;
      return { ...f, corrected };
    });
    const res = await confirmEmailMerge({
      itemId,
      caseId,
      docKind,
      applyAmountCents: applyAmount && data.suggestedAmountCents ? data.suggestedAmountCents : null,
      facts,
    });
    if (res.error) {
      setErrMsg(res.error);
      setSaving(false);
      return;
    }
    onDone();
  }

  async function mergeWithoutAnalysis() {
    if (saving) return;
    setSaving(true);
    setErrMsg("");
    const res = await confirmEmailMerge({
      itemId,
      caseId,
      docKind: "echanges",
      applyAmountCents: null,
      facts: [],
    });
    if (res.error) {
      setErrMsg(res.error);
      setSaving(false);
      return;
    }
    onDone();
  }

  const done = phase === "reveal" && step >= 4;
  const warns = data ? data.analysis.coherence.filter((c) => c.level === "warn").length : 0;

  const STEPS = data
    ? [
        { label: "Lecture de l’email", result: data.analysis.fileName },
        { label: "Classement", result: data.analysis.kindLabel },
        { label: "Extraction des informations", result: null },
        { label: "Vérification de cohérence", result: null },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.button
        aria-label="Fermer"
        onClick={() => {
          if (!saving) onCancel();
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        role="dialog"
        aria-modal
        initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem] border bg-card shadow-2xl"
      >
        {/* En-tête agent */}
        <div className="flex items-center gap-3 border-b bg-gradient-to-b from-brand-soft/70 to-card p-5">
          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-brand-soft to-brand/15 ring-1 ring-brand/25">
            <SpriteAvatar src={agent.src} alt={agent.name} className="h-10" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {phase === "error"
                ? `${agent.name} n’a pas pu analyser`
                : done
                  ? "Relisez, corrigez, puis versez"
                  : `${agent.name} analyse cet email`}
            </p>
            <p className="truncate text-xs text-muted-foreground">Vers « {caseTitle} »</p>
          </div>
          {phase === "working" ? (
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-2 animate-bounce rounded-full bg-brand"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          ) : null}
        </div>

        {/* Corps */}
        <div className="min-h-[9rem] flex-1 overflow-y-auto p-5">
          {phase === "working" ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
              <LoaderCircle className="size-7 animate-spin text-brand-strong" />
              <p className="text-sm text-muted-foreground">
                {agent.name} lit l’email et le compare à votre dossier — quelques secondes.
              </p>
            </div>
          ) : phase === "error" ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <CircleAlert className="size-5" />
              </span>
              <p className="text-sm font-medium">{errMsg}</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Vous pouvez verser l’email au dossier sans analyse, ou réessayer.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {/* Étapes révélées */}
              {STEPS.map((s, i) => {
                const state = i < step ? "done" : i === step ? "busy" : "todo";
                if (state === "todo") return null;
                const Icon = STEP_ICON[i];
                return (
                  <motion.div
                    key={s.label}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="flex items-start gap-3 rounded-2xl px-2 py-2"
                  >
                    <span
                      className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
                        state === "busy"
                          ? "bg-brand-soft text-brand-strong"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {state === "busy" ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <Icon className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {s.label}
                        {state === "busy" ? "…" : ""}
                      </p>
                      {state === "done" && i === 0 ? (
                        <p className="truncate text-xs text-muted-foreground">{s.result}</p>
                      ) : null}
                      {state === "done" && i === 1 && data ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              data.analysis.kindConfirmed
                                ? "bg-brand-soft text-brand-strong"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {data.analysis.kindLabel}
                          </span>
                        </div>
                      ) : null}
                      {state === "done" && i === 2 && data ? (
                        data.facts.length ? (
                          <p className="text-xs text-muted-foreground">
                            {data.facts.length} information{data.facts.length > 1 ? "s" : ""} repérée
                            {data.facts.length > 1 ? "s" : ""}.
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Aucune information chiffrée repérée.
                          </p>
                        )
                      ) : null}
                      {state === "done" && i === 3 && data ? (
                        <ul className="mt-1.5 flex flex-col gap-1">
                          {data.analysis.coherence.map((c, k) => (
                            <li key={k} className="flex items-start gap-1.5 text-xs">
                              {c.level === "warn" ? (
                                <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                              ) : (
                                <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                              )}
                              <span className={c.level === "warn" ? "text-amber-800" : "text-muted-foreground"}>
                                {c.message}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </motion.div>
                );
              })}

              {/* Formulaire éditable une fois l'analyse déroulée */}
              {done && data ? (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="mt-2 flex flex-col gap-3 border-t pt-4"
                >
                  {data.facts.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                        Informations à verser (corrigez si besoin)
                      </p>
                      {data.facts.map((f, i) => {
                        const low = f.confidence < 0.7;
                        return (
                          <div key={i} className="rounded-2xl border bg-background p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                {f.label}
                              </span>
                              {low ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                                  à vérifier
                                </span>
                              ) : null}
                            </div>
                            <input
                              value={edits[i] ?? f.value_text}
                              onChange={(e) => setEdits((p) => ({ ...p, [i]: e.target.value }))}
                              className="mt-1.5 w-full rounded-lg border bg-background px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-brand"
                            />
                            {f.source_excerpt ? (
                              <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground/80">
                                <Quote className="mt-0.5 size-3 shrink-0" />
                                <span className="line-clamp-2 italic">{f.source_excerpt}</span>
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Type de pièce
                    </span>
                    <select
                      value={docKind}
                      onChange={(e) => setDocKind(e.target.value)}
                      className="rounded-xl border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-brand"
                    >
                      {DOC_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {data.suggestedAmountCents != null && data.caseAmountCents === 0 ? (
                    <label className="flex items-start gap-2.5 rounded-2xl bg-brand-soft/40 p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={applyAmount}
                        onChange={(e) => setApplyAmount(e.target.checked)}
                        className="mt-0.5 size-4 accent-brand"
                      />
                      <span>
                        Utiliser <strong>{eur(data.suggestedAmountCents)}</strong> comme montant réclamé du
                        dossier (aucun montant n’est encore renseigné).
                      </span>
                    </label>
                  ) : null}
                </motion.div>
              ) : null}
            </div>
          )}
        </div>

        {/* Pied : validation explicite */}
        <div className="border-t bg-muted/30 p-5">
          {errMsg && phase !== "error" ? (
            <p role="alert" className="mb-3 flex items-center gap-2 text-sm text-red-600">
              <CircleAlert className="size-4 shrink-0" />
              {errMsg}
            </p>
          ) : null}
          {phase === "error" ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={mergeWithoutAnalysis}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-ink-soft active:scale-[0.98] disabled:opacity-60"
              >
                Verser sans analyse
              </button>
              <button
                type="button"
                onClick={retry}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Réessayer
              </button>
            </div>
          ) : done ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={confirmMerge}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
              >
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
                {saving ? "Versement…" : "J’ai vérifié, verser au dossier"}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
              >
                Annuler
              </button>
              {warns > 0 ? (
                <span className="ml-auto text-xs text-amber-700">
                  {warns} point{warns > 1 ? "s" : ""} à vérifier
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">{agent.name} travaille…</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
