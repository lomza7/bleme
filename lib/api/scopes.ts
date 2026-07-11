import type { Capability } from "@/lib/permissions/capabilities";

/*
 * Scopes assignables à une clé API (données pures, importables côté client pour
 * l'affichage ET côté serveur pour la validation). Phase 1 = lecture seule :
 * chaque scope listé a un endpoint réel. Les scopes d'écriture (cases.create,
 * compta.manage) arriveront en Phase 2 avec leurs endpoints.
 *
 * 'letters.send' n'y figurera JAMAIS : aucun envoi par API (pilier juridique #1).
 */
export const API_SCOPES: { cap: Capability; label: string; hint: string }[] = [
  { cap: "cases.view", label: "Lire les dossiers", hint: "GET /v1/cases, détail, courriers & suivi." },
  { cap: "compta.view", label: "Lire les factures", hint: "GET /v1/invoices." },
];

export const API_SCOPE_CAPS: Capability[] = API_SCOPES.map((s) => s.cap);
