import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runAgent } from "@/lib/ai/client";
import type { Fact } from "@/lib/cases/extraction";

/*
 * Lecture vision d'une pièce (facture/devis/preuve) : Nora lit le CONTENU
 * du PDF ou de l'image et en extrait les faits chiffrés, sourcés et éditables
 * (la correction utilisateur prime toujours, comme pour l'extraction texte).
 * Repli silencieux (tableau vide) si non lisible, trop lourd ou en cas d'échec.
 */

const VISION_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const MAX_VISION_BYTES = 8 * 1024 * 1024;

// On accepte n'importe quel objet JSON : les modèles vision « légers »
// (gemini-flash-lite…) imbriquent souvent les champs (sous invoice_fields,
// data…) ou renvoient chaque valeur enveloppée ({value:…}). La normalisation
// ci-dessous ramène tout ça à des scalaires — plus robuste qu'un schéma rigide
// qui rejetterait silencieusement une extraction pourtant correcte.
const VISION_SCHEMA = z.record(z.string(), z.unknown());

// Clés sous lesquelles un modèle peut imbriquer les champs plutôt que de les
// mettre à plat.
const WRAPPER_KEYS = [
  "invoice_fields",
  "fields",
  "data",
  "result",
  "facture",
  "extraction",
  "champs",
];

/**
 * Aplatit un niveau d'imbrication éventuel (invoice_fields:{…} → à la racine).
 * La racine PRIME : une clé imbriquée ne comble que ce qui manque (absent, null
 * ou vide) à la racine — sinon un wrapper renvoyé « en écho » écraserait une
 * valeur correcte de la racine par un null.
 */
function flatten(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...obj };
  for (const k of WRAPPER_KEYS) {
    const nested = out[k];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      for (const [nk, nv] of Object.entries(nested as Record<string, unknown>)) {
        const cur = out[nk];
        if (cur === undefined || cur === null || cur === "") out[nk] = nv;
      }
    }
  }
  return out;
}

/** Déballe une valeur enveloppée ({value:…}, {amount:…}, {date:…}) en scalaire. */
function unwrap(v: unknown): unknown {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    return o.value ?? o.amount ?? o.montant ?? o.number ?? o.date ?? o.text ?? o.name ?? null;
  }
  return v;
}

/** Première clé non vide parmi des alias, valeur déballée. */
function pick(src: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (k in src) {
      const val = unwrap(src[k]);
      if (val !== null && val !== undefined && val !== "") return val;
    }
  }
  return null;
}

/**
 * Convertit une chaîne numérique en nombre, quelle que soit la locale :
 * « 1 234,56 » (FR), « 1,234.56 » (EN), « 1.234,56 » (FR séparateur point).
 * Heuristique : le séparateur le plus à DROITE (parmi . et ,) est le séparateur
 * décimal quand les deux coexistent ; un séparateur unique suivi d'1 à 2 chiffres
 * est décimal, sinon c'est un séparateur de milliers.
 */
function parseNumber(str: string): number | null {
  const s = str.replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized: string;
  if (lastComma !== -1 && lastDot !== -1) {
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    normalized = s.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma !== -1) {
    const decimals = s.length - lastComma - 1;
    normalized =
      s.indexOf(",") === lastComma && decimals >= 1 && decimals <= 2
        ? s.replace(",", ".")
        : s.split(",").join("");
  } else if (lastDot !== -1) {
    const decimals = s.length - lastDot - 1;
    normalized =
      s.indexOf(".") === lastDot && decimals >= 1 && decimals <= 2 ? s : s.split(".").join("");
  } else {
    normalized = s;
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Montant en CENTIMES. Le modèle DEVRAIT renvoyer des centimes entiers
 * (montant_cents), mais il dérive souvent vers des euros — surtout sous une clé
 * nommée en euros (montant/amount) ou dès qu'il y a une partie décimale / un €.
 * On tranche l'unité par le NOM de la clé (`keyInCents`) ET la FORME de la valeur :
 * un entier nu sous une clé « _cents » = déjà des centimes ; tout le reste
 * (décimale, symbole €, clé nommée en euros) = des euros → ×100. Évite le
 * sous-comptage ×100 qui stockait « 2,52 € » pour une facture de 252 €.
 */
function amountToCents(raw: unknown, keyInCents: boolean): number | null {
  const s = unwrap(raw);
  if (typeof s === "number") {
    if (!Number.isFinite(s)) return null;
    return keyInCents && Number.isInteger(s) ? Math.round(s) : Math.round(s * 100);
  }
  if (typeof s === "string") {
    const n = parseNumber(s);
    if (n === null) return null;
    const looksLikeEuros = !keyInCents || /[.,€]/.test(s);
    return looksLikeEuros ? Math.round(n * 100) : Math.round(n);
  }
  return null;
}

function toText(v: unknown): string | null {
  const s = unwrap(v);
  if (typeof s === "string" && s.trim()) return s.trim();
  if (typeof s === "number") return String(s);
  return null;
}

function eurFromCents(cents: number): string {
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`;
}

export async function readDocumentFacts(
  sb: SupabaseClient,
  input: {
    storagePath: string;
    mime: string;
    fileName: string;
    orgId: string;
    caseId: string;
    claimedCents: number;
  },
): Promise<Fact[]> {
  if (!VISION_MIME.has(input.mime)) return [];
  try {
    const { data: blob } = await sb.storage.from("documents").download(input.storagePath);
    if (!blob) return [];
    const buf = Buffer.from(await blob.arrayBuffer());
    if (buf.length <= 0 || buf.length > MAX_VISION_BYTES) return [];

    // Nora, via le bridge Hermes, mais sur un modèle VISION OpenRouter pour CET
    // appel (le bridge route le multimodal) — aucune API directe depuis l'app.
    const { data: raw } = await runAgent({
      key: "nora",
      input: {
        consigne:
          "Lis cette pièce et extrais UNIQUEMENT ce qui y est écrit. Réponds STRICTEMENT " +
          "avec un objet JSON PLAT (aucune imbrication, aucune clé supplémentaire, aucun " +
          "wrapper) exactement de cette forme : " +
          '{"montant_cents": <entier ou null>, "date_iso": <"AAAA-MM-JJ" ou null>, ' +
          '"numero_facture": <texte ou null>, "partie": <texte ou null>}. ' +
          "montant_cents = montant total TTC converti en CENTIMES (entier ; ex. 252,00 € → 25200). " +
          "Mets null pour tout champ non lisible. Aucun texte autour du JSON.",
        nom_fichier: input.fileName,
        // Anti-ancrage (pilier #3) : la lecture vision est AVEUGLE au montant
        // réclamé — sinon le modèle recopie l'attendu. Le contrôle de cohérence
        // vit en aval (analysePiece, sur la passe texte), pas ici.
      },
      schema: VISION_SCHEMA,
      simulation: {},
      organizationId: input.orgId,
      caseId: input.caseId,
      attachments: [{ mime: input.mime, dataBase64: buf.toString("base64") }],
      modelOverride: "google/gemini-2.5-flash-lite",
      maxTokens: 500,
    });

    // Normalisation tolérante (imbrication, valeurs enveloppées, alias de clés).
    const src = flatten(raw as Record<string, unknown>);
    // Clés en centimes d'abord (valeur = déjà des centimes si entière), puis clés
    // nommées en euros (valeur = euros → ×100). Sépare les deux familles pour ne
    // pas confondre l'unité (bug ×100).
    const centsRaw = pick(src, ["montant_cents", "amount_cents", "total_ttc_cents", "montant_ttc_cents"]);
    const euroRaw = pick(src, ["montant", "amount", "montant_ttc", "total_ttc", "total", "montant_total", "prix"]);
    const montantCents = centsRaw !== null ? amountToCents(centsRaw, true) : amountToCents(euroRaw, false);
    const dateIso = toText(pick(src, ["date_iso", "date", "date_facture"]));
    const numero = toText(pick(src, ["numero_facture", "numero", "invoice_number", "reference", "num"]));
    const partie = toText(pick(src, ["partie", "party", "emetteur", "fournisseur", "societe", "issuer"]));

    const facts: Fact[] = [];
    if (montantCents !== null && montantCents > 0) {
      facts.push({
        field_key: "amount_cents",
        value_text: eurFromCents(montantCents),
        value_normalized: { cents: montantCents },
        confidence: 0.9,
        source_excerpt: "Lu dans la pièce",
      });
    }
    if (dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
      facts.push({
        field_key: "date",
        value_text: dateIso,
        value_normalized: { iso: dateIso },
        confidence: 0.85,
        source_excerpt: "Lu dans la pièce",
      });
    }
    if (numero) {
      facts.push({
        field_key: "invoice_number",
        value_text: numero,
        value_normalized: { number: numero },
        confidence: 0.85,
        source_excerpt: "Lu dans la pièce",
      });
    }
    if (partie) {
      facts.push({
        field_key: "party_name",
        value_text: partie,
        value_normalized: { name: partie },
        confidence: 0.8,
        source_excerpt: "Lu dans la pièce",
      });
    }
    return facts;
  } catch {
    return [];
  }
}
