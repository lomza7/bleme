// Métadonnées des courriers (partagées serveur + client). Pas de "use server"
// ici : un module d'actions ne peut exporter que des fonctions async.

import { FIXED_INDEMNITY_CENTS } from "@/lib/cases/constants";

/** Indemnité forfaitaire de recouvrement, déjà formatée en euros (ex. « 40 € »). */
export const INDEMNITE_FORFAITAIRE = `${(FIXED_INDEMNITY_CENTS / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €`;

export const MENTION_RETARD_B2B =
  `Entre professionnels, tout retard de paiement fait courir de plein droit des intérêts de retard ` +
  `ainsi qu'une indemnité forfaitaire de recouvrement de ${INDEMNITE_FORFAITAIRE} par facture ` +
  `(art. L441-10 et D441-5 du Code de commerce).`;
const MENTION_MISE_EN_DEMEURE =
  `La présente vaut mise en demeure au sens des articles 1231-6 et 1344 du Code civil.`;

/** Palier de fermeté : 1 cordial → 3 mise en demeure ; 0 = hors échelle (litige, personnalisé). */
export const LETTER_PALIER: Record<string, number> = {
  reminder_1: 1,
  reminder_2: 2,
  formal_notice: 3,
  response: 0,
  custom: 0,
};

/**
 * Mentions légales obligatoires à reproduire MOT POUR MOT selon le courrier
 * (le prompt de Marius les insère telles quelles, sans en inventer d'autres).
 */
export const LETTER_MENTIONS: Record<string, string[]> = {
  reminder_1: [],
  reminder_2: [MENTION_RETARD_B2B],
  formal_notice: [MENTION_RETARD_B2B, MENTION_MISE_EN_DEMEURE],
  response: [],
  custom: [],
};

export const LETTER_KINDS: Record<
  string,
  { label: string; tone: string; caseTypes: string[] }
> = {
  reminder_1: { label: "Relance cordiale", tone: "cordial", caseTypes: ["unpaid_invoice"] },
  reminder_2: { label: "Relance ferme", tone: "ferme", caseTypes: ["unpaid_invoice"] },
  formal_notice: { label: "Mise en demeure", tone: "ferme", caseTypes: ["unpaid_invoice"] },
  response: { label: "Réponse à la contestation", tone: "factuel", caseTypes: ["client_dispute"] },
  // Courriers créés par programme (réponse adaptée à un retour, modèles
  // d'escalade P3) : jamais proposés comme bouton générique (caseTypes vide) ;
  // le sujet du courrier porte le libellé précis.
  custom: { label: "Courrier personnalisé", tone: "factuel", caseTypes: [] },
};

export const LETTER_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  edited: "Modifié",
  approved: "Validé",
  sent: "Envoyé",
  cancelled: "Annulé",
};
