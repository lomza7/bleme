import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSecret } from "@/lib/secrets";

export const metadata: Metadata = {
  title: { template: "%s · Console admin", default: "Console admin" },
  robots: { index: false, follow: false },
};

/* Zone réservée : profils is_admin uniquement (doublée par les RLS). */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) redirect("/app");

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b bg-ink text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2 font-bold tracking-tight">
              BLEME<span className="text-brand">.</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium ring-1 ring-white/15">
                <ShieldCheck className="size-3 text-brand" />
                Console admin
              </span>
            </Link>
          </div>
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            Retour à l’app
          </Link>
        </div>
      </header>
      <AdminTabs />
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}

async function AdminTabs() {
  // L'onglet Ops apparaît dès que PAPERCLIP_URL est posée dans le coffre.
  const paperclipUrl = await getSecret("PAPERCLIP_URL");
  return (
    <nav aria-label="Sections d’administration" className="border-b bg-muted/40">
      <div className="mx-auto flex max-w-6xl gap-1 px-6 py-2">
        {[
          { href: "/admin", label: "Vue d’ensemble" },
          { href: "/admin/agents", label: "Agents" },
          { href: "/admin/hermes", label: "Hermes & Skills" },
          { href: "/admin/cles", label: "Clés & API" },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
          >
            {t.label}
          </Link>
        ))}
        {/* https public, ou http sur le tailnet (chiffré WireGuard) */}
        {paperclipUrl && /^(https:\/\/|http:\/\/100\.)/.test(paperclipUrl) ? (
          <a
            href={paperclipUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
          >
            Ops · Paperclip
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
    </nav>
  );
}
