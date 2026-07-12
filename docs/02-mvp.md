# Étape 2 — Choix du MVP

## Décision : impayés + litiges clients *(arbitrage produit du 04/07/2026)*

Le MVP couvre **deux types de dossiers** : la facture impayée (le cœur, avec séquence de relance automatisée) et le **litige client** (dossier documenté + courriers à la carte). L'analyse initiale recommandait les impayés seuls ; la décision produit est d'inclure les litiges dès la V1 — avec un périmètre volontairement plus souple pour rester livrable en 30 jours.

### Comment les deux types cohabitent sans doubler le travail

- **Impayé** = playbook standardisé : séquence J0 → J+7 → J+15 (relance, relance ferme, MED), cadence automatique, métriques cash. C'est le parcours qui vend.
- **Litige client** = même moteur (intake vocal, avocat du diable, preuves, extraction, timeline, score de complétude, export), mais **pas de séquence automatique** : l'IA propose un plan d'action au cas par cas et l'utilisateur pioche dans des courriers types. Le litige V1 est un "dossier béton + courriers", pas un workflow cadencé.
- ~80 % du code est commun. Ce qui est spécifique au litige : un playbook, une checklist de pièces, 3-4 templates de courriers supplémentaires.

### Exemples de litiges clients couverts en V1 *(à approfondir ensemble)*

1. **Impayé contesté** — le client refuse de payer en invoquant des malfaçons ou un retard (la passerelle naturelle : un dossier impayé bascule en litige).
2. **Travaux supplémentaires contestés** — "je n'ai jamais validé cet avenant" : documenter l'accord (emails, SMS, devis modifié).
3. **Demande de reprise / remboursement** — le client exige une reprise de travaux ou le remboursement d'un acompte.
4. **Refus de réception de chantier** — le client ne signe pas le PV et bloque le solde.
5. **Commande annulée après démarrage** — prestation entamée, client qui se rétracte : documenter l'engagement et les coûts engagés.
6. **Livrable contesté (freelance)** — périmètre ou qualité remis en cause après livraison.
7. **Retenue de garantie non restituée** (BTP) — délai écoulé, rien ne vient.

Courriers types litige V1 : réponse circonstanciée à une réclamation, courrier de contestation, proposition de résolution amiable, mise en demeure (payer / restituer / reprendre). Tous en brouillon, tous validés avant envoi — et sur les litiges, l'"avocat du diable" et les points de vigilance sont encore plus centraux que sur les impayés.

### Justification du cœur "impayés d'abord"

1. **Un seul playbook à rendre excellent.** Le parcours impayé est standardisable : relance amiable → relance ferme → mise en demeure → recommandé → (hors BLEME : injonction de payer via un pro). Chaque dossier suit ~le même chemin, donc l'IA, les modèles de courriers et l'UX peuvent être affûtés sur des dizaines de dossiers similaires. Les litiges travaux, eux, sont tous différents (malfaçons, expertise, assurance décennale…) : impossibles à industrialiser en V1.
2. **Le ROI est mesurable en euros.** "BLEME m'a fait récupérer 8 300 € ce trimestre" = le témoignage qui vend. Un litige "géré" n'a pas de métrique aussi nette.
3. **Le risque juridique est minimal.** Relancer sa propre facture est un droit évident ; les courriers types (relance, mise en demeure) sont des modèles publics standard. Dès qu'on touche aux litiges de malfaçons ou au fiscal, la frontière avec la consultation juridique se rapproche.
4. **L'architecture n'enferme rien.** `case_types` est extensible : chaque nouveau type est une ligne en base + un playbook, pas une refonte.

Le marketing et la landing restent centrés sur l'impayé (promesse chiffrable) ; le litige est présenté comme "et si ça se complique, BLEME gère aussi le litige" — c'est un argument de rétention et de complétude, pas le message d'acquisition principal.

---

## Fonctionnalités V1 obligatoires

| # | Fonctionnalité | Détail |
|---|---|---|
| 1 | Auth + organisation | Email/password + magic link, une organisation par compte (mono-utilisateur en V1) |
| 2 | Création de dossier (2 types) | "Facture impayée" (wizard : qui, combien, depuis quand) et "Litige client" (wizard : avec qui, à propos de quoi, où ça en est) |
| 3 | **Intake vocal** | Enregistrement 2-5 min dans le navigateur, transcription, questions de relance de l'IA dont l'"avocat du diable" ; alternative texte toujours disponible |
| 4 | Upload documents | Drag & drop, mobile-friendly (photo de facture), PDF/images/emails .eml |
| 5 | Extraction IA | Montants, dates, parties, numéros de facture, échéances — affichés avec source et éditables |
| 6 | Classification des documents | facture / devis / bon de livraison / échange / preuve de relance / autre |
| 7 | Score de complétude | "Il manque le devis signé" — checklist dynamique par type de dossier |
| 8 | Timeline du dossier | Chronologie auto-générée (devis → travaux → facture → échéance → relances), éditable |
| 9 | Génération relance amiable | Brouillon email + PDF, ton personnalisable (cordial/ferme) |
| 10 | Génération mise en demeure | Brouillon PDF conforme aux mentions d'usage, avec disclaimer de validation |
| 10b | Courriers litige à la carte | Réponse à réclamation, contestation, proposition amiable, MED (payer/restituer/reprendre) — proposés par l'IA selon le cas |
| 11 | **Validation avant tout envoi** | Écran de review obligatoire, bouton explicite, log d'approbation |
| 12 | Envoi email des relances | Depuis une adresse BLEME au nom de l'utilisateur (reply-to = adresse du dossier) |
| 13 | Adresse email par dossier | `d-abc123@dossiers.bleme.fr` : tout email transféré ou reçu y est rattaché et classé |
| 14 | Suivi des réponses | Email entrant → notification → l'IA résume et propose la prochaine action |
| 15 | Rappels / prochaines actions | "Relance J+7 prête", "Pas de réponse à la MED depuis 8 jours" — email + in-app |
| 16 | Dashboard cash | Total impayés suivis, montant récupéré, dossiers à risque, prochaines actions |
| 17 | Export dossier | PDF de synthèse + ZIP horodaté (docs + timeline + courriers) prêt pour avocat/commissaire |
| 18 | Paiement | Stripe : dossier à 19 € HT, Pro 9 € HT/mois avec 1 dossier inclus par mois |

**Envoi recommandé** : en V1, BLEME **génère le PDF prêt à poster** + guide l'utilisateur (ou lien vers un service en ligne). L'API (Maileva/Merci Facteur) arrive en V1.5 — c'est une intégration à risque de friction (adresse invalide, suivi) qu'il ne faut pas mettre sur le chemin critique du lancement.

## Fonctionnalités repoussées (V2/V3)

- Connexion Gmail/Outlook OAuth (audit CASA — commencer le process pendant la V1, livrer en V2)
- Envoi recommandé via API + suivi AR automatique (V1.5)
- LRE (lettre recommandée électronique qualifiée AR24) — utile mais le débiteur doit consentir ou être identifié : friction
- Amendes pro, gracieux fiscal (types de dossiers V2/V3)
- Séquences automatiques sur les litiges (V2, quand les patterns récurrents auront émergé des dossiers réels)
- Relances automatiques sans validation (V2, opt-in, uniquement relances amiables)
- Multi-utilisateurs / rôles
- Marketplace avocats/experts/commissaires
- Intégrations compta (Pennylane, Indy, Sellsy) et logiciels devis BTP (Batappli, Obat…) — gros levier GTM V2
- App mobile native (le web mobile-first suffit en V1)

## Fonctionnalités dangereuses à éviter (à tout jamais ou presque)

1. **Score de "chances de gagner"** ou pronostic judiciaire → consultation juridique déguisée. On garde uniquement complétude et solidité documentaire.
2. **Envoi automatique de mise en demeure** sans validation → risque juridique et réputationnel majeur.
3. **Encaissement des fonds du débiteur** sur un compte BLEME → régime réglementé du recouvrement + établissement de paiement. Jamais.
4. **Relances signées "BLEME" au nom du créancier** → recouvrement pour compte de tiers (décret 96-1112). Les courriers sont toujours signés par l'utilisateur, BLEME est l'outil.
5. **Conseil de stratégie judiciaire** ("assignez plutôt que l'injonction") → réservé aux avocats. On dit : "à ce stade, certains professionnels peuvent vous accompagner ; voici votre dossier exporté."
6. Génération de conclusions, assignations, actes de procédure.

---

## Parcours utilisateur exact — premier dossier

**Contexte : Karim, plombier, facture de 2 400 € impayée depuis 47 jours par un contractant général.**

1. **Landing → "Créer mon premier dossier"**. Inscription email + mot de passe (ou magic link). Pas de CB avant de voir la valeur : la CB arrive à l'étape 8.
2. **Choix du type** : deux choix actifs en V1 ("Facture impayée", "Litige client"), les autres (amende, démarche administrative) visibles "bientôt" (signal roadmap + capture d'intérêt par vote).
3. **Mini-formulaire (30 s)** : nom du client débiteur (autocomplete SIRENE), montant approximatif, date de la facture. Juste assez pour créer le dossier.
4. **Écran vocal** — le moment signature :
   - "Racontez votre blème à voix haute. Visez 2 à 5 minutes : plus vous donnez de contexte, plus votre dossier sera solide."
   - Jauge de progression encourageante (pas de compte à rebours bloquant), possibilité de pause/reprise, alternative "je préfère écrire".
   - À la fin, l'IA pose 2-4 questions de relance ciblées, dont systématiquement : **"Qu'est-ce que [le débiteur] pourrait répondre pour justifier de ne pas payer ?"**
5. **Upload des preuves** : drag & drop ou photo. L'IA affiche en direct ce qu'elle a reconnu ("Facture F-2024-031, 2 400 € TTC, échéance 15/05").
6. **Écran de synthèse du dossier** (le "wow") :
   - Résumé du problème en 5 lignes, parties identifiées, montant, ancienneté.
   - Timeline générée.
   - Score de complétude : "7/10 — il manque : devis signé, preuve de fin de chantier".
   - Encadré "Point de vigilance" issu de l'avocat du diable : "Le client évoque un retard de chantier : ajoutez tout échange prouvant que le délai a été accepté."
7. **Plan d'action proposé** : ① Relance amiable aujourd'hui → ② Relance ferme J+7 → ③ Mise en demeure recommandée J+15. Chaque étape = brouillon déjà prêt.
8. **Paywall naturel** : "Votre dossier est prêt. Ouvrez-le pour 19 € HT : envoi des relances, suivi des réponses, adresse email dédiée, export complet. Avec Pro, votre dossier mensuel inclus peut être utilisé." Paiement Stripe si le dossier n'est pas inclus.
9. **Validation de la relance n°1** : brouillon affiché, éditable, bouton "J'ai relu, envoyer en mon nom". Envoi. Confetti sobre.
10. **Suivi** : l'utilisateur reçoit un email à chaque réponse du débiteur et à chaque action planifiée. Il revient sur BLEME via ces emails — c'est la boucle de rétention.

## Ce que l'utilisateur voit à l'écran (V1, 6 écrans)

1. **Dashboard** : 4 tuiles (En jeu : X € / Récupéré : X € / Dossiers à risque / Actions en attente) + liste des dossiers avec statut coloré + bouton "Nouveau blème".
2. **Création** : wizard 3 étapes (infos → vocal → documents), barre de progression.
3. **Dossier** (écran central, onglets) : Synthèse | Timeline | Documents | Courriers | Emails. Colonne droite fixe : score de complétude + prochaine action + bouton export.
4. **Review courrier** : brouillon pleine page, champs extraits surlignés avec leur source, édition inline, disclaimer, bouton de validation explicite.
5. **Boîte du dossier** : fil des emails entrants/sortants, résumé IA en tête de chaque message, suggestion de réponse.
6. **Réglages** : profil, entreprise (SIRET, adresse — réutilisés dans les courriers), abonnement, export/suppression des données.
