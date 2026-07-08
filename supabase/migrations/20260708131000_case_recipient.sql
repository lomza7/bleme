-- Coordonnées du destinataire (débiteur) pour l'expédition réelle des courriers.
--
-- debtor_email    : SAISIE UTILISATEUR uniquement (aucune API FR ne fournit
--                   d'email d'entreprise) — jamais inventé, jamais issu de
--                   Pappers (pilier #3).
-- debtor_address  : adresse postale saisie/corrigée par l'utilisateur ; PRIME
--                   sur cases.debtor_company.siege (source Pappers dégradée).
--                   Forme : {nom, adresse, complement?, codePostal, ville, pays}.
--
-- RLS : aucune policy à ajouter — public.cases est déjà row-level
-- (organization_id in user_org_ids()) et couvre d'office ces colonnes.

alter table public.cases
  add column if not exists debtor_email text
    check (
      debtor_email is null
      or debtor_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ),
  add column if not exists debtor_address jsonb;

comment on column public.cases.debtor_email is
  'Email destinataire — saisie utilisateur uniquement, jamais Pappers ni inventé (pilier #3).';
comment on column public.cases.debtor_address is
  'Adresse postale saisie/corrigée par l''utilisateur ; prime sur debtor_company.siege.';

-- Email réellement utilisé pour CHAQUE courrier envoyé (audit du réel par envoi).
alter table public.letters
  add column if not exists to_email text;

comment on column public.letters.to_email is
  'Adresse email vers laquelle ce courrier a été (ou sera) expédié. Audit d''envoi.';
