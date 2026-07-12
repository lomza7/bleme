import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { euros, relativeDays } from "@/lib/format";
import { CASE_TYPE_LABEL } from "@/lib/cases/constants";
import { LETTER_KINDS } from "@/lib/cases/letter-meta";
import { trackingProgress } from "@/lib/courrier/tracking";
import { StatusChip, type CaseRow } from "@/components/app/ui";
import type { LastSend } from "@/lib/cases/tracking-summary";

/*
 * Liste unifiée du tableau de bord : les dossiers en cours triés par urgence,
 * avec sur chaque ligne le statut, le débiteur, le RESTANT dû et la prochaine
 * action (l'ancien bloc « À venir »). Remplace les cartes + la timeline par une
 * seule liste dense, cohérente avec la page Mes dossiers.
 */
export function DashDossierList({
  cases,
  lastSends,
  nowMs,
}: {
  cases: CaseRow[];
  lastSends: Record<string, LastSend>;
  nowMs: number;
}) {
  return (
    <div className="divide-y overflow-hidden rounded-lg border bg-card">
      {cases.map((c) => {
        const remaining = Math.max(0, c.amount_claimed_cents - c.amount_recovered_cents);
        const resolved = c.status === "resolved";
        const overdue = !resolved && !!c.next_action_at && new Date(c.next_action_at).getTime() < nowMs;
        const s = lastSends[c.id]?.sent_at ? lastSends[c.id] : null;
        const send = s ? { kindLabel: LETTER_KINDS[s.kind]?.label ?? "Courrier", ...trackingProgress({ channel: s.channel, sentAt: s.sent_at, trackingStatus: s.tracking_status }) } : null;
        return (
          <Link key={c.id} href={`/app/dossiers/${c.id}`} className="block px-4 py-3 transition-colors hover:bg-muted/40">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <StatusChip status={c.status} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium leading-tight">{c.debtor_name}</span>
                  <span className="block truncate text-xs leading-tight text-muted-foreground">
                    {CASE_TYPE_LABEL[c.case_type] ?? c.case_type}
                    {c.is_sample ? " · exemple" : ""}
                  </span>
                </span>
              </div>
              <div className="shrink-0 text-right">
                <span className={`block text-sm font-semibold tabular-nums ${resolved ? "text-emerald-700" : ""}`}>
                  {euros(resolved ? c.amount_recovered_cents : remaining)}
                </span>
                <span className="block text-[11px] text-muted-foreground">{resolved ? "récupéré" : "restant dû"}</span>
              </div>
            </div>

            {c.next_action_label && c.next_action_at ? (
              <p className={`mt-2 flex items-center gap-1.5 text-xs ${overdue ? "font-medium text-amber-700" : "text-muted-foreground"}`}>
                <CalendarClock className="size-3.5 shrink-0" />
                <span className="min-w-0 truncate">{c.next_action_label}</span>
                <span className="shrink-0">· {relativeDays(c.next_action_at)}</span>
              </p>
            ) : null}

            {send ? (
              <p className={`mt-1 flex items-center gap-1.5 text-xs ${send.alert ? "font-medium text-amber-700" : "text-muted-foreground"}`}>
                <span className={`size-1.5 shrink-0 rounded-full ${send.alert ? "bg-amber-500" : "bg-emerald-500"}`} />
                <span className="truncate">
                  {send.kindLabel} · {send.label}
                </span>
              </p>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
