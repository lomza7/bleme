"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";

export type CalEvent = {
  date: string; // ISO
  type: "relance" | "sent" | "reply" | "recovery";
  caseId: string;
  title: string;
  label: string;
  agent: string | null;
};

const META: Record<CalEvent["type"], { dot: string; chip: string; legend: string }> = {
  relance: { dot: "bg-brand", chip: "bg-brand-soft text-brand-strong", legend: "Prochaine relance" },
  sent: { dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700", legend: "Courrier envoyé" },
  reply: { dot: "bg-sky-500", chip: "bg-sky-100 text-sky-700", legend: "Retour client" },
  recovery: { dot: "bg-violet-500", chip: "bg-violet-100 text-violet-700", legend: "Échéance récupération" },
};
const OVERDUE = { dot: "bg-amber-500", chip: "bg-amber-100 text-amber-800" };

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const WD = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function timeFr(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function RelanceCalendar({ events }: { events: CalEvent[] }) {
  const today = new Date();
  const todayKey = dayKey(today);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(todayKey);

  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) {
      const k = dayKey(new Date(e.date));
      (m.get(k) ?? m.set(k, []).get(k)!).push(e);
    }
    for (const list of m.values()) list.sort((a, b) => +new Date(a.date) - +new Date(b.date));
    return m;
  }, [events]);

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lead = (monthStart.getDay() + 6) % 7; // lundi = 0
  const gridStart = new Date(monthStart);
  gridStart.setDate(1 - lead);
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const isOverdue = (e: CalEvent) => e.type === "relance" && new Date(e.date).getTime() < startOfToday;
  const styleFor = (e: CalEvent) => (isOverdue(e) ? OVERDUE : META[e.type]);

  const selectedEvents = selected ? byDay.get(selected) ?? [] : [];
  const [sy, sm, sd] = (selected ?? "").split("-").map(Number);
  const selectedDate = selected ? new Date(sy, sm, sd) : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
      {/* Calendrier */}
      <div className="rounded-[1.75rem] border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-brand-soft/50"
            >
              Aujourd’hui
            </button>
            <button type="button" aria-label="Mois précédent" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="flex size-8 items-center justify-center rounded-full border transition-colors hover:bg-muted">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" aria-label="Mois suivant" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="flex size-8 items-center justify-center rounded-full border transition-colors hover:bg-muted">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1">
          {WD.map((w) => (
            <div key={w} className="pb-1 text-center text-xs font-medium text-muted-foreground">{w}</div>
          ))}
          {days.map((d) => {
            const k = dayKey(d);
            const inMonth = d.getMonth() === cursor.getMonth();
            const isToday = k === todayKey;
            const isSel = k === selected;
            const list = byDay.get(k) ?? [];
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelected(k)}
                className={`flex min-h-[5.5rem] flex-col gap-1 rounded-xl border p-1.5 text-left transition-colors ${
                  isSel ? "border-brand bg-brand-soft/40" : "border-transparent hover:bg-muted/60"
                } ${inMonth ? "" : "opacity-40"}`}
              >
                <span className={`flex size-6 items-center justify-center rounded-full text-xs font-medium ${isToday ? "bg-ink text-white" : "text-foreground"}`}>
                  {d.getDate()}
                </span>
                <span className="flex flex-col gap-0.5">
                  {list.slice(0, 3).map((e, i) => {
                    const s = styleFor(e);
                    return (
                      <span key={i} className={`flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium ${s.chip}`}>
                        {e.agent ? (
                          <span className="flex size-3.5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/60">
                            <SpriteAvatar src={`/agents/${e.agent}.webp`} alt="" className="h-3" />
                          </span>
                        ) : (
                          <span className={`size-1.5 shrink-0 rounded-full ${s.dot}`} />
                        )}
                        <span className="truncate">{e.label}</span>
                      </span>
                    );
                  })}
                  {list.length > 3 ? <span className="px-1 text-[10px] text-muted-foreground">+{list.length - 3}</span> : null}
                </span>
              </button>
            );
          })}
        </div>

        {/* Légende */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t pt-4">
          {(Object.keys(META) as CalEvent["type"][]).map((t) => (
            <span key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`size-2 rounded-full ${META[t].dot}`} />
              {META[t].legend}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`size-2 rounded-full ${OVERDUE.dot}`} />
            Relance en retard
          </span>
        </div>
      </div>

      {/* Détail du jour */}
      <aside className="rounded-[1.75rem] border bg-card p-5 lg:sticky lg:top-6 lg:h-max">
        <p className="text-sm font-semibold">
          {selectedDate
            ? selectedDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
            : "Sélectionnez un jour"}
        </p>
        <div className="mt-4 flex flex-col gap-2.5">
          {selectedEvents.length === 0 ? (
            <p className="rounded-2xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">Rien de prévu ce jour.</p>
          ) : (
            selectedEvents.map((e, i) => {
              const s = styleFor(e);
              return (
                <div key={i} className="flex items-start gap-3 rounded-2xl border p-3">
                  <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg ${s.chip}`}>
                    {e.agent ? <SpriteAvatar src={`/agents/${e.agent}.webp`} alt="" className="h-6" /> : <span className={`size-2 rounded-full ${s.dot}`} />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{e.label}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{e.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                      {timeFr(e.date)}
                      {isOverdue(e) ? " · en retard" : ""}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
