-- Dossiers (V0 dashboard) : cases + case_events, RLS par organisation.

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_type text not null
    check (case_type in ('unpaid_invoice', 'client_dispute', 'admin_request')),
  title text not null,
  status text not null default 'active'
    check (status in ('draft', 'active', 'awaiting_user', 'awaiting_debtor', 'escalated', 'resolved', 'closed')),
  debtor_name text not null,
  amount_claimed_cents bigint not null default 0 check (amount_claimed_cents >= 0),
  amount_recovered_cents bigint not null default 0 check (amount_recovered_cents >= 0),
  currency text not null default 'EUR',
  summary_md text,
  weak_points_md text,
  stage int not null default 1 check (stage between 1 and 4),
  stage_total int not null default 4,
  next_action_label text,
  next_action_at timestamptz,
  expected_recovery_at timestamptz,
  is_sample boolean not null default false,
  source text not null default 'app' check (source in ('app', 'wizard_draft', 'sample')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cases_org_status_idx on public.cases (organization_id, status);
create index cases_next_action_idx on public.cases (organization_id, next_action_at);

create trigger cases_updated_at
  before update on public.cases
  for each row execute function public.set_updated_at();

create table public.case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_date timestamptz not null default now(),
  event_type text not null,
  title text not null,
  description text,
  source text not null default 'system' check (source in ('ai', 'system', 'user')),
  created_at timestamptz not null default now()
);

create index case_events_case_idx on public.case_events (case_id, event_date desc);

alter table public.cases enable row level security;
alter table public.case_events enable row level security;

create policy "cases: lire ses dossiers"
  on public.cases for select
  using (organization_id in (select public.user_org_ids()));

create policy "cases: créer un dossier"
  on public.cases for insert
  with check (organization_id in (select public.user_org_ids()));

create policy "cases: modifier ses dossiers"
  on public.cases for update
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));

create policy "cases: supprimer ses dossiers"
  on public.cases for delete
  using (organization_id in (select public.user_org_ids()));

create policy "case_events: lire les événements de ses dossiers"
  on public.case_events for select
  using (organization_id in (select public.user_org_ids()));

create policy "case_events: créer un événement"
  on public.case_events for insert
  with check (organization_id in (select public.user_org_ids()));
