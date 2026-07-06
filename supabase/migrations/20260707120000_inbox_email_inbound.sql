-- Email entrant : chaque organisation reçoit vraiment des mails transférés.
-- 1) adresse de transfert garantie sur TOUTE nouvelle org (trigger) ;
-- 2) une pièce jointe = une ligne inbox_attachments (un email = 1 item + N PJ) ;
-- 3) message_id / in_reply_to pour l'idempotence et le fil de discussion.

-- ── 1. inbox_slug posé automatiquement à la création d'une organisation ──────
-- handle_new_user() n'écrit que le nom → sans ce trigger, les orgs créées après
-- la migration inbox restent à NULL (pas d'adresse). Un DEFAULT ne peut pas lire
-- NEW.id ; le trigger BEFORE INSERT le peut (l'uuid par défaut est déjà posé).
create or replace function public.set_inbox_slug()
returns trigger
language plpgsql
as $$
begin
  if new.inbox_slug is null then
    new.inbox_slug := 'b-' || substr(md5(new.id::text || 'bleme-inbox'), 1, 8);
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_inbox_slug on public.organizations;
create trigger organizations_inbox_slug
  before insert on public.organizations
  for each row execute function public.set_inbox_slug();

-- Rattrapage défensif des organisations sans adresse (créées depuis la migration
-- inbox sans backfill). Format identique à l'existant.
update public.organizations
set inbox_slug = 'b-' || substr(md5(id::text || 'bleme-inbox'), 1, 8)
where inbox_slug is null;

-- ── 2. Pièces jointes d'un email (table enfant, org-scoped comme tout métier) ─
create table if not exists public.inbox_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  inbox_item_id uuid not null references public.inbox_items (id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,          -- idempotence + miroir de documents.storage_path
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now()
);

create index if not exists inbox_attachments_item_idx
  on public.inbox_attachments (inbox_item_id);

alter table public.inbox_attachments enable row level security;

create policy "inbox_attachments: lire"
  on public.inbox_attachments for select
  using (organization_id in (select public.user_org_ids()));

create policy "inbox_attachments: ajouter"
  on public.inbox_attachments for insert
  with check (organization_id in (select public.user_org_ids()));

create policy "inbox_attachments: modifier"
  on public.inbox_attachments for update
  using (organization_id in (select public.user_org_ids()));

create policy "inbox_attachments: supprimer"
  on public.inbox_attachments for delete
  using (organization_id in (select public.user_org_ids()));

-- ── 3. Fil / dédup sur inbox_items ───────────────────────────────────────────
alter table public.inbox_items
  add column if not exists message_id text,
  add column if not exists in_reply_to text;

-- Un Message-ID re-livré (retry du webhook) devient un no-op au niveau org.
create unique index if not exists inbox_items_org_message_idx
  on public.inbox_items (organization_id, message_id)
  where message_id is not null;
