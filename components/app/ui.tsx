import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { euros, relativeDays } from "@/lib/format";
import { CASE_TYPE_LABEL, STATUS_META } from "@/lib/cases/constants";
import { PhaseTrail } from "@/components/app/phase-trail";
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

export function CaseCard({ c }: { c: CaseRow }) {
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
          <PhaseTrail variant="compact" phase={(c.phase ?? 1) as Phase} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end text-sm font-medium text-brand opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        Voir le dossier
        <ChevronRight className="size-4" />
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
