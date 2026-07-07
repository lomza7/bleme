# Connecter le domaine `bleme.fr` (registrar Hostinger)

Guide de mise en service. Choix retenu : **DNS gardé chez Hostinger**, **Resend pour l'envoi ET la réception**, **Vercel pour le site**. Pas de Cloudflare, pas de changement de nameservers.

`bleme.fr` sert **trois rôles** :

1. **Le site** — `bleme.fr` + `www.bleme.fr` → l'app sur Vercel.
2. **Recevoir** les emails que les clients transfèrent → `dossiers.bleme.fr`, via **Resend Inbound** (catch-all) → webhook `app/api/inbound/email`.
3. **Envoyer** les emails de BLEME → **Resend**, depuis `notifications@dossiers.bleme.fr`.

## Pourquoi ce choix (vs Cloudflare Email Routing)

- **Un fournisseur de moins, zéro migration DNS.** On ne déplace pas les nameservers (l'opération la plus risquée). Resend est déjà dans la stack pour l'envoi.
- **Moins de code** : pas de Worker séparé à écrire/déployer, un seul webhook. La **vérification de signature est native (Svix)** et correspond au `RESEND_INBOUND_SECRET` déjà prévu dans le code.
- **Catch-all natif** : toute adresse `*@dossiers.bleme.fr` arrive sur le webhook → nos adresses par organisation `b-xxxx@dossiers.bleme.fr` marchent sans configuration par adresse.
- **Réversible** : débrancher = retirer une ligne MX.

**Deux réserves à intégrer dès le code :**
1. **Le webhook `email.received` ne contient que des MÉTADONNÉES** (from/to/subject/`email_id`/refs de PJ), pas le corps ni les octets des pièces jointes. Il faut un 2ᵉ appel : **Received Emails API** (`emails.receiving.get(email_id)`) pour le corps, **Attachments API** pour les PJ.
2. **RGPD / résidence des données** : Resend Inbound transite et stocke par **AWS `us-east-1` (États-Unis)**, quelle que soit la région d'envoi, avec **rétention 30 jours** côté Resend. → (a) recopier corps + PJ dans **Supabase Storage dès réception** ; (b) inscrire ce traitement au registre RGPD + signer le DPA Resend. Si la résidence UE devient un impératif dur, c'est le seul motif de réévaluer (un provider inbound UE type Mailgun EU serait alors l'alternative) — mais l'app envoie déjà via Resend et analyse via des modèles hors-UE, donc c'est cohérent avec la posture actuelle.

## Schéma de nommage (aucun changement d'adresse email dans l'app)

| Rôle | Nom | Géré par |
|---|---|---|
| Site web | `bleme.fr`, `www.bleme.fr` | Vercel (DNS Hostinger) |
| Réception clients | `b-xxxx@dossiers.bleme.fr` | Resend Inbound (catch-all) |
| Envoi BLEME | `notifications@dossiers.bleme.fr` | Resend |
| Boîte humaine (option, plus tard) | `contact@bleme.fr` | au choix |

Réception (MX sur `dossiers.bleme.fr`) et envoi (retour/SPF sur `send.dossiers.bleme.fr`, DKIM sur `resend._domainkey.dossiers.bleme.fr`) cohabitent : noms d'enregistrements différents, un seul MX par nom (règle Hostinger respectée).

---

## Étape 1 — Le site sur Vercel (DNS chez Hostinger)

1. Vercel → Projet → **Settings → Domains** → ajouter `bleme.fr` **et** `www.bleme.fr` ; noter les valeurs exactes affichées ; régler la redirection `www` ↔ apex.
2. Hostinger → hPanel → **DNS / Nameservers → Gérer les enregistrements** :

| Type | Nom | Valeur |
|---|---|---|
| A | `@` (apex) | l'IP exacte affichée par Vercel (ex. `76.76.21.21`) |
| CNAME | `www` | la valeur par projet affichée par Vercel (ex. `xxxx.vercel-dns-017.com`) |

   (Hostinger interdit un CNAME à l'apex → A obligatoire, c'est ce que Vercel demande.) Attendre que Vercel passe en **Valid Configuration** + certificat SSL OK (automatique, pas de proxy). Baisser le TTL (ex. 300 s) avant la bascule aide à propager vite.

## Étape 2 — Envoi (Resend) — probablement déjà fait

1. Resend → **Domains → Add Domain** → `dossiers.bleme.fr` → **région EU** (`eu-west-1`) pour l'envoi.
2. Ajouter chez Hostinger les enregistrements affichés par Resend (**copier les valeurs exactes**, la clé DKIM est unique) :

| Type | Nom | Valeur | Priorité |
|---|---|---|---|
| MX | `send.dossiers` | `feedback-smtp.<région>.amazonses.com` | 10 |
| TXT (SPF) | `send.dossiers` | `v=spf1 include:amazonses.com ~all` | — |
| TXT (DKIM) | `resend._domainkey.dossiers` | `p=…` (copier depuis Resend) | — |
| TXT (DMARC) | `_dmarc.dossiers` | `v=DMARC1; p=none; rua=mailto:dmarc@bleme.fr;` | — |

   Cliquer **Verify** → `verified`.

## Étape 3 — Réception (Resend Inbound)

1. Resend → activer **Receiving** sur `dossiers.bleme.fr` (domaine déjà vérifié à l'étape 2 → rien à re-vérifier).
2. Ajouter chez Hostinger l'**unique MX de réception** (valeur/priorité exactes depuis Resend) :

| Type | Nom | Valeur | Priorité |
|---|---|---|---|
| MX | `dossiers` | `inbound-smtp.us-east-1.amazonaws.com` | 10 |

3. Resend → **Webhooks** → ajouter un endpoint `https://bleme.fr/api/inbound/email`, événement **`email.received`**. Copier le **Signing Secret** → le poser dans `/admin/cles` sous `RESEND_INBOUND_SECRET`.

Le catch-all est implicite : tout `*@dossiers.bleme.fr` déclenche le webhook ; BLEME retrouve l'organisation via le champ `to` / `received_for` (le local-part = `inbox_slug`).

## Étape 4 — Supabase (liens des emails d'auth)

1. **Authentication → URL Configuration** : Site URL `https://bleme.fr` ; Redirect URLs `https://bleme.fr/**`, `https://www.bleme.fr/**`, `https://*-<slug>.vercel.app/**`, `http://localhost:3000/**`.
2. **Authentication → SMTP Settings** → Custom SMTP : Host `smtp.resend.com`, Port `465`, User `resend`, Password = clé API Resend, Sender `notifications@dossiers.bleme.fr`, Nom `BLEME`. Remonter les rate limits email.

## Étape 5 — App / config (côté code)

- **Vercel env (Production)** : `NEXT_PUBLIC_APP_URL=https://bleme.fr`, `RESEND_API_KEY` → **redéployer** (`NEXT_PUBLIC_*` figées au build).
- URL canonique en dur `https://bleme-two.vercel.app` → `https://bleme.fr` (8 fichiers SEO : `app/layout.tsx`, `app/robots.ts`, `app/sitemap.ts`, `app/page.tsx`, `components/seo/json-ld.tsx`, `app/agents/[slug]/page.tsx`, `app/guides/page.tsx`, `components/guides/guide-shell.tsx`), idéalement centralisée sur une constante.
- Vault `/admin/cles` : `RESEND_INBOUND_SECRET`.

## Webhook de réception (à implémenter — Phase B, côté nous)

`app/api/inbound/email/route.ts` (runtime Node, POST, non authentifié) :
1. Lire le **raw body**, vérifier la signature **Svix** (`svix-id`/`svix-timestamp`/`svix-signature`) via `resend.webhooks.verify()` ou le paquet `svix`, contre `getSecret("RESEND_INBOUND_SECRET")`. Échec → 401.
2. Événement `email.received` : lire `to`/`received_for` → local-part → résoudre `organization_id` via `organizations.inbox_slug` (service client). Inconnu → 200 `{ignored}`. Idempotence via `email_id`/`message_id`.
3. Récupérer le **corps** (`emails.receiving.get(email_id)`) et les **pièces jointes** (Attachments API → base64) ; les uploader dans Supabase Storage `{orgId}/inbox/…` **immédiatement** (rétention Resend = 30 j).
4. Insérer `inbox_items` (source `email`, from/subject/body_text/message_id) + `inbox_attachments`. → l'email suit ensuite le flux Phase A (verser au dossier → analyse IA → fusion).

## DNS — état final (tout chez Hostinger)

| Type | Nom | Valeur | Rôle |
|---|---|---|---|
| A | `@` | IP Vercel | site |
| CNAME | `www` | valeur Vercel | site |
| MX | `dossiers` | `inbound-smtp.us-east-1.amazonaws.com` (prio 10) | réception |
| MX | `send.dossiers` | `feedback-smtp.<région>.amazonses.com` (prio 10) | retour envoi |
| TXT | `send.dossiers` | `v=spf1 include:amazonses.com ~all` | SPF envoi |
| TXT | `resend._domainkey.dossiers` | `p=…` | DKIM envoi |
| TXT | `_dmarc.dossiers` | `v=DMARC1; p=none; rua=mailto:dmarc@bleme.fr;` | DMARC |

## Ordre & pièges

1. Site Vercel (A + CNAME chez Hostinger) → SSL OK.
2. Resend envoi vérifié → puis activer réception + MX + webhook.
3. App : `NEXT_PUBLIC_APP_URL` + URLs canoniques + redeploy ; Supabase Site URL/redirects + SMTP.
4. Test bout en bout : inscription/reset (liens en `bleme.fr`), puis email transféré → boîte → analyse → dossier. Vérifier SPF+DKIM+DMARC (mail-tester.com).

Pièges : apex = A (jamais CNAME) ; `NEXT_PUBLIC_APP_URL` ne s'applique qu'après redeploy ; copier les valeurs exactes (DKIM Resend, IP/CNAME Vercel, priorité MX) depuis les dashboards ; un seul `v=spf1` par nom.
