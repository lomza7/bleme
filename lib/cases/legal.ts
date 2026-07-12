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
  // Socle universel des démarches administratives : le régime général des
  // recours (CRPA) et des délais contentieux (CJA) vaut pour toute autorité
  // (préfecture, ministère, DGFiP…). Les textes propres au domaine du dossier
  // (code de la route, LPF…) relèvent du volet agentique de Basile.
  admin_request:
    "Récupère via legifrance.consulter_article (id obtenu par legifrance.rechercher_loi) le texte des " +
    "articles L410-1 et L411-2 du Code des relations entre le public et l'administration (recours " +
    "administratifs gracieux et hiérarchique ; interruption du délai de recours contentieux) et des " +
    "articles R421-1 et R421-2 du Code de justice administrative (délai de recours contentieux de deux " +
    "mois ; silence gardé valant décision implicite de rejet). Puis, via justice_administrative.rechercher " +
    "ou rechercher_ta, trouve 1 décision pertinente sur le recours gracieux contre une décision " +
    "administrative individuelle. Ne cite que ce que les outils renvoient.",
};

// Socle PLANCHER vérifié : articles-clés ACTUELS par type (références stables,
// déjà nommées dans SUBJECT_BY_TYPE ci-dessus). Garde-fou face à la récupération
// outils qui, en pratique, ne complète pas toujours la chaîne rechercher_loi →
// consulter_article et peut ramener 0 article ou une référence PÉRIMÉE (ex.
// l'ancien L441-6, recodifié en L441-10 en 2019). Ce sont du droit RÉEL, à jour
// et vérifiable — pas des références inventées. Les outils continuent d'apporter
// la jurisprudence (arrêts) et les sources propres au dossier PAR-DESSUS.
const KNOWN_ARTICLES: Record<string, LegalArticle[]> = {
  unpaid_invoice: [
    {
      numero: "Article L441-10 du Code de commerce",
      intitule: "Délais de paiement, pénalités de retard et indemnité forfaitaire de recouvrement entre professionnels",
      extrait:
        "Tout professionnel en situation de retard de paiement est de plein droit débiteur, à l'égard du créancier, d'une indemnité forfaitaire pour frais de recouvrement dont le montant est fixé par décret ; des pénalités de retard sont par ailleurs exigibles le jour suivant la date de règlement figurant sur la facture.",
    },
    {
      numero: "Article D441-5 du Code de commerce",
      intitule: "Montant de l'indemnité forfaitaire pour frais de recouvrement",
      extrait: "Le montant de l'indemnité forfaitaire pour frais de recouvrement prévue à l'article L. 441-10 est fixé à 40 euros.",
    },
    {
      numero: "Article 1231-6 du Code civil",
      intitule: "Dommages et intérêts moratoires (retard de paiement d'une somme d'argent)",
      extrait:
        "Les dommages et intérêts dus à raison du retard dans le paiement d'une obligation de somme d'argent consistent dans l'intérêt au taux légal, à compter de la mise en demeure.",
    },
    {
      numero: "Article 1344 du Code civil",
      intitule: "Mise en demeure du débiteur",
      extrait:
        "Le débiteur est mis en demeure de payer soit par une sommation ou un acte portant interpellation suffisante, soit, si le contrat le prévoit, par la seule exigibilité de l'obligation.",
    },
  ],
  client_dispute: [
    { numero: "Article 1103 du Code civil", intitule: "Force obligatoire du contrat", extrait: "Les contrats légalement formés tiennent lieu de loi à ceux qui les ont faits." },
    { numero: "Article 1217 du Code civil", intitule: "Sanctions de l'inexécution du contrat", extrait: "La partie envers laquelle l'engagement n'a pas été exécuté, ou l'a été imparfaitement, peut notamment poursuivre l'exécution forcée en nature, demander une réduction du prix, provoquer la résolution du contrat ou demander réparation des conséquences de l'inexécution." },
    { numero: "Article 1219 du Code civil", intitule: "Exception d'inexécution", extrait: "Une partie peut refuser d'exécuter son obligation, alors même que celle-ci est exigible, si l'autre n'exécute pas la sienne et si cette inexécution est suffisamment grave." },
    { numero: "Article 1353 du Code civil", intitule: "Charge de la preuve", extrait: "Celui qui réclame l'exécution d'une obligation doit la prouver. Réciproquement, celui qui se prétend libéré doit justifier le paiement ou le fait qui a produit l'extinction de son obligation." },
  ],
  admin_request: [
    { numero: "Article L410-1 du Code des relations entre le public et l'administration", intitule: "Recours administratifs (gracieux et hiérarchique)", extrait: "Toute décision administrative peut faire l'objet, dans le délai imparti pour l'introduction d'un recours contentieux, d'un recours gracieux ou hiérarchique qui interrompt le cours de ce délai." },
    { numero: "Article L411-2 du Code des relations entre le public et l'administration", intitule: "Interruption du délai de recours contentieux par un recours administratif", extrait: "L'exercice d'un recours administratif préalable, gracieux ou hiérarchique, conserve le délai du recours contentieux." },
    { numero: "Article R421-1 du Code de justice administrative", intitule: "Délai de recours contentieux de deux mois", extrait: "La juridiction ne peut être saisie que par voie de recours formé contre une décision, et ce, dans les deux mois à partir de la notification ou de la publication de la décision attaquée." },
    { numero: "Article R421-2 du Code de justice administrative", intitule: "Silence de l'administration valant décision implicite de rejet", extrait: "Sauf disposition contraire, le silence gardé pendant plus de deux mois par l'autorité administrative sur une demande vaut décision de rejet, ouvrant le délai de recours contentieux." },
  ],
};

// Cache global par type (la loi est universelle). Un socle NON VIDE est gardé 6 h ;
// un socle vide (PISTE indisponible, JSON partiel) n'est gardé que brièvement pour
// ne pas marteler le bridge tout en s'auto-guérissant dès que les sources reviennent.
const cache = new Map<string, { at: number; ttl: number; data: LegalSocle }>();
const TTL_OK = 6 * 60 * 60 * 1000;
const TTL_EMPTY = 5 * 60 * 1000;

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
  if (cached && Date.now() - cached.at < cached.ttl) return cached.data;

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
    // Articles : pour un type CONNU, le plancher vérifié fait foi (les outils
    // sous-performent sur les articles et peuvent ramener une référence périmée) ;
    // pour un type inconnu, on garde ce que les outils ont ramené. Arrêts :
    // toujours ceux des outils (JUDILIBRE, fiable). On ne garde que le substantiel.
    const floor = KNOWN_ARTICLES[caseType];
    const clean: LegalSocle = {
      articles: floor && floor.length > 0 ? floor : data.articles.filter((a) => a.numero.trim()),
      arrets: data.arrets.filter((a) => a.numero.trim() || a.date.trim()),
    };
    cache.set(caseType, { at: Date.now(), ttl: hasSources(clean) ? TTL_OK : TTL_EMPTY, data: clean });
    return clean;
  } catch {
    // Outils indisponibles : on garde au moins le plancher vérifié (sans arrêt).
    const floor = KNOWN_ARTICLES[caseType] ?? [];
    const fallback: LegalSocle = { articles: floor, arrets: [] };
    cache.set(caseType, { at: Date.now(), ttl: floor.length > 0 ? TTL_OK : TTL_EMPTY, data: fallback });
    return fallback;
  }
}

/** Vrai si le socle contient au moins une source exploitable. */
export function hasSources(s: LegalSocle): boolean {
  return s.articles.length > 0 || s.arrets.length > 0;
}
