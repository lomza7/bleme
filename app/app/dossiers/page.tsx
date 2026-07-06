import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  CaseCard,
  OPEN_STATUSES,
  PageHeader,
  type CaseRow,
} from "@/components/app/ui";

export const metadata: Metadata = { title: "Mes dossiers" };

const FILTRES = [
  { key: "tous", label: "Tous" },
  { key: "en-cours", label: "En cours" },
  { key: "resolus", label: "Résolus" },
  { key: "impayes", label: "Impayés" },
  { key: "litiges", label: "Litiges" },
] as const;

export default async function DossiersPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const { filtre = "tous" } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("cases")
    .select(
      "id, case_type, title, status, debtor_name, amount_claimed_cents, amount_recovered_cents, stage, stage_total, phase, next_action_label, next_action_at, expected_recovery_at, is_sample",
    )
    .order("updated_at", { ascending: false })
    .returns<CaseRow[]>();

  const all = data ?? [];
  const filtered = all.filter((c) => {
    switch (filtre) {
      case "en-cours":
        return OPEN_STATUSES.includes(c.status);
      case "resolus":
        return c.status === "resolved" || c.status === "closed";
      case "impayes":
        return c.case_type === "unpaid_invoice";
      case "litiges":
        return c.case_type === "client_dispute";
      default:
        return true;
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mes dossiers"
        sub={`${all.length} dossier${all.length > 1 ? "s" : ""} au total`}
      />

      <div className="flex flex-wrap gap-1.5">
        {FILTRES.map((f) => {
          const active = f.key === filtre;
          return (
            <Link
              key={f.key}
              href={f.key === "tous" ? "/app/dossiers" : `/app/dossiers?filtre=${f.key}`}
              className={
                active
                  ? "rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground"
                  : "rounded-full border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground"
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-[1.75rem] border bg-card p-10">
          <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
            <FolderPlus className="size-5" />
          </span>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            {all.length === 0
              ? "Aucun dossier pour l’instant. Racontez votre premier blème, il apparaîtra ici."
              : "Aucun dossier ne correspond à ce filtre."}
          </p>
          {all.length === 0 ? (
            <Link
              href="/nouveau"
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong"
            >
              Raconter mon blème
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((c) => (
            <CaseCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
