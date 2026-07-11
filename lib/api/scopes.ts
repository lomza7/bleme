import type { Capability } from "@/lib/permissions/capabilities";

/*
 * Scopes assignables à une clé API (données pures, importables côté client pour
 * l'affichage ET côté serveur pour la validation). Chaque scope listé a un
 * endpoint réel.
 *
 * 'letters.send' n'y figurera JAMAIS : aucun envoi par API (pilier juridique #1).
 */
export const API_SCOPES: { cap: Capability; label: string; hint: string }[] = [
  { cap: "cases.view", label: "Lire les dossiers", hint: "GET /v1/cases, détail, courriers & suivi." },
  { cap: "cases.create", label: "Créer des dossiers", hint: "POST /v1/cases (dossier en brouillon)." },
  { cap: "compta.view", label: "Lire les factures", hint: "GET /v1/invoices." },
  { cap: "compta.manage", label: "Pousser des factures", hint: "POST /v1/invoices (facture → dossier)." },
];

export const API_SCOPE_CAPS: Capability[] = API_SCOPES.map((s) => s.cap);
