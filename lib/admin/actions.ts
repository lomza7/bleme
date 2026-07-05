"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AgentUnavailableError, runAgent } from "@/lib/ai/client";

/* Actions de la console /admin : réglages d'agents, versions de prompt,
 * run de test. Toutes vérifient le rôle admin (en plus des RLS). */

export type AdminState = { error?: string; success?: string };

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
  return data?.is_admin ? { supabase, user } : null;
}

const settingsSchema = z.object({
  key: z.string().min(1),
  model: z.enum(["claude-sonnet-5", "claude-haiku-4-5", "claude-opus-4-8"]),
  runtime: z.enum(["claude", "hermes"]),
  hermesModel: z
    .string()
    .trim()
    .regex(/^[a-z0-9.-]+\/[A-Za-z0-9._:-]+$/, "Slug OpenRouter attendu (ex. nousresearch/hermes-4-70b)."),
  status: z.enum(["active", "paused"]),
  budgetEuros: z.coerce.number().min(0).max(10000),
});

export async function updateAgentSettings(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Accès réservé aux administrateurs." };

  const parsed = settingsSchema.safeParse({
    key: formData.get("key"),
    model: formData.get("model"),
    runtime: formData.get("runtime"),
    hermesModel: formData.get("hermesModel"),
    status: formData.get("status"),
    budgetEuros: formData.get("budgetEuros"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Réglages invalides." };
  }

  const { error } = await admin.supabase
    .from("agents")
    .update({
      model: parsed.data.model,
      runtime: parsed.data.runtime,
      hermes_model: parsed.data.hermesModel,
      status: parsed.data.status,
      monthly_budget_cents: Math.round(parsed.data.budgetEuros * 100),
      updated_at: new Date().toISOString(),
    })
    .eq("key", parsed.data.key);
  if (error) return { error: "Échec de l’enregistrement." };

  revalidatePath("/admin", "layout");
  return { success: "Réglages enregistrés." };
}

export async function toggleAgentStatus(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;
  const key = String(formData.get("key") ?? "");
  const to = String(formData.get("to") ?? "");
  if (!key || !["active", "paused"].includes(to)) return;

  await admin.supabase
    .from("agents")
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq("key", key);
  revalidatePath("/admin", "layout");
}

const promptSchema = z.object({
  key: z.string().min(1),
  content: z.string().trim().min(50, "Le prompt semble trop court.").max(20000),
  note: z.string().trim().max(200).optional().default(""),
});

export async function saveAgentPrompt(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Accès réservé aux administrateurs." };

  const parsed = promptSchema.safeParse({
    key: formData.get("key"),
    content: formData.get("content"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Prompt invalide." };
  }

  const { data: agent } = await admin.supabase
    .from("agents")
    .select("prompt_version")
    .eq("key", parsed.data.key)
    .maybeSingle();
  if (!agent) return { error: "Agent inconnu." };

  const version = agent.prompt_version + 1;
  const { error: verErr } = await admin.supabase.from("agent_prompt_versions").insert({
    agent_key: parsed.data.key,
    version,
    content: parsed.data.content,
    note: parsed.data.note || null,
    created_by: admin.user.id,
  });
  if (verErr) return { error: "Échec de l’enregistrement de la version." };

  const { error } = await admin.supabase
    .from("agents")
    .update({
      system_prompt: parsed.data.content,
      prompt_version: version,
      updated_at: new Date().toISOString(),
    })
    .eq("key", parsed.data.key);
  if (error) return { error: "Échec de l’activation de la version." };

  revalidatePath("/admin", "layout");
  return { success: `Version ${version} enregistrée et activée.` };
}

const TEST_SCHEMA = z.object({ resume: z.string() });

export async function testAgent(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Accès réservé aux administrateurs." };
  const key = String(formData.get("key") ?? "");
  if (!key) return { error: "Agent inconnu." };

  try {
    const { simulated } = await runAgent({
      key,
      input: {
        test: true,
        consigne:
          "Run de test depuis la console d’administration. Réponds avec {\"resume\": \"<une phrase confirmant ton rôle>\"}.",
      },
      schema: TEST_SCHEMA,
      simulation: { resume: "Run de test simulé : aucune clé API réelle configurée." },
    });
    revalidatePath("/admin", "layout");
    return {
      success: simulated
        ? "Run de test tracé (simulation : clé API non configurée)."
        : "Run de test réussi : l’agent répond.",
    };
  } catch (err) {
    revalidatePath("/admin", "layout");
    if (err instanceof AgentUnavailableError) return { error: err.message };
    return { error: "Le run de test a échoué : voir la trace dans le tableau." };
  }
}
