import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Mot de passe oublié ?
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Ça arrive. Entrez votre email, on vous envoie un lien pour en choisir
        un nouveau.
      </p>
      <div className="mt-8">
        <ForgotPasswordForm />
      </div>
      <p className="mt-8 text-sm text-ink-muted">
        <Link
          href="/login"
          className="font-medium text-ink-foreground underline-offset-4 hover:underline"
        >
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
