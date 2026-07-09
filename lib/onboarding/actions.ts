"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fetchCompanyFiche } from "@/lib/companies/pappers";

/*
 * Onboarding /bienvenue : un seul enregistrement à la fin du parcours.
 * Tout est NULLABLE côté schéma — une réponse passée n'empêche jamais de
 * terminer. La fiche Pappers (si SIREN choisi) est récupérée ICI, côté
 * serveur, et stockée sur l'organisation (organizations.company_json) pour
 * servir ensuite (adresse d'expéditeur, forme juridique, vigilances).
 */

export type OnboardingState = { error?: string };

const ROLES = new Set(["dirigeant", "artisan", "independant", "comptable", "assistant", "autre"]);
const SOURCES = new Set(["bouche_a_oreille", "google", "reseaux", "comptable", "presse", "pub", "autre"]);
const SENDER_MODES = new Set(["company", "personal", "third_party"]);

const payloadSchema = z.object({
  firstName: z.string().trim().max(80).default(""),
  lastName: z.string().trim().max(80).default(""),
  roleTitle: z.string().trim().max(40).default(""),
  // Société : soit un SIREN choisi dans la recherche, soit une saisie manuelle.
  companyName: z.string().trim().max(200).default(""),
  companySiren: z
    .string()
    .trim()
    .regex(/^\d{9}$/)
    .nullable()
    .optional()
    .default(null),
  companyLegalForm: z.string().trim().max(120).default(""),
  companyAddress: z.string().trim().max(240).default(""),
  companyPostalCode: z.string().trim().max(12).default(""),
  companyCity: z.string().trim().max(120).default(""),
  senderMode: z.string().default("company"),
  senderThirdParty: z.string().trim().max(200).default(""),
  acquisitionSource: z.string().trim().max(40).default(""),
  acquisitionDetail: z.string().trim().max(300).default(""),
});

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsed = payloadSchema.safeParse(JSON.parse(String(formData.get("payload") ?? "{}")));
  if (!parsed.success) return { error: "Réponses illisibles — réessayez." };
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return { error: "Organisation introuvable — reconnectez-vous." };

  const fullName = [d.firstName, d.lastName].filter(Boolean).join(" ").trim();
  const roleTitle = ROLES.has(d.roleTitle) ? d.roleTitle : d.roleTitle ? "autre" : null;
  const source = SOURCES.has(d.acquisitionSource) ? d.acquisitionSource : null;
  const senderMode = SENDER_MODES.has(d.senderMode) ? d.senderMode : "company";

  // Fiche Pappers : récupérée une fois, côté serveur (jamais depuis le client).
  // Échec silencieux — l'onboarding n'échoue pas parce qu'une API externe tousse.
  const fiche = d.companySiren ? await fetchCompanyFiche(d.companySiren) : null;

  // Adresse : la fiche officielle prime ; sinon la saisie manuelle.
  const addressJson =
    fiche?.siege && (fiche.siege.adresse || fiche.siege.ville)
      ? {
          societe: fiche.nom || d.companyName || null,
          adresse: fiche.siege.adresse ?? null,
          codePostal: fiche.siege.codePostal ?? null,
          ville: fiche.siege.ville ?? null,
        }
      : d.companyAddress || d.companyCity
        ? {
            societe: d.companyName || null,
            adresse: d.companyAddress || null,
            codePostal: d.companyPostalCode || null,
            ville: d.companyCity || null,
          }
        : null;

  const { error: profErr } = await supabase
    .from("profiles")
    .update({
      first_name: d.firstName || null,
      last_name: d.lastName || null,
      full_name: fullName || null,
      role_title: roleTitle,
      acquisition_source: source,
      acquisition_detail: d.acquisitionDetail || null,
      onboarding_state: "done",
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (profErr) return { error: "Impossible d’enregistrer votre profil. Réessayez." };

  const orgPatch: Record<string, unknown> = {
    sender_mode: senderMode,
    sender_name:
      senderMode === "third_party"
        ? d.senderThirdParty || null
        : senderMode === "personal"
          ? fullName || null
          : null,
  };
  const companyName = (fiche?.nom || d.companyName).trim();
  if (companyName) orgPatch.name = companyName;
  if (fiche) {
    orgPatch.siren = fiche.siren;
    orgPatch.company_json = fiche;
    if (fiche.formeJuridique) orgPatch.legal_form = fiche.formeJuridique;
  } else if (d.companyLegalForm) {
    orgPatch.legal_form = d.companyLegalForm;
  }
  if (addressJson) orgPatch.address_json = addressJson;

  const { error: orgErr } = await supabase
    .from("organizations")
    .update(orgPatch)
    .eq("id", membership.organization_id);
  if (orgErr) return { error: "Impossible d’enregistrer votre société. Réessayez." };

  redirect("/app");
}
