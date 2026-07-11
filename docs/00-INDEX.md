# BLEME — Base documentaire produit

> **BLEME** — On vous doit de l'argent. BLEME s'occupe du dossier.
> Plateforme B2B (artisans, freelances, TPE) qui transforme un problème pro — d'abord les **factures impayées** — en dossier suivi : intake vocal, preuves classées, timeline, relances et mise en demeure en brouillon, validation humaine, suivi des réponses, export pro.

## Décisions structurantes (résumé)

1. **MVP = impayés B2B + litiges clients**, cible artisans BTP 1-10 pers., factures 1 000-25 000 €. L'impayé est le parcours cœur (séquence de relance automatisée, message d'acquisition) ; le litige est un dossier documenté + courriers à la carte, sans séquence automatique en V1.
2. **Jamais** : conseil juridique personnalisé, pronostic de victoire, envoi sans validation, encaissement des fonds, courriers au nom de BLEME.
3. **Toujours** : courriers signés par l'utilisateur après validation explicite (`approval_logs`), extractions sourcées et corrigeables, export libre même après résiliation.
4. **V1 sans Gmail OAuth** (audit CASA → V2/V3) : adresse email dédiée par dossier + transfert.
5. Stack : Next.js + Vercel + Supabase (RLS partout) + Claude API + Deepgram (voix) + Resend (email in/out) + Stripe. Recommandé : PDF prêt à poster en V1, API **Merci Facteur** en V1.5 (décision du 04/07/2026).
6. Pricing *(révisé le 05/07/2026)* : **Pro Starter à 9 €/mois (1 dossier actif) en produit d'appel**, Business 49 €, Scale 99 €, –20 % annuel, frais variables au réel. Le one-shot « premier dossier 39 € » est abandonné : l'entrée se fait par l'abonnement, la rétention par la valeur accumulée (historique, cadences, adresse par dossier).
7. Intégration comptable *(décision du 10/07/2026, étendue le 11/07/2026)* : connexion au logiciel de facturation, **multi-fournisseurs**. Pennylane (token API), **Axonaut** (clé API, header userApiKey), **Sellsy** (OAuth2 client_credentials : client_id + secret, sans redirection) — tous en lecture seule, token/identifiants chiffrés (AES-256-GCM). Périmètre : factures impayées importées → **dossier en 1 clic** (PDF joint, valeurs sourcées et éditables) + **détection de paiement** (changelog Pennylane ; polling Axonaut/Sellsy) → suggestion de clôture (jamais automatique). Archi : interface pivot `ComptaAdapter` + registre par fournisseur (`lib/integrations/adapters/`), sync et actions agnostiques. Rattachement pricing : plan Pro (aimant à activation). Voir doc 15 (recherche API + marché) et doc 06 (`org_integrations`, `accounting_invoices`). Phase B (OAuth « Se connecter avec » partenaire) : demandes de partenariat à envoyer.
8. Suivi temps réel des envois *(décision du 10/07/2026)* : chaque étape d'un envoi (imprimé, remis à La Poste, distribué, avisé, AR signé côté recommandé ; délivré, ouvert, réponse reçue côté email) est normalisée en événement structuré (`letter_tracking_events`), affichée en stepper type « suivi colis » sur le courrier et la carte du dossier, et poussée dans un **centre de notifications** in-app (cloche) + email à l'utilisateur pour les jalons marquants. L'AR signé et la preuve de dépôt sont archivés en pièces du dossier. L'ouverture d'email est présentée comme **indicative** (fiabilité limitée). Voir doc 06 (tables `letter_tracking_events`, `notifications`).

## Documents

| Étape | Fichier | Contenu |
|---|---|---|
| 1 | [01-analyse-strategique.md](01-analyse-strategique.md) | Marché, forces/faiblesses/risques, pourquoi le B2B, segment beachhead |
| 2 | [02-mvp.md](02-mvp.md) | Choix du MVP, fonctionnalités V1/repoussées/dangereuses, parcours du premier dossier, écrans |
| 3 | [03-prd.md](03-prd.md) | PRD complet en 24 sections |
| 4 | [04-user-stories.md](04-user-stories.md) | 30 user stories avec critères d'acceptation |
| 5 | [05-architecture.md](05-architecture.md) | Architecture technique, mises au point stack, email entrant, sécurité, audit |
| 6 | [06-modele-donnees.md](06-modele-donnees.md) | Schéma Supabase : 22 tables, relations, index, RLS |
| 7 | [07-agents-ia.md](07-agents-ia.md) | 10 agents IA : rôles, I/O, limites, points de validation humaine |
| 8 | [08-workflows.md](08-workflows.md) | 14 workflows clés pas à pas |
| 9 | [09-pricing.md](09-pricing.md) | Grille tarifaire, conversion, captivité saine, unit economics |
| 10 | [10-landing-page.md](10-landing-page.md) | Copy complète de la landing V1 |
| 11 | [11-slogans.md](11-slogans.md) | 30 slogans + top 5 justifié |
| 12 | [12-roadmap.md](12-roadmap.md) | 3 phases : MVP 30 j, bêta 90 j, commercial 6 mois |
| 13 | [13-plan-claude-code.md](13-plan-claude-code.md) | 14 tâches techniques exécutables par Claude Code |
| 14 | [14-recherche-whatsapp.md](14-recherche-whatsapp.md) | Recherche : ingestion des échanges WhatsApp |
| 15 | [15-recherche-integration-compta.md](15-recherche-integration-compta.md) | Recherche : intégration comptable (Pennylane) — API v2, marché, architecture, décisions à acter |
| 16 | [16-inbox-boite-mail.md](16-inbox-boite-mail.md) | Plan d'exécution : Boîte de réception façon client mail (3 volets, lecture, raccourcis) — sans migration |

## Comment utiliser cette base avec Claude Code

1. Commencer par [13-plan-claude-code.md](13-plan-claude-code.md), tâche T1, en donnant en contexte les docs 05, 06 et 07.
2. Une tâche à la fois, dans l'ordre ; chaque tâche est livrable et testable.
3. Toute évolution de périmètre se décide ici (mettre à jour le doc concerné) avant de coder.
