@AGENTS.md

# BLEME — Conventions projet

BLEME est une plateforme B2B (artisans, freelances, TPE) qui transforme un problème pro — factures impayées et litiges clients — en dossier suivi : intake vocal, preuves classées, timeline, courriers en brouillon, validation humaine, suivi, export.

**Source de vérité produit : `docs/00-INDEX.md`** (stratégie, MVP, PRD, modèle de données, agents IA, workflows, plan d'exécution). Toute évolution de périmètre se décide dans les docs avant d'être codée.

## Stack

- Next.js 16 App Router (attention : conventions renommées, ex. `middleware` → `proxy.ts` ; consulter `node_modules/next/dist/docs/` en cas de doute)
- TypeScript strict, Tailwind CSS v4, shadcn/ui (`components/ui/`)
- Supabase : auth, Postgres (RLS partout), Storage — clients dans `lib/supabase/` (`server.ts` = user-scoped RLS ; `createServiceClient()` = service-role, réservé workers/webhooks)
- Zod sur toute entrée externe (formulaires, API routes, webhooks, sorties LLM)
- Env : toujours via `lib/env.ts` (`publicEnv()` / `serverEnv()`), jamais `process.env` directement

## Règles non négociables

1. **Aucun envoi sortant (email, courrier, recommandé) sans validation utilisateur loggée dans `approval_logs`** (hash du contenu approuvé). C'est le pilier juridique du produit.
2. Jamais de vocabulaire de conseil juridique dans l'UI ou les prompts : pas de "gagner", "stratégie judiciaire", "vos chances". On dit "brouillon", "modèle", "suggestion", "à faire valider par un professionnel si doute".
3. Toute valeur extraite par IA porte sa source et reste éditable ; une correction utilisateur prime toujours.
4. Toute table métier porte `organization_id` + policy RLS. Tester l'isolation inter-org à chaque nouvelle table.
5. Textes UI en français. Montants stockés en centimes (`_cents`). Dates en `timestamptz`.
6. Mobile-first : la moitié des utilisateurs sont sur téléphone de chantier.

## Commandes

- `npm run dev` / `npm run build` / `npm run lint`
- Typecheck : `npx tsc --noEmit`
