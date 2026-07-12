# Étape 1 — Analyse stratégique

## Verdict en une phrase

L'opportunité est réelle et monétisable, mais le produit tel que décrit est trop large : BLEME ne gagnera que s'il se lance comme **l'outil de recouvrement des impayés pour artisans**, pas comme le "cockpit des problèmes administratifs".

---

## 1. Le marché

- **~56 milliards €** d'impayés B2B en France chaque année ; ~25 % des défaillances de TPE/PME sont liées aux retards de paiement.
- Le BTP est le secteur le plus touché : délais de paiement moyens > 70 jours, litiges de chantier fréquents, retenues de garantie abusives.
- Les artisans/TPE n'ont **ni service admin, ni juriste, ni temps**. Le recouvrement judiciaire (injonction de payer) est simple sur le papier mais personne ne monte le dossier.
- Concurrence existante mais mal positionnée pour ta cible :
  - **Recouvrement** : Rubypayeur, GCollect, Cashontime, Upflow, LeanPay → orientés PME/mid-market avec compta structurée, ou pur recouvrement (commission au succès), pas de gestion de dossier/preuves.
  - **Legaltech grand public** : Litige.fr, demanderjustice.com → transactionnel, one-shot, pas de suivi ni d'IA, UX datée.
  - **Personne** ne fait : intake vocal + centralisation des preuves + timeline + relances suivies, pensé pour un plombier.

**Le créneau existe : entre "je relance à la main dans Gmail" et "je paye une société de recouvrement 15 % du montant".**

## 2. Ce qui est fort

1. **La douleur est financière et chiffrable.** "Récupérez vos 2 400 €" se vend infiniment mieux que "gérez votre paperasse". Le ROI est démontrable dès le premier dossier.
2. **L'intake vocal est un vrai différenciateur pour CETTE cible.** Un artisan ne rédigera jamais un formulaire de 15 champs ; il racontera son problème au téléphone dans sa camionnette. C'est un avantage d'onboarding, pas un gadget.
3. **Le concept "dossier"** (preuves + chronologie + actions + export) est la bonne unité produit. C'est ce qui manque à tous les concurrents : quand ça part chez l'avocat ou le commissaire de justice, le client arrive avec un dossier propre. Valeur énorme, coût marginal faible.
4. **L'"avocat du diable"** ("qu'est-ce que l'autre partie pourrait répondre ?") est une excellente idée : elle améliore la qualité du dossier ET protège juridiquement BLEME (on aide à documenter, on ne promet pas la victoire).
5. **Le timing** : les LLM rendent enfin possible l'extraction/classement/rédaction à un coût compatible avec un dossier à 19 € HT et un Pro léger à 9 € HT/mois.

## 3. Ce qui est faible

1. **Le positionnement "cockpit des problèmes administratifs et financiers" est flou.** Personne n'achète un cockpit. On achète "récupérer mon argent". Le cockpit est la vision à 3 ans, pas le pitch.
2. **La liste de fonctionnalités est un catalogue, pas un produit.** Amendes + gracieux impôts + litiges travaux + impayés + marketplace = 5 produits différents avec 5 playbooks, 5 réglementations, 5 messages marketing. Au MVP, ça garantit un produit médiocre partout.
3. **Le nom BLEME** : mémorable et sympathique pour la cible artisan (le "blème" = le problème), mais assume-le à fond ou pas du tout. À l'écrit, "blême" évoque aussi la pâleur/maladie. Ce n'est pas bloquant — c'est même différenciant face aux noms corporate — mais le branding doit être confiant et pro pour compenser. Décision : on garde, avec un ton direct.
4. **La stack fantasme un peu** (voir Étape 5) : Wispr n'est pas une API de transcription, Gmail OAuth est un chantier réglementaire de plusieurs mois, Obsidian n'est pas une brique produit. Rien de grave, mais il faut trancher techniquement.

## 4. Ce qui est risqué

| Risque | Gravité | Mitigation |
|---|---|---|
| **Exercice illégal du droit** (loi du 31/12/1971 : la consultation juridique personnalisée est réservée aux avocats) | Élevée | Positionnement strict "outil d'organisation et de rédaction assistée" ; jamais de pronostic, jamais de stratégie judiciaire ; validation humaine sur tout envoi ; CGU béton ; modèles de courriers = documents que l'utilisateur aurait pu écrire lui-même |
| **Activité de recouvrement pour compte de tiers** (encadrée : décret 96-1112, garantie financière, compte séparé) | Élevée si mal fait | BLEME n'encaisse JAMAIS l'argent du débiteur et ne relance pas "au nom de" — l'utilisateur envoie ses propres courriers, signés par lui. C'est structurant pour le produit. |
| **Google OAuth restricted scopes (Gmail)** : vérification + audit CASA, 3-6 mois, coût | Moyenne | Pas de Gmail en V1. Adresse email dédiée par dossier + transfert d'emails = 90 % de la valeur sans le risque. |
| **RGPD** : données de litiges = données sensibles de fait (santé financière, conflits) | Moyenne | Hébergement UE, minimisation, DPA Supabase/Vercel, pas d'entraînement de modèles sur données clients, purge/export |
| **Hallucination IA dans un courrier engageant** | Élevée | Tout courrier = brouillon, diff visible, validation explicite, montants/dates extraits affichés avec leur source |
| **CAC élevé sur les artisans** (cible difficile à toucher en ligne) | Moyenne | Canaux : bouche-à-oreille, comptables, CAPEB/FFB, groupes Facebook métiers, partenariats logiciels de devis (voir GTM) |

## 5. Ce qui doit être recentré

- **Un seul cas d'usage au lancement : la facture impayée B2B.** Les amendes, le gracieux fiscal, les litiges travaux → V2/V3. Ils restent dans l'architecture (types de dossiers) mais pas dans le produit vendu. *(Arbitrage produit final du 04/07/2026 : les litiges clients sont finalement inclus au MVP, avec un périmètre allégé — voir [02-mvp.md](02-mvp.md).)*
- **Une seule cible : artisans du bâtiment 1-10 personnes** (plombiers, chauffagistes, électriciens, climaticiens). Les freelances/agences viendront seuls — le produit leur servira — mais tout le marketing, le vocabulaire et les playbooks V1 parlent BTP.
- **Une seule promesse : "vos impayés se font relancer tout seuls, et votre dossier est prêt si ça se corse."**
- La marketplace avocats/experts : pas avant d'avoir du volume. C'est un modèle d'affaires différent (place de marché) qui se greffera sur la base installée.

## 6. Pourquoi B2B d'abord (et pas B2C)

1. **Récurrence** : un artisan a des impayés tous les mois → abonnement justifié. Un particulier a un litige tous les 3 ans → one-shot, churn structurel.
2. **Willingness to pay** : 19 € HT par dossier et 9 € HT/mois en Pro sont des dépenses pro quasi indolores, comparées aux 15 % de commission d'un recouvreur ou aux heures perdues. Un particulier compare à "gratuit".
3. **Risque réglementaire moindre** : pas de droit de la consommation côté client, litiges B2B plus standardisés (facture, devis, bon de livraison).
4. **LTV/CAC** : le B2B permet des canaux ciblés (comptables, fédérations, logiciels métiers) ; le B2C exige de la pub mass-market hors de portée.
5. **Les données B2B sont meilleures** : factures et devis structurés → extraction IA plus fiable → produit plus impressionnant dès la démo.

## 7. Segment à attaquer en premier

**Artisans BTP en solo ou < 10 salariés, factures impayées de 1 000 à 25 000 €, en France.**

Pourquoi ce sweet spot :
- En dessous de 1 000 € : l'artisan abandonne, mais ne paiera pas non plus pour récupérer.
- Au-dessus de 25 000 € : il appelle directement un avocat.
- Entre les deux : c'est exactement la zone "trop gros pour abandonner, trop petit pour un avocat" — la zone morte que BLEME occupe.

Beachhead GTM : 2-3 métiers (plomberie/chauffage/clim — même écosystème, mêmes fédérations, mêmes groupes Facebook), une région pour les premiers 50 clients (effet bouche-à-oreille local), puis élargissement national par le SEO ("facture impayée artisan", "mise en demeure plombier", volumes de recherche réels et faibles concurrences).
