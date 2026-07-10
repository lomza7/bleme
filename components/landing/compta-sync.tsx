import Image from "next/image";
import { Check, FolderPlus, HandCoins, TriangleAlert, Zap } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

/*
 * « Votre compta connaît déjà vos impayés » : la connexion Pennylane mise en
 * scène. À gauche, la promesse ; à droite, le flux animé — les factures en
 * retard descendent de Pennylane vers un dossier BLEME (connecteur en
 * pointillés qui défilent, .anim-dash), et la rentrée d'argent détectée
 * remonte en toast émeraude. 100 % CSS (reduced-motion : tout est statique
 * et visible, comme le reste de la landing).
 */

const invoices = [
  { num: "F-2026-041", amount: "2 400,00 €", state: "paid" as const },
  { num: "F-2026-042", amount: "1 850,00 €", state: "late" as const, days: 12 },
  { num: "F-2026-043", amount: "3 200,00 €", state: "late" as const, days: 47 },
];

export function ComptaSync() {
  return (
    <section id="compta" className="relative overflow-hidden border-y bg-ink text-ink-foreground">
      <div aria-hidden className="absolute inset-0 bg-hero-grid [mask-image:radial-gradient(ellipse_70%_70%_at_80%_30%,black,transparent)]" />
      <div aria-hidden className="absolute -left-40 top-1/3 size-[28rem] rounded-full bg-emerald-500/10 blur-[130px]" />
      <div aria-hidden className="absolute -right-32 -bottom-40 size-[30rem] rounded-full bg-brand/20 blur-[140px]" />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 py-24 lg:grid-cols-2 lg:gap-16 lg:py-32">
        {/* La promesse */}
        <div>
          <Reveal>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-brand">
                Compta connectée
              </p>
              <span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-medium text-brand-foreground">
                Nouveau
              </span>
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Votre compta connaît déjà vos impayés.
              <span className="block text-ink-foreground/60">
                Maintenant, elle sait quoi en faire.
              </span>
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-muted">
              Branchez{" "}
              <span className="inline-flex translate-y-[3px] items-center rounded-full bg-white px-2.5 py-1">
                <Image src="/logos/pennylane.svg" alt="Pennylane" width={101} height={20} className="h-5 w-auto" />
              </span>{" "}
              en deux minutes : vos factures en retard arrivent dans BLEME,
              chacune prête à devenir un dossier.
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <ul className="mt-9 space-y-5">
              {[
                {
                  icon: Zap,
                  title: "Vos retards détectés, sans rien saisir",
                  text: "Les factures dépassées remontent d’elles-mêmes, avec montant, échéance et client.",
                },
                {
                  icon: FolderPlus,
                  title: "Un dossier complet en un clic",
                  text: "Client pré-rempli, facture PDF jointe en pièce — la relance se prépare dans la foulée.",
                },
                {
                  icon: HandCoins,
                  title: "La rentrée d’argent, détectée",
                  text: "Facture réglée côté compta ? Vous êtes prévenu aussitôt, le dossier se solde.",
                },
              ].map((b) => (
                <li key={b.title} className="flex items-start gap-4">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand ring-1 ring-white/15">
                    <b.icon className="size-4" />
                  </span>
                  <span>
                    <span className="block font-semibold">{b.title}</span>
                    <span className="mt-0.5 block max-w-[46ch] text-sm leading-relaxed text-ink-muted">
                      {b.text}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.18}>
            <p className="mt-9 border-t border-white/10 pt-5 text-sm leading-relaxed text-ink-muted">
              Lecture seule : BLEME lit vos factures clients, et n’écrit jamais
              rien dans votre comptabilité. D’autres logiciels arrivent.
            </p>
          </Reveal>
        </div>

        {/* Le flux animé : Pennylane → BLEME → rentrée d'argent */}
        <Reveal delay={0.12}>
          <div className="relative mx-auto w-full max-w-md">
            {/* Carte Pennylane */}
            <div className="rounded-3xl bg-white p-5 text-foreground shadow-2xl shadow-black/40 ring-1 ring-black/5 sm:p-6">
              <div className="flex items-center justify-between gap-3 border-b pb-4">
                <Image src="/logos/pennylane.svg" alt="Pennylane" width={121} height={24} className="h-6 w-auto" />
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  Factures clients
                </span>
              </div>
              <ul className="mt-4 space-y-2.5">
                {invoices.map((f) => (
                  <li
                    key={f.num}
                    className="flex items-center gap-3 rounded-xl bg-muted/70 px-3.5 py-2.5 ring-1 ring-black/5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{f.num}</span>
                      <span className="block text-[11px] tabular-nums text-muted-foreground">
                        {f.amount}
                      </span>
                    </span>
                    {f.state === "paid" ? (
                      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                        <Check className="size-3" />
                        Payée
                      </span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-800">
                        <span className="relative flex size-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60 motion-reduce:hidden" />
                          <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
                        </span>
                        J+{f.days}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Connecteur : pointillés qui coulent vers BLEME */}
            <div className="relative mx-auto flex h-14 w-full items-center justify-center" aria-hidden>
              <svg className="h-full w-1.5" viewBox="0 0 2 56" preserveAspectRatio="none">
                <line
                  x1="1"
                  y1="0"
                  x2="1"
                  y2="56"
                  className="anim-dash stroke-brand"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <span className="absolute rounded-full bg-brand px-3 py-1 text-[11px] font-semibold text-brand-foreground shadow-lg shadow-brand/40">
                sync automatique
              </span>
            </div>

            {/* Carte BLEME : le dossier né de la facture */}
            <div className="rounded-3xl bg-white p-5 text-foreground shadow-2xl shadow-black/40 ring-1 ring-black/5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold tracking-tight">
                  BLEME<span className="text-brand">.</span>
                </p>
                <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-medium text-brand-foreground">
                  1 clic
                </span>
              </div>
              <div className="mt-3.5 flex items-center gap-3 rounded-xl bg-brand-soft/60 px-3.5 py-3 ring-1 ring-brand/15">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
                  <TriangleAlert className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">
                    Facture impayée · Bâti Concept
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    F-2026-043 · 3 200,00 € · facture PDF jointe
                  </span>
                </span>
              </div>
              <p className="mt-3 flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
                Relance cordiale prête à valider
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  dossier créé
                </span>
              </p>
            </div>

            {/* Le retour : la rentrée d'argent détectée */}
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-500/15 px-4 py-3.5 ring-1 ring-emerald-400/30 backdrop-blur">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                <HandCoins className="size-4" />
              </span>
              <p className="min-w-0 text-sm leading-snug text-emerald-100">
                <span className="font-semibold text-emerald-50">Rentrée d’argent détectée</span>
                {" — "}la facture F-2026-041 vient d’être réglée. Dossier à solder.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
