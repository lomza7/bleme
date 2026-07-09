"use server";

import { searchAdministrations } from "@/lib/administrations/annuaire";
import type { AdminHit } from "@/lib/administrations/types";

/** Action appelable depuis le client : autocomplétion d'administration (annuaire officiel). */
export async function searchAdmins(query: string): Promise<AdminHit[]> {
  return searchAdministrations(query);
}
