import "server-only";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { buildCaseContext, type CaseContext } from "@/lib/cases/context";
import { runAgent } from "@/lib/ai/client";
import { hasAdvice } from "@/lib/ai/guardrails";

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

const BRIEF_SCHEMA = z.object({ synthese_md: z.string().max(4000) });

/**
 * Repli déterministe : synthèse markdown assemblée sans IA depuis le contexte.
 * Toujours factuelle — titre, parties, rappel du récit, faits et chronologie.
 */
function buildFallbackMd(ctx: CaseContext): string {
  const lines: string[] = [];
  lines.push(`# Synthèse — ${ctx.title}`);
  lines.push("");

  lines.push("## Parties");
  lines.push(`- Débiteur : ${ctx.debtorName ?? "non renseigné"}`);
  lines.push(`- Montant réclamé : ${eur(ctx.amountClaimedCents)}`);
  if (ctx.amountRecoveredCents > 0) {
    lines.push(`- Montant recouvré : ${eur(ctx.amountRecoveredCents)}`);
  }
  lines.push("");

  if (ctx.summaryMd) {
    lines.push("## Récit");
    lines.push(ctx.summaryMd.slice(0, 800));
    lines.push("");
  }

  if (ctx.facts.length > 0) {
    lines.push("## Faits");
    for (const f of ctx.facts) {
      lines.push(`- ${f.label} : ${f.value}`);
    }
    lines.push("");
  }

  const recent = ctx.timeline.slice(-8);
  if (recent.length > 0) {
    lines.push("## Chronologie");
    for (const t of recent) {
      lines.push(`- ${shortDate(t.date)} — ${t.title}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
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

    const fallbackMd = buildFallbackMd(ctx);

    const input = {
      consigne:
        "Produis une SYNTHÈSE MARKDOWN neutre et factuelle du dossier, en français, avec EXACTEMENT ces sections en titres markdown « ## » : « Point zéro », « Parties », « Montants », « Faits & chronologie », « Pièces », « Échanges », « Actions menées », « Points de vigilance », « Où on en est ». Appuie-toi uniquement sur les faits fournis en entrée ; n'invente jamais une valeur ; JAMAIS de conseil, de pronostic ni d'évaluation de chances ; formulations documentaires. Réponds en JSON { \"synthese_md\": \"...\" }.",
      dossier: { titre: ctx.title, type: ctx.caseType, statut: ctx.status, phase: ctx.phase },
      recit: ctx.summaryMd,
      points_de_vigilance: ctx.weakPointsMd,
      // Montants déjà formatés en euros : l'agent ne fait AUCUN calcul (évite les
      // conversions centimes→euros erronées). Les centimes restent la source dure.
      montant_reclame: eur(ctx.amountClaimedCents),
      montant_recupere: eur(ctx.amountRecoveredCents),
      debiteur: ctx.debtorName,
      entreprise: ctx.debtorCompany,
      faits: ctx.facts,
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
        simulation: { synthese_md: fallbackMd },
        organizationId: ctx.organizationId,
        caseId,
        maxTokens: 1500,
      });
      md = hasAdvice(data.synthese_md) ? fallbackMd : data.synthese_md;
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
