# 16 — Boîte de réception façon boîte mail (plan d'exécution)

> **Statut : plan validé, à exécuter.** Rédigé le 11/07/2026 (session Fable 5) pour être
> exécuté par une session fraîche (Opus 4.8) sans autre contexte que ce document et le repo.
> Décision produit : la Boîte de réception devient une **vraie boîte mail** (façon
> Outlook/Gmail) — volets dossiers / liste / lecture, lu-non lu, traités, versés,
> raccourcis clavier — au lieu de l'empilement vertical actuel.

---

## 1. Objectif

Transformer `/app/inbox` en client mail à trois zones : **rail de dossiers** (Boîte,
Traités, Versés, libellés), **liste des messages** (expéditeur, objet, extrait, heure,
trombone, pastille non-lu), **panneau de lecture** (corps, pièces jointes, actions).
L'utilisateur doit s'y retrouver instantanément parce que c'est l'ergonomie qu'il connaît
déjà. Le meilleur style possible dans le design system BLEME existant (terracotta,
`rounded-[1.75rem]`, motion sobre) — pas un clone visuel d'Outlook, son **ergonomie**.

**Aucune migration de base de données.** Tout le modèle nécessaire existe déjà. Donc pas
de `supabase db push`, déploiement = `git push` seulement (après validation de Louis).

---

## 2. État actuel — inventaire exact (vérifié le 11/07/2026)

### 2.1 Données (modèle SUFFISANT, ne rien migrer)

- `inbox_items` (`supabase/migrations/20260705120000_inbox.sql`) : `source`
  (`email|whatsapp|fichier|note`), `from_name`, `from_contact`, `subject`, `excerpt`,
  `body_text`, `storage_path`, `mime_type`, `size_bytes`, `label_id`, `case_id`,
  `is_read`, `is_archived`, `is_sample`, `received_at` + `message_id`/`in_reply_to`
  (migration `20260707120000`). RLS org (attention : depuis le RBAC, la nav gate l'inbox
  par la capacité `cases.view` — voir `components/app/sidebar-nav.tsx`).
- `inbox_attachments` (`20260707120000_inbox_email_inbound.sql`) : `inbox_item_id`,
  `file_name`, `storage_path`, `mime_type`, `size_bytes`. Téléchargement par la route
  `app/app/inbox/fichier/[id]/route.ts` (gardée par `documents.download`).
- `inbox_labels` : `name`, `color` (5 couleurs, mapping `lib/inbox/label-colors.ts`).
- `organizations.inbox_slug` → adresse de transfert `b-xxxx@dossiers.bleme.fr`.

### 2.2 Actions serveur (TOUTES existent, `lib/inbox/actions.ts`, 828 lignes)

| Action | Ligne | Rôle |
|---|---|---|
| `prepareInboxUpload` / `finalizeInboxImport` | 82 / 104 | dépôt de fichier (WhatsApp .txt, photos, PDF…) |
| `addPastedEmail` | 198 | coller un email brut |
| `createLabel` / `deleteLabel` / `setItemLabel` | 236 / 266 / 276 | libellés |
| `toggleItemRead` | 290 | lu / non-lu (FormData `id`, `read`) |
| `toggleItemArchived` | 299 | traité / remis en boîte (FormData `id`, `archived`) |
| `assignItemToCase` | 313 | **verser au dossier** (cœur du produit) |
| `analyzeEmailForCase` / `confirmEmailMerge` | 434 / 594 | analyse IA d'un email avant versement (modale existante `components/app/email-analysis-modal.tsx`) |
| `deleteInboxItem` | 753 | suppression |
| `createSampleInbox` / `deleteSampleInbox` | 774 / 818 | exemples |

**Ne pas réécrire ces actions.** Les réutiliser telles quelles (elles revalident
`/app/inbox`). Ajouter au besoin UNE action `markItemRead(id)` légère si `toggleItemRead`
se révèle malcommode pour le marquage à l'ouverture — mais essayer d'abord avec l'existant.

### 2.3 Composants existants (`components/app/inbox.tsx`, 402 lignes)

`CopyAddress` (l.56), `InboxUploader` (l.86, drag&drop + progression), `PasteEmailForm`
(l.183), `NewLabelForm` (l.231), `ItemActions` (l.283 : sélecteur de dossier + versement +
déclenchement analyse IA email). **Tous réutilisables tels quels** dans le nouveau layout.

### 2.4 Page actuelle (`app/app/inbox/page.tsx`, 410 lignes, serveur)

Empilement vertical : header → carte adresse → uploader + coller email → chips libellés →
liste `<details>` accordéon. C'est CE fichier qu'on transforme : il garde le **fetch des
données** (items + attachments + labels + cases ouverts + adresse), et délègue tout le
rendu à un nouveau composant client.

---

## 3. Design cible

### 3.1 Layout desktop (≥ lg)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Boîte de réception                    [🔍 Rechercher…]   [+ Nouveau ▾]  │  ← header compact
├────────────┬──────────────────────────┬──────────────────────────────────┤
│ RAIL       │ LISTE                    │ LECTURE                          │
│            │                          │                                  │
│ 📥 Boîte 3 │ ● [✉] Karim Bensaïd     │  Objet complet                   │
│ ✓ Traités  │      Relance facture…    │  De Karim Bensaïd · 12 juil 14h  │
│ 📁 Versés  │      « Bonjour, je … »   │  [Email] [libellé] [Versé]       │
│ ─────────  │      14:32          📎2  │ ─────────────────────────────────│
│ LIBELLÉS   │ ○ [💬] Chantier Diaz     │  Corps du message (scroll)       │
│ ● Chantier │      Export WhatsApp     │                                  │
│ ● Perso    │      hier                │  📎 Pièces jointes (2)           │
│ + libellé  │ ○ [📄] devis-2026.pdf    │  ┌─────────────┐ ┌────────────┐  │
│ ─────────  │      10 juil             │  │ facture.pdf │ │ photo.jpg  │  │
│ ✉ Adresse  │                          │  └─────────────┘ └────────────┘  │
│            │  (scroll indépendant)    │ ─────────────────────────────────│
│            │                          │  [Verser au dossier ▾] [Traiter] │
│            │                          │  [Libellé ▾] [Non lu] [🗑]       │
└────────────┴──────────────────────────┴──────────────────────────────────┘
```

- **Hauteur pleine** : le bloc mail occupe `h-[calc(100dvh-11rem)]` environ (ajuster à la
  hauteur réelle du header de page), `min-h-[480px]`, dans une carte
  `rounded-[1.75rem] border bg-card overflow-hidden`. Trois colonnes avec scroll
  **indépendant** (`overflow-y-auto` par colonne, `min-h-0` sur les wrappers flex —
  pattern déjà appris sur les modales d'équipe).
- Largeurs : rail `w-52 shrink-0` (xl : `w-56`) · liste `w-[22rem] xl:w-[24rem] shrink-0`
  · lecture `flex-1 min-w-0`. Séparateurs `border-r`.
- **lg sans xl** : rail replié en icônes (`w-14`, tooltips) OU rail masqué et dossiers en
  menu déroulant au-dessus de la liste — choisir la variante la plus simple et propre.

### 3.2 Mobile (< lg) — la moitié des utilisateurs

- **Liste seule** en pleine largeur (le rail devient une rangée de chips horizontale
  scrollable : Boîte · Traités · Versés · libellés).
- Toucher un message → le panneau de lecture **glisse par-dessus** en plein écran
  (`fixed inset-0 z-40`, slide-in depuis la droite, motion/react, `useReducedMotion`),
  avec un header sticky « ← Boîte de réception » + actions. **Portail vers `document.body`**
  obligatoire (leçon des modales : un `fixed` dans un ancêtre transformé par une animation
  se fait piéger).
- Le bouton « + Nouveau » reste accessible (header).

### 3.3 Liste des messages — anatomie d'une ligne

- Pastille non-lu (point `bg-brand` 8px) · avatar source (icône email/WhatsApp/fichier/
  note, teintes `SOURCE_META` existantes, reprendre le mapping de la page actuelle).
- Ligne 1 : **expéditeur** (`from_name`, sinon subject) — gras si non-lu · heure à droite
  (**format intelligent** : `14:32` si aujourd'hui, `hier`, sinon `12 juil`).
- Ligne 2 : objet (medium si non-lu) · trombone + compte si PJ.
- Ligne 3 : extrait (`excerpt`) sur une ligne, muted, truncate.
- Badges compacts : point de couleur du libellé · « Versé » (émeraude, `FolderCheck`)
  si `case_id` · « exemple » si `is_sample`.
- **Sélection** : fond `bg-brand-soft/50` + barre gauche `bg-brand` 3px (ou
  `ring-1 ring-brand/30`). Hover : `bg-muted/50`.
- Non-lu ouvert → marqué lu automatiquement (optimiste + `toggleItemRead` en
  `startTransition`, PAS de `router.refresh` à chaque ouverture — état local).

### 3.4 Panneau de lecture

- **Vide** (rien de sélectionné) : état composé — icône enveloppe, « Sélectionnez un
  message », rappel de l'adresse de transfert (CopyAddress compact).
- **Header** : objet (text-lg font-semibold), `De {from_name} <{from_contact}>` + date
  longue, badges (source, libellé, Versé → lien vers le dossier).
- **Corps** : `body_text` en `whitespace-pre-wrap`, scrollable, fond `bg-muted/20`
  arrondi. Pour un `fichier` sans body : carte de fichier avec téléchargement.
- **Pièces jointes** : grille de cartes (nom, type, taille, icône Download), liens vers
  `/app/inbox/fichier/[id]` (déjà gardé par `documents.download` — un membre sans ce
  droit reçoit 403 : afficher les PJ mais prévoir le message d'erreur du navigateur,
  pas de gating UI supplémentaire nécessaire en V1).
- **Barre d'actions** (sticky bas du panneau, `border-t bg-card`) :
  - **Verser au dossier** (primaire, brand) → réutiliser `ItemActions` (il gère le
    sélecteur de dossiers ouverts + l'analyse IA email + modale de fusion). Si déjà
    versé : lien « Voir le dossier » à la place.
  - Marquer traité / Remettre en boîte (`toggleItemArchived`).
  - Libellé (menu déroulant des labels + « nouveau libellé »).
  - Marquer non lu (`toggleItemRead`).
  - Supprimer (confirm inline, pas de window.confirm).

### 3.5 Rail de dossiers

- **Boîte** (compteur non-lus, badge brand) · **Traités** (`is_archived`) · **Versés**
  (`case_id != null`, tous statuts confondus — nouveau « dossier » virtuel, très demandé
  mentalement : « qu'est-ce que j'ai déjà classé ? »).
- Section **Libellés** : chaque libellé avec son point de couleur + compteur, suppression
  au survol (reprendre le pattern existant), `NewLabelForm` en bas de section.
- Section basse : bouton discret « Votre adresse de transfert » → popover/modale avec
  `CopyAddress` + le mode d'emploi (contenu de l'actuelle carte adresse).
- Filtre par **source** (Email / WhatsApp / Fichiers / Notes) : chips secondaires en haut
  de la LISTE (pas dans le rail) — optionnel, à faire si fluide.

### 3.6 « + Nouveau » (désencombre la page)

Menu déroulant (ou modale) à 3 entrées, réutilisant l'existant :
1. **Déposer des fichiers** → `InboxUploader` (dans une modale).
2. **Coller un email** → `PasteEmailForm` (dans une modale).
3. **Par transfert d'email** → popover adresse (CopyAddress).
Les modales suivent le pattern accessibilité de `components/app/team-access.tsx` (Shell :
portail body, focus trap, Échap, verrou scroll, reduced-motion).

### 3.7 Recherche

Champ dans le header (`🔍 Rechercher…`), **filtrage client** sur `subject`, `from_name`,
`excerpt`, `body_text` (tout est déjà chargé). Debounce inutile (local). Highlight
facultatif. Vider → retour au dossier courant.

### 3.8 Raccourcis clavier (desktop)

`↓/↑` ou `j/k` : naviguer · `Entrée` : ouvrir · `E` : traiter/remettre · `U` : non-lu ·
`Suppr` : supprimer (avec confirmation). **Garde** : inactifs quand le focus est dans un
input/textarea/select ou une modale. Écouteur global dans le composant client, cleanup
strict.

### 3.9 Animations (sobres, motivées)

- Chargement : cascade `animate-in fade-in-0` (tw-animate-css, classes vérifiées :
  `animate-in`, `fade-in-0`, `slide-in-from-bottom-2`, `fill-mode-both` + delays inline).
  Reduced-motion déjà neutralisé globalement dans `globals.css`.
- Changement de message : léger fade/slide du panneau de lecture (motion/react, EASE
  `[0.16, 1, 0.3, 1]`, ~250 ms, `useReducedMotion`).
- Ligne marquée traitée : disparition douce (opacity + height via motion `AnimatePresence`
  si simple, sinon retrait direct — ne pas sur-ingénierer).

---

## 4. Architecture technique

### 4.1 Fichiers

| Fichier | Sort |
|---|---|
| `app/app/inbox/page.tsx` | **Réécrit** : serveur, fetch uniquement (items + attachments + labels + cases ouverts + adresse + samples), passe tout à `<InboxClient>`. Garde `createSampleInbox`/`deleteSampleInbox` (boutons dans les états vides). |
| `components/app/inbox-client.tsx` | **Nouveau**, `"use client"`. Tout le client mail : état (dossier courant, sélection, recherche, overrides optimistes), layout 3 colonnes + mobile. Sous-composants internes : `FolderRail`, `MessageList`, `MessageRow`, `ReadingPane`, `ActionBar`, `NewMenu`, `AddressPopover`, `EmptyPane`. Si > ~600 lignes, scinder en `inbox-list.tsx` / `inbox-reading.tsx`. |
| `components/app/inbox.tsx` | **Conservé** : `CopyAddress`, `InboxUploader`, `PasteEmailForm`, `NewLabelForm`, `ItemActions` réutilisés depuis le nouveau client. Adapter leur emballage visuel si nécessaire (props `compact?`), sans changer leur logique. |
| `lib/inbox/actions.ts` | **Inchangé** (sauf micro-ajout éventuel `markItemRead`). |

### 4.2 État client & données

- Props sérialisables : `items` (avec `attachments: […]` regroupées côté serveur),
  `labels`, `cases`, `address`, `hasSamples`.
- État : `folder` (`"boite" | "traites" | "verses" | label:id`), `selectedId`,
  `query`, `readOverrides: Record<string, boolean>` (optimiste lu/non-lu),
  `archivedOverrides` idem. Les mutations lourdes (verser, supprimer, libellé) passent
  par les actions existantes qui `revalidatePath("/app/inbox")` → le serveur repousse des
  données fraîches ; les overrides locaux comblent l'attente.
- **Deep-link** : lire `?item=<id>` au montage pour présélectionner (les notifications
  pointent déjà vers `/app/inbox`) et pousser `?item=` via
  `history.replaceState` à la sélection (pas de navigation Next complète).
- Marquage lu à l'ouverture : override local immédiat + `toggleItemRead` en arrière-plan
  (`startTransition`), une seule fois par item.

### 4.3 Points de vigilance repo (OBLIGATOIRES, leçons des sessions passées)

1. **Portail body** pour tout `fixed` rendu sous un ancêtre animé/transformé
   (`createPortal(content, document.body)`) — modales et panneau mobile.
2. **Colonnes scrollables** : chaîne `flex` complète avec `min-h-0` + `overflow-y-auto`
   sur la zone qui scrolle, sinon le footer d'actions devient inatteignable.
3. `Date.now()`/`new Date()` en rendu serveur → commentaire
   `// eslint-disable-next-line react-hooks/purity -- …` (règle stricte du repo).
4. Apostrophes **typographiques** (’) dans le JSX, jamais `'` (règle
   `react/no-unescaped-entities`).
5. Fichiers `"use server"` : uniquement des exports de fonctions async (pas de constantes).
6. Textes UI en **français**, registre **non-juridique** (« verser », « traiter »,
   jamais de vocabulaire de conseil).
7. Icônes **lucide-react** uniquement (standard du repo), `strokeWidth` cohérent.
8. RBAC : la page est déjà gatée par `cases.view` dans la nav ; ne PAS ajouter d'autre
   garde. Le téléchargement PJ est gaté par `documents.download` côté route.
9. Mobile-first réel : tester le rendu à 375 px (une seule colonne, panneau plein écran).
10. Next 16 : conventions renommées — consulter `node_modules/next/dist/docs/` au moindre
    doute (règle AGENTS.md).

---

## 5. Étapes d'exécution (dans l'ordre, avec gates)

1. **Lecture préalable** : ce doc + `app/app/inbox/page.tsx` + `components/app/inbox.tsx`
   + `lib/inbox/actions.ts` (signatures) + `components/app/team-access.tsx` (pattern
   Shell/portail) + `components/app/ui.tsx` (design tokens).
2. **Squelette** : réécrire `page.tsx` (fetch + regroupement attachments par item) et
   créer `inbox-client.tsx` avec le layout 3 colonnes statique (desktop) + chips/liste
   (mobile), données réelles, sans actions. *Gate : `npx tsc --noEmit` + rendu visuel.*
3. **Liste + lecture** : sélection, marquage lu optimiste, panneau de lecture complet
   (corps, PJ, badges), état vide du panneau, deep-link `?item=`. *Gate : tsc.*
4. **Actions** : barre d'actions (verser via `ItemActions`, traiter, libellé, non-lu,
   supprimer avec confirmation inline), overrides optimistes, comportements post-action
   (ex. traiter → sélection passe au message suivant). *Gate : tsc + lint.*
5. **« + Nouveau » + adresse** : menu + modales (uploader, coller email, adresse),
   pattern Shell accessible. Retirer les anciens blocs pleine page. *Gate : tsc.*
6. **Mobile** : panneau plein écran en portail, chips de dossiers, retour, safe-areas.
7. **Polish** : recherche, raccourcis clavier, animations, compteurs, états vides par
   dossier (Boîte vide → CTA exemples ; Traités vide ; Versés vide), suppression des
   exemples.
8. **Vérification** : `npx tsc --noEmit` · `npx eslint <fichiers touchés>` ·
   `npm run build` — tous verts.
9. **Review adversariale** (ultracode) : workflow multi-dimensions (correction/états,
   UX/accessibilité/mobile, régressions des flux existants — versement + analyse IA email
   + upload + collage email doivent marcher EXACTEMENT comme avant) + vérification
   indépendante de chaque finding, puis corriger les findings confirmés.
10. **Déploiement** : commit descriptif + `git push origin main` (déclenche Vercel).
    **Pas de migration, donc pas de `supabase db push`.** Vérifier l'état du déploiement
    Vercel (MCP `list_deployments`) jusqu'à `READY`.

## 6. Critères d'acceptation

- [ ] Trois zones desktop, scrolls indépendants, aucune barre de scroll de page parasite.
- [ ] Ouvrir un message le marque lu instantanément (sans rechargement complet).
- [ ] Verser au dossier fonctionne comme avant (y compris l'analyse IA des emails et la
      modale de fusion) ; l'élément versé affiche le lien vers son dossier.
- [ ] Traiter / remettre en boîte, libellés, suppression : opérationnels depuis le
      panneau ET cohérents avec les compteurs du rail.
- [ ] Boîte / Traités / Versés / libellés filtrent juste ; recherche instantanée.
- [ ] Mobile : liste plein écran, lecture en panneau glissant plein écran, tout reste
      atteignable au pouce.
- [ ] Raccourcis clavier actifs hors champs de saisie ; navigation visible.
- [ ] Reduced-motion respecté ; aria (liste = `role="list"`, sélection annoncée,
      `aria-current`, boutons labellisés).
- [ ] `tsc`, `eslint`, `build` verts ; review adversariale passée et corrigée.
- [ ] Aucun changement de schéma DB ; `lib/inbox/actions.ts` non réécrit.

## 7. Hors périmètre (V2, ne pas faire ici)

Threading par `in_reply_to` (fil de discussion), recherche serveur/pagination (tout est
chargé : acceptable à l'échelle actuelle), virtualisation de liste, épinglage/favoris
(colonne nouvelle → migration), réponse depuis l'inbox, tri par expéditeur.
