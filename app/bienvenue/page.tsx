import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { OnboardingFlow } from "@/components/app/onboarding-flow";

export const metadata: Metadata = {
  title: "Bienvenue",
  robots: { index: false },
};

/*
 * Onboarding post-inscription (plein écran, hors coquille /app) : servi UNE
 * fois — profiles.onboarding_state passe à 'done' à la fin, et le layout /app
 * redirige ici tant que ce n'est pas fait. Préremplissage depuis ce qu'on
 * sait déjà (full_name du signup, nom d'organisation par défaut).
 */
export default async function BienvenuePage() {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/bienvenue");

  const [{ data: profile }, { data: org }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, first_name, last_name, onboarding_state, email_verified")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("organizations").select("name").limit(1).maybeSingle(),
  ]);
  // Email non vérifié → on passe d'abord par l'écran de code.
  if (profile && profile.email_verified === false) redirect("/verifier-email");
  if (profile?.onboarding_state === "done") redirect("/app");

  // Préremplissage : prénom/nom depuis le full_name du signup (« Camille Durand »).
  const parts = (profile?.full_name ?? "").trim().split(/\s+/).filter(Boolean);
  const firstName = profile?.first_name ?? parts[0] ?? "";
  const lastName = profile?.last_name ?? parts.slice(1).join(" ");
  // Le nom d'org par défaut retombe sur le nom de la personne ou le début de
  // l'email quand la société n'a pas été saisie au signup : dans ces cas on ne
  // préremplit PAS (mieux vaut une recherche vierge qu'un faux nom de société).
  const emailLocal = (user.email ?? "").split("@")[0];
  const orgName =
    org?.name && org.name !== profile?.full_name && org.name.toLowerCase() !== emailLocal.toLowerCase()
      ? org.name
      : "";

  return (
    <OnboardingFlow
      defaultFirstName={firstName}
      defaultLastName={lastName}
      defaultCompanyName={orgName}
    />
  );
}
