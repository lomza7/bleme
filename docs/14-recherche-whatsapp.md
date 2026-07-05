# Recherche — Accès WhatsApp pour la collecte de preuves (05/07/2026)

## Question

Peut-on faire « connecter son WhatsApp » à l'utilisateur pour aller chercher
en profondeur conversations, messages, journal d'appels, à des fins de
preuves et de contexte ?

## Réponse courte

**La « connexion WhatsApp » complète façon OAuth n'existe pas, et la seule
voie technique qui la simule fait bannir le compte du client.** Mais un
pipeline propre en 3 étages capte ~90 % de la valeur sans aucun risque, dont
les 2 premiers sont constructibles immédiatement.

## Ce qui est impossible ou interdit

1. **Aucune API officielle d'accès à l'historique personnel.** L'API
   WhatsApp Business (Cloud API) ne donne accès qu'aux messages échangés sur
   le numéro business lui-même, jamais à l'historique du compte personnel
   d'un utilisateur.
2. **La voie pirate (Baileys, whatsapp-web.js)** : lier une session comme
   WhatsApp Web (scan QR) donne techniquement tout (chats, médias, contacts).
   MAIS : violation des ToS Meta, détection ML active (fingerprinting,
   patterns comportementaux, mises à jour de protocole plusieurs fois par
   an), bannissements constatés sous 2 à 8 semaines, ~68 % des utilisateurs
   business de ces outils bannis au moins une fois sur 12 mois. Pour BLEME :
   faire bannir le WhatsApp pro d'un artisan = destruction de confiance +
   exposition juridique (Meta poursuit les opérateurs de ces outils).
   **Interdit chez nous.**
3. **Le journal d'appels** : inaccessible sur iOS (aucune API), et sur
   Android la permission est réservée aux apps « dialer » par les règles du
   Play Store. Voie de contournement : aucune propre.

## Le pipeline propre (recommandation)

### Étage 1 — Import de l'export officiel (constructible tout de suite)

WhatsApp intègre nativement « Exporter la discussion » (.txt horodaté +
médias en .zip). Deux gestes pour l'utilisateur, sanctionné par Meta,
par-conversation (minimisation RGPD naturelle).

- UX : depuis WhatsApp → Exporter la discussion → **envoyer à l'adresse
  email du dossier** (le canal existe déjà !) ou déposer le .zip dans le
  Drive du dossier.
- Back : parser du format d'export (stable, horodaté, auteurs), rattachement
  des médias, extraction IA (accords, promesses de paiement, dates,
  montants) → événements de chronologie sourcés + pièces datées.
- Effort : ~1 journée pour le parser + intégration timeline.

### Étage 2 — Le WhatsApp de BLEME (Cloud API officielle)

Comme l'adresse email par dossier : **un numéro WhatsApp BLEME** (WhatsApp
Business Cloud API, via Meta ou un BSP type Twilio/360dialog).

- L'utilisateur **transfère** les messages importants au numéro du dossier :
  les messages entrants sur NOTRE numéro sont 100 % dans les clous.
- Bonus : notes vocales transcrites, notifications de dossier par WhatsApp
  (templates approuvés), réponses rapides (« paiement reçu »).
- Coûts : à la conversation (tarification Meta), intégrable aux frais
  variables.

### Étage 3 — Horizon : interopérabilité DMA

Depuis fin 2025, le DMA force WhatsApp à ouvrir l'interop de messagerie en
Europe (premiers partenaires : BirdyChat, Haiket ; E2EE exigé, mobile
uniquement). C'est de l'interop temps réel, pas de l'accès à l'historique,
mais c'est LA porte officielle qui s'ouvre : à terme, « le WhatsApp du
dossier » pourrait devenir un canal interop natif. Lourd (exigences E2EE,
accord Meta) — **à surveiller, pas à construire maintenant**.

## Journal d'appels : le substitut honnête

- Saisie assistée dans la chronologie (« Appel du 12/06, ~8 min, promesse de
  payer ») — valeur déclarative, utile au récit.
- Capture d'écran du journal d'appels → OCR → événement daté (commencement
  de preuve).

## RGPD / posture juridique

- Les conversations contiennent des données de tiers (le débiteur) : base
  légitime solide = **constitution de preuves pour l'exercice d'un droit**
  (intérêt légitime, art. 6(1)(f)), à documenter dans les CGU et le registre.
- L'export **par l'utilisateur** nous met dans la bonne posture : c'est lui
  qui fournit les données qu'il détient légitimement, nous ne « pénétrons »
  aucun système. Minimisation par-conversation, rétention alignée sur la vie
  du dossier.

## Décision proposée

1. Construire l'Étage 1 (parser d'export + envoi à l'adresse du dossier).
2. Chiffrer l'Étage 2 (BSP, coûts/conversation) pour la V1.5.
3. Ne jamais toucher aux sessions non officielles.
