# BLEME — Base documentaire produit

> **BLEME** — On vous doit de l'argent. BLEME s'occupe du dossier.
> Plateforme B2B (artisans, freelances, TPE) qui transforme un problème pro — d'abord les **factures impayées** — en dossier suivi : intake vocal, preuves classées, timeline, relances et mise en demeure en brouillon, validation humaine, suivi des réponses, export pro.

## Décisions structurantes (résumé)

1. **MVP = impayés B2B + litiges clients**, cible artisans BTP 1-10 pers., factures 1 000-25 000 €. L'impayé est le parcours cœur (séquence de relance automatisée, message d'acquisition) ; le litige est un dossier documenté + courriers à la carte, sans séquence automatique en V1.
2. **Jamais** : conseil juridique personnalisé, pronostic de victoire, envoi sans validation, encaissement des fonds, courriers au nom de BLEME.
3. **Toujours** : courriers signés par l'utilisateur après validation explicite (`approval_logs`), extractions sourcées et corrigeables, export libre même après résiliation.
4. **V1 sans Gmail OAuth** (audit CASA → V2/V3) : adresse email dédiée par dossier + transfert.
5. Stack : Next.js + Vercel + Supabase (RLS partout) + Claude API + Deepgram (voix) + Resend (email in/out) + Stripe. Recommandé : PDF prêt à poster en V1, API **Merci Facteur** en V1.5 (décision du 04/07/2026).
6. Pricing : premier dossier 39 €, à la carte 79 €, abonnements 49/99/199 €/mois, –20 % annuel, frais variables au réel.

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
| 8 | [08-workflows.md](08-workflows.md) | 13 workflows clés pas à pas |
| 9 | [09-pricing.md](09-pricing.md) | Grille tarifaire, conversion, captivité saine, unit economics |
| 10 | [10-landing-page.md](10-landing-page.md) | Copy complète de la landing V1 |
| 11 | [11-slogans.md](11-slogans.md) | 30 slogans + top 5 justifié |
| 12 | [12-roadmap.md](12-roadmap.md) | 3 phases : MVP 30 j, bêta 90 j, commercial 6 mois |
| 13 | [13-plan-claude-code.md](13-plan-claude-code.md) | 14 tâches techniques exécutables par Claude Code |

## Comment utiliser cette base avec Claude Code

1. Commencer par [13-plan-claude-code.md](13-plan-claude-code.md), tâche T1, en donnant en contexte les docs 05, 06 et 07.
2. Une tâche à la fois, dans l'ordre ; chaque tâche est livrable et testable.
3. Toute évolution de périmètre se décide ici (mettre à jour le doc concerné) avant de coder.
