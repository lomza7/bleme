"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { touchCase } from "@/lib/cases/touch";

/*
 * Réponses de l'utilisateur aux prises de parole des agents (doc 07). La
 * réponse PRIME (pilier #3) : elle est persistée sur l'observation, tracée en
 * timeline (source user) et réinjectée dans la mémoire partagée des agents via
 * buildCaseContext → tous les agents suivants la voient. Écarter/acter une
 * observation la sort de l'affichage sans rien bloquer.
 */

export type ObsState = { error?: string; success?: string };

async function orgFor(): Promise<{ orgId: string; userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { orgId: data.organization_id, userId: user.id };
}

/** Répond à une prise de parole (question, observation ou vigilance). */
export async function answerObservation(_prev: ObsState, formData: FormData): Promise<ObsState> {
  const id = z.uuid().safeParse(formData.get("observationId"));
  const answer = String(formData.get("answer") ?? "").trim();
  if (!id.success) return { error: "Prise de parole inconnue." };
  if (answer.length < 2) return { error: "Écrivez votre réponse, même brève." };
  const org = await orgFor();
  if (!org) return { error: "Session expirée, reconnectez-vous." };

  const supabase = await createClient();
  const { data: obs } = await supabase
    .from("agent_observations")
    .select("id, case_id, organization_id, title, status")
    .eq("id", id.data)
    .maybeSingle();
  if (!obs) return { error: "Prise de parole introuvable." };
  if (obs.status !== "open") return { error: "Déjà traitée." };

  // Garde anti-double-soumission : l'update ne passe que si le statut est
  // encore 'open' (deux onglets → une seule réponse enregistrée).
  const { data: updated, error } = await supabase
    .from("agent_observations")
    .update({
      status: "answered",
      answer_text: answer.slice(0, 1500),
      answered_by: org.userId,
      answered_at: new Date().toISOString(),
    })
    .eq("id", obs.id)
    .eq("status", "open")
    .select("id");
  if (error || !updated?.length) return { error: "Impossible d'enregistrer la réponse." };

  // La réponse entre dans la timeline (source user) : elle rejoint la mémoire
  // partagée et la synthèse vivante dès le recompute ci-dessous. L'org est
  // celle de l'OBSERVATION (un user multi-org répond où le dossier vit).
  await supabase.from("case_events").insert({
    case_id: obs.case_id,
    organization_id: obs.organization_id,
    event_type: "observation_answer",
    title: `Votre réponse : ${obs.title.slice(0, 90)}`,
    description: answer.slice(0, 300),
    source: "user",
  });
  await touchCase(obs.case_id, { type: "user_correction", label: "Réponse apportée à la question d'un agent" });
  revalidatePath(`/app/dossiers/${obs.case_id}`);
  return { success: "Réponse transmise à vos agents." };
}

/** Acte (« c'est noté ») ou écarte une prise de parole, sans réponse. */
export async function closeObservation(_prev: ObsState, formData: FormData): Promise<ObsState> {
  const id = z.uuid().safeParse(formData.get("observationId"));
  const intent = String(formData.get("intent") ?? "acknowledged");
  if (!id.success) return { error: "Prise de parole inconnue." };
  const org = await orgFor();
  if (!org) return { error: "Session expirée, reconnectez-vous." };

  const supabase = await createClient();
  const { data: obs } = await supabase
    .from("agent_observations")
    .select("id, case_id, status")
    .eq("id", id.data)
    .maybeSingle();
  if (!obs) return { error: "Prise de parole introuvable." };
  if (obs.status !== "open") return { error: "Déjà traitée." };

  const { data: updated, error } = await supabase
    .from("agent_observations")
    .update({
      status: intent === "dismissed" ? "dismissed" : "acknowledged",
      answered_by: org.userId,
      answered_at: new Date().toISOString(),
    })
    .eq("id", obs.id)
    .eq("status", "open")
    .select("id");
  if (error || !updated?.length) return { error: "Impossible de mettre à jour." };

  // Une vigilance écartée sort aussi du contexte daté (régénéré en tâche de
  // fond via touchCase → recompute).
  await touchCase(obs.case_id, { type: "update", label: "Prise de parole d'agent traitée" });
  revalidatePath(`/app/dossiers/${obs.case_id}`);
  return { success: "C'est noté." };
}
