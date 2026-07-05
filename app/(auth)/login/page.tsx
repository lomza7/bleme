import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Content de vous revoir.
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Vos dossiers vous attendent là où vous les avez laissés.
      </p>
      <div className="mt-8">
        <LoginForm next={next} />
      </div>
      <p className="mt-8 text-sm text-ink-muted">
        Pas encore de compte ?{" "}
        <Link
          href="/signup"
          className="font-medium text-ink-foreground underline-offset-4 hover:underline"
        >
          Créez-le en une minute
        </Link>
      </p>
    </div>
  );
}
