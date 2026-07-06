-- Mixture-of-Agents (MOA) par agent, via OpenRouter.
--
-- Calqué sur les presets MOA de Hermes Agent (Nous Research) : au lieu d'un
-- appel modèle unique, N « proposeurs » (reference models) répondent en
-- parallèle, puis un « agrégateur » synthétise leurs sorties en une seule
-- réponse finale (le JSON validé côté produit). Ici le preset EST l'agent :
-- chaque agent porte sa propre config MOA, activable depuis /admin.
--
-- Architecture mono-couche (références → agrégateur), fidèle à Hermes.
-- Coût ≈ ×(N+1) tokens/appel → OFF par défaut, opt-in par agent. Le moteur
-- lib/ai somme les tokens des N+1 appels dans une seule trace agent_runs, si
-- bien que le budget mensuel continue de s'appliquer.

alter table public.agents
  -- Interrupteur (équivalent du `enabled` d'un preset Hermes). OFF → appel simple.
  add column if not exists moa_enabled boolean not null default false,
  -- Modèles proposeurs à mixer : tableau de slugs OpenRouter (ex. "deepseek/deepseek-v4-pro").
  add column if not exists moa_reference_models jsonb not null default '[]'::jsonb,
  -- Modèle agrégateur (slug OpenRouter). NULL → repli sur hermes_model de l'agent.
  add column if not exists moa_aggregator_model text,
  -- Plafond de tokens des proposeurs (levier latence/coût de Hermes). NULL → non plafonné.
  add column if not exists moa_reference_max_tokens integer
    check (moa_reference_max_tokens is null or moa_reference_max_tokens > 0);

-- Pré-remplissage d'une config MOA sensée sur les 6 agents (reste OFF).
-- Proposeurs volontairement de familles différentes : la diversité inter-modèles
-- prime sur le nombre (papier MoA, ablation multiple- vs single-proposer).
-- Agrégateur fort (opus) : l'identité de l'agrégateur pèse le plus sur la qualité.
update public.agents
set
  moa_reference_models = jsonb_build_array(
    'deepseek/deepseek-v4-pro',
    'moonshotai/kimi-k2.6',
    'nousresearch/hermes-4-70b'
  ),
  moa_aggregator_model = 'anthropic/claude-opus-4.8',
  moa_reference_max_tokens = 800
where moa_reference_models = '[]'::jsonb;
