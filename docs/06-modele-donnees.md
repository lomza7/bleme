# Étape 6 — Modèle de données Supabase

Conventions : `id uuid pk default gen_random_uuid()`, `created_at/updated_at timestamptz`, toutes les tables métier portent `organization_id` (RLS). Types énumérés en `text + check` (plus simple à faire évoluer que les enums Postgres).

## Identité & organisation

### `profiles`
Prolonge `auth.users` (1-1). Rôle : identité de l'utilisateur.
Champs : `id (= auth.users.id)`, `full_name`, `phone`, `avatar_url`, `onboarding_state`.

### `organizations`
Rôle : l'entreprise cliente (l'unité de facturation et de RLS).
Champs : `id`, `name`, `siret`, `legal_form`, `address_json`, `iban_last4` (affiché dans les courriers de relance pour paiement), `logo_url`, `default_letter_tone`.
Relations : 1-N `organization_members`, `cases`, `subscriptions`.

### `organization_members`
Rôle : lien user↔org avec rôle (mono-user en V1, prêt pour V2).
Champs : `organization_id`, `user_id`, `role ('owner'|'member'|'admin')`. Unique (org, user).

## Dossiers

### `case_types`
Rôle : catalogue des types de blèmes (référentiel, pas de RLS).
Champs : `id`, `slug ('unpaid_invoice'…)`, `label`, `is_active`, `playbook_key` (pointe vers le playbook markdown), `checklist_json` (pièces attendues → score de complétude).

### `cases`
Rôle : le dossier — l'objet central du produit.
Champs : `id`, `organization_id`, `case_type_id`, `title`, `status ('draft'|'active'|'awaiting_user'|'awaiting_debtor'|'escalated'|'resolved'|'closed'|'abandoned')`, `amount_claimed_cents`, `amount_recovered_cents`, `currency`, `invoice_due_date`, `summary_md` (résumé validé issu de l'intake), `weak_points_md` (avocat du diable), `completeness_score int`, `inbound_email` (`d-xxx@dossiers.bleme.fr`, unique), `next_action_at`, `risk_flags text[]`, `closed_reason`.
Relations : 1-N vers presque tout ce qui suit.

### `case_parties`
Rôle : les parties du dossier (le débiteur, éventuellement son comptable…).
Champs : `case_id`, `role ('debtor'|'debtor_contact'|'other')`, `name`, `company_name`, `siret`, `email`, `phone`, `address_json`, `is_email_authorized bool` (autorisé à écrire sur l'adresse du dossier).

### `voice_intakes`
Rôle : sessions vocales et leur exploitation.
Champs : `case_id`, `audio_path`, `duration_seconds`, `transcript_text`, `structured_summary_json` (faits, dates, montants, réponses aux questions), `devil_advocate_answer_text`, `status ('recorded'|'transcribed'|'summarized'|'validated')`.

## Documents

### `documents`
Rôle : toute pièce du dossier (upload, PJ d'email, courrier archivé, AR).
Champs : `case_id`, `organization_id`, `storage_path`, `file_name`, `mime_type`, `size_bytes`, `sha256`, `source ('upload'|'email_attachment'|'generated'|'postal_receipt')`, `doc_class ('invoice'|'quote'|'delivery_note'|'exchange'|'reminder_proof'|'letter'|'other')`, `doc_date`, `piece_number int` (numérotation du bordereau d'export), `email_message_id fk null`, `status ('processing'|'ready'|'failed')`.

### `document_extractions`
Rôle : valeurs extraites par l'IA, sourcées et corrigeables.
Champs : `document_id`, `case_id`, `field_key ('total_amount'|'due_date'|'invoice_number'|'issue_date'|'debtor_name'|'iban'|…)`, `value_text`, `value_normalized jsonb`, `confidence numeric`, `source_excerpt`, `is_user_corrected bool`, `corrected_value jsonb`.
Règle : une correction utilisateur prime toujours sur l'extraction.

## Emails

### `email_accounts` *(V2 — table créée, inutilisée en V1)*
Rôle : connexions Gmail/Outlook OAuth.
Champs : `organization_id`, `provider`, `email_address`, `refresh_token_encrypted`, `scopes`, `status`, `last_sync_at`.

### `email_threads`
Rôle : regroupement des messages par conversation au sein d'un dossier.
Champs : `case_id`, `subject`, `external_thread_key` (References/Message-ID), `last_message_at`, `summary_md` (résumé IA du fil).

### `email_messages`
Rôle : chaque email entrant/sortant du dossier.
Champs : `thread_id`, `case_id`, `direction ('inbound'|'outbound')`, `from_email`, `to_emails text[]`, `subject`, `body_text`, `body_html_path` (Storage si lourd), `sent_at`, `provider_message_id`, `status ('received'|'quarantined'|'sent'|'delivered'|'bounced')`, `ai_summary`, `ai_classification ('promise_to_pay'|'dispute'|'partial_payment'|'request_info'|'refusal'|'unrelated'|null)`, `letter_id fk null` (si c'est l'envoi d'un courrier).

## Chronologie, échéances, tâches

### `case_events`
Rôle : la timeline. Générée par l'IA + événements système + ajouts manuels.
Champs : `case_id`, `event_date`, `event_type ('quote_sent'|'work_done'|'invoice_sent'|'due_date'|'reminder_sent'|'response_received'|'payment'|'custom'|…)`, `title`, `description`, `source ('ai'|'system'|'user')`, `source_ref jsonb` (document/email d'origine), `is_hidden bool`.

### `deadlines`
Rôle : échéances datées à ne pas rater (distinctes des tâches : une deadline est un fait, une task est un travail).
Champs : `case_id`, `kind ('reminder_due'|'med_response_window'|'user_defined')`, `due_at`, `status ('pending'|'done'|'missed'|'cancelled')`, `linked_task_id`.

### `tasks`
Rôle : file d'actions — pour l'utilisateur ("valider la relance") et pour le système ("générer la relance J+7").
Champs : `case_id`, `organization_id`, `assignee ('user'|'system')`, `kind ('validate_letter'|'add_document'|'generate_letter'|'send_letter'|'review_response'|'record_payment'|…)`, `title`, `due_at`, `status ('pending'|'in_progress'|'done'|'cancelled')`, `payload jsonb`, `completed_at`.

## Courriers & envois

### `letters`
Rôle : tout courrier généré (relance 1/2, MED, réponse).
Champs : `case_id`, `kind ('reminder_1'|'reminder_2'|'formal_notice'|'response'|'custom')`, `tone ('cordial'|'neutral'|'firm')`, `status ('draft'|'edited'|'approved'|'sent'|'cancelled')`, `body_md` (éditable), `rendered_pdf_path`, `rendered_sha256`, `template_key`, `template_version`, `channel ('email'|'postal'|'both')`, `approved_by`, `approved_at`, `sent_at`.
Règle : passage à `sent` impossible sans `approval_logs` correspondant.

### `postal_shipments`
Rôle : suivi des recommandés. **Remplacée en implémentation (10/07/2026) par `letter_tracking_events` + colonnes de suivi sur `letters`** — le suivi couvre les deux canaux (postal ET email), pas seulement le recommandé.
Champs (spécification d'origine) : `letter_id`, `case_id`, `provider ('manual'|'maileva'|'merci_facteur')`, `tracking_number`, `status ('preparing'|'handed'|'in_transit'|'delivered'|'notice_left'|'returned'|'unknown')`, `cost_cents`, `ar_document_id fk null`, `status_history jsonb`, `shipped_at`, `delivered_at`.

### `letter_tracking_events` *(implémentée le 10/07/2026)*
Rôle : chaque franchissement d'étape d'un envoi (postal via webhook Merci Facteur, email via webhook Resend) — la matière du « suivi colis » affiché sur le courrier, la carte du dossier et le centre de notifications.
Champs : `organization_id`, `case_id`, `letter_id`, `channel ('email'|'postal')`, `stage` (étape normalisée : `accepted|printed|in_transit|notice_left|delivered|ar_signed|returned|problem|deposit_proof` côté postal ; `email_sent|delayed|email_delivered|opened|clicked|replied|bounced|failed|suppressed|complained` côté email), `status_code` (code brut fournisseur), `label` (libellé FR), `detail`, `occurred_at`, `provider_event_id` (svix-id Resend).
Règles : idempotence par `unique (letter_id, stage, status_code)` (retries webhook sans doublon) ; écriture service-role uniquement (lecture org) ; statut agrégé reporté sur `letters.tracking_status` par machine à états **monotone** (jamais de retour en arrière, les webhooks arrivent dans le désordre). L'AR signé (`are_base64_jpeg`) et la preuve de dépôt (`pdd_base64_pdf`) sont archivés en `documents` (`doc_class 'postal_receipt'`).
Colonnes ajoutées à `letters` : `tracking_status`, `tracking_status_at` (protégées par trigger, service-role only), `email_message_id` (id Resend, corrélation des webhooks sortants), `email_rfc_message_id` (Message-ID RFC, comparé au In-Reply-To des emails entrants pour le jalon « réponse reçue »).

### `notifications` *(implémentée le 10/07/2026)*
Rôle : centre de notifications de l'app (cloche) — suivi des envois, réponses reçues, alertes (pli retourné, email non délivré). Les étapes marquantes déclenchent AUSSI un email aux membres de l'organisation.
Champs : `organization_id`, `case_id null`, `letter_id null`, `kind ('tracking'|'reply'|'alert'|'inbox'|'system')`, `title`, `body`, `href` (lien interne), `read_at`, `email_sent_at`, `created_at`.
Règles : insertion service-role uniquement ; côté utilisateur, lecture org + marquage lu seul (trigger : seule `read_at` est modifiable).

## Intégrations comptables *(implémentées le 10/07/2026 — voir doc 15)*

### `org_integrations`
Rôle : connexion d'une organisation à son logiciel comptable (Pennylane en Phase A).
Champs : `organization_id`, `provider ('pennylane')`, `status ('connected'|'error'|'disconnected')`, `company_name`, `connected_at`, `last_sync_at`, `last_error`, `sync_cursor` (curseur changelog).
Règles : lecture org (RLS) ; écriture via les actions serveur dédiées uniquement (service-role scopé org). Le token vit dans **`org_integration_secrets`** (RLS sans policy = service-role only), **chiffré AES-256-GCM** côté app (clé maîtresse `INTEGRATIONS_ENCRYPTION_KEY` via le coffre).

### `accounting_invoices`
Rôle : factures clients importées du logiciel comptable — la matière du « dossier en 1 clic » et de la détection de paiement.
Champs : `organization_id`, `provider`, `external_id` (unique par org+provider = idempotence du sync), `invoice_number`, `label`, `customer_*` (nom, email, SIREN, adresse — **suggestions sourcées et éditables**, pilier n°3), `amount_cents`/`remaining_cents` (l'API renvoie des euros en string, convertis), `issued_on`, `deadline_on`, `status` (brut fournisseur : `late`, `partially_paid`, `paid`…), `paid`, `case_id` (dossier créé depuis la facture), `synced_at`.
Règles : lecture org ; écriture service-role (sync horaire par cron + bouton manuel). Passage impayée → payée d'une facture liée à un dossier = notification + case_event `payment_detected` — **jamais de clôture automatique**, l'utilisateur confirme via `recordPayment`. `cases.source` étendu : + `'pennylane'`.

## IA & conformité

### `agent_suggestions`
Rôle : toute proposition d'un agent soumise à l'humain (prochaine action, brouillon, classification douteuse).
Champs : `case_id`, `agent_key`, `suggestion_type`, `payload jsonb`, `rationale_md`, `status ('proposed'|'accepted'|'edited'|'rejected'|'expired')`, `decided_by`, `decided_at`.

### `agent_observations`
Rôle : prise de parole d'un agent au passage de relais (changement de phase) — question à l'utilisateur, observation factuelle ou point de vigilance appuyé sur des sources juridiques réelles (voir doc 07).
Champs : `organization_id`, `case_id`, `agent_key`, `trigger_key` (ex. `phase_1_to_2`, unique par dossier), `kind ('question'|'observation'|'vigilance')`, `title`, `detail_md`, `legal_refs jsonb` (`[{reference, portee}]` — texte du socle juridique après appariement, jamais celui du modèle), `status ('open'|'answered'|'acknowledged'|'dismissed')`, `answer_text`, `answered_by`, `answered_at`.
Règles : écriture réservée au service-role (pas de policy INSERT ; colonnes de contenu verrouillées par trigger, seule la réponse est modifiable) ; idempotence sous concurrence via le verrou `case_handoff_claims (case_id, trigger_key)` posé avant le run ; la réponse utilisateur prime et est réinjectée dans la mémoire partagée des agents.

### `agent_runs`
Rôle : trace technique de chaque appel IA (coût, debug, amélioration des prompts).
Champs : `case_id null`, `agent_key`, `prompt_version`, `model`, `input_ref jsonb`, `output_ref jsonb`, `tokens_in`, `tokens_out`, `cost_cents`, `duration_ms`, `status ('ok'|'failed'|'retried')`, `error`.

### `approval_logs`
Rôle : preuve horodatée de chaque validation humaine d'un envoi. **Table append-only** (pas d'update/delete, même pour l'admin).
Champs : `organization_id`, `case_id`, `letter_id`, `user_id`, `action ('approve_send')`, `content_sha256`, `ip`, `user_agent`, `created_at`.

### `audit_logs`
Rôle : journal système et accès support. Append-only.
Champs : `actor_type ('user'|'system'|'admin')`, `actor_id`, `organization_id null`, `case_id null`, `action`, `target jsonb`, `reason` (obligatoire pour un accès admin), `created_at`.

## Facturation

### `subscriptions`
Rôle : état d'abonnement Stripe par organisation.
Champs : `organization_id`, `stripe_customer_id`, `stripe_subscription_id`, `plan ('first_case'|'a_la_carte'|'starter'|'business'|'scale')`, `status ('trialing'|'active'|'past_due'|'canceled')`, `billing_interval ('month'|'year')`, `active_cases_limit int`, `current_period_end`.

### `billing_events`
Rôle : historique facturable (abonnements + frais variables).
Champs : `organization_id`, `case_id null`, `kind ('subscription_payment'|'case_purchase'|'postal_fee'|'refund'|…)`, `amount_cents`, `stripe_ref`, `metadata jsonb`, `occurred_at`.

## Relations clés (résumé)

```
organizations 1─N organization_members N─1 profiles
organizations 1─N cases 1─N {case_parties, voice_intakes, documents, email_threads,
                              case_events, deadlines, tasks, letters, agent_suggestions}
documents 1─N document_extractions
email_threads 1─N email_messages ─?→ letters
letters 1─? postal_shipments ; letters 1─1 approval_logs (pour l'envoi)
organizations 1─1 subscriptions 1─N billing_events
```

## Index indispensables

`cases(organization_id, status)`, `cases(inbound_email) unique`, `tasks(status, due_at)`, `deadlines(status, due_at)`, `email_messages(case_id, sent_at)`, `documents(case_id, doc_class)`, `case_events(case_id, event_date)`, `agent_runs(agent_key, created_at)`.
