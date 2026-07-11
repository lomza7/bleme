import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";
import { getSecret } from "@/lib/secrets";
import { ALERT_STAGES, emailStageFor, notifyLevelFor } from "@/lib/courrier/tracking";
import { recomputeLetterTrackingStatus } from "@/lib/courrier/tracking-aggregate";
import { LETTER_KINDS } from "@/lib/cases/letter-meta";
import { notifyOrganization } from "@/lib/notifications/notify";
import { enqueueWebhook } from "@/lib/webhooks/enqueue";

/*
 * Webhook Resend — événements SORTANTS (suivi des emails envoyés aux
 * destinataires) : email.sent / delivered / delivery_delayed / opened /
 * clicked / bounced / failed / suppressed / complained.
 *
 * Symétrique du webhook Merci Facteur : étape normalisée idempotente
 * (letter_tracking_events), statut agrégé monotone sur letters, chronologie,
 * notification (cloche + email pour les jalons marquants). La corrélation se
 * fait par data.email_id = letters.email_message_id (persisté à l'envoi).
 * Les emails sans courrier associé (OTP, notifications, auth Supabase via
 * SMTP) sont acquittés sans écriture.
 *
 * Config : webhook dédié dans la console Resend (événements email.* sortants),
 * secret Svix dans le coffre sous RESEND_TRACKING_SECRET. Garanties Resend :
 * livraison « au moins une fois », ordre NON garanti, retries ~27 h — d'où
 * idempotence + machine à états monotone.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const raw = await req.text();

  const [secret, apiKey] = await Promise.all([
    getSecret("RESEND_TRACKING_SECRET"),
    getSecret("RESEND_API_KEY"),
  ]);
  if (!secret || !apiKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const resend = new Resend(apiKey);

  // Signature Svix (via le SDK Resend) sur le corps brut.
  let event;
  try {
    event = resend.webhooks.verify({
      payload: raw,
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    });
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const stageInfo = emailStageFor(event.type);
  if (!stageInfo || !("email_id" in event.data)) {
    return NextResponse.json({ ignored: true });
  }
  const data = event.data as {
    email_id: string;
    created_at: string;
    message_id?: string;
    tags?: Record<string, string>;
    bounce?: { message?: string; type?: string };
    failed?: { reason?: string };
    click?: { link?: string };
    suppressed?: { message?: string };
  };

  const sb = createServiceClient();
  const letterCols =
    "id, case_id, organization_id, kind, subject, email_message_id, email_rfc_message_id";
  let { data: letter } = await sb
    .from("letters")
    .select(letterCols)
    .eq("email_message_id", data.email_id)
    .maybeSingle();
  // Repli par le tag letter_id (posé à l'envoi) : couvre la course où
  // email.sent arrive avant que letters.email_message_id soit commité.
  if (!letter && data.tags?.letter_id && /^[0-9a-f-]{36}$/i.test(data.tags.letter_id)) {
    letter = (
      await sb.from("letters").select(letterCols).eq("id", data.tags.letter_id).maybeSingle()
    ).data;
    if (letter && !letter.email_message_id) {
      await sb.from("letters").update({ email_message_id: data.email_id }).eq("id", letter.id);
    }
  }
  // Email sans courrier associé (OTP, notification, auth…) : rien à suivre.
  if (!letter) return NextResponse.json({ ignored: true });

  // Message-ID RFC de l'email parti : c'est lui qu'on retrouvera dans le
  // header In-Reply-To quand le destinataire répondra (boucle « répondu »).
  if (data.message_id && !letter.email_rfc_message_id) {
    await sb
      .from("letters")
      .update({ email_rfc_message_id: data.message_id.slice(0, 300) })
      .eq("id", letter.id);
  }

  const { stage, label } = stageInfo;
  const occurredAt = event.created_at ? new Date(event.created_at).toISOString() : new Date().toISOString();
  const detail =
    data.bounce?.message?.slice(0, 300) ??
    data.failed?.reason?.slice(0, 300) ??
    data.suppressed?.message?.slice(0, 300) ??
    (data.click?.link ? `Lien consulté : ${data.click.link.slice(0, 250)}` : null);

  // Étape idempotente : les retries Svix et les ouvertures répétées ne créent
  // qu'un seul jalon par étape.
  const { data: fresh, error: upsertErr } = await sb
    .from("letter_tracking_events")
    .upsert(
      {
        organization_id: letter.organization_id,
        case_id: letter.case_id,
        letter_id: letter.id,
        channel: "email",
        stage,
        status_code: event.type,
        label,
        detail,
        occurred_at: occurredAt,
        provider_event_id: req.headers.get("svix-id"),
      },
      { onConflict: "letter_id,stage,status_code", ignoreDuplicates: true },
    )
    .select("id");
  // Échec d'écriture ≠ doublon : 500 → Resend rejoue (idempotence au rejeu).
  if (upsertErr) return new NextResponse("retry", { status: 500 });
  if (!fresh || fresh.length === 0) return NextResponse.json({ ok: true, duplicate: true });

  // Statut agrégé recalculé depuis les événements : pas de régression, même
  // si les webhooks arrivent dans le désordre ou en concurrence.
  await recomputeLetterTrackingStatus(sb, letter.id);
  await enqueueWebhook(letter.organization_id, "letter.tracking_updated", {
    case_id: letter.case_id,
    letter_id: letter.id,
    stage,
  });

  // Chronologie du dossier : jalons significatifs seulement (les ouvertures/
  // clics restent dans l'historique du courrier, indicatifs par nature).
  if (["email_delivered", "bounced", "failed", "suppressed", "complained"].includes(stage)) {
    await sb.from("case_events").insert({
      case_id: letter.case_id,
      organization_id: letter.organization_id,
      event_date: occurredAt,
      event_type: "letter_tracking",
      title: label,
      description: detail,
      source: "system",
    });
  }

  // Adresse invalide : action utilisateur posée sur le dossier.
  if (stage === "bounced" || stage === "suppressed") {
    await sb
      .from("cases")
      .update({
        next_action_label: "Vérifier l’email du destinataire",
        next_action_at: new Date().toISOString(),
      })
      .eq("id", letter.case_id);
  }

  const level = notifyLevelFor(stage, event.type);
  if (level !== "none") {
    const kindLabel = LETTER_KINDS[letter.kind]?.label ?? "Courrier";
    await notifyOrganization(sb, {
      organizationId: letter.organization_id,
      caseId: letter.case_id,
      letterId: letter.id,
      kind: ALERT_STAGES.has(stage) ? "alert" : "tracking",
      title: `${kindLabel} (email) — ${label}`,
      body: detail ?? `Courrier « ${letter.subject} »`,
      href: `/app/dossiers/${letter.case_id}/courrier/${letter.id}`,
      email: level === "email",
    });
  }

  return NextResponse.json({ ok: true });
}
