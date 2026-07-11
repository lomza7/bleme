/*
 * Socle du système de droits (RBAC) — source de vérité unique, partagée par
 * l'UI (édition des droits, gating des boutons) et le serveur (gating des
 * actions + fonction SQL has_capability alignée sur ces clés).
 *
 * Modèle « rôles + réglage fin » : chaque membre porte un jeu de capacités
 * effectif (jsonb sur organization_members.permissions). Un rôle est un
 * PRÉRÉGLAGE qui remplit ce jeu ; chaque capacité reste ajustable individu-
 * ellement. Le propriétaire (owner) a TOUT, implicitement, sans stockage.
 *
 * Registre non-juridique : « valider & envoyer », « préparer un brouillon » —
 * jamais de vocabulaire de conseil.
 */

export const CAPABILITIES = [
  // Dossiers
  "cases.view",
  "cases.create",
  "cases.edit",
  "cases.close",
  // Pièces & documents
  "documents.view",
  "documents.upload",
  "documents.download",
  // Courriers
  "letters.prepare",
  "letters.send",
  // Compta
  "compta.view",
  "compta.manage",
  // Abonnement / facturation
  "billing.view",
  "billing.manage",
  // Données
  "export.data",
  // Équipe
  "team.invite",
  "team.manage",
  // Développeurs & API
  "api.manage",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export type PermissionSet = Partial<Record<Capability, boolean>>;

export type MemberRole =
  | "owner"
  | "manager"
  | "collaborator"
  | "viewer"
  | "accountant"
  | "custom";

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Propriétaire",
  manager: "Gestionnaire",
  collaborator: "Collaborateur",
  viewer: "Lecture seule",
  accountant: "Comptable externe",
  custom: "Personnalisé",
};

export const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  owner: "Accès total, y compris l'abonnement et les droits de chacun.",
  manager: "Gère les dossiers, les envois, la compta et l'équipe. Ne touche pas à l'abonnement.",
  collaborator: "Prépare les dossiers et les pièces. Ne télécharge pas et ne valide pas les envois.",
  viewer: "Consulte les dossiers, les pièces et la compta. Aucune modification.",
  accountant: "Voit les dossiers, télécharge les pièces, consulte et exporte la compta.",
  custom: "Droits ajustés à la main.",
};

// Regroupement pour l'affichage (matrice de droits par personne).
export const CAPABILITY_GROUPS: {
  key: string;
  label: string;
  caps: { cap: Capability; label: string; hint?: string }[];
}[] = [
  {
    key: "cases",
    label: "Dossiers",
    caps: [
      { cap: "cases.view", label: "Voir les dossiers" },
      { cap: "cases.create", label: "Créer un dossier" },
      { cap: "cases.edit", label: "Modifier un dossier" },
      { cap: "cases.close", label: "Clôturer un dossier" },
    ],
  },
  {
    key: "documents",
    label: "Pièces & documents",
    caps: [
      { cap: "documents.view", label: "Voir les pièces" },
      { cap: "documents.upload", label: "Ajouter des pièces" },
      { cap: "documents.download", label: "Télécharger les pièces", hint: "Sensible : sortir les fichiers de l'espace." },
    ],
  },
  {
    key: "letters",
    label: "Courriers",
    caps: [
      { cap: "letters.prepare", label: "Préparer un brouillon" },
      { cap: "letters.send", label: "Valider & envoyer", hint: "Engage l'envoi — le pilier juridique." },
    ],
  },
  {
    key: "compta",
    label: "Compta & factures",
    caps: [
      { cap: "compta.view", label: "Voir la compta" },
      { cap: "compta.manage", label: "Gérer la compta (connexions, sync)" },
    ],
  },
  {
    key: "billing",
    label: "Abonnement",
    caps: [
      { cap: "billing.view", label: "Voir l'abonnement" },
      { cap: "billing.manage", label: "Gérer l'abonnement & le paiement" },
    ],
  },
  {
    key: "data",
    label: "Données",
    caps: [{ cap: "export.data", label: "Exporter les données" }],
  },
  {
    key: "team",
    label: "Équipe",
    caps: [
      { cap: "team.invite", label: "Inviter des personnes" },
      { cap: "team.manage", label: "Gérer les droits de l'équipe", hint: "Peut modifier les droits des autres." },
    ],
  },
  {
    key: "developers",
    label: "Développeurs & API",
    caps: [
      {
        cap: "api.manage",
        label: "Gérer les clés API & webhooks",
        hint: "Sensible : accès programmatique à toutes les données de l'organisation.",
      },
    ],
  },
];

// Préréglages : le jeu de capacités accordé par chaque rôle (owner = tout).
const ALL: Capability[] = [...CAPABILITIES];

export const ROLE_PRESETS: Record<Exclude<MemberRole, "custom">, Capability[]> = {
  owner: ALL,
  manager: [
    "cases.view", "cases.create", "cases.edit", "cases.close",
    "documents.view", "documents.upload", "documents.download",
    "letters.prepare", "letters.send",
    "compta.view", "compta.manage",
    "billing.view",
    "export.data",
    "team.invite", "team.manage",
  ],
  collaborator: [
    "cases.view", "cases.create", "cases.edit",
    "documents.view", "documents.upload",
    "letters.prepare",
    "compta.view",
  ],
  viewer: ["cases.view", "documents.view", "compta.view", "billing.view"],
  accountant: [
    "cases.view",
    "documents.view", "documents.download",
    "compta.view",
    "export.data",
  ],
};

/** Jeu de capacités (objet booléen complet) correspondant à un rôle préréglé. */
export function permissionsFromRole(role: Exclude<MemberRole, "custom">): PermissionSet {
  const granted = new Set(ROLE_PRESETS[role]);
  const out: PermissionSet = {};
  for (const cap of CAPABILITIES) out[cap] = granted.has(cap);
  return out;
}

/**
 * Un jeu de permissions correspond-il exactement à un préréglage ? Sinon le
 * rôle affiché est « Personnalisé ». (owner est traité à part, hors permissions.)
 */
export function roleFromPermissions(perms: PermissionSet): MemberRole {
  for (const role of ["manager", "collaborator", "viewer", "accountant"] as const) {
    const preset = new Set(ROLE_PRESETS[role]);
    const match = CAPABILITIES.every((cap) => Boolean(perms[cap]) === preset.has(cap));
    if (match) return role;
  }
  return "custom";
}

/**
 * owner (et 'admin' hérité) : tout, implicitement ; sinon on lit le jeu de
 * permissions. Les rôles hérités owner/admin gardent l'accès total pour ne
 * jamais dégrader un membre existant.
 */
export function can(
  role: string | null | undefined,
  perms: PermissionSet | null | undefined,
  cap: Capability,
): boolean {
  if (role === "owner" || role === "admin") return true;
  return Boolean(perms?.[cap]);
}
