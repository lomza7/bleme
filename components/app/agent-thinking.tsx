"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";

/*
 * Superposition « l'agent travaille » : affichée pendant qu'une action serveur
 * fait tourner un agent (rédaction de courrier, réponse adaptée, revue…).
 * Un run réel prend 20 à 90 s (recherches Légifrance comprises) : l'utilisateur
 * voit QUI travaille et À QUOI il passe ce temps, au lieu d'un simple spinner.
 * Les étapes sont indicatives (pas de télémétrie temps réel) — formulées comme
 * le déroulé réel du run, jamais comme des promesses de résultat.
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

const STEP_MS = 3200;

/**
 * Le contenu à état ne se monte que pendant l'attente : chaque ouverture
 * repart d'un état neuf (pas de reset synchrone dans un effet).
 */
export function AgentThinkingOverlay({ agent, open }: { agent: ThinkingAgent; open: boolean }) {
  if (!open) return null;
  return <ThinkingCard agent={agent} />;
}

function ThinkingCard({ agent }: { agent: ThinkingAgent }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    // On avance dans les étapes puis on RESTE sur la dernière (pas de boucle :
    // revoir défiler « relit votre dossier » après 60 s casserait la confiance).
    const timer = setInterval(
      () => setStep((s) => Math.min(s + 1, agent.steps.length - 1)),
      STEP_MS,
    );
    return () => clearInterval(timer);
  }, [agent.steps.length]);

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

        <div className="mt-5 min-h-12">
          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="text-sm leading-relaxed"
            >
              {agent.prenom} {agent.steps[step]}
              <AnimatedDots />
            </motion.p>
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
