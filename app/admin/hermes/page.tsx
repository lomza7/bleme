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
import { getHermesOverview, type Skill } from "@/lib/admin/hermes-actions";
import { InstallSkillButton, RemoveSkillButton } from "@/components/admin/skills";
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
  const [overview, paperclipUrl] = await Promise.all([
    getHermesOverview(),
    getSecret("PAPERCLIP_URL"),
  ]);

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
          </dl>
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
            {installed.map((s, i) => (
              <div
                key={s.name}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4 ${i > 0 ? "border-t" : ""}`}
              >
                <code className="font-mono text-xs font-semibold">{s.name}</code>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {s.description}
                </span>
                <RemoveSkillButton name={s.name} />
              </div>
            ))}
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

      <p className="text-xs leading-relaxed text-muted-foreground/80">
        Les skills sont partagées par les 6 agents (bibliothèque commune du
        cerveau BLEME, isolée des autres instances Hermes du VPS). Les skills
        qui déclenchent des outils nécessitent un modèle OpenRouter routant le
        tool use (anthropic/*, openai/*…) — avec les modèles hermes-4, elles
        agissent comme savoir-faire de contexte.
      </p>
    </div>
  );
}
