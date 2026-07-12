# Étape 13 — Plan d'exécution Claude Code

Découpage en 14 tâches ordonnées, chacune livrable et testable indépendamment. À donner à Claude Code une tâche à la fois, dans l'ordre (chaque tâche suppose les précédentes).

**Conventions projet** (à poser dans `CLAUDE.md` à la racine dès la tâche 1) : Next.js App Router + TypeScript strict · Tailwind v4 + shadcn/ui · Supabase (`@supabase/ssr`) · Zod sur toute entrée externe · textes UI en français · mobile-first · jamais d'envoi sortant sans `approval_logs`.

---

## T1 — Setup projet

**Objectif** : squelette prod-ready déployé sur Vercel.
**Fichiers** : `package.json`, `next.config.ts`, `tailwind.config`, `.env.example`, `CLAUDE.md`, `lib/supabase/{client,server,middleware}.ts`, `lib/env.ts` (validation Zod des env vars), `app/layout.tsx`, `app/(marketing)/page.tsx` (placeholder landing).
**Validations** : build vert, lint + typecheck en CI (GitHub Actions), déploiement Vercel préview/prod.
**Edge cases** : env manquante → erreur explicite au boot, pas à l'usage.

## T2 — Auth + organisations

**Objectif** : inscription/connexion email+password et magic link ; création auto du profil et de l'organisation.
**Tables** : `profiles`, `organizations`, `organization_members` (+ trigger `on_auth_user_created`).
**Fichiers** : `app/(auth)/{login,signup,callback}/…`, `middleware.ts` (protection `/app/*`), `app/(app)/settings/page.tsx` (profil + entreprise : SIRET, adresse — champs réutilisés dans les courriers).
**Composants** : `AuthForm`, `OrgSettingsForm`.
**Validations** : RLS activée sur les 3 tables + policies testées (un user ne lit que son org) ; Zod sur SIRET (14 chiffres).
**Edge cases** : magic link expiré ; email déjà pris ; session expirée en cours de wizard (draft conservé côté serveur).

## T3 — Database complète + RLS

**Objectif** : tout le schéma de [06-modele-donnees.md](06-modele-donnees.md) en migrations SQL versionnées.
**Fichiers** : `supabase/migrations/*.sql`, `lib/db/types.ts` (types générés `supabase gen types`), seed `case_types` ('unpaid_invoice' et 'client_dispute' actifs, 'fine'/'admin_request' en 'coming_soon').
**Validations** : policies RLS sur chaque table métier (pattern `organization_id in (select …)`) ; `approval_logs`/`audit_logs` en append-only (revoke UPDATE/DELETE) ; contraintes checks sur les status.
**Edge cases** : test explicite qu'un user B ne voit pas les données de l'org A (script de test RLS).

## T4 — Création de dossier (wizard)

**Objectif** : wizard 3 étapes → dossier `draft` avec parties et adresse email dédiée. Deux types actifs : impayé (qui, combien, depuis quand) et litige client (avec qui, à propos de quoi, où ça en est — montant optionnel).
**Fichiers** : `app/(app)/cases/new/…` (étape 0 : choix du type ; puis infos → vocal → documents, champs conditionnés par le type), `app/api/cases/route.ts`, `lib/services/sirene.ts` (autocomplete entreprise via API Recherche d'Entreprises, gratuite).
**Composants** : `CaseWizard`, `DebtorSearchCombobox`, `AmountInput` (centimes en base).
**Tables** : `cases`, `case_parties`.
**Validations** : montant > 0 ; débiteur nommé ; génération `inbound_email` unique (shortid, collision retry).
**Edge cases** : abandon en cours (draft repris à la connexion suivante) ; débiteur introuvable dans SIRENE (saisie libre) ; particulier comme débiteur (pas de SIRET — autorisé, B2C côté débiteur).

## T5 — Upload documents + storage

**Objectif** : drag & drop + photo mobile → Storage privé → ligne `documents`.
**Fichiers** : `app/api/documents/upload/route.ts` (URL signée d'upload), `components/DocumentDropzone.tsx`, `components/DocumentList.tsx`, policies Storage (préfixe `org_id/case_id/`).
**Tables** : `documents`.
**Validations** : MIME réel (magic bytes, pas l'extension), 25 Mo max, hash SHA-256, détection doublon (même hash même dossier → refus doux).
**Edge cases** : upload interrompu (statut `processing` nettoyé par cron) ; HEIC iPhone (conversion) ; PDF protégé par mot de passe (accepté, marqué "non lisible").

## T6 — Transcription vocale

**Objectif** : enregistrer 2-5 min dans le navigateur, transcrire, afficher le transcript.
**Fichiers** : `components/VoiceRecorder.tsx` (MediaRecorder, pause/reprise, jauge 2-5 min, fallback texte), `app/api/voice/transcribe/route.ts` (job), `lib/services/transcription.ts` (Deepgram, interface swappable Whisper).
**Tables** : `voice_intakes`.
**Validations** : formats webm/opus + mp4 (Safari) ; durée max 15 min ; statut visible ("Transcription en cours…", Realtime ou polling).
**Edge cases** : micro refusé (fallback texte immédiat, sans culpabilisation) ; coupure réseau en upload (chunks + reprise) ; transcript vide/inaudible (proposer de recommencer ou d'écrire) ; accents/bruit de chantier (Deepgram fr robuste, mais prévoir bouton "corriger le résumé" — c'est le résumé qui compte, pas le verbatim).

## T7 — Agents IA : intake + résumé + avocat du diable

**Objectif** : la couche agents (pattern commun) + Agent Intake complet.
**Fichiers** : `lib/agents/runner.ts` (appel Claude + Zod parse + retry + trace `agent_runs`), `lib/agents/prompts/intake/v1.md`, `lib/agents/intake.ts`, `app/api/cases/[id]/intake/route.ts`, `components/IntakeSummaryReview.tsx` (correction du résumé), `components/DevilAdvocateQA.tsx`.
**Tables** : `agent_runs`, mise à jour `cases.summary_md`, `cases.weak_points_md`, `voice_intakes.structured_summary_json`.
**Validations** : sortie JSON strictement validée (retry 2× sinon erreur visible) ; system prompt avec les garde-fous transverses ([07-agents-ia.md](07-agents-ia.md)) ; version de prompt tracée.
**Edge cases** : récit hors-sujet ("c'est un litige de voisinage") → l'agent le détecte et l'UI oriente ; récit < 30 s → questions de relance plus nombreuses ; données contradictoires form vs vocal → le vocal questionne, l'utilisateur tranche.

## T8 — Extraction + classification + score + timeline

**Objectif** : Agent Preuves et Agent Timeline branchés sur l'upload.
**Fichiers** : `lib/agents/{evidence,timeline}.ts` + prompts, `app/api/documents/[id]/process/route.ts` (job post-upload), `components/{ExtractionReview,CompletenessScore,CaseTimeline}.tsx`.
**Tables** : `document_extractions`, `case_events`, `cases.completeness_score`.
**Validations** : chaque extraction porte `source_excerpt` ; correction utilisateur → `is_user_corrected` et priorité absolue ; événements timeline sourcés ; images → API vision de Claude directement (pas d'OCR séparé en V1).
**Edge cases** : document illisible (score de confiance bas → "à vérifier", pas de blocage) ; deux factures dans un PDF ; dates au format ambigu (jj/mm vs mm/jj → contexte fr par défaut, marqué si doute) ; incohérence chronologique → alerte bloquante pour la MED uniquement.

## T9 — Courriers : génération, review, validation

**Objectif** : brouillons relance 1/2 + MED, écran de review, approbation loggée, rendu PDF.
**Fichiers** : `lib/agents/letter.ts` + `lib/letters/templates/{reminder1,reminder2,formal_notice,dispute_response,dispute_contest,amicable_proposal,dispute_formal_notice}/v1.md` (templates versionnés à variables ; les 4 derniers = courriers litige à la carte), `lib/pdf/letter.tsx` (@react-pdf), `app/(app)/cases/[id]/letters/[letterId]/review/page.tsx`, `app/api/letters/[id]/{generate,approve}/route.ts`.
**Tables** : `letters`, `approval_logs`.
**Composants** : `LetterEditor` (markdown simple, variables surlignées avec source), `ApprovalButton` ("J'ai relu, envoyer en mon nom").
**Validations** : envoi impossible sans approval dont le `content_sha256` = hash du contenu courant (toute édition post-approbation invalide l'approbation) ; MED bloquée si complétude < seuil ou incohérence timeline ouverte ; bandeau disclaimer sur le PDF MED.
**Edge cases** : adresse postale du débiteur manquante → MED générée mais marquée "adresse à compléter" ; édition concurrente (updated_at check) ; utilisateur qui veut un ton plus dur → régénération avec tone, jamais d'insultes/menaces (garde-fou prompt + filtre).

## T10 — Email par dossier (in/out) + suivi des réponses

**Objectif** : envoi des relances par email, réception sur l'adresse du dossier, analyse des réponses.
**Fichiers** : `lib/services/email.ts` (Resend), `app/api/webhooks/email-inbound/route.ts` (signature vérifiée), `lib/agents/email.ts` + prompt, `app/(app)/cases/[id]/inbox/page.tsx`, `components/EmailThreadView.tsx`, config DNS `dossiers.bleme.fr` (SPF/DKIM/DMARC) documentée dans `docs/ops/email-setup.md`.
**Tables** : `email_threads`, `email_messages`, `agent_suggestions`.
**Validations** : outbound uniquement pour une letter `approved` ; reply-to = adresse du dossier ; inbound : expéditeur non autorisé → quarantaine + task ; PJ entrantes → pipeline T5/T8.
**Edge cases** : bounce (notifier "l'adresse email du débiteur semble invalide") ; boucle auto-répondeur (détection + pas de traitement IA) ; email énorme (body en Storage) ; réponse à un vieux fil après dossier résolu (rouvrir en `awaiting_user`) ; spam sur l'adresse du dossier (quarantaine silencieuse).

## T11 — Cadences, tâches, notifications (Agent Suivi)

**Objectif** : le métronome — plan d'action J0/J+7/J+15, rappels, dossiers à risque.
**Fichiers** : `app/api/cron/scheduler/route.ts` (Vercel Cron 15 min, idempotent), `lib/services/sequence.ts` (machine à états de la séquence : pause sur réponse, reprise validée), `lib/emails/` (templates de notification React Email).
**Tables** : `tasks`, `deadlines`, `cases.next_action_at`, `cases.risk_flags`.
**Validations** : le cron ne crée jamais de doublon de task (clé d'idempotence kind+case+due_date) ; il prépare, ne déclenche jamais d'envoi.
**Edge cases** : relance prête non validée 3 j → rappel ; 10 j → risque ; week-ends/jours fériés (envoi conseillé un jour ouvré) ; dossier payé entre-temps → annulation propre de la séquence.

## T12 — Dashboard + export

**Objectif** : l'écran d'accueil cash + l'export pro.
**Fichiers** : `app/(app)/dashboard/page.tsx` (RSC, requêtes agrégées), `components/{CashTiles,CaseListTable,PendingActions}.tsx`, `lib/export/{synthesis.tsx,bordereau.tsx,zip.ts}`, `app/api/cases/[id]/export/route.ts`, `components/RecordPaymentDialog.tsx` (paiement total/partiel → `amount_recovered_cents` + événement timeline).
**Validations** : agrégats en SQL (pas de N+1) ; export : pièces numérotées stables, ZIP streamé, URL signée 1 h ; export accessible même abonnement inactif.
**Edge cases** : dossier sans document (export = synthèse seule) ; gros dossier (50+ pièces → génération en job avec notification "prêt") ; montant récupéré > montant réclamé (autorisé : intérêts).

## T13 — Billing Stripe

**Objectif** : dossier à l'unité 19 € HT, Pro 9 € HT/mois avec 1 dossier inclus par mois et dossiers supplémentaires à 10 € HT.
**Fichiers** : `lib/services/stripe.ts`, `app/api/webhooks/stripe/route.ts`, `app/(app)/settings/billing/page.tsx`, `components/PaywallDialog` (à l'activation du dossier), Stripe Customer Portal pour la gestion.
**Tables** : `organizations` (état Stripe), `cases` (billing_status), `billing_payments`.
**Validations** : webhook signé, idempotent (event id unique) ; état Pro dérivé de Stripe ; crédit mensuel Pro = 1 dossier inclus par organisation et par mois ; jamais de blocage de l'export.
**Edge cases** : paiement échoué après création du dossier (dossier reste activable) ; past_due (grâce 7 j) ; double ouverture simultanée du crédit mensuel Pro (prévoir contrainte/table dédiée si volume) ; TVA (Stripe Tax, prix HT affichés).

## T14 — Admin panel + tests + hardening

**Objectif** : back-office minimal, suite de tests, passe sécurité.
**Fichiers** : `app/(admin)/admin/…` (rôle admin : comptes enrichis avec activité/revenus/dossiers/tokens/coût IA/marge/API/compta/suppression définitive, dossiers-métadonnées, jobs en échec, quarantaine, remboursements — chaque accès support à un dossier loggé avec raison), tests : Vitest (unit : agents parsing, sequence machine, hash/approval), Playwright (e2e : parcours complet création → relance envoyée en mode mock IA), script de test RLS.
**Tables** : `audit_logs` (complétée partout).
**Validations** : rate limiting (Upstash) sur auth/upload/IA ; headers sécurité (CSP) ; Sentry ; audit des policies RLS ; revue "aucun chemin d'envoi sans approval" (test dédié).
**Edge cases** : admin qui tente de modifier `approval_logs` (impossible en base) ; montée en charge d'un compte (100 dossiers) ; suppression de compte → confirmation forte, refus d'auto-suppression, garde Stripe, purge Storage + orgs mono-utilisateur ; V2 hardening : export préalable proposé + journal `audit_logs` append-only.

---

## Ordre et jalons

- **Semaine 1** : T1-T4 (on peut créer un dossier).
- **Semaine 2** : T5-T8 (le dossier se remplit et s'analyse tout seul).
- **Semaine 3** : T9-T11 (les courriers partent et reviennent — le cœur de la valeur).
- **Semaine 4** : T12-T14 (pilotage, paiement, solidité) + landing ([10-landing-page.md](10-landing-page.md)) + CGU avocat.

Chaque tâche donnée à Claude Code doit référencer ce fichier + [06-modele-donnees.md](06-modele-donnees.md) + [07-agents-ia.md](07-agents-ia.md) comme sources de vérité.
