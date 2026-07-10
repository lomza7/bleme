// Factures impayées détectées dans la compta (composant serveur) : chacune
// prête à devenir un blème en un clic. Les valeurs affichées viennent de
// Pennylane — le dossier créé reste entièrement corrigeable (pilier n°3).

import { Landmark, TriangleAlert } from "lucide-react";
import { createCaseFromInvoice } from "@/lib/integrations/actions";
import { CreateCaseFromInvoiceButton } from "@/components/app/create-case-button";
import { euros } from "@/lib/format";

export type DetectedInvoice = {
  id: string;
  invoice_number: string | null;
  label: string | null;
  customer_name: string | null;
  amount_cents: number | null;
  remaining_cents: number | null;
  deadline_on: string | null;
  status: string | null;
};

function overdueDays(deadline: string | null): number | null {
  if (!deadline) return null;
  const days = Math.floor((Date.now() - new Date(deadline).getTime()) / (24 * 3600 * 1000));
  return days > 0 ? days : null;
}

export function DetectedInvoices({
  invoices,
  totalCount,
}: {
  invoices: DetectedInvoice[];
  totalCount?: number;
}) {
  if (invoices.length === 0) return null;
  const hidden = (totalCount ?? invoices.length) - invoices.length;
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Impayés détectés dans votre compta
        </h2>
        <span className="text-xs text-muted-foreground">
          via votre compta · valeurs vérifiables et corrigeables
          {hidden > 0 ? ` · les ${invoices.length} plus urgentes affichées (${totalCount} au total)` : ""}
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-2.5">
        {invoices.map((inv, i) => {
          const late = overdueDays(inv.deadline_on);
          const remaining = inv.remaining_cents ?? inv.amount_cents;
          const partial =
            inv.status === "partially_paid" &&
            inv.remaining_cents != null &&
            inv.amount_cents != null &&
            inv.remaining_cents < inv.amount_cents;
          return (
            <div
              key={inv.id}
              className="anim-load flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:gap-4"
              style={{ "--delay": `${Math.min(i, 8) * 70}ms` } as React.CSSProperties}
            >
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Landmark className="size-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">
                    {inv.customer_name ?? "Client à préciser"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    Facture {inv.invoice_number ? `nº ${inv.invoice_number}` : "sans numéro"}
                    {inv.label ? ` · ${inv.label}` : ""}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                <span className="text-right">
                  <span className="block text-[15px] font-bold tracking-tight">
                    {remaining != null ? euros(remaining) : "—"}
                    {partial ? (
                      <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                        restants
                      </span>
                    ) : null}
                  </span>
                  {late ? (
                    <span className="flex items-center justify-end gap-1 text-xs font-medium text-amber-700">
                      <TriangleAlert className="size-3" />
                      {late} j de retard
                    </span>
                  ) : inv.deadline_on ? (
                    <span className="block text-xs text-muted-foreground">
                      échéance le {new Date(inv.deadline_on).toLocaleDateString("fr-FR")}
                    </span>
                  ) : (
                    <span className="block text-xs text-muted-foreground">
                      {partial ? "paiement partiel" : "échéance inconnue"}
                    </span>
                  )}
                </span>
                <form action={createCaseFromInvoice}>
                  <input type="hidden" name="invoiceId" value={inv.id} />
                  <CreateCaseFromInvoiceButton />
                </form>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
