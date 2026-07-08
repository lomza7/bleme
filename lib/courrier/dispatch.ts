import "server-only";
import { serverEnv } from "@/lib/env";
import { sendEmail } from "@/lib/services/email";
import { getMerciFacteurToken } from "@/lib/courrier/merci-facteur";

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
      });
      return { status: "sent", via: "email", ref: (res as { id?: string } | null)?.id ?? null };
    } catch (e) {
      return {
        status: "prepared",
        reason: e instanceof Error ? e.message.slice(0, 200) : "Échec d'envoi email.",
      };
    }
  }

  // Postal (Merci Facteur) : l'authentification existe ; la création + l'envoi du
  // recommandé (génération PDF + adresse destinataire) restent à brancher. On ne
  // prétend donc PAS avoir expédié.
  const auth = await getMerciFacteurToken();
  if ("error" in auth) {
    return { status: "prepared", reason: `Envoi postal indisponible : ${auth.error}` };
  }
  return { status: "prepared", reason: "Envoi postal (recommandé) : intégration d'expédition à finaliser." };
}
