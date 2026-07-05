-- Matrice d'activation des skills Hermes : une ligne (skill, agent) par
-- skill propre à un agent ; agent_key NULL = skill commune aux 6.
-- lib/ai lit la matrice à chaque appel et transmet la liste au bridge,
-- qui injecte les SKILL.md correspondants dans le prompt système.
create table public.agent_skills (
  id uuid primary key default gen_random_uuid(),
  skill_name text not null check (skill_name ~ '^[a-z0-9_-]+/[a-z0-9_-]+$'),
  agent_key text references public.agents (key) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index agent_skills_commune_idx
  on public.agent_skills (skill_name) where agent_key is null;
create unique index agent_skills_propre_idx
  on public.agent_skills (skill_name, agent_key) where agent_key is not null;

alter table public.agent_skills enable row level security;

create policy "agent_skills: lecture admin" on public.agent_skills
  for select using (public.is_admin());
create policy "agent_skills: écriture admin" on public.agent_skills
  for insert with check (public.is_admin());
create policy "agent_skills: suppression admin" on public.agent_skills
  for delete using (public.is_admin());
