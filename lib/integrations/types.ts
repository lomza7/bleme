/*
 * Types pivot de l'intégration comptable — partagés par le sync et les
 * adaptateurs (Pennylane, Sellsy, Axonaut). Aucun secret, aucun import
 * server-only : sûr à importer partout.
 *
 * Règle d'or (piège n°1 de la cartographie) : `PivotStatus` est le SEUL
 * vocabulaire de statut que connaît le reste de BLEME (sync, cockpit, Suivi).
 * Chaque adaptateur DOIT mapper le vocabulaire de son API vers ces valeurs,
 * sinon les factures deviennent invisibles côté produit.
 */

export type IntegrationError = { error: string; status?: number };

export function isIntegrationError<T>(r: T | IntegrationError): r is IntegrationError {
  return typeof r === "object" && r !== null && "error" in r;
}

/** Statut normalisé d'une facture, indépendant du fournisseur. */
export type PivotStatus =
  | "late" // échue, impayée
  | "upcoming" // pas encore échue
  | "partially_paid" // paiement partiel reçu
  | "paid" // soldée
  | "draft" // brouillon (écarté au sync)
  | "credit_note" // avoir (écarté au sync)
  | "cancelled"
  | "other";

/** Statuts « ouverts » actionnables (retard + à échoir + partiel). */
export const OPEN_STATUSES: readonly PivotStatus[] = ["late", "partially_paid", "upcoming"];

export type PivotCustomer = {
  externalId?: string | null;
  name?: string | null;
  email?: string | null;
  /** SIREN à 9 chiffres si connu. */
  siren?: string | null;
  address?: { adresse: string; codePostal: string; ville: string } | null;
};

/**
 * Facture normalisée. `amountCents`/`remainingCents` sont TOUJOURS en centimes
 * (chaque adaptateur fait sa conversion). `customer` peut être absent quand
 * l'adaptateur a choisi de ne pas résoudre la fiche (gros historique payé).
 */
export type PivotInvoice = {
  externalId: string;
  invoiceNumber?: string | null;
  label?: string | null;
  customer?: PivotCustomer | null;
  amountCents: number | null;
  remainingCents: number | null;
  currency: string;
  issuedOn?: string | null; // YYYY-MM-DD
  deadlineOn?: string | null; // YYYY-MM-DD
  status: PivotStatus;
  paid: boolean;
};

/** Résultat d'une passe de récupération (sync). */
export type FetchResult = {
  invoices: PivotInvoice[];
  /** Ids supprimés côté fournisseur (Pennylane changelog ; [] sinon). */
  deletedExternalIds: string[];
  /** Curseur à persister pour la prochaine passe incrémentale (ou null). */
  nextCursor: string | null;
};

export type FetchOpts = {
  /** true : premier import (fenêtre large) ; false : passe incrémentale. */
  firstImport: boolean;
  cursor: string | null;
  /** Factures suivies (dossier lié) à re-vérifier même en incrémental. */
  trackedExternalIds: string[];
};

/**
 * Contrat d'un adaptateur fournisseur. `creds` est la chaîne DÉCHIFFRÉE
 * (clé brute Pennylane/Axonaut, ou JSON {client_id,client_secret} Sellsy) ;
 * chaque adaptateur la parse lui-même.
 */
export interface ComptaAdapter {
  provider: "pennylane" | "sellsy" | "axonaut";
  /** Fenêtre d'historique importée au premier passage (mois). */
  importMonths: number;
  /** Au-delà, le curseur incrémental n'est plus fiable → ré-import (jours). null = jamais. */
  cursorMaxAgeDays: number | null;
  /** Vérifie les identifiants (appel API réel) + nom d'entreprise éventuel. */
  verifyCredentials(creds: string): Promise<{ companyName: string | null } | IntegrationError>;
  /** Extrait du formulaire de connexion la chaîne de credentials à chiffrer. */
  parseConnectForm(formData: FormData): { creds: string } | { error: string };
  /** Récupère les factures (normalisées) à upserter + suppressions + curseur. */
  fetchInvoices(creds: string, opts: FetchOpts): Promise<FetchResult | IntegrationError>;
  /** Télécharge le PDF d'une facture (pour la joindre au dossier). */
  downloadInvoicePdf(
    creds: string,
    externalId: string,
  ): Promise<{ buffer: Buffer; filename: string } | IntegrationError>;
}
