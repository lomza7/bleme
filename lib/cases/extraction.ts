import "server-only";

/*
 * Extraction des faits d'une pièce : montant, échéance, n° de facture.
 * Chaque valeur porte sa SOURCE (l'extrait qui la justifie) et une confiance ;
 * elle reste éditable et une correction utilisateur prime toujours.
 *
 * Passe déterministe (texte + nom de fichier), fiable et sans coût. Le pipeline
 * — table document_extractions, affichage éditable, alimentation de la
 * complétude — est prêt à recevoir une extraction IA vision (OCR) quand un
 * modèle vision et les clés seront branchés : il suffira de fusionner ses
 * champs ici.
 */

export type Fact = {
  field_key: string;
  value_text: string;
  value_normalized: Record<string, unknown> | null;
  confidence: number;
  source_excerpt: string | null;
};

const MONTHS: Record<string, number> = {
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
};

function firstAmountCents(text: string): { cents: number; excerpt: string } | null {
  // "2 400,00 €", "2400€", "1 234.50 EUR"
  const re = /(\d{1,3}(?:[ .]\d{3})*(?:[.,]\d{1,2})?)\s*(?:€|eur\b|euros?)/gi;
  const m = re.exec(text);
  if (!m) return null;
  const raw = m[1].replace(/[ .](?=\d{3}\b)/g, "").replace(",", ".");
  const value = parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  const at = m.index;
  return { cents: Math.round(value * 100), excerpt: text.slice(Math.max(0, at - 24), at + m[0].length + 4).trim() };
}

function firstDate(text: string): { iso: string; excerpt: string } | null {
  const num = /(\b\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/.exec(text);
  if (num) {
    const [, d, mo, y] = num;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const iso = `${year}-${String(Number(mo)).padStart(2, "0")}-${String(Number(d)).padStart(2, "0")}`;
    if (Number(mo) >= 1 && Number(mo) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return { iso, excerpt: text.slice(Math.max(0, num.index - 20), num.index + num[0].length).trim() };
    }
  }
  const txt = /\b(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/i.exec(text);
  if (txt) {
    const [, d, moName, y] = txt;
    const mo = MONTHS[moName.toLowerCase()];
    const iso = `${y}-${String(mo).padStart(2, "0")}-${String(Number(d)).padStart(2, "0")}`;
    return { iso, excerpt: txt[0] };
  }
  return null;
}

function invoiceNumber(text: string, fileName: string): { value: string; excerpt: string } | null {
  const re = /\b(?:facture|invoice|fact\.?)\s*(?:n[°o]?\s*)?[:.]?\s*([A-Z0-9][A-Z0-9-/]{2,20})/i;
  const m = re.exec(text) ?? re.exec(fileName);
  // Un vrai numéro contient au moins un chiffre (évite de mordre sur « facture.txt »).
  if (m && /\d/.test(m[1])) return { value: m[1], excerpt: m[0] };
  const f = /\b([A-Z]{1,3}[-_]?\d{3,}(?:[-/]\d+)*)\b/.exec(fileName);
  if (f) return { value: f[1], excerpt: fileName };
  return null;
}

/** Détecte les faits depuis le contenu texte (si lisible) et le nom du fichier. */
export function detectFacts(text: string, fileName: string): Fact[] {
  const hay = `${fileName}\n${text}`.slice(0, 20000);
  const facts: Fact[] = [];

  const amount = firstAmountCents(hay);
  if (amount) {
    facts.push({
      field_key: "amount_cents",
      value_text: `${(amount.cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`,
      value_normalized: { cents: amount.cents },
      confidence: text ? 0.85 : 0.6,
      source_excerpt: amount.excerpt,
    });
  }
  const date = firstDate(hay);
  if (date) {
    facts.push({
      field_key: "date",
      value_text: date.iso,
      value_normalized: { iso: date.iso },
      confidence: 0.7,
      source_excerpt: date.excerpt,
    });
  }
  const inv = invoiceNumber(text, fileName);
  if (inv) {
    facts.push({
      field_key: "invoice_number",
      value_text: inv.value,
      value_normalized: { number: inv.value },
      confidence: 0.75,
      source_excerpt: inv.excerpt,
    });
  }
  return facts;
}

export const FIELD_LABEL: Record<string, string> = {
  amount_cents: "Montant",
  date: "Date",
  invoice_number: "N° de facture",
  creditor_name: "Émetteur (créancier)",
  debtor_name: "Destinataire (débiteur)",
  party_name: "Partie", // legacy : anciennes extractions
};
