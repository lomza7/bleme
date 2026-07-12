-- Jeton de routage par dossier pour les réponses email.
--
-- Chaque dossier reçoit un jeton aléatoire NON devinable. À l'envoi d'un courrier
-- par email on met Reply-To = <inbox_slug>+<inbox_token>@CASE_EMAIL_DOMAIN
-- (plus-addressing). À la réception, le webhook Resend parse ce jeton et route la
-- réponse de façon DÉTERMINISTE vers CE dossier (les heuristiques In-Reply-To /
-- expéditeur deviennent un simple filet de secours).
--
-- TEXT (pas uuid) : la partie locale de l'email est comparée en minuscules au
-- parsing → 32 hex minuscules. NON dérivé de l'id (contrairement à inbox_slug =
-- md5(id) qui est devinable) : c'est une adresse semi-publique (le débiteur la
-- voit), l'entropie doit empêcher l'énumération. Ce n'est PAS un secret d'auth,
-- juste un identifiant de routage — la sécurité inter-org reste portée par la
-- RLS de public.cases (organization_id in user_org_ids()) + une re-vérification
-- explicite organization_id à la réception (service-role = RLS contournée).
--
-- RLS : aucune policy à ajouter — public.cases est déjà row-level et couvre
-- d'office cette colonne.
--
-- Le DEFAULT volatil remplit chaque ligne existante d'une valeur DISTINCTE au
-- moment du ALTER (backfill implicite : samples, dossiers résolus/clos inclus) et
-- couvre tous les futurs chemins d'insertion sans les toucher. Aucun trigger
-- nécessaire (un DEFAULT constant-aléatoire suffit, contrairement à inbox_slug
-- qui devait lire NEW.id via un trigger).

alter table public.cases
  add column if not exists inbox_token text
    not null default replace(gen_random_uuid()::text, '-', '');

create unique index if not exists cases_inbox_token_idx
  on public.cases (inbox_token);

comment on column public.cases.inbox_token is
  'Jeton aléatoire non-devinable (32 hex) pour router les réponses email vers ce dossier via plus-addressing (Reply-To = inbox_slug+inbox_token@CASE_EMAIL_DOMAIN). Identifiant de routage semi-public, jamais un secret d''auth ; isolation portée par la RLS de cases.';
