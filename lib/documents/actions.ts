"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseWhatsAppExport, pickKeyMessages } from "@/lib/whatsapp/parser";
import { detectFacts } from "@/lib/cases/extraction";
import { recomputeCaseProgress } from "@/lib/cases/completeness";

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
  const docKind = String(formData.get("doc_kind") ?? "").trim() || null;

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

  // Texte lisible (pour WhatsApp + extraction des faits), lu une seule fois.
  let fileText = "";
  if (file.type === "text/plain") {
    try {
      fileText = await file.text();
    } catch {
      fileText = "";
    }
  }
  // Export WhatsApp ? (fichier texte déposé dans un dossier de blème)
  let whatsapp: ReturnType<typeof parseWhatsAppExport> = null;
  if (caseId && fileText) {
    try {
      whatsapp = parseWhatsAppExport(fileText);
    } catch {
      whatsapp = null;
    }
  }

  const path = `${orgId}/${caseId ?? "company"}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(path, file, { contentType: file.type });
  if (upErr) {
    return { error: "Échec de l’envoi. Réessayez." };
  }

  const { data: doc, error: dbErr } = await supabase
    .from("documents")
    .insert({
      organization_id: orgId,
      case_id: caseId,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      doc_class: whatsapp ? "whatsapp_export" : "other",
      doc_kind: docKind,
    })
    .select("id")
    .single();
  if (dbErr || !doc) {
    await supabase.storage.from("documents").remove([path]);
    return { error: "Échec de l’enregistrement. Réessayez." };
  }

  let message = `« ${file.name} » ajouté.`;

  if (caseId && whatsapp) {
    const fmt = (d: Date) =>
      d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    const keys = pickKeyMessages(whatsapp);
    // PostgREST exige des clés identiques sur toutes les lignes d'un insert groupé.
    await supabase.from("case_events").insert([
      {
        case_id: caseId,
        organization_id: orgId,
        event_type: "whatsapp_import",
        event_date: whatsapp.to.toISOString(),
        title: `Conversation WhatsApp importée · ${whatsapp.messages.filter((m) => m.author).length} messages`,
        description: `Échanges avec ${whatsapp.participants.join(", ")} du ${fmt(whatsapp.from)} au ${fmt(whatsapp.to)}.`,
        source: "user",
      },
      ...keys.map((k) => ({
        case_id: caseId,
        organization_id: orgId,
        event_type: "whatsapp_message",
        event_date: k.date.toISOString(),
        title: `Message WhatsApp · ${k.author}`,
        description: `« ${k.text.slice(0, 200)}${k.text.length > 200 ? "…" : ""} »`,
        source: "ai",
      })),
    ]);
    message = `Conversation WhatsApp importée : ${whatsapp.messages.filter((m) => m.author).length} messages, ${keys.length} moment${keys.length > 1 ? "s" : ""} clé${keys.length > 1 ? "s" : ""} ajouté${keys.length > 1 ? "s" : ""} à la chronologie.`;
  } else if (caseId) {
    await supabase.from("case_events").insert({
      case_id: caseId,
      organization_id: orgId,
      event_type: "documents",
      title: `Pièce ajoutée : ${file.name}`,
      source: "user",
    });
  }

  // Phase 3 : extraction des faits (texte lisible + nom de fichier), sourcée
  // et éditable ; puis recalcul de la progression du dossier.
  if (caseId) {
    const facts = detectFacts(fileText, file.name);
    if (facts.length > 0) {
      await supabase.from("document_extractions").insert(
        facts.map((f) => ({
          organization_id: orgId,
          document_id: doc.id,
          field_key: f.field_key,
          value_text: f.value_text,
          value_normalized: f.value_normalized,
          confidence: f.confidence,
          source_excerpt: f.source_excerpt,
        })),
      );
      message += ` ${facts.length} information${facts.length > 1 ? "s" : ""} détectée${facts.length > 1 ? "s" : ""} (à vérifier).`;
    }
    await recomputeCaseProgress(caseId);
    revalidatePath(`/app/dossiers/${caseId}`);
  }

  revalidatePath("/app/documents", "layout");
  return { success: message };
}

/** Corrige une valeur extraite : la correction utilisateur prime toujours. */
export async function correctExtraction(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  const caseId = String(formData.get("caseId") ?? "");
  const value = String(formData.get("value") ?? "").trim();
  if (!id.success || !value) return;
  const supabase = await createClient();
  await supabase
    .from("document_extractions")
    .update({ corrected_value: value, is_user_corrected: true })
    .eq("id", id.data);
  if (caseId) revalidatePath(`/app/dossiers/${caseId}`);
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
