import { BadgeCheck, Mail, Paperclip, PenLine, Printer, ShieldCheck, Truck } from "lucide-react";
import { Reveal, RevealItem, RevealStagger } from "@/components/landing/reveal";

/*
 * « De vraies lettres » : la preuve visuelle que BLEME expédie du PAPIER —
 * lettre suivie et recommandé AR. Enveloppe grandeur nature (expéditeur,
 * destinataire, timbre oblitéré, étiquette recommandé + code-barres) avec la
 * lettre validée qui dépasse, puis le suivi postal réel jusqu'à l'AR signé,
 * numérisé et archivé au dossier. Même dossier fictif que le hero (Bâti
 * Concept, 2 400 €). CSS/SVG purs, zéro JS client.
 */

const SUIVI = [
  {
    icon: Printer,
    titre: "Imprimée et mise sous pli",
    detail: "papier 80 g, enveloppe à fenêtre",
    quand: "jeudi, 17 h 12",
  },
  {
    icon: Mail,
    titre: "Remise à La Poste en recommandé AR",
    detail: "n° de suivi versé au dossier",
    quand: "jeudi, 18 h 03",
  },
  {
    icon: Truck,
    titre: "Distribuée au destinataire",
    detail: "statut suivi automatiquement",
    quand: "lundi, 10 h 41",
  },
  {
    icon: BadgeCheck,
    titre: "Accusé de réception signé",
    detail: "numérisé, archivé en preuve au dossier",
    quand: "mercredi, 9 h 27",
    emerald: true,
  },
];

/** Code-barres façon étiquette de suivi (barres CSS, largeurs irrégulières). */
function Barcode({ className = "" }: { className?: string }) {
  const bars = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 1, 4, 2, 1, 3, 1, 2, 1, 3, 2];
  return (
    <div aria-hidden className={`flex h-7 items-stretch gap-[2px] ${className}`}>
      {bars.map((w, i) => (
        <span key={i} className="bg-zinc-900" style={{ width: `${w}px` }} />
      ))}
    </div>
  );
}

/** Timbre oblitéré : carré brand denté + vagues d'oblitération SVG. */
function Stamp() {
  return (
    <div aria-hidden className="relative">
      <div
        className="flex h-16 w-14 flex-col items-center justify-center gap-1 rounded-[4px] bg-gradient-to-br from-brand to-brand-strong p-1.5 text-white shadow-sm"
        style={{
          maskImage:
            "radial-gradient(circle at 4px 4px, transparent 2.5px, black 2.6px), linear-gradient(black, black)",
          maskComposite: "intersect",
          maskSize: "8px 8px, 100% 100%",
        }}
      >
        <span className="text-[9px] font-bold uppercase tracking-widest">Bleme</span>
        <Mail className="size-5" />
        <span className="text-[8px] font-medium uppercase tracking-wider opacity-80">Prioritaire</span>
      </div>
      {/* Oblitération : cercle + vagues par-dessus le timbre. */}
      <svg viewBox="0 0 90 64" className="absolute -left-7 top-1 h-16 w-[90px] text-zinc-500/70">
        <circle cx="28" cy="30" r="21" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <text x="28" y="27" textAnchor="middle" className="fill-current" style={{ font: "600 6.5px monospace" }}>
          POSTÉ LE
        </text>
        <text x="28" y="37" textAnchor="middle" className="fill-current" style={{ font: "700 8px monospace" }}>
          10.07
        </text>
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M 46 ${16 + i * 9} q 10 -4 20 0 t 20 0`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
        ))}
      </svg>
    </div>
  );
}

/** L'enveloppe recommandée, grandeur nature. */
function Envelope() {
  return (
    <div className="relative mx-auto max-w-xl">
      {/* La lettre validée dépasse de l'enveloppe (elle y glisse). */
      /* rotation légère : composition vivante, pas une capture figée */}
      <div className="relative -mb-16 mx-6 rounded-t-2xl bg-white p-5 pb-20 shadow-xl shadow-zinc-950/[0.18] ring-1 ring-black/5 sm:mx-12">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-bold uppercase tracking-wide text-zinc-900">Mise en demeure de payer</p>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">
            <ShieldCheck className="size-3" />
            Validée par vous
          </span>
        </div>
        <div className="mt-3 space-y-1.5" aria-hidden>
          <div className="h-1.5 w-11/12 rounded-full bg-zinc-200" />
          <div className="h-1.5 w-full rounded-full bg-zinc-200" />
          <div className="h-1.5 w-3/5 rounded-full bg-zinc-200" />
        </div>
        <p className="mt-3 font-mono text-[10px] text-zinc-400">
          hash sha-256 · 9f2c…e1a7 — contenu approuvé, gravé au dossier
        </p>
      </div>

      {/* L'enveloppe. */}
      <div className="group relative rounded-2xl bg-[#fdfcf9] p-6 shadow-2xl shadow-zinc-950/[0.3] ring-1 ring-black/10 transition-transform duration-700 ease-fluid hover:-rotate-1 sm:p-8">
        {/* Rabat discret. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-14 rounded-t-2xl bg-gradient-to-b from-zinc-950/[0.05] to-transparent" />

        <div className="flex items-start justify-between gap-4">
          {/* Expéditeur. */}
          <div className="text-[11px] leading-relaxed text-zinc-500">
            <p className="font-semibold text-zinc-700">Bensaïd Plomberie</p>
            <p>12 rue des Artisans</p>
            <p>69100 Villeurbanne</p>
          </div>
          <Stamp />
        </div>

        {/* Étiquette recommandé. */}
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border-2 border-red-600/80 bg-white p-2.5 pr-4 sm:mt-8">
          <span className="rounded bg-red-600 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white">
            Recommandé + AR
          </span>
          <Barcode className="ml-auto" />
          <span className="w-full font-mono text-[10px] tracking-[0.2em] text-zinc-600 sm:w-auto">
            1A 023 456 7890 2
          </span>
        </div>

        {/* Destinataire. */}
        <div className="mt-6 flex justify-center pb-2 sm:mt-8 sm:justify-end sm:pr-10">
          <div className="text-[13px] font-medium uppercase leading-relaxed tracking-wide text-zinc-800">
            <p className="font-bold">SARL Bâti Concept</p>
            <p>18 rue des Forges</p>
            <p>69003 Lyon</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Fond « bureau de poste, la nuit » : bande liseré par-avion, vagues
 * d'oblitération géantes qui dérivent, cachets fantômes, et une enveloppe qui
 * VOLE le long d'une trajectoire en pointillés à travers toute la section
 * (SMIL animateMotion, coupé sous prefers-reduced-motion).
 */
function PostalBackdrop() {
  const FLIGHT = "M -80 240 C 250 60, 620 380, 900 180 S 1400 120, 1560 260";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-hero-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black,transparent)]" />
      <div className="absolute -left-40 top-10 size-[28rem] rounded-full bg-brand/20 blur-[130px]" />
      <div className="absolute -right-32 bottom-0 size-[24rem] rounded-full bg-brand/10 blur-[120px]" />

      {/* Liseré « par avion » : hachures diagonales brand/blanc en tête de section. */}
      <div
        className="absolute inset-x-0 top-0 h-1.5 opacity-70"
        style={{
          background:
            "repeating-linear-gradient(-45deg, var(--brand) 0 14px, transparent 14px 28px, rgba(255,255,255,0.75) 28px 42px, transparent 42px 56px)",
        }}
      />

      {/* Vagues d'oblitération géantes, en dérive lente (dash-flow). */}
      <svg className="absolute -left-24 bottom-6 h-72 w-[52rem] text-white/[0.05]" viewBox="0 0 840 280" fill="none">
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M 0 ${60 + i * 52} q 105 -44 210 0 t 210 0 t 210 0 t 210 0`}
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray="64 64"
            className="anim-dash motion-reduce:animate-none"
            style={{ animationDuration: `${9 + i * 2.5}s` }}
          />
        ))}
      </svg>

      {/* Cachets fantômes : cercles d'oblitération en filigrane. */}
      <svg className="absolute -right-10 top-16 size-56 text-white/[0.06] motion-safe:animate-[spin-slow_80s_linear_infinite]" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="50" cy="50" r="34" stroke="currentColor" strokeWidth="1" strokeDasharray="3 5" />
        <text style={{ font: "700 8.5px monospace", letterSpacing: "0.34em" }} className="fill-current">
          <textPath href="#pm-cachet" startOffset="0%">
            COURRIER SUIVI · PREUVE DE DÉPÔT · BLEME ·
          </textPath>
        </text>
        <defs>
          <path id="pm-cachet" d="M 50 10.5 a 39.5 39.5 0 1 1 -0.01 0" />
        </defs>
      </svg>
      <svg className="absolute left-[12%] top-8 size-24 rotate-12 text-white/[0.045]" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="50" cy="50" r="33" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
      </svg>

      {/* Trajectoire de vol + enveloppe voyageuse (l'oiseau de la section). */}
      <svg className="absolute inset-x-0 top-0 hidden h-[420px] w-full lg:block" viewBox="0 0 1440 420" fill="none" preserveAspectRatio="xMidYMin slice">
        <path d={FLIGHT} stroke="url(#pm-flight)" strokeWidth="1.6" strokeDasharray="2 9" strokeLinecap="round" />
        <defs>
          <linearGradient id="pm-flight" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--brand)" stopOpacity="0" />
            <stop offset="0.25" stopColor="var(--brand)" stopOpacity="0.5" />
            <stop offset="0.75" stopColor="var(--brand)" stopOpacity="0.5" />
            <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="motion-reduce:hidden">
          {/* L'enveloppe suit la trajectoire, orientée dans le sens du vol. */}
          <g>
            <animateMotion dur="16s" repeatCount="indefinite" rotate="auto" keyPoints="0;1" keyTimes="0;1" calcMode="linear" path={FLIGHT} />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.06;0.94;1" dur="16s" repeatCount="indefinite" />
            <g transform="translate(-11, -8)">
              <rect width="22" height="15" rx="2.5" fill="var(--brand)" opacity="0.9" />
              <path d="M 1.5 3 L 11 9.5 L 20.5 3" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>
          {/* Impulsion qui remonte la trajectoire derrière l'enveloppe. */}
          <circle r="2.2" fill="var(--brand)">
            <animateMotion dur="16s" begin="1.1s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear" path={FLIGHT} />
            <animate attributeName="opacity" values="0;0.5;0.5;0" keyTimes="0;0.08;0.92;1" dur="16s" begin="1.1s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>
    </div>
  );
}

export function PaperMail() {
  return (
    <section id="papier" className="relative overflow-hidden bg-ink text-ink-foreground">
      <PostalBackdrop />

      <div className="relative mx-auto max-w-6xl px-6 py-24 lg:py-32">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
              Envoi postal réel
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              De vraies lettres. Pas seulement des emails.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-muted">
              Une mise en demeure ou un recours pèse sur papier. Vous validez à
              l’écran — BLEME imprime, met sous pli et poste pour vous, en lettre
              suivie ou en recommandé avec accusé de réception.
            </p>
          </div>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-10">
          {/* L'enveloppe. */}
          <Reveal className="lg:col-span-7">
            <Envelope />
          </Reveal>

          {/* Le suivi réel, jusqu'à l'AR signé. */}
          <div className="lg:col-span-5">
            <RevealStagger className="relative flex flex-col gap-7">
              {/* Ligne verticale qui se dessine au scroll. */}
              <div aria-hidden className="anim-draw-line absolute bottom-6 left-[17px] top-2 w-px bg-gradient-to-b from-brand/60 via-ink-foreground/25 to-emerald-400/70" />
              {SUIVI.map((s) => (
                <RevealItem key={s.titre}>
                  <div className="relative flex items-start gap-4 pl-0.5">
                    <span
                      className={`relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-ink ${
                        s.emerald ? "bg-emerald-400 text-emerald-950" : "bg-white/10 text-ink-foreground"
                      }`}
                    >
                      <s.icon className="size-4" />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="flex flex-wrap items-baseline gap-x-2.5 font-semibold">
                        {s.titre}
                        <span className="text-xs font-normal text-ink-muted">{s.quand}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-ink-muted">{s.detail}</p>
                    </div>
                  </div>
                </RevealItem>
              ))}
              <RevealItem>
                <div className="ml-12 flex items-start gap-2.5 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                  <Paperclip className="mt-0.5 size-4 shrink-0 text-brand" />
                  <p className="text-sm leading-relaxed text-ink-foreground/85">
                    Le carton AR signé revient <span className="font-semibold">numérisé dans la
                    chronologie du dossier</span> — la preuve de réception est là, datée,
                    prête à être exportée.
                  </p>
                </div>
              </RevealItem>
            </RevealStagger>
          </div>
        </div>

        {/* Réassurance factuelle. */}
        <Reveal>
          <div className="mx-auto mt-16 flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-ink-muted">
            <span className="flex items-center gap-2">
              <PenLine className="size-4 text-brand" />
              Rien ne part sans votre validation, preuve hachée
            </span>
            <span className="flex items-center gap-2">
              <Printer className="size-4 text-brand" />
              Impression, pli, affranchissement : on s’en charge
            </span>
            <span className="flex items-center gap-2">
              <BadgeCheck className="size-4 text-brand" />
              Lettre suivie 5 € HT · Recommandé AR 10 € HT
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
