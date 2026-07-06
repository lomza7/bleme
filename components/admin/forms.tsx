"use client";

import { useActionState, useState } from "react";
import {
  Boxes,
  CircleAlert,
  CircleCheck,
  Coins,
  FlaskConical,
  GitMerge,
  Layers,
  X,
} from "lucide-react";
import {
  saveAgentPrompt,
  testAgent,
  updateAgentSettings,
  type AdminState,
} from "@/lib/admin/actions";
import type { ORModel } from "@/lib/admin/hermes-actions";
import { ModelPicker } from "@/components/admin/model-picker";

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
  models = [],
}: {
  agent: {
    key: string;
    model: string;
    hermes_model: string;
    runtime: string;
    status: string;
    monthly_budget_cents: number;
    moa_enabled: boolean;
    moa_reference_models: string[];
    moa_aggregator_model: string | null;
    moa_reference_max_tokens: number | null;
  };
  models?: ORModel[];
}) {
  const [state, action, pending] = useActionState(updateAgentSettings, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="key" value={agent.key} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Modèle (OpenRouter)
          <ModelPicker
            name="hermesModel"
            defaultValue={agent.hermes_model}
            models={models}
          />
          <span className="text-[11px] font-normal text-muted-foreground">
            {models.length > 0
              ? `${models.length} modèles, liste vivante OpenRouter · badge « outils » = compatible skills à outils`
              : "Tout slug OpenRouter est accepté ; le run de test valide le choix."}
          </span>
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

      <MoaSettings agent={agent} models={models} />

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

/*
 * Section Mixture-of-Agents (MOA) du formulaire de réglages. Interrupteur +
 * liste de modèles proposeurs (à mixer) + agrégateur + plafond de tokens des
 * proposeurs. Tout est rendu en champs cachés dans le formulaire parent : un
 * seul « Enregistrer » sauve l'ensemble. Coût ≈ ×(N+1) tokens, signalé ici.
 */
function MoaSettings({
  agent,
  models,
}: {
  agent: {
    moa_enabled: boolean;
    moa_reference_models: string[];
    moa_aggregator_model: string | null;
    moa_reference_max_tokens: number | null;
  };
  models: ORModel[];
}) {
  const [enabled, setEnabled] = useState(agent.moa_enabled);
  const [refs, setRefs] = useState<string[]>(agent.moa_reference_models ?? []);

  const addRef = (id: string) => {
    const slug = id.trim();
    if (slug) setRefs((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
  };
  const removeRef = (id: string) => setRefs((prev) => prev.filter((r) => r !== id));

  const multiplier = refs.length + 1;

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition-colors ${
        enabled
          ? "border-brand/30 bg-gradient-to-br from-brand-soft/60 to-card"
          : "border-dashed bg-muted/30"
      }`}
    >
      {/* Champs soumis avec le formulaire parent */}
      <input type="hidden" name="moaEnabled" value={enabled ? "true" : "false"} />
      {refs.map((r) => (
        <input key={r} type="hidden" name="moaReferenceModels" value={r} />
      ))}

      {/* En-tête : identité de la fonctionnalité + état + interrupteur */}
      <div className="flex items-center gap-3.5 p-4">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 transition-colors ${
            enabled
              ? "bg-gradient-to-b from-brand-soft to-brand/15 text-brand-strong ring-brand/25"
              : "bg-muted text-muted-foreground ring-border"
          }`}
        >
          <Layers className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">Mixture-of-Agents</p>
            {enabled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                Actif · ×{multiplier} tokens
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">
                Inactif
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Plusieurs modèles proposent en parallèle, un agrégateur synthétise la
            réponse finale. Via OpenRouter.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Activer le Mixture-of-Agents"
          onClick={() => setEnabled((e) => !e)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none ring-offset-2 ring-offset-card transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 ${
            enabled ? "bg-brand" : "bg-muted-foreground/30"
          }`}
        >
          <span
            className={`inline-block size-5 transform rounded-full bg-white shadow-sm transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {enabled ? (
        <div className="flex flex-col gap-5 border-t border-brand/15 bg-card/60 p-4">
          {/* Proposeurs à mixer */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <Boxes className="size-3.5 text-brand-strong" />
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Proposeurs à mixer
              </span>
              {refs.length > 0 ? (
                <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-brand-strong">
                  {refs.length}
                </span>
              ) : null}
            </div>

            {refs.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {refs.map((r) => (
                  <span
                    key={r}
                    className="group inline-flex items-center gap-1.5 rounded-lg bg-card py-1 pl-2.5 pr-1 font-mono text-[11px] text-foreground ring-1 ring-border transition-colors hover:ring-brand/40"
                  >
                    {r}
                    <button
                      type="button"
                      aria-label={`Retirer ${r}`}
                      onClick={() => removeRef(r)}
                      className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700 ring-1 ring-amber-200">
                <CircleAlert className="size-3.5 shrink-0" />
                Ajoutez au moins un proposeur : le MOA reste inactif tant que la
                liste est vide.
              </p>
            )}

            <div className="max-w-md">
              <ModelPicker
                models={models}
                onSelect={addRef}
                placeholder="+ Ajouter un modèle proposeur…"
              />
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Privilégiez des familles différentes (ex. un modèle rapide + un
              modèle fort) : la diversité inter-modèles apporte plus que le nombre.
            </p>
          </div>

          {/* Connecteur visuel proposeurs → agrégateur */}
          <div className="flex items-center gap-2.5 text-[11px] font-medium text-muted-foreground">
            <span className="h-px flex-1 bg-brand/15" />
            <GitMerge className="size-3.5 text-brand-strong" />
            synthétisés par l’agrégateur
            <span className="h-px flex-1 bg-brand/15" />
          </div>

          {/* Agrégateur + plafond */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Modèle agrégateur
              <ModelPicker
                name="moaAggregatorModel"
                defaultValue={agent.moa_aggregator_model ?? ""}
                models={models}
              />
              <span className="text-[11px] font-normal leading-relaxed text-muted-foreground">
                Écrit la réponse finale (JSON validé). Vide → modèle de l’agent.
              </span>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Plafond tokens proposeurs
              <input
                type="number"
                name="moaReferenceMaxTokens"
                min={1}
                max={32000}
                step={100}
                defaultValue={agent.moa_reference_max_tokens ?? ""}
                placeholder="800"
                className={inputCls}
              />
              <span className="text-[11px] font-normal leading-relaxed text-muted-foreground">
                Levier latence/coût. Vide → non plafonné.
              </span>
            </label>
          </div>

          {/* Encart coût */}
          <div className="flex items-center gap-2.5 rounded-xl bg-brand-soft/70 px-3.5 py-2.5 ring-1 ring-brand/15">
            <Coins className="size-4 shrink-0 text-brand-strong" />
            <p className="text-[11px] leading-relaxed text-brand-strong/90">
              Coût ≈ <b className="font-semibold">×{multiplier}</b> tokens par
              appel ({refs.length} proposeur{refs.length > 1 ? "s" : ""} +
              agrégateur), sommé dans une seule trace et imputé au budget mensuel
              de l’agent. Clé <code className="rounded bg-brand/10 px-1 py-0.5 font-mono">OPENROUTER_API_KEY</code> requise dans le coffre.
            </p>
          </div>
        </div>
      ) : null}
    </div>
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
