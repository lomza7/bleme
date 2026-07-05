import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { signOut } from "@/lib/auth/actions";
import { MobileTopBar, SidebarNav } from "@/components/app/sidebar-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: org }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("organizations").select("name").limit(1).maybeSingle(),
  ]);

  const name = profile?.full_name ?? user.email ?? "";
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase())
    .join("");

  const userCard = (
    <div className="flex items-center gap-3 rounded-2xl border bg-card px-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-strong">
        {initials || "B"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {org?.name ?? ""}
        </span>
      </span>
      <form action={signOut}>
        <button
          type="submit"
          aria-label="Déconnexion"
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh bg-muted/40 text-foreground">
      <div className="flex">
        <SidebarNav userCard={userCard} />
        <div className="min-w-0 flex-1">
          <MobileTopBar userCard={userCard} />
          <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
