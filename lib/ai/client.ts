import "server-only";
import { z } from "zod";
import { getSecret } from "@/lib/secrets";
import { TOOL_APIS } from "@/lib/tool-apis";
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
  hermes_model: string;
  runtime: "claude" | "hermes";
  status: "active" | "paused";
  monthly_budget_cents: number;
  system_prompt: string;
  prompt_version: number;
  // Mixture-of-Agents (voir migration 20260706120000_agents_moa) :
  moa_enabled: boolean;
  moa_reference_models: string[];
  moa_aggregator_model: string | null;
  moa_reference_max_tokens: number | null;
};

// Bornes de temps par appel : un fournisseur lent/bloqué devient une erreur
// LEVÉE (→ catch → repli déterministe/gabarit), jamais un hang qui ferait tuer
// l'action serveur par Vercel sans avoir rien produit. Le bridge (boucle
// agentique + outils juridiques) a droit à davantage que les appels directs.
const AI_FETCH_TIMEOUT_MS = 60_000;
const BRIDGE_FETCH_TIMEOUT_MS = 110_000;

// microcentimes (1 € = 1 000 000) par token, estimation des tarifs publics.
const RATES: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-opus-4-8": { input: 15, output: 75 },
};

// Tarifs OpenRouter (USD/token ≈ €/token), rafraîchis toutes les heures.
let pricingCache: { at: number; map: Map<string, { inMc: number; outMc: number }> } | null = null;

async function modelPricingMicrocents(model: string): Promise<{ inMc: number; outMc: number } | null> {
  if (!pricingCache || Date.now() - pricingCache.at > 3_600_000) {
    const map = new Map<string, { inMc: number; outMc: number }>();
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        next: { revalidate: 3600 },
      });
      const payload = await res.json();
      for (const m of payload.data ?? []) {
        map.set(m.id, {
          inMc: parseFloat(m.pricing?.prompt ?? "0") * 1_000_000,
          outMc: parseFloat(m.pricing?.completion ?? "0") * 1_000_000,
        });
      }
    } catch {
      /* garde le cache vide : coût 0 plutôt qu'un échec du run */
    }
    pricingCache = { at: Date.now(), map };
  }
  return pricingCache.map.get(model) ?? null;
}

/**
 * Coût d'un appel en microcents. Privilégie un coût réel déjà remonté par le
 * fournisseur (`reportedMicrocents`, ex. usage.cost OpenRouter) ; à défaut,
 * repli sur le pricing du map en essayant chaque slug dans l'ordre. On tente
 * plusieurs slugs car l'id de modèle RENVOYÉ par un fournisseur peut être daté
 * (ex. anthropic/claude-4.8-opus-20260528) et ne pas correspondre aux clés du
 * map, alors que le slug DEMANDÉ (ex. anthropic/claude-opus-4.8) y figure.
 */
async function resolveCostMicrocents(opts: {
  reportedMicrocents?: number | null;
  inputTokens: number;
  outputTokens: number;
  slugs: (string | null | undefined)[];
}): Promise<number> {
  if (opts.reportedMicrocents != null) return opts.reportedMicrocents;
  for (const slug of opts.slugs) {
    if (!slug) continue;
    const pricing = await modelPricingMicrocents(slug);
    if (pricing) return Math.round(opts.inputTokens * pricing.inMc + opts.outputTokens * pricing.outMc);
  }
  return 0;
}

/**
 * Un appel OpenRouter chat/completions. Retourne le texte, les tokens réels
 * (usage) et le modèle effectivement servi. Utilisé pour le MOA : proposeurs
 * et agrégateur passent tous par ici.
 */
async function openRouterChat(opts: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
}): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  // Coût réel facturé par OpenRouter (usage.cost, en USD≈€), en microcents.
  // null si non renvoyé → repli sur le pricing par slug demandé côté appelant.
  costMicrocents: number | null;
}> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(AI_FETCH_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "content-type": "application/json",
      "HTTP-Referer": "https://bleme.fr",
      "X-Title": "BLEME",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      usage: { include: true },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status} (${opts.model}) : ${(await res.text()).slice(0, 200)}`);
  }
  const payload = await res.json();
  const usageCost = payload.usage?.cost;
  return {
    text: payload.choices?.[0]?.message?.content ?? "",
    inputTokens: payload.usage?.prompt_tokens ?? 0,
    outputTokens: payload.usage?.completion_tokens ?? 0,
    model: payload.model ?? opts.model,
    costMicrocents: typeof usageCost === "number" ? Math.round(usageCost * 1_000_000) : null,
  };
}

/*
 * Préambule « Aggregate-and-Synthesize » (papier MoA, Wang et al. 2024),
 * adapté aux règles non négociables de BLEME : l'agrégateur SYNTHÉTISE (il ne
 * recopie ni ne vote), évalue chaque proposition de façon critique, et surtout
 * n'invente jamais une valeur absente des propositions et des faits fournis.
 * Il est préfixé aux consignes de rôle de l'agent, suivi des réponses des
 * proposeurs en liste numérotée.
 */
const MOA_AGGREGATOR_PREAMBLE =
  "Plusieurs modèles ont produit chacun une réponse candidate à la même requête. " +
  "Ta tâche : les SYNTHÉTISER en une seule réponse de haute qualité. Évalue chaque " +
  "proposition de façon critique — certaines peuvent être biaisées ou erronées. Ne " +
  "recopie aucune proposition à l'aveugle et ne te contente pas de la majorité : " +
  "produis une réponse affinée, exacte et complète. N'invente JAMAIS une valeur " +
  "(montant, date, référence, fait) absente à la fois des propositions et des faits " +
  "fournis en entrée ; conserve pour chaque valeur sa source. Respecte strictement les " +
  "consignes de ton rôle ci-dessous et le format de sortie demandé.";

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
    .select(
      "key, model, hermes_model, runtime, status, monthly_budget_cents, system_prompt, prompt_version, moa_enabled, moa_reference_models, moa_aggregator_model, moa_reference_max_tokens",
    )
    .eq("key", key)
    .maybeSingle();
  if (!data) return null;
  // moa_reference_models est du jsonb : garantir un tableau de chaînes propre.
  const refs = Array.isArray(data.moa_reference_models)
    ? (data.moa_reference_models as unknown[]).filter((m): m is string => typeof m === "string")
    : [];
  return { ...(data as AgentConfig), moa_reference_models: refs };
}

/**
 * APIs outils actives pour un agent (communes + les siennes), avec leurs
 * credentials résolus depuis le coffre. Une API dont une clé manque est
 * écartée : l'agent ne voit jamais un outil inutilisable.
 */
async function loadAgentToolApis(
  key: string,
): Promise<{ name: string; credentials: Record<string, string> }[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agent_tool_apis")
    .select("api_name, agent_key")
    .or(`agent_key.is.null,agent_key.eq.${key}`);
  const enabled = new Set((data ?? []).map((r) => r.api_name));
  const out: { name: string; credentials: Record<string, string> }[] = [];
  for (const api of TOOL_APIS) {
    if (!enabled.has(api.name)) continue;
    const credentials: Record<string, string> = {};
    let complete = true;
    for (const secretName of api.secrets) {
      const value = await getSecret(secretName);
      if (!value) {
        complete = false;
        break;
      }
      credentials[secretName] = value;
    }
    if (!complete) continue;
    for (const secretName of api.optionalSecrets ?? []) {
      const value = await getSecret(secretName);
      if (value) credentials[secretName] = value;
    }
    out.push({ name: api.name, credentials });
  }
  return out;
}

/** Skills actives pour un agent : les communes (agent_key null) + les siennes. */
async function loadAgentSkills(key: string): Promise<string[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agent_skills")
    .select("skill_name, agent_key")
    .or(`agent_key.is.null,agent_key.eq.${key}`);
  return [...new Set((data ?? []).map((r) => r.skill_name))];
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
  tool_calls?: string[];
}) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("agent_runs").insert(run);
  // Défense de déploiement : si la colonne tool_calls n'existe pas encore
  // (migration pas appliquée), on ne PERD PAS le run — on le retrace sans.
  if (error && run.tool_calls) {
    const { tool_calls: _omit, ...rest } = run;
    await supabase.from("agent_runs").insert(rest);
  }
}

/** Trace des outils renvoyée par le bridge : liste bornée de "api.action". */
function parseToolCalls(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const calls = raw
    .filter((c): c is string => typeof c === "string" && c.length > 0)
    .map((c) => c.slice(0, 80))
    .slice(0, 12);
  return calls.length > 0 ? calls : undefined;
}

/**
 * Exécute un agent : `input` est sérialisé pour le modèle, la réponse doit
 * valider `schema`. `simulation` est la valeur retournée en mode bêta sans
 * clé API (trace marquée simulated).
 */
// Contenu du message Claude : une string simple, ou un tableau de blocs
// (image/document lus en vision + texte) quand des pièces sont fournies.
function buildClaudeContent(
  input: unknown,
  attachments?: { mime: string; dataBase64: string }[],
): string | unknown[] {
  const text = `${JSON.stringify(input)}\n\nRéponds UNIQUEMENT avec le JSON demandé, sans texte autour.`;
  if (!attachments || attachments.length === 0) return text;
  const blocks = attachments.map((a) =>
    a.mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: a.dataBase64 } }
      : { type: "image", source: { type: "base64", media_type: a.mime, data: a.dataBase64 } },
  );
  return [...blocks, { type: "text", text }];
}

export async function runAgent<T>(opts: {
  key: string;
  input: unknown;
  schema: z.ZodType<T>;
  simulation: T;
  organizationId?: string | null;
  caseId?: string | null;
  maxTokens?: number;
  // Pièces à faire LIRE en vision (PDF, images). Transmises au bridge Hermes
  // (chemin multimodal) et au runtime Claude ; ignorées par le MOA.
  attachments?: { mime: string; dataBase64: string }[];
  // Modèle imposé pour CET appel (ex. modèle vision OpenRouter) — surcharge
  // hermes_model côté bridge sans changer la config par défaut de l'agent.
  modelOverride?: string;
}): Promise<{ data: T; simulated: boolean; toolCalls?: string[] }> {
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

  // ── Mixture-of-Agents (MOA) via OpenRouter ─────────────────────────────────
  // Orthogonal au runtime : quand un agent a le MOA activé et au moins un
  // proposeur, proposeurs ET agrégateur passent par OpenRouter. N proposeurs
  // répondent en parallèle, l'agrégateur synthétise la réponse finale (JSON
  // validé). Tokens et coût des N+1 appels sommés dans une seule trace.
  const refModels = [...new Set(agent.moa_reference_models)].filter(Boolean);
  if (agent.moa_enabled && refModels.length > 0) {
    const orKey = await getSecret("OPENROUTER_API_KEY");

    // Bêta sans clé OpenRouter : simulation tracée, jamais silencieuse.
    if (!orKey || orKey === "local-placeholder") {
      await logRun({
        ...base,
        model: `moa:${refModels.length}réfs (simulé)`,
        status: "ok",
        simulated: true,
        duration_ms: Date.now() - started,
      });
      return { data: opts.simulation, simulated: true };
    }

    const aggregatorModel = agent.moa_aggregator_model ?? agent.hermes_model;
    const refMaxTokens = agent.moa_reference_max_tokens ?? 800;
    const userMessage = `${JSON.stringify(opts.input)}\n\nRéponds UNIQUEMENT avec le JSON demandé, sans texte autour.`;

    try {
      // 1) Proposeurs en parallèle. Ils reçoivent la persona de l'agent (donc
      //    la règle « aucune valeur inventée » — garde-fou juridique), mais un
      //    échec isolé n'annule pas le run : on agrège les proposeurs qui ont
      //    répondu (comportement fidèle à Hermes).
      const proposals = await Promise.allSettled(
        refModels.map((model) =>
          openRouterChat({
            apiKey: orKey,
            model,
            system: agent.system_prompt,
            user: userMessage,
            maxTokens: refMaxTokens,
          }),
        ),
      );
      const ok = proposals
        .map((p, i) => ({ p, model: refModels[i] }))
        .filter((x): x is { p: PromiseFulfilledResult<Awaited<ReturnType<typeof openRouterChat>>>; model: string } =>
          x.p.status === "fulfilled",
        )
        .map((x) => ({ ...x.p.value, requested: x.model }));

      if (ok.length === 0) {
        const first = proposals.find((p) => p.status === "rejected") as PromiseRejectedResult | undefined;
        throw new Error(
          `Aucun proposeur MOA n'a répondu (${first?.reason instanceof Error ? first.reason.message : "erreur inconnue"})`,
        );
      }

      // 2) Agrégateur : préambule de synthèse + persona + réponses numérotées.
      const references = ok.map((r, i) => `${i + 1}. ${r.text.trim()}`).join("\n\n");
      const aggregatorSystem = `${agent.system_prompt}\n\n---\n${MOA_AGGREGATOR_PREAMBLE}\n\nRéponses des modèles :\n${references}`;
      const aggregated = await openRouterChat({
        apiKey: orKey,
        model: aggregatorModel,
        system: aggregatorSystem,
        user: userMessage,
        maxTokens: opts.maxTokens ?? 2048,
      });

      // 3) Le modèle peut entourer le JSON : on isole le premier objet.
      const jsonText = aggregated.text.slice(
        aggregated.text.indexOf("{"),
        aggregated.text.lastIndexOf("}") + 1,
      );
      const data = opts.schema.parse(JSON.parse(jsonText));

      // 4) Coût cumulé des N+1 appels. On privilégie le coût réel renvoyé par
      //    OpenRouter (usage.cost) ; à défaut, repli sur le pricing du map,
      //    indexé par le SLUG DEMANDÉ (l'id renvoyé peut être daté et ne pas
      //    correspondre aux clés du map — ex. anthropic/claude-4.8-opus-…).
      const costOf = (call: Awaited<ReturnType<typeof openRouterChat>>, requestedSlug: string) =>
        resolveCostMicrocents({
          reportedMicrocents: call.costMicrocents,
          inputTokens: call.inputTokens,
          outputTokens: call.outputTokens,
          slugs: [requestedSlug],
        });

      let inputTokens = aggregated.inputTokens;
      let outputTokens = aggregated.outputTokens;
      let cost = await costOf(aggregated, aggregatorModel);
      for (const r of ok) {
        inputTokens += r.inputTokens;
        outputTokens += r.outputTokens;
        cost += await costOf(r, r.requested);
      }

      const aggShort = aggregatorModel.split("/").pop() ?? aggregatorModel;
      await logRun({
        ...base,
        model: `moa:${ok.length}réfs→${aggShort}`,
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
        model: `moa:${refModels.length}réfs`,
        status: "error",
        duration_ms: Date.now() - started,
        error: err instanceof Error ? err.message.slice(0, 500) : "Erreur inconnue",
      });
      throw err;
    }
  }

  // ── Runtime Hermes : le bleme-bridge du VPS (piloté par /admin) ────────────
  if (agent.runtime === "hermes") {
    const [bridgeUrl, bridgeToken, skills, toolApis] = await Promise.all([
      getSecret("BLEME_BRIDGE_URL"),
      getSecret("BLEME_BRIDGE_TOKEN"),
      loadAgentSkills(agent.key),
      loadAgentToolApis(agent.key),
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
    // Trace des outils appelés pendant la boucle agentique (renvoyée par le
    // bridge) : capturée AVANT le parsing du JSON pour survivre aux runs en
    // erreur de schéma — les appels ont bien eu lieu, on les journalise.
    let bridgeToolCalls: string[] | undefined;
    try {
      const response = await fetch(`${bridgeUrl.replace(/\/$/, "")}/run`, {
        method: "POST",
        signal: AbortSignal.timeout(BRIDGE_FETCH_TIMEOUT_MS),
        headers: {
          Authorization: `Bearer ${bridgeToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agent: agent.key,
          system: agent.system_prompt,
          input: JSON.stringify(opts.input),
          model: opts.modelOverride ?? agent.hermes_model,
          skills,
          tool_apis: toolApis,
          // clés snake_case attendues par le bridge (_vision_chat).
          attachments: (opts.attachments ?? []).map((a) => ({
            mime: a.mime,
            data_base64: a.dataBase64,
          })),
        }),
      });
      if (!response.ok) {
        throw new Error(`bridge ${response.status} : ${(await response.text()).slice(0, 300)}`);
      }
      const payload = await response.json();
      bridgeToolCalls = parseToolCalls(payload.tool_calls);
      const text: string = payload.text ?? "";
      const jsonText = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      const data = opts.schema.parse(JSON.parse(jsonText));
      const inputTokens: number = payload.input_tokens ?? 0;
      const outputTokens: number = payload.output_tokens ?? 0;
      // Coût : d'abord un coût réel remonté par le bridge (payload.cost en
      // USD≈€, ou payload.cost_microcents) ; sinon pricing par slug — on essaie
      // l'id renvoyé PUIS le slug demandé (l'id peut être daté et rater le map).
      // > 0 requis : un coût 0/absent du bridge signifie « inconnu » (Hermes ne
      // l'a pas remonté), pas « gratuit » → on laisse le repli tarif-liste jouer.
      const reportedMicrocents =
        typeof payload.cost === "number" && payload.cost > 0
          ? Math.round(payload.cost * 1_000_000)
          : typeof payload.cost_microcents === "number" && payload.cost_microcents > 0
            ? payload.cost_microcents
            : null;
      const cost = await resolveCostMicrocents({
        reportedMicrocents,
        inputTokens,
        outputTokens,
        slugs: [payload.model, agent.hermes_model],
      });
      await logRun({
        ...base,
        model: `hermes:${payload.model ?? "?"}`,
        status: "ok",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_microcents: cost,
        duration_ms: Date.now() - started,
        tool_calls: bridgeToolCalls,
      });
      // toolCalls exposé à l'appelant (affichage « sources consultées » côté
      // produit) — déjà tracé dans agent_runs pour la console.
      return { data, simulated: false, toolCalls: bridgeToolCalls };
    } catch (err) {
      await logRun({
        ...base,
        model: "hermes",
        status: "error",
        duration_ms: Date.now() - started,
        error: err instanceof Error ? err.message.slice(0, 500) : "Erreur inconnue",
        tool_calls: bridgeToolCalls,
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
      signal: AbortSignal.timeout(AI_FETCH_TIMEOUT_MS),
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
            content: buildClaudeContent(opts.input, opts.attachments),
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
