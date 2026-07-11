import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileArchive, FileJson, FileSpreadsheet, FolderOpen, Lock, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { accessCan, getMyAccess } from "@/lib/permissions/server";
import { euros } from "@/lib/format";
import { CASE_TYPE_LABEL, STATUS_META } from "@/lib/cases/constants";
import { fetchComptaCases, indemnityCents, periodStartMs } from "@/lib/export/comptable";
import { PageHeader } from "@/components/app/ui";
import { ComptaExport, DownloadButton, type ComptaRow } from "@/components/app/export-actions";

export const metadata: Metadata = { title: "Exporter" };

export default async function ExportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getMyAccess();
  const canExport = accessCan(access, "export.data");

  if (!canExport) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Exporter" sub="Repartez avec vos données, à tout moment." />
        <div className="flex flex-col items-start gap-4 rounded-[1.75rem] border bg-card p-8">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Lock className="size-5" />
          </span>
          <h2 className="text-lg font-semibold">L’export n’est pas dans vos droits</h2>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            Demandez à un propriétaire de votre équipe d’activer « Exporter les données »
            depuis Mon équipe.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: cases }, comptaCases] = await Promise.all([
    supabase
      .from("cases")
      .select("id, title, debtor_name, case_type, status, amount_claimed_cents, created_at")
      .eq("is_sample", false)
      .order("created_at", { ascending: false }),
    fetchComptaCases(supabase),
  ]);
  const dossiers = cases ?? [];

  // eslint-disable-next-line react-hooks/purity -- horodatage de filtrage de période
  const nowMs = Date.now();
  const monthStartMs = periodStartMs("mois", nowMs);
  const yearStartMs = periodStartMs("annee", nowMs);
  const comptaRows: ComptaRow[] = comptaCases.map((c) => ({
    title: c.title,
    debtor: c.debtor_name,
    claimed: c.amount_claimed_cents,
    recovered: c.amount_recovered_cents,
    indemnity: indemnityCents(c),
    status: c.status,
    createdAt: c.created_at,
    resolvedAt: c.resolved_at,
  }));

  return (
    <div className="flex flex-col gap-6 duration-500 animate-in fade-in-0">
      <PageHeader
        title="Exporter"
        sub="Vos données vous appartiennent. Repartez avec, à tout moment, même après résiliation."
      />

      {/* JSON — instantané */}
      <section
        style={{ animationDelay: "50ms" }}
        className="overflow-hidden rounded-[1.75rem] border bg-card duration-500 animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both"
      >
        <div className="flex flex-col gap-4 bg-gradient-to-b from-brand-soft/40 to-card p-7 sm:p-8">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong ring-1 ring-brand/15">
            <FileJson className="size-5" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Toutes mes données (JSON)</h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Profil, organisation, {dossiers.length} dossier{dossiers.length > 1 ? "s" : ""},
              courriers, pièces et chronologies, dans un fichier lisible par n’importe quel outil.
              Votre droit RGPD, en un clic.
            </p>
          </div>
          <DownloadButton
            url="/app/export/donnees"
            fallbackName="bleme-export.json"
            label="Télécharger le JSON"
            icon={<FileJson className="size-4" />}
          />
        </div>
      </section>

      {/* Dossier prêt pour un professionnel — ZIP par dossier */}
      <section
        style={{ animationDelay: "110ms" }}
        className="overflow-hidden rounded-[1.75rem] border bg-card duration-500 animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both"
      >
        <div className="flex items-start gap-4 border-b p-7 sm:p-8">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-ink-foreground">
            <FileArchive className="size-5" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Dossier prêt pour un professionnel</h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Un ZIP par dossier : synthèse PDF, courriers et pièces numérotées. Le dossier prêt
              à confier à un avocat ou un commissaire de justice, sans perdre de temps.
            </p>
          </div>
        </div>

        {dossiers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <FolderOpen className="size-5" strokeWidth={1.75} />
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">
              Créez un premier dossier pour générer son ZIP prêt à transmettre.
            </p>
            <Link
              href="/app/nouveau"
              className="mt-1 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
            >
              <Plus className="size-4" />
              Nouveau blème
            </Link>
          </div>
        ) : (
          <ul>
            {dossiers.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4 transition-colors duration-300 last:border-b-0 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{CASE_TYPE_LABEL[d.case_type] ?? d.case_type}</span>
                    <span aria-hidden>·</span>
                    <span className="truncate">{d.debtor_name}</span>
                    <span aria-hidden>·</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                      {STATUS_META[d.status]?.label ?? d.status}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">{euros(Number(d.amount_claimed_cents) || 0)}</span>
                  </p>
                </div>
                <DownloadButton
                  url={`/app/export/dossier-pro?id=${d.id}`}
                  fallbackName={`dossier.zip`}
                  label="ZIP"
                  tone="ghost"
                  size="sm"
                  icon={<FileArchive className="size-4" />}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Export comptable — CSV par période */}
      <section
        style={{ animationDelay: "170ms" }}
        className="overflow-hidden rounded-[1.75rem] border bg-card duration-500 animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both"
      >
        <div className="flex items-start gap-4 border-b p-7 sm:p-8">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong ring-1 ring-brand/15">
            <FileSpreadsheet className="size-5" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Export comptable</h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Le récapitulatif de vos encaissements et de l’indemnité forfaitaire, période par
              période, prêt à transmettre à votre comptable (CSV, ouvre dans Excel).
            </p>
          </div>
        </div>
        <div className="p-7 sm:p-8">
          <ComptaExport rows={comptaRows} monthStartMs={monthStartMs} yearStartMs={yearStartMs} />
        </div>
      </section>
    </div>
  );
}
