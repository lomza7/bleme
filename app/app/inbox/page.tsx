import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OPEN_STATUSES } from "@/components/app/ui";
import { InboxClient, type InboxItem } from "@/components/app/inbox-client";

export const metadata: Metadata = { title: "Boîte de réception" };

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const { data: org } = membership
    ? await supabase
        .from("organizations")
        .select("inbox_slug")
        .eq("id", membership.organization_id)
        .maybeSingle()
    : { data: null };
  const address = `${org?.inbox_slug ?? "b-votreadresse"}@dossiers.bleme.fr`;

  const [{ data: items }, { data: openCases }] = await Promise.all([
    supabase.from("inbox_items").select("*").order("received_at", { ascending: false }),
    supabase
      .from("cases")
      .select("id, title, status, case_type")
      .in("status", [...OPEN_STATUSES])
      .order("updated_at", { ascending: false }),
  ]);

  const all = items ?? [];
  const itemIds = all.map((i) => i.id);

  // Pièces jointes regroupées par élément + titres des dossiers déjà versés
  // (les dossiers clos ne figurent pas dans la liste des dossiers ouverts).
  const versedCaseIds = [...new Set(all.map((i) => i.case_id).filter(Boolean))] as string[];
  const [{ data: attachments }, { data: versedCases }] = await Promise.all([
    itemIds.length
      ? supabase
          .from("inbox_attachments")
          .select("id, inbox_item_id, file_name, mime_type, size_bytes")
          .in("inbox_item_id", itemIds)
      : Promise.resolve({ data: [] as never[] }),
    versedCaseIds.length
      ? supabase.from("cases").select("id, title").in("id", versedCaseIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);

  const attByItem = new Map<string, InboxItem["attachments"]>();
  for (const a of attachments ?? []) {
    const list = attByItem.get(a.inbox_item_id) ?? [];
    list.push({ id: a.id, file_name: a.file_name, mime_type: a.mime_type, size_bytes: a.size_bytes });
    attByItem.set(a.inbox_item_id, list);
  }
  const caseTitles: Record<string, string> = {};
  for (const c of versedCases ?? []) caseTitles[c.id] = c.title;

  const enriched: InboxItem[] = all.map((i) => ({
    id: i.id,
    source: i.source,
    from_name: i.from_name,
    from_contact: i.from_contact,
    subject: i.subject,
    excerpt: i.excerpt,
    body_text: i.body_text,
    storage_path: i.storage_path,
    mime_type: i.mime_type,
    size_bytes: i.size_bytes,
    label_id: i.label_id,
    case_id: i.case_id,
    is_read: i.is_read,
    is_archived: i.is_archived,
    is_sample: i.is_sample,
    received_at: i.received_at,
    attachments: attByItem.get(i.id) ?? [],
  }));

  return (
    <InboxClient
      items={enriched}
      cases={openCases ?? []}
      caseTitles={caseTitles}
      address={address}
      hasSamples={all.some((i) => i.is_sample)}
    />
  );
}
