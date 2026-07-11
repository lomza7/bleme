/*
 * Catalogue des événements sortants (données pures, importables client + serveur).
 * Payloads par RÉFÉRENCE (ids seulement) : jamais de PII débiteur, de corps de
 * courrier ni de texte de réponse — le consommateur rappelle l'API avec sa clé.
 */
export const WEBHOOK_EVENTS: { type: string; label: string }[] = [
  { type: "case.created", label: "Dossier créé" },
  { type: "case.resolved", label: "Dossier résolu (payé)" },
  { type: "invoice.payment_detected", label: "Paiement détecté sur une facture" },
  { type: "letter.sent", label: "Courrier validé / envoyé" },
  { type: "letter.tracking_updated", label: "Suivi d'un courrier mis à jour" },
  { type: "reply.received", label: "Réponse reçue" },
];

export const WEBHOOK_EVENT_TYPES: string[] = WEBHOOK_EVENTS.map((e) => e.type);
