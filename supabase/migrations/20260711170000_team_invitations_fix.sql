-- Correctif de 20260711160000_team_invitations.sql.
--
-- Une version intermédiaire de cette migration a été appliquée en production
-- (session concurrente) : la table `invitations` a été créée SANS colonne
-- updated_at (alors qu'un trigger l'attend → tout UPDATE échouait), le
-- rattachement `handle_new_user` se faisait sur le seul email (sans lien au
-- token → brèche d'isolation), et les fonctions accept_team_invitation /
-- org_members_display / guard_invitation_immutable manquaient.
--
-- Ce fichier réaligne le schéma live sur l'état corrigé, de façon idempotente
-- (add column if not exists, create or replace, drop trigger if exists) : sûr
-- aussi bien sur la prod actuelle que sur une base reconstruite depuis zéro.

-- ── #1 : colonne updated_at manquante (débloque le trigger updated_at) ───────
alter table public.invitations
  add column if not exists updated_at timestamptz not null default now();

-- ── #2/#4 : rattachement d'équipe lié au TOKEN d'invitation ──────────────────
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

  -- Rattachement UNIQUEMENT si l'inscription porte le token de l'invitation
  -- (transmis par /rejoindre/[token]). Token ET email doivent correspondre :
  -- la seule connaissance de l'email ne suffit pas, et une invitation tierce
  -- pré-déposée ne détourne pas une inscription normale.
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

  insert into public.organizations (name)
  values (company_name)
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;

-- ── #8 : colonnes d'invitation immuables (anti-escalade de rôle) ─────────────
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

drop trigger if exists invitations_guard_immutable on public.invitations;
create trigger invitations_guard_immutable
  before update on public.invitations
  for each row execute function public.guard_invitation_immutable();

-- ── #5 : accepter une invitation d'équipe (utilisateur déjà connecté) ────────
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

-- ── #6 : identités affichables des membres d'une organisation ────────────────
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
