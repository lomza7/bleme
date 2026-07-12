# Passation — Adresse email par dossier (routage déterministe des réponses)

> Document de passation pour reprendre la feature avec un autre outil/modèle.
> Écrit le 2026‑07‑12. **Tout le code est déjà dans l'arbre de travail Git (non commité)** :
> `git status` / `git diff` montrent l'intégralité. Rien n'est poussé, rien n'est en prod.
> État : code écrit, `npx tsc --noEmit` **OK**, `npm run lint` **OK**. Migration NON poussée (gate).
> Revue adversariale **FAITE** : 5 findings confirmés — **aucun ne viole le pilier #1**. Les **3 correctifs sont APPLIQUÉS** (idempotence sur `email_id`, course double‑brouillon, boucle de résolution du jeton) ; `tsc`+`lint` OK. Détail dans la section « Revue adversariale » ci‑dessous (marqués ✅). **2e migration** ajoutée : `20260712120000_inbox_email_id.sql` (colonne `inbox_items.email_id` + index unique).

## Où trouver les infos
1. **Le code** : `git diff` + les 2 nouveaux fichiers (`git status`). C'est la source de vérité.
2. **Ce document** : le quoi/pourquoi + ce qui reste.
3. **Les conventions projet** : `CLAUDE.md` + `AGENTS.md` (Next.js 16 aux conventions renommées ; règles non négociables #1–#6).
4. Non portable (ne pas chercher) : specs/revues générées en session, mémoire de l'assistant.

## Objectif
Aujourd'hui, un courrier de dossier part par email avec `Reply-To = <inbox_slug>@dossiers.bleme.fr`
(adresse **par organisation**). Le routage réponse→dossier est **heuristique** (In‑Reply‑To/References,
puis expéditeur+« Re: »), donc fragile : compose neuf, transfert, en‑têtes retirés, même débiteur sur 2 dossiers.

**On passe à une adresse UNIQUE PAR DOSSIER** → routage **déterministe** :
`Reply-To = <inbox_slug>+<inbox_token>@dossiers.bleme.fr` (plus‑addressing). À la réception, on parse le
token, on route directement vers CE dossier, on classe, on notifie « Réponse reçue », et on **lance
l'analyse = un BROUILLON de réponse adaptée** (jamais d'envoi — pilier juridique #1). Le From reste stable
(`notifications@dossiers.bleme.fr`) pour la délivrabilité ; le token ne voyage que dans le Reply‑To.

## Stack email (existant, inchangé)
- Provider **Resend** (envoi + réception + webhooks signés Svix).
- Domaine entrant `dossiers.bleme.fr` en **catch‑all** → webhook `app/api/inbound/email/route.ts`.
  L'org est résolue par `inbox_slug` = partie locale du destinataire. **Aucune infra nouvelle** : le
  plus‑addressing passe par le catch‑all existant.
- `CASE_EMAIL_DOMAIN` dans `lib/env.ts` (serverEnv, défaut `dossiers.bleme.fr`).

## Fichiers changés
| Fichier | Rôle |
|---|---|
| `supabase/migrations/20260712110000_case_inbox_token.sql` (**new**) | Colonne `cases.inbox_token text not null default replace(gen_random_uuid()::text,'-','')` + index unique. Le DEFAULT volatil **backfill tous les dossiers existants** au ALTER et couvre tous les futurs inserts sans trigger. RLS héritée de `cases` (aucune policy à ajouter). |
| `lib/cases/reply-draft.ts` (**new**) | `draftAdaptedResponseCore(sb, orgId, orgName, caseId, replyBodyText, opts?)` — cœur `server-only` SANS session (extrait de `generateAdaptedResponse`). Produit UNIQUEMENT `letter status='draft'` + `case_event 'letter_ready'`. N'atteint JAMAIS `approveAndSendLetter`/`dispatchLetter`/`sendEmail`. Agents : `lena` (litige) / `basile` (admin) / `marius` (impayé). Garde‑fou #2 `hasAdvice`. `opts.onProgress` = progression UI optionnelle. |
| `lib/cases/replies.ts` (mod) | `generateAdaptedResponse` devient un **wrapper** : session → dernier `debtor_replies` non‑handled → `draftAdaptedResponseCore(...)` avec `onProgress=setGenerationProgress` → marque handled → `touchCase` → `revalidatePath`. Comportement UI préservé. Imports morts retirés (`runAgent`, `hasAdvice`, `caseMemo`, `LETTER_KINDS`, `euros` local). |
| `lib/cases/letters.ts` (~720/~805) | `select` ajoute `inbox_token` ; `Reply-To = <slug>+<token>@…` avec **repli slug‑seul** si `inbox_token` absent (dossiers legacy) ; From inchangé. |
| `app/api/inbound/email/route.ts` | (a) `parsePlusTag(local)` ; (b) boucle de résolution org capture `base`+`token` ; (c) `tokenCaseId` résolu **org‑scopé** (`.eq('organization_id', orgId).eq('inbox_token', token)`) → garde‑fou inter‑org ; (d) `inbox_items.case_id = tokenCaseId` ; (e) token = **voie primaire** de `repliedLetter` (heuristiques In‑Reply‑To/expéditeur gatées sur `!tokenCaseId`) ; (f) effets (jalon/`case_event`/notif/webhook `reply.received`) routés sur `caseId = tokenCaseId ?? repliedLetter?.case_id`, **y compris sans lettre envoyée** ; (g) sur token certain : insert `debtor_replies` + `after(() => draftAdaptedResponseCore(...))` (brouillon en arrière‑plan, hors chemin d'accusé Resend). |

## Fait
- Code écrit + **`tsc` OK** + **`lint` OK**.
- `inbox_items.case_id` (colonne existante depuis `20260705120000_inbox.sql`) enfin remplie.
- `reply.received` déjà au catalogue webhooks (`lib/webhooks/events.ts`).

## Reste à faire (ordonné)
1. **Migration `db push`** — ⚠️ base liée = **PROD** : **valider avec Louis avant** (règle projet). La migration doit passer **avant** le déploiement du code sortant (`letters.ts` lit `inbox_token`). L'inbound est rétrocompatible (token nul → heuristiques).
2. **Finaliser la revue adversariale** (voir checklist ci‑dessous) et corriger les findings.
3. **Vérifier le plus‑addressing Resend** (avant prod) : le webhook (`data.received_for` / `data.to`) doit bien porter la partie locale complète `slug+token` non dé‑plussée, et le catch‑all matcher sur le **domaine**. Sinon adapter `parsePlusTag`/`localPart`.
4. Décider les **knobs produit** (défauts actuels indiqués) :
   - Analyse auto = **brouillon de réponse** (`draftAdaptedResponseCore`) vs simple analyse de faits (`analyzeEmailForCase`). *Défaut : brouillon.*
   - Quel agent : `lena/basile/marius` selon `case_type`. *Défaut : réutilise `replies.ts`.*
   - Exposer l'adresse par dossier dans l'UI (page dossier, transfert manuel de docs → dossier) ? *Défaut : NON, adresse interne au Reply‑To.*
   - Coût : un brouillon IA par réponse entrante — OK ? sinon throttle.

## Revue adversariale — 5 findings CONFIRMÉS → **3 correctifs APPLIQUÉS** ✅
> Revue faite le 12/07. **Aucun ne viole le pilier #1** (l'analyse ne produit que des brouillons, jamais d'envoi). Les 3 correctifs ci‑dessous sont **déjà dans le `git diff`** (tsc+lint OK) — ne pas les re‑appliquer.

### ✅ Correctif A (APPLIQUÉ) — Idempotence sur `data.email_id`, pas le Message‑ID expéditeur (findings 1 HIGH, 2 MEDIUM, 4 LOW)
**Bug** : l'idempotence repose sur le Message‑ID RFC, **contrôlé par l'expéditeur** (`route.ts:111` `if (data.message_id)`). Un auto‑répondeur / MUA mal formé l'omet → dédup sautée ; l'index unique est **partiel** (`… where message_id is not null`, `20260707120000_inbox_email_inbound.sql:72-74`) donc deux NULL ne collisionnent pas. Resend re‑livre (at‑least‑once) → nouvel `item.id` → le gate `fresh` (clé sur `inbound:${item.id}`) ne matche jamais → **tout se duplique** : 2e inbox_item, case_event, **notification email**, webhook `reply.received`, `debtor_reply`, **brouillon + run LLM payant**. Le chemin token‑sans‑lettre (`fresh` reste `true` inconditionnel, `route.ts:305`) n'a même aucun filet local.
**Fix** : ancrer sur `data.email_id` (id Resend, **toujours présent**, non contrôlé par l'expéditeur ; déjà utilisé `route.ts:~141/~187`).
- Migration : `alter table public.inbox_items add column if not exists email_id text;` + `create unique index if not exists inbox_items_org_email_idx on public.inbox_items (organization_id, email_id) where email_id is not null;`
- `route.ts` : étape 3 → déduper sur `(organization_id, email_id)` **inconditionnellement** ; ajouter `email_id: data.email_id ?? null` à l'insert `inbox_items` ; le garde `23505` (route.ts insErr) couvre alors rejeu ET concurrence. (Garder `message_id` pour le threading, mais ne plus en dépendre pour la dédup.)

### ✅ Correctif B (APPLIQUÉ) — Course UI↔webhook = double brouillon (finding 3, LOW)
**Bug** : le webhook insère `debtor_replies(handled:false)` puis rédige dans `after()` ; si l'utilisateur clique « générer la réponse » entre‑temps, l'UI (`generateAdaptedResponse`) charge le même retour non‑handled et rédige aussi → 2 brouillons.
**Fix** : **claim atomique** de `handled` AVANT de rédiger, des deux côtés :
`const { data: claimed } = await sb.from("debtor_replies").update({ handled: true }).eq("id", replyId).eq("handled", false).select("id").maybeSingle(); if (!claimed) return;` puis relâcher (`handled:false`) si la rédaction échoue. Côté webhook `after()` ET côté wrapper `replies.ts` (y déplacer le marquage `handled` AVANT l'appel au core).

### ✅ Correctif C (APPLIQUÉ) — Jeton perdu si un destinataire du même slug sans jeton est itéré en premier (finding 5, LOW)
**Bug** : la boucle de résolution (`route.ts:~93-106`) `break` au 1er slug matché ; si `received_for`/`to` contient `slug@…` (sans jeton) avant `slug+token@…`, le jeton est perdu → retombe en heuristique.
**Fix** : préférer un destinataire **porteur de jeton** : sur match org avec `token` non nul → set + break ; sur match sans token → mémoriser en repli (org seule), continuer ; après la boucle, n'utiliser le repli que si aucun porteur de jeton.

## Checklist de vérification (invariants NON négociables)
- **#4 Isolation inter‑org (CRITIQUE)** : email `to: slugA+tokenB@…` (slug d'org A, token d'un dossier d'org B) → `tokenCaseId` doit être **null** (le `.eq('organization_id', A).eq('inbox_token', tokenB)` ne matche pas) → aucun classement/notif sur le dossier de B. Toutes les écritures webhook portent `orgId` (résolu par le slug), y compris `draftAdaptedResponseCore(sb2, orgId, …)`.
- **#1 Aucun envoi auto** : le chemin d'analyse n'atteint QUE `letter status='draft'` + `case_event 'letter_ready'`. Jamais `approveAndSendLetter`/`dispatchLetter`/`sendEmail`, ni directement ni via `runAgent`/`touchCase`/`caseMemo`. La notif email « Réponse reçue » va aux **membres de l'org**, pas au débiteur.
- **Idempotence** : rejeu même `message_id` → dédup amont (`inbox_items` étape 3) → pas de 2e `inbox_item`/`debtor_reply`/brouillon/notif. Attention si `message_id` absent (pas de dédup). Le brouillon est gaté sur `fresh`.
- **Délivrabilité** : From stable, token uniquement dans Reply‑To.
- **Non‑régression** : `parsePlusTag` gère (pas de `+`, plusieurs `+` → coupe au 1er, `+` final sans token → null, casse). Dossier legacy sans token → Reply‑To slug‑seul (pas de `<slug>+@` malformé). Le wrapper `generateAdaptedResponse` préserve la progression UI + handled + touch + revalidate. Branche postale (LRAR) inoffensive au Reply‑To.

## Détails d'implémentation à connaître
- `draftAdaptedResponseCore` **ne peut pas** vivre dans `replies.ts` (`"use server"` : un `SupabaseClient` ne traverse pas la frontière server‑action) → d'où le nouveau fichier `server-only`.
- `touchCase` est `server-only` + `createServiceClient()` interne + `after()` → appelable depuis le webhook ; son `after()` interne (refresh brief) est best‑effort si imbriqué, non critique.
- L'`after()` du webhook lance l'agent (jusqu'à ~110 s) hors chemin d'accusé Resend — confirmer que `after()` s'exécute sur le plan Vercel utilisé (runtime `nodejs`).
