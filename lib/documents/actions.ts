"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseWhatsAppExport, pickKeyMessages } from "@/lib/whatsapp/parser";
import { detectFacts } from "@/lib/cases/extraction";
import { recomputeCaseProgress } from "@/lib/cases/completeness";
import { analysePiece } from "@/lib/cases/analysis";
import type { PieceAnalysis } from "@/lib/cases/analysis-types";
import { runAgent } from "@/lib/ai/client";

export type DocState = { error?: string; success?: string; analysis?: PieceAnalysis };

// Sortie attendue de l'agent Nora (run réel, tracé dans agent_runs).
const NORA_SCHEMA = z.object({
  type_confirme: z.boolean(),
  alertes: z.array(z.string().max(300)).max(6).default([]),
});

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

// Certains navigateurs renvoient un type MIME vide ('') ou 'application/octet-stream'
// pour .heic/.heif/.eml et parfois .doc/.docx. On retombe alors sur l'extension.
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
  webp: "image/webp",
  txt: "text/plain",
  eml: "message/rfc822",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function resolveMime(fileName: string, providedType: string): string {
  if (providedType && ALLOWED_MIME.has(providedType)) return providedType;
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return MIME_BY_EXT[ext] ?? providedType ?? "";
}

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

/**
 * Étape 1 : prépare un envoi DIRECT navigateur → Storage (URL signée). Les
 * octets ne transitent plus par la Server Action → on contourne la limite
 * plateforme (~4,5 Mo sur Vercel) et on tient réellement les 25 Mo annoncés.
 */
export async function prepareUpload(input: {
  scope: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{ path?: string; token?: string; contentType?: string; error?: string }> {
  const mime = resolveMime(input.fileName, input.mimeType);
  if (!input.fileName || input.sizeBytes <= 0) return { error: "Choisissez un fichier." };
  if (input.sizeBytes > MAX_SIZE) return { error: "Fichier trop lourd (25 Mo maximum)." };
  if (!ALLOWED_MIME.has(mime)) {
    return { error: "Format non pris en charge (PDF, images, Word, email, texte)." };
  }

  const orgId = await currentOrgId();
  if (!orgId) return { error: "Session expirée, reconnectez-vous." };

  const supabase = await createClient();
  let caseId: string | null = null;
  if (input.scope !== "company") {
    const parsed = z.uuid().safeParse(input.scope);
    if (!parsed.success) return { error: "Dossier inconnu." };
    const { data: c } = await supabase.from("cases").select("id").eq("id", parsed.data).maybeSingle();
    if (!c) return { error: "Dossier inconnu." };
    caseId = c.id;
  }

  const path = `${orgId}/${caseId ?? "company"}/${crypto.randomUUID()}-${safeName(input.fileName)}`;
  // La policy INSERT de storage.objects vérifie que le 1er segment = l'org.
  const { data, error } = await supabase.storage.from("documents").createSignedUploadUrl(path);
  if (error || !data) return { error: "Impossible de préparer l’envoi. Réessayez." };
  return { path: data.path, token: data.token, contentType: mime };
}

/**
 * Étape 2 : le fichier est déjà dans le Storage (chemin `path`, uploadé en
 * direct par le navigateur). On enregistre la pièce, extrait les faits, lance
 * Nora (run réel) et recalcule la progression — comportement identique à l'ancien
 * uploadDocument.
 */
export async function finalizeUpload(input: {
  scope: string;
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  docKind: string | null;
}): Promise<DocState> {
  const mime = resolveMime(input.fileName, input.mimeType);
  const orgId = await currentOrgId();
  if (!orgId) return { error: "Session expirée, reconnectez-vous." };
  // Le chemin doit appartenir à l'organisation (un client ne finalise pas un chemin tiers).
  if (!input.path.startsWith(`${orgId}/`)) return { error: "Chemin de fichier invalide." };

  const supabase = await createClient();
  let caseId: string | null = null;
  let claimedCents = 0;
  if (input.scope !== "company") {
    const parsed = z.uuid().safeParse(input.scope);
    if (!parsed.success) return { error: "Dossier inconnu." };
    const { data: c } = await supabase
      .from("cases")
      .select("id, amount_claimed_cents")
      .eq("id", parsed.data)
      .maybeSingle();
    if (!c) return { error: "Dossier inconnu." };
    caseId = c.id;
    claimedCents = Number(c.amount_claimed_cents) || 0;
  }

  // Texte lisible (WhatsApp + extraction) : on télécharge l'objet si c'est du texte.
  let fileText = "";
  if (mime === "text/plain") {
    try {
      const { data: blob } = await supabase.storage.from("documents").download(input.path);
      if (blob) fileText = await blob.text();
    } catch {
      fileText = "";
    }
  }
  let whatsapp: ReturnType<typeof parseWhatsAppExport> = null;
  if (caseId && fileText) {
    try {
      whatsapp = parseWhatsAppExport(fileText);
    } catch {
      whatsapp = null;
    }
  }

  const { data: doc, error: dbErr } = await supabase
    .from("documents")
    .insert({
      organization_id: orgId,
      case_id: caseId,
      file_name: input.fileName,
      storage_path: input.path,
      mime_type: mime,
      size_bytes: input.sizeBytes,
      doc_class: whatsapp ? "whatsapp_export" : "other",
      doc_kind: input.docKind,
    })
    .select("id")
    .single();
  if (dbErr || !doc) {
    await supabase.storage.from("documents").remove([input.path]);
    return { error: "Échec de l’enregistrement. Réessayez." };
  }

  let message = `« ${input.fileName} » ajouté.`;

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
      title: `Pièce ajoutée : ${input.fileName}`,
      source: "user",
    });
  }

  // Phase 3 : extraction des faits (texte lisible + nom de fichier), sourcée
  // et éditable ; analyse de cohérence ; puis recalcul de la progression.
  let analysis: PieceAnalysis | undefined;
  if (caseId) {
    const facts = detectFacts(fileText, input.fileName);
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
    // Socle déterministe fiable (facts + cohérence + confirmation de type).
    const det = analysePiece(input.fileName, input.docKind, facts, claimedCents, fileText);
    analysis = det;
    // Run RÉEL de Nora (tracé dans agent_runs) : elle confirme le type et peut
    // ajouter des alertes. Le déterministe reste le socle si l'agent échoue.
    try {
      const { data: nora } = await runAgent({
        key: "nora",
        input: {
          consigne:
            "Tu analyses une pièce d'un dossier. Confirme si elle correspond au type déclaré et signale toute incohérence avec le dossier. Réponds en JSON { type_confirme: bool, alertes: string[] }.",
          type_declare: det.kindLabel,
          montant_reclame_cents: claimedCents,
          champs_detectes: det.facts,
          extrait: fileText ? fileText.slice(0, 4000) : "(document non textuel : contenu non lisible)",
        },
        schema: NORA_SCHEMA,
        simulation: {
          type_confirme: det.kindConfirmed,
          alertes: det.coherence.filter((c) => c.level === "warn").map((c) => c.message),
        },
        organizationId: orgId,
        caseId,
      });
      const coherence = [...det.coherence];
      for (const a of nora.alertes) {
        if (a.trim() && !coherence.some((c) => c.message === a)) coherence.push({ level: "warn", message: a });
      }
      // On reste conservateur : le type n'est « confirmé » que si le socle
      // déterministe ET l'agent le confirment (pas de fausse validation).
      analysis = { ...det, kindConfirmed: det.kindConfirmed && nora.type_confirme, coherence };
    } catch {
      // Le run en erreur est déjà tracé par runAgent ; on garde le socle.
    }
    await recomputeCaseProgress(caseId);
    revalidatePath(`/app/dossiers/${caseId}`);
  }

  revalidatePath("/app/documents", "layout");
  return { success: message, analysis };
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
    .select("id, storage_path, case_id")
    .eq("id", id.data)
    .maybeSingle();
  if (!doc) return;

  await supabase.from("documents").delete().eq("id", doc.id);
  await supabase.storage.from("documents").remove([doc.storage_path]);
  revalidatePath("/app/documents", "layout");
  // Retirer une pièce recompose la complétude et rafraîchit la page dossier.
  if (doc.case_id) {
    await recomputeCaseProgress(doc.case_id);
    revalidatePath(`/app/dossiers/${doc.case_id}`);
  }
}
