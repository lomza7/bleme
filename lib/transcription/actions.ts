"use server";

import { createClient } from "@/lib/supabase/server";
import { transcribe } from "@/lib/transcription/stt";

/*
 * Pipeline voix : le navigateur enregistre puis dépose l'audio en DIRECT dans le
 * Storage (URL signée → pas de limite plateforme), puis on transcrit côté serveur.
 */

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

/** URL d'upload signée pour l'audio du récit (org/voice/uuid.webm). */
export async function prepareVoiceUpload(): Promise<{ path?: string; token?: string; error?: string }> {
  const orgId = await currentOrgId();
  if (!orgId) return { error: "Session expirée, reconnectez-vous." };
  const supabase = await createClient();
  const path = `${orgId}/voice/${crypto.randomUUID()}.webm`;
  const { data, error } = await supabase.storage.from("documents").createSignedUploadUrl(path);
  if (error || !data) return { error: "Impossible de préparer l’envoi de l’audio." };
  return { path: data.path, token: data.token };
}

/** Transcrit l'audio déposé au chemin donné. Renvoie le texte (ou une erreur douce). */
export async function transcribeVoice(
  path: string,
): Promise<{ transcript?: string; provider?: string; error?: string }> {
  const orgId = await currentOrgId();
  if (!orgId) return { error: "Session expirée, reconnectez-vous." };
  if (!path.startsWith(`${orgId}/voice/`)) return { error: "Chemin audio invalide." };

  const supabase = await createClient();
  const { data: blob, error } = await supabase.storage.from("documents").download(path);
  if (error || !blob) return { error: "Audio introuvable. Réessayez." };

  const result = await transcribe(blob, blob.type || "audio/webm");
  if (!result) {
    return { error: "no_provider" }; // aucune clé STT configurée → l'UI proposera la saisie texte
  }
  return { transcript: result.text, provider: result.provider };
}
