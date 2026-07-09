// Types partagés (client + serveur) pour la recherche d'administration.
// L'adresse suit la même forme que cases.debtor_address et le formulaire de
// validation ({nom, societe, adresse, complement, codePostal, ville}).

export type AdminAddress = {
  /** Ligne « à l'attention de » (personne physique) — vide pour une administration. */
  nom: string;
  /** Dénomination du service / de l'administration. */
  societe: string;
  /** N° et voie (ex. « Place Beauvau »). */
  adresse: string;
  /** Complément / service de distribution (ex. « Ministère de l'Intérieur DSR ERPC »). */
  complement: string;
  codePostal: string;
  ville: string;
};

export type AdminHit = {
  /** Identifiant Annuaire (itm) — stable, pour retrouver la fiche. */
  id: string;
  /** Nom du service tel qu'il figure à l'annuaire. */
  nom: string;
  /** Type d'organisme (ex. « Juridiction », « Administration centrale »). */
  type: string | null;
  /** Adresse postale officielle si exploitable (sinon saisie manuelle possible). */
  address: AdminAddress | null;
};
