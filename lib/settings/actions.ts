"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { error?: string; success?: string };

export async function updateProfile(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const parsed = z
    .object({
      fullName: z.string().trim().min(2, "Indiquez votre nom.").max(120),
      phone: z
        .string()
        .trim()
        .max(20)
        .regex(/^[+\d][\d\s.-]*$/, "Numéro de téléphone invalide.")
        .or(z.literal(""))
        .optional(),
    })
    .safeParse({ fullName: formData.get("fullName"), phone: formData.get("phone") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
    })
    .eq("id", user.id);
  if (error) return { error: "Impossible d’enregistrer. Réessayez." };

  revalidatePath("/app", "layout");
  return { success: "Profil enregistré." };
}

export async function updateOrganization(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Indiquez le nom de votre entreprise.").max(160),
      siret: z
        .string()
        .trim()
        .regex(/^\d{14}$/, "Le SIRET doit faire 14 chiffres.")
        .or(z.literal(""))
        .optional(),
    })
    .safeParse({
      name: formData.get("name"),
      siret: String(formData.get("siret") ?? "").replace(/\s/g, ""),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!org) return { error: "Organisation introuvable." };

  const { error } = await supabase
    .from("organizations")
    .update({ name: parsed.data.name, siret: parsed.data.siret || null })
    .eq("id", org.id);
  if (error) return { error: "Impossible d’enregistrer. Réessayez." };

  revalidatePath("/app", "layout");
  return { success: "Entreprise enregistrée." };
}
