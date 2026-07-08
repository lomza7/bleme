"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseWhatsAppExport, pickKeyMessages } from "@/lib/whatsapp/parser";
import { ALLOWED_MIME, MAX_SIZE, resolveMime } from "@/lib/documents/mime";
import { detectFacts, FIELD_LABEL } from "@/lib/cases/extraction";
import { analysePiece } from "@/lib/cases/analysis";
import type { PieceAnalysis } from "@/lib/cases/analysis-types";
import { recomputeCaseProgress } from "@/lib/cases/completeness";
import { runAgent } from "@/lib/ai/client";
import { keepClean } from "@/lib/ai/guardrails";
import { readDocumentFacts, amountToCents } from "@/lib/cases/vision";

/*
 * Boîte de réception : import de fichiers et d'emails collés, libellés de
 * tri, versement vers un dossier. Même pipeline que lib/documents/actions
 * (Storage 'documents', chemin {org}/inbox/..., upload DIRECT navigateur→Storage),
 * avec détection WhatsApp.
 */

export type InboxState = { error?: string; success?: string };

const MAX_TEXT = 2 * 1024 * 1024;

// Sortie attendue des agents pour l'analyse d'un email versé (runs tracés).
const NORA_SCHEMA = z.object({
  type_confirme: z.boolean(),
  alertes: z.array(z.string().max(300)).max(6).default([]),
});
const LENA_SCHEMA = z.object({
  resume_court: z.string().max(300).default(""),
  alertes: z.array(z.string().max(300)).max(6).default([]),
});

/** Une valeur extraite, sourcée + confiance, corrigeable AVANT la fusion. */
export type EditableFact = {
  field_key: string;
  label: string;
  value_text: string;
  value_normalized: Record<string, unknown> | null;
  confidence: number;
  source_excerpt: string | null;
  corrected?: string | null;
};

export type EmailAnalysisResult =
  | { error: string }
  | {
      analysis: PieceAnalysis;
      facts: EditableFact[];
      suggestedDocKind: string;
      suggestedAmountCents: number | null;
      caseAmountCents: number;
      agent: "nora" | "lena";
    };

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

// ── Import d'un fichier : upload DIRECT navigateur → Storage (URL signée) ─────

/** Étape 1 : prépare une URL d'upload signée (les octets ne passent pas par la
 * fonction → on tient les 25 Mo même en prod, comme pour le dépôt de dossier). */
export async function prepareInboxUpload(input: {
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
  const path = `${orgId}/inbox/${crypto.randomUUID()}-${safeName(input.fileName)}`;
  const { data, error } = await supabase.storage.from("documents").createSignedUploadUrl(path);
  if (error || !data) return { error: "Impossible de préparer l’envoi. Réessayez." };
  return { path: data.path, token: data.token, contentType: mime };
}

/** Étape 2 : le fichier est déjà dans le Storage → création de l'élément de boîte
 * (taille + type dérivés de l'objet stocké ; idempotent ; suppression sûre). */
export async function finalizeInboxImport(input: {
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<InboxState> {
  const mime = resolveMime(input.fileName, input.mimeType);
  if (!ALLOWED_MIME.has(mime)) {
    return { error: "Format non pris en charge (PDF, images, Word, email, texte)." };
  }
  const orgId = await currentOrgId();
  if (!orgId) return { error: "Session expirée, reconnectez-vous." };
  if (!input.path.startsWith(`${orgId}/inbox/`)) return { error: "Chemin de fichier invalide." };

  const supabase = await createClient();
  // Idempotence : rejeu d'un chemin déjà reçu → no-op (pas de doublon, pas de remove).
  const { data: already } = await supabase
    .from("inbox_items")
    .select("id")
    .eq("storage_path", input.path)
    .maybeSingle();
  if (already) return { success: `« ${input.fileName} » déjà reçu.` };

  // L'objet doit exister réellement ; on dérive taille + type du stockage.
  const slash = input.path.lastIndexOf("/");
  const { data: listed } = await supabase.storage
    .from("documents")
    .list(input.path.slice(0, slash), { search: input.path.slice(slash + 1), limit: 100 });
  const obj = (listed ?? []).find((o) => o.name === input.path.slice(slash + 1));
  if (!obj) return { error: "Fichier introuvable dans le stockage. Réessayez." };
  const meta = (obj.metadata ?? {}) as { size?: number; mimetype?: string };
  const realSize = Number(meta.size ?? input.sizeBytes) || 0;
  if (realSize <= 0 || realSize > MAX_SIZE) {
    await supabase.storage.from("documents").remove([input.path]);
    return { error: "Fichier vide ou trop lourd (25 Mo maximum)." };
  }
  const finalMime = meta.mimetype && ALLOWED_MIME.has(meta.mimetype) ? meta.mimetype : mime;

  // Export WhatsApp ? On télécharge le texte (petit) pour le versement chronologie.
  let whatsapp: ReturnType<typeof parseWhatsAppExport> = null;
  let bodyText: string | null = null;
  if (finalMime === "text/plain" && realSize <= MAX_TEXT) {
    try {
      const { data: blob } = await supabase.storage.from("documents").download(input.path);
      const text = blob ? await blob.text() : "";
      whatsapp = parseWhatsAppExport(text);
      if (whatsapp) bodyText = text;
    } catch {
      whatsapp = null;
    }
  }

  const authored = whatsapp ? whatsapp.messages.filter((m) => m.author).length : 0;
  const { error: dbErr } = await supabase.from("inbox_items").insert({
    organization_id: orgId,
    source: whatsapp ? "whatsapp" : "fichier",
    from_name: whatsapp ? whatsapp.participants.join(", ") : null,
    subject: whatsapp
      ? `Conversation WhatsApp · ${whatsapp.participants.join(", ")}`
      : input.fileName,
    excerpt: whatsapp
      ? `${authored} messages, du ${whatsapp.from.toLocaleDateString("fr-FR")} au ${whatsapp.to.toLocaleDateString("fr-FR")}`
      : `${finalMime.split("/")[1] ?? "fichier"} · ${(realSize / 1024).toFixed(0)} Ko`,
    body_text: bodyText,
    storage_path: input.path,
    mime_type: finalMime,
    size_bytes: realSize,
  });
  if (dbErr) {
    const { data: ref } = await supabase
      .from("inbox_items")
      .select("id")
      .eq("storage_path", input.path)
      .maybeSingle();
    if (!ref) await supabase.storage.from("documents").remove([input.path]);
    return { error: "Échec de l’enregistrement. Réessayez." };
  }

  revalidatePath("/app/inbox");
  return {
    success: whatsapp
      ? `Conversation WhatsApp reçue (${authored} messages). Classez-la, puis versez-la au bon dossier.`
      : `« ${input.fileName} » reçu dans la boîte.`,
  };
}

// ── Email collé (en attendant l'adresse de transfert active) ─────────────────

const emailSchema = z.object({
  fromName: z.string().trim().max(120).optional().default(""),
  subject: z.string().trim().min(1, "Indiquez un objet.").max(200),
  body: z.string().trim().min(1, "Collez le contenu de l’email.").max(50000),
});

export async function addPastedEmail(
  _prev: InboxState,
  formData: FormData,
): Promise<InboxState> {
  const parsed = emailSchema.safeParse({
    fromName: formData.get("fromName") ?? "",
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Vérifiez le formulaire." };
  }

  const orgId = await currentOrgId();
  if (!orgId) return { error: "Session expirée, reconnectez-vous." };
  const supabase = await createClient();

  const { error } = await supabase.from("inbox_items").insert({
    organization_id: orgId,
    source: "email",
    from_name: parsed.data.fromName || null,
    subject: parsed.data.subject,
    excerpt: parsed.data.body.replace(/\s+/g, " ").slice(0, 160),
    body_text: parsed.data.body,
  });
  if (error) return { error: "Échec de l’enregistrement. Réessayez." };

  revalidatePath("/app/inbox");
  return { success: "Email ajouté à la boîte de réception." };
}

// ── Libellés ─────────────────────────────────────────────────────────────────

const labelSchema = z.object({
  name: z.string().trim().min(1, "Nommez le libellé.").max(40),
  color: z.enum(["sable", "terracotta", "olive", "ardoise", "prune"]),
});

export async function createLabel(
  _prev: InboxState,
  formData: FormData,
): Promise<InboxState> {
  const parsed = labelSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") ?? "sable",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Vérifiez le libellé." };
  }

  const orgId = await currentOrgId();
  if (!orgId) return { error: "Session expirée, reconnectez-vous." };
  const supabase = await createClient();

  const { error } = await supabase.from("inbox_labels").insert({
    organization_id: orgId,
    name: parsed.data.name,
    color: parsed.data.color,
  });
  if (error) {
    return {
      error: error.code === "23505" ? "Ce libellé existe déjà." : "Échec de la création.",
    };
  }
  revalidatePath("/app/inbox");
  return { success: `Libellé « ${parsed.data.name} » créé.` };
}

export async function deleteLabel(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("inbox_labels").delete().eq("id", id.data);
  revalidatePath("/app/inbox");
}

// ── Actions sur un élément ───────────────────────────────────────────────────

export async function setItemLabel(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const raw = String(formData.get("labelId") ?? "");
  const labelId = raw === "" ? null : z.uuid().safeParse(raw).data ?? null;

  const supabase = await createClient();
  await supabase
    .from("inbox_items")
    .update({ label_id: labelId, is_read: true })
    .eq("id", id.data);
  revalidatePath("/app/inbox");
}

export async function toggleItemRead(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const read = String(formData.get("read")) === "true";
  const supabase = await createClient();
  await supabase.from("inbox_items").update({ is_read: read }).eq("id", id.data);
  revalidatePath("/app/inbox");
}

export async function toggleItemArchived(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const archived = String(formData.get("archived")) === "true";
  const supabase = await createClient();
  await supabase
    .from("inbox_items")
    .update({ is_archived: archived, is_read: true })
    .eq("id", id.data);
  revalidatePath("/app/inbox");
}

// ── Versement vers un dossier ────────────────────────────────────────────────

export async function assignItemToCase(
  _prev: InboxState,
  formData: FormData,
): Promise<InboxState> {
  const itemId = z.uuid().safeParse(formData.get("id"));
  const caseId = z.uuid().safeParse(formData.get("caseId"));
  if (!itemId.success) return { error: "Élément introuvable." };
  if (!caseId.success) return { error: "Choisissez un dossier." };

  const orgId = await currentOrgId();
  if (!orgId) return { error: "Session expirée, reconnectez-vous." };
  const supabase = await createClient();

  const [{ data: item }, { data: caseRow }] = await Promise.all([
    supabase.from("inbox_items").select("*").eq("id", itemId.data).maybeSingle(),
    supabase
      .from("cases")
      .select("id, title")
      .eq("id", caseId.data)
      .maybeSingle(),
  ]);
  if (!item) return { error: "Élément introuvable." };
  if (!caseRow) return { error: "Dossier inconnu." };

  // 1. Le fichier devient une pièce du dossier.
  if (item.storage_path) {
    const { error: docErr } = await supabase.from("documents").insert({
      organization_id: orgId,
      case_id: caseRow.id,
      file_name: item.subject,
      storage_path: item.storage_path,
      mime_type: item.mime_type ?? "application/octet-stream",
      size_bytes: item.size_bytes ?? 0,
      doc_class: item.source === "whatsapp" ? "whatsapp_export" : "other",
    });
    if (docErr && docErr.code !== "23505") {
      return { error: "Échec du versement de la pièce. Réessayez." };
    }
  }

  // 2. La chronologie du dossier s'enrichit.
  const whatsapp =
    item.source === "whatsapp" && item.body_text
      ? parseWhatsAppExport(item.body_text)
      : null;

  if (whatsapp) {
    const fmt = (d: Date) =>
      d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    const keys = pickKeyMessages(whatsapp);
    // PostgREST exige des clés identiques sur toutes les lignes d'un insert groupé.
    await supabase.from("case_events").insert([
      {
        case_id: caseRow.id,
        organization_id: orgId,
        event_type: "whatsapp_import",
        event_date: whatsapp.to.toISOString(),
        title: `Conversation WhatsApp importée · ${whatsapp.messages.filter((m) => m.author).length} messages`,
        description: `Échanges avec ${whatsapp.participants.join(", ")} du ${fmt(whatsapp.from)} au ${fmt(whatsapp.to)}.`,
        source: "user",
      },
      ...keys.map((k) => ({
        case_id: caseRow.id,
        organization_id: orgId,
        event_type: "whatsapp_message",
        event_date: k.date.toISOString(),
        title: `Message WhatsApp · ${k.author}`,
        description: `« ${k.text.slice(0, 200)}${k.text.length > 200 ? "…" : ""} »`,
        source: "ai",
      })),
    ]);
  } else if (item.source === "email") {
    await supabase.from("case_events").insert({
      case_id: caseRow.id,
      organization_id: orgId,
      event_type: "email",
      event_date: item.received_at,
      title: `Email versé : ${item.subject}`,
      description: item.excerpt
        ? `${item.from_name ? `De ${item.from_name} · ` : ""}« ${item.excerpt} »`
        : undefined,
      source: "user",
    });
  } else {
    await supabase.from("case_events").insert({
      case_id: caseRow.id,
      organization_id: orgId,
      event_type: "documents",
      title: `Pièce versée depuis la boîte de réception : ${item.subject}`,
      source: "user",
    });
  }

  // 3. L'élément est classé (lu + archivé + rattaché).
  await supabase
    .from("inbox_items")
    .update({ case_id: caseRow.id, is_read: true, is_archived: true })
    .eq("id", item.id);

  revalidatePath("/app/inbox");
  revalidatePath("/app/documents", "layout");
  revalidatePath(`/app/dossiers/${caseRow.id}`);
  return {
    success: whatsapp
      ? `Conversation versée au dossier « ${caseRow.title} » : chronologie mise à jour.`
      : `Versé au dossier « ${caseRow.title} ».`,
  };
}

// ── Analyse IA d'un email + fusion au dossier (popup) ────────────────────────

/**
 * Étape 1 : un agent lit l'email dans le contexte du dossier choisi et renvoie
 * les faits extraits (sourcés, éditables) SANS rien écrire. La fusion n'a lieu
 * qu'à la confirmation (confirmEmailMerge) → aucune pièce orpheline si on ferme
 * la popup. Sans clé IA, runAgent tourne en simulation (tracé dans agent_runs).
 */
export async function analyzeEmailForCase(input: {
  itemId: string;
  caseId: string;
}): Promise<EmailAnalysisResult> {
  const itemId = z.uuid().safeParse(input.itemId);
  const caseId = z.uuid().safeParse(input.caseId);
  if (!itemId.success || !caseId.success) return { error: "Élément ou dossier introuvable." };

  const orgId = await currentOrgId();
  if (!orgId) return { error: "Session expirée, reconnectez-vous." };
  const supabase = await createClient();

  const [{ data: item }, { data: caseRow }] = await Promise.all([
    supabase
      .from("inbox_items")
      .select("id, subject, body_text, from_name, received_at, source")
      .eq("id", itemId.data)
      .maybeSingle(),
    supabase
      .from("cases")
      .select("id, title, case_type, amount_claimed_cents")
      .eq("id", caseId.data)
      .maybeSingle(),
  ]);
  if (!item) return { error: "Élément introuvable." };
  if (!caseRow) return { error: "Dossier introuvable." };

  const text = item.body_text ?? "";
  const subject = item.subject ?? "Email";
  const claimedCents = Number(caseRow.amount_claimed_cents) || 0;

  // Faits du corps (texte) + lecture VISION des pièces jointes (Nora via bridge),
  // fusionnés (la lecture de la pièce prime par champ) : l'utilisateur voit et
  // corrige les infos lues DANS le PDF avant de verser.
  const textFacts = detectFacts(text, subject);
  const { data: atts } = await supabase
    .from("inbox_attachments")
    .select("file_name, storage_path, mime_type")
    .eq("inbox_item_id", itemId.data);
  const byField = new Map<string, (typeof textFacts)[number]>();
  for (const f of textFacts) byField.set(f.field_key, f);
  for (const a of atts ?? []) {
    const vf = await readDocumentFacts(supabase, {
      storagePath: a.storage_path,
      mime: a.mime_type,
      fileName: a.file_name,
      orgId,
      caseId: caseRow.id,
      claimedCents,
    });
    for (const f of vf) byField.set(f.field_key, f);
  }
  const facts = [...byField.values()];
  const det = analysePiece(subject, "echanges", facts, claimedCents, text);

  const isDispute = caseRow.case_type === "client_dispute";
  const agent: "nora" | "lena" = isDispute ? "lena" : "nora";

  const mergeAlertes = (alertes: string[]) => {
    const coherence = [...det.coherence];
    // Garde-fou #2 : alertes IA filtrées (conseil/pronostic) avant affichage.
    for (const a of keepClean(alertes)) {
      if (!coherence.some((c) => c.message === a)) {
        coherence.push({ level: "warn", message: a });
      }
    }
    det.coherence = coherence;
  };

  try {
    if (isDispute) {
      const { data } = await runAgent({
        key: "lena",
        input: {
          consigne:
            "Tu lis un email d'un dossier de litige. Résume-le en une phrase neutre et signale toute incohérence avec le dossier. Réponds en JSON { resume_court: string, alertes: string[] }. N'invente jamais une valeur.",
          objet: subject,
          montant_reclame_cents: claimedCents,
          champs_detectes: det.facts,
          extrait: text ? text.slice(0, 4000) : "(email sans corps lisible)",
        },
        schema: LENA_SCHEMA,
        simulation: {
          resume_court: "",
          alertes: det.coherence.filter((c) => c.level === "warn").map((c) => c.message),
        },
        organizationId: orgId,
        caseId: caseRow.id,
      });
      mergeAlertes(data.alertes);
    } else {
      const { data } = await runAgent({
        key: "nora",
        input: {
          consigne:
            "Tu analyses un email versé à un dossier. Confirme s'il apporte des éléments cohérents avec le dossier et signale toute incohérence. Réponds en JSON { type_confirme: bool, alertes: string[] }. N'invente jamais une valeur.",
          type_declare: det.kindLabel,
          montant_reclame_cents: claimedCents,
          champs_detectes: det.facts,
          extrait: text ? text.slice(0, 4000) : "(email sans corps lisible)",
        },
        schema: NORA_SCHEMA,
        simulation: {
          type_confirme: det.kindConfirmed,
          alertes: det.coherence.filter((c) => c.level === "warn").map((c) => c.message),
        },
        organizationId: orgId,
        caseId: caseRow.id,
      });
      mergeAlertes(data.alertes);
    }
  } catch {
    // Le run en erreur est déjà tracé par runAgent ; on garde le socle déterministe.
  }

  const amountFact = facts.find((f) => f.field_key === "amount_cents");
  const amountCents = amountFact?.value_normalized
    ? (amountFact.value_normalized as { cents?: number }).cents
    : undefined;

  return {
    analysis: det,
    facts: facts.map((f) => ({
      field_key: f.field_key,
      label: FIELD_LABEL[f.field_key] ?? f.field_key,
      value_text: f.value_text,
      value_normalized: f.value_normalized,
      confidence: f.confidence,
      source_excerpt: f.source_excerpt,
    })),
    suggestedDocKind: "echanges",
    suggestedAmountCents: typeof amountCents === "number" && amountCents > 0 ? amountCents : null,
    caseAmountCents: claimedCents,
    agent,
  };
}

const editableFactSchema = z.object({
  field_key: z.string().max(60),
  value_text: z.string().max(2000),
  value_normalized: z.record(z.string(), z.unknown()).nullable(),
  confidence: z.number(),
  source_excerpt: z.string().nullable(),
  corrected: z.string().max(2000).nullable().optional(),
});

const confirmSchema = z.object({
  itemId: z.uuid(),
  caseId: z.uuid(),
  docKind: z.string().max(40),
  applyAmountCents: z.number().int().nonnegative().nullable(),
  facts: z.array(editableFactSchema).max(20),
});

/**
 * Étape 2 : la fusion réelle, avec les corrections de l'utilisateur. Le corps de
 * l'email devient une pièce texte du dossier, ses pièces jointes des pièces à
 * part entière, les valeurs extraites (corrigées) des extractions sourcées.
 * cases.* n'est JAMAIS écrasé en silence (pilier #3).
 */
export async function confirmEmailMerge(input: {
  itemId: string;
  caseId: string;
  docKind: string;
  applyAmountCents: number | null;
  facts: EditableFact[];
}): Promise<InboxState> {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides. Réessayez." };
  const { itemId, caseId, docKind, applyAmountCents, facts } = parsed.data;

  const orgId = await currentOrgId();
  if (!orgId) return { error: "Session expirée, reconnectez-vous." };
  const supabase = await createClient();

  const [{ data: item }, { data: caseRow }] = await Promise.all([
    supabase.from("inbox_items").select("*").eq("id", itemId).maybeSingle(),
    supabase.from("cases").select("id, title, amount_claimed_cents").eq("id", caseId).maybeSingle(),
  ]);
  if (!item) return { error: "Élément introuvable." };
  if (!caseRow) return { error: "Dossier introuvable." };

  // 1. Le corps de l'email devient une pièce texte du dossier.
  const body = item.body_text ?? "";
  const bodyPath = `${orgId}/${caseRow.id}/${crypto.randomUUID()}-email.txt`;
  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(bodyPath, new Blob([body], { type: "text/plain" }), {
      contentType: "text/plain",
      upsert: false,
    });
  if (upErr) return { error: "Échec de l’enregistrement de l’email. Réessayez." };

  const { data: bodyDoc, error: docErr } = await supabase
    .from("documents")
    .insert({
      organization_id: orgId,
      case_id: caseRow.id,
      file_name: item.subject,
      storage_path: bodyPath,
      mime_type: "text/plain",
      size_bytes: new TextEncoder().encode(body).length,
      doc_class: "other",
      doc_kind: docKind,
    })
    .select("id")
    .single();
  if (docErr || !bodyDoc) {
    await supabase.storage.from("documents").remove([bodyPath]);
    return { error: "Échec du versement. Réessayez." };
  }

  // 2. Les pièces jointes deviennent des pièces du dossier (objet Storage réutilisé).
  //    Une PJ PDF/image dont un montant a été lu est classée « facture » (les faits
  //    viennent d'elle) ; sinon « echanges ». On mémorise l'id de la facture pour y
  //    rattacher les extractions (sinon la checklist croit la facture manquante).
  const hasAmount = facts.some((f) => f.field_key === "amount_cents");
  const INVOICE_MIME = /pdf|image\//i;
  const { data: attachments } = await supabase
    .from("inbox_attachments")
    .select("file_name, storage_path, mime_type, size_bytes")
    .eq("inbox_item_id", item.id);
  let factureDocId: string | null = null;
  for (const a of attachments ?? []) {
    const isInvoiceLike = hasAmount && INVOICE_MIME.test(a.mime_type || "");
    const { data: attDoc, error: aErr } = await supabase
      .from("documents")
      .insert({
        organization_id: orgId,
        case_id: caseRow.id,
        file_name: a.file_name,
        storage_path: a.storage_path,
        mime_type: a.mime_type,
        size_bytes: a.size_bytes,
        doc_class: "other",
        doc_kind: isInvoiceLike ? "facture" : "echanges",
      })
      .select("id")
      .single();
    if (aErr) {
      // Idempotence : PJ déjà versée (23505) → on récupère son id pour les extractions.
      if (aErr.code === "23505" && isInvoiceLike && !factureDocId) {
        const { data: exist } = await supabase
          .from("documents")
          .select("id")
          .eq("storage_path", a.storage_path)
          .maybeSingle();
        if (exist) factureDocId = exist.id;
      }
      continue;
    }
    if (isInvoiceLike && attDoc && !factureDocId) factureDocId = attDoc.id;
  }

  // 3. Valeurs extraites (sourcées) ; une correction saisie prime dès l'écriture.
  //    Rattachées à la facture (PJ) si on l'a identifiée, sinon au corps.
  const extractionDocId = factureDocId ?? bodyDoc.id;
  if (facts.length > 0) {
    await supabase.from("document_extractions").insert(
      facts.map((f) => {
        const corrected = f.corrected?.trim() || null;
        return {
          organization_id: orgId,
          document_id: extractionDocId,
          field_key: f.field_key,
          value_text: f.value_text,
          value_normalized: f.value_normalized,
          confidence: f.confidence,
          source_excerpt: f.source_excerpt,
          corrected_value: corrected,
          is_user_corrected: !!corrected,
        };
      }),
    );
  }

  // 4. La chronologie du dossier s'enrichit.
  await supabase.from("case_events").insert({
    case_id: caseRow.id,
    organization_id: orgId,
    event_type: "email",
    event_date: item.received_at,
    title: `Email versé : ${item.subject}`,
    description: item.excerpt
      ? `${item.from_name ? `De ${item.from_name} · ` : ""}« ${item.excerpt} »`
      : item.from_name
        ? `De ${item.from_name}`
        : undefined,
    source: "user",
  });

  // 5. Montant : jamais d'écrasement silencieux — posé seulement s'il est absent.
  //    La CORRECTION utilisateur prime (pilier #3) : si le montant a été édité
  //    dans la popup, c'est cette valeur (et non la valeur brute lue) qui est posée.
  if (applyAmountCents !== null && (Number(caseRow.amount_claimed_cents) || 0) === 0) {
    let effective = applyAmountCents;
    const amountFact = facts.find((f) => f.field_key === "amount_cents");
    if (amountFact?.corrected?.trim()) {
      const c = amountToCents(amountFact.corrected.trim(), false); // saisi en euros
      if (c !== null && c > 0) effective = c;
    }
    if (effective > 0) {
      await supabase.from("cases").update({ amount_claimed_cents: effective }).eq("id", caseRow.id);
    }
  }

  // 6. L'élément est classé (lu + archivé + rattaché).
  await supabase
    .from("inbox_items")
    .update({ case_id: caseRow.id, is_read: true, is_archived: true })
    .eq("id", item.id);

  await recomputeCaseProgress(caseRow.id);
  revalidatePath("/app/inbox");
  revalidatePath("/app/documents", "layout");
  revalidatePath(`/app/dossiers/${caseRow.id}`);
  return { success: `Versé au dossier « ${caseRow.title} ».` };
}

export async function deleteInboxItem(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("inbox_items")
    .select("id, storage_path, case_id")
    .eq("id", id.data)
    .maybeSingle();
  if (!item) return;

  await supabase.from("inbox_items").delete().eq("id", item.id);
  // Le fichier ne part que s'il n'a pas été versé comme pièce d'un dossier.
  if (item.storage_path && !item.case_id) {
    await supabase.storage.from("documents").remove([item.storage_path]);
  }
  revalidatePath("/app/inbox");
}

// ── Exemples (démo de la boîte) ──────────────────────────────────────────────

export async function createSampleInbox(): Promise<void> {
  const orgId = await currentOrgId();
  if (!orgId) return;
  const supabase = await createClient();

  const now = Date.now();
  const iso = (hoursAgo: number) => new Date(now - hoursAgo * 3600_000).toISOString();

  await supabase.from("inbox_items").insert([
    {
      organization_id: orgId,
      source: "email",
      from_name: "SARL Bâti Concept",
      from_contact: "compta@bati-concept.example",
      subject: "RE: Facture F-2026-042",
      excerpt: "Bonjour, je vous règle la semaine prochaine, promis. Désolé pour le retard…",
      body_text:
        "Bonjour,\n\nJe vous règle la semaine prochaine, promis. Désolé pour le retard, on attend nous-mêmes un gros paiement.\n\nCordialement,\nM. Faure — SARL Bâti Concept",
      is_sample: true,
      received_at: iso(3),
    },
    {
      organization_id: orgId,
      source: "whatsapp",
      from_name: "M. Faure",
      subject: "Conversation WhatsApp · M. Faure",
      excerpt: "14 messages, du 12/05/2026 au 19/06/2026",
      body_text: null,
      is_sample: true,
      is_read: true,
      received_at: iso(26),
    },
    {
      organization_id: orgId,
      source: "fichier",
      subject: "IMG_2841 — réception chantier.jpeg",
      excerpt: "jpeg · 2 340 Ko",
      is_sample: true,
      received_at: iso(50),
    },
  ]);
  revalidatePath("/app/inbox");
}

export async function deleteSampleInbox(): Promise<void> {
  const orgId = await currentOrgId();
  if (!orgId) return;
  const supabase = await createClient();
  await supabase
    .from("inbox_items")
    .delete()
    .eq("organization_id", orgId)
    .eq("is_sample", true);
  revalidatePath("/app/inbox");
}
