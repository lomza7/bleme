import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { BarChart, Donut, Funnel, HBars } from "@/components/admin/charts";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";

export const metadata: Metadata = { title: "Vue d’ensemble" };

/*
 * Vue d'ensemble plateforme : utilisateurs, dossiers, montants, activité,
 * boîte de réception, stockage, agents. Lecture via client service-role
 * (stats trans-organisations) : la garde admin est assurée par le layout
 * et revérifiée ici. Les dossiers d'exemple (is_sample) sont exclus des
 * métriques métier et comptés à part.
 */

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  active: "En cours",
  awaiting_user: "Attend l’utilisateur",
  awaiting_debtor: "Attend le débiteur",
  escalated: "Escaladé",
  resolved: "Résolu",
  closed: "Clôturé",
};

const TYPE_LABELS: Record<string, string> = {
  unpaid_invoice: "Impayés",
  client_dispute: "Litiges clients",
  admin_request: "Démarches admin",
};

const SOURCE_LABELS: Record<string, string> = {
  email: "Emails",
  whatsapp: "WhatsApp",
  fichier: "Fichiers",
  note: "Notes",
};

function euros(cents: number): string {
  return `${Math.round(cents / 100).toLocaleString("fr-FR")} €`;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function AdminOverview() {
  // Double garde (le layout redirige déjà les non-admins).
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  const { data: me } = user
    ? await userClient.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_admin) return null;

  const service = createServiceClient();
  // eslint-disable-next-line react-hooks/purity -- bornes temporelles du reporting, recalculées à chaque requête
  const now = Date.now();
  const d7 = new Date(now - 7 * 24 * 3600 * 1000);
  const d14 = new Date(now - 14 * 24 * 3600 * 1000);
  const monthStart = new Date(now);
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [
    usersRes,
    { count: orgCount },
    { data: cases },
    { data: docs },
    { data: inboxItems },
    { data: runs },
  ] = await Promise.all([
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    service.from("organizations").select("id", { count: "exact", head: true }),
    service
      .from("cases")
      .select(
        "id, organization_id, case_type, status, stage, amount_claimed_cents, amount_recovered_cents, is_sample, created_at",
      ),
    service.from("documents").select("id, size_bytes, doc_class"),
    service.from("inbox_items").select("id, source, is_read, is_archived, is_sample"),
    service
      .from("agent_runs")
      .select("agent_key, status, cost_microcents, created_at")
      .gte("created_at", monthStart.toISOString()),
  ]);

  // ── Utilisateurs ────────────────────────────────────────────────────────────
  const users = usersRes.data?.users ?? [];
  const new7 = users.filter((u) => new Date(u.created_at) >= d7).length;
  const prev7 = users.filter(
    (u) => new Date(u.created_at) >= d14 && new Date(u.created_at) < d7,
  ).length;
  const actifs7 = users.filter(
    (u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= d7,
  ).length;
  const derniers = [...users]
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 6);

  // ── Dossiers (réels vs exemples) ────────────────────────────────────────────
  const allCases = cases ?? [];
  const reels = allCases.filter((c) => !c.is_sample);
  const samples = allCases.length - reels.length;
  const claimed = reels.reduce((s, c) => s + Number(c.amount_claimed_cents), 0);
  const recovered = reels.reduce((s, c) => s + Number(c.amount_recovered_cents), 0);
  const resolus = reels.filter((c) => c.status === "resolved").length;

  const byStatus = new Map<string, number>();
  const byType = new Map<string, number>();
  for (const c of reels) {
    byStatus.set(c.status, (byStatus.get(c.status) ?? 0) + 1);
    byType.set(c.case_type, (byType.get(c.case_type) ?? 0) + 1);
  }

  // ── Séries sur 30 jours ─────────────────────────────────────────────────────
  const days: { key: string; label: string }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 24 * 3600 * 1000);
    days.push({
      key: dayKey(d),
      label: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
    });
  }
  const signupsByDay = new Map<string, number>();
  for (const u of users) {
    const k = dayKey(new Date(u.created_at));
    signupsByDay.set(k, (signupsByDay.get(k) ?? 0) + 1);
  }
  const casesByDay = new Map<string, number>();
  for (const c of reels) {
    const k = dayKey(new Date(c.created_at));
    casesByDay.set(k, (casesByDay.get(k) ?? 0) + 1);
  }

  // ── Documents, boîte, agents ────────────────────────────────────────────────
  const allDocs = docs ?? [];
  const storageBytes = allDocs.reduce((s, d) => s + Number(d.size_bytes), 0);
  const inbox = (inboxItems ?? []).filter((i) => !i.is_sample);
  const bySource = new Map<string, number>();
  for (const i of inbox) bySource.set(i.source, (bySource.get(i.source) ?? 0) + 1);

  const monthRuns = runs ?? [];
  const aiCost = monthRuns.reduce((s, r) => s + Number(r.cost_microcents), 0);
  const aiErrors = monthRuns.filter((r) => r.status === "error").length;

  // ── Funnel d'activation ─────────────────────────────────────────────────────
  const orgsAvecDossier = new Set(reels.map((c) => c.organization_id)).size;
  const orgsAvecPaiement = new Set(
    reels.filter((c) => Number(c.amount_recovered_cents) > 0).map((c) => c.organization_id),
  ).size;

  const TILES = [
    {
      label: "Utilisateurs inscrits",
      valeur: users.length.toLocaleString("fr-FR"),
      detail: `+${new7} sur 7 j ${prev7 > 0 ? `(vs ${prev7} la semaine d'avant)` : ""}`,
    },
    {
      label: "Actifs sur 7 jours",
      valeur: actifs7.toLocaleString("fr-FR"),
      detail: `${users.length > 0 ? Math.round((actifs7 / users.length) * 100) : 0} % des inscrits`,
    },
    {
      label: "Dossiers réels",
      valeur: reels.length.toLocaleString("fr-FR"),
      detail: `${resolus} résolu${resolus > 1 ? "s" : ""} · ${samples} exemple${samples > 1 ? "s" : ""}`,
    },
    {
      label: "Organisations",
      valeur: (orgCount ?? 0).toLocaleString("fr-FR"),
      detail: `${orgsAvecDossier} avec au moins un dossier`,
    },
    {
      label: "Montants suivis",
      valeur: euros(claimed),
      detail: "réclamés sur les dossiers réels",
    },
    {
      label: "Montants récupérés",
      valeur: euros(recovered),
      detail: claimed > 0 ? `${Math.round((recovered / claimed) * 100)} % du réclamé` : "en attente de dossiers",
    },
    {
      label: "Coût IA du mois",
      valeur: `${(aiCost / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`,
      detail: `${monthRuns.length} run${monthRuns.length > 1 ? "s" : ""} · ${aiErrors} erreur${aiErrors > 1 ? "s" : ""}`,
    },
    {
      label: "Stockage documents",
      valeur: `${(storageBytes / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`,
      detail: `${allDocs.length} pièce${allDocs.length > 1 ? "s" : ""}`,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Vue d’ensemble
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toute la plateforme d’un coup d’œil : utilisateurs, dossiers,
          montants, activité. Les dossiers d’exemple sont exclus des
          métriques métier.
        </p>
      </div>

      {/* Tuiles clés */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((t) => (
          <div key={t.label} className="rounded-[1.5rem] border bg-card p-5">
            <p className="text-2xl font-bold tabular-nums tracking-tight">{t.valeur}</p>
            <p className="mt-1 text-xs font-medium">{t.label}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t.detail}</p>
          </div>
        ))}
      </div>

      {/* Courbes 30 jours */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[1.75rem] border bg-card p-6">
          <h2 className="text-sm font-semibold">Inscriptions · 30 jours</h2>
          <div className="mt-4">
            <BarChart
              ariaLabel="Inscriptions par jour sur 30 jours"
              points={days.map((d) => ({ label: d.label, value: signupsByDay.get(d.key) ?? 0 }))}
            />
          </div>
        </div>
        <div className="rounded-[1.75rem] border bg-card p-6">
          <h2 className="text-sm font-semibold">Dossiers créés · 30 jours</h2>
          <div className="mt-4">
            <BarChart
              ariaLabel="Dossiers créés par jour sur 30 jours"
              points={days.map((d) => ({ label: d.label, value: casesByDay.get(d.key) ?? 0 }))}
            />
          </div>
        </div>
      </div>

      {/* Répartitions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-card p-6">
          <h2 className="text-sm font-semibold">Dossiers par statut</h2>
          <div className="mt-5">
            <Donut
              centre={reels.length.toLocaleString("fr-FR")}
              sousCentre="dossiers réels"
              segments={[...byStatus.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => ({ label: STATUS_LABELS[k] ?? k, value: v }))}
            />
          </div>
        </div>
        <div className="rounded-[1.75rem] border bg-card p-6">
          <h2 className="text-sm font-semibold">Par type de blème</h2>
          <div className="mt-5">
            <HBars
              rows={[...byType.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => ({ label: TYPE_LABELS[k] ?? k, value: v }))}
            />
          </div>
          <h2 className="mt-7 text-sm font-semibold">Boîte de réception</h2>
          <div className="mt-4">
            <HBars
              rows={[...bySource.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => ({ label: SOURCE_LABELS[k] ?? k, value: v }))}
            />
            {inbox.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun élément réel pour l’instant.</p>
            ) : null}
          </div>
        </div>
        <div className="rounded-[1.75rem] border bg-card p-6">
          <h2 className="text-sm font-semibold">Funnel d’activation</h2>
          <div className="mt-5">
            <Funnel
              steps={[
                { label: "Organisations inscrites", value: orgCount ?? 0 },
                { label: "Avec au moins un dossier réel", value: orgsAvecDossier },
                { label: "Avec un paiement récupéré", value: orgsAvecPaiement },
              ]}
            />
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            Le passage « inscrit → premier dossier » est la marche qui compte :
            c’est elle que le parcours gratuit doit faire franchir.
          </p>
        </div>
      </div>

      {/* Dernières inscriptions */}
      <section>
        <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Dernières inscriptions
        </h2>
        <div className="mt-3 overflow-hidden rounded-[1.75rem] border bg-card">
          {derniers.map((u, i) => (
            <div
              key={u.id}
              className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3.5 ${i > 0 ? "border-t" : ""}`}
            >
              <span className="min-w-0 truncate text-sm font-medium">{u.email}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                inscrit le{" "}
                {new Date(u.created_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {u.last_sign_in_at
                  ? ` · vu le ${new Date(u.last_sign_in_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
                  : " · jamais connecté"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Raccourci agents */}
      <Link
        href="/admin/agents"
        className="group flex items-center justify-between gap-4 rounded-[1.75rem] border bg-card p-6 transition-all duration-500 ease-fluid hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg hover:shadow-brand/[0.06]"
      >
        <div className="flex items-center gap-4">
          <span className="flex -space-x-3">
            {["marius", "lena", "nora"].map((k, i) => (
              <span
                key={k}
                className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-b from-brand-soft to-brand/15 ring-2 ring-card"
                style={{ zIndex: 3 - i }}
              >
                <SpriteAvatar src={`/agents/${k}.webp`} alt="" className="h-8" />
              </span>
            ))}
          </span>
          <div>
            <p className="font-semibold">Le parc d’agents</p>
            <p className="text-sm text-muted-foreground">
              Réglages, prompts versionnés, budgets et traces d’exécution.
            </p>
          </div>
        </div>
        <ArrowRight className="size-5 shrink-0 text-brand-strong transition-transform duration-300 group-hover:translate-x-1" />
      </Link>
    </div>
  );
}
