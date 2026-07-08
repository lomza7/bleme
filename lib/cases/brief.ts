import "server-only";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { buildCaseContext, type CaseContext } from "@/lib/cases/context";
import { runAgent } from "@/lib/ai/client";
import { hasAdvice } from "@/lib/ai/guardrails";
import { STATUS_META } from "@/lib/cases/constants";

/*
 * Synthèse vivante d'un dossier (Sacha). À chaque évolution notable — pièce
 * ajoutée, courrier envoyé, retour du débiteur… — on régénère un récapitulatif
 * markdown neutre et factuel, le « point zéro » consultable d'un coup d'œil,
 * stocké dans cases.living_brief_md. Trois garde-fous anti-conseil : consigne
 * contrainte, schéma borné, filtre serveur (hasAdvice) qui bascule sur un repli
 * déterministe sans IA si un vocabulaire de pronostic passe. Fonction de fond :
 * elle n'échoue jamais bruyamment (toute erreur est avalée, le run étant tracé).
 */

function eur(cents: number): string {
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €`;
}

// Date courte pour la chronologie du repli (jj/mm/aaaa), sans casser si vide.
function shortDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("fr-FR");
}

// Les 9 sections de la synthèse vivante (clé JSON → titre markdown). L'ordre et
// les titres « ## » sont garantis CÔTÉ SERVEUR : l'agent ne renvoie que le
// contenu de chaque section, jamais la structure.
const BRIEF_SECTIONS = [
  ["point_zero", "Point zéro"],
  ["parties", "Parties"],
  ["montants", "Montants"],
  ["faits_chronologie", "Faits & chronologie"],
  ["pieces", "Pièces"],
  ["echanges", "Échanges"],
  ["actions_menees", "Actions menées"],
  ["points_de_vigilance", "Points de vigilance"],
  ["ou_on_en_est", "Où on en est"],
] as const;

type SectionKey = (typeof BRIEF_SECTIONS)[number][0];

const BRIEF_SCHEMA = z.object({
  point_zero: z.string().default(""),
  parties: z.string().default(""),
  montants: z.string().default(""),
  faits_chronologie: z.string().default(""),
  pieces: z.string().default(""),
  echanges: z.string().default(""),
  actions_menees: z.string().default(""),
  points_de_vigilance: z.string().default(""),
  ou_on_en_est: z.string().default(""),
});

/** Statut affiché d'un fait (traçabilité : pilier #3). */
function factStatut(f: CaseContext["facts"][number]): string {
  if (f.corrected) return "corrigé par vous";
  if (f.confidence < 0.7) return "à vérifier";
  return "détecté";
}

/**
 * Repli déterministe PAR SECTION : contenu markdown (sans le titre ##) assemblé
 * sans IA depuis le contexte. Sert de socle (échec IA) ET de filet au grain fin
 * (une section fautive/vide retombe sur sa version déterministe, pas les 9).
 */
function buildFallbackSections(ctx: CaseContext): Record<SectionKey, string> {
  const facts = ctx.facts.map((f) => {
    const s = factStatut(f);
    return `- ${f.label} : ${f.value}${s === "détecté" ? "" : ` (${s})`}`;
  });
  const timeline = ctx.timeline.slice(-8).map((t) => `- ${shortDate(t.date)} — ${t.title}`);
  const vigilances: string[] = [];
  if (ctx.weakPointsMd) vigilances.push(ctx.weakPointsMd.slice(0, 600));
  const dr = ctx.devilReview as { points?: { objection: string; remede?: string }[] } | null;
  for (const p of dr?.points ?? []) vigilances.push(`- ${p.objection}${p.remede ? ` — ${p.remede}` : ""}`);
  const statusLabel = STATUS_META[ctx.status]?.label ?? ctx.status;

  return {
    point_zero: ctx.summaryMd ? ctx.summaryMd.slice(0, 600) : `Dossier « ${ctx.title} ».`,
    parties: `- Débiteur : ${ctx.debtorName ?? "non renseigné"}`,
    montants:
      `- Montant réclamé : ${eur(ctx.amountClaimedCents)}` +
      (ctx.amountRecoveredCents > 0 ? `\n- Montant recouvré : ${eur(ctx.amountRecoveredCents)}` : ""),
    faits_chronologie: [...facts, ...timeline].join("\n"),
    pieces: ctx.documents.map((d) => `- ${d.fileName}${d.docKind ? ` (${d.docKind})` : ""}`).join("\n"),
    echanges: ctx.replies.slice(-5).map((r) => `- ${shortDate(r.receivedAt)} — ${r.body.slice(0, 140)}`).join("\n"),
    actions_menees: ctx.letters
      .map((l) => `- ${l.subject ?? l.kind}${l.sentAt ? ` (envoyé le ${shortDate(l.sentAt)})` : " (brouillon)"}`)
      .join("\n"),
    points_de_vigilance: vigilances.join("\n"),
    ou_on_en_est: `Statut : ${statusLabel}${ctx.phase ? ` — phase ${ctx.phase}` : ""}.`,
  };
}

/** Assemble le markdown final : titres et ordre côté serveur, sections vides sautées. */
function assembleBrief(
  ai: Partial<Record<SectionKey, string>>,
  fallback: Record<SectionKey, string>,
): string {
  const parts: string[] = [];
  for (const [key, title] of BRIEF_SECTIONS) {
    const aiText = (ai[key] ?? "").trim();
    // Garde-fou #2 au grain fin : une section avec conseil/pronostic retombe sur
    // son repli déterministe, sans jeter les 8 autres.
    const text = aiText && !hasAdvice(aiText) ? aiText : (fallback[key] ?? "").trim();
    if (text) parts.push(`## ${title}\n${text}`);
  }
  return parts.join("\n\n").trim();
}

/** Repli complet (échec IA total) : les 9 sections déterministes assemblées. */
function buildFallbackMd(ctx: CaseContext): string {
  return assembleBrief({}, buildFallbackSections(ctx));
}

/**
 * Régénère la synthèse vivante d'un dossier et l'écrit dans
 * cases.living_brief_md (+ horodatage et incrément de version). Ne fait rien
 * pour un dossier encore en brouillon. Ne lève jamais d'exception.
 */
export async function refreshLivingBrief(caseId: string): Promise<void> {
  try {
    const sb = createServiceClient();
    const ctx = await buildCaseContext(sb, caseId);
    if (!ctx) return;
    // On ne régénère pas pour rien : un dossier encore en brouillon n'a pas
    // de matière stable à synthétiser.
    if (ctx.status === "draft") return;

    const fallbackSections = buildFallbackSections(ctx);
    const fallbackMd = assembleBrief({}, fallbackSections);

    // Faits porteurs de leur statut de traçabilité (pilier #3) : l'agent doit
    // suffixer « (à vérifier) » et ne jamais contredire une valeur corrigée.
    const faits = ctx.facts.map((f) => ({
      champ: f.label,
      valeur: f.value,
      statut: factStatut(f),
      source: f.sourceExcerpt,
    }));

    const input = {
      consigne:
        "Produis la synthèse vivante du dossier. Renvoie un JSON avec EXACTEMENT ces 9 clés " +
        "(contenu markdown court par section, SANS le titre — le serveur l'ajoute ; chaîne vide si la section n'a pas de matière) : " +
        "point_zero, parties, montants, faits_chronologie, pieces, echanges, actions_menees, points_de_vigilance, ou_on_en_est. " +
        "Appuie-toi UNIQUEMENT sur les données fournies ; n'invente jamais une valeur ; recopie les montants tels quels (aucun calcul). " +
        "Suffixe « (à vérifier) » tout fait de statut « à vérifier » et ne contredis JAMAIS un fait « corrigé par vous ». " +
        "Formulations documentaires ; aucun conseil, pronostic ni évaluation de chances.",
      tache: "synthese_vivante",
      date_du_jour: new Date().toLocaleDateString("fr-FR"),
      dossier: { titre: ctx.title, type: ctx.caseType, statut: ctx.status, phase: ctx.phase },
      recit: ctx.summaryMd,
      points_de_vigilance: ctx.weakPointsMd,
      // Montants déjà formatés en euros : l'agent ne fait AUCUN calcul (évite les
      // conversions centimes→euros erronées). Les centimes restent la source dure.
      montant_reclame: eur(ctx.amountClaimedCents),
      montant_recupere: eur(ctx.amountRecoveredCents),
      debiteur: ctx.debtorName,
      entreprise: ctx.debtorCompany,
      faits,
      chronologie: ctx.timeline,
      pieces: ctx.documents,
      courriers: ctx.letters,
      retours: ctx.replies,
      revue_adverse: ctx.devilReview,
    };

    let md = fallbackMd;
    try {
      const { data } = await runAgent({
        key: "sacha",
        input,
        schema: BRIEF_SCHEMA,
        simulation: fallbackSections,
        organizationId: ctx.organizationId,
        caseId,
        maxTokens: 2000,
      });
      // Assemblage serveur (titres + ordre garantis) + garde-fou par section.
      md = assembleBrief(data, fallbackSections) || fallbackMd;
    } catch {
      // run en erreur déjà tracé ; on garde le socle déterministe
      md = fallbackMd;
    }

    await sb
      .from("cases")
      .update({
        living_brief_md: md,
        living_brief_updated_at: new Date().toISOString(),
        living_brief_version: (ctx.briefVersion ?? 0) + 1,
      })
      .eq("id", caseId);
  } catch {
    // Fonction de fond : jamais d'échec bruyant côté appelant.
  }
}
