import "server-only";
import { createClient } from "@/lib/supabase/server";

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
 * Recalcule score, stage, statut et prochaine action d'un dossier à partir de
 * ses pièces et de ses courriers. Idempotent ; ne touche jamais un dossier
 * résolu/clos. Renvoie le nouveau score (pour affichage optimiste).
 */
export async function recomputeCaseProgress(caseId: string): Promise<number | null> {
  const supabase = await createClient();
  const [{ data: c }, { data: docs }, { data: letters }] = await Promise.all([
    supabase.from("cases").select("case_type, status, stage_total").eq("id", caseId).maybeSingle(),
    supabase.from("documents").select("doc_kind, doc_class").eq("case_id", caseId),
    supabase.from("letters").select("kind, status").eq("case_id", caseId).order("created_at", { ascending: false }),
  ]);
  if (!c) return null;
  if (c.status === "resolved" || c.status === "closed") return null;

  const { score, missing } = completeness(c.case_type, docs ?? []);
  const ls = letters ?? [];
  const hasSent = ls.some((l) => l.status === "sent");
  const pendingReview = ls.find((l) => l.status === "draft" || l.status === "edited");

  // Prochaine action + stage + statut, dans l'ordre du parcours.
  let stage = 1;
  let status = "awaiting_user";
  let label: string;
  let at = inDays(1);

  if (pendingReview) {
    // Un brouillon attend une relecture/validation → priorité absolue.
    stage = 2;
    label = "Relisez et validez votre courrier";
  } else if (hasSent) {
    // Un courrier est parti : l'état dominant est « on attend le débiteur »,
    // même si des pièces restent à compléter (visibles dans la checklist).
    stage = 3;
    status = "awaiting_debtor";
    label = "En attente du client · relance de suivi bientôt";
    at = inDays(7);
  } else if (missing.length > 0) {
    // Collecte des preuves.
    stage = 1;
    label = `Déposez : ${missing[0].label.toLowerCase()}`;
  } else {
    // Dossier complet, prêt à rédiger.
    stage = 2;
    label = "Générez votre première relance";
  }

  await supabase
    .from("cases")
    .update({
      completeness_score: score,
      stage,
      status,
      next_action_label: label,
      next_action_at: at,
    })
    .eq("id", caseId);

  return score;
}
