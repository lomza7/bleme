-- Coffre des clés d'API de la plateforme, géré depuis la console /admin.
-- Résolution côté code (lib/secrets.ts) : valeur en base d'abord, variable
-- d'environnement en repli — une clé posée dans la console prend effet à
-- l'appel suivant, sans redéploiement.
--
-- Sécurité : RLS activée SANS policy → la table n'est lisible et modifiable
-- que par le service role (jamais par un client user-scoped, admin compris ;
-- les écrans admin passent par le service client après double garde).

create table public.app_secrets (
  name text primary key check (name ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  value text not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.app_secrets enable row level security;
-- Aucune policy : accès service-role uniquement.
