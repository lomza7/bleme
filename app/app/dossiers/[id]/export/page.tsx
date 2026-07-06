import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { dateLongFr, euros } from "@/lib/format";
import { CASE_TYPE_LABEL, STATUS_META } from "@/lib/cases/constants";
import { LETTER_KINDS, LETTER_STATUS_LABEL } from "@/lib/cases/letter-meta";
import { FIELD_LABEL } from "@/lib/cases/extraction";
import { PrintButton } from "@/components/app/print-button";

export const metadata: Metadata = { title: "Export du dossier" };

export default async function CaseExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: c } = await supabase.from("cases").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();

  const [{ data: docs }, { data: letters }, { data: logs }] = await Promise.all([
    supabase.from("documents").select("id, file_name, created_at").eq("case_id", id).order("created_at", { ascending: true }),
    supabase.from("letters").select("kind, subject, status, channel, approved_at, content_sha256").eq("case_id", id).order("created_at", { ascending: true }),
    supabase.from("approval_logs").select("action, content_sha256, channel, created_at").eq("case_id", id).order("created_at", { ascending: true }),
  ]);

  const docList = docs ?? [];
  const { data: facts } = docList.length
    ? await supabase
        .from("document_extractions")
        .select("field_key, value_text, corrected_value, is_user_corrected")
        .in("document_id", docList.map((d) => d.id))
    : { data: [] };

  const statusMeta = STATUS_META[c.status] ?? { label: c.status };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/app/dossiers/${id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour au dossier
        </Link>
        <PrintButton />
      </div>

      <article className="mt-6 rounded-[1.75rem] border bg-card p-6 sm:p-8 print:border-0 print:p-0">
        <header>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Dossier · {CASE_TYPE_LABEL[c.case_type]}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{c.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {c.debtor_name} · {statusMeta.label} · créé le {dateLongFr(c.created_at)}
          </p>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Montant réclamé</p>
            <p className="mt-0.5 text-lg font-semibold">{euros(Number(c.amount_claimed_cents) || 0)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Montant récupéré</p>
            <p className="mt-0.5 text-lg font-semibold">{euros(Number(c.amount_recovered_cents) || 0)}</p>
          </div>
        </section>

        {c.summary_md ? (
          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Résumé</h2>
            <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed">{c.summary_md}</p>
          </section>
        ) : null}

        {(facts ?? []).length ? (
          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Faits</h2>
            <ul className="mt-2 divide-y">
              {(facts ?? []).map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-4 py-1.5 text-sm">
                  <span className="text-muted-foreground">{FIELD_LABEL[f.field_key] ?? f.field_key}</span>
                  <span className="font-medium">
                    {f.is_user_corrected && f.corrected_value ? f.corrected_value : f.value_text}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Courriers</h2>
          {(letters ?? []).length ? (
            <ul className="mt-2 flex flex-col gap-2">
              {(letters ?? []).map((l, i) => (
                <li key={i} className="rounded-2xl border p-3 text-sm print:rounded-none">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{LETTER_KINDS[l.kind]?.label ?? l.subject}</span>
                    <span className="text-xs text-muted-foreground">{LETTER_STATUS_LABEL[l.status] ?? l.status}</span>
                  </div>
                  {l.status === "sent" ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Validé{l.approved_at ? ` le ${dateLongFr(l.approved_at)}` : ""} ·{" "}
                      {l.channel === "postal" ? "recommandé" : "email"}
                      {l.content_sha256 ? ` · empreinte ${l.content_sha256.slice(0, 16)}…` : ""}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Aucun courrier.</p>
          )}
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Preuves de validation</h2>
          {(logs ?? []).length ? (
            <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
              {(logs ?? []).map((l, i) => (
                <li key={i}>
                  {dateLongFr(l.created_at)} · {l.action} · {l.channel} · empreinte {l.content_sha256.slice(0, 24)}…
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Aucune validation enregistrée.</p>
          )}
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Pièces jointes</h2>
          {docList.length ? (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {docList.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{d.file_name}</span>
                  <span className="text-xs text-muted-foreground">{dateLongFr(d.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Aucune pièce.</p>
          )}
        </section>

        <p className="mt-8 text-[11px] leading-relaxed text-muted-foreground">
          Document généré par BLEME. Modèles et suggestions — à faire valider par un professionnel en cas de doute.
        </p>
      </article>
    </div>
  );
}
