import "server-only";
import { z } from "zod";
import { runAgent } from "@/lib/ai/client";

/*
 * Socle juridique d'un dossier (volet « récupération » du mode hybride).
 *
 * Avant qu'un agent rédige, on récupère UNE FOIS par type de dossier les
 * sources françaises applicables (articles clés + 1-2 arrêts de principe) via
 * les outils Légifrance/JUDILIBRE du bridge. Ces sources — RÉELLES, jamais
 * inventées — sont fournies au rédacteur comme socle garanti ; l'agent peut
 * ensuite creuser des sources propres au dossier via les mêmes outils (volet
 * « agentique »). Résultat mis en cache (la loi ne dépend pas du dossier), donc
 * une seule vraie récupération par type et par fenêtre de fraîcheur.
 */

export type LegalArticle = { numero: string; intitule: string; extrait: string };
export type LegalArret = { juridiction: string; date: string; numero: string; portee: string };
export type LegalSocle = { articles: LegalArticle[]; arrets: LegalArret[] };

const EMPTY: LegalSocle = { articles: [], arrets: [] };

const SOCLE_SCHEMA = z.object({
  articles: z
    .array(
      z.object({
        numero: z.string().default(""),
        intitule: z.string().default(""),
        extrait: z.string().default(""),
      }),
    )
    .default([]),
  arrets: z
    .array(
      z.object({
        juridiction: z.string().default(""),
        date: z.string().default(""),
        numero: z.string().default(""),
        portee: z.string().default(""),
      }),
    )
    .default([]),
});

// Requête PRESCRIPTIVE par type de dossier : on nomme les articles précis à
// récupérer et le sujet exact de jurisprudence, pour que les recherches d'outils
// tombent sur les bonnes sources (une requête vague ramène du hors-sujet).
const SUBJECT_BY_TYPE: Record<string, string> = {
  unpaid_invoice:
    "Récupère via legifrance.consulter_article (id obtenu par legifrance.rechercher_loi) le texte des " +
    "articles L441-10 et D441-5 du Code de commerce (pénalités de retard et indemnité forfaitaire de " +
    "recouvrement de 40 € entre professionnels) et des articles 1231-6 et 1344 du Code civil (mise en " +
    "demeure). Puis, via judilibre.rechercher (search précis, ex. « indemnité forfaitaire frais de " +
    "recouvrement professionnel retard de paiement »), trouve 1 arrêt de la Cour de cassation (chambre " +
    "commerciale de préférence) qui confirme le droit du créancier professionnel à ces sommes de plein droit.",
  client_dispute:
    "Récupère via legifrance les articles pertinents du Code civil sur l'exécution du contrat : 1103 " +
    "(force obligatoire), 1217 et 1219 (inexécution et exception d'inexécution), 1353 (charge de la preuve), " +
    "et le cas échéant la garantie légale de conformité / des vices. Puis, via judilibre.rechercher, trouve " +
    "1 arrêt pertinent sur la contestation d'une prestation, la réception sans réserve ou l'exception d'inexécution.",
  admin_request:
    "Récupère via legifrance (Livre des procédures fiscales) les articles sur la réclamation contentieuse " +
    "(R*196-1 LPF, délais) et la demande gracieuse (L247 LPF), et via judilibre/justice administrative 1 " +
    "décision de principe pertinente. Ne cite que ce que les outils renvoient.",
};

// Cache global par type (la loi est universelle) ; fraîcheur 6 h.
const cache = new Map<string, { at: number; data: LegalSocle }>();
const TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Récupère (et met en cache) le socle juridique applicable à un type de dossier.
 * L'agent `agentKey` doit avoir legifrance + judilibre activés (agent_tool_apis).
 * Ne lève jamais : renvoie un socle vide si indisponible (l'agentique prendra le relais).
 */
export async function legalSocle(
  caseType: string,
  agentKey: string,
  opts?: { organizationId?: string | null; caseId?: string | null },
): Promise<LegalSocle> {
  const subject = SUBJECT_BY_TYPE[caseType];
  if (!subject) return EMPTY;

  const cached = cache.get(caseType);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.data;

  try {
    const { data } = await runAgent({
      key: agentKey,
      input: {
        consigne:
          "Utilise les outils legifrance (rechercher_loi, consulter_article) et judilibre " +
          "(rechercher) pour identifier les sources juridiques FRANÇAISES applicables au sujet ci-dessous. " +
          "Ne cite QUE ce que les outils renvoient réellement — jamais de référence, de numéro d'arrêt ni " +
          "de date inventés. Renvoie 2 à 4 articles clés (avec un court extrait fidèle) et 1 à 2 arrêts de " +
          "principe pertinents. Réponds en JSON { articles:[{numero, intitule, extrait}], arrets:[{juridiction, date, numero, portee}] }.",
        sujet: subject,
      },
      schema: SOCLE_SCHEMA,
      simulation: EMPTY,
      organizationId: opts?.organizationId ?? null,
      caseId: opts?.caseId ?? null,
      maxTokens: 1600,
    });
    // On ne garde que des entrées substantielles (numéro d'article / d'arrêt présent).
    const clean: LegalSocle = {
      articles: data.articles.filter((a) => a.numero.trim()),
      arrets: data.arrets.filter((a) => a.numero.trim() || a.date.trim()),
    };
    cache.set(caseType, { at: Date.now(), data: clean });
    return clean;
  } catch {
    return EMPTY;
  }
}

/** Vrai si le socle contient au moins une source exploitable. */
export function hasSources(s: LegalSocle): boolean {
  return s.articles.length > 0 || s.arrets.length > 0;
}
