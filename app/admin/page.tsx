import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Trash2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { BarChart, Donut, Funnel, HBars } from "@/components/admin/charts";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";
import { deletePlatformUser } from "@/lib/admin/users-actions";
import { TOOL_APIS } from "@/lib/tool-apis";
import { getToolApiReadiness } from "@/lib/admin/hermes-actions";

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

// Canaux d'acquisition + rôles déclarés à l'onboarding (/bienvenue).
const ACQ_LABELS: Record<string, string> = {
  bouche_a_oreille: "Bouche-à-oreille",
  google: "Google / recherche",
  reseaux: "Réseaux sociaux",
  comptable: "Comptable",
  presse: "Presse / article",
  pub: "Publicité",
  autre: "Autre",
};
const ROLE_LABELS: Record<string, string> = {
  dirigeant: "Dirigeant·e",
  artisan: "Artisan",
  independant: "Indépendant·e",
  comptable: "Comptable / gestion",
  assistant: "Assistant·e / ADV",
  autre: "Autre",
};

const BILLING_LABELS: Record<string, string> = {
  free: "Free",
  active: "Pro actif",
  trialing: "Pro essai",
  past_due: "Pro impayé",
  canceled: "Pro résilié",
  unpaid: "Pro impayé",
  incomplete: "Pro incomplet",
  incomplete_expired: "Pro expiré",
  paused: "Pro en pause",
};

const PROVIDER_LABELS: Record<string, string> = {
  pennylane: "Pennylane",
  sellsy: "Sellsy",
  axonaut: "Axonaut",
};

function euros(cents: number): string {
  return `${Math.round(cents / 100).toLocaleString("fr-FR")} €`;
}

/** Coûts IA en microcentimes (1 € = 1 000 000) : précision adaptée aux petits montants. */
function eurosIA(microcents: number): string {
  const e = microcents / 1_000_000;
  return `${e.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: e < 0.01 ? 4 : 2,
  })} €`;
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "Jamais";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

function latestIso(...values: Array<string | null | undefined>): string | null {
  let latest: string | null = null;
  for (const value of values) {
    if (!value) continue;
    if (!latest || Date.parse(value) > Date.parse(latest)) latest = value;
  }
  return latest;
}

function bytesMo(bytes: number): string {
  return `${(bytes / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function deletionMessage(status?: string): { tone: "ok" | "warn" | "error"; text: string } | null {
  switch (status) {
    case "ok":
      return { tone: "ok", text: "Utilisateur supprimé définitivement. Les organisations mono-utilisateur et leurs fichiers ont été purgés." };
    case "partiel":
      return { tone: "warn", text: "Utilisateur supprimé, mais la purge d’une organisation a échoué. À vérifier côté base." };
    case "confirmation":
      return { tone: "error", text: "Confirmation invalide : il faut retaper exactement l’email de l’utilisateur." };
    case "soi":
      return { tone: "error", text: "Impossible de supprimer votre propre compte admin depuis cette page." };
    case "stripe":
      return { tone: "error", text: "Suppression bloquée : un abonnement Stripe actif doit être annulé correctement avant la purge." };
    case "storage":
      return { tone: "error", text: "Suppression bloquée : certains fichiers Storage n’ont pas pu être supprimés." };
    case "introuvable":
      return { tone: "error", text: "Utilisateur introuvable côté Supabase Auth." };
    case "admin":
      return { tone: "error", text: "Accès réservé aux administrateurs." };
    case "invalide":
    case "erreur":
      return { tone: "error", text: "Suppression impossible. Réessayez après avoir vérifié l’utilisateur et ses données associées." };
    default:
      return null;
  }
}

const PERIODES = [
  { jours: 7, label: "7 jours" },
  { jours: 30, label: "30 jours" },
  { jours: 90, label: "90 jours" },
  { jours: 365, label: "12 mois" },
] as const;

type ServiceClient = ReturnType<typeof createServiceClient>;
type AuthUsers = User[];
type AdminAgentRun = {
  organization_id: string | null;
  status: string;
  simulated: boolean;
  input_tokens: number;
  output_tokens: number;
  cost_microcents: number | string;
  created_at: string;
};

async function listAllAuthUsers(service: ServiceClient): Promise<AuthUsers> {
  const users: AuthUsers = [];
  const perPage = 1000;
  for (let page = 1; page < 100; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users) break;
    users.push(...data.users);
    if (data.users.length < perPage || users.length >= (data.total ?? users.length)) break;
  }
  return users;
}

async function listAllAgentRuns(service: ServiceClient): Promise<AdminAgentRun[]> {
  const runs: AdminAgentRun[] = [];
  const pageSize = 1000;
  for (let from = 0; from < 100_000; from += pageSize) {
    const { data, error } = await service
      .from("agent_runs")
      .select("organization_id, status, simulated, input_tokens, output_tokens, cost_microcents, created_at")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error || !data) break;
    runs.push(...(data as AdminAgentRun[]));
    if (data.length < pageSize) break;
  }
  return runs;
}

export default async function AdminOverview({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; suppression?: string }>;
}) {
  const { periode: periodeParam, suppression } = await searchParams;
  const periode = PERIODES.find((p) => String(p.jours) === periodeParam)?.jours ?? 30;
  // Double garde (le layout redirige déjà les non-admins).
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  const { data: me } = user
    ? await userClient.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!user || !me?.is_admin) return null;
  const currentAdminId = user.id;

  const service = createServiceClient();
  // eslint-disable-next-line react-hooks/purity -- bornes temporelles du reporting, recalculées à chaque requête
  const now = Date.now();
  const d7 = new Date(now - 7 * 24 * 3600 * 1000);
  const d14 = new Date(now - 14 * 24 * 3600 * 1000);
  const d30 = new Date(now - 30 * 24 * 3600 * 1000).toISOString();
  // On charge au moins 30 j (tuiles fixes) et jusqu'à la période choisie.
  const fetchDays = Math.max(periode, 30);
  const dPeriode = new Date(now - periode * 24 * 3600 * 1000).toISOString();
  const monthStart = new Date(now);
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [
    users,
    { count: orgCount },
    { data: organizations },
    { data: memberships },
    { data: profiles },
    { data: cases },
    { data: docs },
    { data: inboxItems },
    { data: payments },
    { data: integrations },
    { data: apiKeys },
    allUserRuns,
    { data: runs },
  ] = await Promise.all([
    listAllAuthUsers(service),
    service.from("organizations").select("id", { count: "exact", head: true }),
    service
      .from("organizations")
      .select("id, name, billing_plan, billing_status, subscription_current_period_end"),
    service.from("organization_members").select("organization_id, user_id, role"),
    service.from("profiles").select("id, full_name, acquisition_source, role_title, onboarding_state"),
    service
      .from("cases")
      .select(
        "id, organization_id, case_type, status, stage, amount_claimed_cents, amount_recovered_cents, is_sample, created_at, updated_at",
      ),
    service.from("documents").select("id, organization_id, size_bytes, doc_class, created_at"),
    service
      .from("inbox_items")
      .select("id, organization_id, source, is_read, is_archived, is_sample, received_at, created_at"),
    service
      .from("billing_payments")
      .select("organization_id, status, amount_total_cents, paid_at, created_at"),
    service
      .from("org_integrations")
      .select("organization_id, provider, status, company_name, connected_at, last_sync_at, last_error"),
    service
      .from("api_keys")
      .select("organization_id, revoked_at, expires_at, last_used_at, created_at"),
    listAllAgentRuns(service),
    service
      .from("agent_runs")
      .select("agent_key, status, model, simulated, input_tokens, output_tokens, cost_microcents, created_at")
      .gte("created_at", new Date(now - fetchDays * 24 * 3600 * 1000).toISOString()),
  ]);

  // ── Utilisateurs ────────────────────────────────────────────────────────────
  const new7 = users.filter((u) => new Date(u.created_at) >= d7).length;
  const prev7 = users.filter(
    (u) => new Date(u.created_at) >= d14 && new Date(u.created_at) < d7,
  ).length;
  const actifs7 = users.filter(
    (u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= d7,
  ).length;

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

  const allRuns = runs ?? [];
  const runs30 = allRuns.filter((r) => r.created_at >= d30);
  const monthRuns = allRuns.filter((r) => r.created_at >= monthStart.toISOString());
  const aiCost = monthRuns.reduce((s, r) => s + Number(r.cost_microcents), 0);
  const aiErrors = runs30.filter((r) => r.status === "error").length;

  // Consommation IA sur la période choisie : granularité adaptée
  // (jour ≤ 30 j, semaine à 90 j, mois à 12 mois).
  const runsPeriode = allRuns.filter((r) => r.created_at >= dPeriode);
  const tokensOf = (r: { input_tokens: number; output_tokens: number }) =>
    Number(r.input_tokens) + Number(r.output_tokens);
  const totalTokensP = runsPeriode.reduce((s, r) => s + tokensOf(r), 0);
  const totalCostP = runsPeriode.reduce((s, r) => s + Number(r.cost_microcents), 0);
  // Distinction réel / simulé : les runs simulés (bêta sans clé API) sont à 0
  // token et 0 coût ; on les compte à part pour qu'aucun total ne trompe.
  const runsReels = runsPeriode.filter((r) => !r.simulated).length;
  const runsSimules = runsPeriode.length - runsReels;

  const granularite = periode <= 30 ? "jour" : periode <= 90 ? "semaine" : "mois";
  const bucketKey = (d: Date): string => {
    if (granularite === "jour") return dayKey(d);
    if (granularite === "semaine") {
      const monday = new Date(d);
      monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      return dayKey(monday);
    }
    return d.toISOString().slice(0, 7);
  };
  const bucketLabel = (key: string): string => {
    if (granularite === "mois") {
      return new Date(`${key}-01T00:00:00Z`).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    }
    const d = new Date(`${key}T00:00:00Z`);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };
  // Buckets couvrant toute la période, dans l'ordre.
  const buckets: string[] = [];
  {
    const seen = new Set<string>();
    const step = granularite === "jour" ? 1 : granularite === "semaine" ? 7 : 28;
    for (let i = periode; i >= 0; i -= step) {
      const k = bucketKey(new Date(now - i * 24 * 3600 * 1000));
      if (!seen.has(k)) {
        seen.add(k);
        buckets.push(k);
      }
    }
    const today = bucketKey(new Date(now));
    if (!seen.has(today)) buckets.push(today);
  }
  const tokensByBucket = new Map<string, number>();
  const byModel = new Map<string, { tokens: number; cost: number }>();
  const byAgent = new Map<string, { tokens: number; cost: number }>();
  for (const r of runsPeriode) {
    const k = bucketKey(new Date(r.created_at));
    tokensByBucket.set(k, (tokensByBucket.get(k) ?? 0) + tokensOf(r));
    const model = r.model ?? "?";
    const m = byModel.get(model) ?? { tokens: 0, cost: 0 };
    m.tokens += tokensOf(r);
    m.cost += Number(r.cost_microcents);
    byModel.set(model, m);
    const a = byAgent.get(r.agent_key) ?? { tokens: 0, cost: 0 };
    a.tokens += tokensOf(r);
    a.cost += Number(r.cost_microcents);
    byAgent.set(r.agent_key, a);
  }

  // ── Détail utilisateurs : activité, revenus, dossiers, connexions ──────────
  const allOrgs = organizations ?? [];
  const allMemberships = memberships ?? [];
  const allPayments = payments ?? [];
  const allIntegrations = integrations ?? [];
  const allApiKeys = apiKeys ?? [];
  const profilesByUser = new Map((profiles ?? []).map((p) => [p.id, p]));
  const orgById = new Map(allOrgs.map((o) => [o.id, o]));

  const membershipsByUser = new Map<string, typeof allMemberships>();
  const memberCountsByOrg = new Map<string, number>();
  for (const m of allMemberships) {
    membershipsByUser.set(m.user_id, [...(membershipsByUser.get(m.user_id) ?? []), m]);
    memberCountsByOrg.set(m.organization_id, (memberCountsByOrg.get(m.organization_id) ?? 0) + 1);
  }

  const casesByOrg = new Map<string, typeof reels>();
  for (const c of reels) {
    casesByOrg.set(c.organization_id, [...(casesByOrg.get(c.organization_id) ?? []), c]);
  }

  const docsByOrg = new Map<string, { count: number; bytes: number; latest: string | null }>();
  for (const d of allDocs) {
    const row = docsByOrg.get(d.organization_id) ?? { count: 0, bytes: 0, latest: null };
    row.count += 1;
    row.bytes += Number(d.size_bytes);
    row.latest = latestIso(row.latest, d.created_at);
    docsByOrg.set(d.organization_id, row);
  }

  const inboxByOrg = new Map<string, { count: number; latest: string | null }>();
  for (const item of inbox) {
    const row = inboxByOrg.get(item.organization_id) ?? { count: 0, latest: null };
    row.count += 1;
    row.latest = latestIso(row.latest, item.received_at, item.created_at);
    inboxByOrg.set(item.organization_id, row);
  }

  const paymentsByOrg = new Map<string, { cents: number; count: number; latest: string | null }>();
  for (const p of allPayments) {
    if (p.status !== "paid") continue;
    const amount = Number(p.amount_total_cents ?? 0);
    const row = paymentsByOrg.get(p.organization_id) ?? { cents: 0, count: 0, latest: null };
    row.cents += amount;
    if (amount > 0) row.count += 1;
    row.latest = latestIso(row.latest, p.paid_at, p.created_at);
    paymentsByOrg.set(p.organization_id, row);
  }

  const integrationsByOrg = new Map<string, typeof allIntegrations>();
  for (const i of allIntegrations) {
    integrationsByOrg.set(i.organization_id, [...(integrationsByOrg.get(i.organization_id) ?? []), i]);
  }

  const apiKeysByOrg = new Map<string, typeof allApiKeys>();
  for (const k of allApiKeys) {
    apiKeysByOrg.set(k.organization_id, [...(apiKeysByOrg.get(k.organization_id) ?? []), k]);
  }

  const aiUsageByOrg = new Map<
    string,
    {
      tokens: number;
      costMicrocents: number;
      runs: number;
      errors: number;
      simulated: number;
      latest: string | null;
    }
  >();
  for (const r of allUserRuns) {
    if (!r.organization_id) continue;
    const row = aiUsageByOrg.get(r.organization_id) ?? {
      tokens: 0,
      costMicrocents: 0,
      runs: 0,
      errors: 0,
      simulated: 0,
      latest: null,
    };
    row.tokens += tokensOf(r);
    row.costMicrocents += Number(r.cost_microcents);
    row.runs += 1;
    if (r.status === "error") row.errors += 1;
    if (r.simulated) row.simulated += 1;
    row.latest = latestIso(row.latest, r.created_at);
    aiUsageByOrg.set(r.organization_id, row);
  }

  const userRows = users
    .map((u) => {
      const userMemberships = membershipsByUser.get(u.id) ?? [];
      const orgIds = [...new Set(userMemberships.map((m) => m.organization_id))];
      const userCases = orgIds.flatMap((orgId) => casesByOrg.get(orgId) ?? []);
      const userDocs = orgIds.map((orgId) => docsByOrg.get(orgId)).filter(Boolean);
      const userInbox = orgIds.map((orgId) => inboxByOrg.get(orgId)).filter(Boolean);
      const userPayments = orgIds.map((orgId) => paymentsByOrg.get(orgId)).filter(Boolean);
      const userIntegrations = orgIds.flatMap((orgId) => integrationsByOrg.get(orgId) ?? []);
      const userApiKeys = orgIds.flatMap((orgId) => apiKeysByOrg.get(orgId) ?? []);
      const userAiUsage = orgIds.map((orgId) => aiUsageByOrg.get(orgId)).filter(Boolean);
      const activeApiKeys = userApiKeys.filter(
        (k) => !k.revoked_at && (!k.expires_at || Date.parse(k.expires_at) > now),
      );
      const connectedIntegrations = userIntegrations.filter((i) => i.status === "connected");
      const erroredIntegrations = userIntegrations.filter((i) => i.status === "error");
      const orgLabels = orgIds
        .map((orgId) => orgById.get(orgId)?.name)
        .filter((name): name is string => Boolean(name));
      const userOrgs = orgIds
        .map((orgId) => orgById.get(orgId))
        .filter((org): org is NonNullable<(typeof allOrgs)[number]> => Boolean(org));
      const orgPlans = userOrgs.map((org) =>
        org.billing_plan === "pro" ? (BILLING_LABELS[org.billing_status] ?? "Pro") : "Free",
      );
      const latestCaseActivity = userCases.reduce<string | null>(
        (latest, c) => latestIso(latest, c.updated_at, c.created_at),
        null,
      );
      const latestDocActivity = userDocs.reduce<string | null>(
        (latest, d) => latestIso(latest, d?.latest),
        null,
      );
      const latestInboxActivity = userInbox.reduce<string | null>(
        (latest, i) => latestIso(latest, i?.latest),
        null,
      );
      const latestPaymentActivity = userPayments.reduce<string | null>(
        (latest, p) => latestIso(latest, p?.latest),
        null,
      );
      const latestIntegrationActivity = userIntegrations.reduce<string | null>(
        (latest, i) => latestIso(latest, i.last_sync_at, i.connected_at),
        null,
      );
      const latestApiActivity = userApiKeys.reduce<string | null>(
        (latest, k) => latestIso(latest, k.last_used_at, k.created_at),
        null,
      );
      const latestAiActivity = userAiUsage.reduce<string | null>(
        (latest, a) => latestIso(latest, a?.latest),
        null,
      );
      const profile = profilesByUser.get(u.id);
      const memberRoles = [...new Set(userMemberships.map((m) => m.role))];
      const revenueCents = userPayments.reduce((sum, p) => sum + (p?.cents ?? 0), 0);
      const aiCostMicrocents = userAiUsage.reduce((sum, a) => sum + (a?.costMicrocents ?? 0), 0);

      return {
        id: u.id,
        email: u.email ?? "Email inconnu",
        name: profile?.full_name ?? u.user_metadata?.full_name ?? null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        lastActivityAt: latestIso(
          u.last_sign_in_at,
          latestCaseActivity,
          latestDocActivity,
          latestInboxActivity,
          latestPaymentActivity,
          latestIntegrationActivity,
          latestApiActivity,
          latestAiActivity,
        ),
        acquisition: profile?.acquisition_source ? (ACQ_LABELS[profile.acquisition_source] ?? profile.acquisition_source) : null,
        roleTitle: profile?.role_title ? (ROLE_LABELS[profile.role_title] ?? profile.role_title) : null,
        onboardingDone: profile?.onboarding_state === "done",
        orgIds,
        orgLabels,
        memberRoles,
        memberCount: orgIds.reduce((sum, orgId) => sum + (memberCountsByOrg.get(orgId) ?? 0), 0),
        plans: [...new Set(orgPlans)],
        cases: userCases.length,
        resolvedCases: userCases.filter((c) => c.status === "resolved").length,
        claimedCents: userCases.reduce((sum, c) => sum + Number(c.amount_claimed_cents), 0),
        recoveredCents: userCases.reduce((sum, c) => sum + Number(c.amount_recovered_cents), 0),
        revenueCents,
        paymentCount: userPayments.reduce((sum, p) => sum + (p?.count ?? 0), 0),
        aiTokens: userAiUsage.reduce((sum, a) => sum + (a?.tokens ?? 0), 0),
        aiCostMicrocents,
        aiGrossMarginMicrocents: revenueCents * 10_000 - aiCostMicrocents,
        aiRunCount: userAiUsage.reduce((sum, a) => sum + (a?.runs ?? 0), 0),
        aiErrorCount: userAiUsage.reduce((sum, a) => sum + (a?.errors ?? 0), 0),
        aiSimulatedCount: userAiUsage.reduce((sum, a) => sum + (a?.simulated ?? 0), 0),
        storageBytes: userDocs.reduce((sum, d) => sum + (d?.bytes ?? 0), 0),
        documentCount: userDocs.reduce((sum, d) => sum + (d?.count ?? 0), 0),
        inboxCount: userInbox.reduce((sum, i) => sum + (i?.count ?? 0), 0),
        connectedIntegrations,
        erroredIntegrations,
        apiKeyCount: activeApiKeys.length,
        apiLastUsedAt: activeApiKeys.reduce<string | null>((latest, k) => latestIso(latest, k.last_used_at), null),
      };
    })
    .sort((a, b) => Date.parse(b.lastActivityAt ?? b.createdAt) - Date.parse(a.lastActivityAt ?? a.createdAt));
  const deletion = deletionMessage(suppression);

  // ── Onboarding : canaux d'acquisition + rôles déclarés (/bienvenue) ─────────
  const acqByChannel = new Map<string, number>();
  const rolesByTitle = new Map<string, number>();
  let onboarded = 0;
  for (const p of profiles ?? []) {
    if (p.onboarding_state === "done") onboarded += 1;
    if (p.acquisition_source) acqByChannel.set(p.acquisition_source, (acqByChannel.get(p.acquisition_source) ?? 0) + 1);
    if (p.role_title) rolesByTitle.set(p.role_title, (rolesByTitle.get(p.role_title) ?? 0) + 1);
  }

  // ── APIs outils : qui appelle quoi, et lesquelles ne le sont JAMAIS ─────────
  // Trace persistée par run (agent_runs.tool_calls, renvoyée par le bridge).
  // Fenêtre 12 mois pour le « dernier appel » / « jamais appelée », indépendante
  // de la période choisie ; le graphe, lui, suit la période.
  const d365 = new Date(now - 365 * 24 * 3600 * 1000).toISOString();
  const [toolRunsRes, scopesRes, readiness] = await Promise.all([
    service
      .from("agent_runs")
      .select("agent_key, status, tool_calls, created_at")
      .gte("created_at", d365)
      .order("created_at", { ascending: false }),
    service.from("agent_tool_apis").select("api_name, agent_key"),
    getToolApiReadiness(),
  ]);
  // Défense de déploiement : colonne pas encore migrée → section vide, pas de crash.
  const toolRuns = (toolRunsRes.error ? [] : (toolRunsRes.data ?? []))
    .map((r) => ({
      ...r,
      calls: (Array.isArray(r.tool_calls) ? r.tool_calls : []).filter(
        (c): c is string => typeof c === "string",
      ),
    }))
    .filter((r) => r.calls.length > 0);
  const toolColumnMissing = Boolean(toolRunsRes.error);

  // Activation : api → portées (null = commune à tous les agents).
  const scopesByApi = new Map<string, Set<string | null>>();
  for (const s of scopesRes.data ?? []) {
    const set = scopesByApi.get(s.api_name) ?? new Set<string | null>();
    set.add(s.agent_key);
    scopesByApi.set(s.api_name, set);
  }

  // Agrégats par référence "api.action" (12 mois) : total, dernier appel, agents.
  const byRef = new Map<string, { count: number; last: string; agents: Set<string> }>();
  const callsByBucket = new Map<string, number>();
  let callsPeriode = 0;
  for (const r of toolRuns) {
    for (const ref of r.calls) {
      const e = byRef.get(ref) ?? { count: 0, last: r.created_at, agents: new Set<string>() };
      e.count += 1;
      if (r.created_at > e.last) e.last = r.created_at;
      e.agents.add(r.agent_key);
      byRef.set(ref, e);
      if (r.created_at >= dPeriode) {
        callsPeriode += 1;
        const k = bucketKey(new Date(r.created_at));
        callsByBucket.set(k, (callsByBucket.get(k) ?? 0) + 1);
      }
    }
  }
  // Par API : lignes du tableau, construites depuis le CATALOGUE (toutes les
  // APIs, y compris jamais appelées — c'est le but).
  const apiRows = TOOL_APIS.map((api) => {
    const refs = api.actions.map((a) => {
      const e = byRef.get(`${api.name}.${a}`);
      return { action: a, count: e?.count ?? 0, last: e?.last ?? null };
    });
    const count = refs.reduce((s, r) => s + r.count, 0);
    const last = refs.reduce<string | null>((m, r) => (r.last && (!m || r.last > m) ? r.last : m), null);
    const agents = new Set<string>();
    for (const a of api.actions) for (const g of byRef.get(`${api.name}.${a}`)?.agents ?? []) agents.add(g);
    const scopes = scopesByApi.get(api.name);
    return { api, refs, count, last, agents, scopes };
  }).sort((a, b) => b.count - a.count);
  const neverCalled = apiRows.filter((r) => r.count === 0).length;
  const recentToolRuns = toolRuns.slice(0, 10);
  const fmtCallDate = (iso: string) =>
    `${new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" })} ${new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}`;

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
      valeur: eurosIA(aiCost),
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

      {/* Consommation IA : tokens, coûts, par modèle et par agent */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Consommation IA · {PERIODES.find((p) => p.jours === periode)?.label}
            <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/70">
              · actualisé à {new Date(now).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}
            </span>
          </h2>
          <div className="flex gap-1">
            {PERIODES.map((p) => (
              <Link
                key={p.jours}
                href={p.jours === 30 ? "/admin" : `/admin?periode=${p.jours}`}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  p.jours === periode
                    ? "bg-ink text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-[1.75rem] border bg-card p-6">
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {totalTokensP.toLocaleString("fr-FR")}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">tokens</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {eurosIA(totalCostP)} · {runsReels.toLocaleString("fr-FR")} run
              {runsReels > 1 ? "s" : ""} réel{runsReels > 1 ? "s" : ""}
              {runsSimules > 0
                ? ` · ${runsSimules.toLocaleString("fr-FR")} simulé${runsSimules > 1 ? "s" : ""}`
                : ""}{" "}
              · par {granularite}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80">
              Coût réel facturé par OpenRouter (usage.cost) pour les runs MOA et
              Hermes ; les runs simulés (bêta sans clé) restent à 0.
            </p>
            <div className="mt-4">
              <BarChart
                ariaLabel={`Tokens consommés par ${granularite}`}
                points={buckets.map((k) => ({ label: bucketLabel(k), value: tokensByBucket.get(k) ?? 0 }))}
              />
            </div>
          </div>
          <div className="rounded-[1.75rem] border bg-card p-6">
            <h3 className="text-sm font-semibold">Par modèle</h3>
            <div className="mt-4">
              <HBars
                rows={[...byModel.entries()]
                  .sort((a, b) => b[1].tokens - a[1].tokens)
                  .slice(0, 8)
                  .map(([model, v]) => ({
                    label: model.replace("hermes:", ""),
                    value: v.tokens,
                    detail: eurosIA(v.cost),
                  }))}
              />
              {byModel.size === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun run sur la période.</p>
              ) : null}
            </div>
          </div>
          <div className="rounded-[1.75rem] border bg-card p-6">
            <h3 className="text-sm font-semibold">Par agent</h3>
            <div className="mt-4">
              <HBars
                rows={[...byAgent.entries()]
                  .sort((a, b) => b[1].tokens - a[1].tokens)
                  .map(([agent, v]) => ({
                    label: agent,
                    value: v.tokens,
                    detail: eurosIA(v.cost),
                  }))}
              />
              {byAgent.size === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun run sur la période.</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* APIs outils : qui appelle quoi — et lesquelles ne le sont jamais */}
      <section>
        <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          APIs outils · {PERIODES.find((p) => p.jours === periode)?.label}
        </h2>
        {toolColumnMissing ? (
          <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
            La trace des appels n’est pas encore activée en base (migration `agent_runs.tool_calls` à appliquer).
          </p>
        ) : null}
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Volume d'appels sur la période */}
          <div className="rounded-[1.75rem] border bg-card p-6">
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {callsPeriode.toLocaleString("fr-FR")}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                appel{callsPeriode > 1 ? "s" : ""} d’outils
              </span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {toolRuns.filter((r) => r.created_at >= dPeriode).length.toLocaleString("fr-FR")} run
              {toolRuns.filter((r) => r.created_at >= dPeriode).length > 1 ? "s" : ""} avec outils · par {granularite}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80">
              Appels réels exécutés par le bridge pendant les boucles agentiques (Légifrance, JUDILIBRE, Pappers…).
            </p>
            <div className="mt-4">
              <BarChart
                ariaLabel={`Appels d’APIs outils par ${granularite}`}
                points={buckets.map((k) => ({ label: bucketLabel(k), value: callsByBucket.get(k) ?? 0 }))}
              />
            </div>
            {neverCalled > 0 ? (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
                {neverCalled} API{neverCalled > 1 ? "s" : ""} du catalogue jamais appelée{neverCalled > 1 ? "s" : ""} sur 12 mois.
              </p>
            ) : null}
          </div>
          {/* Tableau : TOUTES les APIs du catalogue, appelées ou non */}
          <div className="rounded-[1.75rem] border bg-card p-6 lg:col-span-2">
            <h3 className="text-sm font-semibold">Par API — catalogue complet</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Appels sur 12 mois · les actions jamais appelées sont signalées.
            </p>
            <div className="mt-4 flex flex-col divide-y">
              {apiRows.map(({ api, refs, count, last, agents, scopes }) => (
                <div key={api.name} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-medium">
                      {api.label}
                      <span className="ml-2 font-mono text-[11px] text-muted-foreground">{api.name}</span>
                    </p>
                    <p className="text-xs tabular-nums">
                      {count > 0 ? (
                        <>
                          <span className="font-semibold">{count.toLocaleString("fr-FR")}</span>
                          <span className="text-muted-foreground"> appel{count > 1 ? "s" : ""} · dernier {last ? fmtCallDate(last) : "—"}</span>
                        </>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">jamais appelée</span>
                      )}
                    </p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {/* Portée d'activation + clés */}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${scopes ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>
                      {scopes ? (scopes.has(null) ? "activée · commune" : `activée · ${[...scopes].filter(Boolean).join(", ")}`) : "non activée"}
                    </span>
                    {!readiness[api.name] && api.secrets.length > 0 ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">clés manquantes</span>
                    ) : null}
                    {agents.size > 0 ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        appelée par {[...agents].join(", ")}
                      </span>
                    ) : null}
                    {/* Détail par action */}
                    {refs.map((r) => (
                      <span
                        key={r.action}
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                          r.count > 0 ? "bg-brand-soft text-brand-strong" : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                        }`}
                        title={r.count > 0 ? `${r.count} appel(s) · dernier ${r.last ? fmtCallDate(r.last) : ""}` : "jamais appelée"}
                      >
                        {r.action}{r.count > 0 ? ` ×${r.count}` : " · 0"}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Derniers appels : quand, quel agent, quels outils */}
        <div className="mt-4 rounded-[1.75rem] border bg-card p-6">
          <h3 className="text-sm font-semibold">Derniers runs avec outils</h3>
          {recentToolRuns.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun run n’a encore appelé d’outil{toolColumnMissing ? " (trace à activer)" : " — générez un courrier avec socle juridique pour voir la chaîne en action"}.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Quand</th>
                    <th className="py-2 pr-4 font-medium">Agent</th>
                    <th className="py-2 pr-4 font-medium">Statut</th>
                    <th className="py-2 font-medium">Outils appelés (dans l’ordre)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentToolRuns.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2.5 pr-4 text-xs tabular-nums text-muted-foreground">{fmtCallDate(r.created_at)}</td>
                      <td className="py-2.5 pr-4 font-medium">{r.agent_key}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r.status === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span className="flex flex-wrap gap-1">
                          {r.calls.map((c, k) => (
                            <span key={k} className="rounded-full bg-brand-soft px-2 py-0.5 font-mono text-[10px] text-brand-strong">{c}</span>
                          ))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Répartitions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-card p-6">
          <h2 className="text-sm font-semibold">Comment ils nous ont connus</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Déclaré à l’onboarding · {onboarded.toLocaleString("fr-FR")} onboarding{onboarded > 1 ? "s" : ""} terminé{onboarded > 1 ? "s" : ""}
          </p>
          <div className="mt-4">
            {acqByChannel.size > 0 ? (
              <HBars
                rows={[...acqByChannel.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => ({ label: ACQ_LABELS[k] ?? k, value: v }))}
              />
            ) : (
              <p className="text-xs text-muted-foreground">Pas encore de réponses.</p>
            )}
          </div>
          {rolesByTitle.size > 0 ? (
            <>
              <h3 className="mt-6 text-sm font-semibold">Leurs rôles</h3>
              <div className="mt-3">
                <HBars
                  rows={[...rolesByTitle.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => ({ label: ROLE_LABELS[k] ?? k, value: v }))}
                />
              </div>
            </>
          ) : null}
        </div>
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

      {/* Utilisateurs */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Utilisateurs
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {userRows.length.toLocaleString("fr-FR")} compte{userRows.length > 1 ? "s" : ""} · revenus affichés = paiements de dossiers tracés en base.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Dernière activité = connexion, dossier, document, inbox, paiement, IA, API ou sync compta.
          </p>
        </div>
        {deletion ? (
          <p
            className={`mt-3 rounded-2xl px-4 py-3 text-sm ring-1 ${
              deletion.tone === "ok"
                ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                : deletion.tone === "warn"
                  ? "bg-amber-50 text-amber-800 ring-amber-200"
                  : "bg-red-50 text-red-800 ring-red-200"
            }`}
          >
            {deletion.text}
          </p>
        ) : null}
        <div className="mt-3 overflow-x-auto rounded-[1.75rem] border bg-card">
          <table className="w-full min-w-[1340px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Utilisateur</th>
                <th className="px-4 py-3 font-medium">Dernière venue</th>
                <th className="px-4 py-3 font-medium">Dossiers</th>
                <th className="px-4 py-3 font-medium">Rapporté</th>
                <th className="px-4 py-3 font-medium">IA / rentabilité</th>
                <th className="px-4 py-3 font-medium">Compta / API</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 text-right font-medium">Suppression</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {userRows.map((u) => {
                const integrationLabels = u.connectedIntegrations.map(
                  (i) => PROVIDER_LABELS[i.provider] ?? i.provider,
                );
                const erroredLabels = u.erroredIntegrations.map(
                  (i) => PROVIDER_LABELS[i.provider] ?? i.provider,
                );
                return (
                  <tr key={u.id} className="align-top">
                    <td className="px-5 py-4">
                      <div className="max-w-[280px]">
                        <p className="truncate font-medium">{u.name || u.email}</p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{u.email}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {u.onboardingDone ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                              onboarding terminé
                            </span>
                          ) : (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              onboarding incomplet
                            </span>
                          )}
                          {u.roleTitle ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              {u.roleTitle}
                            </span>
                          ) : null}
                          {u.acquisition ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              {u.acquisition}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                          {u.orgLabels.length > 0 ? u.orgLabels.join(" · ") : "Aucune organisation"}
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">{u.id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium tabular-nums">{fmtDateTime(u.lastSignInAt)}</p>
                      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                        Activité : {fmtDateTime(u.lastActivityAt)}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground/75">
                        Inscrit : {fmtDateTime(u.createdAt)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold tabular-nums">
                        {u.cases.toLocaleString("fr-FR")}
                        <span className="ml-1 font-normal text-muted-foreground">dossier{u.cases > 1 ? "s" : ""}</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {u.resolvedCases.toLocaleString("fr-FR")} résolu{u.resolvedCases > 1 ? "s" : ""} · {euros(u.claimedCents)} réclamés
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {euros(u.recoveredCents)} récupérés · {u.documentCount.toLocaleString("fr-FR")} doc{u.documentCount > 1 ? "s" : ""} · {bytesMo(u.storageBytes)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-base font-semibold tabular-nums">{euros(u.revenueCents)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {u.paymentCount.toLocaleString("fr-FR")} paiement{u.paymentCount > 1 ? "s" : ""} dossier
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold tabular-nums">
                        {u.aiTokens.toLocaleString("fr-FR")}
                        <span className="ml-1 font-normal text-muted-foreground">tokens</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Coût IA : {eurosIA(u.aiCostMicrocents)}
                      </p>
                      <p
                        className={`mt-1 text-xs font-medium tabular-nums ${
                          u.aiGrossMarginMicrocents >= 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        Marge brute : {eurosIA(u.aiGrossMarginMicrocents)}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {u.aiRunCount.toLocaleString("fr-FR")} run{u.aiRunCount > 1 ? "s" : ""}
                        {u.aiErrorCount > 0 ? ` · ${u.aiErrorCount} erreur${u.aiErrorCount > 1 ? "s" : ""}` : ""}
                        {u.aiSimulatedCount > 0 ? ` · ${u.aiSimulatedCount} simulé${u.aiSimulatedCount > 1 ? "s" : ""}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {integrationLabels.length > 0 ? (
                          integrationLabels.map((label) => (
                            <span key={label} className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                              Compta {label}
                            </span>
                          ))
                        ) : erroredLabels.length > 0 ? (
                          erroredLabels.map((label) => (
                            <span key={label} className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                              Compta {label} en erreur
                            </span>
                          ))
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            Pas de compta connectée
                          </span>
                        )}
                        {u.apiKeyCount > 0 ? (
                          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand-strong">
                            API BLEME active ×{u.apiKeyCount}
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            API BLEME inactive
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {u.apiLastUsedAt ? `Dernier appel API : ${fmtDateTime(u.apiLastUsedAt)}` : "Aucun appel API actif connu"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {(u.plans.length > 0 ? u.plans : ["Free"]).map((plan) => (
                          <span
                            key={plan}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              plan.includes("Pro actif")
                                ? "bg-emerald-100 text-emerald-800"
                                : plan.includes("Pro")
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {plan}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {u.orgIds.length.toLocaleString("fr-FR")} org · {u.memberCount.toLocaleString("fr-FR")} membre{u.memberCount > 1 ? "s" : ""} total
                      </p>
                      {u.memberRoles.length > 0 ? (
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground/75">{u.memberRoles.join(", ")}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {u.id === currentAdminId ? (
                        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                          Votre compte
                        </span>
                      ) : (
                        <details className="inline-block text-left">
                          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 ring-1 ring-red-100 transition-colors hover:bg-red-100">
                            <Trash2 className="size-3.5" />
                            Supprimer
                          </summary>
                          <form action={deletePlatformUser} className="mt-2 w-72 rounded-2xl border border-red-100 bg-red-50 p-3 text-left shadow-sm">
                            <input type="hidden" name="userId" value={u.id} />
                            <p className="text-xs font-medium text-red-900">
                              Suppression définitive
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-red-800/80">
                              Retire le compte Auth. Si ses organisations sont mono-utilisateur, purge aussi dossiers, preuves, API, compta et fichiers.
                            </p>
                            <label className="mt-2 block text-[11px] font-medium text-red-900" htmlFor={`delete-${u.id}`}>
                              Retapez l’email
                            </label>
                            <input
                              id={`delete-${u.id}`}
                              name="confirmation"
                              type="email"
                              required
                              autoComplete="off"
                              placeholder={u.email}
                              className="mt-1 w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-xs text-red-950 outline-none transition focus:border-red-400"
                            />
                            <button
                              type="submit"
                              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-red-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-red-700 active:scale-[0.98]"
                            >
                              <Trash2 className="size-3.5" />
                              Supprimer définitivement
                            </button>
                          </form>
                        </details>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
