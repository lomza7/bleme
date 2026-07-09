import "server-only";
import { serverEnv } from "@/lib/env";
import { sendEmail } from "@/lib/services/email";
import { sendRegisteredLetter, type LetterAddress } from "@/lib/courrier/merci-facteur";
import { buildLetterPdf, imageToPdfBase64 } from "@/lib/courrier/pdf";
import { postalAttachable } from "@/lib/courrier/attachment-rules";

/*
 * Expédition RÉELLE d'un courrier déjà validé et loggé (approval_logs + hash,
 * pilier #1). Rien ne PART tant que SEND_ENABLED n'est pas « true » : par défaut
 * on renvoie « prepared » (validation enregistrée, aucun envoi). Ce module
 * n'expédie QUE le contenu exact approuvé par l'utilisateur.
 */

export type DispatchResult =
  | { status: "sent"; via: "email" | "postal"; ref: string | null }
  | { status: "prepared"; reason: string };

function sendEnabled(): boolean {
  try {
    return serverEnv().SEND_ENABLED === true;
  } catch {
    return false;
  }
}

function mdToHtml(md: string): string {
  const esc = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div style="font-family:system-ui,-apple-system,sans-serif;white-space:pre-wrap;line-height:1.6;color:#111">${esc}</div>`;
}

export async function dispatchLetter(input: {
  channel: "email" | "postal";
  subject: string;
  bodyMd: string;
  toEmail?: string | null;
  toName?: string | null;
  replyTo?: string | null;
  /** Postal : adresses saisies/validées par l'utilisateur, jamais devinées. */
  toAddress?: LetterAddress | null;
  fromAddress?: LetterAddress | null;
  /** Postal : id du courrier BLEME — référence AR, ref_interne webhook, antidoublon. */
  reference?: string | null;
  /**
   * Annexes approuvées AVEC le courrier (pièces du dossier déjà chargées et
   * hachées dans approval_logs). Email : pièces jointes. Postal : PDF imprimés
   * à la suite de la lettre (images mises en page A4).
   */
  attachments?: { fileName: string; mimeType: string; base64: string }[] | null;
}): Promise<DispatchResult> {
  if (!sendEnabled()) {
    return { status: "prepared", reason: "Expédition réelle désactivée (SEND_ENABLED)." };
  }

  if (input.channel === "email") {
    const to = input.toEmail?.trim();
    if (!to) return { status: "prepared", reason: "Adresse email du destinataire manquante." };
    try {
      const res = await sendEmail({
        to,
        subject: input.subject,
        html: mdToHtml(input.bodyMd),
        text: input.bodyMd,
        // Réponses du débiteur → boîte de réception BLEME du dossier (ingérées
        // par le webhook inbound), pour fermer la boucle dans le dossier.
        replyTo: input.replyTo?.trim() || undefined,
        attachments: input.attachments?.length
          ? input.attachments.map((a) => ({
              filename: a.fileName,
              content: a.base64,
              contentType: a.mimeType,
            }))
          : undefined,
      });
      return { status: "sent", via: "email", ref: (res as { id?: string } | null)?.id ?? null };
    } catch (e) {
      return {
        status: "prepared",
        reason: e instanceof Error ? e.message.slice(0, 200) : "Échec d'envoi email.",
      };
    }
  }

  // Postal (Merci Facteur, LRAR mode `lrare`) : PDF généré depuis le contenu
  // EXACT approuvé, adresses saisies par l'utilisateur, antidoublon = id du
  // courrier. `sendCourrier` débite et expédie immédiatement — d'où la double
  // porte SEND_ENABLED + validation loggée en amont.
  if (!input.toAddress) {
    return { status: "prepared", reason: "Adresse postale du destinataire manquante." };
  }
  if (!input.fromAddress) {
    return { status: "prepared", reason: "Adresse postale de l'expéditeur manquante." };
  }
  if (!input.reference) {
    return { status: "prepared", reason: "Référence du courrier manquante (antidoublon)." };
  }
  try {
    const pdfBase64 = await buildLetterPdf({
      subject: input.subject,
      bodyMd: input.bodyMd,
      exp: input.fromAddress,
      dest: input.toAddress,
    });
    // Annexes du pli : PDF tels quels, images mises en page A4. Les formats
    // non imprimables sont refusés en amont (approveAndSendLetter) — ici on
    // échoue explicitement plutôt que d'expédier un pli incomplet.
    const annexesPdfBase64: string[] = [];
    for (const a of input.attachments ?? []) {
      if (!postalAttachable(a.mimeType)) {
        return {
          status: "prepared",
          reason: `Annexe non imprimable en recommandé : ${a.fileName}.`,
        };
      }
      annexesPdfBase64.push(
        a.mimeType === "application/pdf" ? a.base64 : await imageToPdfBase64(a),
      );
    }
    const sent = await sendRegisteredLetter({
      pdfBase64,
      filename: "courrier-recommande",
      annexesPdfBase64: annexesPdfBase64.length ? annexesPdfBase64 : undefined,
      exp: input.fromAddress,
      dest: input.toAddress,
      reference: input.reference,
    });
    if ("error" in sent) {
      return { status: "prepared", reason: `Envoi postal indisponible : ${sent.error}` };
    }
    return { status: "sent", via: "postal", ref: sent.envoiId || null };
  } catch (e) {
    return {
      status: "prepared",
      reason: e instanceof Error ? e.message.slice(0, 200) : "Échec de l'envoi postal.",
    };
  }
}
