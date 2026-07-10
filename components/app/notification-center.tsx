"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  Inbox,
  Mail,
  Reply,
  TriangleAlert,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/notifications/actions";

/*
 * Cloche + panneau de notifications (suivi des envois, réponses reçues,
 * alertes). L'état vit dans un provider unique (layout) : les deux cloches
 * rendues (sidebar desktop / barre mobile) partagent items, compteur et LE
 * polling — pas de double requête ni de badge désynchronisé. Données
 * initiales rendues côté serveur, puis rafraîchies par polling léger (même
 * pattern que le reste de l'app — pas de Supabase Realtime dans le projet).
 *
 * Le panneau est monté en portal sur document.body : rendu à l'intérieur du
 * header mobile (backdrop-blur), un position:fixed serait piégé par le
 * containing block du filtre et s'écraserait sur 56 px de haut.
 */

const POLL_MS = 90_000;

const KIND_ICONS: Record<string, LucideIcon> = {
  tracking: Truck,
  reply: Reply,
  alert: TriangleAlert,
  inbox: Inbox,
  system: Mail,
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "à l’instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "hier" : `il y a ${d} j`;
}

type NotificationsState = {
  items: NotificationItem[];
  unread: number;
  refresh: () => void;
  onItemClick: (n: NotificationItem) => void;
  onMarkAll: () => void;
};

const NotificationsContext = createContext<NotificationsState | null>(null);

export function NotificationsProvider({
  initialItems,
  initialUnread,
  children,
}: {
  initialItems: NotificationItem[];
  initialUnread: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const res = await fetchNotifications();
      setItems(res.items);
      setUnread(res.unread);
    } catch {
      // Rafraîchissement raté (hors-ligne…) : le prochain tick réessaie.
    } finally {
      refreshing.current = false;
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const onItemClick = useCallback(
    (n: NotificationItem) => {
      if (!n.read_at) {
        setItems((prev) =>
          prev.map((p) => (p.id === n.id ? { ...p, read_at: new Date().toISOString() } : p)),
        );
        setUnread((u) => Math.max(0, u - 1));
        void markNotificationRead(n.id);
      }
      if (n.href) router.push(n.href);
    },
    [router],
  );

  const onMarkAll = useCallback(() => {
    setItems((prev) =>
      prev.map((p) => (p.read_at ? p : { ...p, read_at: new Date().toISOString() })),
    );
    setUnread(0);
    void markAllNotificationsRead();
  }, []);

  return (
    <NotificationsContext.Provider value={{ items, unread, refresh, onItemClick, onMarkAll }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function NotificationBell() {
  const ctx = useContext(NotificationsContext);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Panneau ouvert : Échap ferme, le fond ne défile plus, focus sur « Fermer ».
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!ctx) return null;
  const { items, unread, refresh, onItemClick, onMarkAll } = ctx;

  const panel = (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Notifications">
      <button
        type="button"
        aria-label="Fermer les notifications"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
      />
      <div className="absolute inset-y-0 right-0 flex w-[24rem] max-w-[92vw] flex-col bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">Notifications</h2>
          <div className="flex items-center gap-1">
            {unread > 0 ? (
              <button
                type="button"
                onClick={onMarkAll}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground"
              >
                <Check className="size-3.5" />
                Tout marquer comme lu
              </button>
            ) : null}
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:bg-muted"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                <Bell className="size-5" />
              </span>
              <p className="text-sm text-muted-foreground">
                Rien pour l’instant. Le suivi de vos envois (imprimé, distribué, AR signé,
                réponse reçue…) apparaîtra ici.
              </p>
            </div>
          ) : (
            items.map((n) => {
              const Icon = KIND_ICONS[n.kind] ?? Bell;
              const isUnread = !n.read_at;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onItemClick(n);
                  }}
                  className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors duration-300 hover:bg-muted ${
                    isUnread ? "bg-brand-soft/40" : ""
                  }`}
                >
                  <span
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                      n.kind === "alert"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-brand-soft text-brand-strong"
                    }`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm leading-snug ${isUnread ? "font-semibold" : "font-medium"}`}
                    >
                      {n.title}
                    </span>
                    {n.body ? (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                        {n.body}
                      </span>
                    ) : null}
                    <span
                      suppressHydrationWarning
                      className="mt-1 block text-[11px] tabular-nums text-muted-foreground"
                    >
                      {relativeTime(n.created_at)}
                    </span>
                  </span>
                  {isUnread ? (
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-brand" aria-hidden />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          void refresh();
        }}
        aria-label={
          unread > 0 ? `Notifications — ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"
        }
        className="relative flex size-9 items-center justify-center rounded-full text-foreground transition-colors duration-300 hover:bg-muted"
      >
        <Bell className="size-4.5" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-brand-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? createPortal(panel, document.body) : null}
    </>
  );
}
