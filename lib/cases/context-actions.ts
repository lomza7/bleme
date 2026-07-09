"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/*
 * Consultation du journal du Contexte (case_context_versions) : historique
 * daté, append-only, en LECTURE SEULE absolue côté utilisateur (RLS select-only,
 * aucune écriture possible — l'opposabilité est un contrat structurel).
 */

const paramsSchema = z.object({ caseId: z.uuid(), version: z.number().int().min(1) });

export async function getContextVersion(input: {
  caseId: string;
  version: number;
}): Promise<{ contentMd?: string; createdAt?: string; sha256?: string; error?: string }> {
  const parsed = paramsSchema.safeParse(input);
  if (!parsed.success) return { error: "Version inconnue." };
  const supabase = await createClient(); // user-scoped : la RLS EST l'isolation
  const { data } = await supabase
    .from("case_context_versions")
    .select("content_md, created_at, content_sha256")
    .eq("case_id", parsed.data.caseId)
    .eq("version", parsed.data.version)
    .maybeSingle();
  if (!data) return { error: "Version introuvable." };
  return { contentMd: data.content_md, createdAt: data.created_at, sha256: data.content_sha256 };
}
