-- Suivi temps réel des envois (type « suivi colis ») + centre de notifications.
--
-- 1) letter_tracking_events : chaque franchissement d'étape d'un envoi
--    (postal via webhook Merci Facteur, email via webhook Resend) devient une
--    ligne structurée : étape normalisée (stage), code brut fournisseur,
--    libellé FR, date. Idempotent : unique (letter_id, stage, status_code) —
--    un retry de webhook ne duplique ni l'événement ni la notification.
-- 2) letters : statut d'acheminement agrégé (machine à états monotone, écrit
--    UNIQUEMENT par les webhooks service-role — trigger de garde, même esprit
--    que cases_protect_billing) + identifiants Resend pour corréler les
--    événements sortants et reconnaître les réponses (In-Reply-To).
-- 3) notifications : centre de notifications de l'app (cloche). Écriture
--    service-role uniquement ; l'utilisateur ne peut que marquer lu (read_at).

-- ── 1. Événements de suivi ────────────────────────────────────────────────────

create table public.letter_tracking_events (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  case_id          uuid not null references public.cases (id) on delete cascade,
  letter_id        uuid not null references public.letters (id) on delete cascade,
  channel          text not null check (channel in ('email', 'postal')),
  -- Étape normalisée (lib/courrier/tracking.ts) : accepted, printed,
  -- in_transit, notice_left, delivered, ar_signed, returned, problem,
  -- deposit_proof / email_sent, email_delivered, opened, clicked, replied,
  -- delayed, bounced, failed…
  stage            text not null,
  -- Code brut du fournisseur (statut_courrier Merci Facteur / type Resend) :
  -- '' quand le fournisseur n'en donne pas — non null pour l'unicité.
  status_code      text not null default '',
  label            text not null,
  detail           text,
  occurred_at      timestamptz not null default now(),
  -- svix-id Resend (dédup retries) ; null côté Merci Facteur.
  provider_event_id text,
  created_at       timestamptz not null default now(),
  unique (letter_id, stage, status_code)
);

create index letter_tracking_events_letter_idx
  on public.letter_tracking_events (letter_id, occurred_at desc);
create index letter_tracking_events_case_idx
  on public.letter_tracking_events (case_id, occurred_at desc);

alter table public.letter_tracking_events enable row level security;

-- Lecture org uniquement : l'écriture n'a qu'une voie, les webhooks
-- (service-role) — un membre ne peut pas forger un « distribué ».
create policy "letter_tracking_events: lecture org" on public.letter_tracking_events
  for select using (organization_id in (select public.user_org_ids()));

-- ── 2. Statut agrégé + corrélation Resend sur letters ────────────────────────

alter table public.letters
  add column if not exists tracking_status text,
  add column if not exists tracking_status_at timestamptz,
  -- Id Resend de l'email envoyé (retour de POST /emails = data.email_id des
  -- webhooks) : la clé de corrélation du suivi email.
  add column if not exists email_message_id text,
  -- Message-ID RFC de l'email envoyé (webhook email.sent) : comparé au header
  -- In-Reply-To des emails entrants pour reconnaître « le débiteur a répondu ».
  add column if not exists email_rfc_message_id text;

-- Unique : le webhook résout le courrier par cet id (maybeSingle) — un
-- doublon couperait silencieusement le suivi.
create unique index if not exists letters_email_message_idx
  on public.letters (email_message_id) where email_message_id is not null;
create index if not exists letters_email_rfc_message_idx
  on public.letters (email_rfc_message_id) where email_rfc_message_id is not null;
-- Clé de résolution de chaque événement Merci Facteur.
create index if not exists letters_postal_envoi_idx
  on public.letters (postal_envoi_id) where postal_envoi_id is not null;

-- Le statut d'acheminement est une donnée de fait : seuls les webhooks
-- (service-role) l'écrivent. Même pattern que cases_protect_billing.
-- email_rfc_message_id aussi : il pilote le jalon « réponse reçue » (source
-- system), un membre ne doit pas pouvoir le forger.
create or replace function public.letters_protect_tracking()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.tracking_status is distinct from old.tracking_status
       or new.tracking_status_at is distinct from old.tracking_status_at
       or new.email_rfc_message_id is distinct from old.email_rfc_message_id) then
    raise exception 'letters : le statut de suivi est posé par le système uniquement';
  end if;
  return new;
end;
$$;

drop trigger if exists letters_protect_tracking on public.letters;
create trigger letters_protect_tracking
  before update on public.letters
  for each row execute function public.letters_protect_tracking();

-- Même garde à l'INSERT (sinon un membre pourrait créer un courrier déjà
-- « AR signé » sans envoi ni approval_log).
create or replace function public.letters_protect_tracking_insert()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.tracking_status is not null
       or new.tracking_status_at is not null
       or new.email_rfc_message_id is not null) then
    raise exception 'letters : le statut de suivi est posé par le système uniquement';
  end if;
  return new;
end;
$$;

drop trigger if exists letters_protect_tracking_insert on public.letters;
create trigger letters_protect_tracking_insert
  before insert on public.letters
  for each row execute function public.letters_protect_tracking_insert();

-- ── 3. Centre de notifications ───────────────────────────────────────────────

create table public.notifications (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  case_id          uuid references public.cases (id) on delete cascade,
  letter_id        uuid references public.letters (id) on delete cascade,
  -- Famille : 'tracking' (suivi d'envoi), 'reply' (réponse reçue),
  -- 'alert' (PND, bounce…), 'system'.
  kind             text not null default 'tracking',
  title            text not null,
  body             text,
  -- Lien interne de destination (ex. /app/dossiers/{id}).
  href             text,
  read_at          timestamptz,
  -- Posé quand l'email de notification correspondant est parti.
  email_sent_at    timestamptz,
  created_at       timestamptz not null default now()
);

create index notifications_org_idx
  on public.notifications (organization_id, created_at desc);
create index notifications_org_unread_idx
  on public.notifications (organization_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications: lecture org" on public.notifications
  for select using (organization_id in (select public.user_org_ids()));
-- Marquer lu : update org, mais SEUL read_at est modifiable (trigger ci-dessous).
create policy "notifications: maj org" on public.notifications
  for update using (organization_id in (select public.user_org_ids()));

create or replace function public.notifications_guard_update()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.id is distinct from old.id
       or new.organization_id is distinct from old.organization_id
       or new.case_id is distinct from old.case_id
       or new.letter_id is distinct from old.letter_id
       or new.kind is distinct from old.kind
       or new.title is distinct from old.title
       or new.body is distinct from old.body
       or new.href is distinct from old.href
       or new.email_sent_at is distinct from old.email_sent_at
       or new.created_at is distinct from old.created_at) then
    raise exception 'notifications : seul le marquage lu (read_at) est modifiable';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_guard_update on public.notifications;
create trigger notifications_guard_update
  before update on public.notifications
  for each row execute function public.notifications_guard_update();
