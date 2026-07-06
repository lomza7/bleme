-- Cycle de vie du dossier en 3 phases : Préparer & lancer → Relancer & négocier
-- → Escalader & résoudre. La phase est un SNAPSHOT dérivé (cache de la fonction
-- pure derivePhase, recalculé par recomputeCaseProgress) — même pattern que
-- completeness_score / stage / next_action_*. On ne dérive pas à la lecture pour
-- garder les dashboards « cheap » (pas de jointure letters par carte).

-- ── Phase persistée (1..3) ───────────────────────────────────────────────────
alter table public.cases
  add column if not exists phase smallint not null default 1
    check (phase between 1 and 3);

-- Prochain courrier prévu (échelle reminder_1 → reminder_2 → formal_notice, ou
-- 'response' pour un litige). Null = plus de courrier standard (endgame P3).
alter table public.cases
  add column if not exists next_letter_kind text
    check (next_letter_kind in ('reminder_1', 'reminder_2', 'formal_notice', 'response'));

-- ── Phase 3 : sorties IA persistées (pas de run à chaque rendu) ───────────────
-- devil_review : revue « avocat du diable » (agent Jeanne, run tracé). Tableau
-- JSON de points ACTIONNABLES [{ objection, remede, missing_kind }]. Formulations
-- factuelles/documentaires uniquement, jamais de pronostic.
-- escalation_summary_md : synthèse d'escalade factuelle (agent Marius, run tracé).
-- closed_reason : motif de clôture (paid | settlement | abandoned | other).
alter table public.cases
  add column if not exists devil_review jsonb,
  add column if not exists escalation_summary_md text,
  add column if not exists closed_reason text;

-- ── Phase 2 : retour du débiteur, capture RÉELLE ─────────────────────────────
-- Le TEXTE exact de la réponse reçue, saisi par l'utilisateur. Il donne à
-- Marius/Léna un contexte honnête (aucune valeur inventée) pour rédiger la
-- réponse adaptée. Table métier → organization_id + RLS.
create table if not exists public.debtor_replies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  letter_id uuid references public.letters (id) on delete set null, -- la relance à laquelle il répond, si connue
  received_via text not null default 'other'
    check (received_via in ('email', 'postal', 'phone', 'other')),
  body_text text not null,
  handled boolean not null default false, -- une réponse adaptée a-t-elle été rédigée ?
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists debtor_replies_case_idx
  on public.debtor_replies (case_id, received_at desc);

alter table public.debtor_replies enable row level security;
create policy "debtor_replies: lire" on public.debtor_replies for select
  using (organization_id in (select public.user_org_ids()));
create policy "debtor_replies: ajouter" on public.debtor_replies for insert
  with check (organization_id in (select public.user_org_ids()));
create policy "debtor_replies: marquer traité" on public.debtor_replies for update
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));

-- ── Backfill honnête des dossiers RÉELS depuis les courriers envoyés ─────────
-- Idempotent : rejouable, recalcule toujours le même résultat depuis letters.
-- Les samples reçoivent une phase EXPLICITE au seed (createSampleCases) car ils
-- n'ont pas de courriers ; on ne les touche pas ici.
update public.cases c set phase = case
  when c.status = 'escalated' then 3
  when exists (
    select 1 from public.letters l
    where l.case_id = c.id and l.kind = 'formal_notice' and l.status = 'sent'
  ) then 3
  when exists (
    select 1 from public.letters l
    where l.case_id = c.id and l.status = 'sent'
  ) then 2
  else 1 end
where c.is_sample = false;
