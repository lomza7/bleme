-- Documents (Drive V0) : pièces par dossier + coffre entreprise, Storage privé.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid references public.cases (id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  doc_class text not null default 'other',
  created_at timestamptz not null default now()
);

create index documents_org_case_idx on public.documents (organization_id, case_id, created_at desc);

alter table public.documents enable row level security;

create policy "documents: lire ses documents"
  on public.documents for select
  using (organization_id in (select public.user_org_ids()));

create policy "documents: ajouter un document"
  on public.documents for insert
  with check (organization_id in (select public.user_org_ids()));

create policy "documents: supprimer un document"
  on public.documents for delete
  using (organization_id in (select public.user_org_ids()));

-- ── Bucket Storage privé ─────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  26214400, -- 25 Mo
  array['application/pdf','image/jpeg','image/png','image/heic','image/heif','image/webp','text/plain','message/rfc822','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword']
)
on conflict (id) do nothing;

-- Chemins : {organization_id}/{'company'|case_id}/{uuid}-{nom}
create policy "storage documents: lire ses fichiers"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (select public.user_org_ids()::text)
  );

create policy "storage documents: déposer dans son organisation"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (select public.user_org_ids()::text)
  );

create policy "storage documents: supprimer ses fichiers"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (select public.user_org_ids()::text)
  );
