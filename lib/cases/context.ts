import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { FIELD_LABEL } from "@/lib/cases/extraction";

/*
 * État consolidé d'un dossier : dossier, faits extraits (avec source et
 * corrections), timeline chronologique, pièces, courriers, réponses du
 * débiteur. Réutilisable comme mémoire partagée des agents et comme entrée
 * de la synthèse vivante (living brief).
 */

export type CaseFact = {
  fieldKey: string;
  label: string;
  value: string;
  confidence: number;
  sourceExcerpt: string | null;
  corrected: boolean;
};

export type CaseTimelineItem = {
  date: string;
  type: string;
  title: string;
  description: string | null;
  source: string;
};

export type CaseContext = {
  id: string;
  organizationId: string;
  title: string;
  caseType: string;
  status: string;
  phase: number | null;
  summaryMd: string | null;
  weakPointsMd: string | null;
  escalationSummaryMd: string | null;
  closedReason: string | null;
  completenessScore: number | null;
  amountClaimedCents: number;
  amountRecoveredCents: number;
  debtorName: string | null;
  debtorCompany: unknown | null;
  devilReview: unknown | null;
  livingBriefMd: string | null;
  briefVersion: number;
  facts: CaseFact[];
  timeline: CaseTimelineItem[];
  documents: { fileName: string; docKind: string | null; docClass: string | null; summary: string | null }[];
  letters: { kind: string; status: string; subject: string | null; sentAt: string | null }[];
  replies: { receivedAt: string; via: string | null; body: string }[];
  // Prises de parole des agents aux passages de relais (+ réponses utilisateur,
  // qui priment) : les agents suivants les voient et ne reposent pas la question.
  observations: { agentKey: string; kind: string; title: string; status: string; answer: string | null }[];
};

export async function buildCaseContext(
  sb: SupabaseClient,
  caseId: string,
): Promise<CaseContext | null> {
  const { data: row } = await sb
    .from("cases")
    .select(
      "id, organization_id, title, case_type, status, phase, summary_md, weak_points_md, escalation_summary_md, closed_reason, completeness_score, amount_claimed_cents, amount_recovered_cents, debtor_name, debtor_company, devil_review, living_brief_md, living_brief_version",
    )
    .eq("id", caseId)
    .maybeSingle();

  if (!row) return null;

  // Les pièces d'abord : les extractions y sont rattachées par document_id.
  const { data: docRows } = await sb
    .from("documents")
    .select("id, file_name, doc_kind, doc_class, summary")
    .eq("case_id", caseId);

  const docs = docRows ?? [];
  const docIds = docs.map((d) => d.id);

  const [extRes, eventsRes, lettersRes, repliesRes, obsRes] = await Promise.all([
    docIds.length
      ? sb
          .from("document_extractions")
          .select(
            "field_key, value_text, value_normalized, confidence, source_excerpt, is_user_corrected, corrected_value",
          )
          .in("document_id", docIds)
      : Promise.resolve({ data: [] as unknown[] }),
    sb
      .from("case_events")
      .select("event_date, event_type, title, description, source")
      .eq("case_id", caseId)
      .order("event_date", { ascending: true }),
    sb
      .from("letters")
      .select("kind, status, subject, sent_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
    sb
      .from("debtor_replies")
      .select("received_at, received_via, body_text")
      .eq("case_id", caseId)
      .order("received_at", { ascending: true }),
    sb
      .from("agent_observations")
      .select("agent_key, kind, title, status, answer_text")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
  ]);

  const facts: CaseFact[] = (
    (extRes.data ?? []) as {
      field_key: string;
      value_text: string | null;
      confidence: number | null;
      source_excerpt: string | null;
      is_user_corrected: boolean | null;
      corrected_value: string | null;
    }[]
  ).map((e) => ({
    fieldKey: e.field_key,
    label: FIELD_LABEL[e.field_key] ?? e.field_key,
    value: e.corrected_value ?? e.value_text ?? "—",
    confidence: Number(e.confidence ?? 0),
    sourceExcerpt: e.source_excerpt,
    corrected: e.is_user_corrected === true,
  }));

  const timeline: CaseTimelineItem[] = (
    (eventsRes.data ?? []) as {
      event_date: string;
      event_type: string;
      title: string;
      description: string | null;
      source: string;
    }[]
  ).map((ev) => ({
    date: ev.event_date,
    type: ev.event_type,
    title: ev.title,
    description: ev.description,
    source: ev.source,
  }));

  const letters = (
    (lettersRes.data ?? []) as {
      kind: string;
      status: string;
      subject: string | null;
      sent_at: string | null;
    }[]
  ).map((l) => ({
    kind: l.kind,
    status: l.status,
    subject: l.subject,
    sentAt: l.sent_at,
  }));

  const replies = (
    (repliesRes.data ?? []) as {
      received_at: string;
      received_via: string | null;
      body_text: string;
    }[]
  ).map((r) => ({
    receivedAt: r.received_at,
    via: r.received_via,
    body: r.body_text,
  }));

  const observations = (
    (obsRes.data ?? []) as {
      agent_key: string;
      kind: string;
      title: string;
      status: string;
      answer_text: string | null;
    }[]
  ).map((o) => ({
    agentKey: o.agent_key,
    kind: o.kind,
    title: o.title,
    status: o.status,
    answer: o.answer_text,
  }));

  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    caseType: row.case_type,
    status: row.status,
    phase: row.phase,
    summaryMd: row.summary_md,
    weakPointsMd: row.weak_points_md,
    escalationSummaryMd: row.escalation_summary_md,
    closedReason: row.closed_reason,
    completenessScore: row.completeness_score,
    amountClaimedCents: row.amount_claimed_cents ?? 0,
    amountRecoveredCents: row.amount_recovered_cents ?? 0,
    debtorName: row.debtor_name,
    debtorCompany: row.debtor_company ?? null,
    devilReview: row.devil_review ?? null,
    livingBriefMd: row.living_brief_md ?? null,
    briefVersion: row.living_brief_version ?? 0,
    facts,
    timeline,
    documents: docs.map((d) => ({
      fileName: d.file_name,
      docKind: d.doc_kind,
      docClass: d.doc_class,
      summary: d.summary ?? null,
    })),
    letters,
    replies,
    observations,
  };
}
