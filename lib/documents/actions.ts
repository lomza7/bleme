"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { parseWhatsAppExport, pickKeyMessages } from "@/lib/whatsapp/parser";
import { detectFacts } from "@/lib/cases/extraction";
import { readDocumentFacts } from "@/lib/cases/vision";
import { touchCase } from "@/lib/cases/touch";
import { analysePiece, guessDocKind, normalizeDocKind } from "@/lib/cases/analysis";
import { DOC_KINDS } from "@/lib/cases/completeness";
import type { PieceAnalysis } from "@/lib/cases/analysis-types";
import { runAgent } from "@/lib/ai/client";
import { keepClean } from "@/lib/ai/guardrails";
import { ALLOWED_MIME, MAX_SIZE, resolveMime } from "@/lib/documents/mime";

export type DocState = { error?: string; success?: string; analysis?: PieceAnalysis };

// Le modèle renvoie parfois les alertes comme objets ({ message, ... }) plutôt
// que comme chaînes : on les ramène à une phrase plutôt que de rejeter TOUT le
// run (sinon on perdait aussi le classement type_piece pour une broutille).
function alerteToString(v: unknown): string {
  if (typeof v === "string") return v.slice(0, 300);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const s = o.message ?? o.alerte ?? o.text ?? o.detail ?? o.description ?? o.label;
    if (typeof s === "string") return s.slice(0, 300);
    return Object.values(o).filter((x) => typeof x === "string").join(" — ").slice(0, 300);
  }
  return String(v ?? "").slice(0, 300);
}

// Sortie attendue de l'agent Nora (run réel, tracé dans agent_runs) : elle
// CLASSE la pièce (type_piece), confirme qu'elle est exploitable et signale les
// incohérences. Plus de type déclaré par l'utilisateur : l'agent s'en charge.
const NORA_SCHEMA = z.object({
  type_piece: z.string().max(40).nullable().default(null),
  type_confirme: z.boolean(),
  alertes: z
    .preprocess(
      (v) => (Array.isArray(v) ? v.map(alerteToString).filter(Boolean).slice(0, 6) : []),
      z.array(z.string().max(300)),
    )
    .default([]),
});

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
  // Revalidation serveur (l'action est invocable directement, pas seulement via l'UI).
  if (!ALLOWED_MIME.has(mime)) {
    return { error: "Format non pris en charge (PDF, images, Word, email, texte)." };
  }
  const orgId = await currentOrgId();
  if (!orgId) return { error: "Session expirée, reconnectez-vous." };

  const supabase = await createClient();
  let caseId: string | null = null;
  let claimedCents = 0;
  let caseType = "unpaid_invoice";
  if (input.scope !== "company") {
    const parsed = z.uuid().safeParse(input.scope);
    if (!parsed.success) return { error: "Dossier inconnu." };
    const { data: c } = await supabase
      .from("cases")
      .select("id, amount_claimed_cents, case_type")
      .eq("id", parsed.data)
      .maybeSingle();
    if (!c) return { error: "Dossier inconnu." };
    caseId = c.id;
    claimedCents = Number(c.amount_claimed_cents) || 0;
    caseType = c.case_type;
  }

  // Le chemin doit correspondre EXACTEMENT au scope résolu (org + dossier|company) :
  // un client ne finalise ni un chemin d'une autre org, ni d'un autre dossier.
  if (!input.path.startsWith(`${orgId}/${caseId ?? "company"}/`)) {
    return { error: "Chemin de fichier invalide." };
  }

  // Idempotence : si une pièce référence déjà ce chemin (rejeu, double-submit,
  // retry réseau), on ne réinsère pas, on ne relance pas Nora, et on ne supprime
  // SURTOUT PAS l'objet (ce serait détruire une pièce existante).
  const { data: already } = await supabase
    .from("documents")
    .select("id")
    .eq("storage_path", input.path)
    .maybeSingle();
  if (already) return { success: `« ${input.fileName} » déjà enregistré.` };

  // L'objet doit exister réellement dans le Storage (pas de ligne fantôme). On
  // dérive taille + type de l'objet STOCKÉ (les métadonnées client ne font pas foi).
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

  // Texte lisible (WhatsApp + extraction) : on télécharge l'objet si c'est du texte.
  let fileText = "";
  if (finalMime === "text/plain") {
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
      mime_type: finalMime,
      size_bytes: realSize,
      doc_class: whatsapp ? "whatsapp_export" : "other",
      doc_kind: input.docKind,
    })
    .select("id")
    .single();
  if (dbErr || !doc) {
    // On ne supprime l'objet que si AUCUNE ligne ne le référence (sinon une
    // collision d'unicité détruirait la pièce existante).
    const { data: ref } = await supabase
      .from("documents")
      .select("id")
      .eq("storage_path", input.path)
      .maybeSingle();
    if (!ref) await supabase.storage.from("documents").remove([input.path]);
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
    // Extraction texte (déterministe) + lecture VISION du contenu (Nora via le
    // bridge, sur PDF/image). La lecture vision prime par champ (pièce réelle),
    // le texte complète les champs manquants.
    const textFacts = detectFacts(fileText, input.fileName);
    const { facts: visionFacts, summary: docSummary } = await readDocumentFacts(supabase, {
      storagePath: input.path,
      mime: finalMime,
      fileName: input.fileName,
      orgId,
      caseId,
      claimedCents,
    });
    // Résumé factuel de la pièce (ce qu'elle établit) → alimente le contexte
    // partagé (synthèse vivante) et donc les courriers, au-delà des seuls champs.
    if (docSummary) {
      // Valeur calculée serveur (Nora) : écrite via le service client car
      // public.documents n'a pas de policy UPDATE côté utilisateur (une update
      // RLS-bloquée renverrait 0 ligne sans erreur). Scopée à ce doc de l'org.
      await createServiceClient().from("documents").update({ summary: docSummary }).eq("id", doc.id);
    }
    const byField = new Map<string, (typeof textFacts)[number]>();
    for (const f of textFacts) byField.set(f.field_key, f);
    for (const f of visionFacts) byField.set(f.field_key, f);
    const facts = [...byField.values()];
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
    // Classement AUTOMATIQUE : plus de sélecteur de type à l'écran. Nora lit le
    // contenu et classe la pièce ; un socle déterministe (guessDocKind) prend le
    // relais si l'agent échoue. Le doc_kind pilote la checklist « pièces
    // suggérées » — c'est lui qu'on persiste pour la faire avancer.
    const docClass = whatsapp ? "whatsapp_export" : "other";
    let effectiveKind = input.docKind ?? guessDocKind({
      fileName: input.fileName,
      text: fileText,
      facts,
      docClass,
      mime: finalMime,
      caseType,
    });
    let det = analysePiece(input.fileName, effectiveKind, facts, claimedCents, fileText);
    // Run RÉEL de Nora (tracé dans agent_runs) : elle classe la pièce et peut
    // ajouter des alertes. Le déterministe reste le socle si l'agent échoue.
    try {
      const { data: nora } = await runAgent({
        key: "nora",
        input: {
          consigne:
            "Tu analyses une pièce déposée dans un dossier. 1) CLASSE-la dans UNE seule des catégories fournies (renvoie la valeur exacte dans type_piece). 2) Confirme si le contenu est exploitable et cohérent avec le dossier, et signale toute incohérence factuelle (montant, date, destinataire). Aucun conseil, aucun pronostic. Réponds en JSON { type_piece, type_confirme, alertes }.",
          categories_possibles: DOC_KINDS,
          montant_reclame_cents: claimedCents,
          champs_detectes: det.facts,
          extrait: fileText ? fileText.slice(0, 4000) : "(document non textuel : contenu non lisible)",
        },
        schema: NORA_SCHEMA,
        simulation: {
          type_piece: effectiveKind,
          type_confirme: det.kindConfirmed,
          alertes: det.coherence.filter((c) => c.level === "warn").map((c) => c.message),
        },
        organizationId: orgId,
        caseId,
      });
      // Le classement de l'agent prime (il a vu le contenu) s'il est valide ;
      // sinon on garde le socle déterministe. Jamais de classement fantaisiste.
      const noraKind = normalizeDocKind(nora.type_piece);
      if (!input.docKind && noraKind) {
        effectiveKind = noraKind;
        det = analysePiece(input.fileName, effectiveKind, facts, claimedCents, fileText);
      }
      const coherence = [...det.coherence];
      // Garde-fou #2 : les alertes de Nora affichées à l'utilisateur passent le
      // filtre anti-conseil avant fusion.
      for (const a of keepClean(nora.alertes)) {
        if (!coherence.some((c) => c.message === a)) coherence.push({ level: "warn", message: a });
      }
      // On reste conservateur : le type n'est « confirmé » que si le socle
      // déterministe ET l'agent le confirment (pas de fausse validation).
      analysis = { ...det, kindConfirmed: det.kindConfirmed && nora.type_confirme, coherence };
    } catch {
      // Le run en erreur est déjà tracé par runAgent ; on garde le socle.
      analysis = det;
    }
    // Persiste le classement retenu (service client : public.documents n'a pas de
    // policy UPDATE côté utilisateur — une update RLS renverrait 0 ligne sans
    // erreur). AVANT touchCase pour que la complétude voie le nouveau doc_kind.
    if (!input.docKind && effectiveKind) {
      await createServiceClient().from("documents").update({ doc_kind: effectiveKind }).eq("id", doc.id);
    }
    await touchCase(caseId, { type: "document_added", label: `Pièce ajoutée : ${input.fileName}` });
    revalidatePath(`/app/dossiers/${caseId}`);
  }

  revalidatePath("/app/documents", "layout");
  return { success: message, analysis };
}

/** Corrige une valeur extraite : la correction utilisateur prime toujours. */
export async function correctExtraction(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  const caseIdParsed = z.uuid().safeParse(formData.get("caseId"));
  const value = String(formData.get("value") ?? "").trim();
  if (!id.success || !value) return;
  const supabase = await createClient();
  await supabase
    .from("document_extractions")
    .update({ corrected_value: value, is_user_corrected: true })
    .eq("id", id.data);
  if (caseIdParsed.success) {
    // La correction prime (pilier #3) : on recompute → refreshLivingBrief (after)
    // régénère la synthèse et le memo servis aux agents sur la valeur corrigée.
    await touchCase(caseIdParsed.data, { type: "user_correction", label: "Correction d'une information extraite" });
    revalidatePath(`/app/dossiers/${caseIdParsed.data}`);
  }
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
    await touchCase(doc.case_id, { type: "document_removed", label: "Pièce retirée du dossier" });
    revalidatePath(`/app/dossiers/${doc.case_id}`);
  }
}
