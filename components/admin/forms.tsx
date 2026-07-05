"use client";

import { useActionState } from "react";
import { CircleAlert, CircleCheck, FlaskConical } from "lucide-react";
import {
  saveAgentPrompt,
  testAgent,
  updateAgentSettings,
  type AdminState,
} from "@/lib/admin/actions";

const INITIAL: AdminState = {};

function Feedback({ state }: { state: AdminState }) {
  if (state.error) {
    return (
      <p role="alert" className="flex items-center gap-2 text-sm text-red-600">
        <CircleAlert className="size-4 shrink-0" />
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-emerald-700">
        <CircleCheck className="size-4 shrink-0" />
        {state.success}
      </p>
    );
  }
  return null;
}

const inputCls =
  "rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand";

export function AgentSettingsForm({
  agent,
}: {
  agent: {
    key: string;
    model: string;
    hermes_model: string;
    runtime: string;
    status: string;
    monthly_budget_cents: number;
  };
}) {
  const [state, action, pending] = useActionState(updateAgentSettings, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="key" value={agent.key} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Runtime
          <select name="runtime" defaultValue={agent.runtime} className={inputCls}>
            <option value="claude">Claude (API Anthropic)</option>
            <option value="hermes">Hermes (VPS · Nous)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Modèle (runtime Claude)
          <select name="model" defaultValue={agent.model} className={inputCls}>
            <option value="claude-sonnet-5">Sonnet 5 (défaut)</option>
            <option value="claude-haiku-4-5">Haiku 4.5 (rapide)</option>
            <option value="claude-opus-4-8">Opus 4.8 (fort)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Modèle (runtime Hermes)
          <input
            name="hermesModel"
            defaultValue={agent.hermes_model}
            list="openrouter-modeles"
            className={`${inputCls} font-mono text-xs`}
            placeholder="fournisseur/modele"
          />
          <datalist id="openrouter-modeles">
            <option value="nousresearch/hermes-4-70b" />
            <option value="nousresearch/hermes-4-405b" />
            <option value="moonshotai/kimi-k2.6" />
            <option value="deepseek/deepseek-chat" />
            <option value="qwen/qwen3-235b-a22b" />
          </datalist>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Statut
          <select name="status" defaultValue={agent.status} className={inputCls}>
            <option value="active">En service</option>
            <option value="paused">En pause</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Budget mensuel (€)
          <input
            type="number"
            name="budgetEuros"
            min={0}
            max={10000}
            step={1}
            defaultValue={Math.round(agent.monthly_budget_cents / 100)}
            className={inputCls}
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-ink-soft active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer les réglages"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function PromptEditor({
  agentKey,
  content,
  version,
}: {
  agentKey: string;
  content: string;
  version: number;
}) {
  const [state, action, pending] = useActionState(saveAgentPrompt, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="key" value={agentKey} />
      <textarea
        name="content"
        defaultValue={content}
        rows={12}
        className="w-full rounded-2xl border bg-background p-4 font-mono text-[13px] leading-relaxed outline-none transition-colors focus:border-brand"
      />
      <div className="flex flex-wrap items-center gap-3">
        <input
          name="note"
          placeholder="Note de version (optionnel)"
          maxLength={200}
          className={`${inputCls} min-w-56 flex-1`}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : `Activer comme v${version + 1}`}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function TestAgentButton({ agentKey }: { agentKey: string }) {
  const [state, action, pending] = useActionState(testAgent, INITIAL);
  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="key" value={agentKey} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:border-brand/50 hover:text-brand-strong disabled:opacity-60"
      >
        <FlaskConical className="size-4" />
        {pending ? "Run en cours…" : "Lancer un run de test"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
