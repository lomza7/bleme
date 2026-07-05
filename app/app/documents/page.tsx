import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronRight, Folder, FolderPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CASE_TYPE_LABEL } from "@/lib/cases/constants";
import { PageHeader } from "@/components/app/ui";

export const metadata: Metadata = { title: "Mes documents" };

export default async function DocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: cases }, { data: docs }] = await Promise.all([
    supabase
      .from("cases")
      .select("id, title, case_type, status")
      .order("updated_at", { ascending: false }),
    supabase.from("documents").select("id, case_id"),
  ]);

  const counts = new Map<string, number>();
  let companyCount = 0;
  for (const d of docs ?? []) {
    if (d.case_id) counts.set(d.case_id, (counts.get(d.case_id) ?? 0) + 1);
    else companyCount += 1;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mes documents"
        sub="Toutes vos pièces, rangées par dossier. Déposez, téléchargez, c’est chez vous."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Coffre entreprise, épinglé */}
        <Link
          href="/app/documents/entreprise"
          className="group flex flex-col justify-between gap-6 rounded-[1.75rem] bg-ink p-6 text-ink-foreground transition-all duration-500 ease-fluid hover:-translate-y-0.5 hover:shadow-xl hover:shadow-zinc-950/[0.15] sm:col-span-2 lg:col-span-1"
        >
          <div className="flex items-start justify-between">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-brand/20 text-brand">
              <Building2 className="size-5" />
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-ink-muted">
              {companyCount} pièce{companyCount > 1 ? "s" : ""}
            </span>
          </div>
          <div>
            <h2 className="font-semibold">Mon entreprise</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Kbis, RIB, assurances, CGV : le coffre commun à tous vos
              dossiers.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand">
              Ouvrir
              <ChevronRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>

        {/* Un dossier par blème */}
        {(cases ?? []).map((c) => {
          const n = counts.get(c.id) ?? 0;
          return (
            <Link
              key={c.id}
              href={`/app/documents/${c.id}`}
              className="group flex flex-col justify-between gap-6 rounded-[1.75rem] border bg-card p-6 transition-all duration-500 ease-fluid hover:-translate-y-0.5 hover:shadow-lg hover:shadow-zinc-950/[0.05]"
            >
              <div className="flex items-start justify-between">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
                  <Folder className="size-5" />
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  {n} pièce{n > 1 ? "s" : ""}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {CASE_TYPE_LABEL[c.case_type]}
                </p>
                <h2 className="mt-0.5 line-clamp-2 font-semibold">{c.title}</h2>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-strong">
                  Ouvrir
                  <ChevronRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {(cases ?? []).length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-[1.75rem] border bg-card p-8">
          <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
            <FolderPlus className="size-5" />
          </span>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Chaque blème aura son dossier de pièces ici. Créez le premier :
            l’adresse email dédiée et le classement automatique suivront.
          </p>
          <Link
            href="/nouveau"
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong"
          >
            Raconter mon blème
          </Link>
        </div>
      ) : null}
    </div>
  );
}
