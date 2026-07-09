-- Durcissements de revue de la prise de parole des agents (delta idempotent).
-- La 20260709140000 a été appliquée en production dans sa version initiale,
-- AVANT ces trois durcissements ; ce delta fait converger le schéma (et reste
-- sans effet sur un environnement neuf où la 140000 à jour a déjà tout posé) :
-- 1) plus de policy INSERT utilisateur — la parole d'agent n'a qu'une voie
--    d'écriture, le service-role (runHandoffReflection : hasAdvice + appariement
--    des références au socle) ; sinon un membre d'org pouvait forger une
--    observation affichée sous l'avatar d'un agent avec « sources vérifiées » ;
-- 2) colonnes de contenu verrouillées côté utilisateur (seule la réponse est
--    modifiable) — même esprit que cases_protect_brief_cache ;
-- 3) verrou d'idempotence case_handoff_claims : sans lui, l'upsert du claim
--    échoue et le relais ne parle JAMAIS (bug bloquant de la feature).

drop policy if exists "agent_observations: ajouter" on public.agent_observations;

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

drop trigger if exists agent_observations_guard_update on public.agent_observations;
create trigger agent_observations_guard_update
  before update on public.agent_observations
  for each row execute function public.agent_observations_guard_update();

create table if not exists public.case_handoff_claims (
  case_id uuid not null references public.cases (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  trigger_key text not null,
  created_at timestamptz not null default now(),
  primary key (case_id, trigger_key)
);
alter table public.case_handoff_claims enable row level security;
