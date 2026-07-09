import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCaseContext } from "@/lib/cases/context";

/*
 * Mémoire partagée du dossier, passée à CHAQUE agent en contexte : la synthèse
 * vivante si elle existe, sinon un condensé déterministe (récit, débiteur,
 * faits, derniers évènements, points de vigilance). C'est le « cahier » que les
 * agents se transmettent — Marius voit la revue de Jeanne, Léna voit les faits
 * de Nora, etc. — sans que chaque appelant reconstruise le contexte à la main.
 */
export async function caseMemo(sb: SupabaseClient, caseId: string): Promise<string> {
  const ctx = await buildCaseContext(sb, caseId);
  if (!ctx) return "";

  // Les prises de parole (doc 07) sont TOUJOURS annexées — même quand la
  // synthèse vivante existe : en mode dégradé le brief (repli déterministe)
  // ne les contient pas, et la réponse utilisateur doit primer partout
  // (pilier #3) ; une question ouverte ne doit jamais être reposée.
  const paroles: string[] = [];
  const answered = ctx.observations.filter((o) => o.status === "answered" && o.answer);
  const openQuestions = ctx.observations.filter((o) => o.status === "open" && o.kind === "question");
  if (answered.length) {
    paroles.push(`Réponses de l'utilisateur aux agents (font foi) : ${answered.map((o) => `${o.title} → ${o.answer}`).join(" ; ")}`);
  }
  if (openQuestions.length) {
    paroles.push(`Questions déjà posées, en attente (ne pas reposer) : ${openQuestions.map((o) => o.title).join(" ; ")}`);
  }

  if (ctx.livingBriefMd && ctx.livingBriefMd.trim()) {
    return [ctx.livingBriefMd, ...paroles].join("\n\n");
  }

  // Repli condensé tant que la synthèse vivante n'a pas encore été générée.
  const lines: string[] = [`Dossier : ${ctx.title} (${ctx.caseType}).`];
  if (ctx.debtorName) lines.push(`Débiteur : ${ctx.debtorName}.`);
  if (ctx.summaryMd) lines.push(`Récit : ${ctx.summaryMd.slice(0, 600)}`);
  if (ctx.facts.length) {
    lines.push(`Faits repérés : ${ctx.facts.map((f) => `${f.label} ${f.value}`).join(" ; ")}`);
  }
  if (ctx.timeline.length) {
    lines.push(`Derniers évènements : ${ctx.timeline.slice(-6).map((t) => t.title).join(" ; ")}`);
  }
  if (ctx.weakPointsMd) lines.push(`Points de vigilance : ${ctx.weakPointsMd.slice(0, 400)}`);
  return [...lines, ...paroles].join("\n");
}
