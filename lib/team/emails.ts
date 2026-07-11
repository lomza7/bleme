import "server-only";

/*
 * Gabarits d'email d'invitation — même sobriété que les notifications et l'OTP
 * (system-ui, largeur 560, accent terracotta #c2410c). Deux variantes :
 *   • équipe   : un collègue rejoint l'organisation (bouton « Rejoindre »).
 *   • expert   : expert-comptable / avocat, invité à suivre les dossiers de son
 *                client — courtois, sans jargon juridique, sans accès à l'app.
 * Registre non-juridique : aucun vocabulaire de conseil (« gagner », « chances »).
 */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const WRAP_OPEN =
  '<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#18181b">' +
  '<p style="font-size:20px;font-weight:700;margin:0 0 4px">BLEME<span style="color:#c2410c">.</span></p>';
const WRAP_CLOSE = "</div>";

function messageBlock(message?: string | null): string {
  if (!message || !message.trim()) return "";
  return `<blockquote style="margin:18px 0;padding:12px 16px;border-left:3px solid #f2d3c2;background:#faf5f2;border-radius:0 12px 12px 0;font-size:14px;line-height:1.6;color:#3f3f46">${esc(
    message.trim(),
  ).replace(/\n/g, "<br>")}</blockquote>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#c2410c;color:#fff;text-decoration:none;font-size:14px;font-weight:500;padding:11px 22px;border-radius:999px">${esc(
    label,
  )}</a>`;
}

/** Email d'invitation d'un collègue à rejoindre l'organisation. */
export function teamInviteEmail(input: {
  inviterName: string;
  orgName: string;
  acceptUrl: string;
  message?: string | null;
}): { subject: string; html: string; text: string } {
  const subject = `${input.inviterName} vous invite à rejoindre ${input.orgName} sur BLEME`;
  const html =
    WRAP_OPEN +
    `<h1 style="font-size:18px;font-weight:600;margin:24px 0 12px">Rejoignez l'équipe de ${esc(
      input.orgName,
    )}</h1>` +
    `<p style="font-size:15px;line-height:1.6;margin:0 0 8px;color:#3f3f46"><strong>${esc(
      input.inviterName,
    )}</strong> vous invite à collaborer sur BLEME — l'espace où ${esc(
      input.orgName,
    )} suit ses factures impayées et ses litiges clients : preuves classées, chronologie, courriers en brouillon à valider ensemble.</p>` +
    messageBlock(input.message) +
    `<p style="font-size:15px;line-height:1.6;margin:16px 0 20px;color:#3f3f46">Créez votre compte avec cette adresse email, et vous rejoignez automatiquement l'équipe.</p>` +
    button(input.acceptUrl, "Rejoindre l'équipe") +
    `<p style="font-size:12px;color:#a1a1aa;margin:28px 0 0">Ce lien d'invitation est valable 14 jours. Si vous ne connaissez pas ${esc(
      input.inviterName,
    )}, ignorez simplement cet email.</p>` +
    WRAP_CLOSE;
  const text = `${input.inviterName} vous invite à rejoindre ${input.orgName} sur BLEME.\n\n${
    input.message ? `« ${input.message.trim()} »\n\n` : ""
  }Créez votre compte avec cette adresse email pour rejoindre l'équipe :\n${input.acceptUrl}\n\nLien valable 14 jours.`;
  return { subject, html, text };
}

const PROFESSION_LABEL: Record<"accountant" | "lawyer", string> = {
  accountant: "expert-comptable",
  lawyer: "avocat",
};

/** Email d'invitation d'un expert externe (comptable / avocat). */
export function proInviteEmail(input: {
  profession: "accountant" | "lawyer";
  inviterName: string;
  orgName: string;
  siteUrl: string;
  message?: string | null;
}): { subject: string; html: string; text: string } {
  const label = PROFESSION_LABEL[input.profession];
  const subject = `${input.inviterName} (${input.orgName}) souhaite vous associer à ses dossiers`;
  const intro =
    input.profession === "accountant"
      ? `En tant que son ${label}, vous suivez peut-être déjà ses factures et relances.`
      : `En tant que son ${label}, vous pourriez être amené à intervenir sur ses litiges.`;
  const html =
    WRAP_OPEN +
    `<h1 style="font-size:18px;font-weight:600;margin:24px 0 12px">${esc(
      input.inviterName,
    )} vous mentionne comme son ${esc(label)}</h1>` +
    `<p style="font-size:15px;line-height:1.6;margin:0 0 8px;color:#3f3f46"><strong>${esc(
      input.orgName,
    )}</strong> utilise BLEME pour tenir ses factures impayées et ses litiges au clair : pièces classées, chronologie datée, courriers préparés. ${esc(
      intro,
    )}</p>` +
    messageBlock(input.message) +
    `<p style="font-size:15px;line-height:1.6;margin:16px 0 20px;color:#3f3f46">Vous pouvez répondre directement à cet email pour échanger avec ${esc(
      input.inviterName,
    )}. Un accès dédié aux professionnels arrive bientôt sur BLEME.</p>` +
    button(input.siteUrl, "Découvrir BLEME") +
    `<p style="font-size:12px;color:#a1a1aa;margin:28px 0 0">Vous recevez cet email car ${esc(
      input.inviterName,
    )} vous a mentionné comme son ${esc(label)} sur BLEME.</p>` +
    WRAP_CLOSE;
  const text = `${input.inviterName} (${input.orgName}) vous mentionne comme son ${label} sur BLEME.\n\n${
    input.message ? `« ${input.message.trim()} »\n\n` : ""
  }BLEME est l'espace où ${input.orgName} suit ses factures impayées et litiges. Répondez à cet email pour échanger avec ${input.inviterName}.\n\nDécouvrir BLEME : ${input.siteUrl}`;
  return { subject, html, text };
}
