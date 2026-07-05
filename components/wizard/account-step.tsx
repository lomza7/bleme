"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Check,
  FileText,
  Mic,
  ShieldQuestion,
  User,
} from "lucide-react";
import { KIND_META, type WizardData } from "@/components/wizard/types";

const EASE = [0.16, 1, 0.3, 1] as const;

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function AccountStep({ data }: { data: WizardData }) {
  const reduce = useReducedMotion();

  // Brouillon local : sera rattaché au dossier une fois le compte créé (T4).
  useEffect(() => {
    try {
      localStorage.setItem(
        "bleme.draft",
        JSON.stringify({ ...data, savedAt: new Date().toISOString() }),
      );
    } catch {
      // stockage indisponible (navigation privée) : tant pis, non bloquant
    }
  }, [data]);

  const kindLabel = data.kind ? KIND_META[data.kind].label : "";
  const items = [
    {
      icon: User,
      label:
        data.kind === "unpaid"
          ? `${kindLabel} · ${data.partyName}${data.amount ? ` · ${data.amount} €` : ""}`
          : `${kindLabel} · ${data.partyName}`,
      sub: data.kind === "unpaid" ? data.age : `${data.subject} · ${data.stage}`,
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
      <p className="mt-3 max-w-xl text-ink-muted">
        Voilà ce que BLEME a déjà entre les mains, et ce qui se passera dès
        l’ouverture du dossier.
      </p>

      <div className="mt-9 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <motion.ul
          initial={reduce ? false : "hidden"}
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
          }}
          className="flex flex-col gap-3 lg:col-span-3"
        >
          {items.map((item) => (
            <motion.li
              key={item.label}
              variants={{
                hidden: { opacity: 0, x: -18 },
                visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE } },
              }}
              className="flex items-start gap-4 rounded-[1.75rem] bg-white/[0.05] px-6 py-5 ring-1 ring-white/10"
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                <item.icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{item.label}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{item.sub}</p>
              </div>
            </motion.li>
          ))}
        </motion.ul>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease: EASE }}
          className="rounded-[1.75rem] bg-white/[0.05] px-6 py-5 ring-1 ring-white/10 lg:col-span-2"
        >
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
            Dès l’ouverture
          </p>
          <ul className="mt-4 space-y-3">
            {plan.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-ink-foreground/85">
                <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                {p}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
        className="mt-8 rounded-[1.75rem] bg-brand/10 p-7 ring-1 ring-brand/30"
      >
        <p className="font-semibold">
          Créez votre compte pour ouvrir le dossier.
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          Une minute avec votre email, et c’est gratuit : le dossier se
          prépare sans payer. Vous ne réglez que quand les courriers partent,
          à partir de 19 € HT le dossier.
        </p>
        <Link
          href="/signup?next=/app"
          className="group mt-5 inline-flex w-max items-center gap-3 rounded-full bg-brand py-2.5 pl-6 pr-2.5 text-[15px] font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
        >
          Créer mon compte et ouvrir le dossier
          <span className="flex size-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ease-fluid group-hover:translate-x-0.5">
            <ArrowRight className="size-4" />
          </span>
        </Link>
        <p className="mt-4 text-xs text-ink-muted/70">
          Ce que vous venez de saisir est gardé sur votre appareil et sera
          rattaché à votre dossier après la création du compte.
        </p>
      </motion.div>
    </div>
  );
}
