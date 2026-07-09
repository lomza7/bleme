"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { touchCase } from "@/lib/cases/touch";
import { LETTER_KINDS } from "@/lib/cases/letter-meta";
import { runAgent } from "@/lib/ai/client";
import { setGenerationProgress } from "@/lib/cases/generation-progress";
import { hasAdvice } from "@/lib/ai/guardrails";
import { caseMemo } from "@/lib/cases/memo";

/*
 * Phase 2 — le client a répondu. On capture le TEXTE réel de sa réponse
 * (debtor_replies) puis Marius (impayé) ou Léna (litige) rédige une réponse
 * ADAPTÉE avec ce texte comme contexte — run réel tracé dans agent_runs, repli
 * gabarit conforme. Rien n'est inventé, rien n'est envoyé sans validation.
 */

export type ReplyState = { error?: string; success?: string; letterId?: string };

const VIA = new Set(["email", "postal", "phone", "other"]);

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

function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Enregistre le retour du débiteur (texte exact saisi par l'utilisateur). */
export async function recordDebtorReply(
  _prev: ReplyState,
  formData: FormData,
): Promise<ReplyState> {
  const caseId = z.uuid().safeParse(formData.get("caseId"));
  const body = String(formData.get("body") ?? "").trim();
  const via = String(formData.get("via") ?? "other");
  if (!caseId.success) return { error: "Dossier inconnu." };
  if (body.length < 3) return { error: "Collez le message reçu du client." };

  const org = await orgFor();
  if (!org) return { error: "Session expirée, reconnectez-vous." };

  const supabase = await createClient();
  const { error } = await supabase.from("debtor_replies").insert({
    organization_id: org.orgId,
    case_id: caseId.data,
    received_via: VIA.has(via) ? via : "other",
    body_text: body,
  });
  if (error) return { error: "Impossible d’enregistrer le retour." };

  await supabase.from("case_events").insert({
    case_id: caseId.data,
    organization_id: org.orgId,
    event_type: "debtor_reply",
    title: "Retour du client enregistré",
    description: body.slice(0, 200) + (body.length > 200 ? "…" : ""),
    source: "user",
  });

  await touchCase(caseId.data, { type: "debtor_reply", label: "Retour du destinataire enregistré" });
  revalidatePath(`/app/dossiers/${caseId.data}`);
  return { success: "Retour enregistré." };
}

/** Rédige une réponse ADAPTÉE au dernier retour non traité (run réel). */
export async function generateAdaptedResponse(
  _prev: ReplyState,
  formData: FormData,
): Promise<ReplyState> {
  const caseId = z.uuid().safeParse(formData.get("caseId"));
  if (!caseId.success) return { error: "Dossier inconnu." };

  const org = await orgFor();
  if (!org) return { error: "Session expirée, reconnectez-vous." };

  const supabase = await createClient();
  const { data: c } = await supabase
    .from("cases")
    .select("id, title, debtor_name, amount_claimed_cents, case_type")
    .eq("id", caseId.data)
    .maybeSingle();
  if (!c) return { error: "Dossier introuvable." };

  const { data: reply } = await supabase
    .from("debtor_replies")
    .select("id, body_text, received_via")
    .eq("case_id", c.id)
    .eq("handled", false)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!reply) return { error: "Aucun retour du client à traiter." };

  const { data: sent } = await supabase
    .from("letters")
    .select("kind, subject")
    .eq("case_id", c.id)
    .eq("status", "sent")
    .order("created_at", { ascending: false });

  const montant = euros(Number(c.amount_claimed_cents) || 0);
  const gabarit =
    `Madame, Monsieur,\n\n` +
    `Nous accusons réception de votre message et souhaitons y répondre.\n\n` +
    `[Reprendre les points soulevés et y répondre à partir des pièces du dossier.]\n\n` +
    `Sauf élément nouveau justifié, la somme de ${montant} € reste due à ce jour. ` +
    `Nous restons à votre disposition pour convenir des modalités de règlement.\n\n` +
    `Cordialement,\n${org.orgName}`;
  const tplSubject = `Réponse à votre message — ${c.title}`;

  let subject = tplSubject;
  let body = gabarit;
  // Litige → Léna ; démarche admin → Basile ; impayé → Marius.
  const isDispute = c.case_type === "client_dispute";
  const isAdmin = c.case_type === "admin_request";
  // Étapes réelles pour la superposition d'attente.
  const writerName = isDispute ? "Léna" : isAdmin ? "Basile" : "Marius";
  const progress = (step: string, detail?: string | null) =>
    setGenerationProgress(supabase, c.id, org.orgId, step, detail);
  await progress(`${writerName} relit le dossier et le message reçu`);
  const memo = await caseMemo(supabase, c.id);
  await progress(`${writerName} rédige la réponse adaptée`, "point par point, sur les faits et pièces du dossier");
  try {
    // Retry ×1 : un JSON mal formé (agent qui conclut mal ses tours d'outils)
    // ne doit pas suffire à dégrader vers le gabarit.
    const run = () => runAgent({
      key: isDispute ? "lena" : isAdmin ? "basile" : "marius",
      input: {
        consigne:
          "Rédige une réponse au message reçu, point par point sur les seuls faits et pièces du dossier (respecte les règles de ton rôle). Réponse complète, sans crochet ni champ à trous. Réponds en JSON { subject, body_md }.",
        contexte_dossier: memo,
        type: isAdmin ? "Réponse à un courrier de l'administration" : "Réponse à un message du débiteur",
        destinataire: c.debtor_name,
        montant_reclame: c.amount_claimed_cents ? `${euros(c.amount_claimed_cents)} €` : null,
        message_recu: reply.body_text.slice(0, 4000),
        courriers_deja_envoyes: (sent ?? []).map((l) => LETTER_KINDS[l.kind]?.label ?? l.kind),
        expediteur: org.orgName,
        gabarit,
      },
      schema: z.object({
        subject: z.string().min(3).max(200).catch(tplSubject),
        body_md: z.string().min(60),
      }),
      simulation: { subject: tplSubject, body_md: gabarit },
      organizationId: org.orgId,
      caseId: c.id,
      maxTokens: 1800,
    });
    const { data: m } = await run().catch(() => {
      void progress(`Première rédaction incomplète — ${writerName} reprend`, "nouvelle tentative en cours");
      return run();
    });
    // Garde-fou #2 : conseil/pronostic → on garde le gabarit conforme.
    if (hasAdvice(m.subject ?? "", m.body_md ?? "")) {
      subject = tplSubject;
      body = gabarit;
    } else {
      subject = m.subject?.trim() || tplSubject;
      body = m.body_md?.trim() || gabarit;
    }
  } catch {
    // run en erreur déjà tracé par runAgent ; on garde le gabarit conforme
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
  if (error || !created) return { error: "Impossible de générer la réponse." };

  await supabase.from("debtor_replies").update({ handled: true }).eq("id", reply.id);

  await supabase.from("case_events").insert({
    case_id: c.id,
    organization_id: org.orgId,
    event_type: "letter_ready",
    title: "Réponse adaptée prête",
    description: "À relire et valider avant tout envoi.",
    source: "ai",
  });

  await touchCase(c.id, { type: "letter_draft", label: "Réponse adaptée préparée" });
  revalidatePath(`/app/dossiers/${c.id}`);
  return { success: "Réponse adaptée générée.", letterId: created.id };
}
