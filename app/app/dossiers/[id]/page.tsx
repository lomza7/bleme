import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  CircleAlert,
  Clock,
  Download,
  Sparkles,
  ShieldQuestion,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { dateLongFr, euros } from "@/lib/format";
import { CASE_TYPE_LABEL, STATUS_META } from "@/lib/cases/constants";
import { checklistFor, completeness, DOC_KINDS } from "@/lib/cases/completeness";
import { derivePhase, nextLetterKind } from "@/lib/cases/phases";
import { LETTER_KINDS } from "@/lib/cases/letter-meta";
import { dossierWarnings } from "@/lib/cases/analysis";
import { Uploader } from "@/components/app/uploader";
import { GenerateLetterButtons, LetterRow } from "@/components/app/letters";
import { ReviewLetter } from "@/components/app/review-letter";
import { FactRow } from "@/components/app/fact-row";
import { FileList } from "@/components/app/file-list";
import { DossierSteps, type Companion } from "@/components/app/dossier-steps";
import { CompanionCard } from "@/components/app/companion-card";
import { CaseRequest } from "@/components/app/case-request";
import { Phase2Flow } from "@/components/app/phase2-flow";
import { EscalationPanel } from "@/components/app/escalation-panel";
import { PhaseTrail } from "@/components/app/phase-trail";
import { Markdown } from "@/components/app/markdown";
import { CaseEventsTimeline } from "@/components/app/case-events-timeline";

export const metadata: Metadata = { title: "Dossier" };

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: c }, { data: docs }, { data: letters }, { data: replies }, { data: events }] =
    await Promise.all([
      supabase.from("cases").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("documents")
        .select("id, doc_kind, doc_class, file_name, mime_type, size_bytes, created_at")
        .eq("case_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("letters")
        .select("id, kind, status, subject, body_md, channel, approved_at, created_at")
        .eq("case_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("debtor_replies").select("handled").eq("case_id", id),
      supabase
        .from("case_events")
        .select("event_date, event_type, title, description, source")
        .eq("case_id", id)
        .order("event_date", { ascending: false }),
    ]);
  if (!c) notFound();

  const docList = docs ?? [];
  const { data: facts } = docList.length
    ? await supabase
        .from("document_extractions")
        .select("id, document_id, field_key, value_text, value_normalized, corrected_value, is_user_corrected, confidence, source_excerpt")
        .in("document_id", docList.map((d) => d.id))
    : { data: [] };

  const statusMeta = STATUS_META[c.status] ?? { label: c.status, tone: "muted" };
  const items = checklistFor(c.case_type);
  const { score, satisfied, missing } = completeness(c.case_type, docList);
  const satisfiedSet = new Set(satisfied);
  const factList = facts ?? [];
  const warnings = dossierWarnings(
    c.case_type,
    Number(c.amount_claimed_cents) || 0,
    docList.map((d) => ({
      doc_kind: d.doc_kind,
      facts: factList
        .filter((f) => f.document_id === d.id)
        .map((f) => ({
          field_key: f.field_key,
          value_text: f.value_text ?? "",
          value_normalized: (f.value_normalized as Record<string, unknown> | null) ?? null,
          confidence: Number(f.confidence),
          source_excerpt: f.source_excerpt,
        })),
    })),
  );

  const letterList = letters ?? [];
  const sentKinds = letterList.filter((l) => l.status === "sent").map((l) => l.kind);
  const pendingRaw = letterList.find((l) => l.status === "draft" || l.status === "edited");
  const pendingLetter = pendingRaw
    ? {
        id: pendingRaw.id,
        subject: pendingRaw.subject,
        body_md: pendingRaw.body_md,
        status: pendingRaw.status,
        channel: pendingRaw.channel,
        approved_at: pendingRaw.approved_at,
      }
    : null;
  const hasUnhandledReply = (replies ?? []).some((r) => !r.handled);
  const active = c.status !== "resolved" && c.status !== "closed";
  const isDispute = c.case_type === "client_dispute";
  const phase = derivePhase({ status: c.status, sentKinds });
  const nextKind = nextLetterKind(c.case_type, sentKinds);
  const missLabels = missing.map((m) => m.label.toLowerCase());

  const header = (
    <>
      <Link
        href="/app"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Tableau de bord
      </Link>
      <div className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              statusMeta.tone === "green"
                ? "bg-emerald-100 text-emerald-800"
                : statusMeta.tone === "amber"
                  ? "bg-amber-100 text-amber-800"
                  : statusMeta.tone === "brand"
                    ? "bg-brand-soft text-brand-strong"
                    : "bg-muted text-muted-foreground"
            }`}
          >
            {statusMeta.label}
          </span>
          <span className="text-xs text-muted-foreground">
            {CASE_TYPE_LABEL[c.case_type]}
            {c.is_sample ? " · dossier d’exemple" : ""} · créé le {dateLongFr(c.created_at)}
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{c.title}</h1>
      </div>
    </>
  );

  const piecesSection = (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 className="font-semibold">Pièces du dossier</h2>
        <p className="text-xs text-muted-foreground">
          {docList.length} document{docList.length > 1 ? "s" : ""} · téléchargez ou retirez une pièce
        </p>
      </div>
      <div className="mt-4">
        <FileList
          docs={docList.map((d) => ({
            id: d.id,
            file_name: d.file_name,
            mime_type: d.mime_type,
            size_bytes: Number(d.size_bytes),
            created_at: d.created_at,
          }))}
        />
      </div>
    </section>
  );

  const courriersSection =
    letterList.length > 0 ? (
      <section className="mt-6">
        <h2 className="px-1 font-semibold">Courriers</h2>
        <div className="mt-4 flex flex-col gap-2.5">
          {letterList.map((l) => (
            <LetterRow key={l.id} letter={l} caseId={c.id} />
          ))}
        </div>
      </section>
    ) : null;

  // ── Cahier vivant : synthèse consolidée + chronologie (visibles en toutes phases) ──
  const caseEvents = (events ?? []).map((e) => ({
    date: e.event_date,
    type: e.event_type,
    title: e.title,
    description: e.description,
    source: e.source,
  }));
  const cahierSections = (
    <>
      {c.living_brief_md ? (
        <section className="mt-6 rounded-[1.75rem] border bg-card p-6 sm:p-7">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-brand-strong" />
            <h2 className="text-lg font-semibold">Synthèse du dossier</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Ce que vos agents ont compris et consigné, tenu à jour à chaque étape.
          </p>
          <Markdown content={c.living_brief_md} className="mt-4" />
        </section>
      ) : null}
      {caseEvents.length > 0 ? (
        <section className="mt-6 rounded-[1.75rem] border bg-card p-6 sm:p-7">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-brand-strong" />
            <h2 className="text-lg font-semibold">Chronologie</h2>
          </div>
          <div className="mt-4">
            <CaseEventsTimeline events={caseEvents} />
          </div>
        </section>
      ) : null}
    </>
  );

  // ── Dossier résolu / clos : vue de synthèse en lecture seule ────────────────
  if (!active) {
    return (
      <div>
        {header}
        <div className="mt-8">
          <PhaseTrail phase={phase} />
        </div>
        {cahierSections}
        <section className="mt-6 rounded-[1.75rem] border bg-card p-6 sm:p-7">
          <h2 className="text-lg font-semibold">
            {c.status === "resolved" ? "Dossier résolu" : "Dossier clôturé"}
          </h2>
          {c.status === "resolved" ? (
            <p className="mt-1 text-sm text-emerald-700">{euros(Number(c.amount_recovered_cents) || 0)} récupérés.</p>
          ) : null}
          <Link
            href={`/app/dossiers/${c.id}/export`}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-strong"
          >
            <Download className="size-4" />
            Exporter le dossier
          </Link>
        </section>
        {courriersSection}
        {piecesSection}
      </div>
    );
  }

  // ── Panneaux Phase 1 ────────────────────────────────────────────────────────
  const panelDemande = (
    <CaseRequest
      caseId={c.id}
      debtorName={c.debtor_name}
      amountCents={Number(c.amount_claimed_cents) || 0}
      subject={c.summary_md ?? ""}
    />
  );

  const panelPreuves = (
    <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Rassemblez les preuves</h2>
        <span className="text-sm font-medium text-brand-strong">{satisfied.length}/{items.length} · {score}%</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Déposez chaque pièce : elle est reconnue, classée et rattachée au dossier.
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand transition-all duration-700 ease-out" style={{ width: `${score}%` }} />
      </div>
      <ul className="mt-5 space-y-2.5">
        {items.map((item) => {
          const ok = satisfiedSet.has(item.kind);
          return (
            <li key={item.kind} className="flex items-start gap-3">
              {ok ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground/40" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                {!ok ? <p className="text-xs text-muted-foreground">{item.hint}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 border-t pt-6">
        <p className="mb-3 text-sm font-medium">Ajouter une pièce</p>
        <Uploader scope={c.id} kinds={DOC_KINDS} />
      </div>
    </section>
  );

  const panelFaits = (
    <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
      <div className="flex items-center gap-2">
        <Sparkles className="size-5 text-brand-strong" />
        <h2 className="text-lg font-semibold">Vérifiez les faits</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Repérés automatiquement dans vos pièces, avec leur source. Une correction de votre part fait foi.
      </p>
      {factList.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {factList.map((f) => (
            <FactRow key={f.id} fact={f} caseId={c.id} />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
          Rien à vérifier pour l’instant. Ajoutez une facture à l’étape précédente et le montant, la date et le numéro en seront extraits.
        </p>
      )}
      {warnings.length > 0 ? (
        <div className="mt-5 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200">
          <div className="flex items-center gap-2">
            <CircleAlert className="size-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">Cohérence à vérifier</p>
          </div>
          <ul className="mt-2 space-y-1.5">
            {warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-amber-800">
                <span aria-hidden className="mt-0.5">•</span>
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {c.weak_points_md ? (
        <div className="mt-5 rounded-2xl bg-brand-soft p-5 ring-1 ring-brand/25">
          <div className="flex items-center gap-2">
            <ShieldQuestion className="size-4 text-brand-strong" />
            <p className="text-sm font-semibold">Point de vigilance</p>
          </div>
          <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{c.weak_points_md}</p>
        </div>
      ) : null}
    </section>
  );

  const firstKind = isDispute ? "response" : "reminder_1";
  const panelPremierCourrier = (
    <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
      <h2 className="text-lg font-semibold">Lancez la première relance</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Un brouillon est préparé à partir des faits validés. Relisez-le, choisissez le mode d’envoi, puis validez pour l’envoyer en votre nom.
      </p>
      {warnings.length > 0 && !pendingLetter ? (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800 ring-1 ring-amber-200">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {warnings.length} incohérence{warnings.length > 1 ? "s" : ""} repérée{warnings.length > 1 ? "s" : ""} : vérifiez-les à l’étape « Faits » avant d’envoyer.
        </p>
      ) : null}
      {pendingLetter ? (
        <div className="mt-5">
          <ReviewLetter letter={pendingLetter} caseId={c.id} embedded />
        </div>
      ) : (
        <div className="mt-4">
          <GenerateLetterButtons caseId={c.id} caseType={c.case_type} kinds={[firstKind]} primary />
          {score < 100 ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Astuce : complétez d’abord les preuves manquantes pour un courrier plus solide.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );

  const companionsP1: Companion[] = [
    { key: "marius", prenom: "Marius", role: "Agent Impayés", message: "Vérifions votre demande : à qui, combien, pour quoi. Vous pourrez tout corriger." },
    {
      key: "nora",
      prenom: "Nora",
      role: "Agente Preuves",
      message:
        docList.length === 0
          ? "Déposez votre première pièce : je la lis et la classe aussitôt."
          : missing.length > 0
            ? `J’ai classé ${docList.length} pièce${docList.length > 1 ? "s" : ""}. Il manque encore : ${missLabels.slice(0, 2).join(", ")}.`
            : "Toutes les pièces attendues sont là. On peut passer à la vérification.",
    },
    {
      key: "nora",
      prenom: "Nora",
      role: "Agente Preuves",
      message:
        factList.length > 0
          ? `J’ai repéré ${factList.length} information${factList.length > 1 ? "s" : ""} dans vos pièces. Vérifiez-les — votre correction fait foi.`
          : "Ajoutez une facture et j’en extrais le montant, la date et le numéro.",
    },
    {
      key: "marius",
      prenom: "Marius",
      role: "Agent Impayés",
      message: pendingLetter
        ? "Votre brouillon est prêt. Relisez-le, puis validez pour l’envoyer en votre nom."
        : "Je prépare votre première relance à partir des faits validés. Il ne partira qu’après votre validation.",
    },
  ];

  // ── Compagnon Phase 2 / Phase 3 ─────────────────────────────────────────────
  const companionP2: Companion = pendingLetter
    ? { key: "marius", prenom: "Marius", role: "Agent Impayés", message: "Votre brouillon est prêt. Relisez-le, puis validez pour l’envoyer en votre nom." }
    : hasUnhandledReply
      ? {
          key: isDispute ? "lena" : "marius",
          prenom: isDispute ? "Léna" : "Marius",
          role: isDispute ? "Agente Litiges" : "Agent Impayés",
          message: "Le client a répondu. Je prépare une réponse adaptée à ce qu’il dit et à vos pièces.",
        }
      : {
          key: "sacha",
          prenom: "Sacha",
          role: "Agent Vigie",
          message: nextKind
            ? `Je surveille l’échéance. Prochaine relance : ${LETTER_KINDS[nextKind]?.label ?? nextKind}. Dites-moi si le client répond, on adaptera.`
            : "Toutes les relances sont parties. On peut envisager l’escalade en phase suivante.",
        };

  const companionP3: Companion = c.devil_review
    ? { key: "jeanne", prenom: "Jeanne", role: "Agente Avocat du diable", message: "J’ai passé le dossier au crible. Voici les objections possibles et la pièce qui corrige chacune." }
    : { key: "jeanne", prenom: "Jeanne", role: "Agente Avocat du diable", message: "Avant d’escalader, je peux examiner le dossier du point de vue de la partie adverse." };

  const defaultStep = pendingLetter ? 3 : missing.length > 0 ? 1 : 3;

  return (
    <div>
      {header}

      <div className="mt-8">
        <PhaseTrail phase={phase} />
      </div>

      {cahierSections}

      <div className="mt-6">
        {phase === 1 ? (
          <DossierSteps
            stepLabels={["Demande", "Preuves", "Faits", "Premier courrier"]}
            panels={[panelDemande, panelPreuves, panelFaits, panelPremierCourrier]}
            companions={companionsP1}
            defaultStep={defaultStep}
            side={null}
          />
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {phase === 2 ? (
                <Phase2Flow
                  caseId={c.id}
                  caseType={c.case_type}
                  nextKind={nextKind}
                  nextActionAt={c.next_action_at}
                  pendingLetter={pendingLetter}
                  hasUnhandledReply={hasUnhandledReply}
                />
              ) : (
                <EscalationPanel
                  caseId={c.id}
                  status={c.status}
                  devilReview={c.devil_review ?? null}
                  escalationSummary={c.escalation_summary_md ?? null}
                  pendingLetter={pendingLetter}
                />
              )}
            </div>
            <aside className="lg:sticky lg:top-6">
              <CompanionCard companion={phase === 2 ? companionP2 : companionP3} />
            </aside>
          </div>
        )}
      </div>

      {courriersSection}
      {piecesSection}
    </div>
  );
}
