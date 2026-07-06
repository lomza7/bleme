"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseWhatsAppExport, pickKeyMessages } from "@/lib/whatsapp/parser";
import { ALLOWED_MIME, MAX_SIZE, resolveMime } from "@/lib/documents/mime";

/*
 * Boîte de réception : import de fichiers et d'emails collés, libellés de
 * tri, versement vers un dossier. Même pipeline que lib/documents/actions
 * (Storage 'documents', chemin {org}/inbox/..., upload DIRECT navigateur→Storage),
 * avec détection WhatsApp.
 */

export type InboxState = { error?: string; success?: string };

const MAX_TEXT = 2 * 1024 * 1024;

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
