-- Modèle OpenRouter par agent pour le runtime Hermes : chaque persona peut
-- tourner sur un modèle différent (hermes-4, kimi, deepseek…), choisi
-- depuis /admin et transmis au bleme-bridge à chaque requête.
alter table public.agents
  add column if not exists hermes_model text not null default 'nousresearch/hermes-4-70b'
  check (hermes_model ~ '^[a-z0-9.-]+/[A-Za-z0-9._:-]+$');
