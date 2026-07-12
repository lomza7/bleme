import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runAgent } from "@/lib/ai/client";
import { hasAdvice } from "@/lib/ai/guardrails";
import { caseMemo } from "@/lib/cases/memo";
import { LETTER_KINDS } from "@/lib/cases/letter-meta";

/*
 * Cœur partagé, SANS session, de la rédaction d'une réponse ADAPTÉE au message
 * reçu du destinataire. Réutilisé par :
 *   - le flux UI (lib/cases/replies.ts, user-scoped) via un callback de progression ;
 *   - le webhook entrant (app/api/inbound/email/route.ts, service-role) quand une
 *     réponse arrive sur l'adresse par dossier — routage déterministe.
 *
 * Produit UNIQUEMENT un BROUILLON (letter status='draft') + un case_event
 * 'letter_ready'. N'appelle JAMAIS approveAndSendLetter/dispatchLetter : rien ne
 * part sans validation humaine loggée (pilier juridique #1). L'appelant fournit
 * le client Supabase (RLS user-scopé côté UI, service-role côté webhook), donc
 * l'isolation d'org reste garantie par l'appelant.
 */

function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function draftAdaptedResponseCore(
  sb: SupabaseClient,
  orgId: string,
  orgName: string,
  caseId: string,
  replyBodyText: string,
  opts?: { onProgress?: (step: string, detail?: string | null) => Promise<void> | void },
): Promise<{ letterId: string } | { error: string }> {
  const { data: c } = await sb
    .from("cases")
    .select("id, title, debtor_name, amount_claimed_cents, case_type")
    .eq("id", caseId)
    .maybeSingle();
  if (!c) return { error: "Dossier introuvable." };

  const { data: sent } = await sb
    .from("letters")
    .select("kind, subject")
    .eq("case_id", c.id)
    .eq("status", "sent")
    .order("created_at", { ascending: false });

  const montant = euros(Number(c.amount_claimed_cents) || 0);
  const gabarit =
    `Madame, Monsieur,\n\n` +
    `Nous accusons réception de votre message et souhaitons y répondre.\n\n` +
    `[Reprendre les points soulevés et y répondre à partir des pièces du dossier.]\n\n` +
    `Sauf élément nouveau justifié, la somme de ${montant} € reste due à ce jour. ` +
    `Nous restons à votre disposition pour convenir des modalités de règlement.\n\n` +
    `Cordialement,\n${orgName}`;
  const tplSubject = `Réponse à votre message — ${c.title}`;

  let subject = tplSubject;
  let body = gabarit;
  // Litige → Léna ; démarche admin → Basile ; impayé → Marius.
  const isDispute = c.case_type === "client_dispute";
  const isAdmin = c.case_type === "admin_request";
  const writerName = isDispute ? "Léna" : isAdmin ? "Basile" : "Marius";
  const progress = async (step: string, detail?: string | null) => {
    await opts?.onProgress?.(step, detail);
  };
  await progress(`${writerName} relit le dossier et le message reçu`);
  const memo = await caseMemo(sb, c.id);
  await progress(`${writerName} rédige la réponse adaptée`, "point par point, sur les faits et pièces du dossier");
  try {
    // Retry ×1 : un JSON mal formé (agent qui conclut mal ses tours d'outils)
    // ne doit pas suffire à dégrader vers le gabarit.
    const run = () =>
      runAgent({
        key: isDispute ? "lena" : isAdmin ? "basile" : "marius",
        input: {
          consigne:
            "Rédige une réponse au message reçu, point par point sur les seuls faits et pièces du dossier (respecte les règles de ton rôle). Réponse complète, sans crochet ni champ à trous. Réponds en JSON { subject, body_md }.",
          contexte_dossier: memo,
          type: isAdmin ? "Réponse à un courrier de l'administration" : "Réponse à un message du débiteur",
          destinataire: c.debtor_name,
          montant_reclame: c.amount_claimed_cents ? `${euros(c.amount_claimed_cents)} €` : null,
          message_recu: replyBodyText.slice(0, 4000),
          courriers_deja_envoyes: (sent ?? []).map((l) => LETTER_KINDS[l.kind]?.label ?? l.kind),
          expediteur: orgName,
          gabarit,
        },
        schema: z.object({
          subject: z.string().min(3).max(200).catch(tplSubject),
          body_md: z.string().min(60),
        }),
        simulation: { subject: tplSubject, body_md: gabarit },
        organizationId: orgId,
        caseId: c.id,
        maxTokens: 1800,
        fallbackDirect: true,
      });
    const { data: m } = await run().catch(() => {
      void progress(`Première rédaction incomplète — ${writerName} reprend`, "nouvelle tentative en cours");
      return run();
    });
    // Garde-fou #2 : conseil/pronostic → on garde le gabarit conforme.
    if (hasAdvice(m.subject ?? "", m.body_md ?? "")) {
      subject = tplSubject;
      body = gabarit;
    } else {
      subject = m.subject?.trim() || tplSubject;
      body = m.body_md?.trim() || gabarit;
    }
  } catch {
    // run en erreur déjà tracé par runAgent ; on garde le gabarit conforme
  }

  const { data: created, error } = await sb
    .from("letters")
    .insert({
      organization_id: orgId,
      case_id: c.id,
      kind: "custom",
      tone: "factuel",
      status: "draft",
      subject,
      body_md: body,
    })
    .select("id")
    .single();
  if (error || !created) return { error: "Impossible de générer la réponse." };

  await sb.from("case_events").insert({
    case_id: c.id,
    organization_id: orgId,
    event_type: "letter_ready",
    title: "Réponse adaptée prête",
    description: "À relire et valider avant tout envoi.",
    source: "ai",
  });

  return { letterId: created.id };
}
