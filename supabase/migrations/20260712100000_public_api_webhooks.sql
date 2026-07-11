-- API publique BLEME — Phase 3 : webhooks sortants signés.
--
--   1) webhook_endpoints        : URL + événements souscrits (métadonnées
--                                 lisibles via 'api.manage' ; écriture service-role).
--   2) webhook_endpoint_secrets : secret de signature CHIFFRÉ (AES-256-GCM,
--                                 lib/integrations/crypto), RLS SANS policy =
--                                 service-role only (même patron que les tokens compta).
--   3) webhook_deliveries        : outbox (observabilité + retries) ; lecture via
--                                 'api.manage'.
--
-- Livraison : 1ʳᵉ tentative immédiate (after()) hors chemin critique + cron de
-- reprise (backoff). Payloads par RÉFÉRENCE (ids), PII minimale : le consommateur
-- rappelle GET /api/v1/... avec sa clé pour le détail.

-- ── 1. Endpoints ─────────────────────────────────────────────────────────────

create table public.webhook_endpoints (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  url              text not null,
  description      text,
  enabled_events   text[] not null default '{}',
  status           text not null default 'active' check (status in ('active', 'disabled')),
  created_by       uuid references auth.users (id) on delete set null,
  last_delivery_at timestamptz,
  failure_count    integer not null default 0, -- échecs consécutifs (auto-désactivation)
  disabled_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index webhook_endpoints_org_idx on public.webhook_endpoints (organization_id);

create trigger webhook_endpoints_updated_at
  before update on public.webhook_endpoints
  for each row execute function public.set_updated_at();

alter table public.webhook_endpoints enable row level security;

create policy "webhook_endpoints: lecture api.manage" on public.webhook_endpoints
  for select using (public.has_capability(organization_id, 'api.manage'));

-- ── 2. Secret de signature (chiffré) — service-role uniquement ───────────────

create table public.webhook_endpoint_secrets (
  endpoint_id      uuid primary key references public.webhook_endpoints (id) on delete cascade,
  secret_encrypted text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger webhook_endpoint_secrets_updated_at
  before update on public.webhook_endpoint_secrets
  for each row execute function public.set_updated_at();

alter table public.webhook_endpoint_secrets enable row level security;
-- Volontairement AUCUNE policy.

-- ── 3. Outbox / livraisons ───────────────────────────────────────────────────

create table public.webhook_deliveries (
  id             uuid primary key default gen_random_uuid(), -- aussi la clé d'idempotence envoyée (X-Bleme-Id)
  endpoint_id    uuid not null references public.webhook_endpoints (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_type     text not null,
  payload        jsonb not null,
  status         text not null default 'pending'
                   check (status in ('pending', 'delivering', 'succeeded', 'failed', 'dead')),
  attempts       integer not null default 0,
  response_code  integer,
  error          text,
  next_retry_at  timestamptz,
  claimed_at     timestamptz, -- pour récupérer les livraisons bloquées en 'delivering'
  created_at     timestamptz not null default now(),
  delivered_at   timestamptz
);

create index webhook_deliveries_due_idx
  on public.webhook_deliveries (status, next_retry_at)
  where status in ('pending', 'failed');
create index webhook_deliveries_org_idx
  on public.webhook_deliveries (organization_id, created_at desc);
-- Récupération des livraisons bloquées en 'delivering' (reaper du cron) + purge.
create index webhook_deliveries_stuck_idx
  on public.webhook_deliveries (claimed_at)
  where status = 'delivering';
create index webhook_deliveries_purge_idx
  on public.webhook_deliveries (created_at)
  where status in ('succeeded', 'dead');

alter table public.webhook_deliveries enable row level security;

create policy "webhook_deliveries: lecture api.manage" on public.webhook_deliveries
  for select using (public.has_capability(organization_id, 'api.manage'));

-- Enregistre UN échec sur un endpoint de façon ATOMIQUE (pas de course lecture-
-- puis-écriture) et auto-désactive au seuil, en une seule transition — renvoie
-- le nouveau compteur et si CET appel a fait la désactivation (pour n'émettre
-- qu'une seule notification). Service-role uniquement.
create or replace function public.webhook_endpoint_register_failure(p_endpoint uuid, p_threshold integer)
returns table (failure_count integer, just_disabled boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_disabled boolean := false;
begin
  update public.webhook_endpoints
    set failure_count = webhook_endpoints.failure_count + 1
    where id = p_endpoint
    returning webhook_endpoints.failure_count into v_count;
  if v_count is null then
    return; -- endpoint disparu
  end if;
  if v_count >= p_threshold then
    update public.webhook_endpoints
      set status = 'disabled', disabled_at = now()
      where id = p_endpoint and status = 'active';
    if found then
      v_disabled := true;
    end if;
  end if;
  return query select v_count, v_disabled;
end;
$$;

revoke execute on function public.webhook_endpoint_register_failure(uuid, integer)
  from public, anon, authenticated;
-- Grant explicite au service_role (ne pas dépendre des default privileges).
grant execute on function public.webhook_endpoint_register_failure(uuid, integer) to service_role;
