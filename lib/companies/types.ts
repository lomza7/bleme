// Types partagés (client + serveur) pour la recherche d'entreprise.

export type CompanyHit = {
  siren: string;
  nom: string;
  ville: string | null;
  codePostal: string | null;
  formeJuridique: string | null;
  radiee: boolean;
};

export type CompanySnapshot = {
  source: "pappers" | "annuaire";
  siren: string;
  nom: string;
  formeJuridique: string | null;
  siege: {
    adresse: string | null;
    codePostal: string | null;
    ville: string | null;
    pays: string | null;
  };
  dirigeants: { nom: string; qualite: string | null }[];
  capitalCents: number | null;
  dateCreation: string | null;
  codeNaf: string | null;
  libelleNaf: string | null;
  enActivite: boolean;
  procedureCollective: boolean;
  fetchedAt: string;
};
