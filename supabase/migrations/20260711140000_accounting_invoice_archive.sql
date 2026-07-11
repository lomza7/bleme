-- Archivage des factures importées : l'utilisateur peut écarter une facture
-- de la liste « à traiter » sans créer de dossier (ex. déjà réglée hors BLEME,
-- litige à part…). Écrit par une action serveur scoppée à l'org (service-role,
-- comme la création de dossier) ; lecture org via la policy select existante.
alter table public.accounting_invoices add column if not exists archived_at timestamptz;

create index if not exists accounting_invoices_org_archived_idx
  on public.accounting_invoices (organization_id, archived_at);
