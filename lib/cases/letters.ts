"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { touchCase } from "@/lib/cases/touch";
import { LETTER_KINDS, LETTER_PALIER, LETTER_MENTIONS, INDEMNITE_FORFAITAIRE } from "@/lib/cases/letter-meta";
import { runAgent } from "@/lib/ai/client";
import { hasAdvice } from "@/lib/ai/guardrails";
import { caseMemo } from "@/lib/cases/memo";
import { buildCaseContext } from "@/lib/cases/context";
import { legalSocle, hasSources } from "@/lib/cases/legal";
import { dispatchLetter } from "@/lib/courrier/dispatch";
import { serverEnv } from "@/lib/env";

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
  // Courriers à l'administration : gabarits neutres, sans aucune référence
  // juridique codée (les références viennent du socle vérifié ou des outils).
  if (kind === "admin_gracieux") {
    return {
      subject: `Demande de réexamen — ${c.title}`,
      body:
        `Madame, Monsieur,\n\n` +
        `Par la présente, je sollicite le réexamen de la situation me concernant ` +
        `[référence et date de la décision ou du dossier à préciser].\n\n` +
        `[Exposé des faits, dans l'ordre, avec les dates.]\n\n` +
        `[Votre demande précise : réexamen, rectification, restitution, remise…]\n\n` +
        `Vous trouverez ci-joint les pièces à l'appui de la présente demande.\n\n` +
        `Dans l'attente de votre réponse, je vous prie d'agréer, Madame, Monsieur, ` +
        `l'expression de ma considération distinguée.` +
        signature,
    };
  }
  if (kind === "admin_relance") {
    return {
      subject: `Relance — demande restée sans réponse (${c.title})`,
      body:
        `Madame, Monsieur,\n\n` +
        `Je me permets de revenir vers vous au sujet de ma demande du ` +
        `[date de la demande initiale à préciser], restée à ce jour sans réponse.\n\n` +
        `[Rappel en une phrase de l'objet de la demande.]\n\n` +
        `Je vous remercie de bien vouloir me faire connaître la suite réservée à ce dossier.\n\n` +
        `Je vous prie d'agréer, Madame, Monsieur, l'expression de ma considération distinguée.` +
        signature,
    };
  }
  if (kind === "admin_hierarchique") {
    return {
      subject: `Recours hiérarchique — ${c.title}`,
      body:
        `Madame, Monsieur,\n\n` +
        `Par la présente, je forme un recours hiérarchique à l'encontre de la décision ` +
        `[référence, date et autorité de la décision à préciser], ` +
        `[maintenue malgré ma demande du (date) / restée sans réponse depuis le (date)].\n\n` +
        `[Exposé des faits et des motifs, dans l'ordre, avec les dates.]\n\n` +
        `[Votre demande précise.]\n\n` +
        `Vous trouverez ci-joint les pièces à l'appui du présent recours.\n\n` +
        `Dans l'attente de votre réponse, je vous prie d'agréer, Madame, Monsieur, ` +
        `l'expression de ma considération distinguée.` +
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

async function orgFor(): Promise<{ orgId: string; orgName: string; inboxSlug: string | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id, organizations ( name, inbox_slug )")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const org = data.organizations as unknown as { name: string; inbox_slug: string | null } | null;
  return {
    orgId: data.organization_id,
    orgName: org?.name || "Votre entreprise",
    inboxSlug: org?.inbox_slug ?? null,
  };
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
  let griefsCount = 0;
  let adminRefs: { reference: string; intitule: string; source: string; verifie: boolean }[] = [];
  // La réponse à une contestation est écrite par Léna (litiges, grief par grief) ;
  // les courriers à l'administration par Basile (démarches & recours, outillé
  // Légifrance/justice administrative) ; le recouvrement d'impayés par Marius.
  // Rédaction RÉELLE (run tracé). Sur échec ou en bêta, repli gabarit.
  // L'utilisateur relit et valide de toute façon.
  const useLena = kind === "response";
  const useBasile = c.case_type === "admin_request";
  const writerKey = useLena ? "lena" : useBasile ? "basile" : "marius";
  const memo = await caseMemo(supabase, c.id);
  // Socle juridique (récupération serveur, mis en cache par type) : articles +
  // arrêts réels fournis au rédacteur. Volet « récupération » du mode hybride.
  const socle = await legalSocle(c.case_type, writerKey, {
    organizationId: org.orgId,
    caseId: c.id,
  });
  // Anti-hallucination (#7) : sans source vérifiée, on INTERDIT toute référence
  // numérotée (on ne peut pas la recouper) ; avec socle, on cite précisément.
  const groundingRule = hasSources(socle)
    ? " Cite précisément les références du socle_juridique fourni (numéros d'articles, et pour un arrêt sa juridiction/date/numéro EXACTS) ; ne cite jamais une référence absente du socle et non renvoyée par un outil."
    : " Aucune source juridique vérifiée n'est disponible : n'écris AUCUN numéro d'article ni d'arrêt ; exprime le droit applicable en termes généraux, sans référence numérotée.";
  try {
    if (useLena) {
      const ctx = await buildCaseContext(supabase, c.id);
      const { data: m } = await runAgent({
        key: "lena",
        input: {
          consigne:
            "Rédige une RÉPONSE à la contestation, grief par grief : chaque grief reçoit une réponse factuelle adossée à une pièce du dossier (citée par nom et date). Sépare contesté / non contesté. Appuie la réponse sur le droit du socle_juridique fourni et, si besoin, cherche une source complémentaire via les outils." +
            groundingRule +
            " Réponds en JSON { subject, body_md, griefs:[{grief, statut, reponse, piece_citee}] }.",
          contexte_dossier: memo,
          socle_juridique: socle,
          destinataire: c.debtor_name,
          montant_reclame: c.amount_claimed_cents ? `${euros(c.amount_claimed_cents)} €` : null,
          contestation: ctx?.summaryMd ?? "",
          derniers_messages: (ctx?.replies ?? []).slice(-3).map((r) => ({ date: r.receivedAt, texte: r.body.slice(0, 1500) })),
          pieces: (ctx?.documents ?? []).map((d) => ({ nom: d.fileName, type: d.docKind })),
          chronologie: (ctx?.timeline ?? []).map((t) => ({ date: t.date, evenement: t.title })),
          revue_adverse: ctx?.devilReview ?? null,
          expediteur: org.orgName,
          gabarit: tpl.body,
        },
        schema: z.object({
          subject: z.string().min(3).max(200),
          body_md: z.string().min(60),
          griefs: z
            .array(
              z.object({
                grief: z.string(),
                statut: z.string(),
                reponse: z.string(),
                piece_citee: z.string().nullable(),
              }),
            )
            .default([]),
        }),
        simulation: { subject: tpl.subject, body_md: tpl.body, griefs: [] },
        organizationId: org.orgId,
        caseId: c.id,
        maxTokens: 1500,
      });
      if (hasAdvice(m.subject ?? "", m.body_md ?? "")) {
        subject = tpl.subject;
        body = tpl.body;
      } else {
        subject = m.subject?.trim() || tpl.subject;
        body = m.body_md?.trim() || tpl.body;
        griefsCount = m.griefs?.length ?? 0;
      }
    } else if (useBasile) {
      const ctx = await buildCaseContext(supabase, c.id);
      const { data: m } = await runAgent({
        key: "basile",
        input: {
          consigne:
            "Rédige le BROUILLON de ce courrier adressé à l'administration. Qualifie d'abord la démarche (recours gracieux, hiérarchique, réclamation, rectification après décision de justice, relance après silence) à partir du dossier, puis rédige : identification du demandeur, références du dossier, exposé des faits daté, demande expresse, motivation, pièces jointes numérotées. Appuie-toi sur le socle_juridique fourni et cherche les textes propres au cas via les outils (Légifrance, justice administrative, Service-Public)." +
            groundingRule +
            " Réponds en JSON { subject, body_md, demarche, references_utilisees:[{reference, intitule, source, verifie}] }.",
          contexte_dossier: memo,
          socle_juridique: socle,
          type: LETTER_KINDS[kind].label,
          palier: LETTER_PALIER[kind] ?? 0,
          ton: LETTER_KINDS[kind].tone,
          destinataire: c.debtor_name,
          montant_en_jeu: c.amount_claimed_cents ? `${euros(c.amount_claimed_cents)} €` : null,
          pieces: (ctx?.documents ?? []).map((d) => ({ nom: d.fileName, type: d.docKind })),
          chronologie: (ctx?.timeline ?? []).map((t) => ({ date: t.date, evenement: t.title })),
          expediteur: org.orgName,
          gabarit: tpl.body,
        },
        schema: z.object({
          subject: z.string().min(3).max(200),
          body_md: z.string().min(60),
          demarche: z.string().default(""),
          references_utilisees: z
            .array(
              z.object({
                reference: z.string(),
                intitule: z.string().default(""),
                source: z.string().default(""),
                verifie: z.boolean().default(false),
              }),
            )
            .default([]),
        }),
        simulation: { subject: tpl.subject, body_md: tpl.body, demarche: "", references_utilisees: [] },
        organizationId: org.orgId,
        caseId: c.id,
        maxTokens: 1800,
      });
      if (hasAdvice(m.subject ?? "", m.body_md ?? "")) {
        subject = tpl.subject;
        body = tpl.body;
      } else {
        subject = m.subject?.trim() || tpl.subject;
        body = m.body_md?.trim() || tpl.body;
        adminRefs = (m.references_utilisees ?? []).filter((r) => r.reference.trim());
      }
    } else {
      const { data: m } = await runAgent({
        key: "marius",
        input: {
          consigne:
            "Rédige ce courrier de recouvrement (respecte le palier et les règles de ton rôle). Appuie-toi sur le socle_juridique fourni pour citer le droit applicable ; cherche une source complémentaire via les outils si le dossier le justifie." +
            groundingRule +
            " Réponds en JSON { subject, body_md }.",
          contexte_dossier: memo,
          socle_juridique: socle,
          type: LETTER_KINDS[kind].label,
          palier: LETTER_PALIER[kind] ?? 0,
          ton: LETTER_KINDS[kind].tone,
          destinataire: c.debtor_name,
          montant_reclame: c.amount_claimed_cents ? `${euros(c.amount_claimed_cents)} €` : null,
          indemnite_forfaitaire: INDEMNITE_FORFAITAIRE,
          mentions_obligatoires: LETTER_MENTIONS[kind] ?? [],
          expediteur: org.orgName,
          gabarit: tpl.body,
        },
        schema: z.object({ subject: z.string().min(3).max(200), body_md: z.string().min(60) }),
        simulation: { subject: tpl.subject, body_md: tpl.body },
        organizationId: org.orgId,
        caseId: c.id,
        maxTokens: 1200,
      });
      // Garde-fou #2 : conseil/pronostic dans le sujet ou le corps → on garde le
      // gabarit conforme (le courrier part au nom de l'utilisateur).
      if (hasAdvice(m.subject ?? "", m.body_md ?? "")) {
        subject = tpl.subject;
        body = tpl.body;
      } else {
        subject = m.subject?.trim() || tpl.subject;
        body = m.body_md?.trim() || tpl.body;
      }
    }
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

  // Références citées dans un courrier admin : consignées dans la chronologie
  // avec leur statut (vérifiée / à vérifier) — auditable et contestable (#3).
  const refsNote = adminRefs.length
    ? ` Références citées : ${adminRefs
        .map((r) => `${r.reference}${r.verifie ? " (vérifiée)" : " (à vérifier)"}`)
        .join(" ; ")}.`
    : "";

  await supabase.from("case_events").insert({
    case_id: c.id,
    organization_id: org.orgId,
    event_type: "letter_ready",
    title: `Brouillon prêt : ${LETTER_KINDS[kind].label.toLowerCase()}`,
    description:
      griefsCount > 0
        ? `${griefsCount} grief${griefsCount > 1 ? "s" : ""} traité${griefsCount > 1 ? "s" : ""} point par point. À relire et valider avant tout envoi.`
        : `À relire et valider avant tout envoi.${refsNote}`,
    source: "ai",
  });

  await touchCase(c.id, { type: "letter_draft", label: `Brouillon préparé : ${LETTER_KINDS[kind].label}` });
  revalidatePath(`/app/dossiers/${c.id}`);
  return { success: "Brouillon généré.", letterId: created.id };
}

const CHANNELS = new Set(["email", "postal"]);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Adresse postale saisie à la validation (jamais devinée, pilier #3). Même
// forme que cases.debtor_address ({nom, adresse, complement?, codePostal, ville}).
const addressSchema = z.object({
  nom: z.string().trim().max(120).optional().default(""),
  societe: z.string().trim().max(120).optional().default(""),
  adresse: z.string().trim().min(3).max(90),
  complement: z.string().trim().max(90).optional().default(""),
  codePostal: z.string().trim().regex(/^\d{5}$/),
  ville: z.string().trim().min(1).max(80),
});

function parseAddress(formData: FormData, prefix: string) {
  return addressSchema.safeParse({
    nom: formData.get(`${prefix}Nom`) ?? "",
    societe: formData.get(`${prefix}Societe`) ?? "",
    adresse: formData.get(`${prefix}Adresse`) ?? "",
    complement: formData.get(`${prefix}Complement`) ?? "",
    codePostal: formData.get(`${prefix}Cp`) ?? "",
    ville: formData.get(`${prefix}Ville`) ?? "",
  });
}

export async function approveAndSendLetter(
  _prev: LetterState,
  formData: FormData,
): Promise<LetterState> {
  const letterId = z.uuid().safeParse(formData.get("letterId"));
  const channel = String(formData.get("channel") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const toEmail = String(formData.get("toEmail") ?? "").trim();
  if (!letterId.success) return { error: "Courrier inconnu." };
  if (!CHANNELS.has(channel)) return { error: "Choisissez un mode d'envoi." };
  if (body.length < 20) return { error: "Le contenu du courrier est vide." };
  // Envoi email : une adresse valide est requise (jamais devinée). Vérifié AVANT
  // le log d'approbation pour ne pas graver une validation inexploitable.
  if (channel === "email" && !EMAIL_RE.test(toEmail)) {
    return { error: "Indiquez l'email du destinataire pour un envoi par email." };
  }
  // Envoi postal : adresses complètes destinataire ET expéditeur, vérifiées
  // AVANT le log d'approbation (même principe que l'email).
  let toAddress: z.infer<typeof addressSchema> | null = null;
  let fromAddress: z.infer<typeof addressSchema> | null = null;
  if (channel === "postal") {
    const dest = parseAddress(formData, "to");
    if (!dest.success || (!dest.data.nom && !dest.data.societe)) {
      return { error: "Adresse postale du destinataire incomplète (nom ou organisme, adresse, code postal à 5 chiffres, ville)." };
    }
    const exp = parseAddress(formData, "from");
    if (!exp.success || (!exp.data.nom && !exp.data.societe)) {
      return { error: "Votre adresse d'expéditeur est incomplète (nom, adresse, code postal à 5 chiffres, ville)." };
    }
    toAddress = dest.data;
    fromAddress = exp.data;
  }

  const org = await orgFor();
  if (!org) return { error: "Session expirée, reconnectez-vous." };

  const supabase = await createClient();
  const { data: letter } = await supabase
    .from("letters")
    .select("id, case_id, status, subject")
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

  // Expédition réelle (gated) : ne PART que si SEND_ENABLED. Le contenu envoyé
  // est exactement celui qui vient d'être approuvé + haché.
  const dispatch = await dispatchLetter({
    channel: channel as "email" | "postal",
    subject: letter.subject ?? "Votre courrier",
    bodyMd: body,
    toEmail: channel === "email" ? toEmail : null,
    replyTo: org.inboxSlug ? `${org.inboxSlug}@${serverEnv().CASE_EMAIL_DOMAIN}` : null,
    toAddress,
    fromAddress,
    reference: letter.id,
  });
  const reallySent = dispatch.status === "sent";

  // Statut 'sent' conservé (la progression de phase en dépend), mais sent_at
  // n'est renseigné QUE si le courrier est réellement parti (#14 : journal honnête).
  const { error: upErr } = await supabase
    .from("letters")
    .update({
      body_md: body,
      content_sha256: contentSha256,
      channel,
      to_email: channel === "email" ? toEmail : null,
      to_address: toAddress,
      postal_envoi_id: reallySent && dispatch.via === "postal" ? dispatch.ref : null,
      status: "sent",
      approved_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
      sent_at: reallySent ? new Date().toISOString() : null,
    })
    .eq("id", letter.id);
  if (upErr) return { error: "Validation enregistrée mais l'envoi a échoué." };

  // Mémorise les coordonnées du destinataire sur le dossier pour les préremplir
  // la fois suivante (saisie utilisateur — jamais deviné ; la dernière prime, #3).
  if (channel === "email" && toEmail) {
    await supabase.from("cases").update({ debtor_email: toEmail }).eq("id", letter.case_id);
  }
  if (channel === "postal" && toAddress) {
    await supabase.from("cases").update({ debtor_address: toAddress }).eq("id", letter.case_id);
    // L'adresse d'expéditeur sert à tous les dossiers de l'organisation.
    if (fromAddress) {
      await supabase.from("organizations").update({ address_json: fromAddress }).eq("id", org.orgId);
    }
  }

  await supabase.from("case_events").insert({
    case_id: letter.case_id,
    organization_id: org.orgId,
    event_type: "letter_sent",
    title: reallySent
      ? `Courrier envoyé (${dispatch.via === "postal" ? "recommandé" : "email"})`
      : "Courrier validé — prêt à l'envoi",
    description: reallySent
      ? "Validation loggée (hash du contenu approuvé)."
      : `Validation loggée (hash du contenu approuvé). Expédition réelle à activer — ${dispatch.reason}`,
    source: "user",
  });

  await touchCase(letter.case_id, { type: "letter_sent", label: "Courrier validé pour envoi" });
  revalidatePath(`/app/dossiers/${letter.case_id}`);
  return {
    success: reallySent
      ? "Courrier validé et envoyé."
      : "Courrier validé (hash enregistré). L'expédition réelle sera activée prochainement.",
  };
}
