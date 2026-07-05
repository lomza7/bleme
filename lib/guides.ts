/*
 * Catalogue des guides pratiques : partagé entre /guides (index),
 * app/sitemap.ts et le footer. Chaque guide vit dans
 * app/guides/<slug>/page.tsx ; ce fichier ne porte que les métadonnées
 * de listing. Regroupement par thème pour l'index.
 */

export type Guide = {
  slug: string;
  titre: string;
  resume: string;
};

export type GuideCategorie = {
  titre: string;
  guides: Guide[];
};

export const GUIDE_CATEGORIES: GuideCategorie[] = [
  {
    titre: "Impayés et relances",
    guides: [
      {
        slug: "facture-impayee-que-faire",
        titre: "Facture impayée : que faire, étape par étape",
        resume:
          "Relance amiable, relance ferme, mise en demeure, recours : le calendrier complet, les délais légaux et les erreurs qui coûtent cher.",
      },
      {
        slug: "relance-facture-impayee",
        titre: "Relancer une facture impayée : méthode, ton et calendrier",
        resume:
          "Ce qu'une bonne relance contient, le ton juste à chaque étape, et le rythme qui fait payer sans abîmer la relation client.",
      },
      {
        slug: "mise-en-demeure-de-payer",
        titre: "Mise en demeure de payer : mentions, envoi, effets",
        resume:
          "Les mentions indispensables, pourquoi le recommandé n'est pas un détail, et ce que la mise en demeure change juridiquement.",
      },
      {
        slug: "penalites-de-retard",
        titre: "Pénalités de retard entre professionnels : taux et calcul",
        resume:
          "Dues sans rappel dès le lendemain de l'échéance. Le taux minimum, la formule de calcul et les mentions obligatoires sur vos factures.",
      },
      {
        slug: "indemnite-forfaitaire-40-euros",
        titre: "Indemnité forfaitaire de 40 € : la pénalité automatique",
        resume:
          "Due de plein droit pour chaque facture en retard entre pros. Qui peut la réclamer, comment la chiffrer, et ses limites.",
      },
      {
        slug: "delais-de-paiement-entre-professionnels",
        titre: "Délais de paiement entre professionnels : 30, 45 ou 60 jours",
        resume:
          "Le délai par défaut, les plafonds légaux, les cas particuliers et les amendes de la DGCCRF qui sanctionnent les mauvais payeurs.",
      },
    ],
  },
  {
    titre: "Recours et procédures",
    guides: [
      {
        slug: "injonction-de-payer",
        titre: "Injonction de payer : la procédure pas à pas",
        resume:
          "La voie judiciaire la plus simple pour une créance non contestée : requête, coût réel, délais, signification et opposition.",
      },
      {
        slug: "recouvrement-creance-moins-5000-euros",
        titre: "Créance de moins de 5 000 € : la procédure simplifiée",
        resume:
          "Obtenir un titre exécutoire par commissaire de justice, sans juge : conditions, déroulement, coût et limites de l'article L125-1.",
      },
      {
        slug: "prescription-facture-impayee",
        titre: "Prescription d'une facture impayée : combien de temps pour agir",
        resume:
          "5 ans entre professionnels, 2 ans face à un particulier. Ce qui interrompt le délai, ce qui ne l'interrompt pas, et les pièges.",
      },
    ],
  },
  {
    titre: "Litiges, preuves et clients",
    guides: [
      {
        slug: "client-conteste-travaux-facture",
        titre: "Client qui conteste vos travaux ou votre facture : que faire",
        resume:
          "Quand l'impayé devient litige : répondre point par point, documenter, réclamer la partie non contestée et garder le dossier solide.",
      },
      {
        slug: "preuves-impaye-litige",
        titre: "Emails, WhatsApp, photos : quelles preuves comptent vraiment",
        resume:
          "Ce qui est recevable entre professionnels et face à un particulier, comment conserver les échanges, et ce qui fait un dossier convaincant.",
      },
      {
        slug: "devis-signe-valeur-juridique",
        titre: "Devis signé : quelle valeur juridique, quelles obligations",
        resume:
          "Ce qu'un devis signé engage réellement, les mentions qui protègent, et comment traiter les travaux supplémentaires sans se faire piéger.",
      },
      {
        slug: "facture-impayee-client-particulier",
        titre: "Facture impayée par un particulier : ce qui change",
        resume:
          "Prescription de 2 ans, pas d'indemnité de 40 €, exigence d'écrit : les règles spécifiques quand le mauvais payeur est un consommateur.",
      },
    ],
  },
];

export const GUIDES: Guide[] = GUIDE_CATEGORIES.flatMap((c) => c.guides);
