-- Provenance du brouillon, portée par le courrier lui-même : « Rédigé par
-- Basile (sources : Légifrance ×2) » ou l'explication du repli gabarit.
-- Nécessaire car la bannière de génération disparaît dès que l'écran de
-- relecture prend sa place — l'information doit vivre SUR le courrier.
alter table public.letters
  add column if not exists redaction_note text;
