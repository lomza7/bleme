import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Ce lien n’est plus valide.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Les liens de réinitialisation expirent vite, par sécurité.
          Redemandez-en un, ça prend dix secondes.
        </p>
        <p className="mt-8">
          <Link
            href="/mot-de-passe-oublie"
            className="font-medium text-ink-foreground underline-offset-4 hover:underline"
          >
            Recevoir un nouveau lien
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Choisissez un nouveau mot de passe.
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Pour le compte {user.email}.
      </p>
      <div className="mt-8">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
