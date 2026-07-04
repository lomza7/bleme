# Configuration de l'authentification (Supabase + Google + Resend)

## 1. En local (déjà en place)

- `supabase start` lance le stack complet (`supabase/config.toml` pointe sur `http://localhost:4000`).
- La confirmation d'email est activée ; les emails sont capturés par **Mailpit** : http://127.0.0.1:54324
- Studio (base de données) : http://127.0.0.1:54323
- Les clés locales sont dans `.env.local` (générées par `supabase status`).
- Google OAuth ne fonctionne pas en local sans clés : le bouton renvoie une erreur propre. Pour le tester en local, ajouter dans `supabase/config.toml` :
  ```toml
  [auth.external.google]
  enabled = true
  client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
  secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
  redirect_uri = "http://127.0.0.1:54321/auth/v1/callback"
  ```
  et exporter les deux variables avant `supabase start`.

## 2. Projet Supabase cloud (production)

### Clés
Dashboard → Project Settings → API : reporter `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` dans les env Vercel.

### URLs de redirection
Authentication → URL Configuration :
- **Site URL** : `https://bleme.fr` (ou le domaine de prod)
- **Redirect URLs** : `https://bleme.fr/**`, plus les préviews Vercel si besoin (`https://*-bleme.vercel.app/**`)

### Migration
`supabase link --project-ref <ref>` puis `supabase db push` (applique `supabase/migrations/`).

## 3. Google OAuth (production)

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → **Create OAuth client ID** (type "Web application").
2. **Authorized redirect URI** : `https://<project-ref>.supabase.co/auth/v1/callback` (affichée dans Supabase → Authentication → Providers → Google).
3. Écran de consentement : nom BLEME, domaine, logo. Scopes par défaut (email, profile) : pas de vérification Google lourde nécessaire.
4. Supabase → Authentication → Providers → **Google** : coller Client ID + Secret, activer.
5. Rien à changer côté code : le bouton « Continuer avec Google » passe par `/auth/callback`.

Autres providers (Apple, Microsoft…) : même logique, un provider à activer côté Supabase et le composant `GoogleButton` à dupliquer.

## 4. Emails d'auth via Resend (production)

> ⚠️ **Pourquoi c'est indispensable** : le service email par défaut de Supabase
> n'envoie qu'aux adresses des **membres de l'équipe du projet** (et ~2
> emails/heure). Toute inscription d'un tiers échoue avec « error sending
> confirmation email » et l'utilisateur n'est même pas créé. Constaté le
> 05/07/2026 (compte gmail impossible à créer tant que le SMTP custom n'est
> pas branché). Resend exige de son côté un **domaine vérifié** (DNS
> SPF/DKIM) pour envoyer à n'importe qui.

Supabase envoie ses emails d'auth (confirmation, reset, magic link) par SMTP. Pour les faire partir via **Resend** :

1. Resend → Domains → ajouter `bleme.fr` (ou `mail.bleme.fr`), poser les DNS (SPF, DKIM) chez le registrar, attendre la vérification.
2. Resend → API Keys → créer une clé dédiée "supabase-smtp".
3. Supabase → Project Settings → Authentication → **SMTP Settings** :
   - Host : `smtp.resend.com`
   - Port : `465`
   - Username : `resend`
   - Password : la clé API Resend
   - Sender email : `compte@bleme.fr` · Sender name : `BLEME`
4. Authentication → **Email Templates** : passer les templates en français. Sujets recommandés :
   - Confirm signup : « Activez votre compte BLEME »
   - Reset password : « Choisissez un nouveau mot de passe »
   - Magic link : « Votre lien de connexion BLEME »
   Les templates doivent pointer vers `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<type>&next=…` (voir doc Supabase "Email templates with token_hash").
5. Les emails **applicatifs** (notifications de dossier, relances) partent eux directement par l'API Resend (`lib/services/email.ts`, `RESEND_API_KEY`).

## 5. Rate limits & sécurité

- Authentication → Rate Limits : garder les valeurs par défaut au début.
- Attack protection : activer la protection contre les mots de passe compromis (HaveIBeenPwned) une fois en prod.
- Le message de « mot de passe oublié » est volontairement identique que le compte existe ou non (anti-énumération) : ne pas le « corriger ».
