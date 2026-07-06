export type CaseKind = "unpaid" | "dispute" | "admin";

export type WizardStep = "kind" | "details" | "story" | "account" | "create";

export type WizardData = {
  kind: CaseKind | null;
  // Détails (champs selon le type)
  partyName: string;
  debtorSiren: string | null;
  amount: string;
  age: string;
  subject: string;
  stage: string;
  // Récit
  storyMode: "voice" | "text" | null;
  storySeconds: number;
  storyText: string;
  devilAnswer: string;
};

export const EMPTY_DATA: WizardData = {
  kind: null,
  partyName: "",
  debtorSiren: null,
  amount: "",
  age: "",
  subject: "",
  stage: "",
  storyMode: null,
  storySeconds: 0,
  storyText: "",
  devilAnswer: "",
};

export const KIND_META: Record<
  CaseKind,
  { label: string; short: string }
> = {
  unpaid: { label: "Facture impayée", short: "Impayé" },
  dispute: { label: "Litige client", short: "Litige" },
  admin: { label: "Amende ou démarche", short: "Démarche" },
};
