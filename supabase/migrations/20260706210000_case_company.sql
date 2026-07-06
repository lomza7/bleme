-- Fiche entreprise du débiteur/client, rattachée au dossier. Recherche via
-- l'annuaire officiel (recherche-entreprises.api.gouv.fr, sans clé) pour
-- l'autocomplétion ; fiche légale complète via Pappers, récupérée à la création
-- et stockée ici (siège officiel, dirigeants, forme, NAF, procédure collective…)
-- — utile pour la suite ET pour les agents (adresse d'une mise en demeure,
-- alerte si le débiteur est en procédure, etc.).

alter table public.cases
  add column if not exists debtor_siren text
    check (debtor_siren is null or debtor_siren ~ '^\d{9}$'),
  add column if not exists debtor_company jsonb;
