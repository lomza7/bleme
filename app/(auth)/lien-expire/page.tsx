import type { Metadata } from "next";
import Link from "next/link";
import { TimerOff } from "lucide-react";

export const metadata: Metadata = { title: "Lien expiré" };

export default function ExpiredLinkPage() {
  return (
    <div>
      <span className="flex size-12 items-center justify-center rounded-full bg-brand/15 text-brand">
        <TimerOff className="size-6" />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
        Ce lien a expiré ou a déjà servi.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Par sécurité, les liens envoyés par email ne fonctionnent qu’une fois
        et pendant une durée limitée.
      </p>
      <div className="mt-8 flex flex-col gap-3 text-sm">
        <Link
          href="/login"
          className="font-medium text-ink-foreground underline-offset-4 hover:underline"
        >
          Retour à la connexion
        </Link>
        <Link
          href="/mot-de-passe-oublie"
          className="text-ink-muted underline-offset-4 hover:underline"
        >
          Redemander un lien de réinitialisation
        </Link>
      </div>
    </div>
  );
}
