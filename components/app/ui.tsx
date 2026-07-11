import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";
import { euros, relativeDays } from "@/lib/format";
import { CASE_TYPE_LABEL, STATUS_META } from "@/lib/cases/constants";
import { LETTER_KINDS } from "@/lib/cases/letter-meta";
import { trackingProgress } from "@/lib/courrier/tracking";
import { PhaseTrail } from "@/components/app/phase-trail";
import { TrackingDots } from "@/components/app/letter-tracking";
import type { LastSend } from "@/lib/cases/tracking-summary";
import type { Phase } from "@/lib/cases/phases";

export type CaseRow = {
  id: string;
  case_type: string;
  title: string;
  status: string;
  debtor_name: string;
  amount_claimed_cents: number;
  amount_recovered_cents: number;
  stage: number;
  stage_total: number;
  phase: number;
  next_action_label: string | null;
  next_action_at: string | null;
  expected_recovery_at: string | null;
  is_sample: boolean;
};

export const OPEN_STATUSES = [
  "active",
  "awaiting_user",
  "awaiting_debtor",
  "escalated",
];

export function PageHeader({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {sub ? (
          <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, tone: "muted" as const };
  const tones: Record<string, string> = {
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

export function StageDots({
  stage,
  total,
  size = "sm",
}: {
  stage: number;
  total: number;
  size?: "sm" | "md";
}) {
  const cls = size === "md" ? "h-2 w-8" : "h-1.5 w-5";
  return (
    <div className="flex items-center gap-1" aria-label={`Étape ${stage} sur ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={
            i < stage ? `${cls} rounded-full bg-brand` : `${cls} rounded-full bg-muted`
          }
        />
      ))}
    </div>
  );
}

export function StatTile({
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
        className={`text-xs font-medium uppercase tracking-[0.14em] ${accent ? "text-ink-muted" : "text-muted-foreground"}`}
      >
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
      <p className={`mt-1 text-xs ${accent ? "text-ink-muted" : "text-muted-foreground"}`}>
        {sub}
      </p>
    </div>
  );
}

// Teinte de l'avatar débiteur, alignée sur le ton du statut.
const AVATAR_TONES: Record<string, string> = {
  brand: "bg-brand-soft text-brand-strong ring-brand/15",
  muted: "bg-muted text-muted-foreground ring-border",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
};

export function CaseCard({ c, lastSend }: { c: CaseRow; lastSend?: LastSend | null }) {
  const claimed = c.amount_claimed_cents;
  const recovered = c.amount_recovered_cents;
  const remaining = Math.max(0, claimed - recovered);
  const resolved = c.status === "resolved";
  const pct = claimed > 0 ? Math.min(100, Math.round((recovered / claimed) * 100)) : 0;
  // eslint-disable-next-line react-hooks/purity -- urgence d'affichage (retard)
  const overdue = !resolved && !!c.next_action_at && new Date(c.next_action_at).getTime() < Date.now();
  const tone = AVATAR_TONES[STATUS_META[c.status]?.tone ?? "muted"] ?? AVATAR_TONES.muted;
  const initials =
    (c.debtor_name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";
  // Suivi du dernier envoi, visible sans ouvrir le dossier : « Mise en
  // demeure · En acheminement par La Poste », pastilles de progression.
  const send = lastSend?.sent_at ? lastSend : null;
  const sendProgress = send
    ? trackingProgress({
        channel: send.channel,
        sentAt: send.sent_at,
        trackingStatus: send.tracking_status,
      })
    : null;
  return (
    <Link
      href={`/app/dossiers/${c.id}`}
      className="group rounded-[1.75rem] border bg-card p-4 transition-all duration-500 ease-fluid hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg hover:shadow-brand/[0.06] sm:p-5"
    >
      {/* En-tête : qui / quoi à gauche, l'argent à droite. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ring-1 ${tone}`}
            aria-hidden
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-snug">{c.title}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {CASE_TYPE_LABEL[c.case_type]} · {c.debtor_name}
              {c.is_sample ? " · exemple" : ""}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`text-[15px] font-bold tabular-nums tracking-tight ${resolved ? "text-emerald-700" : ""}`}
          >
            {euros(resolved ? recovered : remaining)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {resolved ? "récupérés" : "restant dû"}
          </p>
        </div>
      </div>

      {/* Recouvrement : barre fine, visible dès le premier euro encaissé. */}
      {claimed > 0 && recovered > 0 ? (
        <div className="mt-3 flex items-center gap-2.5">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ease-fluid ${resolved ? "bg-emerald-500" : "bg-brand"}`}
              style={{ width: `${Math.max(pct, 5)}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
            {pct} % récupéré
          </span>
        </div>
      ) : null}

      {/* Pied : statut, prochaine action (retard en ambre), acheminement, phase. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <StatusChip status={c.status} />
          {c.next_action_label && c.next_action_at ? (
            <span
              className={`inline-flex min-w-0 items-center gap-1.5 text-xs ${
                overdue ? "font-medium text-amber-700" : "text-muted-foreground"
              }`}
            >
              <CalendarClock className="size-3.5 shrink-0" />
              <span className="truncate">
                {c.next_action_label} · {relativeDays(c.next_action_at)}
              </span>
            </span>
          ) : null}
          {send && sendProgress ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <TrackingDots
                tracking={{
                  channel: send.channel,
                  sentAt: send.sent_at,
                  trackingStatus: send.tracking_status,
                }}
                className="shrink-0"
              />
              <span
                className={`truncate text-xs ${sendProgress.alert ? "font-medium text-amber-700" : "text-muted-foreground"}`}
              >
                {LETTER_KINDS[send.kind]?.label ?? "Courrier"} · {sendProgress.label}
              </span>
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PhaseTrail variant="compact" phase={(c.phase ?? 1) as Phase} />
          <ChevronRight className="size-4 text-muted-foreground/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-brand" />
        </div>
      </div>
    </Link>
  );
}

export function ComingSoonCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[1.75rem] border bg-card p-8">
      <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
        {icon}
      </span>
      <div className="flex items-center gap-2.5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-medium text-brand-foreground">
          Bientôt
        </span>
      </div>
      <div className="max-w-lg text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}
