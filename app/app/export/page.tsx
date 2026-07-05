import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Archive, Download, FileJson, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ComingSoonCard, PageHeader } from "@/components/app/ui";

export const metadata: Metadata = { title: "Exporter" };

export default async function ExportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { count } = await supabase
    .from("cases")
    .select("id", { count: "exact", head: true });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Exporter"
        sub="Vos données vous appartiennent : repartez avec, à tout moment, même après résiliation."
      />

      <div className="flex flex-col items-start gap-4 rounded-[1.75rem] border bg-card p-8">
        <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
          <FileJson className="size-5" />
        </span>
        <h2 className="text-lg font-semibold">Toutes mes données (JSON)</h2>
        <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
          Profil, organisation, {count ?? 0} dossier{(count ?? 0) > 1 ? "s" : ""} et
          chronologies complètes, dans un fichier lisible par n’importe quel
          outil. C’est aussi votre droit RGPD, en un clic plutôt qu’en courrier
          recommandé.
        </p>
        <a
          href="/app/export/donnees"
          download
          className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
        >
          <Download className="size-4" />
          Télécharger mon export
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ComingSoonCard icon={<FileText className="size-5" />} title="Dossier prêt pour un professionnel">
          Synthèse PDF, chronologie, courriers et pièces numérotées dans un ZIP
          ordonné : le dossier qui fait gagner du temps (et des honoraires)
          chez un avocat ou un commissaire de justice.
        </ComingSoonCard>
        <ComingSoonCard icon={<Archive className="size-5" />} title="Export comptable">
          Le récapitulatif de vos encaissements et indemnités, prêt à
          transmettre à votre comptable en fin de mois.
        </ComingSoonCard>
      </div>
    </div>
  );
}
