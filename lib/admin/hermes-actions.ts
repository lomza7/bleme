"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSecret } from "@/lib/secrets";

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

// ── Routines Paperclip (les crons des agents), pilotées dans les 2 sens ─────

export type Routine = {
  id: string;
  title: string;
  status: string;
  triggers: { id: string; kind: string; cronExpression?: string }[];
  lastTriggeredAt: string | null;
};

export async function getRoutines(): Promise<{ ok: boolean; routines: Routine[] }> {
  if (!(await requireAdmin())) return { ok: false, routines: [] };
  try {
    const payload = await bridgeFetch("/paperclip/routines");
    const routines = (payload.routines ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      triggers: r.triggers ?? [],
      lastTriggeredAt: r.lastTriggeredAt ?? null,
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
});

export async function createRoutine(
  _prev: HermesState,
  formData: FormData,
): Promise<HermesState> {
  if (!(await requireAdmin())) return { error: "Accès réservé aux administrateurs." };
  const parsed = routineSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    cron: formData.get("cron") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Routine invalide." };
  try {
    await bridgeFetch("/paperclip/routines", {
      method: "POST",
      body: JSON.stringify({
        title: parsed.data.title,
        description: parsed.data.description || null,
        cron: parsed.data.cron || null,
        activate: Boolean(parsed.data.cron),
      }),
    });
    revalidatePath("/admin/hermes");
    return { success: `Routine « ${parsed.data.title} » créée${parsed.data.cron ? " et activée" : ""}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Échec de la création." };
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
