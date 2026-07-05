-- Décision produit : tous les agents tournent en Hermes via OpenRouter
-- (les modèles Anthropic restent accessibles par leurs slugs anthropic/*).
-- La colonne runtime demeure pour un éventuel repli, mais l'UI ne propose
-- plus que le modèle OpenRouter.
update public.agents set runtime = 'hermes';
