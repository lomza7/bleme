import { z } from "zod";

/**
 * Variables d'environnement publiques (inlinées au build par Next).
 * Toujours y accéder via `publicEnv` — jamais process.env directement.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
});

/**
 * Variables serveur. Validées paresseusement (au premier accès, pas au build)
 * pour que `next build` fonctionne sans secrets. Un accès à une variable
 * manquante échoue immédiatement avec un message explicite.
 */
const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  // Optionnelles tant que la fonctionnalité n'est pas branchée (T6, T10, T13…)
  DEEPGRAM_API_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_INBOUND_SECRET: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  MERCI_FACTEUR_SERVICE_ID: z.string().min(1).optional(),
  MERCI_FACTEUR_SECRET_KEY: z.string().min(1).optional(),
  MERCI_FACTEUR_WEBHOOK_SECRET: z.string().min(1).optional(),
  CASE_EMAIL_DOMAIN: z.string().min(1).default("dossiers.bleme.fr"),
});

export function publicEnv() {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) {
    throw new Error(
      `Variables d'environnement publiques invalides ou manquantes :\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}

let cachedServerEnv: z.infer<typeof serverSchema> | null = null;

export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() ne doit jamais être appelé côté client.");
  }
  if (!cachedServerEnv) {
    const parsed = serverSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(
        `Variables d'environnement serveur invalides ou manquantes :\n${z.prettifyError(parsed.error)}`,
      );
    }
    cachedServerEnv = parsed.data;
  }
  return cachedServerEnv;
}

/** True si Supabase est configuré (utile pour les gardes du proxy en dev). */
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
