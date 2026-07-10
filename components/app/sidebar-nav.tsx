"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  Download,
  FileText,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

const SECTIONS = [
  {
    titre: "Pilotage",
    items: [
      { href: "/app", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
      { href: "/app/inbox", label: "Boîte de réception", icon: Inbox },
      { href: "/app/dossiers", label: "Mes dossiers", icon: FolderOpen },
      { href: "/app/calendrier", label: "Agenda", icon: CalendarDays },
      { href: "/app/documents", label: "Mes documents", icon: FileText },
    ],
  },
  {
    titre: "Compte",
    items: [
      { href: "/app/equipe", label: "Mon équipe", icon: Users },
      { href: "/app/abonnement", label: "Mon abonnement", icon: CreditCard },
      { href: "/app/export", label: "Exporter", icon: Download },
      { href: "/app/parametres", label: "Paramètres", icon: Settings },
    ],
  },
];

function NavItems({ onNavigate, isAdmin }: { onNavigate?: () => void; isAdmin?: boolean }) {
  const pathname = usePathname();
  const sections = isAdmin
    ? [
        ...SECTIONS.slice(0, -1),
        {
          ...SECTIONS[SECTIONS.length - 1],
          items: [
            ...SECTIONS[SECTIONS.length - 1].items,
            { href: "/admin", label: "Administration", icon: ShieldCheck },
          ],
        },
      ]
    : SECTIONS;
  return (
    <nav className="flex flex-1 flex-col gap-6">
      {sections.map((section) => (
        <div key={section.titre}>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
            {section.titre}
          </p>
          <ul className="mt-2 space-y-0.5">
            {section.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "flex items-center gap-3 rounded-xl bg-brand-soft px-3 py-2.5 text-sm font-semibold text-brand-strong"
                        : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground"
                    }
                  >
                    <item.icon className="size-4.5 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NewCaseButton({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/app/nouveau"
      onClick={onNavigate}
      className="flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
    >
      <Plus className="size-4" />
      Nouveau blème
    </Link>
  );
}

export function SidebarNav({
  userCard,
  isAdmin,
  bell,
}: {
  userCard: React.ReactNode;
  isAdmin?: boolean;
  bell?: React.ReactNode;
}) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r bg-background px-4 py-6 lg:flex">
      <div className="flex items-center justify-between pl-3 pr-1">
        <Link href="/app" className="text-xl font-bold tracking-tight">
          BLEME<span className="text-brand">.</span>
        </Link>
        {bell}
      </div>
      <NewCaseButton />
      <NavItems isAdmin={isAdmin} />
      {userCard}
    </aside>
  );
}

export function MobileTopBar({
  userCard,
  isAdmin,
  bell,
}: {
  userCard: React.ReactNode;
  isAdmin?: boolean;
  bell?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/85 px-4 backdrop-blur lg:hidden">
        <Link href="/app" className="text-lg font-bold tracking-tight">
          BLEME<span className="text-brand">.</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/nouveau"
            className="flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-xs font-medium text-brand-foreground"
          >
            <Plus className="size-3.5" />
            Nouveau
          </Link>
          {bell}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors duration-300 hover:bg-muted"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 right-0 flex w-[19rem] max-w-[85vw] flex-col gap-6 overflow-y-auto bg-background px-4 py-5 shadow-2xl">
            <div className="flex items-center justify-between px-1">
              <span className="text-lg font-bold tracking-tight">
                BLEME<span className="text-brand">.</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>
            <NewCaseButton onNavigate={() => setOpen(false)} />
            <NavItems onNavigate={() => setOpen(false)} isAdmin={isAdmin} />
            {userCard}
          </div>
        </div>
      )}
    </>
  );
}
