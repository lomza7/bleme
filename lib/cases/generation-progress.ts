import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Écriture des étapes réelles d'une génération (courrier, réponse adaptée) :
 * upsert d'une ligne par dossier, lue en polling par la superposition
 * d'attente. Fire-and-forget assumé : la progression ne doit JAMAIS faire
 * échouer ni ralentir la génération elle-même.
 */

export async function setGenerationProgress(
  supabase: SupabaseClient,
  caseId: string,
  organizationId: string,
  step: string,
  detail?: string | null,
): Promise<void> {
  try {
    await supabase.from("generation_progress").upsert(
      {
        case_id: caseId,
        organization_id: organizationId,
        step,
        detail: detail ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "case_id" },
    );
  } catch {
    /* jamais bloquant */
  }
}
