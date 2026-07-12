import { NextResponse, after } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";
import { getSecret } from "@/lib/secrets";
import { ALLOWED_MIME, MAX_SIZE, resolveMime } from "@/lib/documents/mime";
import { recomputeLetterTrackingStatus } from "@/lib/courrier/tracking-aggregate";
import { LETTER_KINDS } from "@/lib/cases/letter-meta";
import { notifyOrganization } from "@/lib/notifications/notify";
import { enqueueWebhook } from "@/lib/webhooks/enqueue";
import { touchCase } from "@/lib/cases/touch";
import { draftAdaptedResponseCore } from "@/lib/cases/reply-draft";

// Webhook non authentifié (exempté par proxy.ts) : c'est Resend qui appelle.
// On vérifie la signature Svix, on résout l'organisation par inbox_slug, on
// récupère le corps + les pièces jointes (le webhook ne porte que des
// métadonnées), on recopie tout dans Supabase (rétention Resend = 30 j), et on
// crée l'élément de boîte de réception. Écritures via le service client
// (RLS-bypass) MAIS toujours scoppées à l'org résolue par le slug.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function emailAddr(raw: string): string {
  const m = /<([^>]+)>/.exec(raw);
  return (m ? m[1] : raw).trim().toLowerCase();
}
function displayName(raw: string): string | null {
  const m = /^\s*"?([^"<]+?)"?\s*</.exec(raw);
  const name = m?.[1]?.trim();
  return name || null;
}
function localPart(addr: string): string {
  return emailAddr(addr).split("@")[0]?.trim() ?? "";
}
// Plus-addressing : « slug+token » → { base: "slug", token: "token" }. Le token
// (jeton par dossier, hex minuscule) route la réponse de façon déterministe.
function parsePlusTag(local: string): { base: string; token: string | null } {
  const i = local.indexOf("+");
  if (i < 0) return { base: local, token: null };
  const token = local.slice(i + 1).trim();
  return { base: local.slice(0, i), token: token.length > 0 ? token : null };
}
function safeName(name: string): string {
  return name.replace(/[^\p{L}\p{N}._ -]/gu, "").slice(-120) || "piece";
}
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request): Promise<Response> {
  const raw = await req.text();

  const [secret, apiKey] = await Promise.all([
    getSecret("RESEND_INBOUND_SECRET"),
    getSecret("RESEND_API_KEY"),
  ]);
  if (!secret || !apiKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const resend = new Resend(apiKey);

  // 1. Signature Svix (via le SDK Resend) sur le corps brut.
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
  if (event.type !== "email.received") {
    return NextResponse.json({ ignored: true });
  }
  const data = event.data;

  const sb = createServiceClient();

  // 2. Résoudre l'organisation par inbox_slug (partie locale du destinataire).
  const recipients = [...(data.received_for ?? []), ...(data.to ?? [])];
  let orgId: string | null = null;
  let inboundToken: string | null = null;
  let fallbackOrgId: string | null = null; // slug matché mais SANS jeton (repli)
  for (const r of recipients) {
    const { base, token } = parsePlusTag(localPart(r));
    if (!base) continue;
    const { data: org } = await sb
      .from("organizations")
      .select("id")
      .eq("inbox_slug", base)
      .maybeSingle();
    if (!org) continue;
    if (token) {
      // Destinataire PORTEUR d'un jeton : prioritaire (routage déterministe). On
      // ne s'arrête pas au 1er slug sans jeton, sinon <slug@…> présent dans les
      // destinataires ferait perdre le <slug+token@…>.
      orgId = org.id;
      inboundToken = token;
      break;
    }
    if (!fallbackOrgId) fallbackOrgId = org.id;
  }
  if (!orgId) orgId = fallbackOrgId;
  // Destinataire inconnu : on acquitte (200) sans rien écrire, sans révéler.
  if (!orgId) return NextResponse.json({ ignored: true });

  // 3. Idempotence (rejeu / at-least-once du webhook) via l'id Resend de l'email
  //    (data.email_id : TOUJOURS présent, non contrôlé par l'expéditeur — le
  //    Message-ID RFC, lui, peut manquer). Barrage AVANT tout effet aval.
  if (data.email_id) {
    const { data: dup } = await sb
      .from("inbox_items")
      .select("id")
      .eq("organization_id", orgId)
      .eq("email_id", data.email_id)
      .maybeSingle();
    if (dup) return NextResponse.json({ duplicate: true });
  }

  // 3bis. Adresse par dossier : le jeton résout le dossier de façon DÉTERMINISTE.
  //       Re-filtré sur orgId (service-role = RLS contournée) : un jeton pointant
  //       un dossier d'une AUTRE org ne matche pas → on retombe sur les
  //       heuristiques, jamais de franchissement de frontière inter-org.
  let tokenCaseId: string | null = null;
  if (inboundToken) {
    const { data: tc } = await sb
      .from("cases")
      .select("id")
      .eq("organization_id", orgId)
      .eq("inbox_token", inboundToken)
      .maybeSingle();
    tokenCaseId = tc?.id ?? null;
  }

  // 4. Récupérer le CORPS (le webhook n'a que des métadonnées) + les headers
  //    (In-Reply-To/References : reconnaissance des réponses aux courriers).
  let text = "";
  let replyHeader = "";
  try {
    const { data: full } = await resend.emails.receiving.get(data.email_id);
    if (full) {
      text = full.text || (full.html ? htmlToText(full.html) : "");
      const headers = full.headers ?? {};
      for (const [k, v] of Object.entries(headers)) {
        const key = k.toLowerCase();
        if (key === "in-reply-to" || key === "references") replyHeader += ` ${v}`;
      }
    }
  } catch {
    // Corps indisponible : on continue avec l'objet seul (rien n'est perdu).
  }

  const from = data.from ?? "";
  const subject = data.subject || "(sans objet)";
  const excerpt = (text || subject).replace(/\s+/g, " ").slice(0, 160);
  // Message-IDs référencés par la réponse (<id@host>, In-Reply-To + References).
  const referencedIds = (replyHeader.match(/<[^<>\s]+>/g) ?? []).slice(0, 20);

  // 5. Créer l'élément de boîte de réception.
  const { data: item, error: insErr } = await sb
    .from("inbox_items")
    .insert({
      organization_id: orgId,
      case_id: tokenCaseId, // classement déterministe sur le dossier (sinon null)
      email_id: data.email_id ?? null, // clé d'idempotence (id Resend, garde 23505)
      source: "email",
      from_name: displayName(from),
      from_contact: emailAddr(from) || null,
      subject,
      excerpt,
      body_text: text || null,
      message_id: data.message_id ?? null,
      in_reply_to: referencedIds[0] ?? null,
    })
    .select("id")
    .single();
  if (insErr || !item) {
    // Course avec un rejeu concurrent (contrainte d'unicité) → acquitter.
    if (insErr?.code === "23505") return NextResponse.json({ duplicate: true });
    return NextResponse.json({ error: "store_failed" }, { status: 500 });
  }

  // 6. Pièces jointes → Storage {orgId}/inbox/… + lignes inbox_attachments.
  //    (On les recopie tout de suite : Resend ne les garde que 30 jours.)
  if ((data.attachments ?? []).length > 0) {
    try {
      const { data: list } = await resend.emails.receiving.attachments.list({ emailId: data.email_id });
      for (const att of list?.data ?? []) {
        if (!att.download_url) continue;
        const mime = resolveMime(att.filename ?? "piece", att.content_type);
        if (!ALLOWED_MIME.has(mime)) continue; // format non pris en charge → ignoré
        try {
          const res = await fetch(att.download_url);
          if (!res.ok) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length <= 0 || buf.length > MAX_SIZE) continue; // vide/trop lourd → ignoré
          const path = `${orgId}/inbox/${crypto.randomUUID()}-${safeName(att.filename ?? "piece")}`;
          const up = await sb.storage.from("documents").upload(path, buf, {
            contentType: mime,
            upsert: false,
          });
          if (up.error) continue;
          await sb.from("inbox_attachments").insert({
            organization_id: orgId,
            inbox_item_id: item.id,
            file_name: att.filename ?? "piece",
            storage_path: path,
            mime_type: mime,
            size_bytes: buf.length,
          });
        } catch {
          // Une pièce jointe en échec n'interrompt pas la réception de l'email.
        }
      }
    } catch {
      // Liste des pièces jointes indisponible : l'email reste reçu.
    }
  }

  // 7. Est-ce la réponse à un courrier envoyé ? D'abord par In-Reply-To/
  //    References (Message-ID RFC persisté à l'envoi), sinon par l'expéditeur
  //    (= email du destinataire d'un dossier). Si oui : jalon « Réponse reçue »
  //    sur le suivi du courrier + notification email ; sinon, simple
  //    notification cloche « nouvel email reçu ».
  const fromContact = emailAddr(from) || null;
  const letterCols = "id, case_id, organization_id, kind, subject";
  let repliedLetter: {
    id: string;
    case_id: string;
    organization_id: string;
    kind: string;
    subject: string;
  } | null = null;
  // Voie PRIMAIRE : le jeton par dossier a résolu le dossier → on rattache la
  // réponse à sa dernière lettre email envoyée (sans garde « Re: » : une adresse
  // par dossier non devinable EST pour ce dossier). Les heuristiques ci-dessous
  // ne servent que de filet quand aucun jeton n'a matché (fils pré-feature).
  if (tokenCaseId) {
    repliedLetter = (
      await sb
        .from("letters")
        .select(letterCols)
        .eq("case_id", tokenCaseId)
        .eq("channel", "email")
        .not("sent_at", "is", null)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data;
  }
  if (!tokenCaseId && referencedIds.length > 0) {
    repliedLetter = (
      await sb
        .from("letters")
        .select(letterCols)
        .eq("organization_id", orgId)
        .in("email_rfc_message_id", referencedIds)
        .not("sent_at", "is", null)
        .limit(1)
        .maybeSingle()
    ).data;
  }
  // Repli par expéditeur : UNIQUEMENT si l'objet indique une réponse (Re:/Ré:).
  // Sans ce garde, un email NON lié (une nouvelle facture envoyée depuis une
  // adresse par ailleurs enregistrée comme débiteur d'un dossier ouvert) serait
  // classé « réponse reçue » à tort et déclencherait une notification email.
  // Fwd:/Tr: (transfert) ne comptent PAS comme réponse.
  const looksLikeReply = /^\s*r[eé]\s*(\[\d+\])?\s*:/i.test(subject);
  if (!tokenCaseId && !repliedLetter && fromContact && looksLikeReply) {
    // Dossier OUVERT dont le destinataire a cette adresse (comparaison
    // insensible à la casse — % et _ échappés pour ilike).
    const { data: matchedCase } = await sb
      .from("cases")
      .select("id")
      .eq("organization_id", orgId)
      .ilike("debtor_email", fromContact.replace(/[%_\\]/g, "\\$&"))
      .in("status", ["active", "awaiting_user", "awaiting_debtor", "escalated"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (matchedCase) {
      repliedLetter = (
        await sb
          .from("letters")
          .select(letterCols)
          .eq("case_id", matchedCase.id)
          .eq("channel", "email")
          .not("sent_at", "is", null)
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data;
    }
  }

  // Dossier cible : le jeton (déterministe) prime, sinon la lettre heuristique.
  // On route les effets sur le DOSSIER même sans lettre envoyée (jeton minté mais
  // réponse arrivée avant tout courrier).
  const caseId = tokenCaseId ?? repliedLetter?.case_id ?? null;
  if (caseId) {
    const quote = excerpt.length >= 160 ? `${excerpt.slice(0, 159)}…` : excerpt;
    // Jalon « Réponse reçue » sur la lettre répondue s'il y en a une. status_code
    // = id de l'élément de boîte : un rejeu du webhook ne duplique rien
    // (l'idempotence amont sur message_id fait déjà barrage en étape 3).
    let fresh = true;
    if (repliedLetter) {
      const { data: freshRows } = await sb
        .from("letter_tracking_events")
        .upsert(
          {
            organization_id: orgId,
            case_id: repliedLetter.case_id,
            letter_id: repliedLetter.id,
            channel: "email",
            stage: "replied",
            status_code: `inbound:${item.id}`,
            label: "Réponse reçue",
            detail: quote || null,
            occurred_at: new Date().toISOString(),
          },
          { onConflict: "letter_id,stage,status_code", ignoreDuplicates: true },
        )
        .select("id");
      fresh = !!(freshRows && freshRows.length > 0);
      if (fresh) await recomputeLetterTrackingStatus(sb, repliedLetter.id);
    }
    if (fresh) {
      await sb.from("case_events").insert({
        case_id: caseId,
        organization_id: orgId,
        event_type: "letter_tracking",
        title: "Réponse reçue par email",
        description: quote || null,
        source: "system",
      });
      const kindLabel = repliedLetter ? (LETTER_KINDS[repliedLetter.kind]?.label ?? "Courrier") : null;
      await notifyOrganization(sb, {
        organizationId: orgId,
        caseId,
        letterId: repliedLetter?.id,
        kind: "reply",
        title: kindLabel ? `Réponse reçue à votre ${kindLabel.toLowerCase()}` : "Réponse reçue sur un dossier",
        body: `${displayName(from) ?? fromContact ?? "Le destinataire"} a répondu : « ${quote} »`,
        href: "/app/inbox",
        email: true,
      });
      await enqueueWebhook(orgId, "reply.received", {
        case_id: caseId,
        letter_id: repliedLetter?.id ?? null,
        inbox_item_id: item.id,
      });
      // Adresse par dossier (jeton CERTAIN) : on capte le retour et on LANCE
      // l'analyse — un BROUILLON de réponse adaptée, jamais d'envoi (pilier #1).
      // En arrière-plan (after()) : l'agent peut prendre plusieurs secondes, on
      // ne bloque pas l'accusé de réception à Resend.
      if (tokenCaseId) {
        const replyBody = text || subject;
        const { data: dr } = await sb
          .from("debtor_replies")
          .insert({
            organization_id: orgId,
            case_id: tokenCaseId,
            received_via: "email",
            body_text: replyBody,
            letter_id: repliedLetter?.id ?? null,
            handled: false,
          })
          .select("id")
          .single();
        const draftCaseId = tokenCaseId;
        after(async () => {
          const sb2 = createServiceClient();
          // Claim ATOMIQUE du retour avant de rédiger : si l'UI (bouton « générer
          // la réponse ») ou un rejeu a déjà pris ce retour, on ne produit pas un
          // 2e brouillon. Le marquage handled fait office de verrou.
          if (dr?.id) {
            const { data: claimed } = await sb2
              .from("debtor_replies")
              .update({ handled: true })
              .eq("id", dr.id)
              .eq("handled", false)
              .select("id")
              .maybeSingle();
            if (!claimed) return;
          }
          const { data: org2 } = await sb2
            .from("organizations")
            .select("name")
            .eq("id", orgId)
            .maybeSingle();
          const res = await draftAdaptedResponseCore(
            sb2,
            orgId,
            org2?.name ?? "Votre entreprise",
            draftCaseId,
            replyBody,
          );
          if ("error" in res) {
            // Rédaction en échec : on relâche le retour pour une reprise manuelle.
            if (dr?.id) await sb2.from("debtor_replies").update({ handled: false }).eq("id", dr.id);
            return;
          }
          await touchCase(draftCaseId, { type: "letter_draft", label: "Réponse adaptée préparée" });
        });
      }
    }
  } else {
    await notifyOrganization(sb, {
      organizationId: orgId,
      kind: "inbox",
      title: `Nouvel email de ${displayName(from) ?? fromContact ?? "expéditeur inconnu"}`,
      body: subject,
      href: "/app/inbox",
      email: false,
    });
  }

  return NextResponse.json({ ok: true, itemId: item.id });
}
