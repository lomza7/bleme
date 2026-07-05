/*
 * Catalogue des APIs outils que les agents peuvent appeler pendant un run.
 * L'exécution HTTP vit dans le bridge (ops/paperclip-vps/bleme-bridge) via
 * une boucle agentique ; ici on décrit chaque API pour la console et pour
 * lib/ai/client.ts qui transmet les APIs activées avec leurs credentials.
 * L'activation par agent est dans la table agent_tool_apis (NULL = commune).
 */

export type ToolApi = {
  name: string;
  label: string;
  description: string;
  /** Noms des clés du coffre (/admin/cles) requises ; vide = API ouverte. */
  secrets: string[];
  /** Clés facultatives transmises au bridge si présentes (ex. PISTE_ENV). */
  optionalSecrets?: string[];
  actions: string[];
};

export const TOOL_APIS: ToolApi[] = [
  {
    name: "legifrance",
    label: "Légifrance (PISTE)",
    description:
      "Textes officiels : recherche dans les lois et décrets, jurisprudence judiciaire, consultation d'articles de codes. Compte gratuit sur piste.gouv.fr.",
    secrets: ["PISTE_CLIENT_ID", "PISTE_CLIENT_SECRET"],
    optionalSecrets: ["PISTE_ENV"],
    actions: ["rechercher_loi", "rechercher_jurisprudence", "rechercher_convention", "consulter_article"],
  },
  {
    name: "judilibre",
    label: "JUDILIBRE (PISTE)",
    description:
      "Décisions de la Cour de cassation en texte intégral : recherche par mots-clés, lecture d'une décision. Mêmes clés PISTE que Légifrance (souscription JUDILIBRE requise sur piste.gouv.fr).",
    secrets: ["PISTE_CLIENT_ID", "PISTE_CLIENT_SECRET"],
    optionalSecrets: ["PISTE_ENV"],
    actions: ["rechercher", "consulter_decision"],
  },
  {
    name: "justice_administrative",
    label: "Justice administrative (PISTE)",
    description:
      "Jurisprudence administrative complète : Conseil d'État et CAA via Légifrance (CETAT), tribunaux administratifs via l'index local de l'open data (24 derniers mois). Fiscal, URSSAF public, amendes, recours contre l'administration.",
    secrets: ["PISTE_CLIENT_ID", "PISTE_CLIENT_SECRET"],
    optionalSecrets: ["PISTE_ENV"],
    actions: ["rechercher", "consulter_decision", "rechercher_ta", "consulter_decision_ta"],
  },
  {
    name: "service_public",
    label: "Service-Public / Entreprendre (DILA)",
    description:
      "Fiches pratiques officielles : démarches, procédures amiables, contestations, recours, délais, formulaires. Index local des flux DILA (Licence Ouverte), sans clé.",
    secrets: [],
    actions: ["rechercher_fiche", "consulter_fiche"],
  },
  {
    name: "bodacc",
    label: "BODACC (DILA)",
    description:
      "Annonces commerciales officielles : procédures collectives, radiations, ventes et modifications. Alerte automatique avant relance si le débiteur est en procédure. Sans clé.",
    secrets: [],
    actions: ["annonces"],
  },
  {
    name: "pappers",
    label: "Pappers",
    description:
      "Fiche légale complète agrégée (RNE, BODACC, greffes) : identité, siège, dirigeants, procédures collectives, comptes et actes. Clé API sur pappers.fr (offre gratuite limitée, puis payant).",
    secrets: ["PAPPERS_API_KEY"],
    actions: ["fiche"],
  },
  {
    name: "entreprises",
    label: "Recherche d'entreprises (api.gouv.fr)",
    description:
      "Annuaire officiel des entreprises : SIREN/SIRET, état administratif (active ou radiée), adresse du siège, dirigeants. Sans clé.",
    secrets: [],
    actions: ["rechercher"],
  },
];

export const TOOL_API_NAMES = new Set(TOOL_APIS.map((a) => a.name));
