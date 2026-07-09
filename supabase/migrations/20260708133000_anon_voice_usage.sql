-- Compteur de rate-limit pour la transcription vocale PRÉ-SIGNUP (tunnel /nouveau).
--
-- On ne stocke qu'un HASH d'IP (peppé côté app avec un secret server-only),
-- jamais l'IP en clair (RGPD). Accès service-role UNIQUEMENT : RLS activée SANS
-- policy (même patron que app_secrets). Exception assumée au non-négociable #4
-- (pas d'organization_id : par nature pré-signup, aucune org n'existe encore).

create table public.anon_voice_usage (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index anon_voice_usage_ip_time_idx
  on public.anon_voice_usage (ip_hash, created_at desc);

alter table public.anon_voice_usage enable row level security;
-- Volontairement AUCUNE policy : seul createServiceClient (service-role) lit/écrit.

comment on table public.anon_voice_usage is
  'Rate-limit de la transcription vocale anonyme (tunnel pré-signup). ip_hash = sha256(pepper server-only + IP). Purge possible au-delà de 24 h.';
