import "server-only";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { runAgent } from "@/lib/ai/client";
import { hasAdvice } from "@/lib/ai/guardrails";
import { caseMemo } from "@/lib/cases/memo";
import { legalSocle, type LegalSocle } from "@/lib/cases/legal";
import { phaseMeta, type Phase } from "@/lib/cases/phases";
import { euros } from "@/lib/format";

/*
 * Prise de parole aux passages de relais (doc 07, workflow 13).
 *
 * Quand le dossier change de phase, il change d'agent référent (Marius → Sacha
 * → Jeanne). L'agent qui le REÇOIT relit la mémoire partagée (caseMemo) et le
 * socle juridique réel (Légifrance/JUDILIBRE), puis peut émettre 0-4 prises de
 * parole typées vers l'utilisateur : question, observation ou vigilance.
 * Garde-fous : filtre anti-conseil au grain fin (hasAdvice par entrée), et
 * ANTI-HALLUCINATION sur les références juridiques — une base légale n'est
 * retenue que si elle s'apparie à un article/arrêt précis du socle, et c'est
 * alors le texte DU SOCLE (référence + portée) qui est affiché, jamais celui
 * du modèle. Idempotent (claim atomique : un trigger_key ne parle qu'une fois
 * par dossier, même sous recomputes concurrents) ; fonction de fond :
 * n'échoue jamais bruyamment (le run est tracé).
 */

type LegalRef = { reference: string; portee: string };

// Prénoms des personas (mêmes valeurs que les cartes compagnon de la page
// dossier) pour les titres d'événements timeline.
const AGENT_PRENOM: Record<string, string> = {
  marius: "Marius",
  lena: "Léna",
  jeanne: "Jeanne",
  nora: "Nora",
  sacha: "Sacha",
  basile: "Basile",
};

const OBSERVATIONS_SCHEMA = z.object({
  observations: z
    .array(
      z.object({
        type: z.enum(["question", "observation", "vigilance"]),
        titre: z.string().min(3).max(160),
        detail: z.string().max(900).default(""),
        base_legale: z
          .array(
            z.object({
              reference: z.string().max(160),
              portee: z.string().max(400).default(""),
            }),
          )
          .max(3)
          .default([]),
      }),
    )
    .max(4)
    .default([]),
});

/** Normalisation d'identifiant juridique : « L. 441-10 » ≡ « L441-10 ». */
function normRef(s: string): string {
  return s.toUpperCase().replace(/[\s. ]/g, "");
}

/**
 * Anti-hallucination stricte (pilier #3) : la base légale citée par le modèle
 * n'est retenue que si son identifiant complet (lettre comprise : L441-10 ≠
 * D441-10) correspond à un article ou un arrêt PRÉCIS du socle récupéré par
 * les outils — et on affiche alors la référence et la portée DU SOCLE, jamais
 * le texte du modèle (une portée inventée sur un article réel ne passe pas).
 * Pas de correspondance → supprimée.
 */
function matchSocleRef(reference: string, socle: LegalSocle): LegalRef | null {
  const ref = normRef(reference);
  for (const a of socle.articles) {
    const numero = normRef(a.numero);
    if (numero.length >= 3 && ref.includes(numero)) {
      return {
        reference: a.intitule ? `${a.numero} — ${a.intitule}` : a.numero,
        portee: a.extrait.slice(0, 400),
      };
    }
  }
  for (const j of socle.arrets) {
    const numero = normRef(j.numero);
    if (numero.length >= 5 && ref.includes(numero)) {
      return {
        reference: [j.juridiction, j.date, j.numero ? `n° ${j.numero}` : ""].filter(Boolean).join(", "),
        portee: j.portee.slice(0, 400),
      };
    }
  }
  return null;
}

/**
 * Réflexion de l'agent qui reçoit le dossier à un changement de phase.
 * Appelée en tâche de fond (after) par recomputeCaseProgress. Ne lève jamais.
 */
export async function runHandoffReflection(
  caseId: string,
  { fromPhase, toPhase }: { fromPhase: Phase; toPhase: Phase },
): Promise<void> {
  try {
    const sb = createServiceClient();
    const triggerKey = `phase_${fromPhase}_to_${toPhase}`;

    const { data: c } = await sb
      .from("cases")
      .select("id, organization_id, title, case_type, status, is_sample, amount_claimed_cents, debtor_name")
      .eq("id", caseId)
      .maybeSingle();
    if (!c || c.is_sample) return;
    if (c.status === "resolved" || c.status === "closed" || c.status === "draft") return;

    // Idempotence sous concurrence : claim atomique AVANT le run LLM (deux
    // recomputes parallèles peuvent détecter la même transition ; seul celui
    // qui gagne la ligne poursuit). Relâché sur erreur de run (auto-guérison
    // à la prochaine mutation) ; conservé si l'agent n'a rien à dire.
    const { data: claim } = await sb
      .from("case_handoff_claims")
      .upsert(
        { case_id: caseId, organization_id: c.organization_id, trigger_key: triggerKey },
        { onConflict: "case_id,trigger_key", ignoreDuplicates: true },
      )
      .select("case_id");
    if (!claim?.length) return;

    const from = phaseMeta(fromPhase);
    const to = phaseMeta(toPhase);
    const memo = await caseMemo(sb, caseId);
    const socle = await legalSocle(c.case_type, to.agentKey, {
      organizationId: c.organization_id,
      caseId,
    });

    let data: z.infer<typeof OBSERVATIONS_SCHEMA>;
    try {
      ({ data } = await runAgent({
        key: to.agentKey,
        input: {
          consigne:
            "PASSAGE DE RELAIS : le dossier arrive entre tes mains. Avant d'agir, relis le contexte consolidé " +
            "(contexte_dossier) et prends la parole si — et seulement si — tu as quelque chose d'utile à dire à " +
            "l'utilisateur. Renvoie un JSON { observations: [{ type, titre, detail, base_legale: [{ reference, portee }] }] } " +
            "avec 0 à 4 entrées. Types : 'question' = une information manquante que seul l'utilisateur peut fournir ; " +
            "'observation' = un constat factuel utile sur l'état du dossier ; 'vigilance' = un point qui pourrait poser " +
            "problème (délai, prescription, pièce, mention, incohérence), formulé de façon documentaire. " +
            "base_legale : cite UNIQUEMENT des références présentes dans socle_juridique — jamais de référence, de " +
            "numéro d'arrêt ni de date inventés ; tableau vide sinon. Une statistique n'est admise que si elle figure " +
            "textuellement dans les sources fournies ; jamais de probabilité de succès du dossier. " +
            "Jamais de conseil personnalisé, de pronostic ni d'évaluation de chances ; en cas de doute sérieux, " +
            "termine la vigilance par « à faire valider par un professionnel ». Ne repose JAMAIS une question déjà " +
            "posée ou déjà répondue dans le contexte. Si rien ne mérite d'être signalé, renvoie { observations: [] }.",
          transition: { de: from.label, vers: to.label, phase: toPhase },
          contexte_dossier: memo,
          socle_juridique: socle,
          type: c.case_type,
          debiteur: c.debtor_name,
          montant_reclame: c.amount_claimed_cents ? euros(c.amount_claimed_cents) : null,
          date_du_jour: new Date().toLocaleDateString("fr-FR"),
        },
        schema: OBSERVATIONS_SCHEMA,
        simulation: { observations: [] },
        organizationId: c.organization_id,
        caseId,
        maxTokens: 1100,
      }));
    } catch (err) {
      // Run en erreur (déjà tracé) : on relâche le claim pour que le relais
      // retente à la prochaine mutation, puis on laisse le catch global finir.
      await sb.from("case_handoff_claims").delete().eq("case_id", caseId).eq("trigger_key", triggerKey);
      throw err;
    }

    // Garde-fous au grain fin : une entrée avec conseil/pronostic est écartée
    // (pas les autres) ; chaque base légale est appariée au socle et remplacée
    // par le texte du socle (référence absente des sources → supprimée).
    const rows = data.observations
      .filter((o) => !hasAdvice(o.titre, o.detail, ...o.base_legale.flatMap((r) => [r.reference, r.portee])))
      .map((o) => {
        const refs: LegalRef[] = [];
        for (const r of o.base_legale) {
          const matched = matchSocleRef(r.reference, socle);
          if (matched && !refs.some((x) => x.reference === matched.reference)) refs.push(matched);
        }
        return {
          organization_id: c.organization_id,
          case_id: caseId,
          agent_key: to.agentKey,
          trigger_key: triggerKey,
          kind: o.type,
          title: o.titre.trim(),
          detail_md: o.detail.trim() || null,
          legal_refs: refs,
        };
      });
    if (!rows.length) return;

    const { error } = await sb.from("agent_observations").insert(rows);
    if (error) return;

    const prenom = AGENT_PRENOM[to.agentKey] ?? to.agentKey;
    const nQuestions = rows.filter((r) => r.kind === "question").length;
    await sb.from("case_events").insert({
      case_id: caseId,
      organization_id: c.organization_id,
      event_type: "agent_handoff",
      title: `${prenom} a pris la parole au passage de relais`,
      description:
        `${rows.length} point${rows.length > 1 ? "s" : ""} signalé${rows.length > 1 ? "s" : ""}` +
        (nQuestions ? `, dont ${nQuestions} question${nQuestions > 1 ? "s" : ""} qui attend${nQuestions > 1 ? "ent" : ""} votre réponse` : "") +
        " — à retrouver sur le dossier.",
      source: "ai",
    });
  } catch {
    // Fonction de fond : jamais d'échec bruyant côté appelant (run tracé).
  }
}
