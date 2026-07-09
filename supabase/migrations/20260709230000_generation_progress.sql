-- Progression TEMPS RÉEL d'une génération de courrier : le serveur écrit
-- chaque étape RÉELLE (lecture du dossier, récupération du droit, rédaction,
-- vérification des adresses…), le client la lit en polling pendant l'attente.
-- L'utilisateur voit ce que l'agent fait vraiment — pas une animation
-- inventée. Une ligne par dossier (upsert), écrasée à chaque génération.
create table public.generation_progress (
  case_id uuid primary key references public.cases (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  step text not null,
  detail text,
  updated_at timestamptz not null default now()
);

alter table public.generation_progress enable row level security;

create policy "generation_progress: lecture org" on public.generation_progress
  for select using (organization_id in (select public.user_org_ids()));
create policy "generation_progress: insertion org" on public.generation_progress
  for insert with check (organization_id in (select public.user_org_ids()));
create policy "generation_progress: maj org" on public.generation_progress
  for update using (organization_id in (select public.user_org_ids()));
