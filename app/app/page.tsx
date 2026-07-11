import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  FolderPlus,
  PiggyBank,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { euros, relativeDays } from "@/lib/format";
import { FIXED_INDEMNITY_CENTS } from "@/lib/cases/constants";
import { createSampleCases, deleteSampleCases } from "@/lib/cases/actions";
import { lastSendByCase } from "@/lib/cases/tracking-summary";
import { LETTER_KINDS } from "@/lib/cases/letter-meta";
import { DraftBanner } from "@/components/app/draft-banner";
import { ComptaPanel } from "@/components/app/compta-panel";
import { LetterTrackingCompact } from "@/components/app/letter-tracking";
import { CaseCard, OPEN_STATUSES, PageHeader, type CaseRow } from "@/components/app/ui";
import { CountUp } from "@/components/app/count-up";

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
  const nowMs = Date.now();
  const weekHorizon = nowMs + 7 * 24 * 3600 * 1000;
  const weekActions = open.filter(
    (c) => c.next_action_at && new Date(c.next_action_at).getTime() < weekHorizon,
  );
  const agenda = open
    .filter((c) => c.next_action_at && c.next_action_label)
    .slice(0, 5);
  const recents = all.slice(0, 3);

  // Salutation contextuelle + date du jour (heure de Paris).
  // parseInt : Intl renvoie « 18 h » (suffixe) — Number() donnerait NaN.
  const parisHour = parseInt(
    new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" }).format(new Date(nowMs)),
    10,
  );
  const greeting = parisHour >= 18 || parisHour < 5 ? "Bonsoir" : "Bonjour";
  const todayRaw = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(new Date(nowMs));
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={firstName ? `${greeting} ${firstName}.` : `${greeting}.`}
        sub={
          open.length === 0
            ? `${today} — aucun blème en cours. Profitez-en, ou prenez de l’avance.`
            : `${today} — ${open.length} dossier${open.length > 1 ? "s" : ""} en cours, ${weekActions.length} action${weekActions.length > 1 ? "s" : ""} cette semaine.`
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

      {/* La compta au centre du cockpit : vitrine de connexion, puis santé
          des factures + blème en un clic une fois Pennylane branché. */}
      <ComptaPanel />

      {/* La situation en quatre chiffres : ils se comptent à l'ouverture,
          les tuiles se révèlent en cascade. */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <DashStat
          icon={Wallet}
          label="En jeu"
          valueCents={atStake}
          sub={`${open.length} dossier${open.length > 1 ? "s" : ""} en cours`}
          delay={0}
        />
        <DashStat
          icon={PiggyBank}
          label="Récupéré"
          valueCents={recovered}
          sub="depuis votre arrivée"
          accent
          delay={80}
        />
        <DashStat
          icon={TrendingUp}
          label="Récupérable estimé"
          valueCents={atStake + indemnities}
          sub={
            indemnities > 0
              ? `dont ${euros(indemnities)} d’indemnités légales`
              : "estimation indicative"
          }
          delay={160}
        />
        <DashStat
          icon={CalendarClock}
          label="Cette semaine"
          valueCount={weekActions.length}
          sub={weekActions.length > 1 ? "actions à traiter" : "action à traiter"}
          pulse={weekActions.length > 0}
          delay={240}
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
              {recents.map((c, i) => (
                <div
                  key={c.id}
                  // flex : CaseCard est un <a> sans display propre — en enfant
                  // de bloc simple il retomberait en inline (carte cassée).
                  className="anim-load flex flex-col"
                  style={{ "--delay": `${320 + i * 90}ms` } as React.CSSProperties}
                >
                  <CaseCard c={c} lastSend={lastSends[c.id]} />
                </div>
              ))}
            </div>
          </section>

          <aside>
            <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              À venir
            </h2>
            {/* Mini-timeline : les prochaines actions reliées entre elles,
                les retards cerclés d'ambre. */}
            <div className="mt-3 rounded-[1.75rem] border bg-card p-3">
              {agenda.length === 0 ? (
                <p className="px-3 py-5 text-sm text-muted-foreground">
                  Rien à l’horizon. Les prochaines actions apparaîtront ici.
                </p>
              ) : (
                <ol className="flex flex-col">
                  {agenda.map((c, i) => {
                    const overdue = c.next_action_at
                      ? new Date(c.next_action_at).getTime() < nowMs
                      : false;
                    const last = i === agenda.length - 1;
                    return (
                      <li
                        key={c.id}
                        className="anim-load relative"
                        style={{ "--delay": `${380 + i * 80}ms` } as React.CSSProperties}
                      >
                        {/* Ligne de liaison CONTINUE : du bas de cette icône au
                            haut de la suivante (déborde sur le li suivant). */}
                        {!last ? (
                          <span
                            aria-hidden
                            className="absolute -bottom-2.5 left-6 top-[46px] w-px bg-border"
                          />
                        ) : null}
                        <Link
                          href={`/app/dossiers/${c.id}`}
                          className="relative flex gap-3 rounded-2xl px-2 py-1 transition-colors duration-300 hover:bg-muted"
                        >
                          <span
                            className={`relative mt-1.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                              overdue
                                ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300"
                                : "bg-brand-soft text-brand-strong"
                            }`}
                          >
                            <CalendarClock className="size-4" />
                          </span>
                          <span className="min-w-0 py-2.5">
                            <span className="block truncate text-sm font-medium">
                              {c.next_action_label}
                            </span>
                            <span
                              className={`block truncate text-xs ${
                                overdue ? "font-medium text-amber-700" : "text-muted-foreground"
                              }`}
                            >
                              {relativeDays(c.next_action_at!)} · {c.debtor_name}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
            {(recentSends ?? []).length > 0 ? (
              <div className="anim-load" style={{ "--delay": "520ms" } as React.CSSProperties}>
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
              </div>
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

/**
 * Tuile de chiffre du cockpit : icône, valeur qui se compte à l'ouverture,
 * révélation en cascade, halo brand sur la tuile accentuée (Récupéré).
 */
function DashStat({
  icon: Icon,
  label,
  valueCents,
  valueCount,
  sub,
  accent = false,
  pulse = false,
  delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  valueCents?: number;
  valueCount?: number;
  sub: string;
  accent?: boolean;
  pulse?: boolean;
  delay?: number;
}) {
  return (
    <div
      className={
        accent
          ? "anim-load relative overflow-hidden rounded-[1.75rem] bg-ink p-5 text-ink-foreground transition-all duration-500 ease-fluid hover:-translate-y-0.5 hover:shadow-xl hover:shadow-zinc-950/[0.15] sm:p-6"
          : "anim-load rounded-[1.75rem] border bg-card p-5 transition-all duration-500 ease-fluid hover:-translate-y-0.5 hover:shadow-lg hover:shadow-zinc-950/[0.05] sm:p-6"
      }
      style={{ "--delay": `${delay}ms` } as React.CSSProperties}
    >
      {accent ? (
        <div aria-hidden className="absolute -right-10 -top-16 size-44 rounded-full bg-brand/25 blur-[70px]" />
      ) : null}
      <div className="relative flex min-w-0 items-center gap-2.5">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
            accent ? "bg-white/10 text-brand ring-1 ring-white/15" : "bg-brand-soft text-brand-strong"
          }`}
        >
          <Icon className="size-4" />
        </span>
        <p
          className={`min-w-0 truncate text-[11px] font-medium uppercase tracking-[0.14em] ${
            accent ? "text-ink-muted" : "text-muted-foreground"
          }`}
        >
          {label}
        </p>
      </div>
      <p className="relative mt-3 flex items-baseline gap-2 text-xl font-bold tabular-nums tracking-tight sm:text-3xl">
        {valueCents != null ? (
          <CountUp value={valueCents} kind="euros" delayMs={delay + 150} />
        ) : (
          <CountUp value={valueCount ?? 0} kind="count" delayMs={delay + 150} />
        )}
        {pulse ? (
          <span className="inline-flex size-2 -translate-y-1 rounded-full bg-brand" aria-hidden />
        ) : null}
      </p>
      <p className={`relative mt-1 text-xs ${accent ? "text-ink-muted" : "text-muted-foreground"}`}>{sub}</p>
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
      <p className="mt-1 text-xs text-muted-foreground">
        Vos impayés sont dans votre compta ?{" "}
        <Link
          href="/app/parametres"
          className="font-medium text-brand-strong underline-offset-2 hover:underline"
        >
          Connectez Pennylane, Axonaut ou Sellsy
        </Link>{" "}
        — ils remonteront tout seuls, prêts à devenir des blèmes.
      </p>
    </section>
  );
}
