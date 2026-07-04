# Étape 4 — User stories V1

Personas : **Karim** (artisan plombier), **Sophie** (freelance), **Marc** (gérant TPE 9 salariés). Critères d'acceptation (CA) en dessous de chaque story quand ils sont structurants.

## Création de dossier

- **US-01** — En tant que Karim, je veux créer un dossier "facture impayée" en moins d'une minute avec juste le nom du client et le montant, afin de ne pas être découragé avant d'avoir commencé.
  - CA : 3 champs max avant la création ; autocomplete SIRENE sur le nom ; le dossier existe en base dès cette étape (reprise possible).
- **US-02** — En tant que Sophie, je veux voir les autres types de problèmes ("litige", "amende") marqués "bientôt disponible" et pouvoir voter, afin de savoir que la plateforme va au-delà de mon cas.

## Entretien vocal

- **US-03** — En tant que Karim, je veux raconter mon problème à voix haute depuis mon téléphone, afin de donner tout le contexte sans rien rédiger.
  - CA : fonctionne sur Safari iOS et Chrome Android ; pause/reprise ; aucune coupure avant 10 min ; jauge encourageante 2-5 min ; fallback texte.
- **US-04** — En tant que Karim, je veux que l'IA me pose 2 à 4 questions de précision après mon récit, afin de compléter ce que j'ai oublié de dire.
- **US-05** — En tant que Sophie, je veux que l'IA me demande ce que l'autre partie pourrait me reprocher, afin d'anticiper les faiblesses de mon dossier.
  - CA : la question "avocat du diable" est posée sur 100 % des dossiers ; les réponses apparaissent dans "Points de vigilance" sur la synthèse.
- **US-06** — En tant que Karim, je veux relire le résumé structuré de mon récit (pas le verbatim) et le corriger, afin que le dossier reparte sur des faits justes.

## Upload et classification de documents

- **US-07** — En tant que Karim, je veux prendre en photo mes factures et devis depuis mon téléphone, afin d'ajouter mes preuves sans scanner.
- **US-08** — En tant que Marc, je veux glisser-déposer plusieurs PDF d'un coup, afin de monter le dossier rapidement.
- **US-09** — En tant que Sophie, je veux que chaque document soit automatiquement reconnu (facture, devis, échange…) et que les montants/dates soient extraits, afin de ne pas ressaisir ce qui est déjà écrit.
  - CA : chaque valeur extraite affiche sa source (document + extrait) ; tout est éditable ; une correction utilisateur est conservée comme vérité.
- **US-10** — En tant que Karim, je veux voir ce qui manque à mon dossier ("devis signé absent"), afin de savoir exactement quoi ajouter pour le solidifier.

## Emails

- **US-11** — En tant que Karim, je veux une adresse email dédiée à mon dossier, afin d'y transférer les échanges avec mon client et que tout soit rangé au même endroit.
  - CA : adresse générée à la création du dossier ; email transféré visible dans le dossier < 1 min ; PJ extraites et classées comme documents.
- **US-12** — En tant que Marc, je veux connecter ma boîte Gmail pour retrouver les échanges liés au dossier *(V2)*, afin de ne pas transférer les emails un par un.
- **US-13** — En tant que Sophie, je veux que les réponses de mon client aux relances arrivent directement dans le dossier avec un résumé, afin de comprendre la situation en 10 secondes.
- **US-14** — En tant que Karim, je veux être notifié par email quand le débiteur répond, afin de réagir vite sans vivre dans l'application.

## Timeline

- **US-15** — En tant que Sophie, je veux une chronologie générée automatiquement (devis → prestation → facture → échéance → relances → réponses), afin de visualiser l'affaire d'un coup d'œil.
  - CA : chaque événement est daté, sourcé (document/email/récit), éditable et supprimable ; export inclus dans le PDF de synthèse.

## Relances et courriers

- **US-16** — En tant que Karim, je veux qu'une relance amiable soit rédigée pour moi avec les bons montants et références, afin de l'envoyer sans y passer une heure et sans me tromper.
- **US-17** — En tant que Sophie, je veux choisir le ton de la relance (cordial ou ferme), afin de préserver la relation quand c'est un bon client.
- **US-18** — En tant que Karim, je veux un brouillon de mise en demeure conforme aux usages, afin de passer à l'étape sérieuse sans avocat.
  - CA : mentions d'usage présentes (rappel créance, délai, réserve d'action) ; bandeau "à relire / faire valider si doute" ; jamais d'envoi sans validation.
- **US-19** — En tant que Marc, je veux valider explicitement chaque courrier avant envoi (et pouvoir l'éditer), afin de garder le contrôle total sur ce qui part en mon nom.
  - CA : bouton "J'ai relu, envoyer en mon nom" ; log horodaté de la version validée ; les modifications manuelles sont conservées.
- **US-20** — En tant que Karim, je veux être prévenu quand la relance suivante est prête (J+7, J+15), afin que la pression continue sans que j'y pense.

## Suivi des réponses

- **US-21** — En tant que Sophie, je veux que l'IA analyse la réponse du débiteur (promesse de payer, contestation, silence) et me propose la prochaine action, afin de ne jamais rester bloquée sur "et maintenant ?".
- **US-22** — En tant que Karim, je veux marquer un paiement reçu (total ou partiel), afin que le dossier reflète la réalité et que mon dashboard "récupéré" monte.

## Recommandé

- **US-23** — En tant que Karim, je veux recevoir la mise en demeure en PDF prêt à poster avec la marche à suivre, afin d'envoyer mon recommandé sans me poser de questions. *(V1)*
- **US-24** — En tant que Marc, je veux envoyer le recommandé directement depuis BLEME et suivre sa distribution, afin de ne jamais mettre les pieds à La Poste. *(V1.5)*

## Dashboard

- **US-25** — En tant que Marc, je veux voir en un écran le total de mes impayés suivis, ce que j'ai récupéré et les dossiers qui stagnent, afin de piloter mon cash comme je pilote mes chantiers.
- **US-26** — En tant que Karim, je veux voir les actions en attente ("1 relance à valider"), afin de savoir ce que BLEME attend de moi aujourd'hui.

## Export

- **US-27** — En tant que Sophie, je veux exporter mon dossier complet (synthèse PDF + pièces numérotées + chronologie + courriers) en un clic, afin de le transmettre tel quel à un avocat ou commissaire de justice.
  - CA : ZIP avec bordereau de pièces numéroté ; PDF de synthèse horodaté ; export disponible même après fin d'abonnement (pas de prise d'otage des données).

## Compte et facturation

- **US-28** — En tant que Karim, je veux payer mon premier dossier à l'unité avant de m'engager, afin de tester la valeur sans abonnement.
- **US-29** — En tant que Marc, je veux passer à l'abonnement et voir mon premier dossier déduit, afin d'être récompensé d'avoir essayé.
- **US-30** — En tant que Sophie, je veux exporter puis supprimer toutes mes données, afin de rester maîtresse de mes informations.
