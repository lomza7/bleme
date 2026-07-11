-- API publique BLEME — Phase 1 : clés API par organisation (lecture).
--
-- Modèle miroir de l'intégration compta (org_integrations + secrets) :
--   1) api_keys           : métadonnées lisibles par l'org via la capacité
--                           'api.manage' (jamais le secret). Écriture service-role
--                           uniquement (actions serveur après requireCap).
--   2) api_key_secrets    : le HASH de la clé (sha256 peppered, non réversible),
--                           RLS activée SANS policy = service-role uniquement.
--   3) api_key_usage      : compteur de fenêtre pour le rate-limit durable.
--   4) cases.source       : + 'api' (provenance d'un dossier créé par l'API).
--   5) auto-révocation    : une clé ne survit pas à la perte d'accès de son
--                           créateur (départ de l'org, ou scope non couvert
--                           après réduction de ses droits).
--
-- Sécurité : une requête API passe par le service-role (RLS contournée) ; la
-- capacité 'api.manage' ne garde donc que la LECTURE des métadonnées côté app.
-- Les scopes d'une clé sont appliqués en code applicatif (has_capability est
-- indexée sur auth.uid(), inerte pour le service-role).

-- ── 1. Clés (métadonnées) ────────────────────────────────────────────────────

create table public.api_keys (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null,
  -- Préfixe affichable ('blm_live_a1b2c3d4') : lookup + affichage masqué.
  key_prefix       text not null,
  -- Sous-ensemble des capacités (Capability). 'letters.send' interdit (pilier #1).
  scopes           text[] not null default '{}',
  created_by       uuid references auth.users (id) on delete set null,
  last_used_at     timestamptz,
  expires_at       timestamptz,
  revoked_at       timestamptz,
  revoked_reason   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index api_keys_org_idx on public.api_keys (organization_id) where revoked_at is null;
create index api_keys_prefix_idx on public.api_keys (key_prefix) where revoked_at is null;

create trigger api_keys_updated_at
  before update on public.api_keys
  for each row execute function public.set_updated_at();

alter table public.api_keys enable row level security;

-- Lecture des métadonnées par les membres qui gèrent l'API. Aucune policy
-- d'écriture : création/révocation via les actions serveur (service-role).
create policy "api_keys: lecture api.manage" on public.api_keys
  for select using (public.has_capability(organization_id, 'api.manage'));

-- ── 2. Secret (hash) — service-role uniquement ───────────────────────────────

create table public.api_key_secrets (
  api_key_id  uuid primary key references public.api_keys (id) on delete cascade,
  -- sha256(pepper || ':' || secret) — non réversible (le secret n'est jamais stocké).
  key_hash    text not null,
  created_at  timestamptz not null default now()
);

create index api_key_secrets_hash_idx on public.api_key_secrets (key_hash);

alter table public.api_key_secrets enable row level security;
-- Volontairement AUCUNE policy : lisible/écrivable par le service-role seul.

-- ── 3. Compteur de rate-limit (fenêtre) ──────────────────────────────────────

create table public.api_key_usage (
  api_key_id    uuid not null references public.api_keys (id) on delete cascade,
  -- Début de fenêtre (tronqué à la minute côté app).
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (api_key_id, window_start)
);

alter table public.api_key_usage enable row level security;
-- Aucune policy : service-role uniquement.

-- Incrément ATOMIQUE d'une fenêtre (évite la course lecture-puis-écriture).
-- Purge au passage les fenêtres périmées de la clé (table bornée à ~1 ligne
-- par clé active). Retourne le nouveau compteur.
create or replace function public.api_key_bump(p_key uuid, p_window timestamptz)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.api_key_usage where api_key_id = p_key and window_start < p_window;
  insert into public.api_key_usage (api_key_id, window_start, count)
  values (p_key, p_window, 1)
  on conflict (api_key_id, window_start)
  do update set count = public.api_key_usage.count + 1
  returning count into v_count;
  return v_count;
end;
$$;

-- SECURITY DEFINER : par défaut Postgres accorde EXECUTE à PUBLIC et Supabase
-- expose les fonctions du schéma public via PostgREST (rpc). Or ce compteur ne
-- doit être bougé que par le service-role (lib/api/rate-limit.ts). On retire
-- donc l'accès aux rôles exposés — sinon un utilisateur pourrait épuiser le
-- rate-limit d'une clé arbitraire.
revoke execute on function public.api_key_bump(uuid, timestamptz) from public, anon, authenticated;

-- ── 4. Provenance des dossiers ───────────────────────────────────────────────

alter table public.cases drop constraint if exists cases_source_check;
alter table public.cases
  add constraint cases_source_check
  check (source in ('app', 'wizard_draft', 'sample', 'pennylane', 'sellsy', 'axonaut', 'api'));

-- ── 5. Auto-révocation des clés à la perte d'accès du créateur ───────────────
-- DELETE (membre retiré de l'org) : révoque toutes ses clés dans cette org.
-- UPDATE (rôle/permissions) : révoque ses clés dont un scope n'est plus couvert
-- par ses droits (une réduction de droits ne doit pas laisser une clé plus
-- puissante que son créateur). Une simple extension de droits ne révoque rien.

create or replace function public.api_keys_revoke_on_member_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.api_keys
      set revoked_at = now(), revoked_reason = 'creator_removed'
      where organization_id = old.organization_id
        and created_by = old.user_id
        and revoked_at is null;
    return old;
  end if;

  -- UPDATE : owner/admin gardent tout → aucune clé à révoquer.
  if new.role in ('owner', 'admin') then
    return new;
  end if;

  update public.api_keys k
    set revoked_at = now(), revoked_reason = 'creator_access_reduced'
    where k.organization_id = new.organization_id
      and k.created_by = new.user_id
      and k.revoked_at is null
      and exists (
        select 1 from unnest(k.scopes) s
        where coalesce((new.permissions ->> s)::boolean, false) = false
      );
  return new;
end;
$$;

create trigger api_keys_revoke_on_member_delete
  after delete on public.organization_members
  for each row execute function public.api_keys_revoke_on_member_change();

create trigger api_keys_revoke_on_member_update
  after update of role, permissions on public.organization_members
  for each row execute function public.api_keys_revoke_on_member_change();
