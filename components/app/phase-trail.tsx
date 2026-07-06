import { Check } from "lucide-react";
import { PHASE_META, type Phase } from "@/lib/cases/phases";

/*
 * Indicateur du cycle de vie en 3 phases (Préparer & lancer → Relancer &
 * négocier → Escalader & résoudre). Présentationnel, RSC-safe (aucun hook).
 * variant "full" en tête du dossier ; variant "compact" pour la carte de liste.
 */
export function PhaseTrail({
  phase,
  variant = "full",
  className = "",
}: {
  phase: Phase;
  variant?: "full" | "compact";
  className?: string;
}) {
  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-1 ${className}`} aria-label={`Phase ${phase} sur 3`}>
        {PHASE_META.map((p) => (
          <span
            key={p.n}
            className={`h-1.5 w-6 rounded-full ${p.n <= phase ? "bg-brand" : "bg-muted"}`}
          />
        ))}
      </div>
    );
  }

  return (
    <ol className={`flex items-stretch gap-2 ${className}`}>
      {PHASE_META.map((p) => {
        const done = p.n < phase;
        const current = p.n === phase;
        return (
          <li key={p.n} className="flex flex-1 items-center gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  current
                    ? "bg-brand text-brand-foreground"
                    : done
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check className="size-4" /> : p.n}
              </span>
              <div className="hidden min-w-0 sm:block">
                <p className={`truncate text-sm font-semibold ${current ? "" : "text-muted-foreground"}`}>{p.label}</p>
                {current ? <p className="truncate text-xs text-muted-foreground">{p.sub}</p> : null}
              </div>
            </div>
            {p.n < 3 ? <span className={`hidden h-px flex-1 sm:block ${done ? "bg-emerald-300" : "bg-border"}`} /> : null}
          </li>
        );
      })}
    </ol>
  );
}
