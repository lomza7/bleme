"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseWhatsAppExport, pickKeyMessages } from "@/lib/whatsapp/parser";

/*
 * Boîte de réception : import de fichiers et d'emails collés, libellés de
 * tri, versement vers un dossier. Même pipeline que lib/documents/actions
 * (Storage 'documents', chemin {org}/inbox/...), avec détection WhatsApp.
 */

export type InboxState = { error?: string; success?: string };

const MAX_SIZE = 25 * 1024 * 1024;
const MAX_TEXT = 2 * 1024 * 1024;
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

// ── Import d'un fichier (pièce, export WhatsApp) ─────────────────────────────

export async function importInboxFile(
  _prev: InboxState,
  formData: FormData,
): Promise<InboxState> {
  const file = formData.get("file");
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

  // Export WhatsApp ? On garde le texte pour le versement en chronologie.
  let whatsapp: ReturnType<typeof parseWhatsAppExport> = null;
  let bodyText: string | null = null;
  if (file.type === "text/plain" && file.size <= MAX_TEXT) {
    try {
      const text = await file.text();
      whatsapp = parseWhatsAppExport(text);
      if (whatsapp) bodyText = text;
    } catch {
      whatsapp = null;
    }
  }

  const path = `${orgId}/inbox/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(path, file, { contentType: file.type });
  if (upErr) return { error: "Échec de l’envoi. Réessayez." };

  const authored = whatsapp
    ? whatsapp.messages.filter((m) => m.author).length
    : 0;
  const { error: dbErr } = await supabase.from("inbox_items").insert({
    organization_id: orgId,
    source: whatsapp ? "whatsapp" : "fichier",
    from_name: whatsapp ? whatsapp.participants.join(", ") : null,
    subject: whatsapp
      ? `Conversation WhatsApp · ${whatsapp.participants.join(", ")}`
      : file.name,
    excerpt: whatsapp
      ? `${authored} messages, du ${whatsapp.from.toLocaleDateString("fr-FR")} au ${whatsapp.to.toLocaleDateString("fr-FR")}`
      : `${file.type.split("/")[1] ?? "fichier"} · ${(file.size / 1024).toFixed(0)} Ko`,
    body_text: bodyText,
    storage_path: path,
    mime_type: file.type,
    size_bytes: file.size,
  });
  if (dbErr) {
    await supabase.storage.from("documents").remove([path]);
    return { error: "Échec de l’enregistrement. Réessayez." };
  }

  revalidatePath("/app/inbox");
  return {
    success: whatsapp
      ? `Conversation WhatsApp reçue (${authored} messages). Classez-la, puis versez-la au bon dossier.`
      : `« ${file.name} » reçu dans la boîte.`,
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
