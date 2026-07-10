/*
 * Métadonnées d'AFFICHAGE des fournisseurs comptables (logo, libellés, champs
 * du formulaire de connexion, aide). Aucun secret, aucun code serveur : sûr à
 * importer dans les composants client.
 */

export type ProviderId = "pennylane" | "sellsy" | "axonaut";

export type ConnectField = {
  name: string;
  label: string;
  placeholder: string;
};

export type ProviderMeta = {
  id: ProviderId;
  label: string;
  logo: string;
  /** Rapport largeur/hauteur du logo (pour le rendu à hauteur fixe). */
  logoAspect: number;
  /** Phrase d'accroche de la carte de connexion. */
  blurb: string;
  /** Champs à saisir pour connecter (1 pour Pennylane/Axonaut, 2 pour Sellsy). */
  fields: ConnectField[];
  /** Où l'utilisateur trouve ses identifiants (étapes). */
  howto: string[];
  howtoUrl?: string;
  /** Note de plan éventuelle. */
  planNote?: string;
};

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  pennylane: {
    id: "pennylane",
    label: "Pennylane",
    logo: "/logos/pennylane.svg",
    logoAspect: 162 / 32,
    blurb:
      "Vos factures clients impayées apparaissent dans BLEME, prêtes à devenir des dossiers en un clic — et vous êtes prévenu dès qu’une facture est réglée.",
    fields: [{ name: "token", label: "Token API", placeholder: "Collez votre token API Pennylane" }],
    howto: [
      "Dans Pennylane : Paramètres → Connectivité → Développeurs → « Générer un token API ».",
      "Choisissez les permissions Lecture seule (BLEME n’a besoin que de lire vos factures).",
      "Copiez le token affiché (montré une seule fois) et collez-le ci-dessous.",
    ],
    howtoUrl: "https://pennylane.readme.io/docs/generating-my-api-token",
    planNote: "L’onglet Développeurs nécessite un plan Pennylane Essential ou supérieur.",
  },
  axonaut: {
    id: "axonaut",
    label: "Axonaut",
    logo: "/logos/axonaut.svg",
    logoAspect: 150 / 32,
    blurb:
      "BLEME lit vos factures Axonaut : les impayées remontent ici, prêtes à devenir des dossiers, et le règlement d’une facture est détecté automatiquement.",
    fields: [{ name: "token", label: "Clé API", placeholder: "Collez votre clé API Axonaut" }],
    howto: [
      "Dans Axonaut : icône roue crantée (en haut à droite) → onglet « API ».",
      "Générez une clé API (en lecture) et copiez-la.",
      "Collez-la ci-dessous.",
    ],
    howtoUrl: "https://axonaut.com/api/v2/doc",
    planNote: "L’API est incluse dans l’abonnement Axonaut.",
  },
  sellsy: {
    id: "sellsy",
    label: "Sellsy",
    logo: "/logos/sellsy.svg",
    logoAspect: 128 / 32,
    blurb:
      "Connectez Sellsy : vos factures dues et en retard arrivent dans BLEME, prêtes à devenir des dossiers, et le passage en « payée » est détecté.",
    fields: [
      { name: "client_id", label: "Client ID", placeholder: "Client ID de votre accès API Sellsy" },
      { name: "client_secret", label: "Client Secret", placeholder: "Client Secret (affiché une seule fois)" },
    ],
    howto: [
      "Dans Sellsy : Réglages → Portail Développeur → API V2 → « Créer un accès API ».",
      "Type « Personnel », cochez les accès en lecture (factures, sociétés, paiements), enregistrez.",
      "Copiez le Client ID et le Client Secret (le secret n’est montré qu’une fois) et collez-les ci-dessous.",
    ],
    howtoUrl: "https://www.sellsy.fr/developer/api-v2",
  },
};

export const SUPPORTED_PROVIDERS: ProviderId[] = ["pennylane", "axonaut", "sellsy"];
