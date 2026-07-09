"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/** Étape réelle en cours d'une génération (polling de la superposition d'attente). */
export async function getGenerationProgress(
  caseId: string,
): Promise<{ step: string; detail: string | null } | null> {
  if (!z.uuid().safeParse(caseId).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("generation_progress")
    .select("step, detail, updated_at")
    .eq("case_id", caseId)
    .maybeSingle();
  if (!data) return null;
  // Fraîcheur : on ignore une ligne d'une génération précédente (> 3 min).
  if (Date.now() - Date.parse(data.updated_at) > 3 * 60 * 1000) return null;
  return { step: data.step, detail: data.detail };
}
