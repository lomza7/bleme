-- Invitations d'équipe & experts externes.
--
-- Deux natures d'invitation partagent une même table `invitations` (org-scoped,
-- RLS) :
--   • 'team'                     → collègue qui rejoint l'organisation (flux
--                                  complet : email → inscription → rattachement).
--   • 'accountant' / 'lawyer'    → expert externe (expert-comptable / avocat).
--                                  On enregistre ses coordonnées et on l'invite
--                                  par email, sans lui ouvrir d'accès à l'app.
--
-- Chaque invitation d'un professionnel alimente en plus `professional_leads` :
-- une base de prospection trans-organisations, réservée aux admins (socle d'une
-- future marketplace). L'alimentation passe par un trigger SECURITY DEFINER —
-- l'utilisateur ne touche jamais cette table directement.

-- ── invitations ──────────────────────────────────────────────────────────────
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  inviter_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('team', 'accountant', 'lawyer')),
  -- Rôle attribué à l'acceptation (n'a de sens que pour kind = 'team').
  role text not null default 'member' check (role in ('member', 'admin')),
  email text not null,
  full_name text,
  firm_name text,        -- cabinet / société (experts)
  phone text,
  message text,          -- mot personnel de l'invitant
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_user_id uuid references auth.users (id) on delete set null
);

create index invitations_org_idx on public.invitations (organization_id);
create index invitations_email_idx on public.invitations (lower(email));

-- Une seule invitation en attente par email et par organisation.
create unique index invitations_pending_unique
  on public.invitations (organization_id, lower(email))
  where status = 'pending';

create trigger invitations_updated_at
  before update on public.invitations
  for each row execute function public.set_updated_at();

-- ── professional_leads : base de prospection (admin-only) ────────────────────
create table public.professional_leads (
  id uuid primary key default gen_random_uuid(),
  profession text not null check (profession in ('accountant', 'lawyer')),
  full_name text,
  email text not null,
  firm_name text,
  phone text,
  -- Provenance : qui, dans quelle organisation, a mentionné ce professionnel.
  source_organization_id uuid references public.organizations (id) on delete set null,
  source_invitation_id uuid references public.invitations (id) on delete set null,
  first_referred_by uuid references auth.users (id) on delete set null,
  referral_count int not null default 1,
  -- Suivi de démarchage (interne).
  outreach_status text not null default 'new'
    check (outreach_status in ('new', 'contacted', 'interested', 'declined', 'onboarded')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un même professionnel (métier + email) n'apparaît qu'une fois ; les mentions
-- répétées incrémentent referral_count.
create unique index professional_leads_unique
  on public.professional_leads (profession, email);

create trigger professional_leads_updated_at
  before update on public.professional_leads
  for each row execute function public.set_updated_at();

-- ── Trigger : capture d'un lead à chaque invitation de professionnel ─────────
create or replace function public.capture_professional_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind in ('accountant', 'lawyer') then
    insert into public.professional_leads
      (profession, full_name, email, firm_name, phone,
       source_organization_id, source_invitation_id, first_referred_by)
    values
      (new.kind, new.full_name, lower(new.email), new.firm_name, new.phone,
       new.organization_id, new.id, new.inviter_id)
    on conflict (profession, email) do update
      set referral_count = professional_leads.referral_count + 1,
          full_name = coalesce(professional_leads.full_name, excluded.full_name),
          firm_name = coalesce(professional_leads.firm_name, excluded.firm_name),
          phone = coalesce(professional_leads.phone, excluded.phone),
          updated_at = now();
  end if;
  return new;
end;
$$;

create trigger invitations_capture_lead
  after insert on public.invitations
  for each row execute function public.capture_professional_lead();

-- ── handle_new_user : rattacher un invité « équipe » à l'org existante ───────
-- Si une invitation d'équipe est en attente pour l'email du nouvel utilisateur,
-- il rejoint cette organisation au lieu d'en créer une nouvelle (l'app reste
-- mono-organisation par membre). Sinon, parcours d'inscription habituel.
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
  v_token text;
  invite public.invitations%rowtype;
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

  -- Rattachement à une équipe : UNIQUEMENT si l'inscription porte le token de
  -- l'invitation (transmis par /rejoindre/[token] → InviteSignupForm → signUp).
  -- On exige token ET correspondance d'email : la simple connaissance de
  -- l'email ne suffit pas (le token n'est délivré qu'à la boîte invitée), et
  -- une invitation tierce pré-déposée ne détourne jamais une inscription
  -- normale (sans token → parcours de création d'organisation).
  v_token := nullif(new.raw_user_meta_data ->> 'invite_token', '');

  if v_token is not null then
    select * into invite
    from public.invitations
    where token::text = v_token
      and kind = 'team'
      and status = 'pending'
      and expires_at > now()
      and lower(email) = lower(new.email)
    limit 1;
  end if;

  -- Un invité rejoint une organisation DÉJÀ configurée : on saute l'onboarding
  -- (/bienvenue écrit dans organizations — un membre ne doit pas écraser les
  -- informations de l'entreprise du propriétaire).
  insert into public.profiles (id, full_name, avatar_url, onboarding_state)
  values (
    new.id,
    display_name,
    new.raw_user_meta_data ->> 'avatar_url',
    case when invite.id is not null then 'done' else 'new' end
  );

  if invite.id is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (invite.organization_id, new.id, invite.role)
    on conflict (organization_id, user_id) do nothing;

    update public.invitations
      set status = 'accepted',
          accepted_at = now(),
          accepted_user_id = new.id
      where id = invite.id;

    return new;
  end if;

  -- Parcours normal : nouvelle organisation, membre owner.
  insert into public.organizations (name)
  values (company_name)
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.invitations enable row level security;
alter table public.professional_leads enable row level security;

-- invitations : cloisonnées par organisation.
create policy "invitations: lire celles de ses organisations"
  on public.invitations for select
  using (organization_id in (select public.user_org_ids()));

create policy "invitations: créer pour ses organisations"
  on public.invitations for insert
  with check (
    organization_id in (select public.user_org_ids())
    and inviter_id = (select auth.uid())
  );

create policy "invitations: modifier celles de ses organisations"
  on public.invitations for update
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));

-- professional_leads : strictement admin (l'alimentation passe par le trigger
-- SECURITY DEFINER ; la lecture applicative se fait en service-role).
create policy "leads: admin lecture"
  on public.professional_leads for select
  using (public.is_admin());

create policy "leads: admin écriture"
  on public.professional_leads for update
  using (public.is_admin())
  with check (public.is_admin());

-- ── Colonnes d'invitation immuables (anti-escalade de rôle) ──────────────────
-- La policy UPDATE autorise tout membre de l'org (revoke / resend). On empêche
-- qu'un membre, via un appel API direct, modifie des colonnes sensibles (rôle,
-- organisation, email…). Seuls status / expires_at / accepted_* / updated_at
-- restent modifiables. Les rôles privilégiés (postgres, service_role) et les
-- triggers SECURITY DEFINER internes ne sont pas concernés.
create or replace function public.guard_invitation_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') and (
       new.organization_id is distinct from old.organization_id
    or new.kind is distinct from old.kind
    or new.role is distinct from old.role
    or lower(new.email) is distinct from lower(old.email)
    or new.inviter_id is distinct from old.inviter_id
    or new.token is distinct from old.token
  ) then
    raise exception 'Modification non autorisée d''une invitation.';
  end if;
  return new;
end;
$$;

create trigger invitations_guard_immutable
  before update on public.invitations
  for each row execute function public.guard_invitation_immutable();

-- ── Accepter une invitation d'équipe (utilisateur DÉJÀ connecté) ─────────────
-- Chemin « ou se connecte » du flux membre : l'utilisateur authentifié dont
-- l'email correspond à l'invitation rejoint l'organisation. SECURITY DEFINER
-- car le visiteur n'est pas encore membre (RLS bloquerait l'insert).
create or replace function public.accept_team_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  invite public.invitations%rowtype;
  uid uuid := auth.uid();
  uemail text;
begin
  if uid is null then
    raise exception 'Non authentifié.';
  end if;
  select email into uemail from auth.users where id = uid;

  select * into invite
  from public.invitations
  where token::text = p_token
    and kind = 'team'
    and status = 'pending'
    and expires_at > now()
  limit 1;
  if invite.id is null then
    raise exception 'Invitation invalide ou expirée.';
  end if;
  if lower(invite.email) is distinct from lower(uemail) then
    raise exception 'Cette invitation ne correspond pas à votre adresse email.';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (invite.organization_id, uid, invite.role)
  on conflict (organization_id, user_id) do nothing;

  update public.invitations
    set status = 'accepted', accepted_at = now(), accepted_user_id = uid
    where id = invite.id;

  return invite.organization_id;
end;
$$;

-- ── Identités affichables des membres d'une organisation ─────────────────────
-- profiles n'est lisible que pour soi et auth.users est hors RLS : sans aide,
-- un membre voit ses collègues comme des « Membre » anonymes. Ce helper
-- SECURITY DEFINER expose nom + email des membres, mais UNIQUEMENT aux membres
-- de la même organisation (garde exists()).
create or replace function public.org_members_display(p_org uuid)
returns table (user_id uuid, full_name text, email text)
language sql
security definer
set search_path = public, auth
stable
as $$
  select m.user_id, p.full_name, u.email::text
  from public.organization_members m
  left join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.organization_id = p_org
    and exists (
      select 1 from public.organization_members me
      where me.organization_id = p_org and me.user_id = auth.uid()
    );
$$;
