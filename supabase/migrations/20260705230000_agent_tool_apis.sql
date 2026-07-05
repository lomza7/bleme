-- Matrice d'activation des APIs outils : une ligne (api, agent) par API
-- propre à un agent ; agent_key NULL = API commune aux 6. Le catalogue des
-- APIs (nom, actions, secrets requis) vit dans lib/tool-apis.ts ; lib/ai
-- lit la matrice à chaque appel et transmet au bridge les APIs activées
-- avec leurs credentials, le bridge exécute les appels HTTP dans une
-- boucle agentique (le tool use natif n'est pas routé par OpenRouter).
create table public.agent_tool_apis (
  id uuid primary key default gen_random_uuid(),
  api_name text not null check (api_name ~ '^[a-z0-9_-]+$'),
  agent_key text references public.agents (key) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index agent_tool_apis_commune_idx
  on public.agent_tool_apis (api_name) where agent_key is null;
create unique index agent_tool_apis_propre_idx
  on public.agent_tool_apis (api_name, agent_key) where agent_key is not null;

alter table public.agent_tool_apis enable row level security;

create policy "agent_tool_apis: lecture admin" on public.agent_tool_apis
  for select using (public.is_admin());
create policy "agent_tool_apis: écriture admin" on public.agent_tool_apis
  for insert with check (public.is_admin());
create policy "agent_tool_apis: suppression admin" on public.agent_tool_apis
  for delete using (public.is_admin());
