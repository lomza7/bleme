"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

async function currentOrgId(): Promise<{ orgId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!data) return { error: "Organisation introuvable." };
  return { orgId: data.organization_id };
}

function days(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
}

/* ── Brouillon du wizard ──────────────────────────────────────────────────── */

const draftSchema = z.object({
  kind: z.enum(["unpaid", "dispute", "admin"]),
  partyName: z.string().trim().min(1).max(200),
  amount: z.string().optional().default(""),
  age: z.string().optional().default(""),
  subject: z.string().optional().default(""),
  stage: z.string().optional().default(""),
  storyMode: z.enum(["voice", "text"]).nullable(),
  storySeconds: z.number().optional().default(0),
  storyText: z.string().optional().default(""),
  devilAnswer: z.string().optional().default(""),
});

function parseAmountToCents(raw: string): number {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  const value = parseFloat(cleaned);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0;
}

export async function createCaseFromDraft(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = draftSchema.safeParse(
    JSON.parse(String(formData.get("draft") ?? "{}")),
  );
  if (!parsed.success || parsed.data.kind === "admin") {
    return { error: "Brouillon illisible : recommencez depuis « Nouveau blème »." };
  }
  const org = await currentOrgId();
  if ("error" in org) return { error: org.error };

  const d = parsed.data;
  const supabase = await createClient();
  const isUnpaid = d.kind === "unpaid";
  const amountCents = parseAmountToCents(d.amount);

  const summaryParts: string[] = [];
  if (d.storyMode === "voice" && d.storySeconds > 0) {
    summaryParts.push(
      `Récit vocal enregistré (${Math.round(d.storySeconds / 60)} min) : l’analyse IA arrive dans une prochaine version.`,
    );
  }
  if (d.storyText.trim()) summaryParts.push(d.storyText.trim());
  if (isUnpaid && d.age) summaryParts.push(`Impayé depuis : ${d.age.toLowerCase()}.`);
  if (!isUnpaid && d.subject) summaryParts.push(`Objet du litige : ${d.subject}. Où ça en est : ${d.stage || "non précisé"}.`);

  const { data: created, error } = await supabase
    .from("cases")
    .insert({
      organization_id: org.orgId,
      case_type: isUnpaid ? "unpaid_invoice" : "client_dispute",
      title: `${isUnpaid ? "Facture impayée" : "Litige client"} · ${d.partyName}`,
      status: isUnpaid ? "awaiting_user" : "awaiting_user",
      debtor_name: d.partyName,
      amount_claimed_cents: amountCents,
      summary_md: summaryParts.join("\n\n") || null,
      weak_points_md: d.devilAnswer.trim() || null,
      stage: 1,
      next_action_label: isUnpaid
        ? "Ajouter vos preuves (facture, devis…)"
        : "Ajouter vos preuves (devis, échanges, photos…)",
      next_action_at: days(1),
      expected_recovery_at: isUnpaid ? days(28) : null,
      source: "wizard_draft",
    })
    .select("id")
    .single();
  if (error || !created) {
    return { error: "Impossible de créer le dossier. Réessayez." };
  }

  await supabase.from("case_events").insert([
    {
      case_id: created.id,
      organization_id: org.orgId,
      event_type: "created",
      title: "Dossier créé depuis votre récit",
      description: d.storyMode === "voice" ? "Récit vocal enregistré." : "Récit écrit enregistré.",
      source: "user",
    },
    ...(d.devilAnswer.trim()
      ? [
          {
            case_id: created.id,
            organization_id: org.orgId,
            event_type: "risk_noted",
            title: "Points de vigilance notés",
            description: "La réponse probable de l’autre partie est documentée.",
            source: "ai" as const,
          },
        ]
      : []),
  ]);

  revalidatePath("/app");
  redirect(`/app/dossiers/${created.id}`);
}

/* ── Paiement reçu ────────────────────────────────────────────────────────── */

export async function recordPayment(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const caseId = z.uuid().safeParse(formData.get("caseId"));
  const cents = parseAmountToCents(String(formData.get("amount") ?? ""));
  if (!caseId.success || cents <= 0) {
    return { error: "Entrez un montant valide." };
  }
  const org = await currentOrgId();
  if ("error" in org) return { error: org.error };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("cases")
    .select("amount_claimed_cents, amount_recovered_cents, stage_total")
    .eq("id", caseId.data)
    .single();
  if (!current) return { error: "Dossier introuvable." };

  const recovered = current.amount_recovered_cents + cents;
  const fullyPaid = recovered >= current.amount_claimed_cents;

  const { error } = await supabase
    .from("cases")
    .update({
      amount_recovered_cents: recovered,
      ...(fullyPaid
        ? {
            status: "resolved",
            stage: current.stage_total,
            next_action_label: null,
            next_action_at: null,
          }
        : {}),
    })
    .eq("id", caseId.data);
  if (error) return { error: "Impossible d’enregistrer le paiement." };

  await supabase.from("case_events").insert({
    case_id: caseId.data,
    organization_id: org.orgId,
    event_type: "payment",
    title: fullyPaid ? "Paiement reçu, dossier soldé" : "Paiement partiel reçu",
    description: `Montant encaissé : ${(cents / 100).toLocaleString("fr-FR")} €.`,
    source: "user",
  });

  revalidatePath("/app");
  revalidatePath(`/app/dossiers/${caseId.data}`);
  return {};
}

/* ── Dossiers d'exemple ───────────────────────────────────────────────────── */

export async function createSampleCases(): Promise<void> {
  const org = await currentOrgId();
  if ("error" in org) return;
  const supabase = await createClient();

  const samples = [
    {
      case_type: "unpaid_invoice",
      title: "Facture F-2026-042 · SARL Bâti Concept",
      status: "awaiting_user",
      debtor_name: "SARL Bâti Concept",
      amount_claimed_cents: 240000,
      stage: 3,
      next_action_label: "Valider la mise en demeure",
      next_action_at: days(1),
      expected_recovery_at: days(18),
      summary_md:
        "Prestation livrée le 28 mai, facture émise le 30 mai, échéance dépassée de 47 jours. Deux relances envoyées, la seconde lue sans réponse.",
      weak_points_md:
        "Le client a évoqué oralement un retard de livraison : rassembler les échanges prouvant que le report avait été accepté.",
      events: [
        { at: -25, type: "created", title: "Dossier créé depuis votre récit vocal", source: "user" },
        { at: -25, type: "documents", title: "4 preuves classées, devis signé retrouvé", source: "ai" },
        { at: -21, type: "letter_sent", title: "Relance cordiale envoyée", source: "system" },
        { at: -12, type: "letter_sent", title: "Relance ferme envoyée, lue par le client", source: "system" },
        { at: -1, type: "letter_ready", title: "Mise en demeure prête pour recommandé", source: "ai" },
      ],
    },
    {
      case_type: "unpaid_invoice",
      title: "Facture 2026-118 · Menuiserie Roux",
      status: "awaiting_debtor",
      debtor_name: "Menuiserie Roux",
      amount_claimed_cents: 585000,
      stage: 2,
      next_action_label: "Relance ferme programmée",
      next_action_at: days(4),
      expected_recovery_at: days(32),
      summary_md:
        "Fourniture et pose sur un programme neuf. Facture de solde impayée depuis 3 semaines, le gérant promet un règlement « à la fin du mois » depuis deux mois.",
      weak_points_md: null,
      events: [
        { at: -9, type: "created", title: "Dossier créé", source: "user" },
        { at: -8, type: "letter_sent", title: "Relance cordiale envoyée", source: "system" },
        { at: -3, type: "response", title: "Réponse reçue : promesse de paiement fin de mois", source: "ai" },
      ],
    },
    {
      case_type: "client_dispute",
      title: "Litige livraison · Dubois Rénovation",
      status: "awaiting_user",
      debtor_name: "Dubois Rénovation",
      amount_claimed_cents: 320000,
      stage: 1,
      next_action_label: "Ajouter la preuve de livraison et les photos",
      next_action_at: days(2),
      expected_recovery_at: null,
      summary_md:
        "Le client refuse de valider la livraison et bloque le solde en invoquant des finitions non conformes. Les corrections demandées ont été faites la semaine 26.",
      weak_points_md:
        "Deux points mineurs restaient ouverts au 15 juin : documenter leur résolution (photos datées, échange de confirmation).",
      events: [
        { at: -6, type: "created", title: "Dossier créé depuis votre récit vocal", source: "user" },
        { at: -6, type: "risk_noted", title: "Points de vigilance notés", source: "ai" },
        { at: -4, type: "documents", title: "Chronologie reconstituée à partir de 12 emails", source: "ai" },
      ],
    },
    {
      case_type: "unpaid_invoice",
      title: "Facture A-2026-07 · Atelier Camille Perrin",
      status: "resolved",
      debtor_name: "Atelier Camille Perrin",
      amount_claimed_cents: 168000,
      amount_recovered_cents: 168000,
      stage: 4,
      next_action_label: null,
      next_action_at: null,
      expected_recovery_at: null,
      summary_md:
        "Intervention sur un local professionnel. Payée intégralement après la relance ferme.",
      weak_points_md: null,
      events: [
        { at: -34, type: "created", title: "Dossier créé", source: "user" },
        { at: -30, type: "letter_sent", title: "Relance cordiale envoyée", source: "system" },
        { at: -23, type: "letter_sent", title: "Relance ferme envoyée", source: "system" },
        { at: -19, type: "payment", title: "Paiement reçu, dossier soldé", source: "user" },
      ],
    },
  ] as const;

  for (const s of samples) {
    const { events, ...caseRow } = s;
    const { data: created } = await supabase
      .from("cases")
      .insert({
        ...caseRow,
        organization_id: org.orgId,
        is_sample: true,
        source: "sample",
      })
      .select("id")
      .single();
    if (created) {
      await supabase.from("case_events").insert(
        events.map((e) => ({
          case_id: created.id,
          organization_id: org.orgId,
          event_type: e.type,
          title: e.title,
          source: e.source,
          event_date: days(e.at),
        })),
      );
    }
  }

  revalidatePath("/app");
}

export async function deleteSampleCases(): Promise<void> {
  const org = await currentOrgId();
  if ("error" in org) return;
  const supabase = await createClient();
  await supabase.from("cases").delete().eq("is_sample", true);
  revalidatePath("/app");
}
