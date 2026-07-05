-- Runtime par agent : 'claude' (API Anthropic) ou 'hermes' (bleme-bridge sur
-- le VPS, modèles Hermes de Nous via OpenRouter). Basculable depuis /admin :
-- le moteur lib/ai route chaque appel selon cette colonne.
alter table public.agents
  add column if not exists runtime text not null default 'claude'
  check (runtime in ('claude', 'hermes'));
