"use client";

import { useState } from "react";
import { ArrowRight, BellRing, Check } from "lucide-react";
import type { WizardData } from "@/components/wizard/types";

const inputClass =
  "w-full rounded-2xl bg-white/[0.06] px-4 py-3.5 text-[15px] text-ink-foreground ring-1 ring-white/10 transition-all duration-300 placeholder:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-brand";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-ink-foreground/90">
        {label}
      </label>
      {children}
    </div>
  );
}

function PillChoice({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={active}
            className={
              active
                ? "rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-all duration-300 ease-fluid active:scale-[0.97]"
                : "rounded-full bg-white/[0.06] px-4 py-2 text-sm text-ink-foreground/80 ring-1 ring-white/10 transition-all duration-300 ease-fluid hover:bg-white/[0.1] active:scale-[0.97]"
            }
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function NextButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group mt-10 inline-flex w-max items-center gap-3 rounded-full bg-brand py-2.5 pl-6 pr-2.5 text-[15px] font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
      <span className="flex size-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ease-fluid group-hover:translate-x-0.5">
        <ArrowRight className="size-4" />
      </span>
    </button>
  );
}

export function DetailsStep({
  data,
  patch,
  onNext,
}: {
  data: WizardData;
  patch: (p: Partial<WizardData>) => void;
  onNext: () => void;
}) {
  if (data.kind === "admin") {
    return <AdminSoon />;
  }

  const isUnpaid = data.kind === "unpaid";
  const ready = isUnpaid
    ? data.partyName.trim() !== "" && data.amount.trim() !== "" && data.age !== ""
    : data.partyName.trim() !== "" && data.subject !== "" && data.stage !== "";

  return (
    <div className="flex flex-1 flex-col justify-center">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        {isUnpaid ? "Les faits, en 30 secondes." : "Le litige, en 30 secondes."}
      </h1>
      <p className="mt-3 text-ink-muted">
        Juste de quoi ouvrir le dossier. Vous raconterez les détails à l’étape
        suivante.
      </p>

      <div className="mt-10 flex max-w-xl flex-col gap-7">
        <Field label={isUnpaid ? "Qui vous doit de l’argent ?" : "Avec qui avez-vous ce litige ?"}>
          <input
            className={inputClass}
            placeholder="Nom de l’entreprise ou du client"
            value={data.partyName}
            onChange={(e) => patch({ partyName: e.target.value })}
            autoFocus
          />
        </Field>

        {isUnpaid ? (
          <>
            <Field label="Combien, environ ?">
              <div className="relative max-w-56">
                <input
                  className={`${inputClass} pr-10`}
                  placeholder="2 400"
                  inputMode="decimal"
                  value={data.amount}
                  onChange={(e) =>
                    patch({ amount: e.target.value.replace(/[^\d\s.,]/g, "") })
                  }
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted">
                  €
                </span>
              </div>
            </Field>
            <Field label="Depuis quand attendez-vous ?">
              <PillChoice
                options={["Moins d’1 mois", "1 à 3 mois", "3 à 6 mois", "Plus de 6 mois"]}
                value={data.age}
                onChange={(age) => patch({ age })}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="À propos de quoi ?">
              <PillChoice
                options={[
                  "Qualité contestée",
                  "Devis ou montant contesté",
                  "Livraison refusée",
                  "Remboursement exigé",
                  "Autre",
                ]}
                value={data.subject}
                onChange={(subject) => patch({ subject })}
              />
            </Field>
            <Field label="Où ça en est ?">
              <PillChoice
                options={[
                  "Simple désaccord",
                  "Courriers échangés",
                  "Menace d’action",
                  "Procédure entamée",
                ]}
                value={data.stage}
                onChange={(stage) => patch({ stage })}
              />
            </Field>
          </>
        )}
      </div>

      <NextButton disabled={!ready} onClick={onNext}>
        Continuer vers mon récit
      </NextButton>
    </div>
  );
}

function AdminSoon() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="flex flex-1 flex-col justify-center">
      <span className="w-max rounded-full bg-brand/90 px-3 py-1 text-xs font-medium text-brand-foreground">
        Bientôt disponible
      </span>
      <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
        Les amendes et démarches arrivent très vite.
      </h1>
      <p className="mt-4 max-w-xl leading-relaxed text-ink-muted">
        Contestation d’amende professionnelle, demande gracieuse aux impôts :
        c’est en construction. Laissez votre email, vous serez parmi les
        premiers prévenus. En attendant, BLEME traite déjà vos impayés et
        litiges clients.
      </p>

      {sent ? (
        <p className="mt-8 inline-flex w-max items-center gap-2 rounded-full bg-white/[0.07] px-5 py-3 text-sm ring-1 ring-white/10">
          <Check className="size-4 text-brand" />
          C’est noté. On vous écrit dès que c’est prêt.
        </p>
      ) : (
        <form
          className="mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.includes("@")) setSent(true);
          }}
        >
          <input
            type="email"
            required
            className={inputClass}
            placeholder="vous@entreprise.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="submit"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
          >
            <BellRing className="size-4" />
            Me prévenir
          </button>
        </form>
      )}
    </div>
  );
}
