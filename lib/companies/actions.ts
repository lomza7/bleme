"use server";

import { searchAnnuaire } from "@/lib/companies/pappers";
import type { CompanyHit } from "@/lib/companies/types";

/** Action appelable depuis le client : autocomplétion d'entreprise (annuaire). */
export async function searchCompanies(query: string): Promise<CompanyHit[]> {
  return searchAnnuaire(query);
}
