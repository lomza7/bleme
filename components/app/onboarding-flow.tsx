"use client";

import { useActionState, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CircleAlert,
  LoaderCircle,
  Mail,
  Search,
} from "lucide-react";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";
import { CompanySearch } from "@/components/app/company-search";
import { completeOnboarding, type OnboardingState } from "@/lib/onboarding/actions";

/*
 * Onboarding /bienvenue — une question par écran, plein écran, animé.
 * Objectif produit : remplir un maximum d'informations utiles à la suite
 * (fiche société officielle via Pappers, identité, expéditeur des courriers)
 * et alimenter les stats (rôle, canal d'acquisition). Tout est passable,
 * rien ne bloque : mieux vaut un onboarding fini qu'un formulaire complet.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

const ROLES = [
  { value: "dirigeant", label: "Dirigeant·e" },
  { value: "artisan", label: "Artisan" },
  { value: "independant", label: "Indépendant·e / freelance" },
  { value: "comptable", label: "Comptable / gestion" },
  { value: "assistant", label: "Assistant·e / ADV" },
  { value: "autre", label: "Autre" },
] as const;

const SOURCES = [
  { value: "bouche_a_oreille", label: "Bouche-à-oreille" },
  { value: "google", label: "Google / recherche" },
  { value: "reseaux", label: "Réseaux sociaux" },
  { value: "comptable", label: "Mon comptable" },
  { value: "presse", label: "Presse / article" },
  { value: "pub", label: "Publicité" },
  { value: "autre", label: "Autre" },
] as const;

const SENDER_MODES = [
  {
    value: "company",
    label: "Au nom de ma société",
    desc: "Les courriers sont signés de la raison sociale — le plus courant.",
  },
  {
    value: "personal",
    label: "En mon nom propre",
    desc: "Vous signez personnellement (entreprise individuelle, micro…).",
  },
  {
    value: "third_party",
    label: "Pour le compte d’un tiers",
    desc: "Vous gérez les dossiers d’un client ou d’une autre structure.",
  },
] as const;

type Draft = {
  firstName: string;
  lastName: string;
  roleTitle: string;
  companyName: string;
  companySiren: string | null;
  companyLegalForm: string;
  companyAddress: string;
  companyPostalCode: string;
  companyCity: string;
  senderMode: string;
  senderThirdParty: string;
  acquisitionSource: string;
  acquisitionDetail: string;
};

// L'équipe, présentée un agent à la fois (étape « rencontre »). Registre
// non-juridique : ce qu'ils FONT, jamais de promesse de résultat.
const AGENTS = [
  {
    key: "marius",
    prenom: "Marius",
    role: "Agent Impayés",
    pitch:
      "Il rédige vos relances et mises en demeure, calibrées cran par cran — cordiale, ferme, puis solennelle. Rien ne part sans votre validation.",
  },
  {
    key: "nora",
    prenom: "Nora",
    role: "Agente Preuves",
    pitch:
      "Elle lit chaque pièce que vous déposez — factures, photos, emails — la classe, et en extrait les montants, dates et parties. Vous corrigez, elle retient.",
  },
  {
    key: "lena",
    prenom: "Léna",
    role: "Agente Litiges",
    pitch:
      "Quand un client conteste, elle démonte la réclamation point par point et prépare une réponse adossée à vos pièces, grief par grief.",
  },
  {
    key: "jeanne",
    prenom: "Jeanne",
    role: "Agente Avocat du diable",
    pitch:
      "Elle lit votre dossier avec les yeux d'en face : ses questions débusquent ce qui manque avant que la partie adverse ne s'en serve.",
  },
  {
    key: "sacha",
    prenom: "Sacha",
    role: "Agent Vigie",
    pitch:
      "Il tient le contexte de chaque dossier à jour — daté, horodaté, opposable — et surveille les échéances pour que rien ne dorme.",
  },
  {
    key: "basile",
    prenom: "Basile",
    role: "Agent Démarches & recours",
    pitch:
      "Face à une administration, il monte la démarche : le bon interlocuteur, le bon courrier, les bonnes références — et le suivi des délais.",
  },
] as const;

const inputCls =
  "w-full rounded-2xl border bg-background px-4 py-3 text-[15px] outline-none transition-colors focus:border-brand";

function Pills({
  options,
  value,
  onChange,
}: {
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={
            value === o.value
              ? "rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground"
              : "rounded-full border bg-background px-4 py-2 text-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/60 hover:bg-brand-soft/50"
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function OnboardingFlow({
  defaultFirstName,
  defaultLastName,
  defaultCompanyName,
}: {
  defaultFirstName: string;
  defaultLastName: string;
  defaultCompanyName: string;
}) {
  const reduce = useReducedMotion();
  // 0 accueil · 1 équipe · 2 vous · 3 société · 4 courriers · 5 connu · 6 fin
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [agentIdx, setAgentIdx] = useState(0);
  const [manualCompany, setManualCompany] = useState(false);
  const [d, setD] = useState<Draft>({
    firstName: defaultFirstName,
    lastName: defaultLastName,
    roleTitle: "",
    companyName: defaultCompanyName,
    companySiren: null,
    companyLegalForm: "",
    companyAddress: "",
    companyPostalCode: "",
    companyCity: "",
    senderMode: "company",
    senderThirdParty: "",
    acquisitionSource: "",
    acquisitionDetail: "",
  });
  const [state, action, pending] = useActionState(completeOnboarding, {} as OnboardingState);
  const patch = (p: Partial<Draft>) => setD((prev) => ({ ...prev, ...p }));

  const TOTAL = 4; // étapes questionnées (hors accueil / équipe / fin)
  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(Math.min(Math.max(0, n), 6));
  };

  const canNext = useMemo(() => {
    if (step === 2) return d.firstName.trim().length > 0;
    if (step === 3) return d.companyName.trim().length > 0;
    return true;
  }, [step, d]);

  const agent = AGENTS[agentIdx];
  const lastAgent = agentIdx === AGENTS.length - 1;

  const screens = [
    // ── 0 · Accueil ───────────────────────────────────────────────────────────
    <div key="hello" className="text-center">
      <div className="flex justify-center gap-1.5">
        {AGENTS.map((a, i) => (
          <motion.span
            key={a.key}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : 0.15 + i * 0.08 }}
            className="flex size-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-brand-soft to-brand/15 ring-1 ring-brand/25 sm:size-14"
          >
            <SpriteAvatar src={`/agents/${a.key}.webp`} alt="" className="h-9 sm:h-11" delay={i * 0.35} />
          </motion.span>
        ))}
      </div>
      <motion.h1
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: reduce ? 0 : 0.5 }}
        className="mt-8 text-3xl font-bold tracking-tight sm:text-4xl"
      >
        Bienvenue chez BLEME.
      </motion.h1>
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: reduce ? 0 : 0.65 }}
        className="mx-auto mt-3 max-w-md text-muted-foreground"
      >
        Vos agents sont prêts. Deux minutes pour faire connaissance — chaque
        réponse rend vos futurs courriers plus justes.
      </motion.p>
      <motion.button
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: reduce ? 0 : 0.8 }}
        type="button"
        onClick={() => go(1)}
        className="group mt-9 inline-flex items-center gap-3 rounded-full bg-brand py-3 pl-7 pr-3 text-[15px] font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
      >
        C’est parti
        <span className="flex size-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ease-fluid group-hover:translate-x-0.5">
          <ArrowRight className="size-4" />
        </span>
      </motion.button>
    </div>,

    // ── 1 · Votre équipe : les 6 agents, projecteur un par un ─────────────────
    <div key="team" className="text-center">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Votre équipe</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Six agents, chacun son métier. Faites connaissance — {agentIdx + 1} sur {AGENTS.length}.
      </p>

      {/* La rangée : l'agent présenté est en pleine lumière, les autres en retrait. */}
      <div className="mt-8 flex items-end justify-center gap-2 sm:gap-2.5">
        {AGENTS.map((a, i) => {
          const active = i === agentIdx;
          return (
            <motion.button
              key={a.key}
              type="button"
              onClick={() => {
                setAgentIdx(i);
              }}
              aria-label={`${a.prenom} · ${a.role}`}
              animate={
                reduce
                  ? undefined
                  : {
                      scale: active ? 1.22 : 1,
                      y: active ? -6 : 0,
                      opacity: active ? 1 : 0.45,
                      filter: active ? "grayscale(0)" : "grayscale(0.7)",
                    }
              }
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className={`flex size-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-brand-soft to-brand/15 transition-shadow sm:size-14 ${
                active ? "ring-2 ring-brand shadow-lg shadow-brand/20" : "ring-1 ring-brand/20"
              }`}
            >
              <SpriteAvatar src={`/agents/${a.key}.webp`} alt="" className="h-9 sm:h-11" delay={i * 0.3} />
            </motion.button>
          );
        })}
      </div>

      {/* La fiche de l'agent sous le projecteur */}
      <div className="mx-auto mt-7 max-w-md">
        <AnimatePresence mode="wait">
          <motion.div
            key={agent.key}
            initial={reduce ? false : { opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="rounded-[1.75rem] border border-brand/20 bg-gradient-to-b from-brand-soft/60 to-card p-6 text-left"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-brand-soft to-brand/15 ring-1 ring-brand/25">
                <SpriteAvatar src={`/agents/${agent.key}.webp`} alt="" className="h-10" />
              </span>
              <div>
                <p className="font-semibold">{agent.prenom}</p>
                <p className="text-xs font-medium uppercase tracking-wide text-brand-strong">{agent.role}</p>
              </div>
            </div>
            <p className="mt-3.5 text-sm leading-relaxed text-muted-foreground">{agent.pitch}</p>
          </motion.div>
        </AnimatePresence>

        {/* Points de progression de la rencontre */}
        <div className="mt-5 flex justify-center gap-1.5">
          {AGENTS.map((a, i) => (
            <span
              key={a.key}
              className={`size-1.5 rounded-full transition-colors duration-300 ${
                i === agentIdx ? "bg-brand" : i < agentIdx ? "bg-brand/40" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => (lastAgent ? go(2) : setAgentIdx(agentIdx + 1))}
            className="group inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98]"
          >
            {lastAgent ? "Faisons connaissance" : "Suivant"}
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
        </div>
        {!lastAgent ? (
          <button
            type="button"
            onClick={() => go(2)}
            className="mt-3 text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
          >
            Passer les présentations
          </button>
        ) : null}
      </div>
    </div>,

    // ── 2 · Vous ──────────────────────────────────────────────────────────────
    <div key="you">
      <p className="text-sm font-medium text-brand-strong">1 / {TOTAL}</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Qui êtes-vous ?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Votre nom apparaîtra sur vos courriers et signatures.
      </p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Prénom</span>
          <input
            autoFocus
            className={inputCls}
            value={d.firstName}
            onChange={(e) => patch({ firstName: e.target.value })}
            placeholder="Camille"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Nom</span>
          <input
            className={inputCls}
            value={d.lastName}
            onChange={(e) => patch({ lastName: e.target.value })}
            placeholder="Durand"
          />
        </label>
      </div>
      <div className="mt-6 flex flex-col gap-2.5">
        <span className="text-sm font-medium">Votre rôle</span>
        <Pills options={ROLES} value={d.roleTitle} onChange={(roleTitle) => patch({ roleTitle })} />
      </div>
    </div>,

    // ── 3 · Votre société ─────────────────────────────────────────────────────
    <div key="company">
      <p className="text-sm font-medium text-brand-strong">2 / {TOTAL}</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Votre société</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        On récupère sa fiche officielle (adresse, forme juridique) — vos courriers partent avec les bonnes mentions.
      </p>
      {!manualCompany ? (
        <div className="mt-7">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Search className="size-4 text-brand-strong" />
            Cherchez-la par son nom ou son SIREN
          </div>
          <div className="mt-2.5">
            <CompanySearch
              value={d.companyName}
              placeholder="Ex. Martin Rénovation, 90312345…"
              onChange={({ name, siren }) => patch({ companyName: name, companySiren: siren })}
            />
          </div>
          {d.companySiren ? (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200"
            >
              <Building2 className="size-5 shrink-0 text-emerald-700" />
              <p className="text-sm text-emerald-900">
                <span className="font-semibold">{d.companyName}</span>
                <span className="text-emerald-700"> · SIREN {d.companySiren} — la fiche officielle sera rattachée à votre espace.</span>
              </p>
            </motion.div>
          ) : null}
          <button
            type="button"
            onClick={() => setManualCompany(true)}
            className="mt-4 text-sm font-medium text-brand-strong underline-offset-4 hover:underline"
          >
            Je ne la trouve pas — je remplis moi-même
          </button>
        </div>
      ) : (
        <div className="mt-7 grid gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Nom de la société</span>
            <input autoFocus className={inputCls} value={d.companyName} onChange={(e) => patch({ companyName: e.target.value, companySiren: null })} placeholder="Martin Rénovation" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Forme juridique <span className="font-normal text-muted-foreground">(optionnel)</span></span>
              <input className={inputCls} value={d.companyLegalForm} onChange={(e) => patch({ companyLegalForm: e.target.value })} placeholder="SARL, EI, SASU…" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Adresse</span>
              <input className={inputCls} value={d.companyAddress} onChange={(e) => patch({ companyAddress: e.target.value })} placeholder="12 rue des Artisans" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Code postal</span>
              <input className={inputCls} value={d.companyPostalCode} onChange={(e) => patch({ companyPostalCode: e.target.value })} placeholder="69001" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Ville</span>
              <input className={inputCls} value={d.companyCity} onChange={(e) => patch({ companyCity: e.target.value })} placeholder="Lyon" />
            </label>
          </div>
          <button
            type="button"
            onClick={() => setManualCompany(false)}
            className="w-max text-sm font-medium text-brand-strong underline-offset-4 hover:underline"
          >
            ← Revenir à la recherche
          </button>
        </div>
      )}
    </div>,

    // ── 4 · Vos courriers ─────────────────────────────────────────────────────
    <div key="sender">
      <p className="text-sm font-medium text-brand-strong">3 / {TOTAL}</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        Au nom de qui partent vos courriers ?
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Relances et mises en demeure seront signées en conséquence. Modifiable à tout moment.
      </p>
      <div className="mt-7 grid gap-3">
        {SENDER_MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => patch({ senderMode: m.value })}
            className={`flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-all duration-300 ${
              d.senderMode === m.value
                ? "border-brand bg-brand-soft/60 ring-1 ring-brand"
                : "bg-background hover:-translate-y-0.5 hover:border-brand/50"
            }`}
          >
            <span
              className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                d.senderMode === m.value ? "border-brand bg-brand text-brand-foreground" : "border-muted-foreground/40"
              }`}
            >
              {d.senderMode === m.value ? <Check className="size-3" /> : null}
            </span>
            <span>
              <span className="block text-sm font-semibold">{m.label}</span>
              <span className="mt-0.5 block text-[13px] text-muted-foreground">{m.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <AnimatePresence>
        {d.senderMode === "third_party" ? (
          <motion.label
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="mt-4 flex flex-col gap-1.5 overflow-hidden"
          >
            <span className="text-sm font-medium">Pour le compte de qui ?</span>
            <input
              className={inputCls}
              value={d.senderThirdParty}
              onChange={(e) => patch({ senderThirdParty: e.target.value })}
              placeholder="Nom de la société ou de la personne mandante"
            />
          </motion.label>
        ) : null}
      </AnimatePresence>
    </div>,

    // ── 5 · Comment nous avez-vous connus ? ───────────────────────────────────
    <div key="source">
      <p className="text-sm font-medium text-brand-strong">4 / {TOTAL}</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        Comment nous avez-vous connus ?
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Trente secondes qui nous aident énormément. Promis.</p>
      <div className="mt-7">
        <Pills
          options={SOURCES}
          value={d.acquisitionSource}
          onChange={(acquisitionSource) => patch({ acquisitionSource })}
        />
      </div>
      <AnimatePresence>
        {d.acquisitionSource === "autre" || d.acquisitionSource === "reseaux" ? (
          <motion.label
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="mt-4 flex flex-col gap-1.5 overflow-hidden"
          >
            <span className="text-sm font-medium">
              {d.acquisitionSource === "reseaux" ? "Lequel ?" : "Dites-nous en plus"}
            </span>
            <input
              className={inputCls}
              value={d.acquisitionDetail}
              onChange={(e) => patch({ acquisitionDetail: e.target.value })}
              placeholder={d.acquisitionSource === "reseaux" ? "LinkedIn, Instagram, TikTok…" : "Un événement, un article, un ami…"}
            />
          </motion.label>
        ) : null}
      </AnimatePresence>
    </div>,

    // ── 6 · Fin ───────────────────────────────────────────────────────────────
    <div key="done" className="text-center">
      <motion.span
        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand text-brand-foreground"
      >
        <Check className="size-8" />
      </motion.span>
      <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
        {d.firstName ? `Merci ${d.firstName} !` : "Merci !"}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-muted-foreground">
        Votre espace est configuré{d.companySiren ? " — la fiche officielle de votre société est en cours de rattachement" : ""}.
        Créez votre premier blème quand vous voulez.
      </p>
      <form action={action} className="mt-8">
        <input type="hidden" name="payload" value={JSON.stringify(d)} />
        <button
          type="submit"
          disabled={pending}
          className="group inline-flex items-center gap-3 rounded-full bg-brand py-3 pl-7 pr-3 text-[15px] font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Entrer dans mon espace
          <span className="flex size-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ease-fluid group-hover:translate-x-0.5">
            <ArrowRight className="size-4" />
          </span>
        </button>
        {state.error ? (
          <p role="alert" className="mt-4 flex items-center justify-center gap-2 text-sm text-red-600">
            <CircleAlert className="size-4 shrink-0" />
            {state.error}
          </p>
        ) : null}
      </form>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Mail className="size-3.5" />
        Une adresse dédiée à vos dossiers vous attend aussi dans la Boîte de réception.
      </p>
    </div>,
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-brand-soft/50 via-background to-background">
      {/* Progression */}
      <div className="mx-auto flex w-full max-w-xl items-center gap-2 px-6 pt-8">
        <span className="text-sm font-bold tracking-tight">BLEME<span className="text-brand">.</span></span>
        {step > 1 && step < 6 ? (
          <div className="ml-4 flex flex-1 gap-1.5">
            {Array.from({ length: TOTAL }, (_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i < step - 1 ? "bg-brand" : "bg-muted"}`}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Écran courant */}
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-10">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={reduce ? false : { opacity: 0, y: 24, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? undefined : { opacity: 0, y: -16, filter: "blur(4px)" }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            {screens[step]}
          </motion.div>
        </AnimatePresence>

        {/* Navigation (accueil, équipe et fin ont leurs propres boutons) */}
        {step > 1 && step < 6 ? (
          <div className="mt-9 flex items-center justify-between">
            <button
              type="button"
              onClick={() => go(step - 1)}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Retour
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => canNext && go(step + 1)}
              className="group inline-flex items-center gap-2 rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-ink-soft active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            >
              Continuer
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
