-- Trace des APIs outils appelées pendant un run agent.
--
-- Le bridge exécute la boucle agentique (Légifrance, JUDILIBRE, Pappers…) et
-- renvoie déjà la liste des appels effectués (champ tool_calls de sa réponse,
-- ex. ["legifrance.rechercher_loi", "judilibre.rechercher"]) — mais elle était
-- jetée côté app. On la persiste sur le run pour l'observabilité admin :
-- vérifier QUELS outils sont réellement appelés, quand, par quel agent, et
-- repérer les APIs jamais utilisées.
alter table public.agent_runs
  add column if not exists tool_calls jsonb not null default '[]'::jsonb;

comment on column public.agent_runs.tool_calls is
  'Appels d''APIs outils effectués pendant le run (["api.action", …]), renvoyés par le bridge.';

-- Index partiel : la console ne s''intéresse qu''aux runs ayant appelé au moins
-- un outil (la grande majorité n''en appelle aucun).
create index if not exists agent_runs_tool_calls_idx
  on public.agent_runs (created_at desc)
  where jsonb_array_length(tool_calls) > 0;
