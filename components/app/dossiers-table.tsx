"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CalendarClock, ChevronsUpDown, FolderPlus, Search } from "lucide-react";
import { euros, relativeDays } from "@/lib/format";
import { CASE_TYPE_LABEL, STATUS_META } from "@/lib/cases/constants";
import { LETTER_KINDS } from "@/lib/cases/letter-meta";
import { trackingProgress } from "@/lib/courrier/tracking";

export type DossierRow = {
  id: string;
  case_type: string;
  title: string;
  status: string;
  debtor_name: string;
  amount_claimed_cents: number;
  amount_recovered_cents: number;
  next_action_label: string | null;
  next_action_at: string | null;
  is_sample: boolean;
};

export type SendInfo = { kind: string; channel: string | null; sent_at: string | null; tracking_status: string | null };

const OPEN = ["active", "awaiting_user", "awaiting_debtor", "escalated"];
const RESOLVED = ["resolved", "closed"];

const TONES: Record<string, string> = {
  brand: "bg-brand-soft text-brand-strong",
  muted: "bg-muted text-muted-foreground",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
};

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function StatusChip({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, tone: "muted" as const };
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONES[m.tone]}`}>{m.label}</span>;
}

type TabKey = "tous" | "en-cours" | "en-retard" | "resolus";
type SortKey = "debtor" | "action" | "claimed" | "remaining";
type TypeKey = "all" | "unpaid_invoice" | "client_dispute" | "admin_request";

const TABS: { key: TabKey; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "en-cours", label: "En cours" },
  { key: "en-retard", label: "En retard" },
  { key: "resolus", label: "Résolus" },
];

const TYPES: { key: TypeKey; label: string }[] = [
  { key: "all", label: "Tous les types" },
  { key: "unpaid_invoice", label: "Impayés" },
  { key: "client_dispute", label: "Litiges" },
  { key: "admin_request", label: "Démarches" },
];

export function DossiersTable({ rows, sends }: { rows: DossierRow[]; sends: Record<string, SendInfo> }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("tous");
  const [typeFilter, setTypeFilter] = useState<TypeKey>("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  // eslint-disable-next-line react-hooks/purity -- comparaison d'échéance à l'affichage
  const nowMs = Date.now();

  const remainingOf = (r: DossierRow) => Math.max(0, r.amount_claimed_cents - r.amount_recovered_cents);
  const isOverdue = (r: DossierRow) =>
    OPEN.includes(r.status) && !!r.next_action_at && new Date(r.next_action_at).getTime() < nowMs;

  const kpis = useMemo(() => {
    let restant = 0;
    let recupere = 0;
    let enCours = 0;
    for (const r of rows) {
      recupere += r.amount_recovered_cents;
      if (OPEN.includes(r.status)) {
        enCours += 1;
        restant += remainingOf(r);
      }
    }
    return { restant, recupere, enCours };
  }, [rows]);

  const typed = useMemo(() => (typeFilter === "all" ? rows : rows.filter((r) => r.case_type === typeFilter)), [rows, typeFilter]);

  const counts = useMemo(() => {
    const c = { tous: typed.length, "en-cours": 0, "en-retard": 0, resolus: 0 };
    for (const r of typed) {
      if (OPEN.includes(r.status)) c["en-cours"] += 1;
      if (isOverdue(r)) c["en-retard"] += 1;
      if (RESOLVED.includes(r.status)) c.resolus += 1;
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, nowMs]);

  const inTab = (r: DossierRow) => {
    if (tab === "en-cours") return OPEN.includes(r.status);
    if (tab === "en-retard") return isOverdue(r);
    if (tab === "resolus") return RESOLVED.includes(r.status);
    return true;
  };

  const q = norm(query.trim());
  const visible = useMemo(() => {
    let list = typed.filter(inTab);
    if (q) list = list.filter((r) => [r.debtor_name, r.title, CASE_TYPE_LABEL[r.case_type] ?? ""].some((v) => norm(v).includes(q)));
    if (sortKey) {
      const dir = sortAsc ? 1 : -1;
      list = [...list].sort((a, b) => {
        let d = 0;
        if (sortKey === "debtor") d = a.debtor_name.localeCompare(b.debtor_name, "fr");
        else if (sortKey === "claimed") d = a.amount_claimed_cents - b.amount_claimed_cents;
        else if (sortKey === "remaining") d = remainingOf(a) - remainingOf(b);
        else {
          const ta = a.next_action_at ? new Date(a.next_action_at).getTime() : Infinity;
          const tb = b.next_action_at ? new Date(b.next_action_at).getTime() : Infinity;
          d = ta === tb ? 0 : ta < tb ? -1 : 1; // jamais Infinity - Infinity
        }
        return d * dir;
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, tab, q, sortKey, sortAsc, nowMs]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "debtor" || key === "action");
    }
  };

  const sendCell = (id: string) => {
    const s = sends[id];
    if (!s?.sent_at) return null;
    const p = trackingProgress({ channel: s.channel, sentAt: s.sent_at, trackingStatus: s.tracking_status });
    return { kindLabel: LETTER_KINDS[s.kind]?.label ?? "Courrier", label: p.label, alert: p.alert };
  };

  // Payé → récupéré (vert) ; clos → restant (atténué, terminé) ; ouvert → restant (mis en avant).
  const amountView = (r: DossierRow) => {
    if (r.status === "resolved") return { text: euros(r.amount_recovered_cents), cls: "font-semibold text-emerald-700" };
    if (r.status === "closed") return { text: euros(remainingOf(r)), cls: "text-muted-foreground" };
    return { text: euros(remainingOf(r)), cls: "font-semibold text-foreground" };
  };

  const filtered = q !== "" || tab !== "tous" || typeFilter !== "all";

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border bg-card p-10">
        <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
          <FolderPlus className="size-5" />
        </span>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Aucun dossier pour l’instant. Racontez votre premier blème, il apparaîtra ici.
        </p>
        <Link href="/nouveau" className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-strong">
          Raconter mon blème
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* KPIs : 3 colonnes égales sur mobile, compacts alignés à gauche dès sm. */}
      <div className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-lg border bg-card sm:flex sm:w-max sm:max-w-full">
        <Kpi label="Restant dû" value={euros(kpis.restant)} tint="text-foreground" />
        <Kpi label="Récupéré" value={euros(kpis.recupere)} tint="text-emerald-700" />
        <Kpi label="En cours" value={String(kpis.enCours)} tint="text-foreground" />
      </div>

      {/* Recherche + filtre par type */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-0 flex-1 items-center sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un dossier…"
            className="w-full rounded-lg border bg-card py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand"
          />
        </label>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeKey)}
          className="rounded-lg border bg-card px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand"
        >
          {TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Onglets à compteurs */}
      <div className="flex flex-wrap items-center gap-1 border-b">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm transition-colors ${
                active ? "border-brand font-semibold text-foreground" : "border-transparent font-medium text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${active ? "bg-brand-soft text-brand-strong" : "bg-muted text-muted-foreground"}`}>
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tableau (desktop) + liste (mobile) */}
      <div className="overflow-hidden rounded-lg border bg-card">
        {/* table-fixed + largeurs de colonnes = les montants restent TOUJOURS visibles
            (troncature du texte long plutôt que débordement) ; scroll horizontal seulement
            en dernier recours sous ~920px. */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[920px] table-fixed text-sm">
            <colgroup>
              <col style={{ width: "128px" }} />
              <col />
              <col style={{ width: "236px" }} />
              <col style={{ width: "184px" }} />
              <col style={{ width: "104px" }} />
              <col style={{ width: "120px" }} />
            </colgroup>
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Statut</th>
                <Th label="Débiteur" sortKey="debtor" active={sortKey} asc={sortAsc} onSort={toggleSort} />
                <Th label="Prochaine action" sortKey="action" active={sortKey} asc={sortAsc} onSort={toggleSort} />
                <th className="px-4 py-3 font-medium">Dernier envoi</th>
                <Th label="Réclamé" sortKey="claimed" active={sortKey} asc={sortAsc} onSort={toggleSort} align="right" />
                <Th label="Restant dû" sortKey="remaining" active={sortKey} asc={sortAsc} onSort={toggleSort} align="right" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((r) => {
                const send = sendCell(r.id);
                const overdue = isOverdue(r);
                const amount = amountView(r);
                return (
                  <tr key={r.id} onClick={() => router.push(`/app/dossiers/${r.id}`)} className="cursor-pointer transition-colors hover:bg-muted/40">
                    <td className="px-4 py-2.5 align-middle">
                      <StatusChip status={r.status} />
                    </td>
                    <td className="px-4 py-2.5 align-middle">
                      <Link
                        href={`/app/dossiers/${r.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate font-medium leading-tight text-foreground hover:text-brand-strong"
                      >
                        {r.debtor_name}
                      </Link>
                      <p className="truncate text-xs leading-tight text-muted-foreground">
                        {CASE_TYPE_LABEL[r.case_type] ?? r.case_type}
                        {r.is_sample ? " · exemple" : ""}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 align-middle text-xs">
                      {r.next_action_label && r.next_action_at ? (
                        <span className={`flex items-center gap-1.5 ${overdue ? "font-medium text-amber-700" : "text-muted-foreground"}`}>
                          <CalendarClock className="size-3.5 shrink-0" />
                          <span className="truncate">{r.next_action_label}</span>
                          <span className="shrink-0">· {relativeDays(r.next_action_at)}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 align-middle text-xs">
                      {send ? (
                        <span className={`flex items-center gap-1.5 ${send.alert ? "font-medium text-amber-700" : "text-muted-foreground"}`}>
                          <span className={`size-1.5 shrink-0 rounded-full ${send.alert ? "bg-amber-500" : "bg-emerald-500"}`} />
                          <span className="truncate">
                            {send.kindLabel} · {send.label}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right align-middle tabular-nums text-muted-foreground">{euros(r.amount_claimed_cents)}</td>
                    <td className="px-4 py-2.5 text-right align-middle">
                      <span className={`tabular-nums ${amount.cls}`}>{amount.text}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Liste (mobile) — parité d'info avec le tableau */}
        <ul className="divide-y md:hidden">
          {visible.map((r) => {
            const send = sendCell(r.id);
            const overdue = isOverdue(r);
            const amount = amountView(r);
            return (
              <li key={r.id}>
                <Link href={`/app/dossiers/${r.id}`} className="block px-4 py-3 transition-colors hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate font-medium leading-tight">{r.debtor_name}</p>
                    <span className={`shrink-0 tabular-nums ${amount.cls}`}>{amount.text}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <StatusChip status={r.status} />
                    <span className="text-xs text-muted-foreground">
                      {CASE_TYPE_LABEL[r.case_type] ?? r.case_type}
                      {r.is_sample ? " · exemple" : ""}
                    </span>
                  </div>
                  {r.next_action_label && r.next_action_at ? (
                    <p className={`mt-1 flex items-center gap-1.5 text-xs ${overdue ? "font-medium text-amber-700" : "text-muted-foreground"}`}>
                      <CalendarClock className="size-3.5 shrink-0" />
                      <span className="min-w-0 truncate">{r.next_action_label}</span>
                      <span className="shrink-0">· {relativeDays(r.next_action_at)}</span>
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
              </li>
            );
          })}
        </ul>

        {visible.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">Aucun dossier ne correspond.</p> : null}
      </div>

      {filtered ? (
        <p className="px-1 text-xs text-muted-foreground">
          {visible.length} sur {rows.length} dossier{rows.length > 1 ? "s" : ""}
        </p>
      ) : null}
    </div>
  );
}

function Kpi({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="px-5 py-2.5">
      <p className="whitespace-nowrap text-[11px] text-muted-foreground">{label}</p>
      <p className={`mt-0.5 whitespace-nowrap text-lg font-semibold tabular-nums tracking-tight ${tint}`}>{value}</p>
    </div>
  );
}

function Th({
  label,
  sortKey,
  active,
  asc,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey | null;
  asc: boolean;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const on = active === sortKey;
  return (
    <th className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${align === "right" ? "flex-row-reverse" : ""} ${on ? "text-foreground" : ""}`}
      >
        {label}
        {on ? asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-40" />}
      </button>
    </th>
  );
}
