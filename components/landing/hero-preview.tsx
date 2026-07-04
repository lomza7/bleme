import { ArrowRight, FileText, Mic, ScrollText, Send } from "lucide-react";

// Données d'exemple : le dossier type montré en hero.
const STEPS = [
  {
    icon: Mic,
    label: "Récit vocal analysé, dossier créé",
    date: "12 juin",
    eta: null,
    done: true,
  },
  {
    icon: FileText,
    label: "4 preuves classées, devis signé retrouvé",
    date: "12 juin",
    eta: null,
    done: true,
  },
  {
    icon: Send,
    label: "Relance ferme envoyée, lue par le client",
    date: "19 juin",
    eta: "réponse sous 5 j en moyenne",
    done: true,
  },
  {
    icon: ScrollText,
    label: "Mise en demeure prête pour recommandé",
    date: "aujourd'hui",
    eta: "distribué sous 3 j en moyenne",
    done: false,
  },
];

/**
 * Aperçu produit du hero : mini écran dossier (double bezel), étapes en
 * cascade. Animations 100 % CSS (.anim-load), aucune dépendance au JS.
 */
export function HeroPreview() {
  return (
    <div
      className="anim-load rounded-[1.75rem] bg-white/[0.06] p-2 ring-1 ring-white/10"
      style={{ "--delay": "0.25s" } as React.CSSProperties}
    >
      <div className="overflow-hidden rounded-[calc(1.75rem-0.5rem)] bg-card text-foreground shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              Facture F-2026-042 impayée
            </p>
            <p className="truncate text-[13px] text-muted-foreground">
              SARL Bâti Concept · 2 400,00 €
            </p>
          </div>
          <span
            className="anim-load shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-strong"
            style={{ "--delay": "1.6s" } as React.CSSProperties}
          >
            Étape 3 sur 4
          </span>
        </div>

        <ol className="relative px-5 py-4">
          <span
            aria-hidden
            className="absolute bottom-8 left-[31px] top-6 w-px bg-border"
          />
          {STEPS.map((step, i) => (
            <li
              key={step.label}
              className="anim-load relative flex items-start gap-3 py-2.5"
              style={{ "--delay": `${0.55 + i * 0.22}s` } as React.CSSProperties}
            >
              <span
                className={
                  step.done
                    ? "z-[1] mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-4 ring-card"
                    : "z-[1] mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground ring-4 ring-card"
                }
              >
                <step.icon className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p
                  className={
                    step.done
                      ? "text-sm text-muted-foreground"
                      : "text-sm font-medium"
                  }
                >
                  {step.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground/80">
                  {step.date}
                  {step.eta ? (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {step.eta}
                    </span>
                  ) : null}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div
          className="anim-load flex items-center justify-between gap-3 border-t bg-muted/50 px-5 py-3.5"
          style={{ "--delay": "1.8s" } as React.CSSProperties}
        >
          <p className="text-[13px] text-muted-foreground">
            Prochaine action : à valider
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-medium text-background">
            Relire et envoyer
            <ArrowRight className="size-3" />
          </span>
        </div>
      </div>
    </div>
  );
}
