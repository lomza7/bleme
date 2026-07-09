-- Destinataires proposés par Basile pour une démarche administrative : la ou
-- les autorités compétentes, avec leur adresse officielle résolue depuis
-- l'annuaire de l'administration (jamais une adresse rédigée par l'agent).
-- Forme : [{nom, motif, address:{nom,societe,adresse,complement,codePostal,ville}|null}].
-- Sert à préremplir l'écran de validation ; la RLS de cases couvre la colonne.
alter table public.cases
  add column if not exists suggested_recipients jsonb;

comment on column public.cases.suggested_recipients is
  'Destinataires proposés par Basile (adresses résolues via l''annuaire officiel). Choix final par l''utilisateur (#3).';
