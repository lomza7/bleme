-- T2 : identité — profils, organisations, membres, trigger de bootstrap, RLS.

-- updated_at automatique
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  onboarding_state text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── organizations ───────────────────────────────────────────────────────────
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  siret text check (siret is null or siret ~ '^\d{14}$'),
  legal_form text,
  address_json jsonb,
  iban_last4 text check (iban_last4 is null or iban_last4 ~ '^\d{4}$'),
  logo_url text,
  default_letter_tone text not null default 'neutral'
    check (default_letter_tone in ('cordial', 'neutral', 'firm')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ── organization_members ────────────────────────────────────────────────────
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member', 'admin')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_members_user_idx on public.organization_members (user_id);

-- ── Helper : les organisations de l'utilisateur courant ─────────────────────
-- security definer pour éviter la récursion RLS dans les policies.
create or replace function public.user_org_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from public.organization_members
  where user_id = auth.uid();
$$;

-- ── Bootstrap à l'inscription : profil + organisation + membre owner ────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  company_name text;
  new_org_id uuid;
begin
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );
  company_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'company_name'), ''),
    display_name
  );

  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, display_name, new.raw_user_meta_data ->> 'avatar_url');

  insert into public.organizations (name)
  values (company_name)
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy "profiles: lire son profil"
  on public.profiles for select
  using (id = (select auth.uid()));

create policy "profiles: modifier son profil"
  on public.profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "organizations: lire ses organisations"
  on public.organizations for select
  using (id in (select public.user_org_ids()));

create policy "organizations: modifier ses organisations"
  on public.organizations for update
  using (id in (select public.user_org_ids()))
  with check (id in (select public.user_org_ids()));

create policy "members: lire les membres de ses organisations"
  on public.organization_members for select
  using (organization_id in (select public.user_org_ids()));
