import type { Metadata } from "next";
import Link from "next/link";
import {
  Blocks,
  BrainCircuit,
  CircleCheck,
  CircleX,
  ExternalLink,
  Ticket,
} from "lucide-react";
import {
  getHermesOverview,
  getHermesVersion,
  getPaperclipAgents,
  getPaperclipIssues,
  getRoutines,
  getSkillScopes,
  setRoutineStatus,
  setTicketStatus,
  toggleSkillScope,
  type Skill,
} from "@/lib/admin/hermes-actions";
import { TicketCreateForm } from "@/components/admin/tickets";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";
import { HermesUpdateControls } from "@/components/admin/hermes-update";
import { InstallSkillButton, RemoveSkillButton } from "@/components/admin/skills";
import { RoutineCreateForm } from "@/components/admin/routines";
import { ExecuteRoutineButton } from "@/components/admin/routine-execute";
import { createClient } from "@/lib/supabase/server";
import { getSecret } from "@/lib/secrets";

export const metadata: Metadata = { title: "Hermes & Skills" };

/*
 * Le cerveau Hermes de BLEME, piloté sans SSH : état du bridge, bibliothèque
 * de skills (installées / catalogue, partagées par les 6 agents — le home
 * Hermes BLEME est isolé de toute autre instance du VPS), et l'organisation
 * Paperclip. Les skills à base d'outils nécessitent un modèle OpenRouter
 * qui route le tool use (anthropic/*, openai/*…) : mention affichée.
 */

function groupByCategory(skills: Skill[]): Map<string, Skill[]> {
  const map = new Map<string, Skill[]>();
  for (const s of skills) {
    const cat = s.name.split("/")[0];
    map.set(cat, [...(map.get(cat) ?? []), s]);
  }
  return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

export default async function HermesAdminPage() {
  const supabase = await createClient();
  const [overview, paperclipUrl, scopes, routinesRes, version, pcAgents, pcIssues, { data: agentRows }] = await Promise.all([
    getHermesOverview(),
    getSecret("PAPERCLIP_URL"),
    getSkillScopes(),
    getRoutines(),
    getHermesVersion(),
    getPaperclipAgents(),
    getPaperclipIssues(),
    supabase.from("agents").select("key, prenom").order("created_at"),
  ]);
  const agents = agentRows ?? [];

  if (!overview.configured) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold tracking-tight">Hermes & Skills</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Le bridge n’est pas configuré : renseignez{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">BLEME_BRIDGE_URL</code> et{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">BLEME_BRIDGE_TOKEN</code>{" "}
          dans{" "}
          <Link href="/admin/cles" className="font-medium text-brand-strong underline-offset-4 hover:underline">
            Clés & API
          </Link>
          .
        </p>
      </div>
    );
  }

  const installed = overview.skills?.installed ?? [];
  const available = overview.skills?.available ?? [];
  const pc = overview.paperclip;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Hermes & Skills</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Le cerveau commun des 6 agents : son état, ses skills, son
          organisation Paperclip. Tout se pilote d’ici.
        </p>
      </div>

      {/* État bridge + Paperclip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-[1.75rem] border bg-card p-6">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <BrainCircuit className="size-4 text-brand-strong" />
            Bridge Hermes (VPS)
            {overview.online ? (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                <CircleCheck className="size-3" />
                En ligne
              </span>
            ) : (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 ring-1 ring-red-200">
                <CircleX className="size-3" />
                Injoignable
              </span>
            )}
          </p>
          <dl className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <dt>Modèle par défaut</dt>
              <dd className="font-mono text-foreground">{overview.model ?? "?"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Instances chaudes</dt>
              <dd className="text-foreground">
                {overview.loadedAgents?.length ? overview.loadedAgents.join(", ") : "aucune (démarrage à la demande)"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Skills installées</dt>
              <dd className="text-foreground">{installed.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Version Hermes</dt>
              <dd className="flex items-center gap-2">
                <code className="font-mono text-foreground">{version.commit ?? "?"}</code>
                {version.behind === 0 ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                    à jour
                  </span>
                ) : typeof version.behind === "number" ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                    {version.behind} commits de retard
                  </span>
                ) : null}
              </dd>
            </div>
            {version.date ? (
              <div className="flex justify-between">
                <dt>Publiée le</dt>
                <dd className="text-foreground">
                  {new Date(version.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                </dd>
              </div>
            ) : null}
          </dl>
          <HermesUpdateControls
            behind={version.behind ?? null}
            rollbackAvailable={Boolean(version.rollbackAvailable)}
          />
        </div>

        <div className="rounded-[1.75rem] border bg-card p-6">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Ticket className="size-4 text-brand-strong" />
            Organisation Paperclip
            {pc?.ok && pc.company ? (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                <CircleCheck className="size-3" />
                {pc.company.status === "active" ? "Active" : pc.company.status}
              </span>
            ) : (
              <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                {pc?.error ? "Injoignable" : "Non connectée"}
              </span>
            )}
          </p>
          {pc?.ok && pc.company ? (
            <dl className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <dt>Company</dt>
                <dd className="font-semibold text-foreground">{pc.company.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Tickets créés</dt>
                <dd className="text-foreground">{pc.company.issueCounter}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Dépense du mois</dt>
                <dd className="tabular-nums text-foreground">
                  {(pc.company.spentMonthlyCents / 100).toLocaleString("fr-FR")} € /{" "}
                  {pc.company.budgetMonthlyCents > 0
                    ? `${(pc.company.budgetMonthlyCents / 100).toLocaleString("fr-FR")} €`
                    : "illimité"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {pc?.error ?? "Le bridge n'a pas pu joindre Paperclip."}
            </p>
          )}
          {paperclipUrl?.startsWith("http") ? (
            <a
              href={paperclipUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-brand-strong"
            >
              Ouvrir le dashboard Paperclip
              <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      </div>

      {/* Skills installées */}
      <section>
        <h2 className="flex items-center gap-2 px-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <Blocks className="size-4 text-brand-strong" />
          Skills installées · {installed.length}
        </h2>
        {installed.length === 0 ? (
          <p className="mt-3 rounded-[1.75rem] border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
            Aucune skill installée : le cerveau BLEME démarre vierge, à vous
            de composer sa bibliothèque depuis le catalogue ci-dessous.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-[1.75rem] border bg-card">
            {installed.map((s, i) => {
              const skillScopes = scopes[s.name] ?? [];
              return (
                <div key={s.name} className={`px-6 py-4 ${i > 0 ? "border-t" : ""}`}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <code className="font-mono text-xs font-semibold">{s.name}</code>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {s.description}
                    </span>
                    <RemoveSkillButton name={s.name} />
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Portée
                    </span>
                    {[{ key: "commun", label: "Commun aux 6" }, ...agents.map((a) => ({ key: a.key, label: a.prenom }))].map(
                      (scope) => {
                        const active = skillScopes.includes(scope.key);
                        return (
                          <form key={scope.key} action={toggleSkillScope}>
                            <input type="hidden" name="skill" value={s.name} />
                            <input type="hidden" name="scope" value={scope.key} />
                            <button
                              type="submit"
                              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors ${
                                active
                                  ? "bg-brand text-brand-foreground ring-brand"
                                  : "bg-muted text-muted-foreground ring-black/5 hover:text-foreground"
                              }`}
                              title={active ? "Retirer cette portée" : "Activer cette portée"}
                            >
                              {scope.label}
                            </button>
                          </form>
                        );
                      },
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Catalogue */}
      <section>
        <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Catalogue · {available.length} skills
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {[...groupByCategory(available).entries()].map(([cat, skills]) => (
            <details key={cat} className="group rounded-[1.75rem] border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-4 [&::-webkit-details-marker]:hidden">
                <span className="font-semibold capitalize">{cat.replace(/-/g, " ")}</span>
                <span className="text-xs text-muted-foreground">
                  {skills.length} skill{skills.length > 1 ? "s" : ""}
                </span>
                <span className="ml-auto text-muted-foreground transition-transform duration-300 group-open:rotate-90">
                  ›
                </span>
              </summary>
              <div className="border-t">
                {skills.map((s, i) => (
                  <div
                    key={s.name}
                    className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3.5 ${i > 0 ? "border-t" : ""}`}
                  >
                    <code className="font-mono text-xs">{s.name.split("/")[1]}</code>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {s.description}
                    </span>
                    <InstallSkillButton name={s.name} />
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Organigramme Paperclip, mis à jour en direct */}
      <section>
        <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Organigramme · {pcAgents.length} agents Paperclip
        </h2>
        {pcAgents.length === 0 ? (
          <p className="mt-3 rounded-[1.75rem] border border-dashed px-6 py-6 text-center text-sm text-muted-foreground">
            Aucun agent dans l’organisation Paperclip.
          </p>
        ) : (
          <div className="mt-3 rounded-[1.75rem] border bg-card p-6">
            <div className="flex flex-col items-center">
              <span className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-white">
                Board · BLEME
              </span>
              <span className="my-2 h-5 w-px bg-border" aria-hidden />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {pcAgents.map((a) => {
                const persona = a.name.toLowerCase();
                const known = ["marius", "lena", "jeanne", "nora", "sacha", "basile"].includes(persona);
                return (
                  <div key={a.id} className="flex flex-col items-center rounded-2xl border bg-background p-3 text-center">
                    {known ? (
                      <span className="flex size-11 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-brand-soft to-brand/15 ring-1 ring-brand/20">
                        <SpriteAvatar src={`/agents/${persona}.webp`} alt="" className="h-9" />
                      </span>
                    ) : (
                      <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-sm font-bold">
                        {a.name[0]}
                      </span>
                    )}
                    <p className="mt-2 text-sm font-semibold">{a.name}</p>
                    <p className="text-[10px] leading-tight text-muted-foreground">{a.title ?? "—"}</p>
                    <span
                      className={`mt-1.5 rounded-full px-2 py-0.5 text-[9px] font-medium ring-1 ${
                        a.status === "error"
                          ? "bg-red-50 text-red-700 ring-red-200"
                          : a.status === "idle"
                            ? "bg-muted text-muted-foreground ring-black/5"
                            : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      }`}
                    >
                      {a.status === "idle" ? "en attente" : a.status}
                    </span>
                    {a.spentMonthlyCents > 0 || a.budgetMonthlyCents > 0 ? (
                      <p className="mt-1 text-[9px] tabular-nums text-muted-foreground">
                        {(a.spentMonthlyCents / 100).toLocaleString("fr-FR")} €
                        {a.budgetMonthlyCents > 0 ? ` / ${(a.budgetMonthlyCents / 100).toLocaleString("fr-FR")} €` : ""}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Ticketing Paperclip */}
      <section>
        <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Tickets · {pcIssues.filter((i) => i.status !== "done").length} ouverts
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {pcIssues.length > 0 ? (
            <div className="overflow-hidden rounded-[1.75rem] border bg-card">
              {pcIssues.slice(0, 12).map((issue, i) => {
                const assignee = pcAgents.find((a) => a.id === issue.assigneeAgentId);
                const persona = assignee?.name.toLowerCase();
                return (
                  <div
                    key={issue.id}
                    className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4 ${i > 0 ? "border-t" : ""}`}
                  >
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                        issue.status === "done"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : issue.status === "in_progress"
                            ? "bg-sky-50 text-sky-700 ring-sky-200"
                            : "bg-amber-50 text-amber-700 ring-amber-200"
                      }`}
                    >
                      {issue.status === "done" ? "clos" : issue.status === "in_progress" ? "en cours" : "ouvert"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{issue.title}</span>
                      {issue.description ? (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {issue.description}
                        </span>
                      ) : null}
                    </span>
                    {persona ? (
                      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium capitalize text-brand-strong">
                        {persona}
                      </span>
                    ) : null}
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {new Date(issue.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </span>
                    {issue.status !== "done" ? (
                      <form action={setTicketStatus}>
                        <input type="hidden" name="id" value={issue.id} />
                        <input type="hidden" name="status" value="done" />
                        <button
                          type="submit"
                          className="rounded-full border px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-emerald-300 hover:text-emerald-700"
                        >
                          Clore
                        </button>
                      </form>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-[1.75rem] border border-dashed px-6 py-6 text-center text-sm text-muted-foreground">
              Aucun ticket : les rapports de routines et vos tickets manuels
              apparaîtront ici.
            </p>
          )}
          <TicketCreateForm agents={agents} />
        </div>
      </section>

      {/* Routines : les crons des agents, dans les 2 sens (console ↔ Paperclip) */}
      <section>
        <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Routines · les crons des agents · {routinesRes.routines.length}
        </h2>
        <p className="mt-1 px-1 text-xs text-muted-foreground">
          Synchronisées avec Paperclip dans les deux sens : ce qui est créé
          ici apparaît là-bas, et inversement.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {routinesRes.routines.filter((r) => r.status !== "archived").length > 0 ? (
            <div className="overflow-hidden rounded-[1.75rem] border bg-card">
              {routinesRes.routines
                .filter((r) => r.status !== "archived")
                .map((r, i) => (
                  <div
                    key={r.id}
                    className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4 ${i > 0 ? "border-t" : ""}`}
                  >
                    <span
                      className={`size-2 shrink-0 rounded-full ${r.status === "active" ? "bg-emerald-500" : "bg-amber-400"}`}
                      title={r.status}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{r.title}</span>
                        {r.binding ? (
                          <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium capitalize text-brand-strong">
                            {r.binding.agent}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                            non assignée
                          </span>
                        )}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {r.triggers.filter((tr) => tr.kind === "schedule").map((tr) => tr.cronExpression).join(" · ") ||
                          "déclenchement manuel"}
                        {r.binding?.skills?.length
                          ? ` · skills : ${r.binding.skills.map((s) => s.split("/")[1]).join(", ")}`
                          : ""}
                      </span>
                    </span>
                    {r.binding ? <ExecuteRoutineButton id={r.id} title={r.title} /> : null}
                    <form action={setRoutineStatus}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value={r.status === "active" ? "paused" : "active"} />
                      <button
                        type="submit"
                        className={`rounded-full px-3 py-1.5 text-[11px] font-medium ring-1 transition-colors ${
                          r.status === "active"
                            ? "bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100"
                            : "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100"
                        }`}
                      >
                        {r.status === "active" ? "Mettre en pause" : "Activer"}
                      </button>
                    </form>
                    <form action={setRoutineStatus}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value="archived" />
                      <button
                        type="submit"
                        className="rounded-full border px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-red-300 hover:text-red-600"
                      >
                        Archiver
                      </button>
                    </form>
                  </div>
                ))}
            </div>
          ) : (
            <p className="rounded-[1.75rem] border border-dashed px-6 py-6 text-center text-sm text-muted-foreground">
              Aucune routine : créez la première ci-dessous, ou depuis le
              dashboard Paperclip.
            </p>
          )}
          <RoutineCreateForm
            agents={agents}
            skills={installed.map((s) => s.name)}
          />
        </div>
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground/80">
        La bibliothèque est installée sur le cerveau BLEME (isolé des autres
        instances Hermes du VPS) ; la portée de chaque skill se règle ici :
        « Commun aux 6 » ou agent par agent. À chaque requête, l’agent reçoit
        ses skills actives en savoir-faire de contexte. Les skills qui
        déclenchent des outils nécessitent en plus un modèle marqué
        « outils ✓ » dans le sélecteur.
      </p>
    </div>
  );
}
