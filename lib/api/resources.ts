import "server-only";

/*
 * Formes publiques des ressources API : allowlists de colonnes explicites
 * (jamais `select *` — pour ne jamais fuir billing_*, stripe_*, ni les champs
 * d'analyse interne) + pagination par curseur keyset.
 */

// Dossiers — liste (miroir de CaseRow, montants en centimes entiers).
export const CASE_LIST_COLUMNS =
  "id, case_type, title, status, debtor_name, amount_claimed_cents, amount_recovered_cents, currency, stage, stage_total, phase, next_action_label, next_action_at, expected_recovery_at, is_sample, created_at";

// Dossiers — détail (allowlist : pas de billing/stripe, pas d'analyse interne
// type weak_points_md/devil_review/living_brief).
export const CASE_DETAIL_COLUMNS =
  "id, case_type, title, status, debtor_name, debtor_siren, debtor_email, debtor_company, debtor_address, amount_claimed_cents, amount_recovered_cents, currency, summary_md, stage, stage_total, phase, next_action_label, next_action_at, expected_recovery_at, completeness_score, is_sample, source, created_at, updated_at";

export const LETTER_COLUMNS =
  "id, kind, status, subject, channel, sent_at, tracking_status, tracking_status_at, created_at";

export const DOCUMENT_COLUMNS = "id, file_name, mime_type, size_bytes, doc_kind, doc_class, created_at";

export const EVENT_COLUMNS = "event_date, event_type, title, description, source, created_at";

export const TRACKING_COLUMNS = "id, letter_id, channel, stage, label, detail, occurred_at";

export const INVOICE_COLUMNS =
  "id, provider, external_id, invoice_number, label, customer_name, customer_email, customer_siren, customer_address, amount_cents, remaining_cents, currency, issued_on, deadline_on, status, paid, case_id, archived_at, created_at";

// ── Pagination curseur (keyset created_at desc, id desc) ─────────────────────

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export function clampLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

export type Cursor = { created_at: string; id: string };

// Validation stricte des champs du curseur : ils sont interpolés dans un filtre
// PostgREST .or(...) et le curseur est fourni par le client. L'isolation par org
// tient de toute façon (le .eq(organization_id) est un AND séparé), mais on
// refuse tout ce qui n'est pas un UUID / un timestamp pour barrer l'injection
// et les 500 de parsing.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TS_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?([+-][0-9]{2}:?[0-9]{2}|Z)?$/;

export function encodeCursor(row: { created_at: string; id: string }): string {
  return Buffer.from(JSON.stringify({ created_at: row.created_at, id: row.id }), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof o?.created_at === "string" && typeof o?.id === "string" && UUID_RE.test(o.id) && TS_RE.test(o.created_at)) {
      return { created_at: o.created_at, id: o.id };
    }
  } catch {
    // curseur illisible → on repart du début plutôt que d'échouer
  }
  return null;
}

/** Filtre PostgREST .or(...) pour la pagination keyset (created_at desc, id desc). */
export function keysetOr(cursor: Cursor): string {
  return `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`;
}
