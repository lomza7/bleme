import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { signOut } from "@/lib/auth/actions";
import { getMyAccess } from "@/lib/permissions/server";
import { MobileTopBar, SidebarNav } from "@/components/app/sidebar-nav";
import { NotificationBell, NotificationsProvider } from "@/components/app/notification-center";
import type { NotificationItem } from "@/lib/notifications/actions";

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

  const [{ data: profile }, { data: org }, { data: notifItems }, { count: notifUnread }] =
    await Promise.all([
      supabase.from("profiles").select("full_name, is_admin, onboarding_state, email_verified").eq("id", user.id).maybeSingle(),
      supabase.from("organizations").select("name").limit(1).maybeSingle(),
      supabase
        .from("notifications")
        .select("id, kind, title, body, href, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null),
    ]);
  // Email non vérifié → écran de code d'abord (rempart anti-faux-comptes).
  if (profile && profile.email_verified === false) redirect("/verifier-email");
  // Onboarding /bienvenue pas encore terminé → on y passe ensuite (une fois).
  if (profile && profile.onboarding_state !== "done") redirect("/bienvenue");
  const isAdmin = Boolean(profile?.is_admin);

  // Droits du membre → navigation (masque « voir quoi »).
  const access = await getMyAccess();
  const navAccess = access
    ? { role: access.role, permissions: access.permissions }
    : undefined;

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

  // Cloche de notifications : données initiales rendues serveur, état et
  // polling PARTAGÉS entre les deux cloches (sidebar desktop / barre mobile)
  // via le provider — un seul rafraîchissement, badge toujours synchronisé.
  const bell = <NotificationBell />;

  return (
    <div className="min-h-dvh bg-muted/40 text-foreground">
      <NotificationsProvider
        initialItems={(notifItems as NotificationItem[]) ?? []}
        initialUnread={notifUnread ?? 0}
      >
        <div className="flex">
          <SidebarNav userCard={userCard} isAdmin={isAdmin} bell={bell} access={navAccess} />
          <div className="min-w-0 flex-1">
            <MobileTopBar userCard={userCard} isAdmin={isAdmin} bell={bell} access={navAccess} />
            <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
              {children}
            </main>
          </div>
        </div>
      </NotificationsProvider>
    </div>
  );
}
