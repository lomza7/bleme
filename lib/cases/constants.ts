export const CASE_TYPE_LABEL: Record<string, string> = {
  unpaid_invoice: "Impayé",
  client_dispute: "Litige",
  admin_request: "Démarche",
};

export const STATUS_META: Record<string, { label: string; tone: "brand" | "muted" | "green" | "amber" }> = {
  draft: { label: "Brouillon", tone: "muted" },
  active: { label: "En cours", tone: "brand" },
  awaiting_user: { label: "Action attendue", tone: "amber" },
  awaiting_debtor: { label: "En attente de réponse", tone: "muted" },
  escalated: { label: "Escaladé", tone: "amber" },
  resolved: { label: "Résolu", tone: "green" },
  closed: { label: "Clôturé", tone: "muted" },
};

/** Indemnité forfaitaire légale de recouvrement (B2B), par facture. */
export const FIXED_INDEMNITY_CENTS = 4000;
