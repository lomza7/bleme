/*
 * Règles de sélection des annexes d'un courrier — module PUR (importé côté
 * client par le tableau de sélection ET côté serveur pour la re-validation).
 * L'éligibilité dépend du canal :
 *  - email : tous les formats du coffre, plafond de poids global (Resend) ;
 *  - recommandé : uniquement ce qui s'imprime — PDF tel quel, JPEG/PNG mis en
 *    page sur A4. Word/HEIC/eml/txt ne partent pas au papier.
 */

/** Pièce du dossier proposée à la sélection dans l'écran de validation. */
export type AttachableDoc = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kindLabel: string | null;
};

/** Snapshot d'une annexe approuvée, figé dans letters.attachments + approval_logs. */
export type AttachmentSnapshot = {
  document_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
};

/** Formats imprimables en recommandé : PDF joint tel quel, images mises en page A4. */
export const POSTAL_ATTACHABLE_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

/** Nombre maximal d'annexes par courrier (lisibilité du pli + poids de l'email). */
export const MAX_ATTACHMENTS = 10;

/**
 * Poids total maximal des annexes d'un EMAIL (octets bruts). Resend plafonne
 * l'email complet à 40 Mo après encodage base64 (+~37 %) : 25 Mo bruts
 * laissent la marge du corps et des en-têtes.
 */
export const EMAIL_ATTACHMENTS_MAX_BYTES = 25 * 1024 * 1024;

export function postalAttachable(mime: string): boolean {
  return POSTAL_ATTACHABLE_MIME.has(mime);
}

// Libellés courts des catégories de pièces. Miroir client de DOC_KINDS
// (lib/cases/completeness.ts, server-only donc non importable ici — même
// contrainte que components/app/email-analysis-modal.tsx).
const KIND_LABEL: Record<string, string> = {
  facture: "Facture",
  devis_contrat: "Devis / contrat",
  preuve_envoi: "Preuve d’envoi",
  preuve_livraison: "Preuve de livraison",
  echanges: "Échanges",
  decision_admin: "Décision administrative",
  justificatif: "Justificatif",
  autre: "Autre pièce",
};

export function docKindLabel(kind: string | null | undefined): string | null {
  return kind ? (KIND_LABEL[kind] ?? null) : null;
}

/** Lignes `documents` (Supabase) → pièces proposables dans l'écran de validation. */
export function toAttachableDocs(
  rows:
    | {
        id: string;
        doc_kind?: string | null;
        file_name: string;
        mime_type: string;
        size_bytes: number;
      }[]
    | null
    | undefined,
): AttachableDoc[] {
  return (rows ?? []).map((r) => ({
    id: r.id,
    fileName: r.file_name,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    kindLabel: docKindLabel(r.doc_kind),
  }));
}
