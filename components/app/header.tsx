import Link from "next/link";
import { LogOut, Plus } from "lucide-react";
import { signOut } from "@/lib/auth/actions";

export function AppHeader({ orgName }: { orgName?: string | null }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/app" className="text-lg font-bold tracking-tight">
          BLEME<span className="text-brand">.</span>
        </Link>
        <div className="flex items-center gap-3">
          {orgName ? (
            <span className="hidden text-sm text-muted-foreground md:block">
              {orgName}
            </span>
          ) : null}
          <Link
            href="/nouveau"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
          >
            <Plus className="size-4" />
            Nouveau blème
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Déconnexion"
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
