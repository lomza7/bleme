import type { Metadata } from "next";
import { Wizard } from "@/components/wizard/wizard";

export const metadata: Metadata = {
  title: "Créer mon dossier",
  description:
    "Décrivez votre blème en quelques minutes : l'IA monte le dossier, prépare les courriers et suit chaque étape.",
};

export default function NouveauDossierPage() {
  return <Wizard />;
}
