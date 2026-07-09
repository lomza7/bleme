-- supabase/migrations/20260709120000_contexte_versionne.sql
-- Contexte de dossier VERSIONNÉ et DATÉ (datation opposable) :
-- 1) case_context_versions : journal APPEND-ONLY horodaté par l'horloge du
--    serveur SQL, cause de mise à jour, empreinte SHA-256 calculée par Postgres.
-- 2) record_case_context_version : point d'écriture UNIQUE (service-role) —
--    dédup + numérotation atomique + cache cases, en une transaction.
-- 3) Durcissements anti-antidatage : cache living_brief_* verrouillé côté
--    utilisateur, created_at de case_events forcé serveur.
-- 4) living_brief_requested_at : marqueur « génération en cours » (temps réel).

-- digest() (pgcrypto) est IMMUTABLE — requis pour une colonne générée.
-- (sha256(convert_to(...)) ne l'est pas : convert_to est stable.)
create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------ 1) Le journal
create table public.case_context_versions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  version integer not null check (version >= 1),
  content_md text not null,
  -- Empreinte calculée PAR POSTGRES : infalsifiable par l'app, revérifiable
  -- depuis content_md (intégrité pour l'export avocat).
  content_sha256 text generated always as (encode(extensions.digest(content_md, 'sha256'), 'hex')) stored,
  cause_type text not null default 'update'
    check (cause_type in (
      'case_created', 'document_added', 'document_removed', 'user_correction',
      'request_updated', 'letter_draft', 'letter_sent', 'debtor_reply',
      'email_merged', 'escalation', 'settlement', 'payment', 'case_closed',
      'update', 'backfill'
    )),
  cause_label text not null,
  -- 'ai' = le run Sacha a abouti (simulation du bridge comprise) ; 'fallback'
  -- = repli déterministe buildFallbackSections.
  generated_by text not null default 'fallback' check (generated_by in ('ai', 'fallback')),
  created_at timestamptz not null default now(),
  unique (case_id, version)
);

create index case_context_versions_case_idx
  on public.case_context_versions (case_id, version desc);
create index case_context_versions_org_idx
  on public.case_context_versions (organization_id);

-- Backfill AVANT la pose du guard : la synthèse existante devient la v1,
-- datée de son horodatage RÉEL déjà stocké (seule insertion avec date fournie ;
-- provient de l'ancienne horloge JS — documenté). Ensuite : now() serveur, toujours.
insert into public.case_context_versions
  (case_id, organization_id, version, content_md, cause_type, cause_label, created_at)
select id, organization_id, 1, living_brief_md, 'backfill',
       'Reprise de la synthèse existante', coalesce(living_brief_updated_at, now())
from public.cases
where living_brief_md is not null;

update public.cases set living_brief_version = 1 where living_brief_md is not null;

-- Guard : INSERT → created_at TOUJOURS forcé à l'horloge serveur (même en
-- service-role) ; UPDATE interdit à tous les rôles ; DELETE interdit SAUF
-- cascade (le dossier/l'org parent a déjà disparu dans la même transaction —
-- sans quoi deleteSampleCases et la purge RGPD casseraient).
create or replace function public.case_context_versions_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    return new;
  end if;
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.cases where id = old.case_id)
       or not exists (select 1 from public.organizations where id = old.organization_id) then
      return old; -- cascade en cours : suppression légitime du dossier / de l'org
    end if;
  end if;
  raise exception 'case_context_versions est append-only (dossier %, version %)',
    old.case_id, old.version;
end;
$$;

create trigger case_context_versions_immutable
  before insert or update or delete on public.case_context_versions
  for each row execute function public.case_context_versions_guard();

-- Les row-triggers ne couvrent pas TRUNCATE.
create or replace function public.case_context_versions_no_truncate()
returns trigger
language plpgsql
as $$
begin
  raise exception 'case_context_versions est append-only : TRUNCATE interdit';
end;
$$;

create trigger case_context_versions_no_truncate
  before truncate on public.case_context_versions
  for each statement execute function public.case_context_versions_no_truncate();

-- RLS : LECTURE SEULE pour les membres de l'organisation (pilier #4).
-- Volontairement : AUCUNE policy insert/update/delete — l'écriture passe
-- exclusivement par la RPC ci-dessous.
alter table public.case_context_versions enable row level security;

create policy "case_context_versions: lire l'historique de ses dossiers"
  on public.case_context_versions for select
  using (organization_id in (select public.user_org_ids()));

-- Ceinture SQL en plus des triggers : aucune voie applicative (anon,
-- authenticated, service_role) ne peut écrire directement — seule la RPC
-- (SECURITY DEFINER, owner) insère. Les RI-cascades s'exécutent en owner.
revoke insert, update, delete, truncate on public.case_context_versions
  from anon, authenticated, service_role;

-- --------------------------------------------- 2) Point d'écriture UNIQUE
-- Dédup par empreinte + numérotation sans course (verrou FOR UPDATE sur la
-- ligne cases) + mise à jour du cache cases + remise à zéro du marqueur
-- temps réel, le tout en UNE transaction.
create or replace function public.record_case_context_version(
  p_case_id uuid,
  p_content_md text,
  p_cause_type text,
  p_cause_label text,
  p_generated_by text default 'fallback'
) returns table (o_version integer, o_created_at timestamptz, o_deduplicated boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_org uuid;
  v_last_version integer;
  v_last_hash text;
  v_new_hash text := encode(extensions.digest(p_content_md, 'sha256'), 'hex');
  v_row public.case_context_versions;
begin
  -- Sérialise les régénérations concurrentes du même dossier (rafales d'upload).
  select organization_id into v_org from public.cases where id = p_case_id for update;
  if v_org is null then
    return; -- dossier supprimé entre-temps : no-op silencieux (tâche de fond)
  end if;

  select v.version, v.content_sha256 into v_last_version, v_last_hash
  from public.case_context_versions v
  where v.case_id = p_case_id
  order by v.version desc
  limit 1;

  -- Dédup : contenu inchangé => rien de neuf à dater, AUCUNE version créée.
  -- On solde quand même le passage (sinon le marqueur « génération en cours »
  -- resterait levé et le badge/polling mentiraient). living_brief_updated_at
  -- = « dernier passage » ; la date OPPOSABLE reste le created_at du journal.
  if v_last_hash is not distinct from v_new_hash and v_last_hash is not null then
    update public.cases set
      living_brief_updated_at = now(),
      living_brief_requested_at = null
    where id = p_case_id;
    return query select v_last_version, null::timestamptz, true;
    return;
  end if;

  insert into public.case_context_versions
    (case_id, organization_id, version, content_md, cause_type, cause_label, generated_by)
  values
    (p_case_id, v_org, coalesce(v_last_version, 0) + 1, p_content_md,
     p_cause_type, p_cause_label, p_generated_by)
  returning * into v_row;

  -- Cache de la dernière version : horodatage EXACT de la ligne d'historique.
  update public.cases set
    living_brief_md = p_content_md,
    living_brief_updated_at = v_row.created_at,
    living_brief_version = v_row.version,
    living_brief_requested_at = null
  where id = p_case_id;

  return query select v_row.version, v_row.created_at, false;
end;
$$;

revoke execute on function public.record_case_context_version(uuid, text, text, text, text)
  from public, anon, authenticated;
-- Ne pas dépendre des default privileges de l'environnement :
grant execute on function public.record_case_context_version(uuid, text, text, text, text)
  to service_role;

-- ------------------------------------ 3) Durcissements anti-antidatage
-- a) La policy UPDATE de cases (20260704220000) est sans restriction de
--    colonnes : un membre d'org pouvait PATCHer living_brief_md/updated_at/
--    version via PostgREST avec une date passée. Verrouillé ici. La RPC
--    (SECURITY DEFINER → owner) et le service-role passent ; recompute
--    (user-scoped) ne touche pas ces colonnes ; living_brief_requested_at
--    reste libre (posé par touchCase sous session utilisateur, sans enjeu
--    d'opposabilité).
create or replace function public.cases_protect_brief_cache()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.living_brief_md is distinct from old.living_brief_md
       or new.living_brief_updated_at is distinct from old.living_brief_updated_at
       or new.living_brief_version is distinct from old.living_brief_version) then
    raise exception 'living_brief_* : écrit uniquement via record_case_context_version';
  end if;
  return new;
end;
$$;

create trigger cases_protect_brief_cache
  before update on public.cases
  for each row execute function public.cases_protect_brief_cache();

-- b) case_events : la date OPPOSABLE est created_at, forcée à l'horloge
--    serveur pour les rôles utilisateur. event_date reste LIBRE : c'est la
--    date DÉCLARÉE du fait (received_at d'un email, dates WhatsApp — usage
--    légitime d'assignItemToCase/confirmEmailMerge/createSampleCases).
--    Distinction fait/enregistrement à refléter dans l'UI (« consigné le »
--    vs « déclaré »). NB : aucune policy update/delete n'existe sur
--    case_events — les événements restent immuables côté utilisateur.
create or replace function public.case_events_force_created_at()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.created_at := now();
  end if;
  return new;
end;
$$;

create trigger case_events_force_created_at
  before insert on public.case_events
  for each row execute function public.case_events_force_created_at();

-- --------------------------------------------- 4) Marqueur temps réel
-- Posé par touchCase AVANT de planifier after(refreshLivingBrief) ; remis à
-- null par la RPC (nouvelle version OU dédup) et par l'early-return draft de
-- refreshLivingBrief. Une génération est « probablement en cours » tant que
-- requested_at > updated_at (fenêtre de 10 min côté serveur).
alter table public.cases
  add column if not exists living_brief_requested_at timestamptz;