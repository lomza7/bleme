"use client";

import { useMemo, useState } from "react";
import { CircleAlert, Download, FileSpreadsheet, LoaderCircle } from "lucide-react";
import { euros } from "@/lib/format";

/*
 * Îlots client de la page Exporter. DownloadButton récupère la route en fetch
 * (et non un simple <a download>) pour afficher un VRAI état de génération : les
 * ZIP (synthèse PDF + pièces du Storage) prennent plusieurs secondes, et une
 * erreur de droit (403) doit se voir. Registre non-juridique.
 */

function filenameFromDisposition(cd: string | null): string | null {
  if (!cd) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (star) return decodeURIComponent(star[1].trim());
  const plain = /filename="?([^"]+)"?/i.exec(cd);
  return plain ? plain[1].trim() : null;
}

type Tone = "primary" | "ink" | "ghost";

const TONES: Record<Tone, string> = {
  primary:
    "bg-brand text-brand-foreground hover:bg-brand-strong",
  ink: "bg-ink text-ink-foreground hover:bg-ink-soft",
  ghost:
    "border bg-card text-foreground hover:bg-muted",
};

export function DownloadButton({
  url,
  fallbackName,
  label,
  tone = "primary",
  size = "md",
  icon,
}: {
  url: string;
  fallbackName: string;
  label: string;
  tone?: Tone;
  size?: "md" | "sm";
  icon?: React.ReactNode;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const run = async () => {
    setStatus("loading");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status === 403 ? "forbidden" : "failed");
      const blob = await res.blob();
      const name = filenameFromDisposition(res.headers.get("Content-Disposition")) || fallbackName;
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  const pad = size === "sm" ? "px-4 py-2 text-[13px]" : "px-5 py-2.5 text-sm";
  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={status === "loading"}
        aria-busy={status === "loading"}
        className={`inline-flex items-center gap-2 rounded-full font-medium transition-all duration-500 ease-fluid active:scale-[0.98] disabled:opacity-70 ${pad} ${TONES[tone]}`}
      >
        {status === "loading" ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          icon ?? <Download className="size-4" />
        )}
        {status === "loading" ? "Préparation…" : label}
      </button>
      {status === "error" ? (
        <span role="alert" className="flex items-center gap-1.5 text-xs text-red-600">
          <CircleAlert className="size-3.5" />
          Échec de l’export. Vérifiez vos droits, puis réessayez.
        </span>
      ) : null}
    </div>
  );
}

// ── Export comptable : période + totaux vivants + téléchargement CSV ─────────
export type ComptaRow = {
  title: string;
  debtor: string;
  claimed: number;
  recovered: number;
  indemnity: number;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
};

const PERIODS = [
  { key: "mois", label: "Ce mois" },
  { key: "annee", label: "12 mois" },
  { key: "tout", label: "Tout" },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

function withinPeriod(iso: string | null, period: PeriodKey, now: number): boolean {
  if (period === "tout") return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  const days = period === "mois" ? 31 : 365;
  return now - t <= days * 24 * 3600 * 1000;
}

export function ComptaExport({ rows, nowMs }: { rows: ComptaRow[]; nowMs: number }) {
  const [period, setPeriod] = useState<PeriodKey>("mois");

  const filtered = useMemo(
    // On date par l'encaissement (résolu) si dispo, sinon la création.
    () => rows.filter((r) => withinPeriod(r.resolvedAt ?? r.createdAt, period, nowMs)),
    [rows, period, nowMs],
  );

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => ({
        recovered: acc.recovered + r.recovered,
        indemnity: acc.indemnity + r.indemnity,
        claimed: acc.claimed + r.claimed,
      }),
      { recovered: 0, indemnity: 0, claimed: 0 },
    );
  }, [filtered]);

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-max rounded-full border bg-background p-1">
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              aria-pressed={active}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-300 ${
                active ? "bg-ink text-ink-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Encaissé" value={euros(totals.recovered)} accent />
        <Stat label="Indemnités" value={euros(totals.indemnity)} />
        <Stat label="Dossiers" value={String(filtered.length)} />
      </div>

      <DownloadButton
        url={`/app/export/comptable?periode=${period}`}
        fallbackName={`bleme-compta-${period}.csv`}
        label="Télécharger le CSV"
        tone="primary"
        icon={<FileSpreadsheet className="size-4" />}
      />
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-3.5 ${accent ? "bg-brand-soft ring-1 ring-brand/15" : "bg-muted/50"}`}
    >
      <p className={`text-lg font-bold tabular-nums tracking-tight ${accent ? "text-brand-strong" : ""}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
    </div>
  );
}
