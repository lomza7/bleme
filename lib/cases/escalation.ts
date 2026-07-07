"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { recomputeCaseProgress, completeness } from "@/lib/cases/completeness";
import { buildEscalation, ESCALATION_MODELS, type EscalationModel } from "@/lib/cases/escalation-templates";
import { runAgent } from "@/lib/ai/client";
import { caseMemo } from "@/lib/cases/memo";

/*
 * Phase 3 — escalader et résoudre. Revue « avocat du diable » (Jeanne, run réel),
 * modèles d'escalade (Marius, run réel), puis résolution. Garde-fous anti-conseil
 * à trois niveaux : prompt contraint, schéma factuel, filtre serveur (hasAdvice).
 * Aucun envoi sortant sans passer par approveAndSendLetter (approval_logs + hash).
 */

export type EscState = { error?: string; success?: string; letterId?: string };

// Filet de sécurité : si une sortie IA contient du vocabulaire de conseil ou de
// pronostic, on la rejette au profit du repli déterministe (rien de « juridique »).
const ADVICE_RE = /gagner|perdre|vos?\s+chances|chances?\s+de|stratégie\s+judiciaire|vous\s+risquez|pronostic|garanti/i;
function hasAdvice(...texts: string[]): boolean {
  return texts.some((t) => ADVICE_RE.test(t ?? ""));
}

async function orgFor(): Promise<{ orgId: string; orgName: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id, organizations ( name )")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const org = data.organizations as unknown as { name: string } | null;
  return { orgId: data.organization_id, orgName: org?.name || "Votre entreprise" };
}

const DEVIL_SCHEMA = z.object({
  points: z.array(z.object({ objection: z.string().max(600), remede: z.string().max(600) })).max(8).default([]),
  vigilances: z.array(z.string().max(500)).max(8).default([]),
});

/** Revue « avocat du diable » (Jeanne) : objections adverses + points à documenter. */
export async function runDevilReview(_prev: EscState, formData: FormData): Promise<EscState> {
  const caseId = z.uuid().safeParse(formData.get("caseId"));
  if (!caseId.success) return { error: "Dossier inconnu." };
  const org = await orgFor();
  if (!org) return { error: "Session expirée, reconnectez-vous." };

  const supabase = await createClient();
  const [{ data: c }, { data: docs }] = await Promise.all([
    supabase.from("cases").select("id, title, summary_md, weak_points_md, case_type, amount_claimed_cents, debtor_name").eq("id", caseId.data).maybeSingle(),
    supabase.from("documents").select("doc_kind, doc_class").eq("case_id", caseId.data),
  ]);
  if (!c) return { error: "Dossier introuvable." };

  const { missing, satisfied } = completeness(c.case_type, docs ?? []);
  // Repli déterministe : objections depuis les points de vigilance saisis à
  // l'intake, vigilances depuis les pièces manquantes de la checklist.
  const fallbackPoints = ((c.weak_points_md ?? "") as string)
    .split("\n")
    .map((l: string) => l.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((line: string) => ({ objection: line, remede: "Documentez ce point : pièce ou échange daté à ajouter au dossier." }));
  const fallbackVigilances = missing.map((m) => `Pièce manquante : ${m.label.toLowerCase()}`);
  const fallback = {
    points: fallbackPoints,
    vigilances: fallbackVigilances.length ? fallbackVigilances : ["Les pièces attendues sont présentes."],
  };

  const memo = await caseMemo(supabase, c.id);
  let review = fallback;
  try {
    const { data: j } = await runAgent({
      key: "jeanne",
      input: {
        consigne:
          "Analyse ce dossier du point de vue de la partie adverse : quelles objections opposerait-elle et quelles pièces les corrigent. Appuie-toi sur le contexte consolidé du dossier (contexte_dossier). Formulations factuelles et documentaires uniquement. Jamais de pronostic, jamais d'évaluation de chances, jamais de conseil. JSON { points:[{objection, remede}], vigilances:[string] }.",
        contexte_dossier: memo,
        type: c.case_type,
        resume: c.summary_md ?? "",
        points_de_vigilance: c.weak_points_md ?? "",
        montant_reclame_cents: c.amount_claimed_cents,
        pieces_presentes: satisfied,
        pieces_absentes: missing.map((m) => m.label),
      },
      schema: DEVIL_SCHEMA,
      simulation: fallback,
      organizationId: org.orgId,
      caseId: c.id,
      maxTokens: 900,
    });
    const flat = [...j.points.flatMap((p: { objection: string; remede: string }) => [p.objection, p.remede]), ...j.vigilances];
    review = hasAdvice(...flat) ? fallback : { points: j.points, vigilances: j.vigilances };
  } catch {
    // run en erreur déjà tracé ; on garde le socle déterministe
  }

  await supabase.from("cases").update({ devil_review: review }).eq("id", c.id);
  await supabase.from("case_events").insert({
    case_id: c.id,
    organization_id: org.orgId,
    event_type: "devil_review",
    title: "Revue de robustesse du dossier",
    description: "Points de vigilance actionnables identifiés.",
    source: "ai",
  });
  revalidatePath(`/app/dossiers/${c.id}`);
  return { success: "Revue effectuée." };
}

/** Génère un modèle d'escalade (brouillon relu et validé ensuite). */
export async function generateEscalationDraft(_prev: EscState, formData: FormData): Promise<EscState> {
  const caseId = z.uuid().safeParse(formData.get("caseId"));
  const model = String(formData.get("model") ?? "") as EscalationModel;
  if (!caseId.success) return { error: "Dossier inconnu." };
  if (!ESCALATION_MODELS[model]) return { error: "Modèle inconnu." };
  const org = await orgFor();
  if (!org) return { error: "Session expirée, reconnectez-vous." };

  const supabase = await createClient();
  const { data: c } = await supabase
    .from("cases")
    .select("id, title, debtor_name, amount_claimed_cents, case_type")
    .eq("id", caseId.data)
    .maybeSingle();
  if (!c) return { error: "Dossier introuvable." };

  const tpl = buildEscalation(model, c, org.orgName);
  let subject = tpl.subject;
  let body = tpl.body;

  // Seuls les courriers envoyés en son nom sont rédigés par Marius ; le modèle
  // de requête (procédural, déposé par l'utilisateur) reste le gabarit tel quel.
  if (ESCALATION_MODELS[model].sends) {
    const memo = await caseMemo(supabase, c.id);
    try {
      const { data: m } = await runAgent({
        key: "marius",
        input: {
          consigne:
            "Rédige ce courrier en français à partir des seuls faits fournis. N'invente aucun montant, date ni fait. Garde les mentions légales du gabarit. Appuie-toi sur le contexte consolidé du dossier (contexte_dossier) sans le recopier. Ton ferme, factuel, jamais menaçant. Aucun conseil, aucun pronostic. JSON { subject, body_md }.",
          contexte_dossier: memo,
          type: ESCALATION_MODELS[model].label,
          destinataire: c.debtor_name,
          montant_reclame_cents: c.amount_claimed_cents,
          expediteur: org.orgName,
          gabarit: tpl.body,
        },
        schema: z.object({ subject: z.string().min(3).max(200), body_md: z.string().min(60) }),
        simulation: { subject: tpl.subject, body_md: tpl.body },
        organizationId: org.orgId,
        caseId: c.id,
        maxTokens: 1200,
      });
      subject = m.subject?.trim() || tpl.subject;
      body = hasAdvice(m.body_md ?? "") ? tpl.body : m.body_md?.trim() || tpl.body;
    } catch {
      // run en erreur déjà tracé ; on garde le gabarit conforme
    }
  }

  const { data: created, error } = await supabase
    .from("letters")
    .insert({
      organization_id: org.orgId,
      case_id: c.id,
      kind: "custom",
      tone: "factuel",
      status: "draft",
      subject,
      body_md: body,
    })
    .select("id")
    .single();
  if (error || !created) return { error: "Impossible de générer le modèle." };

  await supabase.from("case_events").insert({
    case_id: c.id,
    organization_id: org.orgId,
    event_type: "escalation_draft",
    title: `Modèle préparé : ${ESCALATION_MODELS[model].label.toLowerCase()}`,
    source: "ai",
  });
  revalidatePath(`/app/dossiers/${c.id}`);
  return { success: "Modèle généré.", letterId: created.id };
}

/** Passe le dossier en mode escalade + synthèse factuelle (Marius). */
export async function escalateCase(_prev: EscState, formData: FormData): Promise<EscState> {
  const caseId = z.uuid().safeParse(formData.get("caseId"));
  if (!caseId.success) return { error: "Dossier inconnu." };
  const org = await orgFor();
  if (!org) return { error: "Session expirée, reconnectez-vous." };

  const supabase = await createClient();
  const [{ data: c }, { data: letters }] = await Promise.all([
    supabase.from("cases").select("id, title, summary_md, amount_claimed_cents, amount_recovered_cents, debtor_name").eq("id", caseId.data).maybeSingle(),
    supabase.from("letters").select("kind, subject, sent_at").eq("case_id", caseId.data).eq("status", "sent").order("created_at", { ascending: true }),
  ]);
  if (!c) return { error: "Dossier introuvable." };

  const fallback =
    `Synthèse du dossier « ${c.title} ».\n\n` +
    `${c.summary_md ?? ""}\n\n` +
    `Courriers envoyés : ${(letters ?? []).length}. Cette synthèse récapitule les faits et les démarches déjà effectuées.`;

  const memo = await caseMemo(supabase, c.id);
  let summary = fallback;
  try {
    const { data: m } = await runAgent({
      key: "marius",
      input: {
        consigne:
          "Rédige une synthèse factuelle du dossier pour préparer une escalade : faits, montants, démarches déjà effectuées. Appuie-toi sur le contexte consolidé du dossier (contexte_dossier). Aucun conseil, aucun pronostic, aucune évaluation de chances. JSON { summary_md }.",
        contexte_dossier: memo,
        resume: c.summary_md ?? "",
        montant_reclame_cents: c.amount_claimed_cents,
        montant_recupere_cents: c.amount_recovered_cents,
        courriers_envoyes: (letters ?? []).map((l: { kind: string }) => l.kind),
      },
      schema: z.object({ summary_md: z.string().min(40) }),
      simulation: { summary_md: fallback },
      organizationId: org.orgId,
      caseId: c.id,
      maxTokens: 900,
    });
    summary = hasAdvice(m.summary_md ?? "") ? fallback : m.summary_md?.trim() || fallback;
  } catch {
    // run en erreur déjà tracé
  }

  await supabase.from("cases").update({ status: "escalated", escalation_summary_md: summary }).eq("id", c.id);
  await recomputeCaseProgress(c.id);
  await supabase.from("case_events").insert({
    case_id: c.id,
    organization_id: org.orgId,
    event_type: "escalation",
    title: "Dossier passé en escalade",
    description: "Synthèse préparée pour la suite.",
    source: "user",
  });
  revalidatePath(`/app/dossiers/${c.id}`);
  revalidatePath("/app");
  return { success: "Dossier en escalade." };
}

/** Acte un accord amiable / échéancier (trace, sans envoi). */
export async function recordSettlement(_prev: EscState, formData: FormData): Promise<EscState> {
  const caseId = z.uuid().safeParse(formData.get("caseId"));
  const note = String(formData.get("note") ?? "").trim();
  if (!caseId.success) return { error: "Dossier inconnu." };
  if (note.length < 3) return { error: "Décrivez l’accord (montant, échéances)." };
  const org = await orgFor();
  if (!org) return { error: "Session expirée, reconnectez-vous." };

  const supabase = await createClient();
  await supabase
    .from("cases")
    .update({ next_action_label: "Échéancier en cours", next_action_at: new Date(Date.now() + 14 * 86_400_000).toISOString() })
    .eq("id", caseId.data);
  await supabase.from("case_events").insert({
    case_id: caseId.data,
    organization_id: org.orgId,
    event_type: "settlement",
    title: "Accord amiable acté",
    description: note.slice(0, 300),
    source: "user",
  });
  revalidatePath(`/app/dossiers/${caseId.data}`);
  return { success: "Accord enregistré." };
}

const CLOSE_REASONS = new Set(["paid", "settlement", "abandoned", "other"]);

/** Clôture le dossier avec un motif. */
export async function closeCase(_prev: EscState, formData: FormData): Promise<EscState> {
  const caseId = z.uuid().safeParse(formData.get("caseId"));
  const reason = String(formData.get("reason") ?? "other");
  if (!caseId.success) return { error: "Dossier inconnu." };
  const org = await orgFor();
  if (!org) return { error: "Session expirée, reconnectez-vous." };

  const supabase = await createClient();
  await supabase
    .from("cases")
    .update({
      status: "closed",
      closed_reason: CLOSE_REASONS.has(reason) ? reason : "other",
      next_action_label: null,
      next_action_at: null,
    })
    .eq("id", caseId.data);
  await supabase.from("case_events").insert({
    case_id: caseId.data,
    organization_id: org.orgId,
    event_type: "closed",
    title: "Dossier clôturé",
    source: "user",
  });
  revalidatePath(`/app/dossiers/${caseId.data}`);
  revalidatePath("/app");
  return { success: "Dossier clôturé." };
}
