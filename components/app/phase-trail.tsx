import { Check, Flag, Handshake, Rocket, type LucideIcon } from "lucide-react";
import { PHASE_META, type Phase } from "@/lib/cases/phases";

/*
 * Indicateur du cycle de vie en 3 phases. Volontairement TRÈS différent du
 * stepper des sous-étapes (ronds numérotés) rendu juste en dessous : ici un
 * bandeau segmenté, avec une ICÔNE par phase (pas de numéro) et la phase active
 * « allumée » en brand. Impossible de confondre les deux niveaux de hiérarchie.
 * variant "full" en tête du dossier ; variant "compact" pour la carte de liste.
 */
const ICONS: LucideIcon[] = [Rocket, Handshake, Flag];

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
      <div className={`flex items-center gap-1.5 ${className}`} aria-label={`Phase ${phase} sur 3`}>
        {PHASE_META.map((p) => {
          const Icon = ICONS[p.n - 1];
          const done = p.n < phase;
          const current = p.n === phase;
          return (
            <span
              key={p.n}
              className={`flex size-6 items-center justify-center rounded-lg ${
                current
                  ? "bg-brand text-brand-foreground"
                  : done
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-muted text-muted-foreground/60"
              }`}
            >
              {done ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
            </span>
          );
        })}
      </div>
    );
  }

  const current = PHASE_META[phase - 1];
  const CurrentIcon = ICONS[phase - 1];

  return (
    <div className={className}>
      {/* Bandeau segmenté (conteneur distinct = niveau « macro ») */}
      <div className="flex gap-1.5 rounded-[1.5rem] border bg-card p-2 shadow-sm shadow-zinc-950/[0.03]">
        {PHASE_META.map((p) => {
          const Icon = ICONS[p.n - 1];
          const done = p.n < phase;
          const isCurrent = p.n === phase;
          return (
            <div
              key={p.n}
              className={`flex min-w-0 flex-1 items-center gap-3 rounded-[1.1rem] px-3 py-2.5 transition-colors ${
                isCurrent ? "bg-gradient-to-br from-brand-soft to-brand-soft/30 ring-1 ring-brand/20" : ""
              }`}
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                  isCurrent
                    ? "bg-brand text-brand-foreground shadow-sm shadow-brand/30"
                    : done
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-muted text-muted-foreground/60"
                }`}
              >
                {done ? <Check className="size-[18px]" /> : <Icon className="size-[18px]" />}
              </span>
              <div className="hidden min-w-0 md:block">
                <p
                  className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
                    isCurrent ? "text-brand-strong" : done ? "text-emerald-700" : "text-muted-foreground/60"
                  }`}
                >
                  Phase {p.n}
                </p>
                <p
                  className={`truncate text-sm font-semibold leading-tight ${
                    isCurrent ? "text-foreground" : done ? "text-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {p.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Contexte de la phase courante — sous-titre (et libellé sur mobile) */}
      <div className="mt-2.5 flex items-center gap-2 px-1.5">
        <span className="flex size-4 items-center justify-center text-brand-strong md:hidden">
          <CurrentIcon className="size-4" />
        </span>
        <p className="text-[13px] text-muted-foreground">
          <span className="font-medium text-foreground md:hidden">{current.label} · </span>
          {current.sub}
        </p>
      </div>
    </div>
  );
}
