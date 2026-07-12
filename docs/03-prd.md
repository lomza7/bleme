# Étape 3 — PRD BLEME V1

> Périmètre : MVP "facture impayée" tel que tranché dans [02-mvp.md](02-mvp.md). Les sections renvoient aux documents détaillés quand ils existent.

## 1. Vision produit

BLEME transforme un problème professionnel (un "blème") en dossier suivi : preuves centralisées, chronologie claire, courriers prêts, relances au bon moment, export propre si un professionnel doit prendre le relais. Vision long terme : le cockpit IA des problèmes administratifs et financiers des TPE. Vision V1 : **l'outil qui fait rentrer l'argent des factures impayées des artisans.**

## 2. Objectifs

**Business (6 mois)** : 200 clients payants, 30 % de conversion vers Pro après ouverture d'un dossier, MRR 8 k€.
**Produit** : un utilisateur non technique crée un dossier complet en < 15 minutes ; première relance envoyée dans la première session pour > 60 % des dossiers créés.
**Preuve de valeur** : > 500 k€ d'impayés suivis, > 100 k€ marqués "récupérés" par les utilisateurs.

## 3. Utilisateurs cibles

Primaire : dirigeant d'entreprise artisanale BTP (1-10 pers.), 30-55 ans, sur mobile la moitié du temps, allergique à la paperasse, à l'aise avec WhatsApp/vocal.
Secondaire (non ciblé mais servi) : freelances, consultants, agences, TPE de service.
Influenceurs d'achat : expert-comptable, conjoint(e) qui fait l'admin, fédérations pro.

## 4. Problèmes utilisateurs

Voir [01-analyse-strategique.md](01-analyse-strategique.md). Résumé : les impayés ne sont pas relancés (pas de temps, pas de méthode, malaise relationnel), les preuves sont éparpillées (Gmail, WhatsApp, photos), les délais s'oublient, les dossiers dorment jusqu'à la prescription, et quand un pro reprend le dossier, tout est à reconstituer.

## 5. Proposition de valeur

"Confiez votre blème : BLEME monte le dossier, prépare les courriers, relance au bon moment et garde tout prêt pour la suite. Vous validez, vous encaissez."
Trois piliers : **récupérer l'argent** (relances qui partent vraiment), **ne rien oublier** (échéances, réponses, recommandés), **dossier béton** (preuves classées, chronologie, export pro).

## 6. Personas

**Karim, 38 ans, plombier-chauffagiste, 2 salariés.** CA 320 k€, ~15 k€ d'impayés en permanence. Fait ses devis sur Batappli, ses mails sur Gmail, sa "compta" dans un classeur. Relance par SMS gêné, abandonne au-delà de 2 relances. Déclencheur d'achat : un impayé de 4 000 € d'un contractant général qui fait le mort.

**Sophie, 31 ans, graphiste freelance.** 3-4 clients par mois, un impayé par trimestre (800-3 000 €). Sait écrire, mais ne connaît pas les étapes (MED ? injonction ?) et déteste le conflit. Veut un processus qui la légitime ("c'est la procédure, ce n'est pas moi").

**Marc, 52 ans, gérant d'une PME d'électricité, 9 salariés.** Sa femme fait l'admin le soir. 40-60 k€ d'encours à risque. Compare BLEME au recouvreur qui lui prend 12 %. Sensible au dashboard et à l'export comptable.

## 7. Cas d'usage prioritaires

1. Facture impayée B2B (cœur V1) — du retard simple au débiteur fantôme.
2. Litige client (V1) — impayé contesté, travaux supplémentaires contestés, demande de reprise/remboursement, refus de réception, commande annulée, livrable contesté, retenue de garantie. Dossier documenté + courriers à la carte, sans séquence automatique (voir [02-mvp.md](02-mvp.md)).
3. Préparation du passage au judiciaire — export du dossier pour avocat/commissaire de justice (BLEME s'arrête là en V1).

## 8. Parcours utilisateur V1

Détaillé dans [02-mvp.md](02-mvp.md) §Parcours. Séquence : inscription → type de dossier → mini-form → **intake vocal + avocat du diable** → upload preuves → synthèse + score → plan d'action → paiement → validation relance n°1 → boucle de suivi par email.

## 9. Fonctionnalités V1

Liste tranchée dans [02-mvp.md](02-mvp.md) §V1 (18 items). Rappel des non-négociables : intake vocal, extraction sourcée et éditable, timeline, score de complétude, brouillons relance + MED, validation obligatoire, adresse email par dossier, dashboard cash, export.

## 10. Fonctionnalités V2/V3

V1.5 : recommandé par API (Merci Facteur) + suivi AR ; rappels SMS.
V2 : Gmail/Outlook OAuth (audit CASA lancé pendant V1) ; relances amiables automatiques opt-in ; séquences semi-automatiques sur les litiges récurrents ; multi-utilisateurs ; intégrations devis/compta ; LRE (AR24).
V3 : amendes pro, gracieux fiscal ; marketplace pros (avocat, commissaire, expert) ; API publique ; scoring débiteurs inter-clients (données agrégées, anonymisées, opt-in).

## 11. Hors scope (définitif ou long terme)

Encaissement des fonds, relances au nom de BLEME, pronostics de victoire, actes de procédure, conseil de stratégie judiciaire, B2C consommateurs, recouvrement de masse (portefeuilles importés en CSV de 500 factures — c'est un autre produit).

## 12. Garde-fous juridiques

- **Positionnement** : outil d'organisation, de rédaction assistée et de suivi. Pas de consultation juridique personnalisée (loi 71-1130), pas de recouvrement pour compte de tiers (décret 96-1112).
- Tous les courriers sont **rédigés au nom de l'utilisateur, signés par lui, envoyés après validation explicite** (log horodaté : qui, quoi, quand, quelle version).
- Vocabulaire produit : "brouillon", "modèle", "suggestion", "à faire valider si besoin par un professionnel". Interdits : "gagner", "stratégie", "conseil", "défendre", "vos droits vous permettent de…" personnalisé.
- Bandeau permanent sur les courriers sensibles (MED) : "Document généré à partir de vos informations. Relisez-le et, en cas de doute, faites-le valider par un professionnel du droit."
- Les montants d'intérêts/indemnités (indemnité forfaitaire 40 €, intérêts légaux) sont proposés avec référence textuelle générique (mention des articles applicables aux pros) — jamais présentés comme un calcul certifié.
- CGU rédigées par un avocat avant lancement public (budget à prévoir, non négociable).

## 13. Garde-fous RGPD / données

- Hébergement UE : Supabase (région eu-central), Vercel (fra1), R2 (juridiction UE si activé).
- BLEME = responsable de traitement pour ses clients ; l'utilisateur reste responsable des données de SES débiteurs → mention dans CGU + page "vos obligations".
- Minimisation : on ne stocke que les emails rattachés à un dossier (jamais de sync boîte entière en V1).
- Pas d'entraînement de modèles sur les données clients ; appels LLM avec opt-out d'entraînement (API Anthropic/OpenAI standard).
- Droits : export complet self-service (déjà une feature produit), suppression de compte = purge sous 30 jours, purge des dossiers clôturés paramétrable.
- Registre des traitements, DPA signés (Supabase, Vercel, provider LLM, provider email), politique de confidentialité claire.
- Chiffrement : TLS partout, storage chiffré au repos (défaut Supabase/R2), URLs de documents signées à durée courte.

## 14. UX vocale

- Enregistrement dans le navigateur (MediaRecorder), pas d'app à installer. Mobile-first.
- Consigne d'ouverture : "Racontez votre blème comme vous le raconteriez à un ami. Visez 2 à 5 minutes." Jauge qui se remplit avec des paliers valorisants ("Bien — les dates et montants que vous citez enrichissent le dossier") au lieu d'un chrono anxiogène. Aucune coupure avant 10 min.
- Pause/reprise, ré-enregistrement par segment, fallback texte visible mais non proéminent.
- Après transcription : l'IA reformule ("Voilà ce que j'ai compris : …") et pose 2-4 questions ciblées, terminant toujours par l'**avocat du diable** : "Qu'est-ce que [X] pourrait répondre pour justifier de ne pas payer ?" Les réponses (voix ou texte) alimentent la section "Points de vigilance" du dossier.
- La transcription brute est conservée (audit) mais l'utilisateur voit le résumé structuré, pas le verbatim.

## 15. Gestion des documents

Upload : drag & drop desktop, capture photo mobile, .eml/.msg, PDF, images, 25 Mo/fichier. Pipeline : antivirus léger → OCR si besoin → classification (facture/devis/BL/échange/relance/autre) → extraction typée (montants, dates, parties, n° facture, IBAN, échéance) → chaque valeur extraite garde sa **source** (document + zone) et reste éditable. Détection de doublons par hash. Les documents alimentent le score de complétude et la timeline.

## 16. Gestion des emails

V1 : **adresse dédiée par dossier** (`d-{shortid}@dossiers.bleme.fr`). L'utilisateur transfère les emails historiques ; les courriers envoyés par BLEME ont cette adresse en reply-to, donc les réponses du débiteur arrivent directement dans le dossier. Inbound : Cloudflare Email Routing ou Resend Inbound → webhook → parsing (corps, PJ) → rattachement au dossier → résumé IA → notification. Vérification d'expéditeur (l'adresse de dossier n'accepte que les parties identifiées + l'utilisateur ; le reste part en quarantaine à valider). Gmail/Outlook OAuth = V2.

## 17. Gestion des relances

Séquence par défaut (personnalisable) : J0 relance cordiale → J+7 relance ferme → J+15 mise en demeure (recommandé) → J+30 proposition d'escalade (export pro). Chaque étape : brouillon généré à l'avance, notification "votre relance est prête", **envoi seulement après validation**. Si le débiteur répond, la séquence se met en pause et l'IA propose la suite. Ton ajustable (cordial/neutre/ferme), historique des versions conservé.

## 18. Gestion des recommandés

V1 : génération du PDF MED prêt à imprimer + checklist d'envoi + champ de saisie du n° de suivi (le suivi devient alors automatique via la page La Poste en lien). V1.5 : envoi via API Maileva ou Merci Facteur — statuts (déposé, distribué, avisé, retourné) intégrés à la timeline, AR archivé dans le dossier. Facturé au réel + marge (voir [09-pricing.md](09-pricing.md)).

## 19. Dashboard B2B

Tuiles : Montant en jeu / Récupéré (déclaré par l'utilisateur ou détecté via mention de paiement) / Dossiers à risque (sans action depuis X jours, échéance proche, réponse adverse non traitée) / Actions en attente de validation. Liste des dossiers : statut, montant, ancienneté, prochaine action, dernière activité. Tri par urgence par défaut. C'est l'écran d'accueil.

## 20. Back-office interne

V1 minimal (protégé, rôle admin) : liste des comptes et dossiers (métadonnées, pas le contenu des documents sans raison de support loggée), état des jobs IA (échecs de transcription/extraction), monitoring des emails entrants en quarantaine, gestion des remboursements Stripe, feature flags. Chaque accès support à un dossier client est tracé dans `audit_logs`.

## 21. KPIs

Acquisition : visiteurs → inscription (cible 5 %), inscription → dossier créé (60 %), dossier créé → payé (40 %).
Activation : % de dossiers avec relance n°1 envoyée en première session (60 %), délai création → premier envoi.
Valeur : € suivis, € récupérés, délai moyen de récupération, % dossiers résolus sans MED.
Rétention : conversion vers Pro après ouverture d'un dossier (30 %), churn mensuel (< 5 %), dossiers actifs/compte.
Qualité IA : % d'extractions corrigées par l'utilisateur, % de brouillons envoyés sans modification, temps de review.

## 22. Critères de succès du MVP

À 90 jours après lancement : ≥ 100 dossiers payés ; ≥ 30 % des premiers dossiers convertis en abonnement ; ≥ 20 % des dossiers avec issue positive déclarée ; NPS ≥ 40 ; zéro incident juridique ou fuite de données ; coût IA moyen < 3 €/dossier.

## 23. Risques

Voir tableau complet dans [01-analyse-strategique.md](01-analyse-strategique.md) §4. Top 3 opérationnels : (1) qualité d'extraction décevante sur photos de factures froissées → prévoir édition manuelle fluide dès la V1 ; (2) délivrabilité des emails de relance (SPF/DKIM/DMARC impeccables, domaine dédié `dossiers.bleme.fr`, warm-up) ; (3) l'utilisateur crée le dossier mais n'envoie jamais la relance → tout le design pousse vers l'envoi en première session.

## 24. Questions ouvertes

**Tranchées le 12/07/2026** : pricing = 0 €/mois sans abonnement + 19 € HT par dossier ouvert ; Pro 9 € HT/mois avec 1 dossier inclus par mois, dossiers supplémentaires à 10 € HT, API/stockage/export · provider recommandé = **Merci Facteur** · partenariat comptables = **non** (retiré de la roadmap) · CGU avocat = reporté (à re-planifier avant le lancement public) · litiges clients = inclus au MVP.

Restent ouvertes :
1. Le "récupéré" est-il déclaratif ou faut-il une preuve (mention d'un paiement dans un email) ? V1 : déclaratif + détection assistée.
2. Marque : garder BLEME seul ou "BLEME — dossiers & relances" en descripteur ?
3. Faut-il un mode "je teste avec un faux dossier" pour la démo ? (Recommandation : oui, dossier d'exemple pré-rempli.)
4. Liste définitive des sous-types de litiges V1 et leurs checklists de pièces — à approfondir (voir exemples dans [02-mvp.md](02-mvp.md)).
