import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { euros, relativeDays } from "@/lib/format";
import { FIXED_INDEMNITY_CENTS } from "@/lib/cases/constants";
import {
  OPEN_STATUSES,
  PageHeader,
  StageDots,
  StatTile,
  StatusChip,
  type CaseRow,
} from "@/components/app/ui";

export const metadata: Metadata = { title: "Mes factures" };

export default async function FacturesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("cases")
    .select(
      "id, case_type, title, status, debtor_name, amount_claimed_cents, amount_recovered_cents, stage, stage_total, next_action_label, next_action_at, expected_recovery_at, is_sample",
    )
    .eq("case_type", "unpaid_invoice")
    .order("updated_at", { ascending: false })
    .returns<CaseRow[]>();

  const factures = data ?? [];
  const open = factures.filter((c) => OPEN_STATUSES.includes(c.status));
  const atStake = open.reduce(
    (s, c) => s + Math.max(0, c.amount_claimed_cents - c.amount_recovered_cents),
    0,
  );
  const recovered = factures.reduce((s, c) => s + c.amount_recovered_cents, 0);
  const indemnities = open.length * FIXED_INDEMNITY_CENTS;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Mes factures"
        sub="Toutes vos factures impayées suivies par BLEME, et ce qu’elles doivent rapporter."
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile
          label="En attente de paiement"
          value={euros(atStake)}
          sub={`${open.length} facture${open.length > 1 ? "s" : ""} en cours`}
        />
        <StatTile label="Encaissé" value={euros(recovered)} sub="grâce à vos relances" accent />
        <StatTile
          label="Indemnités légales"
          value={euros(indemnities)}
          sub="40 € par facture impayée (B2B)"
        />
      </section>

      {factures.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-[1.75rem] border bg-card p-10">
          <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
            <Receipt className="size-5" />
          </span>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Aucune facture impayée suivie pour l’instant. Quand un client
            traîne, racontez le blème : la relance part en 15 minutes.
          </p>
          <Link
            href="/nouveau"
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong"
          >
            Suivre une facture impayée
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[1.75rem] border bg-card">
          {factures.map((c) => {
            const remaining = c.amount_claimed_cents - c.amount_recovered_cents;
            return (
              <Link
                key={c.id}
                href={`/app/dossiers/${c.id}`}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b px-6 py-5 transition-colors duration-300 last:border-b-0 hover:bg-muted/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip status={c.status} />
                    {c.is_sample ? (
                      <span className="text-xs text-muted-foreground">exemple</span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 truncate font-semibold">{c.title}</p>
                  {c.next_action_label && c.next_action_at ? (
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {c.next_action_label} · {relativeDays(c.next_action_at)}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <p
                    className={
                      c.status === "resolved"
                        ? "text-lg font-bold tracking-tight text-emerald-700"
                        : "text-lg font-bold tracking-tight"
                    }
                  >
                    {euros(c.status === "resolved" ? c.amount_recovered_cents : remaining)}
                  </p>
                  <StageDots stage={c.stage} total={c.stage_total} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground/80">
        L’indemnité forfaitaire de recouvrement de 40 € est due de plein droit
        pour chaque facture impayée entre professionnels. Montants indicatifs,
        pas un conseil juridique.
      </p>
    </div>
  );
}
