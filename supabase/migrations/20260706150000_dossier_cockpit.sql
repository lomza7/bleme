-- Cockpit du dossier : la « suite » après l'intake (le cœur du produit).
-- Phase 1 (complétude + progression), Phase 2 (courriers → validation loggée →
-- envoi), Phase 3 (extraction IA des pièces, sourcée et éditable).

-- ── Phase 1 : complétude du dossier ──────────────────────────────────────────
alter table public.cases
  add column if not exists completeness_score int not null default 0
    check (completeness_score between 0 and 100);

-- Catégorie de pièce (mappée à la checklist de complétude). Distincte de
-- doc_class (source/format) : doc_kind = rôle de la pièce dans le dossier.
alter table public.documents
  add column if not exists doc_kind text;

-- ── Phase 3 : extractions IA sourcées et éditables ───────────────────────────
create table if not exists public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  field_key text not null,          -- amount_cents | due_date | invoice_number | party_name…
  value_text text,                  -- valeur affichée
  value_normalized jsonb,           -- valeur typée (cents, ISO date…)
  confidence numeric(3, 2) not null default 0 check (confidence between 0 and 1),
  source_excerpt text,              -- l'extrait qui justifie la valeur
  is_user_corrected boolean not null default false,
  corrected_value text,             -- une correction utilisateur prime toujours
  created_at timestamptz not null default now()
);
create index if not exists doc_extractions_doc_idx
  on public.document_extractions (document_id);

alter table public.document_extractions enable row level security;
create policy "extractions: lire" on public.document_extractions for select
  using (organization_id in (select public.user_org_ids()));
create policy "extractions: ajouter" on public.document_extractions for insert
  with check (organization_id in (select public.user_org_ids()));
create policy "extractions: corriger" on public.document_extractions for update
  using (organization_id in (select public.user_org_ids()));

-- ── Phase 2 : courriers (brouillon → validé → envoyé) ────────────────────────
create table if not exists public.letters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  kind text not null
    check (kind in ('reminder_1', 'reminder_2', 'formal_notice', 'response', 'custom')),
  tone text not null default 'ferme',
  status text not null default 'draft'
    check (status in ('draft', 'edited', 'approved', 'sent', 'cancelled')),
  subject text not null default '',
  body_md text not null default '',
  content_sha256 text,              -- hash du contenu approuvé (pilier juridique)
  channel text check (channel in ('email', 'postal')),
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists letters_case_idx
  on public.letters (case_id, created_at desc);

create trigger letters_updated_at
  before update on public.letters
  for each row execute function public.set_updated_at();

alter table public.letters enable row level security;
create policy "letters: lire" on public.letters for select
  using (organization_id in (select public.user_org_ids()));
create policy "letters: créer" on public.letters for insert
  with check (organization_id in (select public.user_org_ids()));
create policy "letters: modifier" on public.letters for update
  using (organization_id in (select public.user_org_ids()));

-- ── Pilier juridique : journal d'approbation, APPEND-ONLY ────────────────────
-- Aucun envoi possible sans une ligne ici, dont le content_sha256 correspond
-- exactement au contenu approuvé. Pas de policy update/delete : immuable.
create table if not exists public.approval_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  letter_id uuid not null references public.letters (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  action text not null default 'approve_send',
  content_sha256 text not null,
  channel text not null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists approval_logs_letter_idx
  on public.approval_logs (letter_id);

alter table public.approval_logs enable row level security;
create policy "approval_logs: lire" on public.approval_logs for select
  using (organization_id in (select public.user_org_ids()));
create policy "approval_logs: journaliser" on public.approval_logs for insert
  with check (organization_id in (select public.user_org_ids()));
-- volontairement : aucune policy update/delete (append-only).
