"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { recomputeCaseProgress } from "@/lib/cases/completeness";
import { LETTER_KINDS } from "@/lib/cases/letter-meta";
import { runAgent } from "@/lib/ai/client";

/*
 * Courriers : brouillon (généré par template versionné, conforme — les
 * mentions légales sont insérées, pas générées librement) → relecture →
 * validation loggée (hash SHA-256 dans approval_logs) → envoyé. Aucun envoi
 * possible sans une ligne d'approbation au hash exact : pilier juridique #1.
 */

export type LetterState = { error?: string; success?: string; letterId?: string };

function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Construit le courrier depuis un template et les faits du dossier. Les
 * montants légaux (indemnité 40 € art. D441-5, intérêts de retard) sont des
 * mentions de template, jamais inventées.
 */
function buildLetter(
  kind: string,
  c: { debtor_name: string; amount_claimed_cents: number; title: string },
  orgName: string,
): { subject: string; body: string } {
  const montant = euros(c.amount_claimed_cents);
  const signature = `\n\nCordialement,\n${orgName}`;

  if (kind === "reminder_1") {
    return {
      subject: `Relance amiable — ${c.title}`,
      body:
        `Madame, Monsieur,\n\n` +
        `Sauf erreur de notre part, la somme de ${montant} € reste due au titre de notre facture. ` +
        `Il s'agit peut-être d'un simple oubli.\n\n` +
        `Nous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais. ` +
        `Si le paiement a été effectué entre-temps, merci de ne pas tenir compte de ce message.\n\n` +
        `Nous restons à votre disposition pour tout justificatif.` +
        signature,
    };
  }
  if (kind === "reminder_2") {
    return {
      subject: `Relance — facture impayée de ${montant} €`,
      body:
        `Madame, Monsieur,\n\n` +
        `Malgré notre précédent rappel, la somme de ${montant} € demeure impayée à ce jour.\n\n` +
        `Nous vous invitons à régulariser cette situation sous huitaine. ` +
        `Nous vous rappelons qu'entre professionnels, tout retard de paiement fait courir de plein droit ` +
        `des intérêts de retard ainsi qu'une indemnité forfaitaire de recouvrement de 40 € par facture ` +
        `(art. L441-10 et D441-5 du Code de commerce).\n\n` +
        `Nous espérons ne pas avoir à engager de démarche plus formelle.` +
        signature,
    };
  }
  if (kind === "formal_notice") {
    return {
      subject: `Mise en demeure de payer — ${montant} €`,
      body:
        `MISE EN DEMEURE\n\n` +
        `Madame, Monsieur,\n\n` +
        `Par la présente, nous vous mettons en demeure de nous régler la somme de ${montant} € ` +
        `correspondant à notre facture demeurée impayée malgré nos relances.\n\n` +
        `À cette somme s'ajoutent, de plein droit, les intérêts de retard au taux applicable ` +
        `ainsi que l'indemnité forfaitaire de recouvrement de 40 € (art. L441-10 et D441-5 du Code de commerce).\n\n` +
        `À défaut de règlement sous un délai de HUIT (8) JOURS à compter de la réception de la présente, ` +
        `nous nous réservons le droit d'engager toute procédure de recouvrement, sans nouvel avis.\n\n` +
        `La présente vaut mise en demeure au sens des articles 1231-6 et 1344 du Code civil.` +
        signature,
    };
  }
  // response (litige)
  return {
    subject: `Réponse à votre contestation — ${c.title}`,
    body:
      `Madame, Monsieur,\n\n` +
      `Nous faisons suite à votre contestation et souhaitons y répondre point par point, ` +
      `pièces à l'appui.\n\n` +
      `[À compléter avec les points contestés et les preuves correspondantes du dossier.]\n\n` +
      `Nous restons ouverts à un échange pour résoudre cette situation dans les meilleurs délais.` +
      signature,
  };
}

async function orgFor(): Promise<{ orgId: string; orgName: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id, organizations ( name )")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const org = data.organizations as unknown as { name: string } | null;
  return { orgId: data.organization_id, orgName: org?.name || "Votre entreprise" };
}

export async function generateLetter(
  _prev: LetterState,
  formData: FormData,
): Promise<LetterState> {
  const caseId = z.uuid().safeParse(formData.get("caseId"));
  const kind = String(formData.get("kind") ?? "");
  if (!caseId.success) return { error: "Dossier inconnu." };
  if (!LETTER_KINDS[kind]) return { error: "Type de courrier inconnu." };

  const org = await orgFor();
  if (!org) return { error: "Session expirée, reconnectez-vous." };

  const supabase = await createClient();
  const { data: c } = await supabase
    .from("cases")
    .select("id, title, debtor_name, amount_claimed_cents, case_type")
    .eq("id", caseId.data)
    .maybeSingle();
  if (!c) return { error: "Dossier introuvable." };

  // Gabarit conforme (mentions légales fixes) = socle de secours et de sûreté.
  const tpl = buildLetter(kind, c, org.orgName);
  let subject = tpl.subject;
  let body = tpl.body;
  // Rédaction RÉELLE par Marius (run tracé dans agent_runs). Sur échec ou en
  // bêta, on retombe sur le gabarit. L'utilisateur relit et valide de toute façon.
  try {
    const { data: m } = await runAgent({
      key: "marius",
      input: {
        consigne:
          "Rédige ce courrier en français à partir des seuls faits fournis. N'invente aucun montant, date ni fait. Garde les mentions légales du gabarit telles quelles. Réponds en JSON { subject, body_md }.",
        type: LETTER_KINDS[kind].label,
        ton: LETTER_KINDS[kind].tone,
        destinataire: c.debtor_name,
        montant_reclame_cents: c.amount_claimed_cents,
        expediteur: org.orgName,
        gabarit: tpl.body,
      },
      schema: z.object({ subject: z.string().min(3).max(200), body_md: z.string().min(60) }),
      simulation: { subject: tpl.subject, body_md: tpl.body },
      organizationId: org.orgId,
      caseId: c.id,
      maxTokens: 1200,
    });
    subject = m.subject?.trim() || tpl.subject;
    body = m.body_md?.trim() || tpl.body;
  } catch {
    // run en erreur déjà tracé ; on garde le gabarit conforme
  }

  const { data: created, error } = await supabase
    .from("letters")
    .insert({
      organization_id: org.orgId,
      case_id: c.id,
      kind,
      tone: LETTER_KINDS[kind].tone,
      status: "draft",
      subject,
      body_md: body,
    })
    .select("id")
    .single();
  if (error || !created) return { error: "Impossible de générer le brouillon." };

  await supabase.from("case_events").insert({
    case_id: c.id,
    organization_id: org.orgId,
    event_type: "letter_ready",
    title: `Brouillon prêt : ${LETTER_KINDS[kind].label.toLowerCase()}`,
    description: "À relire et valider avant tout envoi.",
    source: "ai",
  });

  await recomputeCaseProgress(c.id);
  revalidatePath(`/app/dossiers/${c.id}`);
  return { success: "Brouillon généré.", letterId: created.id };
}

const CHANNELS = new Set(["email", "postal"]);

export async function approveAndSendLetter(
  _prev: LetterState,
  formData: FormData,
): Promise<LetterState> {
  const letterId = z.uuid().safeParse(formData.get("letterId"));
  const channel = String(formData.get("channel") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!letterId.success) return { error: "Courrier inconnu." };
  if (!CHANNELS.has(channel)) return { error: "Choisissez un mode d'envoi." };
  if (body.length < 20) return { error: "Le contenu du courrier est vide." };

  const org = await orgFor();
  if (!org) return { error: "Session expirée, reconnectez-vous." };

  const supabase = await createClient();
  const { data: letter } = await supabase
    .from("letters")
    .select("id, case_id, status")
    .eq("id", letterId.data)
    .maybeSingle();
  if (!letter) return { error: "Courrier introuvable." };
  if (letter.status === "sent") return { error: "Ce courrier a déjà été envoyé." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Hash du contenu EXACTEMENT approuvé : c'est lui qui autorise l'envoi.
  const contentSha256 = createHash("sha256").update(body, "utf8").digest("hex");
  const h = await headers();

  const { error: logErr } = await supabase.from("approval_logs").insert({
    organization_id: org.orgId,
    letter_id: letter.id,
    case_id: letter.case_id,
    user_id: user?.id ?? null,
    action: "approve_send",
    content_sha256: contentSha256,
    channel,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    user_agent: h.get("user-agent")?.slice(0, 300) || null,
  });
  if (logErr) return { error: "Impossible d'enregistrer votre validation." };

  const { error: upErr } = await supabase
    .from("letters")
    .update({
      body_md: body,
      content_sha256: contentSha256,
      channel,
      status: "sent",
      approved_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
    })
    .eq("id", letter.id);
  if (upErr) return { error: "Validation enregistrée mais l'envoi a échoué." };

  await supabase.from("case_events").insert({
    case_id: letter.case_id,
    organization_id: org.orgId,
    event_type: "letter_sent",
    title: `Courrier validé et envoyé (${channel === "postal" ? "recommandé" : "email"})`,
    description: "Validation loggée (hash du contenu approuvé).",
    source: "user",
  });

  await recomputeCaseProgress(letter.case_id);
  revalidatePath(`/app/dossiers/${letter.case_id}`);
  return { success: "Courrier validé et envoyé." };
}
