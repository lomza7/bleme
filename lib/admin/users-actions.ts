"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const deleteUserSchema = z.object({
  userId: z.string().uuid(),
  confirmation: z.string().trim().email(),
});

const CANCELLABLE_STRIPE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
]);

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return data?.is_admin ? { user } : null;
}

function adminRedirect(status: string): never {
  redirect(`/admin?suppression=${encodeURIComponent(status)}`);
}

function isAuthUserNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = "status" in error ? Number((error as { status?: unknown }).status) : null;
  const message =
    "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  return status === 404 || /user.*not.*found|not.*found/i.test(message);
}

async function removeStorageObjects(paths: string[]): Promise<boolean> {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (uniquePaths.length === 0) return true;

  const service = createServiceClient();
  for (let i = 0; i < uniquePaths.length; i += 100) {
    const { error } = await service.storage
      .from("documents")
      .remove(uniquePaths.slice(i, i + 100));
    if (error) return false;
  }
  return true;
}

export async function deletePlatformUser(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) adminRedirect("admin");

  const parsed = deleteUserSchema.safeParse({
    userId: formData.get("userId"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) adminRedirect("invalide");

  const { userId, confirmation } = parsed.data;
  if (userId === admin.user.id) adminRedirect("soi");

  const service = createServiceClient();
  const { data: targetRes, error: targetErr } = await service.auth.admin.getUserById(userId);
  const target = targetRes?.user;
  if ((targetErr && isAuthUserNotFound(targetErr)) || (!targetErr && !target?.email)) {
    revalidatePath("/admin");
    adminRedirect("introuvable");
  }
  if (targetErr || !target?.email) adminRedirect("erreur");
  if (confirmation.toLowerCase() !== target.email.toLowerCase()) adminRedirect("confirmation");

  const { data: memberships, error: membershipsErr } = await service
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId);
  if (membershipsErr) adminRedirect("erreur");

  const orgIds = [...new Set((memberships ?? []).map((m) => m.organization_id).filter(Boolean))];
  const { data: allMembers, error: membersErr } =
    orgIds.length > 0
      ? await service
          .from("organization_members")
          .select("organization_id, user_id")
          .in("organization_id", orgIds)
      : { data: [], error: null };
  if (membersErr) adminRedirect("erreur");

  const memberCounts = new Map<string, Set<string>>();
  for (const m of allMembers ?? []) {
    const set = memberCounts.get(m.organization_id) ?? new Set<string>();
    set.add(m.user_id);
    memberCounts.set(m.organization_id, set);
  }
  const soleOrgIds = orgIds.filter((orgId) => (memberCounts.get(orgId)?.size ?? 0) <= 1);

  if (soleOrgIds.length > 0) {
    const { data: orgs, error: orgsErr } = await service
      .from("organizations")
      .select("id, stripe_subscription_id, billing_status")
      .in("id", soleOrgIds);
    if (orgsErr) adminRedirect("erreur");

    const activeSubscriptionIds = (orgs ?? [])
      .filter((o) => o.stripe_subscription_id && CANCELLABLE_STRIPE_STATUSES.has(o.billing_status))
      .map((o) => o.stripe_subscription_id as string);
    if (activeSubscriptionIds.length > 0) {
      if (!(await isStripeConfigured())) adminRedirect("stripe");
      const stripe = await getStripe();
      for (const subscriptionId of activeSubscriptionIds) {
        try {
          await stripe.subscriptions.cancel(subscriptionId);
        } catch {
          adminRedirect("stripe");
        }
      }
    }

    const [{ data: docs }, { data: inboxItems }, { data: inboxAttachments }] = await Promise.all([
      service.from("documents").select("storage_path").in("organization_id", soleOrgIds),
      service.from("inbox_items").select("storage_path").in("organization_id", soleOrgIds),
      service.from("inbox_attachments").select("storage_path").in("organization_id", soleOrgIds),
    ]);
    const storageRemoved = await removeStorageObjects([
      ...((docs ?? []).map((d) => d.storage_path) as string[]),
      ...((inboxItems ?? []).map((i) => i.storage_path).filter(Boolean) as string[]),
      ...((inboxAttachments ?? []).map((a) => a.storage_path) as string[]),
    ]);
    if (!storageRemoved) adminRedirect("storage");
  }

  if (soleOrgIds.length > 0) {
    const { error: orgDeleteErr } = await service
      .from("organizations")
      .delete()
      .in("id", soleOrgIds);
    if (orgDeleteErr) adminRedirect("erreur");
  }

  const { error: authErr } = await service.auth.admin.deleteUser(userId, false);
  if (authErr && !isAuthUserNotFound(authErr)) adminRedirect("partiel");

  revalidatePath("/admin");
  adminRedirect("ok");
}
