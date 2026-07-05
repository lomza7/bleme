/*
 * Graphiques de la console admin : SVG et CSS purs, rendus côté serveur,
 * aucun JavaScript client. Les barres poussent à l'entrée dans le viewport
 * (.anim-grow-bar, animation-timeline: view()).
 */

export function BarChart({
  points,
  ariaLabel,
}: {
  points: { label: string; value: number }[];
  ariaLabel: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div role="img" aria-label={ariaLabel}>
      <div className="flex h-36 items-end gap-[3px]">
        {points.map((p, i) => (
          <div
            key={i}
            title={`${p.label} : ${p.value.toLocaleString("fr-FR")}`}
            className="group relative flex h-full flex-1 items-end"
          >
            <div
              className={`anim-grow-bar w-full rounded-t-[3px] transition-colors ${
                p.value > 0 ? "bg-brand/70 group-hover:bg-brand" : "bg-muted"
              }`}
              style={{ height: `${p.value > 0 ? Math.max(6, (p.value / max) * 100) : 4}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>{points[0]?.label}</span>
        <span>{points[Math.floor(points.length / 2)]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

const DONUT_COLORS = [
  "var(--brand)",
  "oklch(0.55 0.12 150)",
  "oklch(0.6 0.12 250)",
  "oklch(0.7 0.13 85)",
  "oklch(0.5 0.1 300)",
  "oklch(0.65 0.02 260)",
  "oklch(0.35 0.02 260)",
];

export function Donut({
  segments,
  centre,
  sousCentre,
}: {
  segments: { label: string; value: number }[];
  centre: string;
  sousCentre: string;
}) {
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0));
  const C = 2 * Math.PI * 42;
  // Décalage cumulé de chaque segment, précalculé (pas de mutation au rendu).
  const offsets = segments.reduce<number[]>(
    (acc, s) => [...acc, acc[acc.length - 1] + (s.value / total) * C],
    [0],
  );

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--muted)" strokeWidth="12" />
          {segments.map((s, i) => {
            const len = (s.value / total) * C;
            return (
              <circle
                key={s.label}
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                strokeWidth="12"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offsets[i]}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums tracking-tight">{centre}</span>
          <span className="text-[10px] text-muted-foreground">{sousCentre}</span>
        </div>
      </div>
      <ul className="min-w-40 flex-1 space-y-1.5">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.label}</span>
            <span className="tabular-nums font-medium">{s.value.toLocaleString("fr-FR")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HBars({
  rows,
}: {
  rows: { label: string; value: number; detail?: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <p className="flex items-baseline justify-between gap-3 text-xs">
            <span className="min-w-0 truncate text-muted-foreground">{r.label}</span>
            <span className="tabular-nums font-medium">
              {r.value.toLocaleString("fr-FR")}
              {r.detail ? <span className="ml-1.5 font-normal text-muted-foreground">{r.detail}</span> : null}
            </span>
          </p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="anim-grow-bar h-full rounded-full bg-brand/80"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Funnel({
  steps,
}: {
  steps: { label: string; value: number }[];
}) {
  const max = Math.max(1, steps[0]?.value ?? 1);
  return (
    <div className="space-y-2.5">
      {steps.map((s, i) => {
        const pct = (s.value / max) * 100;
        const prev = i > 0 ? steps[i - 1].value : null;
        const conv = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        return (
          <div key={s.label}>
            <p className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="tabular-nums font-medium">
                {s.value.toLocaleString("fr-FR")}
                {conv !== null ? (
                  <span className="ml-1.5 font-normal text-muted-foreground">({conv} %)</span>
                ) : null}
              </span>
            </p>
            <div className="mt-1 h-6 overflow-hidden rounded-lg bg-muted">
              <div
                className="anim-grow-bar flex h-full items-center rounded-lg bg-gradient-to-r from-brand to-brand-strong"
                style={{ width: `${Math.max(pct, s.value > 0 ? 6 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
