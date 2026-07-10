import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarClock, FolderPlus, Sparkles, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { euros, relativeDays } from "@/lib/format";
import { FIXED_INDEMNITY_CENTS } from "@/lib/cases/constants";
import { createSampleCases, deleteSampleCases } from "@/lib/cases/actions";
import { lastSendByCase } from "@/lib/cases/tracking-summary";
import { LETTER_KINDS } from "@/lib/cases/letter-meta";
import { DraftBanner } from "@/components/app/draft-banner";
import { LetterTrackingCompact } from "@/components/app/letter-tracking";
import {
  CaseCard,
  OPEN_STATUSES,
  PageHeader,
  StatTile,
  type CaseRow,
} from "@/components/app/ui";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function AppHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: cases }, { data: recentSends }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("cases")
      .select(
        "id, case_type, title, status, debtor_name, amount_claimed_cents, amount_recovered_cents, stage, stage_total, phase, next_action_label, next_action_at, expected_recovery_at, is_sample",
      )
      .neq("status", "closed")
      .order("next_action_at", { ascending: true, nullsFirst: false })
      .returns<CaseRow[]>(),
    // Vitrine du suivi : les 3 derniers envois réels, avec leur progression.
    supabase
      .from("letters")
      .select("id, case_id, kind, channel, sent_at, tracking_status, tracking_status_at")
      .eq("status", "sent")
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(3),
  ]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const all = cases ?? [];
  // Suivi du dernier envoi par dossier (indicateur sur les cartes récentes).
  const lastSends = await lastSendByCase(supabase, all.slice(0, 3).map((c) => c.id));
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
  // Server component : lire l'horloge au moment de la requête est voulu.
  // eslint-disable-next-line react-hooks/purity
  const weekHorizon = Date.now() + 7 * 24 * 3600 * 1000;
  const weekActions = open.filter(
    (c) => c.next_action_at && new Date(c.next_action_at).getTime() < weekHorizon,
  );
  const agenda = open
    .filter((c) => c.next_action_at && c.next_action_label)
    .slice(0, 5);
  const recents = all.slice(0, 3);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={firstName ? `Bonjour ${firstName}.` : "Bonjour."}
        sub={
          open.length === 0
            ? "Aucun blème en cours. Profitez-en, ou prenez de l’avance."
            : `${open.length} dossier${open.length > 1 ? "s" : ""} en cours, ${weekActions.length} action${weekActions.length > 1 ? "s" : ""} cette semaine.`
        }
      >
        {hasSamples ? (
          <form action={deleteSampleCases}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground"
            >
              <Trash2 className="size-4" />
              Supprimer les exemples
            </button>
          </form>
        ) : null}
      </PageHeader>

      <DraftBanner />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="En jeu"
          value={euros(atStake)}
          sub={`${open.length} dossier${open.length > 1 ? "s" : ""} en cours`}
        />
        <StatTile label="Récupéré" value={euros(recovered)} sub="depuis votre arrivée" accent />
        <StatTile
          label="Récupérable estimé"
          value={euros(atStake + indemnities)}
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
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="flex items-baseline justify-between gap-4 px-1">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Dossiers récents
              </h2>
              <Link
                href="/app/dossiers"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-strong transition-colors duration-300 hover:text-brand"
              >
                Tous les dossiers
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <div className="mt-3 flex flex-col gap-3">
              {recents.map((c) => (
                <CaseCard key={c.id} c={c} lastSend={lastSends[c.id]} />
              ))}
            </div>
          </section>

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
            {(recentSends ?? []).length > 0 ? (
              <>
                <h2 className="mt-6 px-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Envois suivis
                </h2>
                <div className="mt-3 rounded-[1.75rem] border bg-card p-2">
                  {(recentSends ?? []).map((l) => (
                    <Link
                      key={l.id}
                      href={`/app/dossiers/${l.case_id}/courrier/${l.id}`}
                      className="flex flex-col gap-1 rounded-2xl px-4 py-3.5 transition-colors duration-300 hover:bg-muted"
                    >
                      <span className="truncate text-sm font-medium">
                        {LETTER_KINDS[l.kind]?.label ?? "Courrier"}
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {l.channel === "postal" ? "recommandé" : "email"}
                        </span>
                      </span>
                      <LetterTrackingCompact
                        tracking={{
                          channel: l.channel,
                          sentAt: l.sent_at,
                          trackingStatus: l.tracking_status,
                          trackingStatusAt: l.tracking_status_at,
                        }}
                      />
                    </Link>
                  ))}
                  <Link
                    href="/app/envois"
                    className="flex items-center gap-1 rounded-2xl px-4 py-3 text-sm font-medium text-brand-strong transition-colors duration-300 hover:bg-muted"
                  >
                    Tout le suivi
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </>
            ) : null}
            <p className="mt-3 px-1 text-xs leading-relaxed text-muted-foreground/80">
              Le « récupérable estimé » inclut l’indemnité forfaitaire légale de
              40 € par facture impayée entre professionnels. Estimation
              indicative, pas un conseil juridique.
            </p>
          </aside>
        </div>
      )}
    </div>
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
