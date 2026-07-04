import type { Metadata } from "next";
import Link from "next/link";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { SignupForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Créer mon compte" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Créez votre compte.
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Une minute, et vos blèmes commencent à se régler.
      </p>
      <div className="mt-8 flex flex-col gap-5">
        <GoogleButton next={next} />
        <OrDivider />
        <SignupForm next={next} />
      </div>
      <p className="mt-8 text-sm text-ink-muted">
        Déjà un compte ?{" "}
        <Link
          href="/login"
          className="font-medium text-ink-foreground underline-offset-4 hover:underline"
        >
          Connectez-vous
        </Link>
      </p>
    </div>
  );
}
