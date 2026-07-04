import type { Metadata } from "next";
import { MailCheck } from "lucide-react";

export const metadata: Metadata = { title: "Vérifiez votre email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <div>
      <span className="flex size-12 items-center justify-center rounded-full bg-brand/15 text-brand">
        <MailCheck className="size-6" />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
        Un email est en route.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Cliquez sur le lien envoyé
        {email ? (
          <>
            {" "}
            à <span className="font-medium text-ink-foreground">{email}</span>
          </>
        ) : null}{" "}
        pour activer votre compte. Pensez à vérifier vos spams : les emails
        importants ont ce petit défaut.
      </p>
    </div>
  );
}
