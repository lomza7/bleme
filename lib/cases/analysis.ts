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
    if (hasText && !readable && cents === null && facts.length === 0) {
      // Non lisible ET aucune donnée extraite (ni texte, ni vision) : à confirmer.
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
  const looksInvoice = INVOICE_RE.test(text);
  // Le classement « facture » est corroboré par le texte OU par un montant lu en
  // vision (readable n'est plus requis : une facture scannée dont la vision a lu
  // le montant est bien une facture).
  const confirmed =
    docKind !== "facture" || looksInvoice || facts.some((f) => f.field_key === "amount_cents");
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

// Ensemble des valeurs de classement valides (pour normaliser la sortie de Nora).
const DOC_KIND_VALUES = new Set(DOC_KINDS.map((k) => k.value));
const DOC_KIND_BY_LABEL = new Map(DOC_KINDS.map((k) => [k.label.toLowerCase(), k.value]));

/**
 * Normalise un type de pièce renvoyé par l'agent vers une valeur DOC_KINDS
 * valide (accepte la valeur exacte OU le libellé). Renvoie null si non reconnu
 * — jamais de classement fantaisiste.
 */
export function normalizeDocKind(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (DOC_KIND_VALUES.has(s)) return s;
  if (DOC_KIND_BY_LABEL.has(s)) return DOC_KIND_BY_LABEL.get(s) ?? null;
  // Synonymes courants renvoyés par le modèle.
  if (/factur|honoraire/.test(s)) return "facture";
  if (/devis|contrat|commande/.test(s)) return "devis_contrat";
  if (/livraison|photo|chantier/.test(s)) return "preuve_livraison";
  if (/envoi|réception|reception|recommand|accus/.test(s)) return "preuve_envoi";
  if (/échange|echange|email|courriel|sms|whatsapp|message/.test(s)) return "echanges";
  if (/administrat|décision|decision|préfe|prefe/.test(s)) return "decision_admin";
  if (/justif|jugement|plainte|attestation/.test(s)) return "justificatif";
  return null;
}

/**
 * Classement DÉTERMINISTE d'une pièce à partir de son contenu (socle de repli
 * quand l'agent échoue, et amorce avant sa lecture). Le classement pilote la
 * checklist « pièces suggérées » : on ne force un type que sur un signal net,
 * on renvoie null (non classé) plutôt que de deviner à tort.
 */
export function guessDocKind(input: {
  fileName: string;
  text: string;
  facts: Fact[];
  docClass: string;
  mime: string;
  caseType: string;
}): string | null {
  const { fileName, text, facts, docClass, mime, caseType } = input;
  if (docClass === "whatsapp_export") return "echanges";
  const hay = `${fileName}\n${text}`.toLowerCase();
  const hasAmount = facts.some((f) => f.field_key === "amount_cents");

  // Facture : signal fort (mention explicite, ou montant + vocabulaire comptable).
  if (/factur|note d'honoraire/.test(hay)) return "facture";
  // Décision / courrier de l'administration.
  if (/d[ée]cision|arr[êe]t[ée]|notification|pr[ée]fect|rectorat|urssaf|administration|titre ex[ée]cutoire|avis d'imposition|refus de/.test(hay)) return "decision_admin";
  // Devis / contrat / bon de commande.
  if (/devis|bon de commande|contrat|proposition commerciale/.test(hay)) return "devis_contrat";
  // Preuve d'envoi / réception.
  if (/accus[ée] de r[ée]ception|recommand[ée]|lettre suivie|bordereau|num[ée]ro de suivi|avis de passage/.test(hay)) return "preuve_envoi";
  // Preuve de livraison / réception de travaux.
  if (/bon de livraison|proc[èe]s-verbal|pv de r[ée]ception|fin de travaux|livraison/.test(hay)) return "preuve_livraison";
  // Facture : signal faible (montant + vocabulaire TTC/HT/TVA).
  if (hasAmount && /\bttc\b|\bht\b|\btva\b|\btotal\b/.test(hay)) return "facture";
  // Justificatif (jugement, plainte, attestation…).
  if (/jugement|ordonnance|plainte|attestation|certificat|constat|justificatif/.test(hay)) return "justificatif";
  // Échanges écrits.
  if (/e-?mail|courriel|\bsms\b|whatsapp|\bobjet\s*:|\bde\s*:.*@/.test(hay)) return "echanges";
  if (hasAmount) return "facture";
  // Image sans texte exploitable : on s'appuie sur la nature du dossier.
  if (mime.startsWith("image/")) {
    if (caseType === "client_dispute") return "preuve_livraison";
    if (caseType === "admin_request") return "justificatif";
  }
  return null;
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
