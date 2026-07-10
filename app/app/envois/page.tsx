import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import { ArrowRight, CalendarClock, CalendarDays, PackageSearch } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/ui";
import { DemoTrail, EnvoiCard, FreshnessDot, type EnvoiRow } from "@/components/app/envoi-card";
import { DetectedInvoices, type DetectedInvoice } from "@/components/app/detected-invoices";
import { RelanceCalendar, type CalEvent } from "@/components/app/relance-calendar";
import { LETTER_KINDS } from "@/lib/cases/letter-meta";
import { ALERT_STAGES, DONE_STAGES } from "@/lib/courrier/tracking";
import { relativeDays } from "@/lib/format";

export const metadata: Metadata = { title: "Suivi" };

/*
 * L'onglet « Suivi » : la tour de contrôle des démarches. En haut, les
 * prochaines étapes des dossiers (ex-Agenda, format liste) ; en dessous, TOUS
 * les courriers réellement partis avec leur progression type « suivi colis »
 * (webhooks Merci Facteur / Resend). La vue calendrier mensuelle reste
 * disponible (?vue=agenda) — l'ancienne route /app/calendrier y redirige.
 */

const FILTRES = [
  { key: "tous", label: "Tous" },
  { key: "en-cours", label: "En cours" },
  { key: "aboutis", label: "Aboutis" },
  { key: "a-verifier", label: "À vérifier" },
] as const;

type UpcomingCase = {
  id: string;
  title: string;
  status: string;
  next_action_at: string | null;
  next_action_label: string | null;
  next_letter_kind: string | null;
  expected_recovery_at: string | null;
};

function bucket(l: EnvoiRow): "en-cours" | "aboutis" | "a-verifier" {
  if (ALERT_STAGES.has(l.tracking_status ?? "")) return "a-verifier";
  if (DONE_STAGES.has(l.tracking_status ?? "")) return "aboutis";
  return "en-cours";
}

const OPEN = (s: string) => s !== "resolved" && s !== "closed";

export default async function SuiviPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string; vue?: string; creation?: string }>;
}) {
  const { filtre = "tous", vue, creation } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ── Vue calendrier (ex-Agenda) : grille mensuelle complète ────────────────
  if (vue === "agenda") {
    const [{ data: cases }, { data: letters }, { data: replies }] = await Promise.all([
      supabase
        .from("cases")
        .select(
          "id, title, status, next_action_at, next_action_label, next_letter_kind, expected_recovery_at",
        )
        .eq("is_sample", false),
      supabase.from("letters").select("case_id, kind, sent_at").not("sent_at", "is", null),
      supabase.from("debtor_replies").select("case_id, received_at"),
    ]);
    const titleById = new Map((cases ?? []).map((c) => [c.id, c.title]));
    const events: CalEvent[] = [];
    for (const c of (cases ?? []) as UpcomingCase[]) {
      if (c.next_action_at && OPEN(c.status)) {
        events.push({
          date: c.next_action_at,
          type: "relance",
          caseId: c.id,
          title: c.title,
          label:
            c.next_action_label ||
            (c.next_letter_kind
              ? `Relance : ${LETTER_KINDS[c.next_letter_kind]?.label ?? c.next_letter_kind}`
              : "Prochaine action"),
          agent: "sacha",
        });
      }
      if (c.expected_recovery_at && OPEN(c.status)) {
        events.push({
          date: c.expected_recovery_at,
          type: "recovery",
          caseId: c.id,
          title: c.title,
          label: "Échéance de récupération estimée",
          agent: null,
        });
      }
    }
    for (const l of letters ?? []) {
      events.push({
        date: l.sent_at,
        type: "sent",
        caseId: l.case_id,
        title: titleById.get(l.case_id) ?? "Dossier",
        label: `Envoyé : ${LETTER_KINDS[l.kind]?.label ?? l.kind}`,
        agent: "marius",
      });
    }
    for (const r of replies ?? []) {
      events.push({
        date: r.received_at,
        type: "reply",
        caseId: r.case_id,
        title: titleById.get(r.case_id) ?? "Dossier",
        label: "Retour du client",
        agent: null,
      });
    }
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Suivi — vue calendrier"
          sub="Toutes les échéances de vos dossiers sur le mois. Vos agents les tiennent à jour."
        >
          <Link
            href="/app/envois"
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground"
          >
            <ArrowRight className="size-3.5 rotate-180" />
            Retour au suivi
          </Link>
        </PageHeader>
        <RelanceCalendar events={events} />
      </div>
    );
  }

  // ── Vue suivi (par défaut) : impayés détectés + prochaines étapes + envois ──
  const [{ data }, { data: upcomingCases }, detectedRes] = await Promise.all([
    supabase
      .from("letters")
      .select(
        "id, case_id, kind, channel, subject, sent_at, tracking_status, tracking_status_at, cases(title)",
      )
      .eq("status", "sent")
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(200)
      .returns<EnvoiRow[]>(),
    supabase
      .from("cases")
      .select("id, title, status, next_action_at, next_action_label, next_letter_kind, expected_recovery_at")
      .eq("is_sample", false)
      .not("next_action_at", "is", null)
      .order("next_action_at", { ascending: true })
      .limit(8)
      .returns<UpcomingCase[]>(),
    // Factures impayées importées de la compta (Pennylane), sans dossier :
    // chacune prête à devenir un blème en un clic.
    supabase
      .from("accounting_invoices")
      .select("id, invoice_number, label, customer_name, amount_cents, remaining_cents, deadline_on, status", {
        count: "exact",
      })
      .eq("paid", false)
      .is("case_id", null)
      .in("status", ["late", "partially_paid"])
      .order("deadline_on", { ascending: true, nullsFirst: false })
      .limit(24)
      .returns<DetectedInvoice[]>(),
  ]);
  const detectedInvoices = detectedRes.data;
  const detectedTotal = detectedRes.count ?? undefined;
  // Connexion compta : pilote la carte d'activation (invisible si connectée).
  const { data: comptaIntegration } = await supabase
    .from("org_integrations")
    .select("id")
    .eq("provider", "pennylane")
    .maybeSingle();

  const all = data ?? [];
  const counts = { tous: all.length, "en-cours": 0, aboutis: 0, "a-verifier": 0 };
  for (const l of all) counts[bucket(l)] += 1;
  const filtered = filtre === "tous" ? all : all.filter((l) => bucket(l) === filtre);

  const upcoming = (upcomingCases ?? []).filter((c) => OPEN(c.status) && c.next_action_label);
  // Server component : comparer à l'horloge de la requête est voulu (retards).
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Suivi"
        sub="Vos envois suivis en temps réel — de l’impression à l’accusé de réception — et les prochaines étapes de vos dossiers."
      >
        <Link
          href="/app/envois?vue=agenda"
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground"
        >
          <CalendarDays className="size-4" />
          Vue calendrier
        </Link>
      </PageHeader>

      {creation === "echec" ? (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800 ring-1 ring-amber-200">
          <PackageSearch className="mt-0.5 size-4 shrink-0" />
          La création du dossier n’a pas abouti — la facture a peut-être été retirée de votre
          compta entre-temps. Réessayez, ou créez le dossier depuis « Nouveau blème ».
        </p>
      ) : null}

      {/* Impayés détectés dans la compta connectée : un blème en un clic. */}
      <DetectedInvoices invoices={detectedInvoices ?? []} totalCount={detectedTotal} />

      {/* Compta non connectée : la porte d'entrée vers l'intégration. */}
      {!comptaIntegration ? (
        <Link
          href="/app/parametres"
          className="anim-load flex items-center gap-3 rounded-2xl border border-dashed bg-card/60 p-4 outline-none transition-all duration-500 ease-fluid hover:border-brand/50 hover:bg-brand-soft/30 focus-visible:border-brand/50 focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <span className="flex h-10 shrink-0 items-center justify-center rounded-xl bg-white px-2.5 shadow-sm ring-1 ring-black/5">
            <Image src="/logos/pennylane.svg" alt="Pennylane" width={81} height={16} className="h-4 w-auto" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Connectez votre compta</span>
            <span className="block truncate text-xs text-muted-foreground">
              Vos factures impayées apparaissent ici, prêtes à devenir des blèmes en un clic —
              et vous êtes prévenu quand une facture est réglée.
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : null}

      {/* Prochaines étapes (ex-Agenda) : ce que l'utilisateur a à faire ou à
          attendre, en tête — les retards ressortent en ambre. */}
      {upcoming.length > 0 ? (
        <section>
          <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Prochaines étapes
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.slice(0, 6).map((c, i) => {
              const overdue = c.next_action_at ? new Date(c.next_action_at).getTime() < now : false;
              return (
                <Link
                  key={c.id}
                  href={`/app/dossiers/${c.id}`}
                  className={`anim-load flex items-start gap-3 rounded-2xl border bg-card p-4 outline-none transition-all duration-500 ease-fluid hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-lg hover:shadow-zinc-950/[0.05] focus-visible:border-brand/50 focus-visible:ring-2 focus-visible:ring-brand/40 ${
                    overdue ? "ring-1 ring-amber-200" : ""
                  }`}
                  style={{ "--delay": `${i * 70}ms` } as React.CSSProperties}
                >
                  <span
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                      overdue ? "bg-amber-100 text-amber-700" : "bg-brand-soft text-brand-strong"
                    }`}
                  >
                    <CalendarClock className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.next_action_label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{c.title}</span>
                    <span
                      className={`mt-0.5 flex items-center gap-1.5 text-xs ${overdue ? "font-medium text-amber-700" : "text-muted-foreground"}`}
                    >
                      {overdue ? <FreshnessDot tone="amber" fresh /> : null}
                      {relativeDays(c.next_action_at!)}
                      {overdue ? " · en attente" : ""}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Vos envois
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {FILTRES.map((f) => {
              const active = f.key === filtre;
              const n = counts[f.key];
              return (
                <Link
                  key={f.key}
                  href={f.key === "tous" ? "/app/envois" : `/app/envois?filtre=${f.key}`}
                  className={
                    active
                      ? "rounded-full bg-brand px-3.5 py-1.5 text-xs font-medium text-brand-foreground"
                      : "rounded-full border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground"
                  }
                >
                  {f.label}
                  {n > 0 ? <span className="ml-1 opacity-70">{n}</span> : null}
                </Link>
              );
            })}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-3 flex flex-col items-start gap-5 rounded-[1.75rem] border bg-card p-6 sm:p-10">
            <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
              <PackageSearch className="size-5" />
            </span>
            {all.length === 0 ? <DemoTrail /> : null}
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              {all.length === 0
                ? "Dès qu’un courrier part, il apparaît ici avec son suivi en temps réel : imprimé, remis à La Poste, distribué, accusé de réception signé — et pour les emails : délivré, ouvert, réponse reçue. Vous êtes prévenu à chaque étape (cloche et email)."
                : "Aucun envoi ne correspond à ce filtre."}
            </p>
            {all.length === 0 ? (
              <Link
                href="/app/dossiers"
                className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong"
              >
                Voir mes dossiers
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2.5">
            {filtered.map((l, i) => (
              <EnvoiCard key={l.id} envoi={l} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
