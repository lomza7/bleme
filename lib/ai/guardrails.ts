import "server-only";

/*
 * Garde-fou anti-conseil UNIQUE et partagé (pilier non-négociable #2).
 *
 * Toute sortie d'agent destinée à l'utilisateur ou au débiteur (courrier,
 * synthèse, revue, question d'intake, alerte) passe par ce filtre AVANT
 * persistance/affichage : si un vocabulaire de conseil juridique ou de
 * pronostic d'issue apparaît, on rejette la sortie IA au profit du repli
 * déterministe (gabarit conforme). Un seul lexique, ici, pour que le filet
 * serveur couvre EXACTEMENT ce que les personas interdisent (avant, la regex
 * était dupliquée et plus étroite que les prompts → l'interdit passait).
 *
 * Deux pièges de faux positif traités explicitement :
 *  - « garantie » (décennale, légale, de paiement) est un terme LÉGITIME d'un
 *    litige B2B : on ne bloque que « garanti »/« garantis » (promesse), jamais
 *    le substantif féminin « garantie(s) ».
 *  - « gagner/perdre du temps » (ou patience) est légitime : on ne bloque
 *    « gagner »/« perdre » que hors de ces tournures de temps.
 */

const PATTERNS: string[] = [
  // Pronostic / issue du dossier
  "\\bgagner\\b(?!\\s+(?:du|de\\s+la)\\s+temps)",
  "\\bperdre\\b(?!\\s+(?:du|de)\\s+temps|\\s+patience|\\s+de\\s+vue)",
  "gain\\s+de\\s+cause",
  "vos?\\s+chances",
  "chances?\\s+de",
  "vous\\s+risquez",
  "pronostic",
  "strat[ée]gie\\s+judiciaire",
  // Conseil personnalisé / promesse de résultat
  "je\\s+vous\\s+conseille",
  "vous\\s+devriez",
  "vous\\s+obtiendrez",
  "recours\\s+gagnant",
  "\\bà\\s+coup\\s+s[ûu]r\\b",
  "promesse\\s+de\\s+r[ée]sultat",
  "optimiser",
  // « garanti/garantis » (promesse) mais PAS « garantie(s) » (terme légitime)
  "\\bgarantis?\\b(?!e)",
];

/** Lexique unique de détection du conseil/pronostic (pilier #2). */
export const ADVICE_RE = new RegExp(PATTERNS.join("|"), "i");

/** Vrai si l'un des textes contient du vocabulaire de conseil ou de pronostic. */
export function hasAdvice(...texts: (string | null | undefined)[]): boolean {
  return texts.some((t) => ADVICE_RE.test(t ?? ""));
}

/**
 * Filtre une liste (questions, alertes…) : ne garde que les entrées SANS
 * vocabulaire de conseil. Utilisé pour un rejet au grain fin (on ne jette pas
 * toute la liste parce qu'une entrée dérape).
 */
export function keepClean(items: string[]): string[] {
  return items.filter((t) => t.trim() && !ADVICE_RE.test(t));
}
