"use client";

import { useActionState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import {
  updateOrganization,
  updateProfile,
  type SettingsState,
} from "@/lib/settings/actions";

const INITIAL: SettingsState = {};

const inputClass =
  "w-full rounded-2xl border bg-background px-4 py-3 text-[15px] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand";

function Feedback({ state }: { state: SettingsState }) {
  if (state.error) {
    return (
      <p role="alert" className="flex items-center gap-2 text-sm text-red-600">
        <CircleAlert className="size-4 shrink-0" />
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-emerald-700">
        <CircleCheck className="size-4 shrink-0" />
        {state.success}
      </p>
    );
  }
  return null;
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-max items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
      Enregistrer
    </button>
  );
}

export function ProfileForm({
  fullName,
  phone,
}: {
  fullName: string;
  phone: string;
}) {
  const [state, action, pending] = useActionState(updateProfile, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="fullName" className="text-sm font-medium">
            Votre nom
          </label>
          <input
            id="fullName"
            name="fullName"
            defaultValue={fullName}
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="phone" className="text-sm font-medium">
            Téléphone
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={phone}
            placeholder="06 12 34 56 78"
            className={inputClass}
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <SaveButton pending={pending} />
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function OrganizationForm({
  name,
  siret,
}: {
  name: string;
  siret: string;
}) {
  const [state, action, pending] = useActionState(updateOrganization, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm font-medium">
            Nom de l’entreprise
          </label>
          <input id="name" name="name" defaultValue={name} required className={inputClass} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="siret" className="text-sm font-medium">
            SIRET
          </label>
          <input
            id="siret"
            name="siret"
            defaultValue={siret}
            placeholder="14 chiffres"
            inputMode="numeric"
            className={inputClass}
          />
          <p className="text-xs text-muted-foreground">
            Utilisé dans vos courriers de relance et mises en demeure.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <SaveButton pending={pending} />
        <Feedback state={state} />
      </div>
    </form>
  );
}
