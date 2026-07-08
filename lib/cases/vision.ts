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

/** Déballe une valeur enveloppée ({valeur:…}, {value:…}, {amount:…}…) en scalaire. */
function unwrap(v: unknown): unknown {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    return (
      o.valeur ?? o.value ?? o.amount ?? o.montant ?? o.number ?? o.numero ?? o.date ?? o.text ?? o.nom ?? o.name ?? null
    );
  }
  return v;
}

type FieldParts = { value: unknown; confidence: number | null; excerpt: string | null };

/**
 * Décompose un champ en { valeur, confiance, extrait } : le modèle vision renvoie
 * souvent chaque champ enveloppé ({valeur/value, confiance/confidence,
 * extrait/context}). On récupère ainsi la confiance et l'extrait RÉELS du modèle
 * (au lieu de constantes en dur) — pilier #3 : chaque valeur porte sa source.
 */
function fieldParts(raw: unknown): FieldParts {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const conf = typeof o.confiance === "number" ? o.confiance : typeof o.confidence === "number" ? o.confidence : null;
    const exc =
      [o.extrait, o.extrait_source, o.context, o.source, o.contexte].find(
        (x): x is string => typeof x === "string" && x.trim().length > 0,
      ) ?? null;
    return { value: unwrap(raw), confidence: conf, excerpt: exc };
  }
  return { value: raw, confidence: null, excerpt: null };
}

/** Cherche le champ (par alias) et le décompose en parts. */
function pickField(src: Record<string, unknown>, keys: string[]): FieldParts {
  for (const k of keys) {
    if (k in src && src[k] !== null && src[k] !== undefined && src[k] !== "") {
      return fieldParts(src[k]);
    }
  }
  return { value: null, confidence: null, excerpt: null };
}

/** Confiance bornée [0,1] ; repli sur une valeur par défaut si le modèle n'en donne pas. */
function conf(parts: FieldParts, fallback: number): number {
  if (parts.confidence !== null && parts.confidence >= 0 && parts.confidence <= 1) return parts.confidence;
  return fallback;
}

/** Extrait source réel du modèle, sinon la mention générique. */
function excerpt(parts: FieldParts): string {
  return parts.excerpt?.trim() || "Lu dans la pièce";
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
          "Lis cette pièce et extrais UNIQUEMENT ce qui y est écrit, sans rien deviner. " +
          "Distingue bien l'ÉMETTEUR (en-tête, coordonnées, IBAN, « émis par ») du DESTINATAIRE " +
          "(« Facturé à », « Client », « Adressé à »). " +
          "Réponds STRICTEMENT avec un objet JSON à ces clés, chaque valeur étant un objet " +
          '{valeur, confiance, extrait} : {"montant_cents":{"valeur":<entier centimes ou null>,"confiance":<0-1>,"extrait":<texte lu ou null>}, ' +
          '"date_iso":{"valeur":<"AAAA-MM-JJ" ou null>,"confiance":<0-1>,"extrait":...}, ' +
          '"numero_facture":{"valeur":<texte ou null>,"confiance":<0-1>,"extrait":...}, ' +
          '"emetteur":{"valeur":<nom du créancier ou null>,"confiance":<0-1>,"extrait":...}, ' +
          '"destinataire":{"valeur":<nom du débiteur ou null>,"confiance":<0-1>,"extrait":...}}. ' +
          "montant_cents = montant total TTC en CENTIMES (ex. 252,00 € → 25200). " +
          "confiance = ta certitude réelle entre 0 et 1. extrait = le texte exact d'où vient la valeur. " +
          "Mets valeur:null pour tout champ non lisible. Aucun texte autour du JSON.",
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
      // Modèle vision = facteur limitant de la précision preuves. flash (et non
      // flash-lite) : lecture plus fiable des factures/devis, coût borné (1
      // lecture par pièce). Reste OFF du MOA (la branche MOA ignore attachments).
      modelOverride: "google/gemini-2.5-flash",
      maxTokens: 500,
    });

    // Normalisation tolérante (imbrication, valeurs enveloppées, alias de clés).
    const src = flatten(raw as Record<string, unknown>);
    // Chaque champ porte sa confiance et son extrait RÉELS (via pickField) ;
    // les montants : clés en centimes d'abord (valeur = déjà des centimes si
    // entière), puis clés nommées en euros (×100) — pour ne pas confondre l'unité.
    const centsF = pickField(src, ["montant_cents", "amount_cents", "total_ttc_cents", "montant_ttc_cents"]);
    const euroF = pickField(src, ["montant", "amount", "montant_ttc", "total_ttc", "total", "montant_total", "prix"]);
    const amountField = centsF.value !== null ? centsF : euroF;
    const montantCents =
      centsF.value !== null ? amountToCents(centsF.value, true) : amountToCents(euroF.value, false);
    const dateF = pickField(src, ["date_iso", "date", "date_facture"]);
    const dateIso = toText(dateF.value);
    const numeroF = pickField(src, ["numero_facture", "numero", "invoice_number", "reference", "num"]);
    const numero = toText(numeroF.value);
    // Émetteur = créancier ; destinataire = débiteur. Séparés (fini la confusion
    // du champ « partie » unique). Alias legacy tolérés côté émetteur.
    const emetteurF = pickField(src, ["emetteur", "issuer", "fournisseur", "societe", "creditor", "partie", "party"]);
    const emetteur = toText(emetteurF.value);
    const destinataireF = pickField(src, ["destinataire", "client", "debtor", "recipient", "adresse_a"]);
    const destinataire = toText(destinataireF.value);

    const facts: Fact[] = [];
    if (montantCents !== null && montantCents > 0) {
      facts.push({
        field_key: "amount_cents",
        value_text: eurFromCents(montantCents),
        value_normalized: { cents: montantCents },
        confidence: conf(amountField, 0.9),
        source_excerpt: excerpt(amountField),
      });
    }
    if (dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
      facts.push({
        field_key: "date",
        value_text: dateIso,
        value_normalized: { iso: dateIso },
        confidence: conf(dateF, 0.85),
        source_excerpt: excerpt(dateF),
      });
    }
    if (numero) {
      facts.push({
        field_key: "invoice_number",
        value_text: numero,
        value_normalized: { number: numero },
        confidence: conf(numeroF, 0.85),
        source_excerpt: excerpt(numeroF),
      });
    }
    if (emetteur) {
      facts.push({
        field_key: "creditor_name",
        value_text: emetteur,
        value_normalized: { name: emetteur },
        confidence: conf(emetteurF, 0.8),
        source_excerpt: excerpt(emetteurF),
      });
    }
    if (destinataire) {
      facts.push({
        field_key: "debtor_name",
        value_text: destinataire,
        value_normalized: { name: destinataire },
        confidence: conf(destinataireF, 0.8),
        source_excerpt: excerpt(destinataireF),
      });
    }
    return facts;
  } catch {
    return [];
  }
}
