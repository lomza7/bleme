import "server-only";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LETTER_KINDS } from "@/lib/cases/letter-meta";
import { derivePhase, nextLetterKind } from "@/lib/cases/phases";
import { refreshLivingBrief } from "@/lib/cases/brief";

/*
 * Moteur du cockpit dossier : checklist de complétude par type, calcul du
 * score, et recompute déterministe de la progression (stage / statut /
 * prochaine action). Appelé après chaque dépôt de pièce ou action courrier.
 */

export type ChecklistItem = { kind: string; label: string; hint: string };

export const CHECKLISTS: Record<string, ChecklistItem[]> = {
  unpaid_invoice: [
    { kind: "facture", label: "La facture impayée", hint: "La facture ou note d’honoraires concernée." },
    { kind: "devis_contrat", label: "Devis signé ou contrat", hint: "Ce qui prouve l’accord et le montant dû." },
    { kind: "preuve_envoi", label: "Preuve d’envoi / réception", hint: "Email, accusé, bon de livraison signé." },
    { kind: "echanges", label: "Échanges avec le client", hint: "Emails, SMS ou WhatsApp autour de l’impayé." },
  ],
  client_dispute: [
    { kind: "devis_contrat", label: "Devis signé ou contrat", hint: "Le périmètre et le prix convenus." },
    { kind: "preuve_livraison", label: "Preuve de livraison / photos", hint: "Ce qui montre la prestation réalisée." },
    { kind: "echanges", label: "Échanges avec le client", hint: "La contestation et vos réponses." },
    { kind: "facture", label: "La facture concernée", hint: "La facture dont le paiement est bloqué." },
  ],
};

// Catégories proposées à l'upload (rôle de la pièce dans le dossier).
export const DOC_KINDS: { value: string; label: string }[] = [
  { value: "facture", label: "Facture" },
  { value: "devis_contrat", label: "Devis / contrat" },
  { value: "preuve_envoi", label: "Preuve d’envoi / réception" },
  { value: "preuve_livraison", label: "Preuve de livraison / photos" },
  { value: "echanges", label: "Échanges (email, SMS, WhatsApp)" },
  { value: "autre", label: "Autre pièce" },
];

export function checklistFor(caseType: string): ChecklistItem[] {
  return CHECKLISTS[caseType] ?? CHECKLISTS.unpaid_invoice;
}

/** Un export WhatsApp compte comme des « échanges » même sans doc_kind saisi. */
function docKinds(docs: { doc_kind: string | null; doc_class: string }[]): Set<string> {
  const kinds = new Set<string>();
  for (const d of docs) {
    if (d.doc_kind) kinds.add(d.doc_kind);
    if (d.doc_class === "whatsapp_export") kinds.add("echanges");
  }
  return kinds;
}

export function completeness(
  caseType: string,
  docs: { doc_kind: string | null; doc_class: string }[],
): { score: number; satisfied: string[]; missing: ChecklistItem[] } {
  const items = checklistFor(caseType);
  const present = docKinds(docs);
  const satisfied = items.filter((i) => present.has(i.kind)).map((i) => i.kind);
  const missing = items.filter((i) => !present.has(i.kind));
  const score = Math.round((satisfied.length / items.length) * 100);
  return { score, satisfied, missing };
}

function inDays(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString();
}

/**
 * Recalcule score, phase, stage, statut, prochain courrier et prochaine action
 * d'un dossier à partir de ses pièces, ses courriers et les retours du débiteur.
 * Idempotent ; ne touche jamais un dossier résolu/clos ; le statut 'escalated'
 * (mode escalade décidé par l'utilisateur) est « collant ». La phase (1..3) est
 * dérivée de l'état réel (derivePhase) et persistée comme cache d'affichage.
 * Renvoie le nouveau score (pour affichage optimiste).
 */
export async function recomputeCaseProgress(caseId: string): Promise<number | null> {
  const supabase = await createClient();
  const [{ data: c }, { data: docs }, { data: letters }, { data: replies }] = await Promise.all([
    supabase.from("cases").select("case_type, status, stage_total").eq("id", caseId).maybeSingle(),
    supabase.from("documents").select("doc_kind, doc_class").eq("case_id", caseId),
    supabase.from("letters").select("kind, status").eq("case_id", caseId).order("created_at", { ascending: false }),
    supabase.from("debtor_replies").select("handled").eq("case_id", caseId),
  ]);
  if (!c) return null;
  if (c.status === "resolved" || c.status === "closed") return null;

  const { score, missing } = completeness(c.case_type, docs ?? []);
  const ls = letters ?? [];
  const sentKinds = ls.filter((l) => l.status === "sent").map((l) => l.kind);
  const hasSent = sentKinds.length > 0;
  const pendingReview = ls.find((l) => l.status === "draft" || l.status === "edited");
  const unhandledReply = (replies ?? []).some((r) => !r.handled);

  // Phase = état réel (statut + courriers envoyés), persistée en cache.
  const phase = derivePhase({ status: c.status, sentKinds });
  const nextKind = nextLetterKind(c.case_type, sentKinds);

  // Statut : 'escalated' est collant (mode escalade décidé par l'utilisateur).
  let status: string;
  if (c.status === "escalated") status = "escalated";
  else if (pendingReview || unhandledReply) status = "awaiting_user";
  else if (hasSent) status = "awaiting_debtor";
  else status = "awaiting_user";

  // Prochaine action (label), par ordre de priorité. Indépendant du statut
  // collant : un brouillon à valider prime toujours dans la formulation.
  let label: string;
  let at = inDays(1);
  if (pendingReview) {
    label = "Relisez et validez votre courrier";
  } else if (unhandledReply) {
    label = "Le client a répondu — préparez la réponse adaptée";
  } else if (phase === 3) {
    label =
      c.status === "escalated"
        ? "Escalade engagée — préparez le dossier"
        : "Mise en demeure envoyée — sans réponse, envisagez l’escalade";
    at = inDays(7);
  } else if (phase === 2) {
    label = nextKind
      ? `Prochaine relance : ${LETTER_KINDS[nextKind]?.label ?? nextKind}`
      : "En attente du client";
    at = inDays(7);
  } else if (missing.length > 0) {
    label = `Déposez : ${missing[0].label.toLowerCase()}`;
  } else {
    label = "Générez votre première relance";
  }

  // stage (1..4) legacy conservé pour StageDots : mappé sur la phase.
  const stage = phase === 3 ? 4 : phase === 2 ? 3 : missing.length > 0 ? 1 : 2;

  await supabase
    .from("cases")
    .update({
      completeness_score: score,
      phase,
      stage,
      status,
      next_letter_kind: nextKind,
      next_action_label: label,
      next_action_at: at,
    })
    .eq("id", caseId);

  // Synthèse vivante rafraîchie en tâche de fond (après la réponse), pour ne pas
  // ralentir l'action utilisateur. `after` garde la fonction serverless en vie
  // le temps du run ; hors contexte requête (script), on ignore simplement.
  try {
    after(() => refreshLivingBrief(caseId));
  } catch {
    /* pas de contexte requête : le cahier se rafraîchira à la prochaine mutation */
  }

  return score;
}
