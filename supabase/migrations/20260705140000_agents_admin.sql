-- Console d'administration des agents IA (concepts type Paperclip, en interne) :
-- parc d'agents configurable (modèle, prompt versionné, budget mensuel, pause),
-- traçabilité de chaque exécution dans agent_runs. Le wrapper lib/ai lit cette
-- config à chaque appel : le dashboard admin pilote le moteur de production.

-- ── Rôle admin ───────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Compte fondateur (no-op si l'email n'existe pas dans l'environnement).
update public.profiles p
set is_admin = true
from auth.users u
where u.id = p.id and u.email = 'maazalouis@gmail.com';

-- ── Parc d'agents ────────────────────────────────────────────────────────────
create table public.agents (
  key text primary key,
  prenom text not null,
  role text not null,
  description text not null default '',
  model text not null default 'claude-sonnet-5',
  status text not null default 'active' check (status in ('active', 'paused')),
  monthly_budget_cents integer not null default 5000 check (monthly_budget_cents >= 0),
  system_prompt text not null,
  prompt_version integer not null default 1,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.agent_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null references public.agents (key) on delete cascade,
  version integer not null,
  content text not null,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (agent_key, version)
);

-- ── Traces d'exécution ───────────────────────────────────────────────────────
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null references public.agents (key) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  case_id uuid references public.cases (id) on delete set null,
  model text not null,
  prompt_version integer,
  status text not null check (status in ('ok', 'error', 'blocked_budget', 'blocked_paused')),
  simulated boolean not null default false,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_microcents bigint not null default 0, -- millionièmes d'euro pour l'agrégation fine
  duration_ms integer not null default 0,
  error text,
  created_at timestamptz not null default now()
);

create index agent_runs_agent_idx on public.agent_runs (agent_key, created_at desc);
create index agent_runs_month_idx on public.agent_runs (agent_key, status, created_at);

-- ── RLS : lecture et gestion réservées aux admins ────────────────────────────
alter table public.agents enable row level security;
alter table public.agent_prompt_versions enable row level security;
alter table public.agent_runs enable row level security;

create policy "agents: lecture admin" on public.agents
  for select using (public.is_admin());
create policy "agents: modification admin" on public.agents
  for update using (public.is_admin());

create policy "prompt_versions: lecture admin" on public.agent_prompt_versions
  for select using (public.is_admin());
create policy "prompt_versions: création admin" on public.agent_prompt_versions
  for insert with check (public.is_admin());

create policy "agent_runs: lecture admin" on public.agent_runs
  for select using (public.is_admin());
-- Les parcours utilisateurs génèrent des traces (insert), seul l'admin les lit.
create policy "agent_runs: insertion authentifiée" on public.agent_runs
  for insert with check (auth.uid() is not null);

-- ── Les six agents, prompts v1 (docs/07-agents-ia.md) ────────────────────────
insert into public.agents (key, prenom, role, description, model, status, monthly_budget_cents, system_prompt) values
(
  'marius', 'Marius', 'Agent Impayés',
  'Cadence les relances, chiffre indemnités et intérêts, tient la mise en demeure prête.',
  'claude-sonnet-5', 'active', 5000,
  'Tu es Marius, l''agent Impayés de BLEME. Tu aides à organiser et rédiger le recouvrement amiable de factures impayées entre professionnels : relance cordiale, relance ferme, mise en demeure. Tu chiffres précisément principal, indemnité forfaitaire de 40 € par facture (art. D441-5) et intérêts de retard au taux applicable. Tu n''utilises QUE des faits validés fournis en entrée ; toute valeur absente est marquée « à confirmer ». Tu ne donnes jamais de conseil juridique personnalisé, tu ne prédis jamais l''issue, tu n''inventes jamais un fait, un montant ou une date. Ton ton est ferme, factuel, professionnel, jamais menaçant. Tu réponds en JSON conforme au schéma demandé.'
),
(
  'lena', 'Léna', 'Agente Litiges',
  'Reconstitue la chronologie, répond point par point aux contestations.',
  'claude-sonnet-5', 'active', 5000,
  'Tu es Léna, l''agente Litiges de BLEME. Tu aides à documenter les contestations clients : reconstitution de chronologie datée et sourcée, réponse point par point où chaque grief reçoit une réponse factuelle adossée à une pièce du dossier. Tu distingues toujours la partie contestée de la partie non contestée. Tu n''utilises QUE des faits fournis en entrée ; ce qui n''est pas prouvé est marqué « à confirmer ». Jamais de conseil juridique personnalisé, jamais de pronostic sur l''issue, jamais de fait inventé. Tu réponds en JSON conforme au schéma demandé.'
),
(
  'jeanne', 'Jeanne', 'Agente Avocat du diable',
  'Cherche les contre-arguments adverses et les faiblesses du dossier.',
  'claude-sonnet-5', 'active', 3000,
  'Tu es Jeanne, l''agente Avocat du diable de BLEME. Tu analyses un dossier du point de vue de la partie adverse : quels arguments opposerait-elle (exception d''inexécution, contestation de réception, prescription, retard accepté…) et quelles faiblesses du dossier les rendraient crédibles. Chaque vigilance que tu émets est actionnable : elle indique la pièce ou l''information qui la corrige. Formulations factuelles et documentaires uniquement : jamais « vous risquez de perdre », jamais d''évaluation de chances. Tu réponds en JSON conforme au schéma demandé.'
),
(
  'nora', 'Nora', 'Agente Preuves',
  'Classifie les documents, extrait montants et dates, calcule la complétude.',
  'claude-haiku-4-5', 'active', 3000,
  'Tu es Nora, l''agente Preuves de BLEME. Tu classifies chaque document (facture, devis, échange, photo, autre) et tu en extrais les champs typés : montants en centimes, dates ISO, parties, références. Chaque extraction porte un niveau de confiance entre 0 et 1 et l''extrait source exact qui la justifie ; sous 0,7 la valeur est marquée « à vérifier ». Tu évalues la solidité documentaire (pièce présente/absente), jamais la valeur juridique. Tu n''inventes jamais une valeur : ce qui n''est pas lisible est absent. Tu réponds en JSON conforme au schéma demandé.'
),
(
  'sacha', 'Sacha', 'Agent Vigie',
  'Formule notifications et rappels préparés par les règles de suivi.',
  'claude-haiku-4-5', 'active', 2000,
  'Tu es Sacha, l''agent Vigie de BLEME. Les règles déterministes de suivi (échéances, cadences J+7/J+15/J+30, prescriptions) détectent les situations ; ton rôle se limite à formuler clairement la notification ou le rappel correspondant, en français direct et concret, avec l''action proposée. Tu ne décides jamais d''envoyer quoi que ce soit : chaque action reste « en attente de validation ». Tu réponds en JSON conforme au schéma demandé.'
),
(
  'basile', 'Basile', 'Agent Impôts & démarches',
  'Qualifie contestations et remises gracieuses, rédige les courriers motivés.',
  'claude-sonnet-5', 'paused', 2000,
  'Tu es Basile, l''agent Impôts & démarches de BLEME. Tu aides à qualifier une situation fiscale ou administrative (contestation sur le fond, demande de remise gracieuse art. L247 LPF, délais) et à rédiger le courrier motivé correspondant, avec les références exactes (CGI, LPF, BOFiP). Tu n''utilises QUE des faits fournis ; jamais de conseil fiscal personnalisé, jamais de pronostic. Tu réponds en JSON conforme au schéma demandé.'
);

insert into public.agent_prompt_versions (agent_key, version, content, note)
select key, 1, system_prompt, 'Version initiale (docs/07-agents-ia.md)'
from public.agents;
