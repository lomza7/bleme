"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/*
 * Suivi de démarchage des leads professionnels (comptables / avocats).
 * Réservé aux admins : garde vérifiée ici, écriture en service-role (la table
 * professional_leads n'est lisible/modifiable qu'en admin par RLS).
 */

const OUTREACH_STATUSES = [
  "new",
  "contacted",
  "interested",
  "declined",
  "onboarded",
] as const;

export async function updateLeadStatus(formData: FormData): Promise<void> {
  const parsed = z
    .object({
      id: z.string().uuid(),
      status: z.enum(OUTREACH_STATUSES),
    })
    .safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) return;

  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return;
  const { data: me } = await userClient
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_admin) return;

  const service = createServiceClient();
  await service
    .from("professional_leads")
    .update({ outreach_status: parsed.data.status })
    .eq("id", parsed.data.id);

  revalidatePath("/admin/prospection");
}
