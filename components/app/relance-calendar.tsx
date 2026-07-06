"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
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
function monthStartOf(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function timeFr(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// Drapeau d'hydratation (idiome partagé avec draft-banner) : false au SSR et au
// premier rendu client, true après. Toute la logique de dates (placement des
// évènements, « aujourd'hui », sélection) est donc calculée UNIQUEMENT côté
// navigateur, dans le fuseau de l'utilisateur — jamais de mismatch d'hydratation
// entre une infra en UTC et un utilisateur en France.
const noopSubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/*
 * Agenda des relances de MES dossiers (scopé RLS côté serveur). Grille mensuelle
 * lundi-first, chips colorées par type + avatar de l'agent qui porte l'action,
 * relances en retard en ambre. Un clic sur un jour ouvre le détail ; chaque
 * évènement renvoie vers son dossier.
 */
export function RelanceCalendar({ events }: { events: CalEvent[] }) {
  const hydrated = useHydrated();
  // null = « suit aujourd'hui » ; renseigné dès que l'utilisateur navigue/clique.
  const [cursorOverride, setCursorOverride] = useState<Date | null>(null);
  const [selectedOverride, setSelectedOverride] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) {
      const k = dayKey(new Date(e.date));
      (m.get(k) ?? m.set(k, []).get(k)!).push(e);
    }
    for (const list of m.values()) list.sort((a, b) => +new Date(a.date) - +new Date(b.date));
    return m;
  }, [events]);

  // Rendu serveur / première hydratation : squelette neutre, aucune date.
  if (!hydrated) return <CalendarSkeleton />;

  const now = new Date();
  const todayKey = dayKey(now);
  const startOfToday = startOfDay(now);
  const cursor = cursorOverride ?? monthStartOf(now);
  const selected = selectedOverride ?? todayKey;

  const lead = (cursor.getDay() + 6) % 7; // lundi = 0
  const gridStart = new Date(cursor);
  gridStart.setDate(1 - lead);
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const isOverdue = (e: CalEvent) => e.type === "relance" && new Date(e.date).getTime() < startOfToday;
  const styleFor = (e: CalEvent) => (isOverdue(e) ? OVERDUE : META[e.type]);

  const selectedEvents = byDay.get(selected) ?? [];
  const [sy, sm, sd] = selected.split("-").map(Number);
  const selectedDate = new Date(sy, sm, sd);

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
              onClick={() => {
                setCursorOverride(null);
                setSelectedOverride(null);
              }}
              className="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-brand-soft/50"
            >
              Aujourd’hui
            </button>
            <button type="button" aria-label="Mois précédent" onClick={() => setCursorOverride(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="flex size-8 items-center justify-center rounded-full border transition-colors hover:bg-muted">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" aria-label="Mois suivant" onClick={() => setCursorOverride(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="flex size-8 items-center justify-center rounded-full border transition-colors hover:bg-muted">
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
                onClick={() => setSelectedOverride(k)}
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
          {selectedDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <div className="mt-4 flex flex-col gap-2.5">
          {selectedEvents.length === 0 ? (
            <p className="rounded-2xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">Rien de prévu ce jour.</p>
          ) : (
            selectedEvents.map((e, i) => {
              const s = styleFor(e);
              return (
                <Link
                  key={i}
                  href={`/app/dossiers/${e.caseId}`}
                  className="flex items-start gap-3 rounded-2xl border p-3 transition-colors hover:border-brand/50 hover:bg-brand-soft/25"
                >
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
                </Link>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}

/* Squelette au rendu serveur : même gabarit que le calendrier, sans dates. */
function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="rounded-[1.75rem] border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-28 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1">
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={i} className="min-h-[5.5rem] animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      </div>
      <aside className="rounded-[1.75rem] border bg-card p-5">
        <div className="h-5 w-28 animate-pulse rounded-md bg-muted" />
        <div className="mt-4 h-20 animate-pulse rounded-2xl bg-muted/40" />
      </aside>
    </div>
  );
}
