# Étape 9 — Pricing B2B

## Logique d'ensemble

1. **Le premier dossier est le produit d'appel** : prix d'un resto, ROI potentiel de plusieurs milliers d'euros. Il doit être un non-sujet à l'achat.
2. **L'abonnement se vend sur la peur de l'oubli**, pas sur le volume : "vos impayés se relancent tout seuls".
3. **Jamais de commission sur les montants récupérés.** C'est le modèle des recouvreurs, il est détesté, et il rapprocherait BLEME du régime réglementé du recouvrement. Prix fixes, prévisibles, déductibles.
4. Les frais variables (recommandés, revue pro) sont refacturés au réel + marge visible — pas de marge cachée.

## Grille

| Offre | Prix | Contenu |
|---|---|---|
| **Premier dossier** | **39 € TTC one-shot** | Un dossier complet : intake vocal, analyse, timeline, relances + MED en brouillon, envois email, adresse dédiée, suivi 90 jours, export. Garantie : remboursé si aucune relance générée. |
| **Dossier à la carte** | 79 € /dossier | Même contenu, sans abonnement. Volontairement cher : il existe pour rendre l'abonnement évident dès le 2e dossier. |
| **Pro Starter** | **49 € HT/mois** | 3 dossiers actifs simultanés, tout inclus, rappels et cadences, dashboard cash, exports illimités. |
| **Pro Business** | **99 € HT/mois** | 10 dossiers actifs, relances amiables automatiques (opt-in, V2), suivi recommandés par API, support prioritaire, personnalisation des templates (logo, ton). |
| **Pro Scale** | **199 € HT/mois** | Dossiers actifs illimités, multi-utilisateurs (V2), intégrations compta/devis (V2), exports comptables, onboarding dédié. |
| **Annuel** | **–20 %** (Starter 470 €, Business 950 €, Scale 1 910 €/an) | Facturation annuelle — à pousser dès la souscription ("2,4 mois offerts"). |

"Dossier actif" = dossier ni résolu ni clôturé. Un dossier clôturé reste consultable et exportable à vie — le quota ne prend jamais les données en otage.

### Frais variables (à l'acte, tous plans)

| Service | Prix indicatif | Note |
|---|---|---|
| Recommandé papier AR (via API Merci Facteur) | 12-15 € | coût fournisseur ~8-10 € + marge |
| LRE qualifiée (AR24, V2) | 6-9 € | |
| Revue de courrier par un avocat partenaire (V2/V3) | 90-150 € | reversement partenaire, BLEME prend une commission de mise en relation |
| Intervention commissaire de justice / expert (V3) | sur devis | marketplace |

## Stratégie de conversion premier dossier → abonnement

1. **Le moment de vente n'est pas J0, c'est J+20/J+45** : quand le premier dossier avance (réponse reçue, paiement, MED envoyée), l'utilisateur a vu la valeur. Déclencheurs d'upsell : issue positive du dossier n°1, création d'un 2e dossier, fin des 90 jours de suivi.
2. **Crédit d'essai** : les 39 € du premier dossier sont déduits du premier mois d'abonnement ("Passez à Starter, votre premier mois revient à 10 €").
3. **Le dashboard vend l'abonnement** : dès le premier dossier, afficher "Vous avez d'autres factures en retard ? Un artisan a en moyenne 3-4 impayés par an." + bouton d'ajout. Le 2e dossier à la carte coûte 79 € → Starter à 49 €/mois devient mathématiquement évident.
4. **Emails de cycle de vie** : J+7 (état du dossier), à chaque événement (réponse, échéance), J+80 ("votre suivi de 90 jours se termine — passez en Pro pour garder la cadence active").

## Captivité saine (rétention sans prise d'otage)

**Ce qui retient naturellement** :
- L'historique et la timeline : plus le dossier vit, plus le coût de reconstruction ailleurs est élevé.
- L'adresse email par dossier : les fils de discussion avec les débiteurs vivent chez BLEME.
- La cadence automatique : résilier = "mes impayés redeviennent ma charge mentale".
- Les templates personnalisés et l'historique des montants récupérés (preuve de ROI cumulée, affichée en permanence : "BLEME vous a aidé à récupérer 14 200 €").

**Ce qu'on s'interdit** :
- Bloquer l'export : export complet disponible à tout moment, y compris après résiliation (lecture seule + export pendant 12 mois).
- Supprimer les données à la résiliation sans préavis ni export.
- Des frais de sortie.

La confiance est un argument commercial pour cette cible (méfiante envers "les plateformes") : "vos dossiers vous appartiennent, partez quand vous voulez avec tout" figure sur la page pricing.

## Sanity check unit economics

Starter 49 €/mois : coût IA ~3 €/dossier actif/mois grand max + infra marginale (< 2 €) → marge brute > 80 %. Le premier dossier à 39 € couvre ses coûts directs (~5-8 € IA + infra + paiement) et paie une partie du CAC. Le vrai modèle est l'abonnement ; le one-shot est du CAC subventionné rentable.
