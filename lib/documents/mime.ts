// Limites et types de pièces — source UNIQUE partagée par le dépôt de dossier
// (lib/documents/actions.ts) et la boîte de réception (lib/inbox/actions.ts),
// alignée sur allowed_mime_types / file_size_limit du bucket Storage 'documents'.
// Module pur (pas de "use server") : importable partout.

export const MAX_SIZE = 25 * 1024 * 1024;

export const ALLOWED_MIME = new Set([
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

export function resolveMime(fileName: string, providedType: string): string {
  if (providedType && ALLOWED_MIME.has(providedType)) return providedType;
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return MIME_BY_EXT[ext] ?? providedType ?? "";
}
