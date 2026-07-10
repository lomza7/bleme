import { Resend } from "resend";
import { getSecret } from "@/lib/secrets";

/*
 * Emails transactionnels applicatifs (notifications, relances…) via Resend.
 * La clé se résout via le coffre (app_secrets, éditable dans /admin/cles)
 * avec repli sur la variable d'environnement — même règle que le reste de
 * l'app : une clé se corrige dans la console, sans redéploiement.
 * Les emails d'AUTH (confirmation, reset) partent de Supabase Auth : en
 * production, Supabase est configuré avec le SMTP Resend — voir
 * docs/ops/auth-setup.md. En local, Mailpit les capture.
 */

let cached: { key: string; client: Resend } | null = null;

async function resend(): Promise<Resend> {
  const key = await getSecret("RESEND_API_KEY");
  if (!key) {
    throw new Error(
      "RESEND_API_KEY manquante : renseignez-la dans le coffre (/admin/cles) ou en variable d'environnement.",
    );
  }
  if (!cached || cached.key !== key) cached = { key, client: new Resend(key) };
  return cached.client;
}

const DEFAULT_FROM = "BLEME <notifications@dossiers.bleme.fr>";

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  from = DEFAULT_FROM,
  attachments,
  tags,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  from?: string;
  /** Pièces jointes (contenu en base64). Resend borne l'email complet à 40 Mo. */
  attachments?: { filename: string; content: string; contentType?: string }[];
  /** Tags Resend (ASCII, ≤256 car.) : reviennent dans chaque webhook — sert à
   * corréler les événements de suivi (letter_id…). */
  tags?: { name: string; value: string }[];
}) {
  const client = await resend();
  const { data, error } = await client.emails.send({
    from,
    to,
    subject,
    html,
    text,
    replyTo,
    attachments,
    tags,
  });
  if (error) {
    throw new Error(`Échec d'envoi email (${subject}) : ${error.message}`);
  }
  return data;
}
