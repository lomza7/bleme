"use client";

import { useActionState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, CircleAlert, FileText, LoaderCircle, Mic, ShieldQuestion, User } from "lucide-react";
import { KIND_META, type WizardData } from "@/components/wizard/types";
import { createCaseFromDraft } from "@/lib/cases/actions";

const EASE = [0.16, 1, 0.3, 1] as const;

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Étape finale pour un utilisateur DÉJÀ CONNECTÉ : récap + création directe du
 * dossier (createCaseFromDraft redirige vers le dossier). Aucune étape compte,
 * aucun passage par /signup → la session est préservée. Design clair, cohérent
 * avec les pages dossier.
 */
export function CreateStep({ data }: { data: WizardData }) {
  const reduce = useReducedMotion();
  const [state, action, pending] = useActionState(createCaseFromDraft, {});

  const kindLabel = data.kind ? KIND_META[data.kind].label : "";
  const items = [
    {
      icon: User,
      label:
        data.kind === "unpaid"
          ? `${kindLabel} · ${data.partyName}${data.amount ? ` · ${data.amount} €` : ""}`
          : `${kindLabel} · ${data.partyName}`,
      sub: data.kind === "unpaid" ? data.age : `${data.subject}${data.stage ? ` · ${data.stage}` : ""}`,
    },
    {
      icon: data.storyMode === "voice" ? Mic : FileText,
      label:
        data.storyMode === "voice"
          ? `Récit vocal enregistré · ${fmt(data.storySeconds)}`
          : "Récit écrit enregistré",
      sub: "L’IA en tirera les faits, les dates et la chronologie",
    },
    {
      icon: ShieldQuestion,
      label: "Points de vigilance anticipés",
      sub: "La réponse d’en face est déjà dans le dossier",
    },
  ];

  const plan =
    data.kind === "unpaid"
      ? ["Relance cordiale dès l’ouverture", "Relance ferme à J+7", "Mise en demeure prête à J+15"]
      : [
          "Analyse des preuves et chronologie",
          "Points de vigilance et pièces à réunir",
          "Réponse circonstanciée en brouillon",
        ];

  return (
    <div className="flex flex-1 flex-col justify-center py-4">
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="flex size-12 items-center justify-center rounded-full bg-brand text-brand-foreground"
      >
        <Check className="size-6" />
      </motion.div>
      <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
        Votre dossier est prêt à être créé.
      </h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        Voilà ce que BLEME a déjà entre les mains. À la création, votre dossier
        s’ouvre et les agents se mettent au travail.
      </p>

      <div className="mt-9 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <ul className="flex flex-col gap-3 lg:col-span-3">
          {items.map((item) => (
            <li
              key={item.label}
              className="flex items-start gap-4 rounded-[1.75rem] border bg-card px-6 py-5"
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                <item.icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{item.label}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.sub}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="rounded-[1.75rem] border bg-brand-soft/50 px-6 py-5 ring-1 ring-brand/20 lg:col-span-2">
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand-strong">
            Dès l’ouverture
          </p>
          <ul className="mt-4 space-y-3">
            {plan.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-brand-strong" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <form action={action} className="mt-8 flex flex-col gap-3">
        <input type="hidden" name="draft" value={JSON.stringify(data)} />
        <button
          type="submit"
          disabled={pending}
          className="group inline-flex w-max items-center gap-3 rounded-full bg-brand py-3 pl-6 pr-2.5 text-[15px] font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? "Création du dossier…" : "Créer le dossier"}
          <span className="flex size-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ease-fluid group-hover:translate-x-0.5">
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          </span>
        </button>
        {state.error ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-red-600">
            <CircleAlert className="size-4 shrink-0" />
            {state.error}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Rien n’est envoyé sans votre validation. Vous pourrez tout corriger dans le dossier.
        </p>
      </form>
    </div>
  );
}
