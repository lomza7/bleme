"use client";

import { useActionState } from "react";
import { CircleAlert, CircleCheck, KeyRound, LockKeyhole, Plug2 } from "lucide-react";
import {
  createVaultPassword,
  setApiKey,
  testAnthropicKey,
  unlockVault,
  type VaultState,
} from "@/lib/admin/secrets-actions";

const INITIAL: VaultState = {};

function Feedback({ state }: { state: VaultState }) {
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

const inputCls =
  "rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand";

export function VaultSetupForm() {
  const [state, action, pending] = useActionState(createVaultPassword, INITIAL);
  return (
    <form action={action} className="flex max-w-sm flex-col gap-3">
      <input
        type="password"
        name="password"
        required
        minLength={10}
        placeholder="Mot de passe du coffre (10 caractères min.)"
        className={inputCls}
        autoComplete="new-password"
      />
      <input
        type="password"
        name="confirm"
        required
        placeholder="Confirmez le mot de passe"
        className={inputCls}
        autoComplete="new-password"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Création…" : "Créer le coffre"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function VaultUnlockForm() {
  const [state, action, pending] = useActionState(unlockVault, INITIAL);
  return (
    <form action={action} className="flex max-w-sm flex-col gap-3">
      <input
        type="password"
        name="password"
        required
        placeholder="Mot de passe du coffre"
        className={inputCls}
        autoComplete="current-password"
        autoFocus
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-ink-soft active:scale-[0.98] disabled:opacity-60"
      >
        <LockKeyhole className="size-4" />
        {pending ? "Vérification…" : "Déverrouiller (15 min)"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function SetKeyForm({
  presetName,
  compact,
}: {
  presetName?: string;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(setApiKey, INITIAL);
  return (
    <form action={action} className={`flex flex-wrap items-center gap-2.5 ${compact ? "" : "mt-2"}`}>
      {presetName ? (
        <input type="hidden" name="name" value={presetName} />
      ) : (
        <input
          name="name"
          required
          placeholder="NOM_DE_LA_CLE"
          className={`${inputCls} w-52 font-mono text-xs uppercase`}
        />
      )}
      <input
        type="password"
        name="value"
        required
        placeholder={presetName ? "Coller la valeur…" : "Valeur de la clé"}
        className={`${inputCls} min-w-48 flex-1 font-mono text-xs`}
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
      >
        <KeyRound className="size-3.5" />
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function TestAnthropicButton() {
  const [state, action, pending] = useActionState(testAnthropicKey, INITIAL);
  return (
    <form action={action} className="flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors hover:border-brand/50 hover:text-brand-strong disabled:opacity-60"
      >
        <Plug2 className="size-3.5" />
        {pending ? "Test…" : "Tester la connexion"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
