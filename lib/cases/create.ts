import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { touchCase } from "@/lib/cases/touch";
import { enqueueWebhook } from "@/lib/webhooks/enqueue";

/*
 * Cœur de création d'un dossier pour l'API publique (service-role, RLS
 * contournée) : organization_id est FORCÉ depuis l'argument, jamais depuis une
 * entrée client. Les chemins UI (wizard, facture compta) gardent leur propre
 * logique (récit, Pappers, liaison de facture) ; ce cœur ne couvre que la
 * création inerte (aucun courrier, aucun envoi — pilier juridique #1).
 */

export type CaseType = "unpaid_invoice" | "client_dispute" | "admin_request";

export type NewCaseInput = {
  case_type: CaseType;
  debtor_name: string;
  amount_claimed_cents?: number;
  title?: string;
  summary_md?: string | null;
  debtor_siren?: string | null;
  debtor_email?: string | null;
};

function days(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
}

function defaultTitle(type: CaseType, name: string): string {
  const prefix =
    type === "unpaid_invoice" ? "Facture impayée" : type === "admin_request" ? "Démarche administrative" : "Litige client";
  return `${prefix} · ${name}`;
}

function nextKind(type: CaseType): string {
  return type === "unpaid_invoice" ? "reminder_1" : type === "admin_request" ? "admin_gracieux" : "response";
}

export async function createCaseCore(
  orgId: string,
  input: NewCaseInput,
  opts?: { source?: string; eventTitle?: string; eventDescription?: string | null },
): Promise<{ id: string } | null> {
  const sb = createServiceClient();
  const { data: created, error } = await sb
    .from("cases")
    .insert({
      organization_id: orgId, // FORCÉ — jamais depuis le body
      case_type: input.case_type,
      title: input.title?.trim() || defaultTitle(input.case_type, input.debtor_name),
      status: "awaiting_user",
      debtor_name: input.debtor_name,
      debtor_siren: input.debtor_siren ?? null,
      debtor_email: input.debtor_email ?? null,
      amount_claimed_cents: input.amount_claimed_cents ?? 0,
      summary_md: input.summary_md ?? null,
      stage: 1,
      phase: 1,
      next_letter_kind: nextKind(input.case_type),
      next_action_label: "Vérifier les informations, puis ajouter vos preuves",
      next_action_at: days(1),
      expected_recovery_at: input.case_type === "unpaid_invoice" ? days(28) : null,
      source: opts?.source ?? "api",
    })
    .select("id")
    .single();
  if (error || !created) return null;

  await sb.from("case_events").insert({
    case_id: created.id,
    organization_id: orgId,
    event_type: "created",
    title: opts?.eventTitle ?? "Dossier créé par l'API",
    description: opts?.eventDescription ?? null,
    source: "user",
  });

  await touchCase(created.id, { type: "case_created", label: "Dossier créé" }, { recompute: false });
  await enqueueWebhook(orgId, "case.created", { case_id: created.id });
  return { id: created.id };
}
