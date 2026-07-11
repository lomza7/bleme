// Panneau « Ma compta » du tableau de bord (composant serveur) — la pièce
// maîtresse de l'intégration Pennylane :
//  - non connecté : vitrine de connexion (panneau sombre, flux miniature) ;
//  - connecté : santé des factures (en retard / à échoir / réglées), bouton
//    de synchronisation, et les impayées déclarables en blème EN UN CLIC.

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, CircleAlert, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PROVIDERS, SUPPORTED_PROVIDERS, type ProviderId } from "@/lib/integrations/providers-meta";
import { ComptaInvoices } from "@/components/app/compta-invoices";
import { SyncNowButton } from "@/components/app/sync-now-button";
import { euros, relativeTimeFr } from "@/lib/format";

type Integration = {
  provider: string;
  status: string;
  company_name: string | null;
  last_sync_at: string | null;
  last_error: string | null;
};

function ProviderLogo({ provider, h = 18 }: { provider: string; h?: number }) {
  const m = PROVIDERS[provider as ProviderId];
  if (!m) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-white px-2.5 shadow-sm ring-1 ring-black/5" style={{ height: h + 14 }}>
      <Image src={m.logo} alt={m.label} width={Math.round(h * m.logoAspect)} height={h} style={{ height: h, width: "auto" }} />
    </span>
  );
}

type InvoiceRow = {
  id: string;
  invoice_number: string | null;
  customer_name: string | null;
  amount_cents: number | null;
  remaining_cents: number | null;
  deadline_on: string | null;
  status: string | null;
  paid: boolean;
  case_id: string | null;
  archived_at: string | null;
};

export async function ComptaPanel() {
  const supabase = await createClient();
  const { data: integrationsData } = await supabase
    .from("org_integrations")
    .select("provider, status, company_name, last_sync_at, last_error")
    .returns<Integration[]>();
  const connected = integrationsData ?? [];

  // ── Non connecté : la vitrine ──────────────────────────────────────────────
  if (connected.length === 0) {
    return (
      <section className="relative overflow-hidden rounded-[1.75rem] bg-ink p-7 text-ink-foreground sm:p-9">
        <div aria-hidden className="absolute -right-24 -top-32 size-80 rounded-full bg-brand/25 blur-[110px]" />
        <div aria-hidden className="absolute -left-28 -bottom-32 size-72 rounded-full bg-emerald-500/10 blur-[100px]" />
        <div className="relative grid grid-cols-1 items-center gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {SUPPORTED_PROVIDERS.map((p) => (
                <ProviderLogo key={p} provider={p} />
              ))}
              <span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-medium text-brand-foreground">
                Nouveau
              </span>
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">
              Vos impayés sont déjà dans votre compta.
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-muted">
              Connectez Pennylane, Axonaut ou Sellsy : vos factures en retard
              remontent ici toutes seules, chacune prête à devenir un blème en un
              clic — et vous êtes prévenu dès qu’une facture est réglée.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link
                href="/app/parametres"
                className="group inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
              >
                Connecter ma compta
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
              <span className="text-xs text-ink-muted">2 minutes · lecture seule</span>
            </div>
          </div>

          {/* Flux miniature : factures en retard → blème */}
          <div aria-hidden className="hidden w-64 shrink-0 md:block">
            <div className="space-y-2">
              {[
                { num: "F-2026-042", amount: "1 850 €", late: "J+12" },
                { num: "F-2026-043", amount: "3 200 €", late: "J+47" },
              ].map((f) => (
                <div
                  key={f.num}
                  className="flex items-center gap-2.5 rounded-xl bg-white/95 px-3.5 py-2.5 text-foreground shadow-lg"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{f.num}</span>
                    <span className="block text-[11px] tabular-nums text-muted-foreground">{f.amount}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                    <span className="relative flex size-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60 motion-reduce:hidden" />
                      <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
                    </span>
                    {f.late}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-center py-0.5">
                <svg className="h-5 w-1" viewBox="0 0 2 20" preserveAspectRatio="none">
                  <line x1="1" y1="0" x2="1" y2="20" className="anim-dash stroke-brand" strokeWidth="2" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-brand px-3.5 py-2.5 text-brand-foreground shadow-lg shadow-brand/30">
                <span className="text-xs font-semibold">Blème créé, relance prête</span>
                <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">1 clic</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── Connecté : la santé des factures + l'action ────────────────────────────
  const [{ data: unpaidRows }, { count: paidCount }] = await Promise.all([
    supabase
      .from("accounting_invoices")
      .select("id, invoice_number, customer_name, amount_cents, remaining_cents, deadline_on, status, paid, case_id, archived_at")
      .eq("paid", false)
      .order("deadline_on", { ascending: true, nullsFirst: false })
      .limit(500)
      .returns<InvoiceRow[]>(),
    supabase
      .from("accounting_invoices")
      .select("id", { count: "exact", head: true })
      .eq("paid", true),
  ]);

  const anyError = connected.some((i) => i.status === "error");
  const errored = connected.find((i) => i.status === "error" && i.last_error);
  const lastSync = connected
    .map((i) => i.last_sync_at)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);

  const unpaid = unpaidRows ?? [];
  const due = (r: InvoiceRow) => r.remaining_cents ?? r.amount_cents ?? 0;
  // Les chiffres de santé excluent les factures archivées (écartées par l'utilisateur).
  const active = unpaid.filter((r) => !r.archived_at);
  const late = active.filter((r) => ["late", "partially_paid"].includes(r.status ?? ""));
  const upcoming = active.filter((r) => r.status === "upcoming");
  const lateSum = late.reduce((s, r) => s + due(r), 0);
  const upcomingSum = upcoming.reduce((s, r) => s + due(r), 0);
  // Factures « à traiter » (sans dossier) passées au composant client (onglets
  // En retard / Toutes / Archivées + archivage).
  const panelInvoices = unpaid
    .filter((r) => !r.case_id)
    .map((r) => ({
      id: r.id,
      invoice_number: r.invoice_number,
      customer_name: r.customer_name,
      amount_cents: r.amount_cents,
      remaining_cents: r.remaining_cents,
      deadline_on: r.deadline_on,
      status: r.status,
      archived: Boolean(r.archived_at),
    }));
  return (
    <section className="overflow-hidden rounded-[1.75rem] border bg-card">
      {/* En-tête : identité + synchro */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4 sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex shrink-0 items-center gap-1.5">
            {connected.map((i) => (
              <ProviderLogo key={i.provider} provider={i.provider} />
            ))}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              Ma compta
              {connected.length === 1 && connected[0].company_name ? ` · ${connected[0].company_name}` : ""}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground" suppressHydrationWarning>
              <span className={`size-1.5 rounded-full ${anyError ? "bg-amber-500" : "bg-emerald-500"}`} />
              {lastSync ? `Synchronisé ${relativeTimeFr(lastSync)}` : "Synchronisation en attente"}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <SyncNowButton />
          <Link
            href="/app/parametres"
            aria-label="Réglages de la connexion"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground"
          >
            <Settings className="size-4" />
          </Link>
        </div>
      </div>

      {anyError ? (
        <p className="flex items-start gap-2 border-b bg-amber-50 px-6 py-3 text-[13px] leading-relaxed text-amber-800 sm:px-7">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {errored?.last_error ?? "Une connexion est en échec."}{" "}
          <Link href="/app/parametres" className="font-medium underline underline-offset-2">
            Vérifier la connexion
          </Link>
        </p>
      ) : null}

      {/* La santé en trois chiffres */}
      <div className="grid grid-cols-3 divide-x border-b">
        <div className="px-4 py-4 sm:px-7">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            En retard
          </p>
          <p className={`mt-1 text-lg font-bold tabular-nums tracking-tight sm:text-2xl ${late.length > 0 ? "text-amber-700" : ""}`}>
            {euros(lateSum)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {late.length} facture{late.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="px-4 py-4 sm:px-7">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            À échoir
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums tracking-tight sm:text-2xl">
            {euros(upcomingSum)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {upcoming.length} facture{upcoming.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="px-4 py-4 sm:px-7">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Réglées
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums tracking-tight text-emerald-700 sm:text-2xl">
            {paidCount ?? 0}
          </p>
          <p className="text-[11px] text-muted-foreground">sur 18 mois</p>
        </div>
      </div>

      {/* Factures à traiter : filtre En retard / Toutes / Archivées, chacune
          déclarable en blème ou archivable (interactif, sans recharger). */}
      {panelInvoices.length > 0 ? (
        <ComptaInvoices invoices={panelInvoices} />
      ) : (
        <p className="flex items-center gap-2.5 px-6 py-5 text-sm text-muted-foreground sm:px-7">
          <span className="flex size-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="size-3.5" />
          </span>
          {unpaid.length > 0
            ? "Toutes vos factures ouvertes ont déjà leur dossier — le suivi s’en occupe."
            : "Aucune facture ouverte détectée dans votre compta."}
        </p>
      )}
      <div className="flex items-center justify-end border-t px-4 py-2.5 sm:px-7">
        <Link
          href="/app/envois"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-strong transition-colors duration-300 hover:text-brand"
        >
          Tout le suivi
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </section>
  );
}
