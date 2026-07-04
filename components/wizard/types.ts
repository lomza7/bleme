export type CaseKind = "unpaid" | "dispute" | "admin";

export type WizardStep = "kind" | "details" | "story" | "account";

export type WizardData = {
  kind: CaseKind | null;
  // Détails (champs selon le type)
  partyName: string;
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
