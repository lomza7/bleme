/*
 * L'équipe d'agents IA : données partagées entre la section landing
 * (components/landing/agents.tsx) et les fiches /agents/[slug].
 *
 * Règle d'or : aucun chiffre inventé. Chaque stat est soit un fait légal
 * public (articles, délais, montants), soit une règle produit réelle
 * (validation obligatoire, limites d'upload, cadence du cron — voir
 * docs/07-agents-ia.md). Jamais de taux de réussite ni de pronostic.
 *
 * Avatars : sprites Petdex (petdex.dev, repo MIT crafter-station/petdex).
 * Marius=bateman, Léna=exec, Jeanne=liang, Nora=ostrom, Sacha=scoutlet,
 * Basile=al-khwarizmi. Rangée idle extraite en bande de 6 frames 192×208.
 */

export type AgentSkill = { label: string; niveau: 4 | 5 };

export type AgentStat = {
  /** Affichage statique ("Art. 1219", "24 h/24") quand `valeur` est absent. */
  chiffre: string;
  /** Si présent, le chiffre est animé (CountUp) avec ce nombre + suffixe. */
  valeur?: number;
  suffixe?: string;
  label: string;
  /** Libellé compact pour les cartes de la landing (2 premières stats). */
  court?: string;
};

export type SavoirIcone =
  | "code"
  | "tribunal"
  | "pourcent"
  | "modeles"
  | "loupe"
  | "messages"
  | "bouclier"
  | "horloge"
  | "courrier"
  | "dossier";

export type AgentSavoir = {
  titre: string;
  corpus: string;
  description: string;
  stat: AgentStat;
  icone: SavoirIcone;
};

export type AgentMission = { titre: string; detail: string };

export type Agent = {
  slug: string;
  prenom: string;
  role: string;
  avatar: string;
  /** Une phrase d'accroche pour la fiche. */
  tagline: string;
  /** Texte court affiché sur la carte de la landing. */
  expertise: string;
  skills: AgentSkill[];
  /** Chips "branché sur" de la landing (3 max). */
  sources: string[];
  /** Les 3 grands chiffres du haut de fiche ; les 2 premiers, les plus
   *  parlants, sont repris sur la carte de la landing. */
  stats: [AgentStat, AgentStat, AgentStat];
  mission: AgentMission[];
  savoir: AgentSavoir[];
  soon?: boolean;
};

export const AGENTS: Agent[] = [
  {
    slug: "marius",
    prenom: "Marius",
    role: "Agent Impayés",
    avatar: "/agents/marius.webp",
    tagline:
      "Il transforme une facture en retard en dossier qui avance : relances cadencées, sommes chiffrées au centime, mise en demeure prête au bon moment.",
    expertise:
      "Expert du recouvrement amiable. Il cadence les relances, chiffre indemnités et intérêts, et tient la mise en demeure prête au bon moment.",
    skills: [
      { label: "Recouvrement amiable", niveau: 5 },
      { label: "Délais et pénalités légales", niveau: 5 },
    ],
    sources: ["Légifrance · Code de commerce", "Taux et indemnités légaux", "Modèles éprouvés BLEME"],
    stats: [
      { chiffre: "40 €", valeur: 40, suffixe: " €", label: "d'indemnité forfaitaire chiffrée par facture en retard, de plein droit", court: "chiffrés par facture en retard, de plein droit" },
      { chiffre: "5 ans", valeur: 5, suffixe: " ans", label: "de prescription commerciale surveillée sur chaque créance", court: "de prescription surveillée par créance" },
      { chiffre: "60 j", valeur: 60, suffixe: " j", label: "le plafond légal de paiement entre pros, qu'il connaît par cœur", court: "de plafond légal de paiement, connu par cœur" },
    ],
    mission: [
      {
        titre: "Cadencer les relances",
        detail:
          "Relance cordiale dès l'échéance dépassée, relance ferme à J+7 : chaque courrier est prêt au bon moment, et ne part qu'après votre validation.",
      },
      {
        titre: "Chiffrer ce qui est dû",
        detail:
          "Principal, indemnité forfaitaire de 40 € par facture, intérêts de retard au taux en vigueur : le montant réclamé est exact et justifié ligne par ligne.",
      },
      {
        titre: "Tenir la mise en demeure prête",
        detail:
          "Mentions obligatoires, faits validés, envoi en recommandé : le courrier qui change le rapport de force attend votre feu vert, pas l'inverse.",
      },
    ],
    savoir: [
      {
        titre: "Délais et pénalités de paiement",
        corpus: "Légifrance · Code de commerce",
        description:
          "Les articles L441-10 à L441-16 : délais plafonds (60 jours date de facture, 45 jours fin de mois), pénalités de retard et indemnité de recouvrement. Le texte de référence de chaque relance qu'il rédige.",
        stat: { chiffre: "L441-10", label: "l'article qui fixe les règles du paiement entre pros" },
        icone: "code",
      },
      {
        titre: "Indemnité forfaitaire de recouvrement",
        corpus: "Article D441-5",
        description:
          "40 € par facture payée en retard, dus sans mise en demeure préalable ni clause au contrat. Marius l'ajoute systématiquement au chiffrage : c'est le signal que le dossier est tenu.",
        stat: { chiffre: "40 €", valeur: 40, suffixe: " €", label: "par facture en retard, de plein droit" },
        icone: "pourcent",
      },
      {
        titre: "Taux d'intérêt et actualisations",
        corpus: "Taux légal · taux BCE",
        description:
          "Le taux d'intérêt légal est actualisé chaque semestre, le taux contractuel ne peut pas descendre sous 3 fois ce taux, et à défaut de clause c'est BCE + 10 points. Ses intérêts sont toujours calculés au taux du jour.",
        stat: { chiffre: "2×/an", label: "l'actualisation du taux légal qu'il suit" },
        icone: "horloge",
      },
      {
        titre: "Séquences de relance éprouvées",
        corpus: "Playbooks BLEME",
        description:
          "Relance cordiale, relance ferme, mise en demeure, recours : une séquence en 4 étapes calée sur les usages (J0, J+7, J+15, J+30), avec des formulations fermes qui préservent la relation commerciale.",
        stat: { chiffre: "4", valeur: 4, label: "étapes graduées, du rappel cordial au recours" },
        icone: "modeles",
      },
    ],
  },
  {
    slug: "lena",
    prenom: "Léna",
    role: "Agente Litiges",
    avatar: "/agents/lena.webp",
    tagline:
      "Quand le client conteste au lieu de payer, elle reconstitue les faits, répond point par point et rend le dossier transmissible tel quel à un professionnel.",
    expertise:
      "Experte de la contestation client. Elle reconstitue la chronologie, répond point par point et rend le dossier inattaquable.",
    skills: [
      { label: "Droit des contrats", niveau: 5 },
      { label: "Argumentation documentée", niveau: 4 },
    ],
    sources: ["Judilibre · Cour de cassation", "Légifrance · Code civil", "Dossiers types litiges"],
    stats: [
      { chiffre: "2 534", valeur: 2534, label: "articles du Code civil dans son corpus, réforme des contrats incluse", court: "articles du Code civil en corpus" },
      { chiffre: "500 000+", valeur: 500000, suffixe: "+", label: "décisions de justice consultables via l'open data Judilibre", court: "décisions de justice consultables" },
      { chiffre: "100 %", valeur: 100, suffixe: " %", label: "de ses réponses appuyées sur une pièce du dossier, sinon marquées « à confirmer »", court: "de réponses appuyées sur une pièce" },
    ],
    mission: [
      {
        titre: "Reconstituer la chronologie",
        detail:
          "Devis signé, échanges, livraison, réserves : chaque fait est daté et rattaché à sa preuve. La chronologie devient la colonne vertébrale du dossier.",
      },
      {
        titre: "Répondre point par point",
        detail:
          "Chaque contestation du client reçoit une réponse factuelle adossée à une pièce : le message du 14 mai, le devis signé, la photo de livraison.",
      },
      {
        titre: "Rendre le dossier transmissible",
        detail:
          "Si le désaccord persiste, tout est déjà ordonné : synthèse, bordereau de pièces, chronologie. Un professionnel peut reprendre le dossier sans réexpliquer.",
      },
    ],
    savoir: [
      {
        titre: "Droit des contrats",
        corpus: "Légifrance · Code civil",
        description:
          "Force obligatoire du contrat (art. 1103), inexécution et ses remèdes (art. 1217 et suivants), réforme de 2016 : le socle qui lui permet de qualifier précisément ce que le client conteste.",
        stat: { chiffre: "2 534", valeur: 2534, label: "articles indexés, de la formation du contrat à la prescription" },
        icone: "code",
      },
      {
        titre: "Jurisprudence en accès ouvert",
        corpus: "Judilibre · Cour de cassation",
        description:
          "L'open data des décisions de justice : comment les juges lisent les situations comparables à la vôtre : retards, malfaçons invoquées, réceptions refusées. Elle s'en sert pour documenter, jamais pour pronostiquer.",
        stat: { chiffre: "500 000+", valeur: 500000, suffixe: "+", label: "décisions consultables en texte intégral" },
        icone: "tribunal",
      },
      {
        titre: "Charge de la preuve",
        corpus: "Article 1353",
        description:
          "Qui doit prouver quoi : celui qui réclame l'exécution prouve l'obligation, celui qui se prétend libéré prouve le paiement. C'est la grille avec laquelle elle évalue chaque pièce du dossier.",
        stat: { chiffre: "Art. 1353", label: "la règle du jeu qu'elle applique à chaque pièce" },
        icone: "bouclier",
      },
      {
        titre: "Schémas de litiges récurrents",
        corpus: "Dossiers types BLEME",
        description:
          "Qualité contestée, livraison refusée, prestation « pas terminée » : les scénarios reviennent, les pièces attendues aussi. Elle sait immédiatement quoi demander pour solidifier votre version.",
        stat: { chiffre: "Point par point", label: "sa méthode de réponse, sans rien laisser sans réplique" },
        icone: "dossier",
      },
    ],
  },
  {
    slug: "jeanne",
    prenom: "Jeanne",
    role: "Agente Avocat du diable",
    avatar: "/agents/jeanne.webp",
    tagline:
      "Elle joue la partie adverse contre votre dossier : ce que l'autre camp pourrait répondre, elle le trouve d'abord, et vous donne l'action qui corrige.",
    expertise:
      "Experte du contre-argument. Elle cherche ce que l'autre partie pourrait répondre et pointe les faiblesses avant qu'elles ne coûtent.",
    skills: [
      { label: "Analyse contradictoire", niveau: 5 },
      { label: "Détection des angles morts", niveau: 5 },
    ],
    sources: ["Jurisprudence contradictoire", "Moyens de défense recensés", "Récits des deux parties"],
    stats: [
      { chiffre: "100 %", valeur: 100, suffixe: " %", label: "des dossiers passés au contre-interrogatoire avant le premier courrier", court: "des dossiers contre-interrogés avant courrier" },
      { chiffre: "0", valeur: 0, label: "courrier généré tant qu'une incohérence signalée n'est pas levée", court: "courrier tant qu'une incohérence reste ouverte" },
      { chiffre: "2", valeur: 2, label: "versions de l'histoire confrontées : la vôtre, et celle d'en face", court: "versions de l'histoire confrontées" },
    ],
    mission: [
      {
        titre: "Chercher ce que dirait l'autre camp",
        detail:
          "Dès l'intake, elle pose la question qui fâche : qu'est-ce que votre client dirait pour sa défense ? Retard accepté, malfaçon évoquée, réception refusée : tout y passe.",
      },
      {
        titre: "Pointer les faiblesses, avec l'action qui corrige",
        detail:
          "Chaque vigilance est actionnable : « le client évoque un retard accepté à l'oral : ajoutez le message où le report a été convenu ». Jamais d'alerte sans remède.",
      },
      {
        titre: "Bloquer plutôt que laisser passer",
        detail:
          "Une incohérence non levée (une facture antérieure au devis, une date qui se contredit) bloque la génération de la mise en demeure. Mieux vaut un courrier retardé qu'un courrier fragile.",
      },
    ],
    savoir: [
      {
        titre: "Jurisprudence lue à charge",
        corpus: "Judilibre · les deux sens",
        description:
          "Elle lit les décisions dans le sens qui vous dérange : les affaires où le créancier a échoué faute de preuve, de réception documentée ou de mise en demeure correcte. Votre dossier est testé contre ces angles d'attaque.",
        stat: { chiffre: "2 sens", label: "de lecture : pour votre thèse, et contre elle" },
        icone: "tribunal",
      },
      {
        titre: "Moyens de défense recensés",
        corpus: "Code civil · art. 1219",
        description:
          "Exception d'inexécution, contestation de la réception, prescription, compensation : le répertoire des arguments qu'un débiteur oppose. Elle vérifie, pour chacun, ce que votre dossier a en face.",
        stat: { chiffre: "Art. 1219", label: "l'argument n° 1 du client qui ne paie pas, anticipé d'office" },
        icone: "bouclier",
      },
      {
        titre: "Les récits des deux parties",
        corpus: "Intake BLEME",
        description:
          "Votre récit vocal contient déjà la matière : la question « avocat du diable » posée à la création du dossier lui donne la version adverse en germe. Elle la développe avant que l'autre camp ne le fasse.",
        stat: { chiffre: "100 %", valeur: 100, suffixe: " %", label: "des dossiers questionnés dès la création" },
        icone: "messages",
      },
    ],
  },
  {
    slug: "nora",
    prenom: "Nora",
    role: "Agente Preuves",
    avatar: "/agents/nora.webp",
    tagline:
      "Factures froissées, exports WhatsApp, photos de chantier : elle lit tout, en extrait montants et dates au centime près, et dit ce qui manque au dossier.",
    expertise:
      "Experte du classement. Elle lit factures, emails, WhatsApp et photos, en extrait montants et dates, et repère ce qui manque au dossier.",
    skills: [
      { label: "Lecture multi-format", niveau: 5 },
      { label: "Extraction montants et dates", niveau: 4 },
    ],
    sources: ["Vision + OCR multi-format", "Exports WhatsApp et emails", "Référentiel de pièces BLEME"],
    stats: [
      { chiffre: "0,01 €", label: "la précision d'extraction : chaque montant est stocké au centime", court: "de précision : montants extraits au centime" },
      { chiffre: "100 %", valeur: 100, suffixe: " %", label: "des valeurs extraites gardent leur source et restent éditables", court: "des valeurs extraites gardent leur source" },
      { chiffre: "25 Mo", valeur: 25, suffixe: " Mo", label: "acceptés par pièce : plans, photos HD, PDF scannés", court: "acceptés par pièce, photos HD comprises" },
    ],
    mission: [
      {
        titre: "Lire tout ce qui arrive",
        detail:
          "PDF, photos de chantier, captures d'écran, exports WhatsApp, emails transférés : chaque pièce est reconnue, datée et classée dans le bon dossier.",
      },
      {
        titre: "Extraire les faits, garder la source",
        detail:
          "Montants, dates, parties, références de facture : chaque valeur extraite pointe vers l'extrait d'origine. En cas de doute, elle marque « à vérifier » : jamais de valeur douteuse dans un courrier.",
      },
      {
        titre: "Dire ce qui manque",
        detail:
          "Devis signé absent, preuve de livraison manquante : elle compare le dossier à la checklist de son type et vous donne la liste exacte de ce qui le solidifierait.",
      },
    ],
    savoir: [
      {
        titre: "Vision et OCR multi-format",
        corpus: "Lecture de documents",
        description:
          "Une facture photographiée de biais sur un capot de camionnette reste une facture : elle lit les PDF natifs comme les scans, les captures d'écran comme les photos, et en tire des champs typés.",
        stat: { chiffre: "0,01 €", label: "les montants sont extraits et stockés au centime près" },
        icone: "loupe",
      },
      {
        titre: "Exports WhatsApp et emails",
        corpus: "Android · iOS · FR · EN",
        description:
          "Elle parse les exports officiels WhatsApp dans leurs 4 variantes (Android/iOS, français/anglais), repère les messages clés (promesses de paiement, accords donnés) et les verse datés à la chronologie.",
        stat: { chiffre: "4", valeur: 4, label: "variantes d'export reconnues automatiquement" },
        icone: "messages",
      },
      {
        titre: "Référentiel de pièces par type de dossier",
        corpus: "Checklists BLEME",
        description:
          "Un impayé attend un devis signé, une facture, une preuve de livraison ; un litige, la trace des réserves. Elle calcule un score de complétude et la liste « il manque » correspondante.",
        stat: { chiffre: "25 Mo", valeur: 25, suffixe: " Mo", label: "par pièce, pour ne jamais refuser une photo HD" },
        icone: "dossier",
      },
      {
        titre: "Traçabilité de chaque valeur",
        corpus: "Règle produit BLEME",
        description:
          "Chaque extraction garde son extrait source et son niveau de confiance. Sous le seuil, la valeur est marquée « à vérifier » et n'entre jamais dans un courrier sans votre confirmation. Votre correction prime toujours.",
        stat: { chiffre: "100 %", valeur: 100, suffixe: " %", label: "des valeurs sourcées, éditables, corrigeables" },
        icone: "bouclier",
      },
    ],
  },
  {
    slug: "sacha",
    prenom: "Sacha",
    role: "Agent Vigie",
    avatar: "/agents/sacha.webp",
    tagline:
      "Le métronome de vos dossiers : il surveille échéances, réponses et prescriptions en continu, réveille ce qui s'endort et prépare la prochaine action.",
    expertise:
      "Expert du suivi. Il surveille échéances et réponses adverses, réveille les dossiers qui s'endorment et prépare la prochaine action.",
    skills: [
      { label: "Délais et prescription", niveau: 5 },
      { label: "Cadences de relance", niveau: 5 },
    ],
    sources: ["Prescription et délais légaux", "Suivi recommandés et AR", "Cadences éprouvées BLEME"],
    stats: [
      { chiffre: "15 min", valeur: 15, suffixe: " min", label: "entre deux contrôles : chaque dossier est réexaminé à cette cadence", court: "entre deux tours de garde sur vos dossiers" },
      { chiffre: "24 h/24", label: "de veille : les échéances ne prennent ni week-end ni congés", court: "de veille sur vos échéances" },
      { chiffre: "5 ans", valeur: 5, suffixe: " ans", label: "de prescription commerciale suivie dossier par dossier", court: "de prescription suivie dossier par dossier" },
    ],
    mission: [
      {
        titre: "Surveiller chaque échéance",
        detail:
          "Chaque dossier a une prochaine action datée : relance à générer, délai de mise en demeure qui expire, accusé de réception attendu. Rien ne repose sur votre mémoire.",
      },
      {
        titre: "Réveiller ce qui s'endort",
        detail:
          "Pas de réponse à la mise en demeure depuis 8 jours ? Il vous le signale avec les options possibles, au lieu de laisser le dossier glisser dans l'oubli.",
      },
      {
        titre: "Préparer, jamais envoyer",
        detail:
          "Chaque action qu'il prépare atterrit « en attente de validation ». Le déclencheur, c'est toujours vous : il fournit le moment juste et le brouillon prêt.",
      },
    ],
    savoir: [
      {
        titre: "Prescription et délais légaux",
        corpus: "L110-4 · L218-2",
        description:
          "5 ans pour agir entre professionnels, 2 ans face à un particulier : il connaît le compte à rebours de chaque créance et vous alerte bien avant que le temps ne joue contre vous.",
        stat: { chiffre: "5 ans", valeur: 5, suffixe: " ans", label: "entre pros, et 2 ans seulement face à un particulier" },
        icone: "horloge",
      },
      {
        titre: "Suivi des recommandés",
        corpus: "Dépôt · distribution · AR",
        description:
          "Chaque recommandé est suivi de bout en bout : dépôt, distribution, accusé ou refus (qui produit les mêmes effets). Chaque événement est versé à la chronologie du dossier, daté et opposable.",
        stat: { chiffre: "24 h/24", label: "de surveillance des statuts d'envoi et des réponses" },
        icone: "courrier",
      },
      {
        titre: "Cadences de relance",
        corpus: "Playbooks BLEME",
        description:
          "J+7 pour la relance ferme, J+15 pour la mise en demeure, J+30 pour les recours : le tempo qui montre au débiteur que le dossier est tenu. Appliqué automatiquement, validé par vous.",
        stat: { chiffre: "15 min", valeur: 15, suffixe: " min", label: "la fréquence de son tour de garde sur vos dossiers" },
        icone: "horloge",
      },
    ],
  },
  {
    slug: "basile",
    prenom: "Basile",
    role: "Agent Démarches & recours",
    avatar: "/agents/basile.webp",
    tagline:
      "Face à l'administration, il connaît les textes, les délais et les silences qui valent rejet : courrier motivé, bon fondement, relance au bon moment.",
    expertise:
      "Expert du dialogue avec l'administration — impôts, préfectures, ministères, organismes publics. Il qualifie la démarche (recours gracieux, hiérarchique, réclamation, rectification), rédige le courrier motivé et relance si le silence dure.",
    skills: [
      { label: "Procédures administratives", niveau: 4 },
      { label: "Doctrine fiscale", niveau: 4 },
    ],
    sources: ["Légifrance · codes et textes consolidés", "Justice administrative · CE, CAA et TA", "Fiches Service-Public · démarches officielles"],
    stats: [
      { chiffre: "2 mois", valeur: 2, suffixe: " mois", label: "le silence de l'administration qui fait naître une décision implicite, suivi au jour près", court: "de silence administratif suivis au jour près" },
      { chiffre: "500k", valeur: 500, suffixe: "k", label: "décisions de tribunaux administratifs qu'il peut consulter avant de rédiger", court: "décisions de justice administrative consultables" },
      { chiffre: "0", valeur: 0, label: "référence citée sans vérification : chaque article passe par Légifrance ou reste marqué « à vérifier »", court: "référence citée sans vérification par les sources" },
    ],
    mission: [
      {
        titre: "Qualifier la démarche",
        detail:
          "Recours gracieux, recours hiérarchique, réclamation, demande gracieuse, rectification après un jugement : le bon fondement et la bonne autorité changent tout le courrier. Il identifie la voie adaptée à votre cas.",
      },
      {
        titre: "Rédiger le courrier motivé",
        detail:
          "Références du dossier, faits datés, demande expresse, pièces jointes numérotées : un courrier à l'administration se joue sur la forme autant que sur le fond. Le brouillon arrive prêt à relire.",
      },
      {
        titre: "Relancer quand le silence dure",
        detail:
          "L'administration a des délais de réponse ; lui ne les oublie pas. Silence prolongé, rejet implicite : il vous signale l'échéance et prépare la suite.",
      },
    ],
    savoir: [
      {
        titre: "Codes et textes consolidés",
        corpus: "Légifrance",
        description:
          "Les codes en vigueur, consultés en direct avant chaque courrier : le bon article, dans sa version applicable, pas une approximation de mémoire. Ce qui n'est pas confirmé par la source est marqué « à vérifier ».",
        stat: { chiffre: "En direct", label: "chaque référence est récupérée au moment de la rédaction" },
        icone: "code",
      },
      {
        titre: "Justice administrative",
        corpus: "CE · CAA · TA",
        description:
          "Les décisions du Conseil d'État, des cours administratives d'appel et des tribunaux administratifs : ce que le juge a déjà dit de situations comparables, cité avec juridiction, date et numéro exacts.",
        stat: { chiffre: "500k", valeur: 500, suffixe: "k", label: "décisions de première instance indexées, en plus du fond CE/CAA" },
        icone: "code",
      },
      {
        titre: "Procédures et délais",
        corpus: "CRPA & fiches Service-Public",
        description:
          "Recours gracieux et hiérarchique, décisions implicites, délais de recours : la mécanique administrative, avec ses échéances qu'il ne faut jamais laisser filer.",
        stat: { chiffre: "2 mois", valeur: 2, suffixe: " mois", label: "le délai charnière du contentieux administratif, surveillé sur chaque dossier" },
        icone: "horloge",
      },
    ],
  },
];

export function getAgent(slug: string): Agent | undefined {
  return AGENTS.find((a) => a.slug === slug);
}
