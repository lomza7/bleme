"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";
import { getGenerationProgress } from "@/lib/cases/progress-actions";

/*
 * Superposition « l'agent travaille » : affichée pendant qu'une action serveur
 * fait tourner un agent (20 à 90 s, recherches Légifrance comprises).
 *
 * Avec `caseId`, elle lit en POLLING les étapes RÉELLES écrites par le serveur
 * (generation_progress) : « Vérification du droit applicable », « Socle
 * juridique vérifié : 3 articles · 1 décision », « Basile rédige… » — les
 * étapes passées s'empilent cochées, comme un fil de raisonnement. Sans
 * étape serveur (autres runs), un déroulé indicatif prend le relais.
 */

export type ThinkingAgent = {
  key: string;
  prenom: string;
  role: string;
  steps: string[];
};

export const THINKING_WRITERS: Record<"marius" | "lena" | "basile" | "jeanne", ThinkingAgent> = {
  marius: {
    key: "marius",
    prenom: "Marius",
    role: "Agent Impayés",
    steps: [
      "relit votre dossier et vos pièces",
      "vérifie les montants, dates et références",
      "consulte le droit applicable (Légifrance)",
      "rédige votre courrier",
      "relit, ajuste le ton et met en forme",
    ],
  },
  lena: {
    key: "lena",
    prenom: "Léna",
    role: "Agente Litiges",
    steps: [
      "relit la contestation et vos pièces",
      "confronte chaque grief aux éléments du dossier",
      "consulte le droit applicable (Légifrance)",
      "rédige la réponse, point par point",
      "relit et met en forme",
    ],
  },
  basile: {
    key: "basile",
    prenom: "Basile",
    role: "Agent Démarches & recours",
    steps: [
      "relit votre récit et vos pièces",
      "identifie la démarche et l'autorité compétente",
      "recherche les textes applicables (Légifrance, Service-Public)",
      "vérifie chaque référence sur les sources officielles",
      "rédige le courrier motivé",
      "relit et met en forme",
    ],
  },
  jeanne: {
    key: "jeanne",
    prenom: "Jeanne",
    role: "Agente Avocat du diable",
    steps: [
      "relit l'intégralité du dossier",
      "se met à la place de la partie adverse",
      "cherche les objections et les pièces qui les lèvent",
      "rédige sa revue, point par point",
    ],
  },
};

/** Choix du rédacteur d'un courrier : même règle que le serveur (letters.ts). */
export function writerFor(caseType: string, kind?: string): ThinkingAgent {
  if (kind === "response" || caseType === "client_dispute") return THINKING_WRITERS.lena;
  if (caseType === "admin_request") return THINKING_WRITERS.basile;
  return THINKING_WRITERS.marius;
}

const SCRIPT_STEP_MS = 3200;
const POLL_MS = 1500;

type LiveStep = { step: string; detail: string | null };

/**
 * Le contenu à état ne se monte que pendant l'attente : chaque ouverture
 * repart d'un état neuf (pas de reset synchrone dans un effet).
 */
export function AgentThinkingOverlay({
  agent,
  open,
  caseId,
}: {
  agent: ThinkingAgent;
  open: boolean;
  /** Fourni → étapes réelles du serveur (generation_progress) en polling. */
  caseId?: string;
}) {
  if (!open) return null;
  return <ThinkingCard agent={agent} caseId={caseId} />;
}

function ThinkingCard({ agent, caseId }: { agent: ThinkingAgent; caseId?: string }) {
  const reduce = useReducedMotion();
  const [scriptStep, setScriptStep] = useState(0);
  const [live, setLive] = useState<LiveStep[]>([]);
  const liveRef = useRef<LiveStep[]>([]);

  // Déroulé indicatif (repli tant qu'aucune étape réelle n'est arrivée).
  useEffect(() => {
    const timer = setInterval(
      () => setScriptStep((s) => Math.min(s + 1, agent.steps.length - 1)),
      SCRIPT_STEP_MS,
    );
    return () => clearInterval(timer);
  }, [agent.steps.length]);

  // Étapes réelles : polling du serveur, accumulées en fil (dédoublonnées).
  useEffect(() => {
    if (!caseId) return;
    let stop = false;
    const tick = async () => {
      try {
        const p = await getGenerationProgress(caseId);
        if (stop || !p) return;
        const prev = liveRef.current;
        if (prev[prev.length - 1]?.step !== p.step) {
          const next = [...prev, { step: p.step, detail: p.detail }].slice(-6);
          liveRef.current = next;
          setLive(next);
        }
      } catch {
        /* le polling ne casse jamais l'attente */
      }
    };
    void tick();
    const timer = setInterval(tick, POLL_MS);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [caseId]);

  const hasLive = live.length > 0;
  const current = hasLive ? live[live.length - 1] : null;
  const done = hasLive ? live.slice(0, -1) : [];

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-[1.75rem] border bg-card p-7 shadow-2xl shadow-zinc-950/20">
        <div className="flex items-center gap-4">
          <div className="relative">
            <SpriteAvatar src={`/agents/${agent.key}.webp`} alt={agent.prenom} className="h-14" />
            <span className="absolute -right-1 -top-1 flex size-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-3 rounded-full bg-brand" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold">{agent.prenom} est au travail</p>
            <p className="text-xs text-muted-foreground">{agent.role}</p>
          </div>
        </div>

        {/* Étapes passées (réelles), cochées au fil de l'eau. */}
        {done.length > 0 ? (
          <ul className="mt-5 flex flex-col gap-1.5">
            {done.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                <span className="min-w-0">
                  {s.step}
                  {s.detail ? <span className="text-muted-foreground/70"> — {s.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className={done.length > 0 ? "mt-2 min-h-10" : "mt-5 min-h-12"}>
          <AnimatePresence mode="wait">
            <motion.div
              key={current ? current.step : `script-${scriptStep}`}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="text-sm leading-relaxed"
            >
              <p className="font-medium">
                {current ? current.step : `${agent.prenom} ${agent.steps[scriptStep]}`}
                <AnimatedDots />
              </p>
              {current?.detail ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{current.detail}</p>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Barre de progression indicative (les runs durent 20 à 90 s). */}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 animate-[thinking-slide_1.6s_ease-in-out_infinite] rounded-full bg-brand motion-reduce:w-full motion-reduce:animate-none" />
        </div>
        <style>{`@keyframes thinking-slide { 0% { margin-left: -33%; } 100% { margin-left: 100%; } }`}</style>

        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Jusqu’à une minute : les références sont vérifiées en direct sur les sources
          officielles. Le brouillon n’est jamais envoyé sans votre validation.
        </p>
      </div>
    </div>
  );
}

function AnimatedDots() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v % 3) + 1), 450);
    return () => clearInterval(t);
  }, []);
  return <span aria-hidden>{".".repeat(n)}</span>;
}
