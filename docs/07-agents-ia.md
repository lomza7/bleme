# Étape 7 — Agents IA

## Philosophie

Un "agent" BLEME = une fonction TypeScript avec un prompt versionné (`lib/agents/<key>.ts` + `prompts/<key>/vN.md`), des entrées typées, une sortie **JSON validée par Zod**, une trace dans `agent_runs`. Pas d'agents autonomes en boucle libre : chaque agent fait une chose, et tout ce qui sort vers le monde réel passe par un humain.

Modèles : Claude Sonnet par défaut ; Haiku pour la classification simple (emails, documents) ; Sonnet effort haut pour l'intake et les courriers. Budget cible : < 3 €/dossier.

Règle transverse (dans le system prompt de tous les agents) : *tu aides à organiser et rédiger, tu ne donnes jamais de conseil juridique personnalisé, tu ne prédis jamais l'issue, tu n'inventes jamais un fait, un montant ou une date — chaque affirmation doit être sourcée dans les inputs, sinon tu la marques "à confirmer".*

---

### 1. Agent Intake
- **Rôle** : transformer le récit vocal (+ mini-form) en dossier structuré ; générer les questions de relance et l'avocat du diable.
- **Inputs** : transcript, champs du mini-form, type de dossier, checklist du playbook.
- **Outputs** : `structured_summary_json` (faits datés, parties, montants, contexte relationnel), 2-4 questions de précision, la question avocat du diable contextualisée, liste des pièces probablement disponibles.
- **Limites** : ne conclut rien sur le fond ; tout fait non explicitement énoncé = "à confirmer".
- **Validation humaine** : le résumé est toujours relu/corrigé par l'utilisateur avant de devenir la vérité du dossier.

### 2. Agent Vocal
- **Rôle** : piloter la session vocale en temps réel — encouragements, détection de fin de récit, enchaînement des questions.
- **Inputs** : transcript partiel en streaming, durée écoulée, questions restantes.
- **Outputs** : messages d'encouragement ("vous avez cité une date d'échéance, parfait"), déclenchement de la question suivante.
- **Limites** : jamais d'interruption avant que l'utilisateur marque une pause ; V1 simplifiée acceptable (questions posées après le récit, pas pendant).
- **Validation humaine** : n/a (pure UX).

### 3. Agent Preuves
- **Rôle** : classifier chaque document, extraire les champs typés, calculer le score de complétude, détecter les manques.
- **Inputs** : document (OCR/vision), checklist du type de dossier, extractions déjà validées.
- **Outputs** : `doc_class`, `document_extractions` (avec confiance + extrait source), score de complétude, liste "il manque…".
- **Limites** : confiance < seuil → champ marqué "à vérifier" et jamais utilisé dans un courrier sans confirmation ; ne juge pas la valeur probante ("preuve faible/forte" = solidité documentaire, pas juridique).
- **Validation humaine** : les valeurs utilisées dans un courrier sont affichées à la review ; correction utilisateur = vérité définitive.

### 4. Agent Timeline
- **Rôle** : construire et maintenir la chronologie à partir du résumé validé, des extractions et des emails.
- **Inputs** : summary, extractions, email_messages, événements existants.
- **Outputs** : `case_events` sourcés (chaque événement pointe sa source), détection d'incohérences ("la facture est antérieure au devis — vérifiez").
- **Limites** : n'invente jamais de date ; une incohérence est signalée, pas résolue d'office.
- **Validation humaine** : timeline éditable ; les incohérences bloquent la génération de MED tant qu'elles ne sont pas levées.

### 5. Agent Relance (rédaction)
- **Rôle** : rédiger les brouillons — relance cordiale, relance ferme, mise en demeure, réponses aux messages du débiteur.
- **Inputs** : template versionné du playbook, faits validés (montants, dates, références), ton choisi, historique des courriers.
- **Outputs** : `letters.body_md` + variables utilisées avec leurs sources.
- **Limites** : n'utilise QUE des faits validés ; les mentions type indemnité forfaitaire de 40 € sont insérées via le template (pas générées librement) ; jamais de menace autre que la réserve d'action standard ; jamais d'envoi.
- **Validation humaine** : **toujours** — un courrier n'existe qu'en brouillon tant que l'utilisateur n'a pas validé (approval_logs).

### 6. Agent Risque (avocat du diable)
- **Rôle** : analyser les faiblesses du dossier à partir de la réponse "avocat du diable" et des pièces ; alimenter "Points de vigilance".
- **Inputs** : summary, weak_points, documents, réponses adverses reçues.
- **Outputs** : liste de vigilances actionnables ("le client évoque un retard : ajoutez la preuve que le délai a été accepté"), pièces à ajouter, `risk_flags`.
- **Limites** : formulations factuelles et documentaires uniquement ; jamais "vous risquez de perdre" ; jamais d'évaluation de chances.
- **Validation humaine** : suggestions affichées, l'utilisateur les traite ou les ignore.

### 7. Agent Email
- **Rôle** : traiter chaque email entrant — rattachement, résumé, classification de la réponse adverse, proposition de suite.
- **Inputs** : email entrant (corps + PJ), contexte du dossier, historique du fil.
- **Outputs** : `ai_summary`, `ai_classification` (promesse de payer / contestation / paiement partiel / demande d'info / refus / hors sujet), `agent_suggestions` (prochaine action + éventuel brouillon de réponse), pause de la séquence de relance si pertinent.
- **Limites** : expéditeur inconnu → quarantaine, pas de traitement ; une promesse de paiement détectée ne marque jamais le dossier "résolu" toute seule.
- **Validation humaine** : toute réponse au débiteur est un brouillon à valider ; la reprise/pause de séquence est notifiée et annulable.

### 8. Agent Suivi
- **Rôle** : le métronome — détecter les dossiers qui stagnent, préparer les actions planifiées, générer les rappels.
- **Inputs** : cron 15 min ; états des cases, deadlines, tasks, séquences.
- **Outputs** : tasks "générer relance J+7", notifications ("pas de réponse à la MED depuis 8 jours — voici les options"), `risk_flags` (dossier dormant), mise à jour de `next_action_at`.
- **Limites** : déterministe au maximum (règles + dates), le LLM ne sert qu'à formuler les notifications ; n'envoie jamais rien lui-même.
- **Validation humaine** : chaque action préparée atterrit en "en attente de validation".

### 9. Agent Export
- **Rôle** : produire l'export pro — synthèse PDF, bordereau de pièces numéroté, ZIP ordonné.
- **Inputs** : tout le dossier (summary, timeline, pièces, courriers, emails, approbations).
- **Outputs** : `01-synthese.pdf` (faits, parties, montants, chronologie, liste des démarches), `02-bordereau.pdf`, arborescence de pièces nommées proprement.
- **Limites** : la synthèse est factuelle et neutre — c'est un document de transmission, pas un mémo d'argumentation.
- **Validation humaine** : prévisualisation avant génération finale ; l'export est ensuite immuable (horodaté + hash).

### 10. Agent Escalade
- **Rôle** : quand la séquence amiable est épuisée, présenter les options de suite de façon **informative et générique** (injonction de payer, commissaire de justice, avocat) et préparer le dossier à transmettre.
- **Inputs** : état du dossier (MED envoyée + délai écoulé), montant, complétude.
- **Outputs** : écran "Et maintenant ?" avec descriptions génériques des voies possibles + coûts d'ordre de grandeur publics + CTA "exporter mon dossier" ; en V3 : mise en relation marketplace.
- **Limites** : **l'agent le plus encadré**. Information générale uniquement (celle qu'on trouve sur service-public.fr), jamais de recommandation personnalisée ("dans votre cas, faites X"). Formulation type : "De nombreux créanciers dans cette situation envisagent… Renseignez-vous ou consultez un professionnel."
- **Validation humaine** : n'agit jamais ; informe et exporte.

---

## Prise de parole aux passages de relais *(décision du 09/07/2026)*

Quand le dossier change de phase, il change d'agent référent (P1 Marius → P2 Sacha → P3 Jeanne). À ce moment précis, **l'agent qui reçoit le dossier a le droit — et le devoir — de prendre la parole** avant d'agir : il relit la mémoire partagée (synthèse vivante + contexte consolidé) et le socle juridique récupéré (Légifrance/JUDILIBRE), et peut émettre 0 à 4 prises de parole typées, adressées à l'utilisateur :

- **`question`** — une information manquante que seul l'utilisateur peut fournir ("le devis a-t-il été signé avant le début des travaux ?").
- **`observation`** — un constat factuel utile sur l'état du dossier ("les trois relances mentionnent des montants différents").
- **`vigilance`** — un point qui pourrait poser problème, formulé de façon documentaire et **appuyé sur des sources réelles** ("la facture date de plus de 4 ans : un délai de prescription pourrait s'appliquer — art. L110-4 C. com. ; faites vérifier le délai applicable par un professionnel").

**Limites (les plus strictes du produit, avec l'agent Escalade)** :
- Toute référence juridique (article, arrêt) citée dans une vigilance doit s'apparier à un article/arrêt précis du socle récupéré par les outils — et **c'est le texte du socle (référence + portée) qui est affiché, jamais celui du modèle** ; une référence absente des sources est supprimée côté serveur.
- Statistiques : uniquement une donnée publique sourcée déjà présente dans les sources fournies (BODACC, jurisprudence citée) ; **jamais une probabilité de succès du dossier**.
- Formulations documentaires ; filtre serveur anti-conseil (`hasAdvice`) appliqué au grain fin (une prise de parole fautive est écartée, pas les autres) ; en cas de doute sérieux, la vigilance se termine par "à faire valider par un professionnel".
- Un passage de relais donné ne parle qu'**une fois** (idempotent) ; si l'agent n'a rien d'utile à dire, il se tait (liste vide, aucun bruit).

**Validation humaine** : chaque prise de parole a un cycle de vie (`open` → répondue / actée / écartée). La réponse de l'utilisateur **prime** (pilier #3) et est réinjectée dans la mémoire partagée : les agents suivants la voient et ne reposent pas la question. Stockage : table `agent_observations` (doc 06).

---

## Récapitulatif des points de validation humaine obligatoires

| Moment | Mécanisme |
|---|---|
| Résumé d'intake | Relecture/correction avant création de la synthèse |
| Valeurs extraites utilisées dans un courrier | Affichées et éditables à la review |
| Tout envoi (email, MED, recommandé) | Bouton explicite + `approval_logs` (bloquant en base applicative) |
| Réponse à un email du débiteur | Brouillon à valider |
| Reprise/pause d'une séquence de relance | Notifiée, annulable |
| Passage à l'escalade | Toujours à l'initiative de l'utilisateur |
| Prise de parole d'un agent (question/vigilance) | Répondue, actée ou écartée par l'utilisateur ; sa réponse prime et alimente la mémoire partagée |
