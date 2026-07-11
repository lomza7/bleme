"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
  type AuthState,
} from "@/lib/auth/actions";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/auth/fields";

const INITIAL: AuthState = {};

export function LoginForm({ next = "/app" }: { next?: string }) {
  const [state, action] = useActionState(signIn, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormAlert error={state.error} />
      <input type="hidden" name="next" value={next} />
      <Field label="Email" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="vous@entreprise.fr"
          className={inputClass}
        />
      </Field>
      <Field label="Mot de passe" htmlFor="password">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className={inputClass}
        />
        <Link
          href="/mot-de-passe-oublie"
          className="w-max text-xs text-ink-muted transition-colors duration-300 hover:text-ink-foreground"
        >
          Mot de passe oublié ?
        </Link>
      </Field>
      <SubmitButton>Se connecter</SubmitButton>
    </form>
  );
}

export function SignupForm({ next = "/app" }: { next?: string }) {
  const [state, action] = useActionState(signUp, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormAlert error={state.error} />
      <input type="hidden" name="next" value={next} />
      <Field label="Votre nom" htmlFor="fullName">
        <input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          placeholder="Karim Bensaïd"
          className={inputClass}
        />
      </Field>
      <Field label="Votre entreprise" htmlFor="companyName" hint="Facultatif, vous pourrez le compléter plus tard.">
        <input
          id="companyName"
          name="companyName"
          autoComplete="organization"
          placeholder="Bensaïd Plomberie"
          className={inputClass}
        />
      </Field>
      <Field label="Email" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="vous@entreprise.fr"
          className={inputClass}
        />
      </Field>
      <Field label="Mot de passe" htmlFor="password" hint="8 caractères minimum.">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="••••••••"
          className={inputClass}
        />
      </Field>
      <SubmitButton>Créer mon compte</SubmitButton>
    </form>
  );
}

/**
 * Inscription depuis une invitation d'équipe : l'email est verrouillé sur
 * l'adresse invitée — c'est lui qui déclenche le rattachement automatique à
 * l'organisation (trigger handle_new_user).
 */
export function InviteSignupForm({
  email,
  fullName = "",
  token,
}: {
  email: string;
  fullName?: string;
  token: string;
}) {
  const [state, action] = useActionState(signUp, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormAlert error={state.error} />
      <input type="hidden" name="next" value="/app" />
      <input type="hidden" name="inviteToken" value={token} />
      <Field label="Votre nom" htmlFor="fullName">
        <input
          id="fullName"
          name="fullName"
          defaultValue={fullName}
          autoComplete="name"
          required
          placeholder="Sacha Morel"
          className={inputClass}
        />
      </Field>
      <Field label="Votre email" htmlFor="email" hint="L’adresse à laquelle vous avez été invité·e.">
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          readOnly
          aria-readonly
          className={`${inputClass} cursor-not-allowed opacity-80`}
        />
      </Field>
      <Field label="Choisissez un mot de passe" htmlFor="password" hint="8 caractères minimum.">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="••••••••"
          className={inputClass}
        />
      </Field>
      <SubmitButton>Rejoindre l’équipe</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormAlert error={state.error} success={state.success} />
      {!state.success && (
        <>
          <Field label="Email de votre compte" htmlFor="email">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="vous@entreprise.fr"
              className={inputClass}
            />
          </Field>
          <SubmitButton>Recevoir le lien de réinitialisation</SubmitButton>
        </>
      )}
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormAlert error={state.error} />
      <Field label="Nouveau mot de passe" htmlFor="password" hint="8 caractères minimum.">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="••••••••"
          className={inputClass}
        />
      </Field>
      <Field label="Confirmez-le" htmlFor="confirm">
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="••••••••"
          className={inputClass}
        />
      </Field>
      <SubmitButton>Changer mon mot de passe</SubmitButton>
    </form>
  );
}
