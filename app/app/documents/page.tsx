import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Camera,
  FileText,
  Mail,
  MessagesSquare,
  UploadCloud,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/ui";

export const metadata: Metadata = { title: "Mes documents" };

export default async function DocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const canaux = [
    {
      icon: UploadCloud,
      titre: "Glisser-déposer",
      detail: "PDF, photos, captures : reconnus, datés et classés par dossier.",
    },
    {
      icon: Mail,
      titre: "Adresse email du dossier",
      detail: "Transférez un email : le message et ses pièces jointes se rangent seuls.",
    },
    {
      icon: Camera,
      titre: "Photos du téléphone",
      detail: "Votre pellicule est pleine de preuves. Envoyez, on date et on décrit.",
    },
    {
      icon: MessagesSquare,
      titre: "WhatsApp et SMS",
      detail: "Exports et captures : le texte est reconnu et versé à la chronologie.",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Mes documents"
        sub="Toutes les pièces de vos dossiers, reconnues et classées au même endroit."
      />

      <div className="relative overflow-hidden rounded-[1.75rem] border-2 border-dashed border-brand/30 bg-brand-soft/40 p-10">
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand text-brand-foreground">
            <UploadCloud className="size-6" />
          </span>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold">L’upload arrive très vite</h2>
            <span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-medium text-brand-foreground">
              Bientôt
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            La gestion des pièces est en construction : reconnaissance
            automatique (montants, dates, parties), score de complétude et
            bordereau numéroté pour l’export. En attendant, votre récit vocal
            et vos dossiers avancent déjà.
          </p>
          <Link
            href="/nouveau"
            className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong"
          >
            Créer un dossier
          </Link>
        </div>
      </div>

      <section>
        <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Ce que vous pourrez y verser
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {canaux.map((c) => (
            <div
              key={c.titre}
              className="flex items-start gap-4 rounded-[1.75rem] border bg-card p-6"
            >
              <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                <c.icon className="size-4.5" />
              </span>
              <div>
                <h3 className="font-semibold">{c.titre}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {c.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground/80">
        <FileText className="mt-0.5 size-3.5 shrink-0" />
        Chaque pièce gardera sa source et son horodatage, et restera exportable
        à tout moment : vos preuves vous appartiennent.
      </p>
    </div>
  );
}
