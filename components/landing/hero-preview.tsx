import {
  ArrowRight,
  Check,
  CheckCheck,
  Eye,
  ScrollText,
} from "lucide-react";

/*
 * Aperçu produit du hero : l'écran dossier condensé (double bezel),
 * suivi du dossier fictif SARL Bâti Concept. Animations 100 % CSS
 * (.anim-load), notification flottante en fin de séquence.
 */

const STEPS = [
  {
    label: "Récit vocal analysé, dossier créé",
    meta: "12 juin",
    done: true,
  },
  {
    label: "4 preuves classées, devis signé retrouvé",
    meta: "12 juin",
    done: true,
  },
  {
    label: "Relance ferme envoyée",
    meta: "19 juin · lue par le client",
    read: true,
    done: true,
  },
  {
    label: "Mise en demeure prête",
    meta: "aujourd'hui · distribué sous 3 j en moyenne",
    done: false,
  },
];

export function HeroPreview() {
  return (
    <div className="relative">
      <div
        className="anim-load rounded-[1.75rem] bg-white/[0.06] p-2 ring-1 ring-white/10"
        style={{ "--delay": "0.25s" } as React.CSSProperties}
      >
        <div className="overflow-hidden rounded-[calc(1.75rem-0.5rem)] bg-card text-foreground shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]">
          {/* En-tête : le montant en vedette */}
          <div className="border-b px-6 pb-4 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Facture F-2026-042
                </p>
                <p className="mt-1 text-3xl font-bold tracking-tight">
                  2 400,00 €
                </p>
                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                  SARL Bâti Concept · impayée depuis 47 j
                </p>
              </div>
              <span
                className="anim-load shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-strong"
                style={{ "--delay": "1.7s" } as React.CSSProperties}
              >
                Étape 3 sur 4
              </span>
            </div>
            {/* Jauge de progression */}
            <div className="mt-4 flex items-center gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={
                    i < 2
                      ? "h-1.5 flex-1 rounded-full bg-brand"
                      : i === 2
                        ? "anim-load h-1.5 flex-1 rounded-full bg-brand"
                        : "h-1.5 flex-1 rounded-full bg-muted"
                  }
                  style={
                    i === 2
                      ? ({ "--delay": "1.5s" } as React.CSSProperties)
                      : undefined
                  }
                />
              ))}
            </div>
          </div>

          {/* Étapes */}
          <ol className="relative px-6 py-4">
            <span
              aria-hidden
              className="absolute bottom-8 left-[35px] top-6 w-px bg-border"
            />
            {STEPS.map((step, i) => (
              <li
                key={step.label}
                className="anim-load relative flex items-start gap-3.5 py-2.5"
                style={{ "--delay": `${0.55 + i * 0.24}s` } as React.CSSProperties}
              >
                {step.done ? (
                  <span className="z-[1] mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-4 ring-card">
                    <Check className="size-3" />
                  </span>
                ) : (
                  <span className="z-[1] mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground ring-4 ring-card">
                    <span className="absolute inline-flex size-5 animate-ping rounded-full bg-brand/40 motion-reduce:hidden" />
                    <ScrollText className="relative size-3" />
                  </span>
                )}
                <div className="min-w-0">
                  <p
                    className={
                      step.done
                        ? "text-sm text-muted-foreground"
                        : "flex flex-wrap items-center gap-2 text-sm font-medium"
                    }
                  >
                    {step.label}
                    {!step.done ? (
                      <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-foreground">
                        Recommandé
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground/80">
                    {step.meta}
                    {step.read ? (
                      <CheckCheck className="size-3.5 text-brand" />
                    ) : null}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {/* Pied : action à valider */}
          <div
            className="anim-load flex items-center justify-between gap-3 border-t bg-muted/50 px-6 py-4"
            style={{ "--delay": "1.9s" } as React.CSSProperties}
          >
            <p className="text-[13px] text-muted-foreground">
              Prochaine action : à valider
            </p>
            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-brand px-4 py-2 text-xs font-medium text-brand-foreground">
              Relire et envoyer
              <ArrowRight className="size-3" />
            </span>
          </div>
        </div>
      </div>

      {/* Notification flottante : la relance vient d'être lue */}
      <div
        className="anim-load absolute -bottom-14 -left-1 w-64 -rotate-2 rounded-2xl border bg-card p-3.5 text-foreground shadow-xl shadow-zinc-950/[0.25] sm:-left-6 lg:-left-14"
        style={{ "--delay": "2.4s" } as React.CSSProperties}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
            <Eye className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-snug">
              Votre relance vient d’être lue
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              SARL Bâti Concept · à l’instant
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
