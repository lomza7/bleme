import {
  ArrowRight,
  FileCheck2,
  FileText,
  Image as ImageIcon,
  Inbox,
  Mail,
  Send,
  ShieldQuestion,
  Sparkles,
} from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

/*
 * « Votre premier dossier en 15 minutes » : cartes empilées au scroll
 * (position: sticky, zéro JS). Chaque carte suit le même dossier fictif
 * que le hero (SARL Bâti Concept, 2 400 €). Les visuels sont de vrais
 * fragments d'UI du produit, pas des captures simulées.
 */

const TOPS = ["lg:top-24", "lg:top-28", "lg:top-32", "lg:top-36"];

export function HowItWorks() {
  return (
    <section id="comment" className="border-y bg-muted/40">
      <div className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24 lg:py-32">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Votre premier dossier en 15 minutes.
          </h2>
          <p className="mt-3 max-w-xl text-lg text-muted-foreground">
            Suivez le dossier Bâti Concept, 2 400 € impayés depuis 47 jours.
          </p>
        </Reveal>

        <ol className="mt-14 flex flex-col gap-6">
          <StepCard index={0} skin="ink" titre="Racontez" texte="Deux à cinq minutes à l’oral, comme à un ami. L’IA vous pose deux ou trois questions, y compris celle qui fâche. Un dossier solide a anticipé la réponse d’en face.">
            <VisuelRecit />
          </StepCard>

          <StepCard index={1} skin="light" titre="Ajoutez vos preuves" texte="Photos, PDF, emails transférés : tout est reconnu, daté, classé. Chaque dossier a sa propre adresse email, transférez-y n’importe quel échange, il se range tout seul.">
            <VisuelPreuves />
          </StepCard>

          <StepCard index={2} skin="brand" titre="Validez" texte="Le courrier est déjà écrit, avec les bons montants et les bonnes références. Vous relisez, vous cliquez, il part en votre nom. Jamais rien ne s’envoie sans vous.">
            <VisuelCourrier />
          </StepCard>

          <StepCard index={3} skin="light" titre="Laissez tourner" texte="Les relances s’enchaînent au bon rythme, chaque réponse est analysée et la suite proposée. Vous êtes prévenu quand une décision vous revient.">
            <VisuelSuivi />
          </StepCard>
        </ol>
      </div>
    </section>
  );
}

function StepCard({
  index,
  skin,
  titre,
  texte,
  children,
}: {
  index: number;
  skin: "ink" | "light" | "brand";
  titre: string;
  texte: string;
  children: React.ReactNode;
}) {
  const skins = {
    ink: "bg-ink text-ink-foreground",
    light: "border bg-card text-foreground",
    brand: "bg-brand text-brand-foreground",
  };
  const muted = {
    ink: "text-ink-muted",
    light: "text-muted-foreground",
    brand: "text-brand-foreground/80",
  };
  const numero = {
    ink: "text-brand",
    light: "text-brand",
    brand: "text-brand-foreground/70",
  };
  return (
    <li className={`sticky top-20 ${TOPS[index]}`}>
      <div
        className={`grid min-h-[24rem] grid-cols-1 items-center gap-10 rounded-[2rem] p-8 shadow-xl shadow-zinc-950/[0.08] sm:p-12 lg:grid-cols-2 ${skins[skin]}`}
      >
        <div>
          <span className={`font-mono text-sm ${numero[skin]}`}>
            0{index + 1} / 04
          </span>
          <h3 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            {titre}
          </h3>
          <p className={`mt-4 max-w-[52ch] text-[15px] leading-relaxed sm:text-base ${muted[skin]}`}>
            {texte}
          </p>
        </div>
        <div className="lg:justify-self-end lg:w-full lg:max-w-md">{children}</div>
      </div>
    </li>
  );
}

/* ── Visuels : fragments réels de l'UI produit ────────────────────────────── */

// Hauteurs figées : un rendu aléatoire casserait l'hydratation.
const WAVE = [30, 55, 80, 45, 95, 65, 100, 70, 40, 85, 55, 90, 60, 35, 75, 50, 88, 42, 68, 32];

function VisuelRecit() {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-3xl bg-white/[0.07] p-5 ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2.5">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
            </span>
            <span className="font-mono text-lg font-semibold tabular-nums">3:24</span>
          </span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-ink-foreground/80">
            Zone idéale atteinte
          </span>
        </div>
        <div className="mt-4 flex h-12 items-center gap-[3px]">
          {WAVE.map((h, i) => (
            <span
              key={i}
              className="w-full rounded-full bg-brand/70"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-3xl bg-white/[0.07] p-5 ring-1 ring-white/10">
        <ShieldQuestion className="mt-0.5 size-5 shrink-0 text-brand" />
        <p className="text-sm leading-relaxed text-ink-foreground/90">
          « Qu’est-ce que Bâti Concept pourrait répondre pour ne pas payer ? »
        </p>
      </div>
    </div>
  );
}

function VisuelPreuves() {
  const docs = [
    { icon: FileText, nom: "Facture F-2026-042.pdf", chip: "2 400 € · reconnue" },
    { icon: FileCheck2, nom: "Devis signé.pdf", chip: "classé" },
    { icon: ImageIcon, nom: "Fin de chantier.heic", chip: "datée 28 mai" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-full border bg-muted/60 px-4 py-2.5">
        <Mail className="size-4 shrink-0 text-brand" />
        <span className="truncate font-mono text-[13px] text-muted-foreground">
          d-8f3k2@dossiers.bleme.fr
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {docs.map((d) => (
          <li
            key={d.nom}
            className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3"
          >
            <span className="flex min-w-0 items-center gap-3">
              <d.icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium">{d.nom}</span>
            </span>
            <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand-strong">
              {d.chip}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VisuelCourrier() {
  return (
    <div className="rounded-3xl bg-white p-6 text-zinc-900 shadow-lg">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
        Mise en demeure · brouillon
      </p>
      <div className="mt-4 space-y-2.5 text-sm leading-relaxed text-zinc-600">
        <p>
          Montant dû :{" "}
          <mark className="rounded bg-brand-soft px-1 font-semibold text-brand-strong">
            2 400,00 €
          </mark>
        </p>
        <p>
          Facture{" "}
          <mark className="rounded bg-brand-soft px-1 font-semibold text-brand-strong">
            F-2026-042
          </mark>{" "}
          échue le{" "}
          <mark className="rounded bg-brand-soft px-1 font-semibold text-brand-strong">
            15 mai
          </mark>
        </p>
        <p className="text-zinc-400">
          À défaut de règlement sous huit jours, nous nous réservons…
        </p>
      </div>
      <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white">
        J’ai relu, envoyer en mon nom
        <ArrowRight className="size-4" />
      </span>
    </div>
  );
}

function VisuelSuivi() {
  return (
    <ul className="flex flex-col gap-2">
      <li className="flex items-start gap-3 rounded-2xl border bg-card px-4 py-3.5">
        <Send className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span>
          <span className="block text-sm font-medium">Relance ferme envoyée</span>
          <span className="block text-xs text-muted-foreground">lue par le client · il y a 8 j</span>
        </span>
      </li>
      <li className="flex items-start gap-3 rounded-2xl border bg-card px-4 py-3.5">
        <Inbox className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span>
          <span className="block text-sm font-medium">Réponse reçue</span>
          <span className="block text-xs text-muted-foreground">promesse de paiement sous quinzaine · il y a 3 j</span>
        </span>
      </li>
      <li className="flex items-start gap-3 rounded-2xl bg-brand-soft px-4 py-3.5 ring-1 ring-brand/25">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-strong" />
        <span>
          <span className="block text-sm font-medium">Suite proposée</span>
          <span className="block text-xs text-muted-foreground">rappel doux le 12 juillet si rien n’est reçu, à valider</span>
        </span>
      </li>
    </ul>
  );
}
