-- Stripe billing : abonnement Pro + paiement d'ouverture des dossiers.

alter table public.organizations
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists stripe_price_id text,
  add column if not exists billing_plan text not null default 'free'
    check (billing_plan in ('free', 'pro')),
  add column if not exists billing_status text not null default 'free'
    check (billing_status in (
      'free', 'incomplete', 'incomplete_expired', 'trialing', 'active',
      'past_due', 'canceled', 'unpaid', 'paused'
    )),
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists subscription_cancel_at_period_end boolean not null default false,
  add column if not exists subscription_updated_at timestamptz;

alter table public.cases
  add column if not exists billing_status text not null default 'unpaid'
    check (billing_status in ('unpaid', 'pending', 'paid', 'included', 'refunded')),
  add column if not exists billing_amount_cents bigint check (billing_amount_cents is null or billing_amount_cents >= 0),
  add column if not exists billing_currency text not null default 'EUR',
  add column if not exists billing_paid_at timestamptz,
  add column if not exists stripe_checkout_session_id text unique,
  add column if not exists stripe_payment_intent_id text unique;

create index if not exists cases_org_billing_idx
  on public.cases (organization_id, billing_status);

-- Les dossiers d'exemple et les dossiers déjà validés/envoyés avant Stripe ne
-- doivent pas se retrouver bloqués par la nouvelle garde de paiement.
update public.cases
set billing_status = 'included'
where is_sample = true
  and billing_status = 'unpaid';

update public.cases c
set billing_status = 'included'
where billing_status = 'unpaid'
  and exists (
    select 1 from public.letters l
    where l.case_id = c.id and l.status = 'sent'
  );

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid references public.cases (id) on delete set null,
  kind text not null default 'case' check (kind in ('case')),
  status text not null check (status in ('pending', 'paid', 'failed', 'refunded')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  amount_subtotal_cents bigint check (amount_subtotal_cents is null or amount_subtotal_cents >= 0),
  amount_total_cents bigint check (amount_total_cents is null or amount_total_cents >= 0),
  currency text not null default 'EUR',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists billing_payments_org_idx
  on public.billing_payments (organization_id, created_at desc);
create index if not exists billing_payments_case_idx
  on public.billing_payments (case_id);

alter table public.billing_payments enable row level security;

create policy "billing_payments: lire ses paiements"
  on public.billing_payments for select
  using (organization_id in (select public.user_org_ids()));

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;

-- Protection SQL : un utilisateur peut modifier son org/dossier, mais jamais
-- se donner un abonnement Pro ou marquer un dossier payé.
create or replace function public.organizations_protect_billing()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.stripe_customer_id is distinct from old.stripe_customer_id
       or new.stripe_subscription_id is distinct from old.stripe_subscription_id
       or new.stripe_price_id is distinct from old.stripe_price_id
       or new.billing_plan is distinct from old.billing_plan
       or new.billing_status is distinct from old.billing_status
       or new.subscription_current_period_end is distinct from old.subscription_current_period_end
       or new.subscription_cancel_at_period_end is distinct from old.subscription_cancel_at_period_end
       or new.subscription_updated_at is distinct from old.subscription_updated_at) then
    raise exception 'Colonnes billing organisation : écriture réservée aux webhooks Stripe';
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_protect_billing on public.organizations;
create trigger organizations_protect_billing
  before update on public.organizations
  for each row execute function public.organizations_protect_billing();

create or replace function public.cases_protect_billing()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.billing_status is distinct from old.billing_status
       or new.billing_amount_cents is distinct from old.billing_amount_cents
       or new.billing_currency is distinct from old.billing_currency
       or new.billing_paid_at is distinct from old.billing_paid_at
       or new.stripe_checkout_session_id is distinct from old.stripe_checkout_session_id
       or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id) then
    raise exception 'Colonnes billing dossier : écriture réservée aux webhooks Stripe';
  end if;
  return new;
end;
$$;

drop trigger if exists cases_protect_billing on public.cases;
create trigger cases_protect_billing
  before update on public.cases
  for each row execute function public.cases_protect_billing();
