"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runAgent } from "@/lib/ai/client";

/*
 * Après le récit (transcript validé), Jeanne — l'avocate du diable — lit ce qui a
 * été dit et pose 2 à 4 questions CIBLÉES pour combler les trous du dossier
 * (preuve d'accord, accusé de réception, motif invoqué…). Run réel tracé, repli
 * déterministe. Formulations factuelles/documentaires, jamais de conseil.
 */

const QUESTIONS_SCHEMA = z.object({
  questions: z.array(z.string().min(6).max(300)).max(4).default([]),
});

async function currentOrgId(): Promise<string | null> {
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
  return data?.organization_id ?? null;
}

const FALLBACK: Record<string, string[]> = {
  unpaid: [
    "Avez-vous une preuve écrite de l’accord (devis signé, bon de commande, email de validation) ?",
    "Le client a-t-il accusé réception de la facture, ou l’a-t-il contestée ?",
    "Un motif a-t-il été invoqué pour ne pas payer (retard, malfaçon, désaccord sur le montant) ?",
  ],
  dispute: [
    "Sur quoi porte précisément la contestation du client ?",
    "Disposez-vous de preuves de la prestation réalisée (photos datées, livrables, échanges) ?",
    "La réclamation a-t-elle été formalisée par écrit, et y avez-vous déjà répondu ?",
  ],
};

export async function intakeQuestions(input: {
  transcript: string;
  kind: "unpaid" | "dispute";
  partyName: string;
}): Promise<{ questions: string[] }> {
  const fallback = FALLBACK[input.kind] ?? FALLBACK.unpaid;
  const orgId = await currentOrgId();
  if (!orgId || !input.transcript.trim()) return { questions: fallback };

  try {
    const { data } = await runAgent({
      key: "jeanne",
      input: {
        consigne:
          "Tu lis le récit d'un professionnel sur son dossier. Pose 2 à 4 questions PRÉCISES pour combler les trous qui affaibliraient le dossier face à la partie adverse (preuve d'accord, accusé de réception, motif de non-paiement, dates, pièces manquantes). Questions courtes, concrètes, actionnables. Aucun conseil juridique, aucun pronostic. Réponds en JSON { questions: string[] }.",
        type: input.kind === "unpaid" ? "facture impayée" : "litige client",
        partie: input.partyName,
        recit: input.transcript.slice(0, 6000),
      },
      schema: QUESTIONS_SCHEMA,
      simulation: { questions: fallback },
      organizationId: orgId,
      maxTokens: 500,
    });
    return { questions: data.questions.length ? data.questions : fallback };
  } catch {
    return { questions: fallback };
  }
}
