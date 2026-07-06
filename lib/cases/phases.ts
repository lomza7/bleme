// Cycle de vie du dossier en 3 phases. Module PUR (pas de "use server" ni
// "server-only") : c'est la SOURCE DE VÉRITÉ de la phase, importée à la fois par
// le recalcul serveur (recomputeCaseProgress) et par l'affichage (RSC + client).
// Aucun vocabulaire de conseil juridique dans les libellés.

export type Phase = 1 | 2 | 3;

export const PHASE_META: {
  n: Phase;
  key: string;
  label: string;
  sub: string;
  agentKey: string;
}[] = [
  { n: 1, key: "preparer", label: "Préparer et lancer", sub: "Rassemblez les preuves, vérifiez les faits, envoyez la première relance.", agentKey: "marius" },
  { n: 2, key: "relancer", label: "Relancer et négocier", sub: "Suivez l’échéance, relancez, et adaptez la réponse au retour du client.", agentKey: "sacha" },
  { n: 3, key: "resoudre", label: "Escalader et résoudre", sub: "Passez le dossier au crible, préparez l’escalade, puis concluez.", agentKey: "jeanne" },
];

export function phaseMeta(phase: Phase) {
  return PHASE_META[phase - 1];
}

// Échelle d'escalade des courriers d'un impayé (dans l'ordre).
export const ESCALATION_ORDER = ["reminder_1", "reminder_2", "formal_notice"] as const;

/**
 * Phase dérivée de l'état RÉEL (statut + courriers envoyés). Fonction pure,
 * seule vérité : recompute la persiste en cache dans cases.phase.
 * P1 tant qu'aucun courrier n'est parti ; P2 dès qu'une relance est envoyée ;
 * P3 dès la mise en demeure ou une escalade explicite.
 */
export function derivePhase({
  status,
  sentKinds,
}: {
  status: string;
  sentKinds: string[];
}): Phase {
  if (status === "escalated") return 3;
  if (sentKinds.includes("formal_notice")) return 3;
  if (sentKinds.length > 0) return 2;
  return 1;
}

/**
 * Prochain courrier à préparer selon les courriers déjà envoyés.
 * Impayé : premier cran manquant de l'échelle (null si épuisée → endgame P3).
 * Litige : 'response' (répétable, une réponse par retour du client).
 */
export function nextLetterKind(caseType: string, sentKinds: string[]): string | null {
  if (caseType === "client_dispute") return "response";
  for (const kind of ESCALATION_ORDER) {
    if (!sentKinds.includes(kind)) return kind;
  }
  return null;
}
