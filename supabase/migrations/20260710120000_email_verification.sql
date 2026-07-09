-- Vérification de l'email à la création de compte : un code à 6 chiffres envoyé
-- par email (Resend), saisi sur /verifier-email. Bloque l'accès à l'app tant
-- que l'email n'est pas confirmé — rempart anti-faux-comptes, sans SMS.

-- Statut de vérification, porté par le profil (lisible par l'utilisateur via la
-- policy RLS existante « profiles: lire son profil » → gate côté layout).
alter table public.profiles
  add column if not exists email_verified boolean not null default false;

-- Les comptes DÉJÀ créés sont réputés vérifiés (on ne verrouille personne).
update public.profiles set email_verified = true where created_at < now();

-- Code OTP : jamais stocké en clair (sha256(code + ':' + user_id)), expiration
-- courte, tentatives bornées. Une ligne par utilisateur (upsert au renvoi).
create table public.email_verifications (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code_hash text not null,
  email text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- RLS activée SANS policy : table manipulée uniquement par le service-role
-- (server actions dédiées) — le code haché n'est jamais exposé au client.
alter table public.email_verifications enable row level security;
