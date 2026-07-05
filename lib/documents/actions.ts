"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type DocState = { error?: string; success?: string };

const MAX_SIZE = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
  "text/plain",
  "message/rfc822",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

async function currentOrgId() {
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

function safeName(name: string): string {
  return name.replace(/[^\p{L}\p{N}._ -]/gu, "").slice(-120) || "document";
}

export async function uploadDocument(
  _prev: DocState,
  formData: FormData,
): Promise<DocState> {
  const file = formData.get("file");
  const scope = String(formData.get("scope") ?? ""); // 'company' ou un case id

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choisissez un fichier." };
  }
  if (file.size > MAX_SIZE) {
    return { error: "Fichier trop lourd (25 Mo maximum)." };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { error: "Format non pris en charge (PDF, images, Word, email, texte)." };
  }

  const orgId = await currentOrgId();
  if (!orgId) return { error: "Session expirée, reconnectez-vous." };

  const supabase = await createClient();
  let caseId: string | null = null;
  if (scope !== "company") {
    const parsed = z.uuid().safeParse(scope);
    if (!parsed.success) return { error: "Dossier inconnu." };
    const { data: c } = await supabase
      .from("cases")
      .select("id")
      .eq("id", parsed.data)
      .maybeSingle();
    if (!c) return { error: "Dossier inconnu." };
    caseId = c.id;
  }

  const path = `${orgId}/${caseId ?? "company"}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(path, file, { contentType: file.type });
  if (upErr) {
    return { error: "Échec de l’envoi. Réessayez." };
  }

  const { error: dbErr } = await supabase.from("documents").insert({
    organization_id: orgId,
    case_id: caseId,
    file_name: file.name,
    storage_path: path,
    mime_type: file.type,
    size_bytes: file.size,
  });
  if (dbErr) {
    await supabase.storage.from("documents").remove([path]);
    return { error: "Échec de l’enregistrement. Réessayez." };
  }

  if (caseId) {
    await supabase.from("case_events").insert({
      case_id: caseId,
      organization_id: orgId,
      event_type: "documents",
      title: `Pièce ajoutée : ${file.name}`,
      source: "user",
    });
  }

  revalidatePath("/app/documents", "layout");
  return { success: `« ${file.name} » ajouté.` };
}

export async function deleteDocument(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, storage_path")
    .eq("id", id.data)
    .maybeSingle();
  if (!doc) return;

  await supabase.from("documents").delete().eq("id", doc.id);
  await supabase.storage.from("documents").remove([doc.storage_path]);
  revalidatePath("/app/documents", "layout");
}
