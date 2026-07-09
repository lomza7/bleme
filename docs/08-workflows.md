# Étape 8 — Workflows clés

Notation : **[U]** action utilisateur, **[S]** système déterministe, **[IA]** agent, **[✋]** validation humaine obligatoire.

## 1. Création d'un dossier impayé
1. [U] Choisit "Facture impayée", renseigne débiteur (autocomplete SIRENE), montant, date.
2. [S] Crée `cases` (status `draft`) + adresse `d-{shortid}@dossiers.bleme.fr` + `case_parties` (débiteur).
3. [U] Enregistre son récit vocal (2-5 min) → upload audio.
4. [S] Job transcription (Deepgram) → `voice_intakes.transcript_text`.
5. [IA] Agent Intake : résumé structuré + questions + avocat du diable. [U] répond (voix ou texte).
6. [✋] L'utilisateur relit et corrige le résumé → `cases.summary_md` validé.
7. [U] Upload des documents (workflow 2 pour chacun).
8. [IA] Agent Timeline + Agent Preuves (score de complétude) + Agent Risque (points de vigilance).
9. [S] Génère le plan d'action (séquence du playbook) → `tasks` + `deadlines`.
10. [U] Paiement (premier dossier ou dans le quota d'abonnement) → status `active`.

## 2. Import d'une facture (tout document)
1. [U] Drag & drop / photo / PJ d'email transféré.
2. [S] Upload Storage (`org/case/…`), hash SHA-256, détection doublon, `documents` (status `processing`).
3. [IA] Agent Preuves : OCR si besoin → `doc_class` → `document_extractions` (valeur + confiance + extrait source).
4. [S] Recalcule le score de complétude ; met à jour la checklist "il manque…".
5. [IA] Agent Timeline ajoute les événements datés issus du document.
6. [U] Corrige les extractions douteuses (surlignées) si nécessaire — sa correction devient la vérité.

## 3. Connexion Gmail *(V2)*
1. [U] OAuth Google (scope readonly). 2. [S] Stocke le refresh token chiffré (`email_accounts`). 3. [U] Cible un dossier et une période. 4. [IA] Recherche des fils pertinents (parties, montants, mots-clés) → propose une sélection. 5. [✋] L'utilisateur coche les fils à importer — jamais d'import silencieux. 6. [S] Import → workflow 4 fin (rattachement, PJ, résumés).

## 4. Recherche des emails liés (V1 : transfert)
1. [U] Transfère ses emails historiques à l'adresse du dossier.
2. [S] Webhook inbound → vérifie que l'expéditeur = utilisateur → parse (corps, PJ, en-têtes de transfert pour retrouver l'expéditeur d'origine).
3. [S] Crée `email_threads`/`email_messages` ; chaque PJ → workflow 2.
4. [IA] Agent Email : résumé du fil + événements pour la timeline.

## 5. Génération de la timeline
1. [IA] Agent Timeline croise summary validé + extractions + emails → `case_events` sourcés.
2. [S] Détection d'incohérences de dates → alertes bloquantes pour la MED.
3. [U] Édite librement (ajout, correction, masquage). La timeline est vivante : chaque nouvel email/document/envoi l'enrichit automatiquement.

## 6. Préparation d'une relance simple
1. [S] Déclencheur : plan d'action (J0) ou tâche cron (J+7).
2. [IA] Agent Relance : brouillon depuis template versionné + faits validés, ton par défaut de l'org.
3. [S] `letters` (status `draft`) + task "valider la relance" + notification email "Votre relance est prête".
4. → Workflow 8 (validation) puis envoi email (reply-to = adresse du dossier).

## 7. Préparation d'une mise en demeure
1. [S] Déclencheur : étape J+15 du plan (ou demande utilisateur). Pré-conditions vérifiées : complétude ≥ seuil, pas d'incohérence de timeline ouverte, adresse postale du débiteur confirmée.
2. [IA] Agent Relance : brouillon MED depuis le template (mentions d'usage : rappel de créance, références, délai de paiement, réserve d'action, indemnité forfaitaire).
3. [S] Rendu PDF (@react-pdf) + bandeau "relisez / faites valider si doute".
4. → Workflow 8 puis workflow 9.

## 8. Validation utilisateur (tout envoi)
1. [U] Ouvre l'écran de review : courrier pleine page, valeurs extraites surlignées avec leur source, édition inline.
2. [U] Modifie si besoin → nouvelle version (`letters.status = 'edited'`, historique conservé).
3. [✋] Clique "J'ai relu, envoyer en mon nom" → `approval_logs` (user, hash du contenu, IP, UA, horodatage) → `letters.status = 'approved'`.
4. [S] Le worker d'envoi refuse tout courrier sans approval correspondant au hash exact du contenu.

## 9. Envoi recommandé
**V1 (manuel assisté)** : [S] PDF final + page "comment poster votre recommandé" → [U] poste et saisit le n° de suivi → [S] `postal_shipments` (provider `manual`) + rappels de suivi.
**V1.5 (API)** : [S] POST Merci Facteur (adresse validée) → statuts par webhook (`handed → in_transit → delivered/notice_left/returned`) → chaque statut = événement timeline + notification ; AR archivé comme document. Échec d'adresse → task utilisateur "vérifier l'adresse du débiteur".

## 10. Réception d'une réponse email
1. [S] Webhook inbound sur l'adresse du dossier → signature vérifiée.
2. [S] Expéditeur connu (partie autorisée) ? Sinon → quarantaine + task "identifier cet expéditeur".
3. [S] `email_messages` + PJ → workflow 2.
4. [S] Notification immédiate à l'utilisateur ("Réponse de X sur le dossier Y").
5. → Workflow 11.

## 11. Analyse de la réponse
1. [IA] Agent Email : résumé + classification (`promise_to_pay` / `dispute` / `partial_payment` / `request_info` / `refusal` / `unrelated`).
2. [S] Effets selon la classe : promesse → pause de séquence + deadline à la date promise ; contestation → Agent Risque met à jour les vigilances + séquence en pause ; paiement partiel → task "enregistrer le paiement" ; refus → proposition d'accélérer vers la MED.
3. [IA] Brouillon de réponse proposé quand pertinent → `agent_suggestions`.
4. [✋] L'utilisateur décide : accepter la suite proposée, éditer, ou ignorer. Rien ne part sans lui.

## 12. Relance automatique (cadence)
1. [S] Cron 15 min : deadlines échues, séquences actives sans réponse.
2. [S/IA] Prépare la relance suivante (workflow 6) → notification "prête à valider".
3. [S] Si non validée après 3 jours → rappel ; après 10 jours → dossier marqué "à risque" sur le dashboard.
4. *(V2, opt-in)* : relances **amiables** envoyées automatiquement si l'utilisateur a activé l'auto-pilote et pré-validé les templates — la MED reste toujours à validation manuelle.

## 13. Passage de relais entre agents (changement de phase)
1. [S] `recomputeCaseProgress` détecte un changement de phase (P1→P2 ou P2→P3) : le dossier change d'agent référent.
2. [IA] L'agent qui reçoit le dossier relit la mémoire partagée + le socle juridique (Légifrance/JUDILIBRE) et émet 0-4 prises de parole typées : `question` / `observation` / `vigilance` (voir doc 07). Références juridiques absentes des sources → supprimées côté serveur ; filtre anti-conseil au grain fin.
3. [S] Persistance dans `agent_observations` (status `open`) + événement timeline "X a pris la parole". Idempotent : un même passage de relais ne parle qu'une fois.
4. [✋] L'utilisateur répond (sa réponse prime et alimente la mémoire partagée), acte ("c'est noté") ou écarte. Rien n'est bloquant : le dossier avance même sans réponse.

## 14. Export du dossier complet
1. [U] Clique "Exporter le dossier".
2. [IA] Agent Export : synthèse factuelle (parties, montants, chronologie, démarches accomplies, liste des pièces).
3. [S] Bordereau numéroté (`piece_number`), ZIP ordonné (synthèse, bordereau, pièces, courriers avec preuves d'envoi, emails en PDF), horodatage + hash.
4. [U] Prévisualise → confirme → télécharge (URL signée 1 h). L'export reste accessible même après résiliation.
