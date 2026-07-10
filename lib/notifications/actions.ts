"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/*
 * Actions du centre de notifications (cloche). Client user-scoped : la RLS
 * limite à l'organisation du membre, et le trigger notifications_guard_update
 * garantit que seul read_at est modifiable côté utilisateur.
 */

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export async function fetchNotifications(): Promise<{
  items: NotificationItem[];
  unread: number;
}> {
  const supabase = await createClient();
  const [{ data: items }, { count }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, kind, title, body, href, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null),
  ]);
  return { items: (items as NotificationItem[]) ?? [], unread: count ?? 0 };
}

export async function markNotificationRead(id: string): Promise<void> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .is("read_at", null);
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
}
