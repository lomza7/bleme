# Étape 12 — Roadmap

## Phase 1 — MVP (30 jours)

**Objectif** : un inconnu crée un dossier impayé, ouvre le dossier à 19 € HT (ou via le dossier inclus Pro) et envoie sa première relance par email. Tout le reste est secondaire.

**Fonctionnalités** : auth + org · création dossier 2 types (impayé + litige client, wizard 3 étapes) · intake vocal + transcription + résumé + avocat du diable · upload docs + extraction + classification · score de complétude · timeline · brouillons relance 1/2 + MED (PDF) + courriers litige à la carte · validation + approval_logs · envoi email + adresse par dossier (inbound) · notifications email · dashboard simple · export PDF/ZIP · Stripe dossier à l'unité + Pro 9 € · landing page.

**Hors périmètre assumé** : recommandé API, Gmail OAuth, abonnements multi-plans (un seul plan Pro suffit à encaisser les early adopters), admin panel complet, mobile app.

**Risques** : qualité d'extraction sur photos (mitigation : édition manuelle fluide dès le jour 1) · délivrabilité email (domaine dédié configuré semaine 1, warm-up) · périmètre qui gonfle (ce document fait foi : tout ajout = un retrait).

**Livrables** : app en prod sur Vercel · 10 dossiers de test réels (ses propres blèmes + entourage) · CGU v1 relues par un avocat · landing live.

**KPIs** : 10 utilisateurs pilotes, 5 dossiers réels créés, 3 relances réellement envoyées, temps création dossier < 20 min, coût IA/dossier mesuré.

## Phase 2 — Bêta (90 jours)

**Objectif** : prouver la conversion et la rétention sur 100+ vrais clients. C'est la phase de vérité commerciale.

**Fonctionnalités** : recommandé via API Merci Facteur + suivi AR · grille tarifaire complète (0 €/mois + 19 €/dossier, Pro 9 €/mois avec 1 dossier inclus et dossiers supplémentaires à 10 €) · analyse des réponses adverses (Agent Email complet) + suggestions de suite · relances amiables auto opt-in · amélioration continue des prompts sur les dossiers réels (boucle `agent_runs` → corrections utilisateurs) · admin back-office · onboarding dossier d'exemple · SEO programmatique ("facture impayée + [métier/situation]") · démarrage du process Google CASA pour Gmail (V3).

**Risques** : conversion vers Pro trop faible (dans ce cas : renforcer API/stockage/export et le moment d'upsell, pas basculer en commission) · litiges V1 trop hétérogènes pour les prompts (mitigation : sous-types + checklists affinés sur les dossiers réels) · coûts de support (mitigation : FAQ in-app, statuts clairs).

**Livrables** : 100 clients payants · 1 partenariat fédération/groupement local · 10 témoignages chiffrés ("j'ai récupéré X €") · tableau de bord des KPIs interne.

**KPIs** : 100 dossiers payés · conversion ≥ 30 % · churn < 5 %/mois · ≥ 20 % de dossiers avec issue positive déclarée · NPS ≥ 40 · CAC mesuré par canal.

## Phase 3 — Version commerciale (6 mois)

**Objectif** : passer de "l'outil impayés" au début du cockpit : 2e type de dossier, intégrations, canal partenaires. MRR cible 8-15 k€.

**Fonctionnalités** : Gmail/Outlook OAuth (import assisté des fils) · type de dossier n°3 : **amendes pro / demandes gracieuses** · approfondissement litiges (sous-types + séquences semi-automatiques sur les patterns récurrents) · multi-utilisateurs + rôles · intégrations logiciels devis BTP et compta (import factures → création dossier en 1 clic — gros levier d'acquisition ET de rétention) · LRE (AR24) · préparation marketplace pros (recueil de la demande : combien cliquent "je veux être mis en relation") · app-like PWA mobile.

**Risques** : dispersion produit (la V2 "litiges" doit rester un playbook, pas un nouveau produit) · dépendance à un canal d'acquisition unique · montée du support et de la conformité (RGPD à l'échelle, DPO externalisé).

**Livrables** : 3 types de dossiers en prod · 2 intégrations logicielles · dossier de conformité (registre, DPA, CGU v2, process CASA avancé).

**KPIs** : 300-500 clients actifs · MRR 8-15 k€ · > 1 M€ d'impayés suivis · part des inscriptions via intégrations > 20 % · marge brute > 75 %.
