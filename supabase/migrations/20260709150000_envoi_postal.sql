-- Expédition postale réelle (LRAR via Merci Facteur) : l'adresse du
-- destinataire est gravée sur le courrier validé (elle fait partie de ce que
-- l'utilisateur approuve) et l'envoi est traçable (id d'envoi, n° de suivi,
-- événements poussés par webhook dans case_events).
alter table public.letters
  add column if not exists to_address jsonb,
  add column if not exists postal_envoi_id text,
  add column if not exists postal_tracking text;
