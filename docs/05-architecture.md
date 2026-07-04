# Étape 5 — Architecture produit et technique

## Principe directeur

Un monolithe Next.js + Supabase, des jobs asynchrones simples, des agents IA qui sont **des fonctions avec des prompts** (pas une infra distribuée). Toute la complexité doit être dans la qualité des prompts et de l'UX, pas dans la plomberie.

## Mises au point sur la stack envisagée

| Choix envisagé | Verdict | Remplacement / précision |
|---|---|---|
| Next.js + Vercel + Supabase + GitHub | ✅ Parfait pour ce produit | App Router, TypeScript, Tailwind + shadcn/ui |
| **Wispr** pour la voix | ❌ Wispr Flow est une app de dictée desktop, pas une API intégrable | MediaRecorder navigateur → upload audio → **Whisper API ou Deepgram** (fr excellent, ~0,006 $/min) |
| **Agent Hermes** (agents spécialisés) | ⚠️ OK comme couche d'orchestration si tu l'as déjà | Les agents restent des fonctions TypeScript appelant Claude (voir [07-agents-ia.md](07-agents-ia.md)) ; Hermes ne doit pas être un prérequis au MVP |
| **Paperclip** (workflows) | ⚠️ Même logique | V1 : Vercel Cron + table `tasks` + Supabase Queues suffisent. Brancher Paperclip quand les workflows se complexifient (V2) |
| API La Poste | ⚠️ En pratique on passe par un intermédiaire : **Merci Facteur API** (retenu) | V1 : PDF prêt à poster ; V1.5 : API Merci Facteur |
| Obsidian pour les playbooks | ✅ Mais hors produit | Les playbooks vivent en markdown dans le repo (`playbooks/`), versionnés Git ; Obsidian = ton éditeur |
| Cloudflare R2 | ➖ Pas en V1 | Supabase Storage suffit largement ; R2 si les coûts de stockage deviennent réels (V3) |

## Vue d'ensemble

```
┌────────────────────────── Vercel ──────────────────────────┐
│  Next.js App Router                                         │
│  ├── UI (React Server Components + client components)       │
│  ├── API Routes /api/*  (actions, webhooks, uploads)        │
│  ├── Vercel Cron  (relances, rappels, échéances)            │
│  └── lib/agents/* (fonctions IA → Claude API)                │
└──────┬──────────────┬───────────────┬───────────────────────┘
       │              │               │
┌──────▼─────┐  ┌─────▼──────┐  ┌─────▼─────────────────────┐
│  Supabase  │  │ Anthropic  │  │  Services externes         │
│  Postgres  │  │ Claude API │  │  Deepgram/Whisper (voix)   │
│  Auth      │  │ (agents,   │  │  Resend (email out+in)     │
│  Storage   │  │ extraction)│  │  Stripe (billing)          │
│  RLS       │  └────────────┘  │  Merci Facteur (reco V1.5) │
│  pgvector  │                  │  API Sirene (entreprises)  │
└────────────┘                  └────────────────────────────┘
```

## Frontend

- **Next.js App Router**, TypeScript strict, Tailwind CSS v4 + shadcn/ui, mobile-first (la moitié des utilisateurs seront sur téléphone).
- Server Components pour les lectures (dashboard, dossier), Server Actions ou API routes pour les mutations.
- Enregistrement vocal : `MediaRecorder` (webm/opus, fallback mp4 sur Safari), upload par chunks vers Supabase Storage, indicateur de progression "2-5 min".
- État : rien de global compliqué — React Query (TanStack) pour le cache client, Supabase Realtime uniquement pour la boîte email du dossier et le statut des jobs IA.

## Backend

- **Pas de backend séparé** : API routes Next.js + fonctions Postgres. Ce produit n'a pas besoin de microservices.
- Jobs asynchrones (transcription, extraction, génération) : pattern **table `jobs` + Supabase Queues (pgmq)**, workers = API routes invoquées par cron/après-upload, idempotentes, avec retry et statut visible côté UI ("Analyse en cours…").
- Vercel Cron : toutes les 15 min → échéances de relances, rappels, détection de dossiers dormants.
- Validation systématique des entrées avec Zod, y compris sur les webhooks.

## Supabase

- **Auth** : email/password + magic link. `auth.users` → table `profiles` + `organizations` (une org par compte en V1, structure multi-user prête).
- **Postgres** : schéma détaillé dans [06-modele-donnees.md](06-modele-donnees.md).
- **RLS partout, sans exception** : chaque table métier porte `organization_id`, policy `organization_id = (select org du user courant)`. Le service role n'est utilisé que par les workers (jamais exposé au client).
- **Storage** : buckets `documents` (privé), `audio` (privé, purgé après transcription validée + 30 j), `exports` (privé, URLs signées 1 h). Chemins préfixés par `org_id/case_id/` — la policy Storage vérifie le préfixe.
- **pgvector** : embeddings des documents et emails par dossier (recherche sémantique "retrouve les échanges où il accepte le devis"). V1 : nice-to-have, activer seulement si le temps le permet.

## Gestion email entrant

- Domaine dédié `dossiers.bleme.fr` (isolé du domaine marketing pour la réputation).
- **Resend** : envoi (relances, notifications) ET réception (inbound webhook) chez le même provider = un seul SPF/DKIM/DMARC à soigner.
- Flux entrant : email → Resend inbound → `POST /api/webhooks/email-inbound` (vérif signature) → matching `to` → `cases.inbound_email` → création `email_messages` + extraction des PJ en `documents` → job "Agent Email" (résumé + classification de la réponse) → notification utilisateur.
- Expéditeur inconnu → quarantaine (`email_messages.status = 'quarantined'`), l'utilisateur valide ("oui c'est mon client") et l'expéditeur devient une partie autorisée.

## Transcription vocale

Audio uploadé → job `transcribe` → Deepgram nova-2 fr (ou Whisper) → transcript stocké (`voice_intakes`) → Agent Intake (résumé structuré + questions de relance + avocat du diable) → l'utilisateur corrige le résumé → le résumé validé devient la source du dossier. Latence cible : < 30 s pour 5 min d'audio (transcription en streaming si possible).

## Génération PDF

- Courriers (relance, MED) : template React → **@react-pdf/renderer** (léger, serverless-friendly). Pas de Puppeteer sur Vercel en V1 (froid, lourd).
- Export dossier : PDF de synthèse (même moteur) + ZIP streamé (archiver) : `01-synthese.pdf`, `02-bordereau-pieces.pdf`, `pieces/`, `courriers/`, `emails/`.
- Chaque PDF engageant est archivé tel qu'envoyé (immuable) dans Storage + hash SHA-256 en base (preuve d'intégrité).

## Envoi recommandé

V1 : bouton "Télécharger la MED prête à poster" + checklist + saisie du n° de suivi → le cron suit l'état via lien public La Poste (ou saisie manuelle des statuts). V1.5 : `POST` Merci Facteur → `postal_shipments` avec statuts webhook (déposé/distribué/avisé/retourné), AR archivé en document.

## Sécurité & permissions

- RLS comme périmètre principal ; middleware Next.js pour les routes ; service role confiné aux workers.
- Rôles V1 : `owner` (client), `admin` (interne BLEME). Structure `organization_members(role)` prête pour le multi-user V2.
- Secrets sur Vercel env ; webhooks signés (Stripe, Resend) ; rate limiting (Upstash) sur les routes coûteuses (upload, IA, auth).
- Antivirus léger sur upload (validation MIME réelle + taille) ; les documents ne sont jamais servis en direct, uniquement en URL signée courte.

## Audit trail & validation utilisateur

Deux tables dédiées (voir modèle de données) :
- `approval_logs` : chaque validation d'envoi = user, dossier, lettre, **hash du contenu validé**, IP, user-agent, horodatage. C'est la preuve que l'humain a validé — pilier de la position juridique de BLEME.
- `audit_logs` : événements système et accès support (qui a lu quoi, quand, pourquoi).
Règle absolue : **aucun envoi sortant (email de relance, MED, recommandé) sans ligne dans `approval_logs`** — contrainte applicative + vérification dans le worker d'envoi.

## Observabilité

Sentry (front + API), logs structurés (pino) avec `case_id`/`org_id`, table `agent_runs` pour tracer chaque appel IA (prompt version, tokens, coût, durée, sortie) → indispensable pour piloter le coût IA par dossier (< 3 € cible).
