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
