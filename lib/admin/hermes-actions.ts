"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSecret } from "@/lib/secrets";
import { TOOL_APIS, TOOL_API_NAMES } from "@/lib/tool-apis";

/* Pont console → bleme-bridge (VPS) : état du cerveau Hermes, bibliothèque
 * de skills (installation/retrait), résumé de l'organisation Paperclip.
 * Tout passe par le bearer du bridge, jamais d'SSH. */

export type HermesState = { error?: string; success?: string };

export type Skill = { name: string; description: string };
export type HermesOverview = {
  configured: boolean;
  online: boolean;
  model?: string;
  loadedAgents?: string[];
  skills?: { installed: Skill[]; available: Skill[] };
  paperclip?: { ok: boolean; company?: { name: string; status: string; issueCounter: number; budgetMonthlyCents: number; spentMonthlyCents: number }; error?: string };
};

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  return data?.is_admin ? user : null;
}

async function bridge(): Promise<{ url: string; token: string } | null> {
  const [url, token] = await Promise.all([
    getSecret("BLEME_BRIDGE_URL"),
    getSecret("BLEME_BRIDGE_TOKEN"),
  ]);
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

async function bridgeFetch(path: string, init?: RequestInit) {
  const b = await bridge();
  if (!b) throw new Error("bridge non configuré");
  const res = await fetch(`${b.url}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${b.token}`,
      "content-type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`bridge ${res.status} : ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export async function getHermesOverview(): Promise<HermesOverview> {
  if (!(await requireAdmin())) return { configured: false, online: false };
  if (!(await bridge())) return { configured: false, online: false };

  try {
    const [health, skills, paperclip] = await Promise.all([
      bridgeFetch("/health"),
      bridgeFetch("/skills"),
      bridgeFetch("/paperclip/summary"),
    ]);
    const company = paperclip.ok ? paperclip.companies?.[0] : undefined;
    return {
      configured: true,
      online: Boolean(health.ok),
      model: health.model,
      loadedAgents: health.loaded_agents ?? [],
      skills: { installed: skills.installed ?? [], available: skills.available ?? [] },
      paperclip: {
        ok: Boolean(paperclip.ok),
        company: company
          ? {
              name: company.name,
              status: company.status,
              issueCounter: company.issueCounter ?? 0,
              budgetMonthlyCents: company.budgetMonthlyCents ?? 0,
              spentMonthlyCents: company.spentMonthlyCents ?? 0,
            }
          : undefined,
        error: paperclip.error,
      },
    };
  } catch {
    return { configured: true, online: false };
  }
}

const skillSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9_-]+\/[a-z0-9_-]+$/, "Nom de skill invalide.");

export async function installSkill(
  _prev: HermesState,
  formData: FormData,
): Promise<HermesState> {
  if (!(await requireAdmin())) return { error: "Accès réservé aux administrateurs." };
  const name = skillSchema.safeParse(formData.get("name"));
  if (!name.success) return { error: "Nom de skill invalide." };
  try {
    await bridgeFetch("/skills/install", {
      method: "POST",
      body: JSON.stringify({ name: name.data }),
    });
    revalidatePath("/admin/hermes");
    return { success: `Skill « ${name.data} » installée : active au prochain démarrage d'instance.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Échec de l'installation." };
  }
}

export type ORModel = { id: string; name: string; tools: boolean; context: number };

/** Liste vivante des modèles OpenRouter (cache 1 h) : le sélecteur se met à jour seul. */
export async function getOpenRouterModels(): Promise<ORModel[]> {
  if (!(await requireAdmin())) return [];
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const payload = await res.json();
    return (payload.data ?? [])
      .map((m: { id: string; name?: string; context_length?: number; supported_parameters?: string[] }) => ({
        id: m.id,
        name: m.name ?? m.id,
        tools: (m.supported_parameters ?? []).includes("tools"),
        context: m.context_length ?? 0,
      }))
      .sort((a: ORModel, b: ORModel) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

// ── Version de Hermes : suivre le rythme des updates de Nous Research ───────

export type HermesVersion = {
  ok: boolean;
  commit?: string;
  date?: string;
  behind?: number | null;
  rollbackAvailable?: boolean;
  error?: string;
};

export async function getHermesVersion(): Promise<HermesVersion> {
  if (!(await requireAdmin())) return { ok: false };
  try {
    const v = await bridgeFetch("/version");
    return {
      ok: Boolean(v.ok),
      commit: v.commit,
      date: v.date,
      behind: v.behind,
      rollbackAvailable: v.rollback_available,
      error: v.error,
    };
  } catch {
    return { ok: false };
  }
}

export async function updateHermes(): Promise<HermesState> {
  if (!(await requireAdmin())) return { error: "Accès réservé aux administrateurs." };
  try {
    const r = await bridgeFetch("/update", { method: "POST" });
    revalidatePath("/admin/hermes");
    return {
      success:
        r.from === r.to
          ? "Déjà à la dernière version."
          : `Mise à jour ${r.from} → ${r.to} : le bridge redémarre (~30 s).`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Échec de la mise à jour." };
  }
}

export async function rollbackHermes(): Promise<HermesState> {
  if (!(await requireAdmin())) return { error: "Accès réservé aux administrateurs." };
  try {
    const r = await bridgeFetch("/rollback", { method: "POST" });
    revalidatePath("/admin/hermes");
    return { success: `Retour à ${r.to} : le bridge redémarre (~30 s).` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Échec du retour arrière." };
  }
}

// ── Portée des skills : commune (agent_key null) ou propre à un agent ────────

export type SkillScopes = Record<string, string[]>; // skill → ["commun"|agentKey...]

export async function getSkillScopes(): Promise<SkillScopes> {
  const supabase = await createClient();
  if (!(await requireAdmin())) return {};
  const { data } = await supabase.from("agent_skills").select("skill_name, agent_key");
  const out: SkillScopes = {};
  for (const r of data ?? []) {
    const scope = r.agent_key ?? "commun";
    out[r.skill_name] = [...(out[r.skill_name] ?? []), scope];
  }
  return out;
}

const scopeSchema = z.object({
  skill: z.string().regex(/^[a-z0-9_-]+\/[a-z0-9_-]+$/),
  scope: z.string().regex(/^(commun|[a-z]+)$/),
});

export async function toggleSkillScope(formData: FormData): Promise<void> {
  const supabase = await createClient();
  if (!(await requireAdmin())) return;
  const parsed = scopeSchema.safeParse({
    skill: formData.get("skill"),
    scope: formData.get("scope"),
  });
  if (!parsed.success) return;
  const agentKey = parsed.data.scope === "commun" ? null : parsed.data.scope;

  const query = supabase
    .from("agent_skills")
    .select("id")
    .eq("skill_name", parsed.data.skill);
  const { data: existing } = agentKey === null
    ? await query.is("agent_key", null).maybeSingle()
    : await query.eq("agent_key", agentKey).maybeSingle();

  if (existing) {
    await supabase.from("agent_skills").delete().eq("id", existing.id);
  } else {
    await supabase.from("agent_skills").insert({
      skill_name: parsed.data.skill,
      agent_key: agentKey,
    });
  }
  revalidatePath("/admin/hermes");
}

// ── APIs outils : activation commune (agent_key null) ou propre à un agent ───


export type ToolApiScopes = Record<string, string[]>; // api → ["commun"|agentKey...]

export async function getToolApiScopes(): Promise<ToolApiScopes> {
  const supabase = await createClient();
  if (!(await requireAdmin())) return {};
  const { data } = await supabase.from("agent_tool_apis").select("api_name, agent_key");
  const out: ToolApiScopes = {};
  for (const r of data ?? []) {
    const scope = r.agent_key ?? "commun";
    out[r.api_name] = [...(out[r.api_name] ?? []), scope];
  }
  return out;
}

/** Présence des clés requises par chaque API (jamais les valeurs). */
export async function getToolApiReadiness(): Promise<Record<string, boolean>> {
  if (!(await requireAdmin())) return {};
  const out: Record<string, boolean> = {};
  for (const api of TOOL_APIS) {
    const values = await Promise.all(api.secrets.map((s) => getSecret(s)));
    out[api.name] = values.every(Boolean);
  }
  return out;
}

const toolApiScopeSchema = z.object({
  api: z.string().regex(/^[a-z0-9_-]+$/),
  scope: z.string().regex(/^(commun|[a-z]+)$/),
});

export async function toggleToolApiScope(formData: FormData): Promise<void> {
  const supabase = await createClient();
  if (!(await requireAdmin())) return;
  const parsed = toolApiScopeSchema.safeParse({
    api: formData.get("api"),
    scope: formData.get("scope"),
  });
  if (!parsed.success || !TOOL_API_NAMES.has(parsed.data.api)) return;
  const agentKey = parsed.data.scope === "commun" ? null : parsed.data.scope;

  const query = supabase
    .from("agent_tool_apis")
    .select("id")
    .eq("api_name", parsed.data.api);
  const { data: existing } = agentKey === null
    ? await query.is("agent_key", null).maybeSingle()
    : await query.eq("agent_key", agentKey).maybeSingle();

  if (existing) {
    await supabase.from("agent_tool_apis").delete().eq("id", existing.id);
  } else {
    await supabase.from("agent_tool_apis").insert({
      api_name: parsed.data.api,
      agent_key: agentKey,
    });
  }
  revalidatePath("/admin", "layout");
}

// ── Organigramme et ticketing Paperclip ──────────────────────────────────────

export type PcAgent = {
  id: string;
  name: string;
  title: string | null;
  status: string;
  reportsTo: string | null;
  budgetMonthlyCents: number;
  spentMonthlyCents: number;
};

export async function getPaperclipAgents(): Promise<PcAgent[]> {
  if (!(await requireAdmin())) return [];
  try {
    const payload = await bridgeFetch("/paperclip/agents");
    return (payload.agents ?? []).map((a: Record<string, unknown>) => ({
      id: a.id,
      name: a.name,
      title: a.title ?? null,
      status: a.status ?? "idle",
      reportsTo: a.reportsTo ?? null,
      budgetMonthlyCents: a.budgetMonthlyCents ?? 0,
      spentMonthlyCents: a.spentMonthlyCents ?? 0,
    }));
  } catch {
    return [];
  }
}

export type PcIssue = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assigneeAgentId: string | null;
  createdAt: string;
};

export async function getPaperclipIssues(): Promise<PcIssue[]> {
  if (!(await requireAdmin())) return [];
  try {
    const payload = await bridgeFetch("/paperclip/issues");
    return (payload.issues ?? [])
      .map((i: Record<string, unknown>) => ({
        id: i.id,
        title: i.title,
        description: (typeof i.description === "string" ? i.description.slice(0, 240) : null),
        status: i.status ?? "open",
        assigneeAgentId: i.assigneeAgentId ?? null,
        createdAt: i.createdAt,
      }))
      .sort((a: PcIssue, b: PcIssue) => +new Date(b.createdAt) - +new Date(a.createdAt));
  } catch {
    return [];
  }
}

const pcAgentSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court.").max(60),
  title: z.string().trim().max(80).optional().default(""),
  reportsTo: z.string().uuid().optional().or(z.literal("")),
});

export async function createPcAgent(
  _prev: HermesState,
  formData: FormData,
): Promise<HermesState> {
  if (!(await requireAdmin())) return { error: "Accès réservé aux administrateurs." };
  const parsed = pcAgentSchema.safeParse({
    name: formData.get("name"),
    title: formData.get("title") ?? "",
    reportsTo: formData.get("reportsTo") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Agent invalide." };
  try {
    await bridgeFetch("/paperclip/agents/create", {
      method: "POST",
      body: JSON.stringify({
        name: parsed.data.name,
        title: parsed.data.title || null,
        reports_to: parsed.data.reportsTo || null,
      }),
    });
    revalidatePath("/admin/hermes");
    return { success: `Agent « ${parsed.data.name} » créé dans Paperclip.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Échec de la création." };
  }
}

export async function patchPcAgent(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const patch: Record<string, unknown> = {};
  if (formData.has("reportsTo")) {
    const v = String(formData.get("reportsTo") ?? "");
    patch.reportsTo = v === "" ? null : v;
  }
  if (formData.has("status")) {
    patch.status = String(formData.get("status"));
  }
  if (Object.keys(patch).length === 0) return;
  try {
    await bridgeFetch("/paperclip/agents/update", {
      method: "POST",
      body: JSON.stringify({ id: id.data, patch }),
    });
  } catch {
    /* le rafraîchissement montrera l'état réel */
  }
  revalidatePath("/admin/hermes");
}

export async function deletePcAgent(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  try {
    await bridgeFetch("/paperclip/agents/delete", {
      method: "POST",
      body: JSON.stringify({ id: id.data }),
    });
  } catch {
    /* idem */
  }
  revalidatePath("/admin/hermes");
}

const ticketSchema = z.object({
  title: z.string().trim().min(3, "Titre trop court.").max(160),
  description: z.string().trim().max(4000).optional().default(""),
  agent: z.string().regex(/^[a-z]*$/).optional().default(""),
});

export async function createTicket(
  _prev: HermesState,
  formData: FormData,
): Promise<HermesState> {
  if (!(await requireAdmin())) return { error: "Accès réservé aux administrateurs." };
  const parsed = ticketSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    agent: formData.get("agent") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ticket invalide." };
  try {
    await bridgeFetch("/paperclip/issues", {
      method: "POST",
      body: JSON.stringify({
        title: parsed.data.title,
        description: parsed.data.description || null,
        agent: parsed.data.agent || null,
      }),
    });
    revalidatePath("/admin/hermes");
    return { success: `Ticket « ${parsed.data.title} » créé.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Échec de la création." };
  }
}

export async function setTicketStatus(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = z.string().uuid().safeParse(formData.get("id"));
  const status = z.enum(["open", "in_progress", "done"]).safeParse(formData.get("status"));
  if (!id.success || !status.success) return;
  try {
    await bridgeFetch("/paperclip/issues/status", {
      method: "POST",
      body: JSON.stringify({ id: id.data, status: status.data }),
    });
  } catch {
    /* le rafraîchissement montrera l'état réel */
  }
  revalidatePath("/admin/hermes");
}

// ── Routines Paperclip (les crons des agents), pilotées dans les 2 sens ─────

export type Routine = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  triggers: { id: string; kind: string; cronExpression?: string }[];
  lastTriggeredAt: string | null;
  binding: { agent: string; skills: string[] } | null;
};

export async function getRoutines(): Promise<{ ok: boolean; routines: Routine[] }> {
  if (!(await requireAdmin())) return { ok: false, routines: [] };
  try {
    const payload = await bridgeFetch("/paperclip/routines");
    const routines = (payload.routines ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? null,
      status: r.status,
      triggers: r.triggers ?? [],
      lastTriggeredAt: r.lastTriggeredAt ?? null,
      binding: r.binding ?? null,
    }));
    return { ok: Boolean(payload.ok), routines };
  } catch {
    return { ok: false, routines: [] };
  }
}

const routineSchema = z.object({
  title: z.string().trim().min(3, "Titre trop court.").max(120),
  description: z.string().trim().max(2000).optional().default(""),
  cron: z
    .string()
    .trim()
    .regex(/^\S+ \S+ \S+ \S+ \S+$/, "Expression cron attendue (5 champs, ex. 0 8 * * 1-5).")
    .optional()
    .or(z.literal("")),
  agent: z.string().regex(/^[a-z]+$/, "Choisissez l'agent responsable."),
});

async function bindRoutineOnBridge(
  routineId: string,
  agentKey: string,
  skills: string[],
  input: string,
): Promise<void> {
  const supabase = await createClient();
  const { data: agent } = await supabase
    .from("agents")
    .select("system_prompt")
    .eq("key", agentKey)
    .maybeSingle();
  if (!agent) throw new Error("agent inconnu");
  await bridgeFetch("/routines/bind", {
    method: "POST",
    body: JSON.stringify({
      id: routineId,
      agent: agentKey,
      skills,
      system: agent.system_prompt,
      input,
    }),
  });
}

export async function createRoutine(
  _prev: HermesState,
  formData: FormData,
): Promise<HermesState> {
  if (!(await requireAdmin())) return { error: "Accès réservé aux administrateurs." };
  const parsed = routineSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    cron: formData.get("cron") ?? "",
    agent: formData.get("agent"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Routine invalide." };
  const skills = formData
    .getAll("skills")
    .map(String)
    .filter((s) => /^[a-z0-9_-]+\/[a-z0-9_-]+$/.test(s));
  try {
    const created = await bridgeFetch("/paperclip/routines", {
      method: "POST",
      body: JSON.stringify({
        title: parsed.data.title,
        description: parsed.data.description || null,
        cron: parsed.data.cron || null,
        activate: Boolean(parsed.data.cron),
        agent: parsed.data.agent,
      }),
    });
    await bindRoutineOnBridge(
      created.routine.id,
      parsed.data.agent,
      skills,
      parsed.data.description || parsed.data.title,
    );
    revalidatePath("/admin/hermes");
    return { success: `Routine « ${parsed.data.title} » créée, confiée à ${parsed.data.agent}${parsed.data.cron ? ", cron actif" : ""}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Échec de la création." };
  }
}

export async function executeRoutine(
  _prev: HermesState,
  formData: FormData,
): Promise<HermesState> {
  if (!(await requireAdmin())) return { error: "Accès réservé aux administrateurs." };
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Routine inconnue." };
  const title = String(formData.get("title") ?? "Routine");
  try {
    const r = await bridgeFetch("/routines/execute", {
      method: "POST",
      body: JSON.stringify({ id: id.data, title }),
    });
    revalidatePath("/admin/hermes");
    return {
      success: `Exécutée : « ${String(r.preview ?? "").slice(0, 140)}… » — rapport déposé en ticket Paperclip.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Échec de l'exécution." };
  }
}

export async function setRoutineStatus(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = z.string().uuid().safeParse(formData.get("id"));
  const status = z.enum(["active", "paused", "archived"]).safeParse(formData.get("status"));
  if (!id.success || !status.success) return;
  try {
    await bridgeFetch("/paperclip/routines/status", {
      method: "POST",
      body: JSON.stringify({ id: id.data, status: status.data }),
    });
  } catch {
    /* le rafraîchissement montrera l'état réel */
  }
  revalidatePath("/admin/hermes");
}

export async function fireRoutine(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  try {
    await bridgeFetch("/paperclip/routines/fire", {
      method: "POST",
      body: JSON.stringify({ id: id.data }),
    });
  } catch {
    /* idem */
  }
  revalidatePath("/admin/hermes");
}

export async function removeSkill(
  _prev: HermesState,
  formData: FormData,
): Promise<HermesState> {
  if (!(await requireAdmin())) return { error: "Accès réservé aux administrateurs." };
  const name = skillSchema.safeParse(formData.get("name"));
  if (!name.success) return { error: "Nom de skill invalide." };
  try {
    await bridgeFetch("/skills/remove", {
      method: "POST",
      body: JSON.stringify({ name: name.data }),
    });
    revalidatePath("/admin/hermes");
    return { success: `Skill « ${name.data} » retirée.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Échec du retrait." };
  }
}
