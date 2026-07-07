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
  if (ctx.livingBriefMd && ctx.livingBriefMd.trim()) return ctx.livingBriefMd;

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
  return lines.join("\n");
}
