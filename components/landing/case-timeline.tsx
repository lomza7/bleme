import { Clock, Download, Mail, ScrollText, Send } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

/*
 * « Vous savez toujours où en est le dossier » : timeline verticale dont la
 * ligne se dessine au scroll (.anim-draw-line, pur CSS), jalons alternés
 * gauche/droite, marqueur « vous êtes ici » qui poursuit l'histoire du
 * dossier Bâti Concept commencée dans le hero.
 */

const JALONS = [
  {
    jour: "Jour 0",
    icon: Mail,
    titre: "Relance amiable",
    texte:
      "Le courrier cordial part dès votre validation, avec les bonnes références et le bon montant.",
    duree: "réponse sous 5 j en moyenne",
    ici: false,
  },
  {
    jour: "Jour 7",
    icon: Send,
    titre: "Relance ferme",
    texte:
      "Le ton monte d’un cran et la mise en demeure est annoncée. Beaucoup de dossiers se règlent ici.",
    duree: "réponse sous 4 j en moyenne",
    ici: false,
  },
  {
    jour: "Jour 15",
    icon: ScrollText,
    titre: "Mise en demeure",
    texte:
      "Envoyée en recommandé, elle fixe un délai précis et ouvre droit aux indemnités de retard.",
    duree: "recommandé distribué sous 3 j",
    ici: true,
  },
  {
    jour: "Jour 30",
    icon: Download,
    titre: "Escalade préparée",
    texte:
      "Si rien ne bouge : chronologie, courriers et pièces numérotées, prêts pour un avocat ou un commissaire de justice.",
    duree: "dossier exporté en 1 clic",
    ici: false,
  },
];

export function CaseTimeline() {
  return (
    <section id="suivi" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24 lg:py-32">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Vous savez toujours où en est le dossier.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Chaque étape a sa date et sa durée moyenne constatée. Comme un
            colis qu’on suit, mais pour votre argent.
          </p>
        </div>
      </Reveal>

      <div className="relative mx-auto mt-16 max-w-4xl">
        {/* Rail + ligne qui se dessine */}
        <span
          aria-hidden
          className="absolute bottom-6 left-5 top-2 w-px bg-border lg:left-1/2"
        />
        <span
          aria-hidden
          className="anim-draw-line absolute bottom-6 left-5 top-2 w-px bg-brand lg:left-1/2"
        />

        <ol className="flex flex-col gap-10 lg:gap-14">
          {JALONS.map((j, i) => {
            const gauche = i % 2 === 0;
            return (
              <li key={j.titre} className="relative lg:grid lg:grid-cols-2 lg:gap-20">
                {/* Nœud sur la ligne */}
                <span
                  aria-hidden
                  className={
                    j.ici
                      ? "absolute left-5 top-7 z-[1] flex size-5 -translate-x-1/2 items-center justify-center lg:left-1/2"
                      : "absolute left-5 top-7 z-[1] flex size-5 -translate-x-1/2 items-center justify-center lg:left-1/2"
                  }
                >
                  {j.ici && (
                    <span className="absolute inline-flex size-5 animate-ping rounded-full bg-brand/50 motion-reduce:hidden" />
                  )}
                  <span
                    className={
                      j.ici
                        ? "relative size-4 rounded-full border-[3px] border-background bg-brand shadow-[0_0_0_1px_var(--brand)]"
                        : "relative size-3.5 rounded-full border-[3px] border-background bg-brand/80 shadow-[0_0_0_1px_var(--border)]"
                    }
                  />
                </span>

                {/* Jour, côté opposé à la carte (desktop) */}
                <div
                  className={`hidden items-start pt-6 lg:flex ${
                    gauche
                      ? "order-2 justify-start pl-0"
                      : "order-1 justify-end pr-0"
                  }`}
                >
                  <span className="font-mono text-sm font-semibold uppercase tracking-[0.14em] text-brand">
                    {j.jour}
                  </span>
                </div>

                {/* Carte jalon */}
                <div className={`pl-12 lg:pl-0 ${gauche ? "order-1" : "order-2"}`}>
                  <div
                    className={`rounded-3xl border bg-card p-6 shadow-sm transition-all duration-500 ease-fluid hover:-translate-y-0.5 hover:shadow-lg hover:shadow-zinc-950/[0.05] sm:p-7 ${
                      j.ici ? "ring-2 ring-brand" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                        <j.icon className="size-4.5" />
                      </span>
                      <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-brand lg:hidden">
                        {j.jour}
                      </span>
                      {j.ici && (
                        <span className="hidden items-center gap-2 rounded-full bg-brand px-3 py-1 text-xs font-medium text-brand-foreground lg:inline-flex">
                          <span className="relative flex size-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 motion-reduce:hidden" />
                            <span className="relative inline-flex size-1.5 rounded-full bg-white" />
                          </span>
                          Dossier Bâti Concept : vous êtes ici
                        </span>
                      )}
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">{j.titre}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {j.texte}
                    </p>
                    <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-[13px] text-muted-foreground">
                      <Clock className="size-3.5" />
                      {j.duree}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <Reveal delay={0.2}>
        <p className="mx-auto mt-14 max-w-2xl text-center text-[13px] leading-relaxed text-muted-foreground/80">
          Durées indicatives constatées sur les dossiers types. La cadence se
          met en pause dès qu’une réponse arrive, et chaque envoi attend votre
          validation.
        </p>
      </Reveal>
    </section>
  );
}
