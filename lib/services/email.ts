import { Resend } from "resend";
import { serverEnv } from "@/lib/env";

/*
 * Emails transactionnels applicatifs (notifications, relances…) via Resend.
 * Les emails d'AUTH (confirmation, reset) partent de Supabase Auth : en
 * production, Supabase est configuré avec le SMTP Resend — voir
 * docs/ops/auth-setup.md. En local, Mailpit les capture.
 */

let client: Resend | null = null;

function resend(): Resend {
  const key = serverEnv().RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY manquante : configurez-la pour envoyer des emails applicatifs.",
    );
  }
  if (!client) client = new Resend(key);
  return client;
}

const DEFAULT_FROM = "BLEME <notifications@dossiers.bleme.fr>";

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  from = DEFAULT_FROM,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  from?: string;
}) {
  const { data, error } = await resend().emails.send({
    from,
    to,
    subject,
    html,
    text,
    replyTo,
  });
  if (error) {
    throw new Error(`Échec d'envoi email (${subject}) : ${error.message}`);
  }
  return data;
}
