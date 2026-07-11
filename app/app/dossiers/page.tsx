import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { lastSendByCase } from "@/lib/cases/tracking-summary";
import { PageHeader } from "@/components/app/ui";
import { DossiersTable, type DossierRow, type SendInfo } from "@/components/app/dossiers-table";

export const metadata: Metadata = { title: "Mes dossiers" };

export default async function DossiersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("cases")
    .select(
      "id, case_type, title, status, debtor_name, amount_claimed_cents, amount_recovered_cents, next_action_label, next_action_at, is_sample",
    )
    .order("updated_at", { ascending: false })
    .returns<DossierRow[]>();
  const all = data ?? [];

  // Dernier envoi par dossier (colonne « Suivi » sans ouvrir le dossier).
  const lastSends = await lastSendByCase(supabase, all.map((c) => c.id));
  const sends: Record<string, SendInfo> = {};
  for (const [id, s] of Object.entries(lastSends)) {
    if (s.sent_at) sends[id] = { kind: s.kind, channel: s.channel, sent_at: s.sent_at, tracking_status: s.tracking_status };
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Mes dossiers" sub={`${all.length} dossier${all.length > 1 ? "s" : ""}`}>
        <Link
          href="/nouveau"
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
        >
          <Plus className="size-4" />
          Nouveau dossier
        </Link>
      </PageHeader>

      <DossiersTable rows={all} sends={sends} />
    </div>
  );
}
