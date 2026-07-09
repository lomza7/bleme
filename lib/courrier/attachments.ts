import "server-only";
import { createHash } from "node:crypto";
import type { createClient } from "@/lib/supabase/server";
import type { AttachmentSnapshot } from "@/lib/courrier/attachment-rules";

/*
 * Chargement des annexes d'un courrier : les pièces sélectionnées sont lues
 * depuis le Storage AVANT le log d'approbation, et chaque fichier est haché
 * (sha256) — la preuve gravée dans approval_logs couvre les annexes exactes
 * qui partent, pas seulement le corps du courrier.
 */

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Annexe chargée en mémoire, prête à joindre (email) ou à imprimer (postal). */
export type LoadedAttachment = {
  documentId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  base64: string;
  sha256: string;
};

/**
 * Charge les annexes sélectionnées. Vérifie que chaque pièce appartient BIEN
 * au dossier du courrier (en plus de la RLS org) : impossible de joindre la
 * pièce d'un autre dossier, même avec un id valide.
 */
export async function loadCaseAttachments(
  supabase: Supa,
  caseId: string,
  documentIds: string[],
): Promise<{ attachments: LoadedAttachment[] } | { error: string }> {
  const { data: rows, error } = await supabase
    .from("documents")
    .select("id, file_name, mime_type, size_bytes, storage_path")
    .eq("case_id", caseId)
    .in("id", documentIds);
  if (error || !rows) return { error: "Impossible de lire les pièces du dossier." };
  const byId = new Map(rows.map((r) => [r.id as string, r]));
  const attachments: LoadedAttachment[] = [];
  for (const id of documentIds) {
    const row = byId.get(id);
    if (!row) return { error: "Une annexe sélectionnée n'appartient pas à ce dossier." };
    const { data: blob, error: dlErr } = await supabase.storage
      .from("documents")
      .download(row.storage_path);
    if (dlErr || !blob) {
      return { error: `Impossible de récupérer l'annexe « ${row.file_name} ». Réessayez.` };
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    attachments.push({
      documentId: row.id,
      fileName: row.file_name,
      mimeType: row.mime_type,
      sizeBytes: buf.byteLength,
      base64: buf.toString("base64"),
      sha256: createHash("sha256").update(buf).digest("hex"),
    });
  }
  return { attachments };
}

/** Snapshot auditable (approval_logs + letters) : ce qui a été approuvé, fichier par fichier. */
export function attachmentSnapshots(attachments: LoadedAttachment[]): AttachmentSnapshot[] {
  return attachments.map((a) => ({
    document_id: a.documentId,
    file_name: a.fileName,
    mime_type: a.mimeType,
    size_bytes: a.sizeBytes,
    sha256: a.sha256,
  }));
}
