import type { Metadata } from "next";
import { Wizard } from "@/components/wizard/wizard";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Créer mon dossier",
  description:
    "Décrivez votre blème en quelques minutes : l'IA monte le dossier, prépare les courriers et suit chaque étape.",
};

export default async function NouveauDossierPage() {
  // Si l'utilisateur est déjà connecté : création directe du dossier (aucune
  // étape compte, aucun passage par /signup → la session est préservée), et le
  // wizard s'affiche dans le design clair de l'app. Sinon : tunnel d'acquisition.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <Wizard authed={!!user} />;
}
