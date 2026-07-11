-- Système de droits par membre (RBAC) — « rôles + réglage fin ».
--
-- Chaque membre porte un jeu de capacités effectif (organization_members.
-- permissions jsonb). Les rôles hérités owner/admin gardent l'accès TOTAL ;
-- les membres existants sont backfillés à PLEIN → aucun accès dégradé par la
-- migration. Un membre restreint perd une capacité UNIQUEMENT quand on la lui
-- retire depuis « Mon équipe ».
--
-- Enforcement en profondeur = deux couches :
--   • RLS (barrière dure, base) : has_capability() remplace le simple contrôle
--     d'appartenance sur les tables directement lisibles (dossiers, pièces,
--     courriers, storage, compta, facturation).
--   • Actions serveur (requireCap) : pour tout ce qui passe en service-role
--     (compta, Stripe) ou déclenche un envoi (courriers) — la RLS ne les voit pas.

-- ── Colonnes de permissions ──────────────────────────────────────────────────
alter table public.organization_members
  add column if not exists permissions jsonb not null default '{}'::jsonb;
alter table public.invitations
  add column if not exists permissions jsonb not null default '{}'::jsonb;

-- Élargit les rôles autorisés (préréglages RBAC), en gardant owner/member/admin.
alter table public.organization_members drop constraint if exists organization_members_role_check;
alter table public.organization_members add constraint organization_members_role_check
  check (role in ('owner', 'admin', 'member', 'manager', 'collaborator', 'viewer', 'accountant'));

alter table public.invitations drop constraint if exists invitations_role_check;
alter table public.invitations add constraint invitations_role_check
  check (role in ('member', 'admin', 'manager', 'collaborator', 'viewer', 'accountant'));

-- Backfill : tout le monde à PLEIN (l'existant a déjà l'accès total). Owner/admin
-- sont de toute façon traités comme « tout » par has_capability.
update public.organization_members
set permissions = '{
  "cases.view":true,"cases.create":true,"cases.edit":true,"cases.close":true,
  "documents.view":true,"documents.upload":true,"documents.download":true,
  "letters.prepare":true,"letters.send":true,
  "compta.view":true,"compta.manage":true,
  "billing.view":true,"billing.manage":true,
  "export.data":true,
  "team.invite":true,"team.manage":true
}'::jsonb;

-- Invitations en attente (créées avant le RBAC) : plein aussi, pour que
-- l'acceptation reproduise le comportement historique.
update public.invitations
set permissions = '{
  "cases.view":true,"cases.create":true,"cases.edit":true,"cases.close":true,
  "documents.view":true,"documents.upload":true,"documents.download":true,
  "letters.prepare":true,"letters.send":true,
  "compta.view":true,"compta.manage":true,
  "billing.view":true,"billing.manage":true,
  "export.data":true,
  "team.invite":true,"team.manage":true
}'::jsonb
where status = 'pending' and permissions = '{}'::jsonb;

-- ── has_capability : le membre courant a-t-il cette capacité dans cette org ? ─
-- owner/admin (hérités) → toujours vrai. Sinon on lit le jeu de permissions.
create or replace function public.has_capability(p_org uuid, p_cap text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and (
        m.role in ('owner', 'admin')
        or coalesce((m.permissions ->> p_cap)::boolean, false)
      )
  );
$$;

-- ── RLS : dossiers ───────────────────────────────────────────────────────────
drop policy if exists "cases: lire ses dossiers" on public.cases;
create policy "cases: lire ses dossiers" on public.cases for select
  using (public.has_capability(organization_id, 'cases.view'));

drop policy if exists "cases: créer un dossier" on public.cases;
create policy "cases: créer un dossier" on public.cases for insert
  with check (public.has_capability(organization_id, 'cases.create'));

drop policy if exists "cases: modifier ses dossiers" on public.cases;
create policy "cases: modifier ses dossiers" on public.cases for update
  using (public.has_capability(organization_id, 'cases.edit'))
  with check (public.has_capability(organization_id, 'cases.edit'));

drop policy if exists "cases: supprimer ses dossiers" on public.cases;
create policy "cases: supprimer ses dossiers" on public.cases for delete
  using (public.has_capability(organization_id, 'cases.edit'));

-- Sous-données de dossier → suivent « voir les dossiers ».
drop policy if exists "case_events: lire les événements de ses dossiers" on public.case_events;
create policy "case_events: lire les événements de ses dossiers" on public.case_events for select
  using (public.has_capability(organization_id, 'cases.view'));

drop policy if exists "case_events: créer un événement" on public.case_events;
create policy "case_events: créer un événement" on public.case_events for insert
  with check (public.has_capability(organization_id, 'cases.view'));

-- ── RLS : pièces & documents ─────────────────────────────────────────────────
drop policy if exists "documents: lire ses documents" on public.documents;
create policy "documents: lire ses documents" on public.documents for select
  using (public.has_capability(organization_id, 'documents.view'));

drop policy if exists "documents: ajouter un document" on public.documents;
create policy "documents: ajouter un document" on public.documents for insert
  with check (public.has_capability(organization_id, 'documents.upload'));

drop policy if exists "documents: supprimer un document" on public.documents;
create policy "documents: supprimer un document" on public.documents for delete
  using (public.has_capability(organization_id, 'documents.upload'));

-- Storage : lecture du FICHIER = télécharger ; dépôt/suppression = ajouter.
-- L'org est le 1er segment du chemin ({orgId}/…). On mappe org → capacité via
-- l'appartenance du membre courant.
drop policy if exists "storage documents: lire ses fichiers" on storage.objects;
create policy "storage documents: lire ses fichiers"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (
      select m.organization_id::text from public.organization_members m
      where m.user_id = auth.uid()
        and (m.role in ('owner','admin') or coalesce((m.permissions ->> 'documents.download')::boolean, false))
    )
  );

drop policy if exists "storage documents: déposer dans son organisation" on storage.objects;
create policy "storage documents: déposer dans son organisation"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (
      select m.organization_id::text from public.organization_members m
      where m.user_id = auth.uid()
        and (m.role in ('owner','admin') or coalesce((m.permissions ->> 'documents.upload')::boolean, false))
    )
  );

drop policy if exists "storage documents: supprimer ses fichiers" on storage.objects;
create policy "storage documents: supprimer ses fichiers"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (
      select m.organization_id::text from public.organization_members m
      where m.user_id = auth.uid()
        and (m.role in ('owner','admin') or coalesce((m.permissions ->> 'documents.upload')::boolean, false))
    )
  );

-- ── RLS : courriers ──────────────────────────────────────────────────────────
-- Lecture = voir le dossier ; création/édition de brouillon = préparer.
-- (La VALIDATION & L'ENVOI sont gatés dans approveAndSendLetter côté action.)
drop policy if exists "letters: lire" on public.letters;
create policy "letters: lire" on public.letters for select
  using (public.has_capability(organization_id, 'cases.view'));

drop policy if exists "letters: créer" on public.letters;
create policy "letters: créer" on public.letters for insert
  with check (public.has_capability(organization_id, 'letters.prepare'));

drop policy if exists "letters: modifier" on public.letters;
create policy "letters: modifier" on public.letters for update
  using (public.has_capability(organization_id, 'letters.prepare'));

-- ── RLS : compta & facturation (lecture) ─────────────────────────────────────
-- (Noms de policies IDENTIQUES aux migrations d'origine — sinon l'ancienne
-- policy permissive survivrait et contournerait la restriction.)
drop policy if exists "org_integrations: lecture org" on public.org_integrations;
create policy "org_integrations: lecture org" on public.org_integrations for select
  using (public.has_capability(organization_id, 'compta.view'));

drop policy if exists "accounting_invoices: lecture org" on public.accounting_invoices;
create policy "accounting_invoices: lecture org" on public.accounting_invoices for select
  using (public.has_capability(organization_id, 'compta.view'));

drop policy if exists "billing_payments: lire ses paiements" on public.billing_payments;
create policy "billing_payments: lire ses paiements" on public.billing_payments for select
  using (public.has_capability(organization_id, 'billing.view'));

-- ── RLS : invitations — gérer l'équipe ───────────────────────────────────────
drop policy if exists "invitations: créer pour ses organisations" on public.invitations;
create policy "invitations: créer pour ses organisations" on public.invitations for insert
  with check (
    public.has_capability(organization_id, 'team.invite')
    and inviter_id = (select auth.uid())
  );

drop policy if exists "invitations: modifier celles de ses organisations" on public.invitations;
create policy "invitations: modifier celles de ses organisations" on public.invitations for update
  using (public.has_capability(organization_id, 'team.invite'))
  with check (public.has_capability(organization_id, 'team.invite'));

-- ── Invitations : autoriser la correction d'email (Part 1) ───────────────────
-- On relâche le gel de l'email et du rôle/permissions (corriger une invitation
-- avant acceptation) ; on garde figées les colonnes STRUCTURELLES.
-- On garde figés : structure + rôle + permissions. La correction d'invitation
-- (updateInvitation) ne modifie QUE email/full_name → jamais bloquée. Re-geler
-- rôle/permissions empêche un membre 'team.invite' de hisser une invitation à
-- 'admin'/plein via un UPDATE direct (anti-escalade).
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
    or new.inviter_id is distinct from old.inviter_id
    or new.token is distinct from old.token
    or new.role is distinct from old.role
    or new.permissions is distinct from old.permissions
  ) then
    raise exception 'Modification non autorisée d''une invitation.';
  end if;
  return new;
end;
$$;

-- À l'INSERT d'une invitation par un non-propriétaire : pas de rôle d'accès
-- total, pas de capacités d'escalade (billing.manage / team.manage). Double la
-- garde applicative de sendInvitation au niveau base (l'API REST est
-- directement invocable).
create or replace function public.guard_invitation_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_owner boolean;
begin
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then
    return new;
  end if;
  select (role = 'owner') into caller_owner
  from public.organization_members
  where organization_id = new.organization_id and user_id = auth.uid();
  if coalesce(caller_owner, false) then
    return new;
  end if;
  if new.role in ('owner', 'admin', 'manager') then
    new.role := 'collaborator';
  end if;
  new.permissions := coalesce(new.permissions, '{}'::jsonb)
    || jsonb_build_object('billing.manage', false, 'team.manage', false);
  return new;
end;
$$;

drop trigger if exists invitations_guard_insert on public.invitations;
create trigger invitations_guard_insert
  before insert on public.invitations
  for each row execute function public.guard_invitation_insert();

-- ── handle_new_user : le membre invité hérite des permissions de l'invitation ─
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
  v_perms jsonb;
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

  insert into public.profiles (id, full_name, avatar_url, onboarding_state)
  values (
    new.id,
    display_name,
    new.raw_user_meta_data ->> 'avatar_url',
    case when invite.id is not null then 'done' else 'new' end
  );

  if invite.id is not null then
    v_perms := invite.permissions;
    if v_perms is null or v_perms = '{}'::jsonb then
      v_perms := '{"cases.view":true,"cases.create":true,"cases.edit":true,"cases.close":true,"documents.view":true,"documents.upload":true,"documents.download":true,"letters.prepare":true,"letters.send":true,"compta.view":true,"compta.manage":true,"billing.view":true,"billing.manage":true,"export.data":true,"team.invite":true,"team.manage":true}'::jsonb;
    end if;

    insert into public.organization_members (organization_id, user_id, role, permissions)
    values (invite.organization_id, new.id, invite.role, v_perms)
    on conflict (organization_id, user_id) do nothing;

    update public.invitations
      set status = 'accepted', accepted_at = now(), accepted_user_id = new.id
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

-- ── accept_team_invitation : idem, avec permissions ──────────────────────────
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
  v_perms jsonb;
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

  v_perms := invite.permissions;
  if v_perms is null or v_perms = '{}'::jsonb then
    v_perms := '{"cases.view":true,"cases.create":true,"cases.edit":true,"cases.close":true,"documents.view":true,"documents.upload":true,"documents.download":true,"letters.prepare":true,"letters.send":true,"compta.view":true,"compta.manage":true,"billing.view":true,"billing.manage":true,"export.data":true,"team.invite":true,"team.manage":true}'::jsonb;
  end if;

  insert into public.organization_members (organization_id, user_id, role, permissions)
  values (invite.organization_id, uid, invite.role, v_perms)
  on conflict (organization_id, user_id) do nothing;

  update public.invitations
    set status = 'accepted', accepted_at = now(), accepted_user_id = uid
    where id = invite.id;

  return invite.organization_id;
end;
$$;

-- ── update_member_access : éditer le rôle + les droits d'un membre ───────────
-- Réservé au propriétaire ou à un membre avec 'team.manage'. Garde-fous :
-- on ne touche jamais un owner, on ne crée pas d'owner, et un non-owner ne peut
-- pas accorder les capacités d'escalade (billing.manage, team.manage).
create or replace function public.update_member_access(
  p_org uuid,
  p_user uuid,
  p_role text,
  p_perms jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  target_role text;
  perms jsonb := coalesce(p_perms, '{}'::jsonb);
begin
  select role into caller_role from public.organization_members
    where organization_id = p_org and user_id = auth.uid();
  if caller_role is null then
    raise exception 'Non membre de cette organisation.';
  end if;
  if caller_role <> 'owner'
     and not public.has_capability(p_org, 'team.manage') then
    raise exception 'Droit insuffisant pour gérer les droits.';
  end if;

  select role into target_role from public.organization_members
    where organization_id = p_org and user_id = p_user;
  if target_role is null then
    raise exception 'Membre introuvable.';
  end if;
  if target_role = 'owner' then
    raise exception 'Le propriétaire ne peut pas être modifié.';
  end if;
  -- 'owner' et 'admin' = accès total implicite → jamais attribuables ici
  -- (sinon un non-propriétaire escaladerait en contournant le strip de droits).
  if p_role not in ('member','manager','collaborator','viewer','accountant') then
    raise exception 'Rôle invalide.';
  end if;

  -- Un non-owner ne peut pas accorder les capacités d'escalade.
  if caller_role <> 'owner' then
    perms := perms || jsonb_build_object('billing.manage', false, 'team.manage', false);
  end if;

  update public.organization_members
    set role = p_role, permissions = perms
    where organization_id = p_org and user_id = p_user;
end;
$$;
