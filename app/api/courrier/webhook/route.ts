import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getSecret } from "@/lib/secrets";
import {
  ALERT_STAGES,
  KNOWN_POSTAL_EVENTS,
  notifyLevelFor,
  postalStageFor,
} from "@/lib/courrier/tracking";
import { recomputeLetterTrackingStatus } from "@/lib/courrier/tracking-aggregate";
import { LETTER_KINDS } from "@/lib/cases/letter-meta";
import { notifyOrganization } from "@/lib/notifications/notify";
import { enqueueWebhook } from "@/lib/webhooks/enqueue";

/*
 * Webhook Merci Facteur (suivi des courriers postaux) : chaque événement est
 * normalisé en étape de suivi structurée (letter_tracking_events, idempotent),
 * fait monter le statut agrégé du courrier (letters.tracking_status, machine
 * à états monotone), alimente la chronologie du dossier, archive les preuves
 * (AR signé, preuve de dépôt) en pièces du dossier, et notifie l'utilisateur
 * (cloche + email pour les étapes marquantes).
 *
 * Sécurité : header X-Mf-Webhook-Secret-Key comparé (temps constant) à la clé
 * du coffre. Les IP source varient — pas de filtrage IP. Service-role : pas de
 * session utilisateur ici (pattern webhook, comme l'inbound email).
 *
 * Transport MF : POST form-urlencoded, champ `event` (JSON : name_event,
 * date_event) + champ `detail` (tableau JSON, UN élément PAR courrier —
 * toujours itérer). Relances si non-200 : +60 min puis +24 h — d'où
 * l'idempotence par unicité (letter_id, stage, status_code).
 */

export const runtime = "nodejs";

// Payload d'un courrier dans detail[] — champs utiles seulement, le reste est
// ignoré (l'API ajoute des champs sans préavis).
const detailSchema = z.looseObject({
  id_envoi: z.union([z.string(), z.number()]).nullable().optional(),
  ref_interne: z.string().nullable().optional(),
  tracking_number: z.string().nullable().optional(),
  statut_courrier: z.string().nullable().optional(),
  statut_description: z.string().nullable().optional(),
  are_base64_jpeg: z.string().nullable().optional(),
  pdd_base64_pdf: z.string().nullable().optional(),
});

function secretsMatch(got: string, expected: string): boolean {
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type LetterRow = {
  id: string;
  case_id: string;
  organization_id: string;
  kind: string;
  subject: string;
  tracking_status: string | null;
};

/** Archive une preuve (AR signé / preuve de dépôt) en pièce du dossier. */
async function archiveProof(
  sb: ReturnType<typeof createServiceClient>,
  letter: LetterRow,
  proof: { base64: string; fileName: string; mime: string },
): Promise<void> {
  try {
    const buf = Buffer.from(proof.base64, "base64");
    if (buf.length === 0 || buf.length > 25 * 1024 * 1024) return;
    const path = `${letter.organization_id}/${letter.case_id}/${crypto.randomUUID()}-${proof.fileName}`;
    const up = await sb.storage.from("documents").upload(path, buf, {
      contentType: proof.mime,
      upsert: false,
    });
    if (up.error) return;
    await sb.from("documents").insert({
      organization_id: letter.organization_id,
      case_id: letter.case_id,
      file_name: proof.fileName,
      storage_path: path,
      mime_type: proof.mime,
      size_bytes: buf.length,
      doc_class: "postal_receipt",
      doc_kind: "preuve_envoi",
    });
  } catch {
    // Preuve non archivée : l'événement de suivi reste posé, MF permet de la
    // récupérer plus tard via getProof.
  }
}

export async function POST(req: Request) {
  const expected = await getSecret("MERCI_FACTEUR_WEBHOOK_SECRET");
  const got = req.headers.get("x-mf-webhook-secret-key");
  if (!expected || !got || !secretsMatch(got, expected)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  let eventName = "new-state";
  let eventDate: Date | null = null;
  let details: z.infer<typeof detailSchema>[] = [];
  try {
    const form = await req.formData();
    const event = JSON.parse(String(form.get("event") ?? "{}")) as {
      name_event?: string;
      date_event?: number;
    };
    if (typeof event.name_event === "string") eventName = event.name_event;
    if (typeof event.date_event === "number" && event.date_event > 0) {
      eventDate = new Date(event.date_event * 1000);
    }
    const parsed = JSON.parse(String(form.get("detail") ?? "[]"));
    if (Array.isArray(parsed)) {
      details = parsed
        .map((raw) => detailSchema.safeParse(raw))
        .filter((r) => r.success)
        .map((r) => r.data);
    }
  } catch {
    // Payload illisible : on répond 200 pour éviter les retries en boucle,
    // l'événement sera visible côté console Merci Facteur.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const sb = createServiceClient();
  const occurredAt = (eventDate ?? new Date()).toISOString();
  // Une écriture en échec n'est PAS un doublon : on répond 500 à la fin pour
  // déclencher la relance Merci Facteur (+60 min puis +24 h) — l'idempotence
  // garantit que les détails déjà traités ne seront pas dupliqués au rejeu.
  let hadWriteError = false;

  for (const d of details) {
    // Le courrier se retrouve par l'id d'envoi Merci Facteur, sinon par la
    // référence interne (id du courrier BLEME passé dans l'adresse).
    const envoiId = d.id_envoi != null ? String(d.id_envoi) : null;
    const refInterne = typeof d.ref_interne === "string" ? d.ref_interne.trim() : null;
    const cols = "id, case_id, organization_id, kind, subject, tracking_status";
    let letter: LetterRow | null = null;
    if (envoiId) {
      letter = (
        await sb.from("letters").select(cols).eq("postal_envoi_id", envoiId).maybeSingle()
      ).data;
    }
    if (!letter && refInterne && /^[0-9a-f-]{36}$/i.test(refInterne)) {
      letter = (await sb.from("letters").select(cols).eq("id", refInterne).maybeSingle()).data;
    }
    if (!letter) continue;

    if (d.tracking_number) {
      await sb
        .from("letters")
        .update({ postal_tracking: String(d.tracking_number).slice(0, 60) })
        .eq("id", letter.id);
    }

    const statusCode = (d.statut_courrier ?? "").slice(0, 60);
    const { stage, label } = postalStageFor(eventName, statusCode);
    const description = d.statut_description
      ? String(d.statut_description).slice(0, 300)
      : null;

    // Étape structurée, idempotente : un retry du webhook (relances MF) ne
    // crée ni doublon d'événement, ni double notification.
    const { data: fresh, error: upsertErr } = await sb
      .from("letter_tracking_events")
      .upsert(
        {
          organization_id: letter.organization_id,
          case_id: letter.case_id,
          letter_id: letter.id,
          channel: "postal",
          stage,
          status_code: statusCode,
          label,
          detail: description,
          occurred_at: occurredAt,
        },
        { onConflict: "letter_id,stage,status_code", ignoreDuplicates: true },
      )
      .select("id");
    if (upsertErr) {
      hadWriteError = true;
      continue;
    }
    if (!fresh || fresh.length === 0) continue; // déjà traité

    // Statut agrégé : recalculé depuis les événements (jamais de régression,
    // même sous webhooks concurrents). Seuls les événements compris avancent
    // le statut — un name_event inconnu est journalisé sans agréger.
    if (KNOWN_POSTAL_EVENTS.has(eventName)) {
      await recomputeLetterTrackingStatus(sb, letter.id);
      await enqueueWebhook(letter.organization_id, "letter.tracking_updated", {
        case_id: letter.case_id,
        letter_id: letter.id,
        stage,
      });
    }

    // Preuves numérisées : archivées comme pièces du dossier (l'AR signé est
    // LA pièce maîtresse d'un recommandé).
    if (stage === "ar_signed" && d.are_base64_jpeg) {
      await archiveProof(sb, letter, {
        base64: d.are_base64_jpeg,
        fileName: "accuse-de-reception-signe.jpg",
        mime: "image/jpeg",
      });
    }
    if (stage === "deposit_proof" && d.pdd_base64_pdf) {
      await archiveProof(sb, letter, {
        base64: d.pdd_base64_pdf,
        fileName: "preuve-de-depot.pdf",
        mime: "application/pdf",
      });
    }

    await sb.from("case_events").insert({
      case_id: letter.case_id,
      organization_id: letter.organization_id,
      event_date: occurredAt,
      event_type: "letter_tracking",
      title: label,
      description,
      source: "system",
    });

    // Pli non distribué : l'utilisateur a une action à faire, on la pose sur
    // le dossier (visible en carte + agenda) en plus de la notification.
    if (stage === "returned") {
      await sb
        .from("cases")
        .update({
          next_action_label: "Vérifier l’adresse du destinataire",
          next_action_at: new Date().toISOString(),
        })
        .eq("id", letter.case_id);
    }

    const level = notifyLevelFor(stage, statusCode);
    if (level !== "none") {
      const kindLabel = LETTER_KINDS[letter.kind]?.label ?? "Courrier";
      await notifyOrganization(sb, {
        organizationId: letter.organization_id,
        caseId: letter.case_id,
        letterId: letter.id,
        kind: ALERT_STAGES.has(stage) ? "alert" : "tracking",
        title: `${kindLabel} (recommandé) — ${label}`,
        body: description ?? `Courrier « ${letter.subject} »`,
        href: `/app/dossiers/${letter.case_id}/courrier/${letter.id}`,
        email: level === "email",
      });
    }
  }

  if (hadWriteError) return new NextResponse("retry", { status: 500 });
  return NextResponse.json({ ok: true });
}
