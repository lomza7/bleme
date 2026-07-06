import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleUser,
  Cog,
  FileText,
  Sparkles,
  ShieldQuestion,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { dateFr, dateLongFr, euros } from "@/lib/format";
import { CASE_TYPE_LABEL, STATUS_META } from "@/lib/cases/constants";
import { checklistFor, completeness, DOC_KINDS } from "@/lib/cases/completeness";
import { dossierWarnings } from "@/lib/cases/analysis";
import { Uploader } from "@/components/app/uploader";
import { GenerateLetterButtons, LetterRow } from "@/components/app/letters";
import { FactRow } from "@/components/app/fact-row";
import { DossierSteps, type Companion } from "@/components/app/dossier-steps";

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

  const [{ data: c }, { data: events }, { data: docs }, { data: letters }] = await Promise.all([
    supabase.from("cases").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("case_events")
      .select("id, event_date, event_type, title, description, source")
      .eq("case_id", id)
      .order("event_date", { ascending: false }),
    supabase.from("documents").select("id, doc_kind, doc_class").eq("case_id", id).order("created_at", { ascending: false }),
    supabase
      .from("letters")
      .select("id, kind, status, subject, created_at")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
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
  const remaining = c.amount_claimed_cents - c.amount_recovered_cents;
  const items = checklistFor(c.case_type);
  const { score, satisfied, missing } = completeness(c.case_type, docList);
  const satisfiedSet = new Set(satisfied);
  const factList = facts ?? [];
  // Cohérence à l'échelle du dossier : on ne laisse plus passer un dossier bancal.
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
  const pendingLetter = letterList.find((l) => l.status === "draft" || l.status === "edited");
  const hasSent = letterList.some((l) => l.status === "sent");
  const active = c.status !== "resolved" && c.status !== "closed";

  // ── Panneaux des étapes ─────────────────────────────────────────────────────
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
      {active ? (
        <div className="mt-6 border-t pt-6">
          <p className="mb-3 text-sm font-medium">Ajouter une pièce</p>
          <Uploader scope={c.id} kinds={DOC_KINDS} />
        </div>
      ) : null}
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

  const panelCourrier = (
    <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
      <h2 className="text-lg font-semibold">Rédigez et validez</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Un brouillon est préparé à partir des faits validés. Relisez-le, puis validez pour l’envoyer en votre nom.
      </p>
      {warnings.length > 0 ? (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800 ring-1 ring-amber-200">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {warnings.length} incohérence{warnings.length > 1 ? "s" : ""} repérée{warnings.length > 1 ? "s" : ""} : vérifiez-les à l’étape « Faits » avant d’envoyer.
        </p>
      ) : null}
      {active ? (
        <div className="mt-4">
          <GenerateLetterButtons caseId={c.id} caseType={c.case_type} />
        </div>
      ) : null}
      {letterList.length > 0 ? (
        <div className="mt-5 flex flex-col gap-2.5">
          {letterList.map((l) => (
            <LetterRow key={l.id} letter={l} caseId={c.id} />
          ))}
        </div>
      ) : null}
      {score < 100 && !hasSent ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Astuce : complétez d’abord les preuves manquantes à l’étape 1 pour un courrier plus solide.
        </p>
      ) : null}
    </section>
  );

  // ── Agent compagnon par étape (réactions scriptées à l'état réel) ───────────
  const missLabels = missing.map((m) => m.label.toLowerCase());
  const companions: Companion[] = [
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
        : hasSent
          ? "Relance envoyée. Sacha surveille maintenant les échéances."
          : "Je prépare votre courrier à partir des faits validés. Choisissez le ton.",
    },
  ];

  const defaultStep = pendingLetter ? 2 : score < 100 ? 0 : letterList.length > 0 ? 2 : 1;

  const sideCard = (
    <>
      <section className="rounded-[1.75rem] border bg-card p-7">
        <h2 className="font-semibold">Montants</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Réclamé</dt>
            <dd className="font-semibold">{euros(c.amount_claimed_cents)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Récupéré</dt>
            <dd className="font-semibold text-emerald-700">{euros(c.amount_recovered_cents)}</dd>
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <dt className="text-muted-foreground">Restant</dt>
            <dd className="font-bold">{euros(Math.max(0, remaining))}</dd>
          </div>
        </dl>
      </section>
      <Link
        href={`/app/documents/${c.id}`}
        className="flex items-center gap-3 rounded-[1.75rem] border bg-card p-5 transition-colors duration-300 hover:border-brand/50 hover:bg-brand-soft/40"
      >
        <FileText className="size-5 text-brand-strong" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Toutes les pièces</p>
          <p className="text-xs text-muted-foreground">
            {docList.length} document{docList.length > 1 ? "s" : ""} dans ce dossier
          </p>
        </div>
        <ArrowRight className="ml-auto size-4 text-muted-foreground" />
      </Link>
    </>
  );

  return (
    <div>
      <Link
        href="/app"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Tableau de bord
      </Link>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
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
      </div>

      <div className="mt-8">
        <DossierSteps
          stepLabels={["Preuves", "Faits", "Courrier"]}
          panels={[panelPreuves, panelFaits, panelCourrier]}
          companions={companions}
          defaultStep={defaultStep}
          side={sideCard}
        />
      </div>

      {/* Chronologie du dossier */}
      <section className="mt-6 rounded-[1.75rem] border bg-card p-6 sm:p-7">
        <h2 className="font-semibold">Chronologie</h2>
        <ol className="relative mt-5">
          <span aria-hidden className="absolute bottom-3 left-[15px] top-3 w-px bg-border" />
          {(events ?? []).map((e) => (
            <li key={e.id} className="relative flex items-start gap-4 py-3">
              <span className="z-[1] mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-4 ring-card">
                {e.source === "ai" ? <Bot className="size-4" /> : e.source === "user" ? <CircleUser className="size-4" /> : <Cog className="size-4" />}
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-medium">{e.title}</p>
                {e.description ? <p className="mt-0.5 text-sm text-muted-foreground">{e.description}</p> : null}
                <p className="mt-0.5 text-xs text-muted-foreground/80">{dateFr(e.event_date)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
