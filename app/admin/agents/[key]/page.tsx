import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AgentSettingsForm, PromptEditor, TestAgentButton } from "@/components/admin/forms";
import {
  getOpenRouterModels,
  getSkillScopes,
  getToolApiReadiness,
  getToolApiScopes,
  toggleToolApiScope,
} from "@/lib/admin/hermes-actions";
import { TOOL_APIS } from "@/lib/tool-apis";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";

export const metadata: Metadata = { title: "Agent" };

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  ok: { label: "OK", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  error: { label: "Erreur", cls: "bg-red-50 text-red-700 ring-red-200" },
  blocked_budget: { label: "Budget", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  blocked_paused: { label: "En pause", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
};

function euros(microcents: number): string {
  return `${(microcents / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} €`;
}

export default async function AgentAdminPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const supabase = await createClient();

  const [models, scopes, toolScopes, toolReadiness] = await Promise.all([
    getOpenRouterModels(),
    getSkillScopes(),
    getToolApiScopes(),
    getToolApiReadiness(),
  ]);
  const [{ data: agent }, { data: runs }, { data: versions }] = await Promise.all([
    supabase.from("agents").select("*").eq("key", key).maybeSingle(),
    supabase
      .from("agent_runs")
      .select("*")
      .eq("agent_key", key)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("agent_prompt_versions")
      .select("version, note, created_at")
      .eq("agent_key", key)
      .order("version", { ascending: false })
      .limit(10),
  ]);
  if (!agent) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-brand-soft to-brand/15 ring-1 ring-brand/20">
            <SpriteAvatar src={`/agents/${agent.key}.webp`} alt="" className="h-11" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{agent.prenom}</h1>
            <p className="text-sm font-medium text-brand-strong">{agent.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <TestAgentButton agentKey={agent.key} />
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Tous les agents
          </Link>
        </div>
      </div>

      <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Réglages du moteur
        </h2>
        <div className="mt-4">
          <AgentSettingsForm agent={agent} models={models} />
        </div>
        {(() => {
          const communes = Object.entries(scopes)
            .filter(([, s]) => s.includes("commun"))
            .map(([n]) => n);
          const propres = Object.entries(scopes)
            .filter(([, s]) => s.includes(agent.key))
            .map(([n]) => n);
          return (
            <div className="mt-5 border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Skills actives pour {agent.prenom}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {communes.map((n) => (
                  <code key={n} className="rounded-full bg-muted px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                    {n} · commun
                  </code>
                ))}
                {propres.map((n) => (
                  <code key={n} className="rounded-full bg-brand-soft px-2.5 py-1 font-mono text-[11px] text-brand-strong">
                    {n}
                  </code>
                ))}
                {communes.length + propres.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    Aucune : gérez les portées dans l’onglet Hermes & Skills.
                  </span>
                ) : null}
              </div>
            </div>
          );
        })()}
      </section>

      <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          APIs outils
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Sources officielles que {agent.prenom} peut interroger pendant un
          run : l’agent émet un appel, le bridge exécute la requête et lui
          renvoie le résultat avant la réponse finale.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {TOOL_APIS.map((api) => {
            const apiScopes = toolScopes[api.name] ?? [];
            const commun = apiScopes.includes("commun");
            const propre = apiScopes.includes(agent.key);
            const ready = toolReadiness[api.name] ?? false;
            return (
              <div
                key={api.name}
                className="flex flex-col gap-3 rounded-2xl border bg-background p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {api.label}
                    {ready ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                        prête
                      </span>
                    ) : (
                      <Link
                        href="/admin/cles"
                        className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
                      >
                        clés manquantes : {api.secrets.join(", ")}
                      </Link>
                    )}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {api.description}
                  </p>
                  <p className="mt-1.5 font-mono text-[10px] text-muted-foreground/80">
                    {api.actions.map((a) => `${api.name}.${a}`).join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <form action={toggleToolApiScope}>
                    <input type="hidden" name="api" value={api.name} />
                    <input type="hidden" name="scope" value={agent.key} />
                    <button
                      type="submit"
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
                        propre
                          ? "bg-brand-soft text-brand-strong ring-brand/30"
                          : "text-muted-foreground ring-border hover:text-foreground"
                      }`}
                    >
                      {propre ? `Active pour ${agent.prenom}` : `Activer pour ${agent.prenom}`}
                    </button>
                  </form>
                  <form action={toggleToolApiScope}>
                    <input type="hidden" name="api" value={api.name} />
                    <input type="hidden" name="scope" value="commun" />
                    <button
                      type="submit"
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
                        commun
                          ? "bg-ink text-white ring-ink"
                          : "text-muted-foreground ring-border hover:text-foreground"
                      }`}
                    >
                      {commun ? "Commune aux 6" : "Commun aux 6"}
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Prompt système · v{agent.prompt_version} active
          </h2>
          <details className="group relative">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
              <History className="size-3.5" />
              Historique des versions
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-72 rounded-2xl border bg-card p-3 shadow-xl">
              {(versions ?? []).map((v) => (
                <p key={v.version} className="flex items-baseline justify-between gap-3 px-2 py-1.5 text-xs">
                  <span className="font-semibold">v{v.version}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {v.note ?? "Sans note"}
                  </span>
                  <span className="shrink-0 text-muted-foreground/70">
                    {new Date(v.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </span>
                </p>
              ))}
            </div>
          </details>
        </div>
        <div className="mt-4">
          <PromptEditor
            agentKey={agent.key}
            content={agent.system_prompt}
            version={agent.prompt_version}
          />
        </div>
      </section>

      <section>
        <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Derniers runs
        </h2>
        {(runs ?? []).length === 0 ? (
          <p className="mt-3 rounded-[1.75rem] border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
            Aucun run pour l’instant. Lancez un run de test ci-dessus : il
            apparaîtra ici avec sa trace complète.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-[1.75rem] border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 font-medium">Modèle</th>
                  <th className="px-5 py-3 text-right font-medium">Tokens (in/out)</th>
                  <th className="px-5 py-3 text-right font-medium">Coût</th>
                  <th className="px-5 py-3 text-right font-medium">Durée</th>
                </tr>
              </thead>
              <tbody>
                {(runs ?? []).map((r) => {
                  const chip = STATUS_CHIP[r.status] ?? STATUS_CHIP.ok;
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}{" "}
                        {new Date(r.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${chip.cls}`}>
                          {chip.label}
                          {r.simulated ? " · simulé" : ""}
                        </span>
                        {r.error ? (
                          <span className="mt-1 block max-w-56 truncate text-[11px] text-red-600" title={r.error}>
                            {r.error}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs">{r.model}</td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {r.input_tokens.toLocaleString("fr-FR")} / {r.output_tokens.toLocaleString("fr-FR")}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{euros(Number(r.cost_microcents))}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                        {r.duration_ms} ms
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
