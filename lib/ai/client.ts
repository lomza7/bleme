import "server-only";
import { z } from "zod";
import { getSecret } from "@/lib/secrets";
import { createServiceClient } from "@/lib/supabase/server";

/*
 * Moteur d'agents BLEME. Chaque appel IA passe ici et obéit à la console
 * d'administration (/admin) : agent en pause → refus ; budget mensuel
 * dépassé → refus ; sinon appel Anthropic avec le prompt versionné actif,
 * sortie validée par Zod, trace complète dans agent_runs (tokens, coût,
 * durée). Sans clé API réelle (bêta), mode simulation : la valeur de repli
 * fournie par l'appelant est retournée et la trace est marquée simulated.
 *
 * Couche complémentaire de Paperclip (ops) : ici vivent les appels
 * synchrones du produit, sous RLS, par dossier client.
 */

type AgentConfig = {
  key: string;
  model: string;
  runtime: "claude" | "hermes";
  status: "active" | "paused";
  monthly_budget_cents: number;
  system_prompt: string;
  prompt_version: number;
};

// microcentimes (1 € = 1 000 000) par token, estimation des tarifs publics.
const RATES: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-opus-4-8": { input: 15, output: 75 },
};

export class AgentUnavailableError extends Error {
  constructor(
    public reason: "paused" | "budget" | "unknown_agent",
    message: string,
  ) {
    super(message);
  }
}

function monthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function loadAgent(key: string): Promise<AgentConfig | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agents")
    .select("key, model, runtime, status, monthly_budget_cents, system_prompt, prompt_version")
    .eq("key", key)
    .maybeSingle();
  return (data as AgentConfig | null) ?? null;
}

async function monthlySpendMicrocents(key: string): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agent_runs")
    .select("cost_microcents")
    .eq("agent_key", key)
    .gte("created_at", monthStart());
  return (data ?? []).reduce((sum, r) => sum + Number(r.cost_microcents), 0);
}

async function logRun(run: {
  agent_key: string;
  organization_id?: string | null;
  case_id?: string | null;
  model: string;
  prompt_version?: number;
  status: "ok" | "error" | "blocked_budget" | "blocked_paused";
  simulated?: boolean;
  input_tokens?: number;
  output_tokens?: number;
  cost_microcents?: number;
  duration_ms?: number;
  error?: string;
}) {
  const supabase = createServiceClient();
  await supabase.from("agent_runs").insert(run);
}

/**
 * Exécute un agent : `input` est sérialisé pour le modèle, la réponse doit
 * valider `schema`. `simulation` est la valeur retournée en mode bêta sans
 * clé API (trace marquée simulated).
 */
export async function runAgent<T>(opts: {
  key: string;
  input: unknown;
  schema: z.ZodType<T>;
  simulation: T;
  organizationId?: string | null;
  caseId?: string | null;
  maxTokens?: number;
}): Promise<{ data: T; simulated: boolean }> {
  const agent = await loadAgent(opts.key);
  if (!agent) {
    throw new AgentUnavailableError("unknown_agent", `Agent inconnu : ${opts.key}`);
  }

  const base = {
    agent_key: agent.key,
    organization_id: opts.organizationId ?? null,
    case_id: opts.caseId ?? null,
    model: agent.model,
    prompt_version: agent.prompt_version,
  };

  if (agent.status === "paused") {
    await logRun({ ...base, status: "blocked_paused" });
    throw new AgentUnavailableError("paused", `${agent.key} est en pause (console admin).`);
  }

  const spend = await monthlySpendMicrocents(agent.key);
  if (spend >= agent.monthly_budget_cents * 10_000) {
    await logRun({ ...base, status: "blocked_budget" });
    throw new AgentUnavailableError(
      "budget",
      `${agent.key} a atteint son budget mensuel (console admin).`,
    );
  }

  // Coffre de la console d'abord (effet immédiat), variable d'ENV en repli.
  const started = Date.now();

  // ── Runtime Hermes : le bleme-bridge du VPS (piloté par /admin) ────────────
  if (agent.runtime === "hermes") {
    const [bridgeUrl, bridgeToken] = await Promise.all([
      getSecret("BLEME_BRIDGE_URL"),
      getSecret("BLEME_BRIDGE_TOKEN"),
    ]);
    if (!bridgeUrl || !bridgeToken) {
      await logRun({
        ...base,
        model: "hermes",
        status: "error",
        duration_ms: 0,
        error: "BLEME_BRIDGE_URL / BLEME_BRIDGE_TOKEN absents du coffre (/admin/cles)",
      });
      throw new AgentUnavailableError(
        "budget",
        "Runtime Hermes non configuré : renseignez BLEME_BRIDGE_URL et BLEME_BRIDGE_TOKEN dans le coffre.",
      );
    }
    try {
      const response = await fetch(`${bridgeUrl.replace(/\/$/, "")}/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bridgeToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agent: agent.key,
          system: agent.system_prompt,
          input: JSON.stringify(opts.input),
        }),
      });
      if (!response.ok) {
        throw new Error(`bridge ${response.status} : ${(await response.text()).slice(0, 300)}`);
      }
      const payload = await response.json();
      const text: string = payload.text ?? "";
      const jsonText = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      const data = opts.schema.parse(JSON.parse(jsonText));
      await logRun({
        ...base,
        model: `hermes:${payload.model ?? "?"}`,
        status: "ok",
        // Coût facturé côté OpenRouter (compte VPS), non tracé ici.
        duration_ms: Date.now() - started,
      });
      return { data, simulated: false };
    } catch (err) {
      await logRun({
        ...base,
        model: "hermes",
        status: "error",
        duration_ms: Date.now() - started,
        error: err instanceof Error ? err.message.slice(0, 500) : "Erreur inconnue",
      });
      throw err;
    }
  }

  // ── Runtime Claude (API Anthropic) ─────────────────────────────────────────
  const apiKey = await getSecret("ANTHROPIC_API_KEY");

  // Bêta sans clé réelle : simulation tracée, jamais silencieuse.
  if (!apiKey || apiKey === "local-placeholder") {
    await logRun({
      ...base,
      status: "ok",
      simulated: true,
      duration_ms: Date.now() - started,
    });
    return { data: opts.simulation, simulated: true };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: agent.model,
        max_tokens: opts.maxTokens ?? 2048,
        system: agent.system_prompt,
        messages: [
          {
            role: "user",
            content: `${JSON.stringify(opts.input)}\n\nRéponds UNIQUEMENT avec le JSON demandé, sans texte autour.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`API ${response.status} : ${(await response.text()).slice(0, 300)}`);
    }

    const payload = await response.json();
    const text: string = payload.content?.[0]?.text ?? "";
    const inputTokens: number = payload.usage?.input_tokens ?? 0;
    const outputTokens: number = payload.usage?.output_tokens ?? 0;
    const rate = RATES[agent.model] ?? RATES["claude-sonnet-5"];
    const cost = inputTokens * rate.input + outputTokens * rate.output;

    // Le modèle peut entourer le JSON : on isole le premier objet.
    const jsonText = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const data = opts.schema.parse(JSON.parse(jsonText));

    await logRun({
      ...base,
      status: "ok",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_microcents: cost,
      duration_ms: Date.now() - started,
    });
    return { data, simulated: false };
  } catch (err) {
    await logRun({
      ...base,
      status: "error",
      duration_ms: Date.now() - started,
      error: err instanceof Error ? err.message.slice(0, 500) : "Erreur inconnue",
    });
    throw err;
  }
}
