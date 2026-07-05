-- Boîte de réception : centraliser emails transférés, exports WhatsApp et
-- fichiers avant leur versement dans un dossier. Libellés type Gmail pour
-- pré-trier. Adresse de transfert unique par organisation (inbox_slug),
-- prête pour la réception d'emails entrants dès que le domaine sera branché.

-- ── Adresse de transfert par organisation ────────────────────────────────────
alter table public.organizations
  add column if not exists inbox_slug text unique;

update public.organizations
set inbox_slug = 'b-' || substr(md5(id::text || 'bleme-inbox'), 1, 8)
where inbox_slug is null;

-- ── Libellés (sous-dossiers de tri) ──────────────────────────────────────────
create table public.inbox_labels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null default 'sable'
    check (color in ('sable', 'terracotta', 'olive', 'ardoise', 'prune')),
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index inbox_labels_org_idx on public.inbox_labels (organization_id);

alter table public.inbox_labels enable row level security;

create policy "inbox_labels: lire ses libellés"
  on public.inbox_labels for select
  using (organization_id in (select public.user_org_ids()));

create policy "inbox_labels: créer un libellé"
  on public.inbox_labels for insert
  with check (organization_id in (select public.user_org_ids()));

create policy "inbox_labels: modifier un libellé"
  on public.inbox_labels for update
  using (organization_id in (select public.user_org_ids()));

create policy "inbox_labels: supprimer un libellé"
  on public.inbox_labels for delete
  using (organization_id in (select public.user_org_ids()));

-- ── Éléments reçus ───────────────────────────────────────────────────────────
create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  source text not null check (source in ('email', 'whatsapp', 'fichier', 'note')),
  from_name text,
  from_contact text,
  subject text not null,
  excerpt text,
  body_text text,
  storage_path text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  label_id uuid references public.inbox_labels (id) on delete set null,
  case_id uuid references public.cases (id) on delete set null,
  is_read boolean not null default false,
  is_archived boolean not null default false,
  is_sample boolean not null default false,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index inbox_items_org_idx
  on public.inbox_items (organization_id, is_archived, received_at desc);

alter table public.inbox_items enable row level security;

create policy "inbox_items: lire ses éléments"
  on public.inbox_items for select
  using (organization_id in (select public.user_org_ids()));

create policy "inbox_items: ajouter un élément"
  on public.inbox_items for insert
  with check (organization_id in (select public.user_org_ids()));

create policy "inbox_items: modifier un élément"
  on public.inbox_items for update
  using (organization_id in (select public.user_org_ids()));

create policy "inbox_items: supprimer un élément"
  on public.inbox_items for delete
  using (organization_id in (select public.user_org_ids()));
