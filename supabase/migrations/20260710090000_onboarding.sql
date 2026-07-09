-- Onboarding post-inscription : identité, rôle, société (fiche Pappers),
-- expéditeur des courriers, canal d'acquisition (stats).
--
-- profiles.onboarding_state existait ('new' par défaut) mais rien ne le
-- consommait : le parcours /bienvenue le fait passer à 'done' et remplit les
-- champs ci-dessous. Les colonnes sont NULLABLES : un compte pré-onboarding
-- reste valide, et l'utilisateur peut passer une question.

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  -- Rôle déclaré dans la société (dirigeant, artisan, comptable…) — stats + ton.
  add column if not exists role_title text,
  -- Canal d'acquisition (« comment nous avez-vous connu ? ») — stats console.
  add column if not exists acquisition_source text,
  add column if not exists acquisition_detail text,
  add column if not exists onboarded_at timestamptz;

alter table public.organizations
  -- SIREN (9 chiffres) : la recherche Pappers travaille au SIREN ; le SIRET
  -- (14, colonne existante) reste celui du siège si connu.
  add column if not exists siren text check (siren is null or siren ~ '^\d{9}$'),
  -- Fiche entreprise complète (CompanySnapshot Pappers) récupérée à
  -- l'onboarding : forme juridique, siège, dirigeants, procédure collective…
  add column if not exists company_json jsonb,
  -- Au nom de qui partent les courriers : la société, l'utilisateur en son nom,
  -- ou pour le compte d'un tiers (comptable / gestionnaire mandaté).
  add column if not exists sender_mode text not null default 'company'
    check (sender_mode in ('company', 'personal', 'third_party')),
  add column if not exists sender_name text;

comment on column public.profiles.acquisition_source is
  'Canal déclaré à l''onboarding (bouche_a_oreille, google, reseaux, comptable, presse, pub, autre).';
comment on column public.organizations.sender_mode is
  'Expéditeur des courriers : company (raison sociale), personal (nom de l''utilisateur), third_party (pour le compte d''un tiers — sender_name).';
