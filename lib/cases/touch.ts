import "server-only";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { recomputeCaseProgress } from "@/lib/cases/completeness";
import { refreshLivingBrief, type BriefCause } from "@/lib/cases/brief";

/*
 * Point d'entrée UNIQUE des évolutions de dossier : chaque mutation métier
 * appelle touchCase(caseId, cause) pour que le CONTEXTE (journal daté) suive
 * l'état réel, avec la cause au moment où l'appelant la connaît.
 *
 * - Pose living_brief_requested_at (marqueur « génération en cours » lu par le
 *   panneau Contexte pour le badge + polling temps réel).
 * - Recalcule la progression (sauf opts.recompute === false) : recompute
 *   programme lui-même la régénération du contexte (+ la prise de parole des
 *   agents au changement de phase) via after().
 * - Si le recompute est sauté OU s'est arrêté net (dossier résolu/clos → il
 *   renvoie null sans rien programmer), on programme directement la
 *   régénération : la clôture/le paiement doivent apparaître au contexte.
 */
export async function touchCase(
  caseId: string,
  cause: BriefCause,
  opts: { recompute?: boolean } = {},
): Promise<void> {
  // Marqueur temps réel : service client — la colonne est libre côté user mais
  // les mutations passent parfois par des webhooks sans session.
  try {
    await createServiceClient()
      .from("cases")
      .update({ living_brief_requested_at: new Date().toISOString() })
      .eq("id", caseId);
  } catch {
    /* marqueur best-effort : ne bloque jamais la mutation */
  }

  if (opts.recompute !== false) {
    const score = await recomputeCaseProgress(caseId, cause);
    if (score !== null) return; // recompute a tourné → refresh (+ relais) programmés
  }

  // Recompute sauté ou early-return : programmer la régénération directement.
  try {
    after(() => refreshLivingBrief(caseId, cause));
  } catch {
    // Hors contexte requête (script/worker) : exécution synchrone.
    await refreshLivingBrief(caseId, cause);
  }
}
