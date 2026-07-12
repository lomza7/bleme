# Étape 9 — Pricing B2B

> **Révision v3 du 12/07/2026 (décision produit — modèle dossier + Pro léger)** :
> le prix doit être évident pour un artisan qui a un besoin ponctuel, tout en
> rendant Pro naturel pour ceux qui ont plusieurs blèmes, veulent brancher leurs
> outils ou transmettre facilement à un professionnel.

## Grille publique

| Offre | Prix | Contenu |
|---|---:|---|
| **Sans abonnement** | **0 € / mois** + **19 € HT / dossier ouvert** | Préparation gratuite : récit vocal, preuves, boîte de réception, chronologie, brouillons visibles. Chaque dossier ouvert est payé une fois, suivi jusqu'à résolution ou clôture, exportable à vie. |
| **Pro** | **9 € HT / mois** | **1 dossier inclus par mois**, dossiers supplémentaires à **10 € HT**, API + webhooks, stockage illimité des preuves/documents, dossiers en préparation illimités, export facile vers avocat ou comptable. |
| **Pro annuel** | **90 € HT / an** | Même contenu que Pro mensuel, 2 mois offerts. |

## Envois refacturés au réel

| Service | Prix indicatif | Note |
|---|---:|---|
| Relances par email | Incluses | Dans chaque dossier ouvert, après validation utilisateur. |
| Lettre simple suivie | 5 € HT | Prix affiché avant validation. |
| Recommandé papier avec AR | 10 € HT | Prix affiché avant validation ; AR versé aux preuves. |
| LRE qualifiée | 8 € HT | V2. |

## Invariants

1. **Aucune commission sur les sommes récupérées.** BLEME reste un logiciel à prix fixe, pas une société de recouvrement rémunérée au résultat.
2. **Rien ne part sans validation explicite.** Le gratuit prépare ; l'ouverture du dossier débloque les envois, toujours validés par l'utilisateur.
3. **Les données ne sont jamais prises en otage.** Export complet à tout moment ; un dossier clôturé reste consultable et exportable.
4. **Le prix est lisible avant action.** Dossier, abonnement et envois affichent leur coût avant paiement ou validation.

## Logique commerciale

- **Sans abonnement** : l'offre rassurante. 0 €/mois, pas d'engagement, 19 € HT seulement quand un dossier mérite d'être ouvert.
- **Pro** : le réflexe des pros qui ont des impayés récurrents, de la compta connectée ou un besoin de transmission propre. Le premier dossier mensuel est inclus ; le deuxième dans le même mois coûte 10 € HT.
- **Exports pro** : l'argument de confiance. BLEME prépare le dossier pour soi, mais aussi pour l'avocat, le comptable ou le collaborateur qui devra reprendre.
- **API + webhooks** : inclus dans Pro, pour connecter les factures, déclencher des créations de dossiers et recevoir les événements.

## Exemple simple

Facture impayée de 2 400 € :

- Sans abonnement : dossier 19 € HT + recommandé AR 10 € HT = **29 € HT**.
- Avec Pro, premier dossier du mois : abonnement 9 € HT + dossier inclus + recommandé AR 10 € HT = **19 € HT le mois du dossier**.
- Avec Pro, dossier supplémentaire le même mois : dossier 10 € HT + recommandé AR 10 € HT = **20 € HT**.

Ancre concurrentielle : une mise en demeure par avocat se facture souvent 90-300 € ; une société de recouvrement prend 10-20 % du recouvré. BLEME doit rester fixe, prévisible et sans commission.

## Points de vigilance

- Le crédit mensuel Pro doit être implémenté comme **1 dossier inclus par organisation et par mois calendaire**.
- Si la concurrence de deux ouvertures simultanées devient un vrai sujet, ajouter une contrainte ou table de crédits mensuels dédiée avant passage à fort volume.
- Le stockage est annoncé illimité côté produit ; surveiller les coûts et prévoir une fair-use policy en CGU si nécessaire.
