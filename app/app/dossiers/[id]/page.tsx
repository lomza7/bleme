import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  Circle,
  CircleUser,
  Cog,
  FileText,
  Sparkles,
  ShieldQuestion,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { dateFr, dateLongFr, euros, relativeDays } from "@/lib/format";
import { CASE_TYPE_LABEL, STATUS_META } from "@/lib/cases/constants";
import { checklistFor, completeness, DOC_KINDS } from "@/lib/cases/completeness";
import { RecordPayment } from "@/components/app/record-payment";
import { Uploader } from "@/components/app/uploader";
import { GenerateLetterButtons, LetterRow } from "@/components/app/letters";
import { FactRow } from "@/components/app/fact-row";

export const metadata: Metadata = { title: "Dossier" };

export default async function CaseDetailPage({
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

  const [{ data: c }, { data: events }, { data: docs }, { data: letters }] = await Promise.all([
    supabase.from("cases").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("case_events")
      .select("id, event_date, event_type, title, description, source")
      .eq("case_id", id)
      .order("event_date", { ascending: false }),
    supabase
      .from("documents")
      .select("id, file_name, doc_kind, doc_class")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("letters")
      .select("id, kind, status, subject, created_at")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!c) notFound();

  const docList = docs ?? [];
  const { data: facts } = docList.length
    ? await supabase
        .from("document_extractions")
        .select("id, field_key, value_text, corrected_value, is_user_corrected, confidence, source_excerpt")
        .in("document_id", docList.map((d) => d.id))
    : { data: [] };

  const statusMeta = STATUS_META[c.status] ?? { label: c.status, tone: "muted" };
  const remaining = c.amount_claimed_cents - c.amount_recovered_cents;
  const items = checklistFor(c.case_type);
  const { score, satisfied } = completeness(c.case_type, docList);
  const satisfiedSet = new Set(satisfied);
  const letterList = letters ?? [];
  const pendingLetter = letterList.find((l) => l.status === "draft" || l.status === "edited");
  const active = c.status !== "resolved" && c.status !== "closed";

  // Cible de la prochaine action (rendre le guidage cliquable).
  const cta = pendingLetter
    ? { href: `/app/dossiers/${c.id}/courrier/${pendingLetter.id}`, label: "Relire et valider" }
    : score < 100
      ? { href: "#preuves", label: "Déposer une pièce" }
      : { href: "#courriers", label: "Rédiger un courrier" };

  return (
    <div>
      <Link
        href="/app"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Tableau de bord
      </Link>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                statusMeta.tone === "green"
                  ? "bg-emerald-100 text-emerald-800"
                  : statusMeta.tone === "amber"
                    ? "bg-amber-100 text-amber-800"
                    : statusMeta.tone === "brand"
                      ? "bg-brand-soft text-brand-strong"
                      : "bg-muted text-muted-foreground"
              }`}
            >
              {statusMeta.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {CASE_TYPE_LABEL[c.case_type]}
              {c.is_sample ? " · dossier d’exemple" : ""} · créé le {dateLongFr(c.created_at)}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{c.title}</h1>
        </div>
        <div className="flex items-center gap-1.5" aria-label={`Étape ${c.stage} sur ${c.stage_total}`}>
          {Array.from({ length: c.stage_total }, (_, i) => (
            <span key={i} className={i < c.stage ? "h-2 w-8 rounded-full bg-brand" : "h-2 w-8 rounded-full bg-border"} />
          ))}
          <span className="ml-2 text-sm text-muted-foreground">
            Étape {c.stage} sur {c.stage_total}
          </span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Prochaine étape — guidage cliquable */}
          {active && c.next_action_label ? (
            <section className="flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] bg-ink p-6 text-ink-foreground sm:p-7">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-brand">
                  <CalendarClock className="size-4" />
                  Prochaine étape
                </div>
                <p className="mt-2 text-lg font-semibold leading-snug">{c.next_action_label}</p>
                {c.next_action_at ? (
                  <p className="mt-1 text-sm text-ink-muted">{relativeDays(c.next_action_at)}</p>
                ) : null}
              </div>
              <Link
                href={cta.href}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98]"
              >
                {cta.label}
                <ArrowRight className="size-4" />
              </Link>
            </section>
          ) : null}

          {/* Complétude & preuves */}
          <section id="preuves" className="scroll-mt-6 rounded-[1.75rem] border bg-card p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Pièces du dossier</h2>
              <span className="text-sm font-medium text-brand-strong">
                {satisfied.length}/{items.length} · {score}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand transition-all duration-700 ease-out" style={{ width: `${score}%` }} />
            </div>
            <ul className="mt-5 space-y-2.5">
              {items.map((item) => {
                const ok = satisfiedSet.has(item.kind);
                return (
                  <li key={item.kind} className="flex items-start gap-3">
                    {ok ? (
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground/40" />
                    )}
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${ok ? "" : ""}`}>{item.label}</p>
                      {!ok ? <p className="text-xs text-muted-foreground">{item.hint}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 border-t pt-6">
              <p className="mb-3 text-sm font-medium">Ajouter une pièce</p>
              <Uploader scope={c.id} kinds={DOC_KINDS} />
            </div>
          </section>

          {/* Faits extraits, sourcés et éditables */}
          {(facts ?? []).length > 0 ? (
            <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-brand-strong" />
                <h2 className="font-semibold">Informations repérées dans vos pièces</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Détectées automatiquement, avec leur source. Corrigez si besoin — votre correction fait foi.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(facts ?? []).map((f) => (
                  <FactRow key={f.id} fact={f} caseId={c.id} />
                ))}
              </div>
            </section>
          ) : null}

          {/* Courriers */}
          <section id="courriers" className="scroll-mt-6 rounded-[1.75rem] border bg-card p-6 sm:p-7">
            <h2 className="font-semibold">Courriers</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Générez un brouillon à partir des faits du dossier, relisez-le, puis validez pour l’envoyer en votre nom.
            </p>
            {active ? (
              <div className="mt-4">
                <GenerateLetterButtons caseId={c.id} caseType={c.case_type} />
              </div>
            ) : null}
            {letterList.length > 0 ? (
              <div className="mt-5 flex flex-col gap-2.5">
                {letterList.map((l) => (
                  <LetterRow key={l.id} letter={l} caseId={c.id} />
                ))}
              </div>
            ) : null}
          </section>

          {c.summary_md ? (
            <section className="rounded-[1.75rem] border bg-card p-7">
              <h2 className="font-semibold">Synthèse</h2>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
                {c.summary_md}
              </p>
            </section>
          ) : null}

          {c.weak_points_md ? (
            <section className="rounded-[1.75rem] bg-brand-soft p-7 ring-1 ring-brand/25">
              <div className="flex items-center gap-3">
                <ShieldQuestion className="size-5 text-brand-strong" />
                <h2 className="font-semibold">Points de vigilance</h2>
              </div>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
                {c.weak_points_md}
              </p>
            </section>
          ) : null}

          <section className="rounded-[1.75rem] border bg-card p-7">
            <h2 className="font-semibold">Chronologie</h2>
            <ol className="relative mt-5">
              <span aria-hidden className="absolute bottom-3 left-[15px] top-3 w-px bg-border" />
              {(events ?? []).map((e) => (
                <li key={e.id} className="relative flex items-start gap-4 py-3">
                  <span className="z-[1] mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-4 ring-card">
                    {e.source === "ai" ? <Bot className="size-4" /> : e.source === "user" ? <CircleUser className="size-4" /> : <Cog className="size-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium">{e.title}</p>
                    {e.description ? <p className="mt-0.5 text-sm text-muted-foreground">{e.description}</p> : null}
                    <p className="mt-0.5 text-xs text-muted-foreground/80">{dateFr(e.event_date)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Colonne latérale */}
        <aside className="flex flex-col gap-6">
          <section className="rounded-[1.75rem] border bg-card p-7">
            <h2 className="font-semibold">Montants</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Réclamé</dt>
                <dd className="font-semibold">{euros(c.amount_claimed_cents)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Récupéré</dt>
                <dd className="font-semibold text-emerald-700">{euros(c.amount_recovered_cents)}</dd>
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <dt className="text-muted-foreground">Restant</dt>
                <dd className="font-bold">{euros(Math.max(0, remaining))}</dd>
              </div>
              {c.expected_recovery_at && c.status !== "resolved" ? (
                <p className="rounded-2xl bg-muted px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
                  Récupération estimée autour du {dateLongFr(c.expected_recovery_at)}, si la cadence suit son cours.
                </p>
              ) : null}
            </dl>
            {active ? (
              <div className="mt-5 border-t pt-5">
                <RecordPayment caseId={c.id} />
              </div>
            ) : null}
          </section>

          <Link
            href={`/app/documents/${c.id}`}
            className="flex items-center gap-3 rounded-[1.75rem] border bg-card p-5 transition-colors duration-300 hover:border-brand/50 hover:bg-brand-soft/40"
          >
            <FileText className="size-5 text-brand-strong" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Toutes les pièces</p>
              <p className="text-xs text-muted-foreground">
                {docList.length} document{docList.length > 1 ? "s" : ""} dans ce dossier
              </p>
            </div>
            <ArrowRight className="ml-auto size-4 text-muted-foreground" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
