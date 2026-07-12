-- Idempotence robuste de la réception email.
--
-- La dédup était ancrée sur le Message-ID RFC (data.message_id), CONTRÔLÉ par le
-- MUA expéditeur : un auto-répondeur / client mal formé peut l'omettre. L'index
-- unique correspondant est partiel (… where message_id is not null), donc deux
-- lignes NULL coexistent et le garde 23505 ne se déclenche pas. Une re-livraison
-- at-least-once du webhook Resend re-crée alors un inbox_item et re-déclenche TOUS
-- les effets aval (notif email, webhook sortant, debtor_reply, brouillon + run LLM).
--
-- On ancre désormais l'idempotence sur data.email_id : l'identifiant Resend de
-- l'email reçu, TOUJOURS présent et NON contrôlé par l'expéditeur. Le Message-ID
-- reste conservé pour le threading (reconnaissance des réponses) mais n'est plus la
-- clé de dédup.
--
-- RLS : aucune policy à ajouter — public.inbox_items est déjà row-level.

alter table public.inbox_items
  add column if not exists email_id text;

create unique index if not exists inbox_items_org_email_idx
  on public.inbox_items (organization_id, email_id)
  where email_id is not null;

comment on column public.inbox_items.email_id is
  'Identifiant Resend de l''email reçu (data.email_id) — clé d''idempotence de la réception (dédup étape 3 + garde 23505). Le message_id RFC reste pour le threading mais n''est plus la clé de dédup.';
