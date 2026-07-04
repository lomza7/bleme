"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";

export type AuthState = {
  error?: string;
  success?: string;
};

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Entrez une adresse email valide.");

const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit faire au moins 8 caractères.");

/** Traduit les erreurs Supabase Auth les plus courantes. */
function frenchAuthError(message: string): string {
  const map: [RegExp, string][] = [
    [/invalid login credentials/i, "Email ou mot de passe incorrect."],
    [/user already registered/i, "Un compte existe déjà avec cet email. Connectez-vous."],
    [/email not confirmed/i, "Confirmez d’abord votre email : un lien vous a été envoyé."],
    [/email rate limit|rate limit exceeded|too many requests/i, "Trop de tentatives. Réessayez dans quelques minutes."],
    [/password should be at least/i, "Le mot de passe doit faire au moins 8 caractères."],
    [/new password should be different/i, "Le nouveau mot de passe doit être différent de l’ancien."],
    [/same password/i, "Le nouveau mot de passe doit être différent de l’ancien."],
    [/user not found/i, "Aucun compte ne correspond à cet email."],
    [/signups not allowed/i, "Les inscriptions sont temporairement fermées."],
  ];
  for (const [re, fr] of map) {
    if (re.test(message)) return fr;
  }
  return "Une erreur est survenue. Réessayez, ou contactez-nous si ça persiste.";
}

function nextPath(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/app";
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = z
    .object({
      fullName: z.string().trim().min(2, "Indiquez votre nom."),
      companyName: z.string().trim().optional(),
      email: emailSchema,
      password: passwordSchema,
    })
    .safeParse({
      fullName: formData.get("fullName"),
      companyName: formData.get("companyName") || undefined,
      email: formData.get("email"),
      password: formData.get("password"),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        company_name: parsed.data.companyName ?? "",
      },
      emailRedirectTo: `${publicEnv().NEXT_PUBLIC_APP_URL}/auth/confirm?next=/app`,
    },
  });
  if (error) return { error: frenchAuthError(error.message) };

  // Email déjà enregistré : Supabase renvoie un user sans identités.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "Un compte existe déjà avec cet email. Connectez-vous." };
  }

  redirect(`/verifier-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = z
    .object({ email: emailSchema, password: z.string().min(1, "Entrez votre mot de passe.") })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: frenchAuthError(error.message) };

  redirect(nextPath(formData.get("next")));
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${publicEnv().NEXT_PUBLIC_APP_URL}/auth/confirm?next=/reinitialiser`,
  });
  if (error) return { error: frenchAuthError(error.message) };

  // Toujours le même message, que le compte existe ou non (anti-énumération).
  return {
    success:
      "Si un compte existe avec cet email, un lien de réinitialisation vient de partir. Pensez aux spams.",
  };
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  if (formData.get("password") !== formData.get("confirm")) {
    return { error: "Les deux mots de passe ne correspondent pas." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error:
        "Votre lien a expiré. Redemandez un email de réinitialisation depuis la page « mot de passe oublié ».",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { error: frenchAuthError(error.message) };

  redirect("/app");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
