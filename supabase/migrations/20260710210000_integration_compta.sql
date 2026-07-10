-- Intégration comptable (Pennylane, Phase A — décision du 10/07/2026, doc 15).
--
-- 1) org_integrations : une connexion par organisation et par fournisseur —
--    métadonnées lisibles par l'org (statut, dernier sync, curseur changelog).
--    Le TOKEN vit dans org_integration_secrets (RLS sans policy = service-role
--    uniquement), chiffré AES-256-GCM côté app (clé maîtresse via getSecret).
-- 2) accounting_invoices : les factures clients importées du logiciel
--    comptable — la matière du « dossier en 1 clic » et de la détection de
--    paiement. Écriture service-role uniquement (sync) ; lecture org.
-- 3) cases.source : + 'pennylane' (provenance du dossier).

-- ── 1. Connexions ────────────────────────────────────────────────────────────

create table public.org_integrations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  provider         text not null check (provider in ('pennylane')),
  status           text not null default 'connected'
                     check (status in ('connected', 'error', 'disconnected')),
  -- Nom de l'entreprise côté fournisseur (GET /me) — affiché dans les réglages.
  company_name     text,
  connected_at     timestamptz not null default now(),
  last_sync_at     timestamptz,
  last_error       text,
  -- Curseur de détection des changements (dernier processed_at changelog traité).
  sync_cursor      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, provider)
);

create trigger org_integrations_updated_at
  before update on public.org_integrations
  for each row execute function public.set_updated_at();

alter table public.org_integrations enable row level security;

-- Lecture org uniquement : la connexion/déconnexion passe par les actions
-- serveur dédiées (service-role après vérification d'appartenance) — un
-- membre ne peut ni forger une connexion ni lire le token.
create policy "org_integrations: lecture org" on public.org_integrations
  for select using (organization_id in (select public.user_org_ids()));

-- Token chiffré : service-role only (RLS activée SANS policy, comme app_secrets).
create table public.org_integration_secrets (
  integration_id  uuid primary key references public.org_integrations (id) on delete cascade,
  token_encrypted text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger org_integration_secrets_updated_at
  before update on public.org_integration_secrets
  for each row execute function public.set_updated_at();

alter table public.org_integration_secrets enable row level security;

-- ── 2. Factures importées ────────────────────────────────────────────────────

create table public.accounting_invoices (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  provider              text not null default 'pennylane',
  -- Id de la facture chez le fournisseur (clé d'idempotence du sync).
  external_id           text not null,
  invoice_number        text,
  label                 text,
  -- Client (provenance Pennylane — suggestions éditables, jamais gravées :
  -- la correction utilisateur prime, pilier produit n°3).
  customer_external_id  text,
  customer_name         text,
  customer_email        text,
  customer_siren        text,
  customer_address      jsonb,
  -- Montants en CENTIMES (l'API renvoie des strings en euros — convertis au sync).
  amount_cents          bigint,
  remaining_cents       bigint,
  currency              text not null default 'EUR',
  issued_on             date,
  deadline_on           date,
  -- Statut brut fournisseur : late, upcoming, partially_paid, paid…
  status                text,
  paid                  boolean not null default false,
  -- Dossier BLEME créé depuis cette facture (un clic).
  case_id               uuid references public.cases (id) on delete set null,
  synced_at             timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  unique (organization_id, provider, external_id)
);

create index accounting_invoices_org_unpaid_idx
  on public.accounting_invoices (organization_id, paid, deadline_on);
create index accounting_invoices_case_idx
  on public.accounting_invoices (case_id) where case_id is not null;

alter table public.accounting_invoices enable row level security;

-- Lecture org uniquement : seules les actions serveur (sync service-role,
-- création de dossier) écrivent.
create policy "accounting_invoices: lecture org" on public.accounting_invoices
  for select using (organization_id in (select public.user_org_ids()));

-- ── 3. Provenance des dossiers ───────────────────────────────────────────────

alter table public.cases drop constraint if exists cases_source_check;
alter table public.cases
  add constraint cases_source_check
  check (source in ('app', 'wizard_draft', 'sample', 'pennylane'));
