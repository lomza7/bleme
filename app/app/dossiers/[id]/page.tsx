import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  CircleUser,
  Cog,
  ShieldQuestion,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { dateFr, dateLongFr, euros, relativeDays } from "@/lib/format";
import { CASE_TYPE_LABEL, STATUS_META } from "@/lib/cases/constants";
import { AppHeader } from "@/components/app/header";
import { RecordPayment } from "@/components/app/record-payment";

export const metadata: Metadata = { title: "Dossier" };

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) redirect("/login");
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: c }, { data: events }, { data: org }] = await Promise.all([
    supabase.from("cases").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("case_events")
      .select("id, event_date, event_type, title, description, source")
      .eq("case_id", id)
      .order("event_date", { ascending: false }),
    supabase.from("organizations").select("name").limit(1).maybeSingle(),
  ]);
  if (!c) notFound();

  const statusMeta = STATUS_META[c.status] ?? { label: c.status, tone: "muted" };
  const remaining = c.amount_claimed_cents - c.amount_recovered_cents;

  return (
    <div className="min-h-dvh bg-muted/40 text-foreground">
      <AppHeader orgName={org?.name} />

      <main className="mx-auto max-w-6xl px-6 py-10">
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
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {c.title}
            </h1>
          </div>
          <div className="flex items-center gap-1.5" aria-label={`Étape ${c.stage} sur ${c.stage_total}`}>
            {Array.from({ length: c.stage_total }, (_, i) => (
              <span
                key={i}
                className={
                  i < c.stage
                    ? "h-2 w-8 rounded-full bg-brand"
                    : "h-2 w-8 rounded-full bg-border"
                }
              />
            ))}
            <span className="ml-2 text-sm text-muted-foreground">
              Étape {c.stage} sur {c.stage_total}
            </span>
          </div>
        </div>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-3">
          {/* Colonne principale */}
          <div className="flex flex-col gap-6 lg:col-span-2">
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
                <span
                  aria-hidden
                  className="absolute bottom-3 left-[15px] top-3 w-px bg-border"
                />
                {(events ?? []).map((e) => (
                  <li key={e.id} className="relative flex items-start gap-4 py-3">
                    <span className="z-[1] mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-4 ring-card">
                      {e.source === "ai" ? (
                        <Bot className="size-4" />
                      ) : e.source === "user" ? (
                        <CircleUser className="size-4" />
                      ) : (
                        <Cog className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[15px] font-medium">{e.title}</p>
                      {e.description ? (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {e.description}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-muted-foreground/80">
                        {dateFr(e.event_date)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* Colonne latérale */}
          <aside className="flex flex-col gap-6">
            {c.next_action_label ? (
              <section className="rounded-[1.75rem] bg-ink p-7 text-ink-foreground">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-brand">
                  <CalendarClock className="size-4" />
                  Prochaine action
                </div>
                <p className="mt-3 font-medium leading-snug">
                  {c.next_action_label}
                </p>
                {c.next_action_at ? (
                  <p className="mt-1.5 text-sm text-ink-muted">
                    {relativeDays(c.next_action_at)}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="rounded-[1.75rem] border bg-card p-7">
              <h2 className="font-semibold">Montants</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Réclamé</dt>
                  <dd className="font-semibold">{euros(c.amount_claimed_cents)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Récupéré</dt>
                  <dd className="font-semibold text-emerald-700">
                    {euros(c.amount_recovered_cents)}
                  </dd>
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
              {c.status !== "resolved" && c.status !== "closed" ? (
                <div className="mt-5 border-t pt-5">
                  <RecordPayment caseId={c.id} />
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
