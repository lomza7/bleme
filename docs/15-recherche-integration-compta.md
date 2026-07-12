# Étape 15 — Recherche : intégration comptable (Pennylane d'abord)

> Recherche menée le 10/07/2026 (API Pennylane v2, panorama marché, points de
> branchement dans le code). Statut : **GO donné le 10/07/2026** — Phase A
> implémentée (décision 7 du 00-INDEX) ; demande de partenariat OAuth (Phase B)
> à envoyer. L'intégration compta figure déjà au plan en V2 /
> Phase 3 (`02-mvp.md` l.72 « gros levier GTM », `12-roadmap.md` « import
> factures → création dossier en 1 clic », KPI « inscriptions via intégrations
> > 20 % ») — l'avancer est un arbitrage de roadmap à dater.

## 1. L'idée produit

Le blème naît dans la compta : les factures, leurs échéances, leurs impayés et
les encaissements vivent dans le logiciel comptable de l'utilisateur. En s'y
connectant, BLEME :
1. **liste les factures impayées** (en retard / partiellement payées) ;
2. **crée un dossier pré-rempli en un clic** : client (nom, SIREN, email,
   adresse), montant, échéance, n° de facture, PDF joint en pièce ;
3. **détecte la rentrée d'argent** (facture passée « payée ») et **suggère** de
   solder le dossier — jamais de clôture automatique (symétrie avec l'Agent
   Email : « une promesse de paiement détectée ne marque jamais le dossier
   résolu toute seule »).

Positionnement de vente : « **ce qui se passe après l'échec des relances email
de votre logiciel** ». La relance email « gentille » est commoditisée
(Pennylane, Sellsy, Axonaut, Obat, Henrri en ont tous) ; le terrain de BLEME —
dossier, preuves, LRAR, mise en demeure, escalade, validation humaine loggée —
reste libre. À noter : Pennylane a déjà une intégration « Impayés.com » sur sa
marketplace — validation du besoin ET concurrent installé.

## 2. API Pennylane v2 — ce qui est confirmé (sources : pennylane.readme.io)

- **Auth, 3 modes** : Company API Token (self-service : Paramètres →
  Connectivité → Développeurs, scopes granulaires, expiration configurable,
  affiché une seule fois) ; Firm Token (cabinets) ; **OAuth 2.0 partenaire**
  (formulaire de demande, access token 24 h, refresh 90 j avec **rotation** —
  stockage atomique obligatoire). ⚠️ Le token exige un **plan Pennylane
  Essential ou supérieur** (pas d'onglet Développeurs sur Starter).
- **Scopes minimum BLEME** : `customer_invoices:readonly` +
  `customers:readonly` (lecture seule, à afficher comme gage de confiance).
- **Factures clients** : `GET /api/external/v2/customer_invoices` — champs
  clés : `status` (`late`, `upcoming`, `partially_paid`, `paid`…), `paid`
  (bool), `remaining_amount_with_tax`, `deadline`, `invoice_number`, `amount`
  (⚠️ **string en euros** → conversion `_cents`), `customer {id}`,
  `public_file_url` (**PDF, URL expirant en 30 min** → télécharger et stocker
  immédiatement côté BLEME). ⚠️ **Aucun filtre serveur sur paid/status** :
  on filtre `draft=false, credit_note=false` côté API puis impayées côté BLEME.
- **Clients** : `GET /customers/{id}` — nom, `reg_no` (SIREN), emails, adresse,
  `payment_conditions`. Recherche par SIREN possible (filtre `reg_no`).
- **Détection paiement** : les **webhooks sont en beta insuffisante** (aucun
  événement « facture payée ») → **polling des changelogs** :
  `GET /changelogs/customer_invoices?start_date=…` (rétention 4 semaines,
  limit 1000, curseur `processed_at`) puis re-fetch batch des ids modifiés et
  comparaison `paid`/`status`. Un poll par heure par org est très confortable.
  ⚠️ Un virement non rapproché dans Pennylane laisse `paid=false` : la
  confirmation humaine reste indispensable.
- **Rate limit** : 25 req / 5 s / token (headers `ratelimit-*`).
- **Sandbox** : chaque compte peut créer un environnement de test (token API
  possible si le workspace est Essential+) ; les partenaires OAuth demandent
  un sandbox à l'équipe Partnerships.
- **v2 uniquement** (v1 dépréciée fin 2025 ; changements 2026 déjà en vigueur).

## 3. Marché (qui a une API, qui utilise quoi)

- **Pennylane : n°1 validé** — 800 000 entreprises (×3 en 2025), levée 175 M€
  (janv. 2026, valo 3,5 Md€), meilleure API self-service du marché français.
  Nuance : l'artisan BTP y arrive **via son expert-comptable** (canal de
  distribution central) — l'activation se vendra « connectez votre compta »
  plus que « votre outil de facturation ».
- **Suivants exploitables** : **Axonaut** (API publique simple, cible
  TPE/BTP), **Sellsy** (API v2 OAuth mûre). **Chift** (agrégateur, 90+
  connecteurs dont Pennylane/Sellsy/Axonaut/EBP — prix sur devis) en option
  d'accélération.
- **Sans API** (couvrir via l'intake existant : upload / email de PDF) : les
  verticaux BTP (Obat, Tolteck, Batappli, Costructor), Indy, Tiime (API sur
  partenariat seulement), Abby, Henrri. À surveiller : la réforme
  e-facturation (réception sept. 2026, émission TPE sept. 2027) fera transiter
  les factures par des Plateformes Agréées = futur point d'accès standardisé.

## 4. Architecture proposée (alignée sur l'existant)

- **Connexion** : table `org_integrations` (organization_id + provider,
  métadonnées lisibles sous RLS org : statut, dernier sync, curseur
  changelog) + secret (token) accessible **service-role uniquement**, chiffré
  AES-GCM avec clé maîtresse via `getSecret()` — précédent : `email_accounts`
  V2 prévoyait `refresh_token_encrypted`. UI : section « Connexions » dans
  `/app/parametres` (entre « Mon entreprise » et « Zone sensible »').
- **Sync** : cron applicatif à créer (`vercel.json` + route protégée par
  secret — première infra cron du projet) qui itère les orgs connectées :
  changelogs → re-fetch batch → upsert. Idempotence par id Pennylane.
- **Factures détectées** : surface dédiée (l'URL `/app/factures` est PRISE —
  factures BLEME ; candidate : intégrer à `/app/envois` (Suivi) ou page
  `/app/impayes`), items avec statut, échéance dépassée, reste à payer.
- **Création de dossier en 1 clic** : nouvelle action type
  `createCaseFromInvoice` (il n'existe pas de `createCase` générique — seule
  `createCaseFromDraft` existe) : insert `cases` (⚠️ CHECK `cases.source` à
  étendre : + `'pennylane'`), PDF téléchargé → bucket `documents` +
  `doc_kind: 'facture'` (fait avancer la checklist), toutes les valeurs
  importées **sourcées « Pennylane » et éditables** (la correction utilisateur
  prime — pilier #3), puis `touchCase`.
- **Paiement détecté** : notification (cloche + email, `notifyOrganization`) +
  case_event — l'utilisateur confirme via `recordPayment` (qui solde le
  dossier quand recovered ≥ claimed). **Jamais d'auto-résolution.**
- **Garde-fous produit** : pas d'import de masse (« portefeuilles CSV de 500
  factures = un autre produit », PRD §11) — l'unité reste « une facture → un
  dossier » ; minimisation RGPD (n'importer que les factures utiles, pas la
  compta entière) ; aucun envoi sans validation `approval_logs`.

## 5. Phasage proposé

- **Phase A — MVP (token collé)** : l'utilisateur colle son Company API Token
  (guide illustré : Paramètres → Connectivité → Développeurs, Read only).
  Livrables : connexion + liste des impayées + dossier en 1 clic + détection
  paiement par polling. Développable dès qu'on a un compte Essential+ avec
  sandbox pour tester.
- **Phase B — OAuth « Se connecter avec Pennylane »** : demande partenariat à
  envoyer TÔT (délais non publiés) via
  pennylane.com/fr/contact-demande-de-partenariat — l'UX passe de « coller un
  token » à un clic, et ouvre la marketplace Pennylane (canal d'acquisition).
- **Phase C — élargissement** : Axonaut puis Sellsy en direct, ou Chift si le
  devis est raisonnable ; verticaux BTP via intake PDF en attendant la réforme
  e-facturation.

## 6. Décisions à acter (avant de coder — gouvernance 00-INDEX)

1. **Avancer l'intégration compta de la Phase 3 à maintenant** (roadmap : « tout
   ajout = un retrait » — dire ce qu'on décale).
2. **Pricing** : décision actée le 12/07 — l'intégration/API est un perk du
   plan Pro 9 € (rétention), avec 1 dossier inclus par mois et dossiers
   supplémentaires à 10 € HT. `00-INDEX.md` et `09-pricing.md` sont alignés en
   v3.
3. **Périmètre détection de paiement** : nouveau périmètre documentaire (le PRD
   ne couvre que la détection par mention email) — à écrire dans `03-prd.md` +
   `08-workflows.md` si acté.
4. **Lancer la demande de partenariat OAuth** dès maintenant (coût nul,
   débloque la Phase B pendant qu'on développe la Phase A).

Prérequis pratique pour développer : un compte Pennylane **Essential+** (ou
essai) + sandbox + token de test.
