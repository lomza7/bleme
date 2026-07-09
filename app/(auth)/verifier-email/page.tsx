import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { VerifyCodeForm } from "@/components/auth/verify-code-form";

export const metadata: Metadata = { title: "Vérifiez votre email" };

function safeNext(raw?: string): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app";
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Sans session, il n'y a pas de code à vérifier : retour à la connexion.
  if (!user) redirect("/login");
  // Déjà vérifié → on ne réaffiche pas l'écran.
  const { data: profile } = await supabase
    .from("profiles")
    .select("email_verified")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.email_verified) redirect(safeNext(next));

  return (
    <div>
      <span className="flex size-12 items-center justify-center rounded-full bg-brand/15 text-brand">
        <MailCheck className="size-6" />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
        Confirmez votre email.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Nous avons envoyé un code à 6 chiffres
        {user.email ? (
          <>
            {" "}à <span className="font-medium text-ink-foreground">{user.email}</span>
          </>
        ) : null}
        . Saisissez-le ci-dessous — pensez à vérifier vos spams.
      </p>
      <div className="mt-8">
        <VerifyCodeForm next={safeNext(next)} />
      </div>
    </div>
  );
}
