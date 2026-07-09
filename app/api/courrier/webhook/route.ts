import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSecret } from "@/lib/secrets";

/*
 * Webhook Merci Facteur (suivi des courriers postaux) : imprimé, remis à La
 * Poste, distribué, AR signé, pli non distribué… Chaque événement est versé
 * dans la chronologie du dossier et le n° de suivi est fixé sur le courrier.
 *
 * Sécurité : header X-Mf-Webhook-Secret-Key comparé (temps constant) à la clé
 * du coffre. Les IP source varient — pas de filtrage IP. Service-role : pas de
 * session utilisateur ici (pattern webhook, comme l'inbound email).
 */

export const runtime = "nodejs";

const EVENT_LABEL: Record<string, string> = {
  new: "Courrier pris en compte par l’imprimeur",
  printed: "Courrier imprimé",
  sended: "Courrier remis à La Poste",
  "new-state": "Suivi du courrier mis à jour",
  delivered: "Courrier distribué au destinataire",
  are: "Accusé de réception signé reçu",
  pdd: "Preuve de dépôt disponible",
  pnd: "Pli non distribué (adresse à vérifier)",
  error: "Incident d’expédition signalé",
};

function secretsMatch(got: string, expected: string): boolean {
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const expected = await getSecret("MERCI_FACTEUR_WEBHOOK_SECRET");
  const got = req.headers.get("x-mf-webhook-secret-key");
  if (!expected || !got || !secretsMatch(got, expected)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  let eventName = "new-state";
  let details: unknown[] = [];
  try {
    const form = await req.formData();
    const event = JSON.parse(String(form.get("event") ?? "{}")) as { name_event?: string };
    if (typeof event.name_event === "string") eventName = event.name_event;
    const parsed = JSON.parse(String(form.get("detail") ?? "[]"));
    if (Array.isArray(parsed)) details = parsed;
  } catch {
    // Payload illisible : on répond 200 pour éviter les retries en boucle,
    // l'événement sera visible côté console Merci Facteur.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const sb = createServiceClient();
  for (const raw of details) {
    const d = raw as {
      id_envoi?: number | string;
      ref_interne?: string;
      tracking_number?: string;
      statut_description?: string;
    };
    // Le courrier se retrouve par l'id d'envoi Merci Facteur, sinon par la
    // référence interne (id du courrier BLEME passé dans l'adresse).
    const envoiId = d.id_envoi != null ? String(d.id_envoi) : null;
    const refInterne = typeof d.ref_interne === "string" ? d.ref_interne.trim() : null;
    let letter: { id: string; case_id: string; organization_id: string } | null = null;
    if (envoiId) {
      letter = (
        await sb
          .from("letters")
          .select("id, case_id, organization_id")
          .eq("postal_envoi_id", envoiId)
          .maybeSingle()
      ).data;
    }
    if (!letter && refInterne && /^[0-9a-f-]{36}$/i.test(refInterne)) {
      letter = (
        await sb
          .from("letters")
          .select("id, case_id, organization_id")
          .eq("id", refInterne)
          .maybeSingle()
      ).data;
    }
    if (!letter) continue;

    if (d.tracking_number) {
      await sb
        .from("letters")
        .update({ postal_tracking: String(d.tracking_number).slice(0, 60) })
        .eq("id", letter.id);
    }

    await sb.from("case_events").insert({
      case_id: letter.case_id,
      organization_id: letter.organization_id,
      event_type: "letter_tracking",
      title: EVENT_LABEL[eventName] ?? `Suivi du courrier : ${eventName}`,
      description: d.statut_description ? String(d.statut_description).slice(0, 300) : null,
      source: "system",
    });
  }

  return NextResponse.json({ ok: true });
}
