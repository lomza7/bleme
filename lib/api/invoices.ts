import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { createCaseCore } from "@/lib/cases/create";

/*
 * Écriture d'une facture poussée par l'API. Upsert IDEMPOTENT sur la clé
 * naturelle (organization_id, provider='api', external_id) : rejouer la même
 * facture ne crée pas de doublon. Option create_case = « dossier en 1 clic »
 * (dossier inerte lié + PDF éventuel). Service-role (RLS contournée) mais
 * organization_id est toujours forcé depuis l'argument.
 */

type ServiceClient = ReturnType<typeof createServiceClient>;

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export type InvoiceInput = {
  external_id: string;
  invoice_number?: string;
  label?: string;
  customer_name?: string;
  customer_email?: string;
  customer_siren?: string;
  amount_cents?: number;
  remaining_cents?: number;
  currency?: string;
  issued_on?: string;
  deadline_on?: string;
  paid?: boolean;
  pdf_base64?: string;
};

const INVOICE_RETURN =
  "id, provider, external_id, invoice_number, label, customer_name, customer_email, customer_siren, amount_cents, remaining_cents, currency, issued_on, deadline_on, paid, case_id, created_at";

export async function pushInvoice(
  orgId: string,
  input: InvoiceInput,
  wantCase: boolean,
): Promise<{ invoice: Record<string, unknown>; case_id: string | null; pdf_attached: boolean | null } | null> {
  const sb = createServiceClient();
  // Upsert MERGE partiel : n'inclure que les champs réellement fournis, sinon
  // un re-push partiel (ex. { external_id, paid:true } pour marquer un paiement)
  // écraserait à NULL le numéro/client/montants déjà stockés (upsert = SET des
  // colonnes présentes dans l'objet). organization_id/provider/external_id sont
  // la clé de conflit et restent forcés.
  const row: Record<string, unknown> = {
    organization_id: orgId, // FORCÉ
    provider: "api",
    external_id: input.external_id,
    synced_at: new Date().toISOString(),
  };
  const put = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };
  put("invoice_number", input.invoice_number);
  put("label", input.label);
  put("customer_name", input.customer_name);
  put("customer_email", input.customer_email);
  put("customer_siren", input.customer_siren);
  put("amount_cents", input.amount_cents);
  put("remaining_cents", input.remaining_cents);
  put("currency", input.currency);
  put("issued_on", input.issued_on);
  put("deadline_on", input.deadline_on);
  put("paid", input.paid);

  const { data: invoice, error } = await sb
    .from("accounting_invoices")
    .upsert(row, { onConflict: "organization_id,provider,external_id" })
    .select(INVOICE_RETURN)
    .single();
  if (error || !invoice) return null;

  const stored = invoice as unknown as { id: string; case_id: string | null };
  let caseId = stored.case_id ?? null;
  let pdfAttached: boolean | null = input.pdf_base64 ? false : null;

  // Créer un dossier lié seulement si demandé, pas déjà lié, et facture impayée.
  if (wantCase && !caseId && !(input.paid ?? false)) {
    const created = await createCaseCore(
      orgId,
      {
        case_type: "unpaid_invoice",
        debtor_name: input.customer_name || "Client",
        amount_claimed_cents: input.remaining_cents ?? input.amount_cents ?? 0,
        debtor_email: input.customer_email ?? null,
        debtor_siren: input.customer_siren ?? null,
        summary_md: `Facture ${input.invoice_number ?? input.external_id} importée par l'API. Vérifiez les informations — vos corrections font foi.`,
      },
      { source: "api", eventTitle: "Dossier créé depuis une facture (API)" },
    );
    if (created) {
      // Liaison conditionnelle (anti double-lien / course concurrente).
      const { data: linked } = await sb
        .from("accounting_invoices")
        .update({ case_id: created.id })
        .eq("id", stored.id)
        .is("case_id", null)
        .select("id");
      if (linked && linked.length > 0) {
        caseId = created.id;
        if (input.pdf_base64) pdfAttached = await attachPdf(sb, orgId, created.id, input);
      } else {
        // Une autre requête a déjà lié un dossier : on jette le doublon.
        await sb.from("cases").delete().eq("id", created.id);
        const { data: cur } = await sb
          .from("accounting_invoices")
          .select("case_id")
          .eq("id", stored.id)
          .maybeSingle();
        caseId = (cur as unknown as { case_id: string | null } | null)?.case_id ?? null;
      }
    }
  }

  return { invoice: invoice as unknown as Record<string, unknown>, case_id: caseId, pdf_attached: pdfAttached };
}

async function attachPdf(sb: ServiceClient, orgId: string, caseId: string, input: InvoiceInput): Promise<boolean> {
  try {
    const b64 = (input.pdf_base64 ?? "").replace(/^data:[^;]+;base64,/, "");
    const buf = Buffer.from(b64, "base64");
    if (buf.length === 0 || buf.length > MAX_PDF_BYTES) return false;
    const safe = (input.invoice_number ?? "facture").replace(/[^\p{L}\p{N}._-]/gu, "-");
    const path = `${orgId}/${caseId}/${crypto.randomUUID()}-facture-${safe}.pdf`;
    const up = await sb.storage.from("documents").upload(path, buf, { contentType: "application/pdf", upsert: false });
    if (up.error) return false;
    const { error: insErr } = await sb.from("documents").insert({
      organization_id: orgId,
      case_id: caseId,
      file_name: input.invoice_number ? `Facture ${input.invoice_number}.pdf` : "Facture.pdf",
      storage_path: path,
      mime_type: "application/pdf",
      size_bytes: buf.length,
      doc_class: "integration",
      doc_kind: "facture",
    });
    return !insErr;
  } catch {
    // PDF non joint : non bloquant (l'utilisateur peut l'ajouter à la main).
    return false;
  }
}
