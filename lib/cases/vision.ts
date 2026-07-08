import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runAgent } from "@/lib/ai/client";
import type { Fact } from "@/lib/cases/extraction";

/*
 * Lecture vision d'une pièce (facture/devis/preuve) : Nora lit le CONTENU
 * du PDF ou de l'image et en extrait les faits chiffrés, sourcés et éditables
 * (la correction utilisateur prime toujours, comme pour l'extraction texte).
 * Repli silencieux (tableau vide) si non lisible, trop lourd ou en cas d'échec.
 */

const VISION_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const MAX_VISION_BYTES = 8 * 1024 * 1024;

const VISION_SCHEMA = z.object({
  montant_cents: z.number().nullable(),
  date_iso: z.string().nullable(),
  numero_facture: z.string().nullable(),
  partie: z.string().nullable(),
});

function eurFromCents(cents: number): string {
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`;
}

export async function readDocumentFacts(
  sb: SupabaseClient,
  input: {
    storagePath: string;
    mime: string;
    fileName: string;
    orgId: string;
    caseId: string;
    claimedCents: number;
  },
): Promise<Fact[]> {
  if (!VISION_MIME.has(input.mime)) return [];
  try {
    const { data: blob } = await sb.storage.from("documents").download(input.storagePath);
    if (!blob) return [];
    const buf = Buffer.from(await blob.arrayBuffer());
    if (buf.length <= 0 || buf.length > MAX_VISION_BYTES) return [];

    // Nora, via le bridge Hermes, mais sur un modèle VISION OpenRouter pour CET
    // appel (le bridge route le multimodal) — aucune API directe depuis l'app.
    const { data } = await runAgent({
      key: "nora",
      input: {
        consigne:
          "Lis cette pièce et extrais UNIQUEMENT ce qui y est écrit : montant total TTC en centimes (montant_cents), date de la pièce (date_iso, AAAA-MM-JJ), numéro de facture (numero_facture), nom de la partie émettrice ou débitrice (partie). Mets null pour tout champ non lisible. JSON { montant_cents, date_iso, numero_facture, partie }.",
        nom_fichier: input.fileName,
        montant_reclame_cents: input.claimedCents,
      },
      schema: VISION_SCHEMA,
      simulation: { montant_cents: null, date_iso: null, numero_facture: null, partie: null },
      organizationId: input.orgId,
      caseId: input.caseId,
      attachments: [{ mime: input.mime, dataBase64: buf.toString("base64") }],
      modelOverride: "google/gemini-2.5-flash-lite",
      maxTokens: 500,
    });

    const facts: Fact[] = [];
    if (typeof data.montant_cents === "number" && data.montant_cents > 0) {
      facts.push({
        field_key: "amount_cents",
        value_text: eurFromCents(data.montant_cents),
        value_normalized: { cents: data.montant_cents },
        confidence: 0.9,
        source_excerpt: "Lu dans la pièce",
      });
    }
    if (data.date_iso && /^\d{4}-\d{2}-\d{2}$/.test(data.date_iso)) {
      facts.push({
        field_key: "date",
        value_text: data.date_iso,
        value_normalized: { iso: data.date_iso },
        confidence: 0.85,
        source_excerpt: "Lu dans la pièce",
      });
    }
    if (data.numero_facture && data.numero_facture.trim()) {
      const v = data.numero_facture.trim();
      facts.push({
        field_key: "invoice_number",
        value_text: v,
        value_normalized: { number: v },
        confidence: 0.85,
        source_excerpt: "Lu dans la pièce",
      });
    }
    if (data.partie && data.partie.trim()) {
      const v = data.partie.trim();
      facts.push({
        field_key: "party_name",
        value_text: v,
        value_normalized: { name: v },
        confidence: 0.8,
        source_excerpt: "Lu dans la pièce",
      });
    }
    return facts;
  } catch {
    return [];
  }
}
