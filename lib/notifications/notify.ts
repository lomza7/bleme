import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/services/email";
import { SITE_URL } from "@/lib/site";

/*
 * Fan-out d'une notification produit : une ligne dans le centre de
 * notifications (cloche) + selon l'importance, un email aux membres de
 * l'organisation. Appelé UNIQUEMENT côté service-role (webhooks de suivi,
 * email entrant) — jamais depuis une requête portée par un utilisateur.
 *
 * L'email est un canal de confort : son échec ne fait jamais échouer le
 * webhook appelant (la notification in-app, elle, est déjà posée).
 */

export type NotifyInput = {
  organizationId: string;
  caseId?: string | null;
  letterId?: string | null;
  /** 'tracking' (suivi d'envoi), 'reply' (réponse reçue), 'alert', 'system'. */
  kind: string;
  title: string;
  body?: string | null;
  /** Lien interne de destination (ex. /app/dossiers/{id}). */
  href?: string | null;
  /** true : email envoyé aux membres de l'org en plus de la cloche. */
  email: boolean;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Gabarit email de notification — même sobriété que l'email OTP. */
function notificationEmailHtml(input: {
  title: string;
  body?: string | null;
  url?: string | null;
  cta: string;
}): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#18181b">
  <p style="font-size:20px;font-weight:700;margin:0 0 4px">BLEME<span style="color:#c2410c">.</span></p>
  <h1 style="font-size:18px;font-weight:600;margin:24px 0 12px">${esc(input.title)}</h1>
  ${input.body ? `<p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#3f3f46">${esc(input.body)}</p>` : ""}
  ${
    input.url
      ? `<a href="${input.url}" style="display:inline-block;background:#c2410c;color:#fff;text-decoration:none;font-size:14px;font-weight:500;padding:11px 22px;border-radius:999px">${esc(input.cta)}</a>`
      : ""
  }
  <p style="font-size:12px;color:#a1a1aa;margin:28px 0 0">Vous recevez cet email car votre espace BLEME a du nouveau sur l’un de vos dossiers.</p>
</div>`;
}

/**
 * Emails des membres de l'organisation (l'email vit dans auth.users —
 * accessible uniquement en service-role).
 */
async function memberEmails(sb: SupabaseClient, organizationId: string): Promise<string[]> {
  const { data: members } = await sb
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId);
  const out: string[] = [];
  for (const m of members ?? []) {
    try {
      const { data } = await sb.auth.admin.getUserById(m.user_id);
      const email = data.user?.email;
      if (email) out.push(email);
    } catch {
      // Membre sans email résolvable : les autres sont quand même notifiés.
    }
  }
  return out;
}

export async function notifyOrganization(sb: SupabaseClient, input: NotifyInput): Promise<void> {
  const { data: inserted } = await sb
    .from("notifications")
    .insert({
      organization_id: input.organizationId,
      case_id: input.caseId ?? null,
      letter_id: input.letterId ?? null,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
    })
    .select("id")
    .maybeSingle();

  if (!input.email) return;

  try {
    const emails = await memberEmails(sb, input.organizationId);
    if (emails.length === 0) return;
    const url = input.href ? `${SITE_URL}${input.href}` : null;
    const cta = input.href?.startsWith("/app/inbox")
      ? "Voir la réponse"
      : input.kind === "tracking" || input.kind === "alert"
        ? "Voir le suivi du courrier"
        : "Ouvrir BLEME";
    await sendEmail({
      to: emails,
      subject: input.title,
      html: notificationEmailHtml({ title: input.title, body: input.body, url, cta }),
      text: `${input.title}${input.body ? `\n\n${input.body}` : ""}${url ? `\n\n${url}` : ""}`,
    });
    if (inserted?.id) {
      await sb
        .from("notifications")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", inserted.id);
    }
  } catch {
    // Email de notification indisponible (clé Resend, quota…) : la cloche
    // porte déjà l'information, on ne casse pas le webhook appelant.
  }
}
