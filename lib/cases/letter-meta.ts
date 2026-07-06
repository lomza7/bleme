// Métadonnées des courriers (partagées serveur + client). Pas de "use server"
// ici : un module d'actions ne peut exporter que des fonctions async.

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
