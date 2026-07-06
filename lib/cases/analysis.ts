import "server-only";
import type { Fact } from "@/lib/cases/extraction";
import { FIELD_LABEL } from "@/lib/cases/extraction";
import { DOC_KINDS } from "@/lib/cases/completeness";
import type { Finding, PieceAnalysis } from "@/lib/cases/analysis-types";

/*
 * Analyse de cohérence d'une pièce : classement + faits extraits + contrôles
 * (facture sans montant, montant ≠ réclamé, date aberrante). Alimente la popup
 * d'analyse en direct et les alertes du dossier — pour ne plus laisser passer
 * un dossier incohérent. Contrôles déterministes, jamais de valeur inventée.
 */

const KIND_LABEL: Record<string, string> = Object.fromEntries(
  DOC_KINDS.map((k) => [k.value, k.label]),
);

const eur = (cents: number) =>
  `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €`;

function amountCents(facts: Fact[]): number | null {
  const f = facts.find((x) => x.field_key === "amount_cents");
  const c = f?.value_normalized && (f.value_normalized as { cents?: number }).cents;
  return typeof c === "number" && c > 0 ? c : null;
}

function futureDate(facts: Fact[]): string | null {
  const f = facts.find((x) => x.field_key === "date");
  const iso = f?.value_normalized && (f.value_normalized as { iso?: string }).iso;
  if (iso && new Date(iso).getTime() > Date.now() + 86_400_000) return f?.value_text ?? iso;
  return null;
}

// Le contenu ressemble-t-il vraiment à une facture ? (mentions + symbole €)
const INVOICE_RE = /facture|montant|\btotal\b|t\.?v\.?a|\bht\b|\bttc\b|honoraires|€|\beuros?\b/i;

/**
 * Contrôles de cohérence d'UNE pièce, dans le contexte du dossier.
 * `text` : contenu lisible du document. `undefined` = pas d'analyse de contenu
 * (recalcul persistant sur faits stockés) ; `""` = fichier non lisible
 * (image / PDF scanné) → on ne « valide » pas, on demande confirmation ;
 * une chaîne = texte analysable (on vérifie que le type déclaré colle).
 */
export function pieceCoherence(
  docKind: string | null,
  facts: Fact[],
  claimedCents: number,
  text?: string,
): Finding[] {
  const out: Finding[] = [];
  const cents = amountCents(facts);
  const hasText = typeof text === "string";
  const readable = hasText && (text as string).trim().length >= 20;
  const looksInvoice = hasText && INVOICE_RE.test(text as string);

  // Le type déclaré est-il crédible au vu du contenu ?
  if (docKind === "facture") {
    if (hasText && !readable) {
      out.push({ level: "warn", message: "Contenu non lisible automatiquement (image ou PDF scanné) : type « Facture » à confirmer, pas encore vérifié." });
    } else if (readable && !looksInvoice && cents === null) {
      out.push({ level: "warn", message: "Ce document ne ressemble pas à une facture : ni montant ni mention de facture repérés." });
    } else if (cents === null) {
      out.push({ level: "warn", message: "Aucun montant repéré sur cette facture." });
    }
  }

  if (cents !== null && claimedCents > 0) {
    const diff = Math.abs(cents - claimedCents);
    if (diff > Math.max(100, claimedCents * 0.01)) {
      out.push({ level: "warn", message: `Montant repéré ${eur(cents)}, mais le dossier réclame ${eur(claimedCents)}.` });
    } else {
      out.push({ level: "ok", message: `Montant ${eur(cents)} cohérent avec le dossier.` });
    }
  }
  const fut = futureDate(facts);
  if (fut) out.push({ level: "warn", message: `Date dans le futur repérée (${fut}).` });

  if (out.length === 0) {
    out.push({ level: "ok", message: facts.length ? "Informations extraites, rien d'incohérent." : "Pièce ajoutée au dossier." });
  }
  return out;
}

/** Analyse complète d'une pièce (classement + faits + cohérence) pour la popup. */
export function analysePiece(
  fileName: string,
  docKind: string | null,
  facts: Fact[],
  claimedCents: number,
  text: string,
): PieceAnalysis {
  const readable = text.trim().length >= 20;
  const looksInvoice = INVOICE_RE.test(text);
  // Le classement est « confirmé » seulement si le contenu le corrobore.
  const confirmed = docKind !== "facture" || (readable && (looksInvoice || facts.some((f) => f.field_key === "amount_cents")));
  return {
    fileName,
    kindLabel: KIND_LABEL[docKind ?? "autre"] ?? "Pièce",
    kindConfirmed: confirmed,
    facts: facts.map((f) => ({
      field: f.field_key,
      label: FIELD_LABEL[f.field_key] ?? f.field_key,
      value: f.value_text ?? "—",
      confidence: f.confidence,
    })),
    coherence: pieceCoherence(docKind, facts, claimedCents, text),
  };
}

/** Alertes de cohérence à l'échelle du dossier (warns uniquement, dédupliqués). */
export function dossierWarnings(
  caseType: string,
  claimedCents: number,
  docs: { doc_kind: string | null; facts: Fact[] }[],
): Finding[] {
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const d of docs) {
    for (const f of pieceCoherence(d.doc_kind, d.facts, claimedCents)) {
      if (f.level === "warn" && !seen.has(f.message)) {
        seen.add(f.message);
        out.push(f);
      }
    }
  }
  const anyInvoiceAmount = docs.some((d) => d.doc_kind === "facture" && amountCents(d.facts) !== null);
  if (caseType === "unpaid_invoice" && docs.length > 0 && !anyInvoiceAmount) {
    const m = "Aucune facture avec un montant lisible n'est rattachée.";
    if (!seen.has(m)) out.push({ level: "warn", message: m });
  }
  return out;
}
