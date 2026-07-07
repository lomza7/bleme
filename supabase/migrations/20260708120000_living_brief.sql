-- Cahier de dossier vivant : une synthèse narrative régénérée à chaque évènement
-- fort, distincte du récit brut d'intake (summary_md). Sert de mémoire partagée
-- (contexte consolidé) et de base au rapport de synthèse pour l'avocat.
alter table public.cases
  add column if not exists living_brief_md text,
  add column if not exists living_brief_updated_at timestamptz,
  add column if not exists living_brief_version integer not null default 0;
