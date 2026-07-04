import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pré-lancement : pas de backend configuré → message plutôt qu'une erreur.
  const content = isSupabaseConfigured() ? (
    children
  ) : (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        L’espace client ouvre très bientôt.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Les comptes ne sont pas encore ouverts au public. En attendant, vous
        pouvez déjà préparer votre premier dossier : il vous attendra.
      </p>
      <p className="mt-8">
        <Link
          href="/nouveau"
          className="font-medium text-ink-foreground underline-offset-4 hover:underline"
        >
          Préparer mon premier dossier
        </Link>
      </p>
    </div>
  );
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-ink text-ink-foreground">
      <div aria-hidden className="absolute inset-0 bg-hero-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_20%,black,transparent)]" />
      <div aria-hidden className="absolute -right-40 -top-40 size-[30rem] rounded-full bg-brand/20 blur-[140px]" />

      <header className="relative z-10 mx-auto w-full max-w-md px-6 pt-8">
        <Link href="/" className="text-lg font-bold tracking-tight">
          BLEME<span className="text-brand">.</span>
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
        {content}
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-md px-6 pb-8">
        <p className="text-xs text-ink-muted/70">
          Vos données sont hébergées en Europe et vous appartiennent.{" "}
          <Link href="/confidentialite" className="underline-offset-2 hover:underline">
            Confidentialité
          </Link>
        </p>
      </footer>
    </div>
  );
}
