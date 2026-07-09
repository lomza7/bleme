import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/services/email";
import { otpEmailHtml, otpEmailText } from "@/lib/auth/otp-email";

/*
 * Code de vérification email (OTP) à la création de compte.
 *
 * - Le code n'est JAMAIS stocké en clair : sha256(code + ':' + userId) — l'id
 *   sert de sel, expiration 15 min, 6 tentatives max, envoi limité (45 s).
 * - Table email_verifications en service-role (RLS sans policy) : ces fonctions
 *   utilisent donc le service client.
 * - Envoi via Resend (email applicatif déjà branché). Rien ne bloque si l'envoi
 *   échoue : on remonte l'erreur pour l'afficher, sans exposer le code.
 */

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_ATTEMPTS = 6;

function hashCode(code: string, userId: string): string {
  return createHash("sha256").update(`${code}:${userId}`, "utf8").digest("hex");
}

function eq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Génère un code, l'enregistre (haché) et l'envoie par email. Respecte un
 * délai anti-spam entre deux envois. Renvoie { error } en cas d'échec d'envoi
 * ou de renvoi trop rapproché.
 */
export async function sendVerificationCode(
  userId: string,
  email: string,
  name?: string | null,
): Promise<{ ok: true } | { error: string; cooldownMs?: number }> {
  const supabase = createServiceClient();

  // Anti-spam : si un code a été envoyé il y a moins de 45 s, on refuse le renvoi.
  const { data: existing } = await supabase
    .from("email_verifications")
    .select("last_sent_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    const elapsed = Date.now() - Date.parse(existing.last_sent_at);
    if (elapsed < RESEND_COOLDOWN_MS) {
      return { error: "Un code vient d'être envoyé. Patientez quelques secondes avant d'en redemander un.", cooldownMs: RESEND_COOLDOWN_MS - elapsed };
    }
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = Date.now();
  const { error: upErr } = await supabase.from("email_verifications").upsert(
    {
      user_id: userId,
      code_hash: hashCode(code, userId),
      email,
      expires_at: new Date(now + CODE_TTL_MS).toISOString(),
      attempts: 0,
      last_sent_at: new Date(now).toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (upErr) return { error: "Impossible de préparer le code. Réessayez." };

  try {
    await sendEmail({
      to: email,
      subject: `Votre code de vérification : ${code}`,
      html: otpEmailHtml(code, name),
      text: otpEmailText(code),
    });
  } catch (e) {
    return { error: e instanceof Error ? `Envoi du code impossible : ${e.message}` : "Envoi du code impossible." };
  }
  return { ok: true };
}

/**
 * Vérifie le code saisi. Incrémente le compteur de tentatives ; sur succès,
 * marque profiles.email_verified et supprime la ligne. Ne révèle jamais si
 * l'échec vient du code ou de l'expiration au-delà du nécessaire.
 */
export async function verifyCode(
  userId: string,
  code: string,
): Promise<{ ok: true } | { error: string }> {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return { error: "Le code comporte 6 chiffres." };

  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from("email_verifications")
    .select("code_hash, expires_at, attempts")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return { error: "Aucun code en attente. Demandez un nouveau code." };

  if (Date.parse(row.expires_at) < Date.now()) {
    return { error: "Ce code a expiré. Demandez un nouveau code." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { error: "Trop de tentatives. Demandez un nouveau code." };
  }

  if (!eq(row.code_hash, hashCode(clean, userId))) {
    await supabase
      .from("email_verifications")
      .update({ attempts: row.attempts + 1 })
      .eq("user_id", userId);
    const left = MAX_ATTEMPTS - row.attempts - 1;
    return { error: left > 0 ? `Code incorrect. ${left} tentative${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""}.` : "Code incorrect. Demandez un nouveau code." };
  }

  await supabase.from("profiles").update({ email_verified: true }).eq("id", userId);
  await supabase.from("email_verifications").delete().eq("user_id", userId);
  return { ok: true };
}
