-- Annexes d'un courrier : pièces du dossier que l'utilisateur choisit de
-- joindre au moment de la validation (email ou lettre recommandée).
--
-- Snapshot figé à l'approbation : [{document_id, file_name, mime_type,
-- size_bytes, sha256}]. Le sha256 de CHAQUE fichier joint est gravé dans
-- approval_logs à côté du hash du corps : la preuve d'approbation couvre le
-- contenu ET les annexes exactes qui partent (pilier juridique n° 1).

alter table public.letters
  add column if not exists attachments jsonb;

alter table public.approval_logs
  add column if not exists attachments jsonb;
