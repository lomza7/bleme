"use client";

import { useMemo, useState, useTransition } from "react";
import { Archive, ArchiveRestore, CalendarClock, Check, TriangleAlert } from "lucide-react";
import { createCaseFromInvoice, setInvoiceArchived } from "@/lib/integrations/actions";
import { CreateCaseFromInvoiceButton } from "@/components/app/create-case-button";
import { euros } from "@/lib/format";

/*
 * Liste interactive des factures importées (panneau « Ma compta »). Trois
 * onglets : « En retard » (défaut), « Toutes » (retard + à échoir), « Archivées ».
 * Chaque facture : « Créer le dossier » (lance la procédure) ou « Archiver ».
 * L'archivage est OPTIMISTE (retrait immédiat) puis persisté côté serveur —
 * pas de rechargement de page (les compteurs du dashboard ne se relancent pas).
 */

export type PanelInvoice = {
  id: string;
  invoice_number: string | null;
  customer_name: string | null;
  amount_cents: number | null;
  remaining_cents: number | null;
  deadline_on: string | null;
  status: string | null;
  archived: boolean;
};

type Tab = "retard" | "toutes" | "archivees";

function overdueDays(deadline: string | null): number | null {
  if (!deadline) return null;
  const days = Math.floor((Date.now() - new Date(deadline).getTime()) / (24 * 3600 * 1000));
  return days > 0 ? days : null;
}

export function ComptaInvoices({ invoices }: { invoices: PanelInvoice[] }) {
  const [tab, setTab] = useState<Tab>("retard");
  // Surcharge optimiste de l'état archivé, par id.
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const [, startArchive] = useTransition();

  const isArchived = (inv: PanelInvoice) => override[inv.id] ?? inv.archived;
  const due = (r: PanelInvoice) => r.remaining_cents ?? r.amount_cents ?? 0;

  const { retard, toutes, archivees } = useMemo(() => {
    const active = invoices.filter((i) => !isArchived(i));
    return {
      retard: active.filter((i) => ["late", "partially_paid"].includes(i.status ?? "")),
      toutes: active.filter((i) => ["late", "partially_paid", "upcoming"].includes(i.status ?? "")),
      archivees: invoices.filter((i) => isArchived(i)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, override]);

  const fullList = tab === "retard" ? retard : tab === "toutes" ? toutes : archivees;
  // Cap d'affichage : le dashboard ne s'allonge pas à l'infini (le reste vit
  // dans le Suivi). Les compteurs d'onglets, eux, comptent tout.
  const CAP = 6;
  const list = fullList.slice(0, CAP);
  const hidden = fullList.length - list.length;

  const [failed, setFailed] = useState(false);
  const setArchived = (id: string, archived: boolean) => {
    setFailed(false);
    setOverride((o) => ({ ...o, [id]: archived }));
    startArchive(async () => {
      const res = await setInvoiceArchived(id, archived);
      if (!res.ok) {
        // Échec serveur : on rétablit l'état (jamais d'échec silencieux).
        setOverride((o) => {
          const next = { ...o };
          delete next[id];
          return next;
        });
        setFailed(true);
      }
    });
  };

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "retard", label: "En retard", count: retard.length },
    { key: "toutes", label: "Toutes", count: toutes.length },
    { key: "archivees", label: "Archivées", count: archivees.length },
  ];

  return (
    <div className="px-4 py-4 sm:px-7 sm:py-5">
      {/* Filtre */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                active
                  ? "inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-xs font-medium text-brand-foreground"
                  : "inline-flex items-center gap-1.5 rounded-full border bg-background px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground"
              }
            >
              {t.label}
              {t.count > 0 ? <span className={active ? "opacity-80" : "opacity-70"}>{t.count}</span> : null}
            </button>
          );
        })}
      </div>

      {failed ? (
        <p role="alert" className="mb-3 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800 ring-1 ring-amber-200">
          <TriangleAlert className="size-4 shrink-0" />
          L’archivage n’a pas abouti — réessayez.
        </p>
      ) : null}

      {list.length === 0 ? (
        <p className="flex items-center gap-2.5 py-3 text-sm text-muted-foreground">
          <span className="flex size-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="size-3.5" />
          </span>
          {tab === "archivees"
            ? "Aucune facture archivée."
            : tab === "retard"
              ? "Aucune facture en retard à traiter — tout est réglé, en dossier ou archivé."
              : "Aucune facture ouverte à traiter."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((inv) => {
            const archived = isArchived(inv);
            const lateDays = overdueDays(inv.deadline_on);
            const partial = inv.status === "partially_paid";
            const isLate = inv.status === "late" || partial || (lateDays ?? 0) > 0;
            return (
              <div
                key={inv.id}
                className="flex flex-col gap-2.5 rounded-2xl bg-muted/50 px-4 py-3 ring-1 ring-black/5 sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                      archived
                        ? "bg-muted text-muted-foreground"
                        : isLate
                          ? "bg-amber-100 text-amber-700"
                          : "bg-brand-soft text-brand-strong"
                    }`}
                  >
                    {archived ? (
                      <Archive className="size-3.5" />
                    ) : isLate ? (
                      <TriangleAlert className="size-3.5" />
                    ) : (
                      <CalendarClock className="size-3.5" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {inv.customer_name ?? "Client à préciser"}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {inv.invoice_number ? `Facture nº ${inv.invoice_number}` : "Facture"}
                      {isLate
                        ? lateDays
                          ? ` · ${lateDays} j de retard`
                          : " · en retard"
                        : inv.deadline_on
                          ? ` · échéance le ${new Date(inv.deadline_on).toLocaleDateString("fr-FR")}`
                          : ""}
                      {partial ? " · paiement partiel" : ""}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                  <span className="text-[15px] font-bold tabular-nums tracking-tight">{euros(due(inv))}</span>
                  {archived ? (
                    <button
                      type="button"
                      onClick={() => setArchived(inv.id, false)}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-2 text-xs font-medium transition-colors duration-300 hover:border-brand/60 hover:bg-brand-soft"
                    >
                      <ArchiveRestore className="size-3.5" />
                      Désarchiver
                    </button>
                  ) : (
                    <>
                      <form action={createCaseFromInvoice}>
                        <input type="hidden" name="invoiceId" value={inv.id} />
                        <CreateCaseFromInvoiceButton />
                      </form>
                      <button
                        type="button"
                        aria-label="Archiver cette facture"
                        title="Archiver"
                        onClick={() => setArchived(inv.id, true)}
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground"
                      >
                        <Archive className="size-4" />
                      </button>
                    </>
                  )}
                </span>
              </div>
            );
          })}
          {hidden > 0 ? (
            <p className="px-1 pt-1 text-[11px] text-muted-foreground">
              + {hidden} autre{hidden > 1 ? "s" : ""} dans le Suivi
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
