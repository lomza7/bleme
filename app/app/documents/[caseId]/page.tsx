import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CASE_TYPE_LABEL } from "@/lib/cases/constants";
import { PageHeader, StatusChip } from "@/components/app/ui";
import { Uploader } from "@/components/app/uploader";
import { FileList, type DocRow } from "@/components/app/file-list";

export const metadata: Metadata = { title: "Pièces du dossier" };

export default async function CaseDocsPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: c }, { data: docs }] = await Promise.all([
    supabase
      .from("cases")
      .select("id, title, case_type, status")
      .eq("id", caseId)
      .maybeSingle(),
    supabase
      .from("documents")
      .select("id, file_name, mime_type, size_bytes, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .returns<DocRow[]>(),
  ]);
  if (!c) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/app/documents"
        className="inline-flex w-max items-center gap-2 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Mes documents
      </Link>

      <PageHeader title={c.title} sub={`Pièces du dossier · ${CASE_TYPE_LABEL[c.case_type]}`}>
        <div className="flex items-center gap-3">
          <StatusChip status={c.status} />
          <Link
            href={`/app/dossiers/${c.id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-strong transition-colors duration-300 hover:text-brand"
          >
            Voir le dossier
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </PageHeader>

      <div className="flex flex-col gap-4">
        <Uploader scope={c.id} />
        <FileList docs={docs ?? []} />
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground/80">
        Chaque pièce ajoutée est datée et rejoint la chronologie du dossier.
        La reconnaissance automatique (montants, dates, classement) arrive
        très vite.
      </p>
    </div>
  );
}
