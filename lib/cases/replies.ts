"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { touchCase } from "@/lib/cases/touch";
import { setGenerationProgress } from "@/lib/cases/generation-progress";
import { draftAdaptedResponseCore } from "@/lib/cases/reply-draft";

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
  // Dernier retour non traité du dossier (texte réel du message reçu).
  const { data: reply } = await supabase
    .from("debtor_replies")
    .select("id, body_text")
    .eq("case_id", caseId.data)
    .eq("handled", false)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!reply) return { error: "Aucun retour du client à traiter." };

  // Claim ATOMIQUE du retour AVANT rédaction : évite un double brouillon si le
  // webhook entrant (réponse arrivée par email) traite le même retour en parallèle.
  const { data: claimed } = await supabase
    .from("debtor_replies")
    .update({ handled: true })
    .eq("id", reply.id)
    .eq("handled", false)
    .select("id")
    .maybeSingle();
  if (!claimed) return { error: "Ce retour est déjà en cours de traitement." };

  // Rédaction déléguée au cœur partagé (mêmes agents, même garde-fou #2, même
  // repli gabarit) ; ici on branche la progression temps réel de l'UI.
  const res = await draftAdaptedResponseCore(
    supabase,
    org.orgId,
    org.orgName,
    caseId.data,
    reply.body_text,
    { onProgress: (step, detail) => setGenerationProgress(supabase, caseId.data, org.orgId, step, detail) },
  );
  if ("error" in res) {
    // Rédaction en échec : on relâche le retour pour permettre une reprise.
    await supabase.from("debtor_replies").update({ handled: false }).eq("id", reply.id);
    return { error: res.error };
  }

  await touchCase(caseId.data, { type: "letter_draft", label: "Réponse adaptée préparée" });
  revalidatePath(`/app/dossiers/${caseId.data}`);
  return { success: "Réponse adaptée générée.", letterId: res.letterId };
}
