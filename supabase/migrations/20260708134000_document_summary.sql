-- Résumé factuel de ce qu'une pièce ÉTABLIT (au-delà des champs montant/date/n°).
-- Produit par Nora à la lecture (vision) et injecté dans le contexte consolidé
-- (synthèse vivante) → les agents rédacteurs s'appuient sur le CONTENU réel des
-- pièces, pas seulement sur le récit (souvent maigre) du client.
--
-- RLS : aucune policy à ajouter — public.documents est déjà row-level.

alter table public.documents
  add column if not exists summary text;

comment on column public.documents.summary is
  'Résumé factuel de ce que la pièce établit (lecture Nora). Alimente la synthèse vivante et les courriers. Jamais d''interprétation juridique.';
