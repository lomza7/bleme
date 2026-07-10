-- Intégration comptable multi-logiciels : ajout de Sellsy et Axonaut à côté de
-- Pennylane (déjà en prod). L'archive de données est DÉJÀ multi-fournisseurs
-- (les clés uniques de org_integrations et accounting_invoices incluent
-- `provider`) — seules 2 contraintes CHECK et le type du curseur changent.

-- 1) org_integrations.provider : élargir l'enum.
alter table public.org_integrations drop constraint if exists org_integrations_provider_check;
alter table public.org_integrations
  add constraint org_integrations_provider_check
  check (provider in ('pennylane', 'sellsy', 'axonaut'));

-- 2) sync_cursor : de timestamptz vers text. Pennylane utilise un processed_at
--    ISO (reste valide en texte) ; Axonaut/Sellsy utilisent des curseurs non
--    temporels (date DD/MM/YYYY, offset de pagination…).
alter table public.org_integrations
  alter column sync_cursor type text using sync_cursor::text;

-- 3) cases.source : provenance d'un dossier créé depuis ces logiciels.
alter table public.cases drop constraint if exists cases_source_check;
alter table public.cases
  add constraint cases_source_check
  check (source in ('app', 'wizard_draft', 'sample', 'pennylane', 'sellsy', 'axonaut'));

-- Rien à changer sur org_integration_secrets (le token chiffré reste un sac
-- opaque : clé brute pour Pennylane/Axonaut, JSON {client_id,client_secret}
-- pour Sellsy), ni sur notifications.kind / case_events.event_type /
-- documents.doc_class (aucun CHECK).
