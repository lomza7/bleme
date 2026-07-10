/*
 * Machine à états du suivi d'envoi (type « suivi colis »), partagée
 * serveur + client — aucune dépendance serveur ici.
 *
 * Deux canaux, un même principe : chaque webhook fournisseur (Merci Facteur
 * pour le recommandé, Resend pour l'email) est normalisé en une « étape »
 * (stage) avec rang. Le statut agrégé d'un courrier (letters.tracking_status)
 * ne peut que monter en rang (les webhooks arrivent dans le désordre et se
 * rejouent) ; l'historique complet vit dans letter_tracking_events.
 */

export type TrackingStage =
  // Postal (LRAR Merci Facteur)
  | "accepted" // pris en compte par l'imprimeur
  | "printed" // imprimé et posté
  | "in_transit" // acheminement La Poste (plusieurs codes)
  | "notice_left" // avisé : à retirer au bureau de poste
  | "delivered" // distribué au destinataire
  | "ar_signed" // accusé de réception signé numérisé
  | "returned" // pli non distribué / retour expéditeur
  | "problem" // incident d'acheminement
  | "deposit_proof" // preuve de dépôt (document, n'avance pas le stepper)
  // Email (Resend)
  | "email_sent"
  | "delayed"
  | "email_delivered"
  | "opened"
  | "clicked"
  | "replied"
  | "bounced"
  | "failed"
  | "suppressed"
  | "complained";

/** Rang de progression : le statut agrégé ne peut que monter (monotone). */
export const STAGE_RANK: Record<TrackingStage, number> = {
  deposit_proof: 0, // document : n'agrège jamais
  accepted: 20,
  printed: 30,
  in_transit: 40,
  problem: 44,
  notice_left: 50,
  delivered: 60,
  returned: 62,
  ar_signed: 70,
  email_sent: 20,
  delayed: 24,
  email_delivered: 30,
  opened: 40,
  clicked: 44,
  complained: 46,
  replied: 50,
  bounced: 55,
  failed: 55,
  suppressed: 55,
};

export function stageRank(stage: string | null | undefined): number {
  return stage && stage in STAGE_RANK ? STAGE_RANK[stage as TrackingStage] : 0;
}

/** Étapes en anomalie : affichage ambre/rouge + action utilisateur suggérée. */
export const ALERT_STAGES: ReadonlySet<string> = new Set([
  "returned",
  "problem",
  "bounced",
  "failed",
  "suppressed",
  "complained",
]);

/** Jalons terminaux « heureux » : le pli/l'email est arrivé (ou mieux). */
export const DONE_STAGES: ReadonlySet<string> = new Set(["delivered", "ar_signed", "replied"]);

export const STAGE_LABEL: Record<TrackingStage, string> = {
  accepted: "Pris en compte par l’imprimeur",
  printed: "Imprimé et posté",
  in_transit: "En acheminement par La Poste",
  notice_left: "Avisé — à retirer au bureau de poste",
  delivered: "Distribué au destinataire",
  ar_signed: "Accusé de réception signé",
  returned: "Pli retourné — adresse à vérifier",
  problem: "Incident d’acheminement signalé",
  deposit_proof: "Preuve de dépôt archivée",
  email_sent: "Email envoyé",
  delayed: "Délivrance retardée — nouvel essai en cours",
  email_delivered: "Email délivré",
  opened: "Email ouvert (indicatif)",
  clicked: "Lien de l’email consulté",
  replied: "Réponse reçue",
  bounced: "Email non délivré — adresse à vérifier",
  failed: "Échec d’envoi de l’email",
  suppressed: "Adresse email bloquée (échecs répétés)",
  complained: "Signalé comme indésirable par le destinataire",
};

// ── Normalisation Merci Facteur ──────────────────────────────────────────────

/** Libellés fins des codes d'acheminement La Poste (événement new-state). */
const POSTAL_STATE_LABEL: Record<string, string> = {
  pris_en_charge: "Pris en charge par La Poste",
  prix_en_charge_pays_destinataire: "Pris en charge par la poste du pays destinataire",
  traitement: "En cours de traitement chez La Poste",
  traitement_pays_destination: "En traitement par la poste du pays destinataire",
  transit_pays_intermediaire: "En transit par un pays intermédiaire",
  attente_presentation: "En attente de distribution",
  entree_douane: "Entré en douane",
  sortie_douane: "Sorti de douane",
  retenu_douane: "Retenu en douane",
  probleme_resolu: "Problème résolu — acheminement repris",
  distribution_en_cours: "En cours de distribution",
};

/** Événements Merci Facteur compris : les autres sont journalisés mais ne
 * font PAS avancer le statut agrégé. */
export const KNOWN_POSTAL_EVENTS: ReadonlySet<string> = new Set([
  "new",
  "printed",
  "sended",
  "new-state",
  "delivered",
  "are",
  "pdd",
  "pnd",
  "error",
]);

/**
 * Webhook Merci Facteur → étape normalisée + libellé FR.
 * `nameEvent` = event.name_event ; `statusCode` = detail[].statut_courrier.
 */
export function postalStageFor(
  nameEvent: string,
  statusCode: string,
): { stage: TrackingStage; label: string } {
  switch (nameEvent) {
    case "new":
      return { stage: "accepted", label: STAGE_LABEL.accepted };
    case "printed":
      return { stage: "printed", label: STAGE_LABEL.printed };
    case "sended":
      return { stage: "in_transit", label: "Remis à La Poste" };
    case "delivered":
      return { stage: "delivered", label: STAGE_LABEL.delivered };
    case "are":
      return { stage: "ar_signed", label: STAGE_LABEL.ar_signed };
    case "pdd":
      return { stage: "deposit_proof", label: STAGE_LABEL.deposit_proof };
    case "pnd":
      return { stage: "returned", label: STAGE_LABEL.returned };
    case "error":
      // Seuls les codes de non-distribution avérée valent « retourné » ; un
      // incident inconnu reste « problème » (l'acheminement peut reprendre).
      return ["retour_expediteur", "non_distribuable", "distribue_expediteur"].includes(statusCode)
        ? { stage: "returned", label: STAGE_LABEL.returned }
        : { stage: "problem", label: STAGE_LABEL.problem };
    case "new-state":
      if (statusCode === "attente_au_guichet") {
        return { stage: "notice_left", label: STAGE_LABEL.notice_left };
      }
      return {
        stage: "in_transit",
        label: POSTAL_STATE_LABEL[statusCode] ?? STAGE_LABEL.in_transit,
      };
    default:
      return { stage: "in_transit", label: STAGE_LABEL.in_transit };
  }
}

// ── Normalisation Resend ─────────────────────────────────────────────────────

/** Webhook Resend (email.*) → étape normalisée, ou null si hors suivi. */
export function emailStageFor(
  type: string,
): { stage: TrackingStage; label: string } | null {
  const map: Record<string, TrackingStage> = {
    "email.sent": "email_sent",
    "email.delivery_delayed": "delayed",
    "email.delivered": "email_delivered",
    "email.opened": "opened",
    "email.clicked": "clicked",
    "email.bounced": "bounced",
    "email.failed": "failed",
    "email.suppressed": "suppressed",
    "email.complained": "complained",
  };
  const stage = map[type];
  return stage ? { stage, label: STAGE_LABEL[stage] } : null;
}

// ── Notifications : quelle étape déclenche quoi ──────────────────────────────

export type NotifyLevel = "email" | "center" | "none";

/**
 * Étapes marquantes → notification + email à l'utilisateur ; étapes fines →
 * centre de notifications seulement ; bruit → rien (l'historique du courrier
 * garde tout via letter_tracking_events).
 */
export function notifyLevelFor(stage: TrackingStage, statusCode: string): NotifyLevel {
  switch (stage) {
    // Postal
    case "printed":
    case "notice_left":
    case "delivered":
    case "ar_signed":
    case "returned":
    case "problem":
      return "email";
    case "in_transit":
      // Premier jalon (remise à La Poste) et dernier kilomètre : email.
      // Micro-états intermédiaires (traitement…) : centre seulement.
      return statusCode === "pris_en_charge" || statusCode === "distribution_en_cours"
        ? "email"
        : "center";
    case "deposit_proof":
    case "accepted":
      return "center";
    // Email
    case "email_delivered":
    case "replied":
    case "bounced":
    case "failed":
    case "suppressed":
      return "email";
    case "opened":
    case "clicked":
    case "delayed":
    case "complained":
      return "center";
    case "email_sent":
    default:
      return "none";
  }
}

// ── Stepper (UI) ─────────────────────────────────────────────────────────────

export type TrackingStep = {
  key: string;
  /** Libellé court affiché sous le point du stepper. */
  short: string;
  /** Rang à atteindre pour considérer l'étape franchie. */
  rank: number;
};

/** Étapes du stepper recommandé : Envoyé → … → AR signé. */
export const POSTAL_STEPS: TrackingStep[] = [
  { key: "submitted", short: "Envoyé", rank: 10 },
  { key: "printed", short: "Imprimé, posté", rank: STAGE_RANK.printed },
  { key: "in_transit", short: "En acheminement", rank: STAGE_RANK.in_transit },
  { key: "delivered", short: "Distribué", rank: STAGE_RANK.delivered },
  { key: "ar_signed", short: "AR signé", rank: STAGE_RANK.ar_signed },
];

/** Étapes du stepper email : Envoyé → Délivré → Ouvert → Réponse. */
export const EMAIL_STEPS: TrackingStep[] = [
  { key: "submitted", short: "Envoyé", rank: 10 },
  { key: "email_delivered", short: "Délivré", rank: STAGE_RANK.email_delivered },
  { key: "opened", short: "Ouvert", rank: STAGE_RANK.opened },
  { key: "replied", short: "Réponse", rank: STAGE_RANK.replied },
];

/**
 * État courant du stepper : rang effectif (10 dès l'envoi réel), nombre
 * d'étapes franchies, étape en anomalie éventuelle.
 */
export function trackingProgress(input: {
  channel: string | null;
  sentAt: string | null;
  trackingStatus: string | null;
}): {
  steps: TrackingStep[];
  rank: number;
  done: number;
  alert: boolean;
  /** Libellé de la situation courante (statut agrégé ou « Envoyé »). */
  label: string;
} {
  const steps = input.channel === "postal" ? POSTAL_STEPS : EMAIL_STEPS;
  const alert = ALERT_STAGES.has(input.trackingStatus ?? "");
  let rank = input.sentAt ? Math.max(10, stageRank(input.trackingStatus)) : 0;
  // Anomalie : le rang d'agrégation (où « non délivré » domine « ouvert »)
  // ne vaut PAS progression — on s'arrête au jalon où l'anomalie s'attache,
  // sans jamais afficher de fausses étapes franchies (un email bouncé n'a
  // jamais été « délivré » ni « ouvert »).
  if (alert && input.sentAt) {
    const key = stepKeyFor(input.channel, input.trackingStatus ?? "");
    rank = Math.max(10, steps.find((s) => s.key === key)?.rank ?? 10);
  }
  const done = steps.filter((s) => s.rank <= rank).length;
  const label =
    input.trackingStatus && input.trackingStatus in STAGE_LABEL
      ? STAGE_LABEL[input.trackingStatus as TrackingStage]
      : input.sentAt
        ? input.channel === "postal"
          ? "Envoyé — en attente de prise en charge"
          : "Envoyé"
        : "En attente d’expédition réelle";
  return { steps, rank, done, alert, label };
}

/**
 * À quel jalon du stepper rattacher un événement de suivi (les micro-états
 * s'affichent en sous-lignes du jalon : « En acheminement » regroupe pris en
 * charge, traitement, distribution en cours, avisé…).
 */
export function stepKeyFor(channel: string | null, stage: string): string {
  if (channel === "postal") {
    const map: Record<string, string> = {
      accepted: "submitted",
      printed: "printed",
      deposit_proof: "printed",
      in_transit: "in_transit",
      notice_left: "in_transit",
      problem: "in_transit",
      returned: "in_transit",
      delivered: "delivered",
      ar_signed: "ar_signed",
    };
    return map[stage] ?? "in_transit";
  }
  const map: Record<string, string> = {
    email_sent: "submitted",
    delayed: "email_delivered",
    email_delivered: "email_delivered",
    bounced: "email_delivered",
    failed: "email_delivered",
    suppressed: "email_delivered",
    opened: "opened",
    clicked: "opened",
    complained: "opened",
    replied: "replied",
  };
  return map[stage] ?? "email_delivered";
}

/** Page officielle de suivi La Poste pour un n° de recommandé. */
export function laPosteTrackingUrl(trackingNumber: string): string {
  return `https://www.laposte.fr/outils/suivre-vos-envois?code=${encodeURIComponent(trackingNumber)}`;
}
