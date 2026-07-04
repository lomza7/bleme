import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  LogOut,
  Plus,
} from "lucide-react";
import { CountUp } from "@/components/landing/count-up";
import { Reveal } from "@/components/landing/reveal";

/*
 * Démo du tableau de bord : reproduction fidèle et vivante de l'app réelle
 * (mêmes composants, mêmes données d'exemple que le dashboard), présentée
 * en double-bezel sur bande sombre. Les chiffres se comptent à l'arrivée
 * dans le viewport.
 */

const DOSSIERS = [
  {
    statut: "Action attendue",
    tone: "amber",
    type: "Impayé",
    titre: "Facture F-2026-042 · SARL Bâti Concept",
    action: "Valider la mise en demeure · demain",
    montant: "2 400 €",
    etape: 3,
  },
  {
    statut: "En attente de réponse",
    tone: "muted",
    type: "Impayé",
    titre: "Facture 2026-118 · Menuiserie Roux",
    action: "Relance ferme programmée · dans 4 j",
    montant: "5 850 €",
    etape: 2,
  },
  {
    statut: "Action attendue",
    tone: "amber",
    type: "Litige",
    titre: "Litige réception · Dubois Rénovation",
    action: "Ajouter le PV de réception · dans 2 j",
    montant: "3 200 €",
    etape: 1,
  },
  {
    statut: "Résolu",
    tone: "green",
    type: "Impayé",
    titre: "Facture A-2026-07 · Atelier Camille Perrin",
    action: "1 680 € récupérés",
    montant: "1 680 €",
    etape: 4,
  },
] as const;

const AGENDA = [
  { quand: "demain", quoi: "Valider la mise en demeure", qui: "SARL Bâti Concept" },
  { quand: "dans 2 j", quoi: "Ajouter le PV de réception", qui: "Dubois Rénovation" },
  { quand: "dans 4 j", quoi: "Relance ferme programmée", qui: "Menuiserie Roux" },
] as const;

const CHIP_TONES: Record<string, string> = {
  amber: "bg-amber-100 text-amber-800",
  muted: "bg-muted text-muted-foreground",
  green: "bg-emerald-100 text-emerald-800",
};

export function DashboardDemo() {
  return (
    <section className="relative overflow-hidden bg-ink text-ink-foreground">
      <div aria-hidden className="absolute -left-40 -top-40 size-[28rem] rounded-full bg-brand/20 blur-[130px]" />
      <div aria-hidden className="absolute -bottom-48 -right-32 size-[26rem] rounded-full bg-brand/10 blur-[120px]" />

      <div className="relative mx-auto max-w-6xl px-6 py-24 lg:py-32">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Vous pilotez vos chantiers. Pilotez aussi votre argent dehors.
            </h2>
            <p className="mt-4 text-lg text-ink-muted">
              Un écran, tous vos blèmes : ce qui est en jeu, ce qui est rentré,
              ce qui vous attend. Fini les impayés qui dorment dans Gmail.
            </p>
          </div>
        </Reveal>

        {/* Fenêtre app (double bezel) */}
        <Reveal delay={0.15}>
          <div className="mx-auto mt-14 max-w-5xl rounded-[2rem] bg-white/[0.06] p-2 ring-1 ring-white/10">
            <div className="overflow-hidden rounded-[calc(2rem-0.5rem)] bg-muted/40 text-foreground shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]">
              {/* Topbar de l'app */}
              <div className="flex items-center justify-between border-b bg-background px-5 py-3.5">
                <span className="text-[15px] font-bold tracking-tight">
                  BLEME<span className="text-brand">.</span>
                </span>
                <div className="flex items-center gap-2.5">
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    Bensaïd Plomberie
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground">
                    <Plus className="size-3.5" />
                    Nouveau blème
                  </span>
                  <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <LogOut className="size-3.5" />
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-5 p-5 sm:p-7">
                <div>
                  <p className="text-lg font-bold tracking-tight">Bonjour Karim.</p>
                  <p className="text-xs text-muted-foreground">
                    3 dossiers en cours, 3 actions cette semaine.
                  </p>
                </div>

                {/* Tuiles cash animées */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <DemoTile label="En jeu" value={11450} suffix=" €" sub="3 dossiers en cours" />
                  <DemoTile label="Récupéré" value={8320} suffix=" €" sub="depuis janvier" accent />
                  <DemoTile label="Récupérable estimé" value={11570} suffix=" €" sub="dont 120 € d’indemnités" />
                  <DemoTile label="Cette semaine" value={3} suffix="" sub="actions à traiter" />
                </div>

                <div className="grid items-start gap-4 lg:grid-cols-3">
                  {/* Dossiers */}
                  <div className="flex flex-col gap-2.5 lg:col-span-2">
                    {DOSSIERS.map((d) => (
                      <div
                        key={d.titre}
                        className="group flex items-center justify-between gap-4 rounded-2xl border bg-card p-4 transition-all duration-500 ease-fluid hover:-translate-y-0.5 hover:shadow-md hover:shadow-zinc-950/[0.05]"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CHIP_TONES[d.tone]}`}>
                              {d.statut}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{d.type}</span>
                          </div>
                          <p className="mt-1 truncate text-sm font-semibold">{d.titre}</p>
                          <p className={`truncate text-xs ${d.tone === "green" ? "text-emerald-700" : "text-muted-foreground"}`}>
                            {d.action}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <p className="text-sm font-bold tracking-tight">{d.montant}</p>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 4 }, (_, i) => (
                              <span
                                key={i}
                                className={
                                  i < d.etape
                                    ? "h-1 w-4 rounded-full bg-brand"
                                    : "h-1 w-4 rounded-full bg-muted"
                                }
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Agenda */}
                  <div className="rounded-2xl border bg-card p-2">
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      À venir
                    </p>
                    {AGENDA.map((a) => (
                      <div key={a.quoi} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-colors duration-300 hover:bg-muted">
                        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                          <CalendarClock className="size-3" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium">{a.quoi}</span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {a.quand} · {a.qui}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.25}>
          <div className="mt-12 flex flex-col items-center gap-4">
            <Link
              href="/nouveau"
              className="group inline-flex items-center gap-3 rounded-full bg-brand py-2.5 pl-6 pr-2.5 text-[15px] font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
            >
              Créer mon premier dossier
              <span className="flex size-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ease-fluid group-hover:translate-x-0.5">
                <ArrowRight className="size-4" />
              </span>
            </Link>
            <p className="text-xs text-ink-muted">
              Données d’exemple. Votre écran se remplit avec vos vrais dossiers.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function DemoTile({
  label,
  value,
  suffix,
  sub,
  accent = false,
}: {
  label: string;
  value: number;
  suffix: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className={accent ? "rounded-2xl bg-ink p-4 text-ink-foreground" : "rounded-2xl border bg-card p-4"}>
      <p className={`text-[10px] font-medium uppercase tracking-[0.12em] ${accent ? "text-ink-muted" : "text-muted-foreground"}`}>
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
        <CountUp value={value} suffix={suffix} />
      </p>
      <p className={`mt-0.5 text-[10px] ${accent ? "text-ink-muted" : "text-muted-foreground"}`}>
        {sub}
      </p>
    </div>
  );
}
