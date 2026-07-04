"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Clock,
  Download,
  FileSearch,
  Landmark,
  Mail,
  MailQuestion,
  Scale,
  ScrollText,
  Send,
  ShieldCheck,
} from "lucide-react";

/*
 * « Vous savez toujours où en est le dossier » : timeline verticale (ligne
 * dessinée au scroll, pur CSS) avec un sélecteur de type de blème. Chaque
 * type a sa cadence et ses durées moyennes.
 */

type Jalon = {
  jour: string;
  icon: typeof Mail;
  titre: string;
  texte: string;
  duree: string;
  ici?: string;
};

const TIMELINES: Record<
  string,
  { label: string; soon?: boolean; jalons: Jalon[] }
> = {
  unpaid: {
    label: "Impayé",
    jalons: [
      {
        jour: "Jour 0",
        icon: Mail,
        titre: "Relance amiable",
        texte:
          "Le courrier cordial part dès votre validation, avec les bonnes références et le bon montant.",
        duree: "réponse sous 5 j en moyenne",
      },
      {
        jour: "Jour 7",
        icon: Send,
        titre: "Relance ferme",
        texte:
          "Le ton monte d’un cran et la mise en demeure est annoncée. Beaucoup de dossiers se règlent ici.",
        duree: "réponse sous 4 j en moyenne",
      },
      {
        jour: "Jour 15",
        icon: ScrollText,
        titre: "Mise en demeure",
        texte:
          "Envoyée en recommandé, elle fixe un délai précis et ouvre droit aux indemnités de retard.",
        duree: "recommandé distribué sous 3 j",
        ici: "Dossier Bâti Concept : vous êtes ici",
      },
      {
        jour: "Jour 30",
        icon: Download,
        titre: "Escalade préparée",
        texte:
          "Si rien ne bouge : chronologie, courriers et pièces numérotées, prêts pour un avocat ou un commissaire de justice.",
        duree: "dossier exporté en 1 clic",
      },
    ],
  },
  dispute: {
    label: "Litige client",
    jalons: [
      {
        jour: "Jour 0",
        icon: FileSearch,
        titre: "Dossier documenté",
        texte:
          "Votre récit, vos preuves et vos échanges sont classés. La chronologie des faits est reconstituée.",
        duree: "chronologie générée immédiatement",
      },
      {
        jour: "Jour 1",
        icon: Scale,
        titre: "Réponse circonstanciée",
        texte:
          "Un brouillon répond point par point à ce qu’on vous reproche, appuyé sur vos pièces.",
        duree: "brouillon prêt sous 24 h",
        ici: "Litige Dubois Rénovation : vous êtes ici",
      },
      {
        jour: "Jour 7",
        icon: ShieldCheck,
        titre: "Résolution amiable",
        texte:
          "Une proposition de sortie est mise par écrit. Chaque échange nourrit le dossier, au cas où.",
        duree: "réponse sous 7 j en moyenne",
      },
      {
        jour: "Jour 21",
        icon: Download,
        titre: "Escalade préparée",
        texte:
          "Si le désaccord persiste : le dossier complet s’exporte, pièces numérotées, pour le professionnel de votre choix.",
        duree: "dossier exporté en 1 clic",
      },
    ],
  },
  admin: {
    label: "Demande aux impôts",
    soon: true,
    jalons: [
      {
        jour: "Jour 0",
        icon: Landmark,
        titre: "Situation analysée",
        texte:
          "Amende, majoration ou pénalité : les motifs de contestation ou de remise gracieuse sont identifiés.",
        duree: "analyse immédiate",
      },
      {
        jour: "Jour 1",
        icon: ScrollText,
        titre: "Demande rédigée",
        texte:
          "Le courrier motivé est prêt : contestation ou demande gracieuse, avec vos justificatifs joints.",
        duree: "brouillon prêt sous 24 h",
      },
      {
        jour: "Jour 3",
        icon: Send,
        titre: "Envoi au bon service",
        texte:
          "Recommandé ou dépôt en ligne selon le cas, avec accusé conservé dans le dossier.",
        duree: "accusé de réception archivé",
      },
      {
        jour: "Jour 30",
        icon: MailQuestion,
        titre: "Réponse suivie",
        texte:
          "L’administration répond rarement vite : la relance part toute seule si le silence dure.",
        duree: "relance automatique après 30 j",
      },
    ],
  },
};

const EASE = [0.16, 1, 0.3, 1] as const;

export function CaseTimeline() {
  const [type, setType] = useState<keyof typeof TIMELINES>("unpaid");
  const reduce = useReducedMotion();
  const timeline = TIMELINES[type];

  return (
    <section id="suivi" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24 lg:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Vous savez toujours où en est le dossier.
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Chaque étape a sa date et sa durée moyenne constatée. Comme un colis
          qu’on suit, mais pour votre argent.
        </p>

        {/* Sélecteur de type */}
        <div
          role="tablist"
          aria-label="Type de blème"
          className="mx-auto mt-8 inline-flex flex-wrap items-center justify-center gap-1 rounded-full border bg-card p-1.5"
        >
          {(Object.keys(TIMELINES) as (keyof typeof TIMELINES)[]).map((key) => {
            const t = TIMELINES[key];
            const active = key === type;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                onClick={() => setType(key)}
                className={
                  active
                    ? "inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid"
                    : "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-all duration-500 ease-fluid hover:text-foreground"
                }
              >
                {t.label}
                {t.soon ? (
                  <span
                    className={
                      active
                        ? "rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        : "rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-strong"
                    }
                  >
                    Bientôt
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mx-auto mt-16 max-w-4xl">
        <span
          aria-hidden
          className="absolute bottom-6 left-5 top-2 w-px bg-border lg:left-1/2"
        />
        <span
          aria-hidden
          className="anim-draw-line absolute bottom-6 left-5 top-2 w-px bg-brand lg:left-1/2"
        />

        <motion.ol
          key={type}
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="flex flex-col gap-10 lg:gap-14"
        >
          {timeline.jalons.map((j, i) => {
            const gauche = i % 2 === 0;
            return (
              <li key={j.titre} className="relative lg:grid lg:grid-cols-2 lg:gap-20">
                <span
                  aria-hidden
                  className="absolute left-5 top-7 z-[1] flex size-5 -translate-x-1/2 items-center justify-center lg:left-1/2"
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

                <div
                  className={`hidden items-start pt-6 lg:flex ${
                    gauche ? "order-2 justify-start" : "order-1 justify-end"
                  }`}
                >
                  <span className="font-mono text-sm font-semibold uppercase tracking-[0.14em] text-brand">
                    {j.jour}
                  </span>
                </div>

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
                          {j.ici}
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
        </motion.ol>
      </div>

      <p className="mx-auto mt-14 max-w-2xl text-center text-[13px] leading-relaxed text-muted-foreground/80">
        Durées indicatives constatées sur les dossiers types. La cadence se met
        en pause dès qu’une réponse arrive, et chaque envoi attend votre
        validation.
      </p>
    </section>
  );
}
