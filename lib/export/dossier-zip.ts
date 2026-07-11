import "server-only";
import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dateLongFr, euros } from "@/lib/format";
import { CASE_TYPE_LABEL, STATUS_META } from "@/lib/cases/constants";
import { LETTER_KINDS, LETTER_STATUS_LABEL } from "@/lib/cases/letter-meta";
import type { CompanySnapshot } from "@/lib/companies/types";
import { buildDossierPdf, type DossierPdfData } from "@/lib/export/dossier-pdf";

/*
 * « Dossier prêt pour un professionnel » : un ZIP par dossier = synthèse PDF
 * (pdf-lib) + les courriers (texte exact) + les pièces réelles du Storage,
 * numérotées. Le dossier est lu via le client USER (RLS cases.view = vérifie
 * l'accès) ; les fichiers sont récupérés en service-role, scoppés aux pièces de
 * CE dossier déjà filtrées par la RLS (l'export.data ouvre la portabilité RGPD).
 */

function slug(s: string): string {
  return (
    (s || "dossier")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .toLowerCase() || "dossier"
  );
}

function companyExtra(c: CompanySnapshot): string[] {
  const out: string[] = [];
  if (c.formeJuridique) out.push(c.formeJuridique);
  if (c.siren) out.push(`SIREN ${c.siren}`);
  const addr = [c.siege?.adresse, [c.siege?.codePostal, c.siege?.ville].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  if (addr) out.push(addr);
  if (c.capitalCents != null) out.push(`Capital social : ${euros(c.capitalCents)}`);
  for (const d of c.dirigeants ?? []) out.push(`${d.nom}${d.qualite ? ` (${d.qualite})` : ""}`);
  if (c.procedureCollective) out.push("Procédure collective en cours");
  return out;
}

export async function buildDossierZip(
  userClient: SupabaseClient,
  serviceClient: SupabaseClient,
  caseId: string,
): Promise<{ buffer: Buffer; filename: string } | { error: string }> {
  const { data: c } = await userClient.from("cases").select("*").eq("id", caseId).maybeSingle();
  if (!c) return { error: "Dossier introuvable ou accès refusé." };

  const [{ data: docs }, { data: letters }, { data: logs }, { data: events }, { data: replies }, { data: org }] =
    await Promise.all([
      userClient
        .from("documents")
        .select("id, file_name, storage_path, created_at")
        .eq("case_id", caseId)
        .order("created_at"),
      userClient
        .from("letters")
        .select("kind, subject, body_md, status, channel, approved_at, content_sha256, created_at")
        .eq("case_id", caseId)
        .order("created_at"),
      userClient
        .from("approval_logs")
        .select("action, content_sha256, channel, created_at")
        .eq("case_id", caseId)
        .order("created_at"),
      userClient
        .from("case_events")
        .select("event_date, title, description")
        .eq("case_id", caseId)
        .order("event_date"),
      userClient
        .from("debtor_replies")
        .select("received_at, received_via, body_text")
        .eq("case_id", caseId)
        .order("received_at"),
      userClient.from("organizations").select("name").limit(1).maybeSingle(),
    ]);

  const docList = docs ?? [];
  const letterList = letters ?? [];
  const company = (c.debtor_company ?? null) as CompanySnapshot | null;

  const pdfData: DossierPdfData = {
    orgName: org?.name ?? "",
    title: c.title,
    caseTypeLabel: CASE_TYPE_LABEL[c.case_type] ?? c.case_type,
    statusLabel: STATUS_META[c.status]?.label ?? c.status,
    debtorName: c.debtor_name,
    createdAtLabel: dateLongFr(c.created_at),
    amountClaimed: Number(c.amount_claimed_cents) || 0,
    amountRecovered: Number(c.amount_recovered_cents) || 0,
    company: company ? { nom: company.nom, extra: companyExtra(company) } : null,
    summary: c.living_brief_md || c.summary_md || null,
    events: (events ?? []).map((e) => ({
      dateLabel: dateLongFr(e.event_date),
      title: e.title,
      description: e.description ?? null,
    })),
    letters: letterList.map((l) => ({
      label: LETTER_KINDS[l.kind]?.label ?? l.subject ?? "Courrier",
      statusLabel: LETTER_STATUS_LABEL[l.status] ?? l.status,
      detail:
        l.status === "sent"
          ? `Validé${l.approved_at ? ` le ${dateLongFr(l.approved_at)}` : ""} · ${
              l.channel === "postal" ? "recommandé" : "email"
            }${l.content_sha256 ? ` · empreinte ${l.content_sha256.slice(0, 16)}` : ""}`
          : null,
    })),
    approvals: (logs ?? []).map(
      (l) => `${dateLongFr(l.created_at)} · ${l.action} · ${l.channel} · empreinte ${l.content_sha256.slice(0, 24)}`,
    ),
    replies: (replies ?? []).map((r) => ({
      header: `${dateLongFr(r.received_at)}${r.received_via ? ` · ${r.received_via}` : ""}`,
      text: r.body_text ?? "",
    })),
    documents: docList.map((d) => d.file_name),
    eurosFmt: euros,
  };

  const pdf = await buildDossierPdf(pdfData);

  const zip = new JSZip();
  zip.file("synthese.pdf", pdf);

  const courriers = zip.folder("courriers");
  letterList.forEach((l, i) => {
    if (!l.body_md) return;
    const name = `${String(i + 1).padStart(2, "0")}-${slug(LETTER_KINDS[l.kind]?.label ?? l.kind)}.txt`;
    courriers?.file(name, `${l.subject ?? ""}\n\n${l.body_md}`.trim());
  });

  const pieces = zip.folder("pieces");
  let n = 0;
  for (const d of docList) {
    n += 1;
    const { data: blob } = await serviceClient.storage.from("documents").download(d.storage_path);
    if (!blob) continue;
    const buf = Buffer.from(await blob.arrayBuffer());
    pieces?.file(`${String(n).padStart(2, "0")}-${d.file_name}`, buf);
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return { buffer, filename: `dossier-${slug(c.title)}.zip` };
}
