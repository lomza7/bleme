import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2, Check, CircleDashed } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/ui";
import { Uploader } from "@/components/app/uploader";
import { FileList, type DocRow } from "@/components/app/file-list";

export const metadata: Metadata = { title: "Documents de l’entreprise" };

// Pièces recommandées : détection souple par mots-clés dans les noms.
const RECOMMANDES = [
  { label: "Extrait Kbis", motifs: ["kbis", "k-bis"] },
  { label: "RIB", motifs: ["rib", "iban"] },
  { label: "Attestation d’assurance pro", motifs: ["assurance", "rc pro", "rcpro", "decennale", "décennale"] },
  { label: "CGV ou conditions", motifs: ["cgv", "condition"] },
];

export default async function EntrepriseDocsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: docs } = await supabase
    .from("documents")
    .select("id, file_name, mime_type, size_bytes, created_at")
    .is("case_id", null)
    .order("created_at", { ascending: false })
    .returns<DocRow[]>();

  const names = (docs ?? []).map((d) => d.file_name.toLowerCase());
  const checklist = RECOMMANDES.map((r) => ({
    ...r,
    present: names.some((n) => r.motifs.some((m) => n.includes(m))),
  }));

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/app/documents"
        className="inline-flex w-max items-center gap-2 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Mes documents
      </Link>

      <PageHeader
        title="Mon entreprise"
        sub="Le coffre commun : ces pièces alimentent tous vos dossiers et courriers."
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Uploader scope="company" />
          <FileList docs={docs ?? []} />
        </div>

        <aside className="rounded-[1.75rem] border bg-card p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
              <Building2 className="size-4.5" />
            </span>
            <h2 className="font-semibold">Pièces recommandées</h2>
          </div>
          <ul className="mt-5 space-y-3">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-3 text-sm">
                {item.present ? (
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Check className="size-3.5" />
                  </span>
                ) : (
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <CircleDashed className="size-3.5" />
                  </span>
                )}
                <span className={item.present ? "" : "text-muted-foreground"}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            Le Kbis et le RIB seront repris dans vos mises en demeure et
            relances ; l’attestation d’assurance rassure en cas de litige.
            Détection par le nom du fichier.
          </p>
        </aside>
      </div>
    </div>
  );
}
