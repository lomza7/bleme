import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CASE_TYPE_LABEL, FIXED_INDEMNITY_CENTS, STATUS_META } from "@/lib/cases/constants";

/*
 * Export comptable : récapitulatif des encaissements (cases.amount_recovered) et
 * de l'indemnité forfaitaire (40 € par dossier d'impayé, FIXED_INDEMNITY_CENTS),
 * par période. Les dossiers d'exemple sont exclus. CSV séparé par « ; » + BOM →
 * ouverture propre (accents) dans Excel FR. Registre non-juridique.
 */

export type ComptaCase = {
  title: string;
  debtor_name: string;
  case_type: string;
  status: string;
  amount_claimed_cents: number;
  amount_recovered_cents: number;
  created_at: string;
  resolved_at: string | null;
};

export type Period = "mois" | "annee" | "tout";

export function indemnityCents(c: Pick<ComptaCase, "case_type">): number {
  return c.case_type === "unpaid_invoice" ? FIXED_INDEMNITY_CENTS : 0;
}

/**
 * Début de période CALENDAIRE en Europe/Paris (un comptable raisonne au mois
 * civil, pas en fenêtre glissante) : 1er du mois courant / 1er janvier.
 */
export function periodStartMs(period: Period, now: number): number {
  if (period === "tout") return 0;
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(now));
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  // Minuit Paris ≈ 22h/23h UTC la veille : UTC-2h couvre été comme hiver sans
  // inclure le mois précédent (personne n'encaisse entre 22h et minuit près).
  const utc = period === "mois" ? Date.UTC(year, month - 1, 1) : Date.UTC(year, 0, 1);
  return utc - 2 * 3600 * 1000;
}

export function withinPeriod(c: ComptaCase, period: Period, now: number): boolean {
  if (period === "tout") return true;
  const iso = c.resolved_at ?? c.created_at;
  return new Date(iso).getTime() >= periodStartMs(period, now);
}

/** Paginé jusqu'à épuisement : PostgREST plafonne à ~1000 lignes par requête —
 * un agrégat comptable tronqué en silence serait faux. */
async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await query(from, from + PAGE - 1);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/** Dossiers RÉELS (hors exemples) + date du dernier encaissement (event payment). */
export async function fetchComptaCases(supabase: SupabaseClient): Promise<ComptaCase[]> {
  const [cases, pays] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("cases")
        .select("id, title, debtor_name, case_type, status, amount_claimed_cents, amount_recovered_cents, created_at")
        .eq("is_sample", false)
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("case_events")
        .select("case_id, event_date")
        .eq("event_type", "payment")
        .order("event_date")
        .range(from, to),
    ),
  ]);
  const lastPayment = new Map<string, string>();
  for (const p of pays ?? []) {
    const prev = lastPayment.get(p.case_id as string);
    if (!prev || (p.event_date as string) > prev) lastPayment.set(p.case_id as string, p.event_date as string);
  }
  return (cases ?? []).map((c) => ({
    title: c.title,
    debtor_name: c.debtor_name,
    case_type: c.case_type,
    status: c.status,
    amount_claimed_cents: Number(c.amount_claimed_cents) || 0,
    amount_recovered_cents: Number(c.amount_recovered_cents) || 0,
    created_at: c.created_at,
    resolved_at: lastPayment.get(c.id as string) ?? null,
  }));
}

// Sans séparateur de milliers : l'espace fine insécable de toLocaleString fait
// basculer Excel FR en texte. « 1500,00 » reste un nombre.
function amount(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
function dateFr(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "";
}
// Échappement CSV + anti-injection de formule (CWE-1236) : une cellule qui
// commence par = + - @ (titre/débiteur libres) serait évaluée par Excel.
function cell(v: string): string {
  const guarded = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[";\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function buildComptaCsv(cases: ComptaCase[]): string {
  const sep = ";";
  const header = [
    "Dossier",
    "Débiteur",
    "Type",
    "Statut",
    "Créé le",
    "Encaissé le",
    "Montant réclamé (€)",
    "Montant récupéré (€)",
    "Indemnité forfaitaire (€)",
    "Reste dû (€)",
  ];
  const lines: string[][] = [header];
  const totals = { claimed: 0, recovered: 0, indemnity: 0 };
  for (const c of cases) {
    const ind = indemnityCents(c);
    totals.claimed += c.amount_claimed_cents;
    totals.recovered += c.amount_recovered_cents;
    totals.indemnity += ind;
    lines.push([
      c.title,
      c.debtor_name,
      CASE_TYPE_LABEL[c.case_type] ?? c.case_type,
      STATUS_META[c.status]?.label ?? c.status,
      dateFr(c.created_at),
      dateFr(c.resolved_at),
      amount(c.amount_claimed_cents),
      amount(c.amount_recovered_cents),
      amount(ind),
      amount(Math.max(0, c.amount_claimed_cents - c.amount_recovered_cents)),
    ]);
  }
  lines.push([
    "TOTAL",
    "",
    "",
    "",
    "",
    "",
    amount(totals.claimed),
    amount(totals.recovered),
    amount(totals.indemnity),
    amount(Math.max(0, totals.claimed - totals.recovered)),
  ]);
  return "﻿" + lines.map((r) => r.map(cell).join(sep)).join("\r\n");
}
