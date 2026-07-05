import Link from "next/link";
import { ArrowRight, Pause, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { toggleAgentStatus } from "@/lib/admin/actions";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";

/*
 * Vue d'ensemble du parc d'agents : réglages effectifs (le moteur lib/ai
 * lit cette config à chaque appel), consommation du mois vs budget,
 * activité récente. Le détail par agent vit dans /admin/agents/[key].
 */

function euros(microcents: number): string {
  return `${(microcents / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export default async function AdminHome() {
  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  // eslint-disable-next-line react-hooks/purity -- bornes temporelles du reporting, recalculées à chaque requête
  const d30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const [{ data: agents }, { data: runs }] = await Promise.all([
    supabase.from("agents").select("*").order("created_at"),
    supabase
      .from("agent_runs")
      .select("agent_key, status, simulated, cost_microcents, created_at")
      .gte("created_at", d30)
      .order("created_at", { ascending: false }),
  ]);

  const all = runs ?? [];
  const monthRuns = all.filter((r) => r.created_at >= monthStart.toISOString());
  const spendByAgent = new Map<string, number>();
  const lastRunByAgent = new Map<string, string>();
  for (const r of monthRuns) {
    spendByAgent.set(r.agent_key, (spendByAgent.get(r.agent_key) ?? 0) + Number(r.cost_microcents));
  }
  for (const r of all) {
    if (!lastRunByAgent.has(r.agent_key)) lastRunByAgent.set(r.agent_key, r.created_at);
  }
  const totalSpend = monthRuns.reduce((s, r) => s + Number(r.cost_microcents), 0);
  const errors30 = all.filter((r) => r.status === "error").length;
  const actifs = (agents ?? []).filter((a) => a.status === "active").length;

  const TILES = [
    { label: "Runs sur 30 jours", valeur: all.length.toLocaleString("fr-FR") },
    { label: "Coût du mois (estimation)", valeur: euros(totalSpend) },
    { label: "Erreurs sur 30 jours", valeur: errors30.toLocaleString("fr-FR") },
    { label: "Agents en service", valeur: `${actifs} / ${(agents ?? []).length}` },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Le parc d’agents
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cette console pilote le moteur en production : modèle, prompt,
          budget et pause s’appliquent à l’appel suivant.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((t) => (
          <div key={t.label} className="rounded-[1.5rem] border bg-card p-5">
            <p className="text-2xl font-bold tabular-nums tracking-tight">{t.valeur}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(agents ?? []).map((agent) => {
          const spend = spendByAgent.get(agent.key) ?? 0;
          const budget = agent.monthly_budget_cents * 10_000;
          const pct = budget > 0 ? Math.min(100, (spend / budget) * 100) : 0;
          const last = lastRunByAgent.get(agent.key);
          const active = agent.status === "active";
          return (
            <div key={agent.key} className="flex flex-col rounded-[1.75rem] border bg-card p-6">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-brand-soft to-brand/15 ring-1 ring-brand/20">
                  <SpriteAvatar src={`/agents/${agent.key}.webp`} alt="" className="h-10" />
                </span>
                <form action={toggleAgentStatus}>
                  <input type="hidden" name="key" value={agent.key} />
                  <input type="hidden" name="to" value={active ? "paused" : "active"} />
                  <button
                    type="submit"
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors ${
                      active
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100"
                        : "bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100"
                    }`}
                    title={active ? "Mettre en pause" : "Remettre en service"}
                  >
                    {active ? <Pause className="size-3" /> : <Play className="size-3" />}
                    {active ? "En service" : "En pause"}
                  </button>
                </form>
              </div>

              <h2 className="mt-3 font-bold tracking-tight">{agent.prenom}</h2>
              <p className="text-[13px] font-medium text-brand-strong">{agent.role}</p>
              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">
                {agent.description}
              </p>

              <div className="mt-4 space-y-1.5 border-t pt-3.5 text-xs text-muted-foreground">
                <p className="flex justify-between">
                  <span>Runtime</span>
                  <span className={`font-mono ${agent.runtime === "hermes" ? "text-brand-strong" : "text-foreground"}`}>
                    {agent.runtime === "hermes" ? "hermes · VPS" : "claude · API"}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span>Modèle</span>
                  <span className="max-w-40 truncate font-mono text-foreground" title={agent.runtime === "hermes" ? agent.hermes_model : agent.model}>
                    {agent.runtime === "hermes" ? agent.hermes_model : agent.model}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span>Prompt</span>
                  <span className="text-foreground">v{agent.prompt_version}</span>
                </p>
                <p className="flex justify-between">
                  <span>Dernier run</span>
                  <span className="text-foreground">
                    {last
                      ? new Date(last).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) +
                        " · " +
                        new Date(last).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                      : "Jamais"}
                  </span>
                </p>
              </div>

              <div className="mt-3">
                <p className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Budget du mois</span>
                  <span className="tabular-nums">
                    {euros(spend)} / {(agent.monthly_budget_cents / 100).toLocaleString("fr-FR")} €
                  </span>
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${pct > 85 ? "bg-red-500" : "bg-brand"}`}
                    style={{ width: `${Math.max(pct, spend > 0 ? 2 : 0)}%` }}
                  />
                </div>
              </div>

              <Link
                href={`/admin/agents/${agent.key}`}
                className="group mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-strong"
              >
                Régler et suivre
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </div>
          );
        })}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground/80">
        Coûts estimés d’après les tarifs publics des modèles, tracés par run
        dans agent_runs. Un agent en pause ou à court de budget refuse
        l’appel : les parcours produit affichent alors un repli explicite,
        jamais une réponse inventée.
      </p>
    </div>
  );
}
