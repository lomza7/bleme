import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarClock,
  ChevronRight,
  FolderPlus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { euros, relativeDays } from "@/lib/format";
import {
  CASE_TYPE_LABEL,
  FIXED_INDEMNITY_CENTS,
  STATUS_META,
} from "@/lib/cases/constants";
import { createSampleCases, deleteSampleCases } from "@/lib/cases/actions";
import { AppHeader } from "@/components/app/header";
import { DraftBanner } from "@/components/app/draft-banner";

export const metadata: Metadata = { title: "Tableau de bord" };

type CaseRow = {
  id: string;
  case_type: string;
  title: string;
  status: string;
  debtor_name: string;
  amount_claimed_cents: number;
  amount_recovered_cents: number;
  stage: number;
  stage_total: number;
  next_action_label: string | null;
  next_action_at: string | null;
  expected_recovery_at: string | null;
  is_sample: boolean;
};

const OPEN_STATUSES = ["active", "awaiting_user", "awaiting_debtor", "escalated"];

export default async function AppHomePage() {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: org }, { data: profile }, { data: cases }] = await Promise.all([
    supabase.from("organizations").select("name").limit(1).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("cases")
      .select(
        "id, case_type, title, status, debtor_name, amount_claimed_cents, amount_recovered_cents, stage, stage_total, next_action_label, next_action_at, expected_recovery_at, is_sample",
      )
      .neq("status", "closed")
      .order("next_action_at", { ascending: true, nullsFirst: false })
      .returns<CaseRow[]>(),
  ]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const all = cases ?? [];
  const open = all.filter((c) => OPEN_STATUSES.includes(c.status));
  const hasSamples = all.some((c) => c.is_sample);

  const atStake = open.reduce(
    (sum, c) => sum + Math.max(0, c.amount_claimed_cents - c.amount_recovered_cents),
    0,
  );
  const recovered = all.reduce((sum, c) => sum + c.amount_recovered_cents, 0);
  const indemnities =
    open.filter((c) => c.case_type === "unpaid_invoice").length *
    FIXED_INDEMNITY_CENTS;
  const potential = atStake + indemnities;
  // Server component : lire l'horloge au moment de la requête est voulu.
  // eslint-disable-next-line react-hooks/purity
  const weekHorizon = Date.now() + 7 * 24 * 3600 * 1000;
  const weekActions = open.filter(
    (c) => c.next_action_at && new Date(c.next_action_at).getTime() < weekHorizon,
  );

  const agenda = open
    .filter((c) => c.next_action_at && c.next_action_label)
    .slice(0, 5);

  return (
    <div className="min-h-dvh bg-muted/40 text-foreground">
      <AppHeader orgName={org?.name} />

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {firstName ? `Bonjour ${firstName}.` : "Bonjour."}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {open.length === 0
                ? "Aucun blème en cours. Profitez-en, ou prenez de l’avance."
                : `${open.length} dossier${open.length > 1 ? "s" : ""} en cours, ${weekActions.length} action${weekActions.length > 1 ? "s" : ""} cette semaine.`}
            </p>
          </div>
          {hasSamples ? (
            <form action={deleteSampleCases}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground"
              >
                <Trash2 className="size-4" />
                Supprimer les dossiers d’exemple
              </button>
            </form>
          ) : null}
        </div>

        <DraftBanner />

        {/* Tuiles cash */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            label="En jeu"
            value={euros(atStake)}
            sub={`${open.length} dossier${open.length > 1 ? "s" : ""} en cours`}
          />
          <StatTile
            label="Récupéré"
            value={euros(recovered)}
            sub="depuis votre arrivée"
            accent
          />
          <StatTile
            label="Récupérable estimé"
            value={euros(potential)}
            sub={
              indemnities > 0
                ? `dont ${euros(indemnities)} d’indemnités légales`
                : "estimation indicative"
            }
          />
          <StatTile
            label="Cette semaine"
            value={String(weekActions.length)}
            sub={weekActions.length > 1 ? "actions à traiter" : "action à traiter"}
          />
        </section>

        {all.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-3">
            {/* Liste des dossiers */}
            <section className="lg:col-span-2">
              <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Vos dossiers
              </h2>
              <div className="mt-3 flex flex-col gap-3">
                {all.map((c) => (
                  <CaseCard key={c.id} c={c} />
                ))}
              </div>
            </section>

            {/* Agenda */}
            <aside>
              <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                À venir
              </h2>
              <div className="mt-3 rounded-[1.75rem] border bg-card p-2">
                {agenda.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">
                    Rien à l’horizon. Les prochaines actions apparaîtront ici.
                  </p>
                ) : (
                  agenda.map((c) => (
                    <Link
                      key={c.id}
                      href={`/app/dossiers/${c.id}`}
                      className="flex items-start gap-3 rounded-2xl px-4 py-3.5 transition-colors duration-300 hover:bg-muted"
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                        <CalendarClock className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {c.next_action_label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {relativeDays(c.next_action_at!)} · {c.debtor_name}
                        </span>
                      </span>
                    </Link>
                  ))
                )}
              </div>
              <p className="mt-3 px-1 text-xs leading-relaxed text-muted-foreground/80">
                Les montants « récupérable estimé » incluent l’indemnité
                forfaitaire légale de 40 € par facture impayée entre
                professionnels. Estimation indicative, pas un conseil juridique.
              </p>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "rounded-[1.75rem] bg-ink p-6 text-ink-foreground"
          : "rounded-[1.75rem] border bg-card p-6"
      }
    >
      <p
        className={
          accent
            ? "text-xs font-medium uppercase tracking-[0.14em] text-ink-muted"
            : "text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
        }
      >
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {value}
      </p>
      <p
        className={
          accent
            ? "mt-1 text-xs text-ink-muted"
            : "mt-1 text-xs text-muted-foreground"
        }
      >
        {sub}
      </p>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, tone: "muted" as const };
  const tones = {
    brand: "bg-brand-soft text-brand-strong",
    muted: "bg-muted text-muted-foreground",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[meta.tone]}`}
    >
      {meta.label}
    </span>
  );
}

function CaseCard({ c }: { c: CaseRow }) {
  const remaining = c.amount_claimed_cents - c.amount_recovered_cents;
  return (
    <Link
      href={`/app/dossiers/${c.id}`}
      className="group rounded-[1.75rem] border bg-card p-5 transition-all duration-500 ease-fluid hover:-translate-y-0.5 hover:shadow-lg hover:shadow-zinc-950/[0.05] sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={c.status} />
            <span className="text-xs text-muted-foreground">
              {CASE_TYPE_LABEL[c.case_type]}
              {c.is_sample ? " · exemple" : ""}
            </span>
          </div>
          <p className="mt-2 truncate font-semibold">{c.title}</p>
          {c.next_action_label && c.next_action_at ? (
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {c.next_action_label} · {relativeDays(c.next_action_at)}
            </p>
          ) : c.status === "resolved" ? (
            <p className="mt-1 text-sm text-emerald-700">
              {euros(c.amount_recovered_cents)} récupérés
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <p className="text-lg font-bold tracking-tight">
            {euros(c.status === "resolved" ? c.amount_recovered_cents : remaining)}
          </p>
          <div className="flex items-center gap-1" aria-label={`Étape ${c.stage} sur ${c.stage_total}`}>
            {Array.from({ length: c.stage_total }, (_, i) => (
              <span
                key={i}
                className={
                  i < c.stage
                    ? "h-1.5 w-5 rounded-full bg-brand"
                    : "h-1.5 w-5 rounded-full bg-muted"
                }
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end text-sm font-medium text-brand opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        Voir le dossier
        <ChevronRight className="size-4" />
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <section className="flex flex-col items-start gap-4 rounded-[1.75rem] border bg-card p-10">
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
        <FolderPlus className="size-6" />
      </span>
      <h2 className="text-xl font-semibold">Votre premier blème commence ici.</h2>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        Racontez votre impayé ou votre litige à voix haute : le dossier se
        monte, les relances se préparent, et cet écran se remplit de chiffres
        qui font plaisir.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Link
          href="/nouveau"
          className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
        >
          Raconter mon blème
        </Link>
        <form action={createSampleCases}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors duration-300 hover:bg-muted"
          >
            <Sparkles className="size-4 text-brand" />
            Voir avec des dossiers d’exemple
          </button>
        </form>
      </div>
    </section>
  );
}
