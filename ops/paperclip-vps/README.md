# Paperclip + Hermes Agents sur le VPS Hostinger

Objectif : la structure complète de Paperclip (tickets, budgets, gouvernance,
org chart) tournant sur ton VPS, avec des **agents Hermes de Nous Research**
comme workers, et reliée à BLEME (onglet « Ops » de la console admin).

Architecture cible :

```
┌──────────────── VPS Hostinger (Ubuntu) ────────────────┐
│                                                        │
│  Caddy (HTTPS + mot de passe) ── :443                  │
│    └─► Paperclip server ── 127.0.0.1:3100              │
│          ▲ heartbeat            (Postgres embarqué)    │
│    Hermes Agent gateway (worker Nous, systemd)         │
│                                                        │
└────────────────────────────────────────────────────────┘
         ▲ onglet « Ops » (PAPERCLIP_URL dans le coffre)
   BLEME console /admin — les tickets référencent des case_id,
   jamais le contenu des dossiers clients (qui reste sous RLS).
```

## 1. Prérequis sur le VPS

```bash
ssh root@IP_DU_VPS

# Node.js 22 (pour Paperclip)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Caddy (reverse proxy HTTPS automatique)
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy

# Pare-feu : seulement SSH + HTTPS
ufw allow OpenSSH && ufw allow 443/tcp && ufw enable
```

## 2. Paperclip

```bash
# Utilisateur dédié (jamais root pour un service exposé)
useradd -m -s /bin/bash paperclip
su - paperclip
npx -y paperclipai onboard --yes   # config par défaut : loopback :3100, Postgres embarqué
exit
```

Service systemd : copier `paperclip.service` (dans ce dossier) vers
`/etc/systemd/system/paperclip.service`, puis :

```bash
systemctl daemon-reload
systemctl enable --now paperclip
systemctl status paperclip   # doit afficher "Server listening on 127.0.0.1:3100"
```

## 3. HTTPS + mot de passe (Caddy)

Pointer un sous-domaine (ex. `ops.tondomaine.fr`) vers l'IP du VPS (champ A),
puis copier `Caddyfile` vers `/etc/caddy/Caddyfile` en remplaçant le domaine,
et générer le hash du mot de passe d'accès :

```bash
caddy hash-password   # colle le résultat dans le Caddyfile
systemctl reload caddy
```

Paperclip n'écoute que sur 127.0.0.1 : tout passe par Caddy (HTTPS +
basic auth). Alternative sans domaine : Tailscale (`tailscale up`) et accès
via l'IP privée du tailnet, sans rien exposer publiquement.

## 4. Hermes Agent (le worker Nous)

```bash
su - paperclip
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
source ~/.bashrc
hermes setup    # provider : Nous Portal (OAuth) ou OpenRouter/endpoint custom
hermes model    # choisir un modèle Hermes 4
```

Endpoint OpenAI-compatible de Nous si tu préfères la clé API au OAuth :
`https://inference-api.nousresearch.com/v1` (clé `NOUS_API_KEY`, à ranger
dans le coffre BLEME /admin/cles).

Mode serveur (gateway) en systemd : copier `hermes-gateway.service` vers
`/etc/systemd/system/`, puis `systemctl enable --now hermes-gateway`.

## 5. Embaucher Hermes dans Paperclip

Dans l'UI Paperclip (`https://ops.tondomaine.fr`) :

1. Renommer le workspace en **BLEME** (Settings) et configurer le LLM
   provider (endpoint Nous ci-dessus) pour les fonctions internes de
   Paperclip.
2. **Agents → Create agent** → type agent externe/CLI : Paperclip fournit
   les identifiants de heartbeat (JWT) ; les renseigner côté Hermes
   (`hermes config set`) pour que l'agent apparaisse « alive » et récupère
   les tickets. « If it can receive a heartbeat, it's hired. »
3. Fixer le **budget mensuel** de chaque agent et activer les approbations :
   aucune action sortante sans validation, comme dans BLEME.

## 6. Relier à BLEME

Dans la console BLEME → Clés & API :

- `PAPERCLIP_URL` = `https://ops.tondomaine.fr` → l'onglet **Ops** apparaît
  dans la console admin.
- `NOUS_API_KEY` = ta clé Nous Portal (les workers Hermes la consomment).

Règle de frontière (docs/05-architecture.md) : les agents produit (Marius,
Léna…) restent sur le runtime `lib/ai` sous RLS ; Paperclip + Hermes gèrent
l'ops et les travaux de fond (vigie Phase 5, batchs, rapports). Les tickets
Paperclip transportent des identifiants (`case_id`), jamais le contenu des
dossiers clients.
