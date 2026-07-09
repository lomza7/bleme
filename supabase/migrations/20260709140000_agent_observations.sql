-- Prise de parole des agents aux passages de relais (doc 07, décision du 09/07/2026).
-- Quand le dossier change de phase (donc d'agent référent : Marius → Sacha → Jeanne),
-- l'agent qui le reçoit peut poser une question, faire une observation factuelle ou
-- signaler une vigilance appuyée sur des sources juridiques RÉELLES (socle Légifrance/
-- JUDILIBRE — une référence absente des sources est supprimée côté serveur).
-- Cycle de vie : open → answered / acknowledged / dismissed. La réponse utilisateur
-- prime (pilier #3) et est réinjectée dans la mémoire partagée (buildCaseContext).
-- Table métier → organization_id + RLS.

create table if not exists public.agent_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  agent_key text not null, -- clé de l'agent qui parle (marius|sacha|jeanne|…), pas de FK : config rechargeable
  trigger_key text not null, -- ex. 'phase_1_to_2' — un passage de relais ne parle qu'une fois
  kind text not null check (kind in ('question', 'observation', 'vigilance')),
  title text not null,
  detail_md text,
  legal_refs jsonb not null default '[]'::jsonb, -- [{reference, portee}] — uniquement des sources vérifiées
  status text not null default 'open'
    check (status in ('open', 'answered', 'acknowledged', 'dismissed')),
  answer_text text, -- la réponse de l'utilisateur (prime sur tout, pilier #3)
  answered_by uuid references auth.users (id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists agent_observations_case_idx
  on public.agent_observations (case_id, status, created_at desc);
create index if not exists agent_observations_trigger_idx
  on public.agent_observations (case_id, trigger_key);

alter table public.agent_observations enable row level security;
-- PAS de policy INSERT : la parole d'agent n'a qu'une voie d'écriture, le
-- service-role (runHandoffReflection), qui applique hasAdvice + l'appariement
-- des références au socle. Un membre d'org ne peut donc pas forger une
-- observation affichée sous l'avatar d'un agent avec « sources vérifiées ».
create policy "agent_observations: lire" on public.agent_observations for select
  using (organization_id in (select public.user_org_ids()));
create policy "agent_observations: répondre" on public.agent_observations for update
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));

-- Côté utilisateur, seule la RÉPONSE est modifiable (status, answer_*) : le
-- contenu émis par l'agent (déjà filtré serveur) est verrouillé — même esprit
-- que cases_protect_brief_cache.
create or replace function public.agent_observations_guard_update()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.organization_id is distinct from old.organization_id
       or new.case_id is distinct from old.case_id
       or new.agent_key is distinct from old.agent_key
       or new.trigger_key is distinct from old.trigger_key
       or new.kind is distinct from old.kind
       or new.title is distinct from old.title
       or new.detail_md is distinct from old.detail_md
       or new.legal_refs is distinct from old.legal_refs
       or new.created_at is distinct from old.created_at) then
    raise exception 'agent_observations : seule la réponse (status, answer_*) est modifiable';
  end if;
  return new;
end;
$$;

create trigger agent_observations_guard_update
  before update on public.agent_observations
  for each row execute function public.agent_observations_guard_update();

-- Verrou d'idempotence du relais : un (case_id, trigger_key) ne parle qu'une
-- fois, même sous recomputes concurrents — claim atomique (upsert ignoreDuplicates)
-- posé AVANT le run LLM par runHandoffReflection. Table technique service-role :
-- RLS activée sans policy (aucun accès utilisateur).
create table if not exists public.case_handoff_claims (
  case_id uuid not null references public.cases (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  trigger_key text not null,
  created_at timestamptz not null default now(),
  primary key (case_id, trigger_key)
);
alter table public.case_handoff_claims enable row level security;
