import type { Metadata } from "next";
import { Calculator, Phone, Scale } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { LeadStatusSelect } from "@/components/admin/lead-status";

export const metadata: Metadata = { title: "Prospection" };

/*
 * Base de prospection : les experts-comptables et avocats mentionnés par les
 * utilisateurs quand ils invitent leurs experts. Alimentée par le trigger
 * capture_professional_lead à chaque invitation de professionnel. Lecture en
 * service-role (données trans-organisations) ; garde admin via le layout,
 * revérifiée ici.
 */

const PRO = {
  accountant: { label: "Expert-comptable", icon: Calculator, tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  lawyer: { label: "Avocat", icon: Scale, tone: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
} as const;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default async function ProspectionPage() {
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  const { data: me } = user
    ? await userClient.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_admin) return null;

  const service = createServiceClient();
  const { data: leads } = await service
    .from("professional_leads")
    .select(
      "id, profession, full_name, email, firm_name, phone, referral_count, outreach_status, source_organization_id, created_at",
    )
    .order("created_at", { ascending: false });

  const rows = leads ?? [];

  // Noms des organisations d'origine (résolus en une requête).
  const orgIds = [...new Set(rows.map((l) => l.source_organization_id).filter(Boolean))] as string[];
  const orgNames = new Map<string, string>();
  if (orgIds.length > 0) {
    const { data: orgs } = await service.from("organizations").select("id, name").in("id", orgIds);
    for (const o of orgs ?? []) orgNames.set(o.id, o.name);
  }

  const comptables = rows.filter((l) => l.profession === "accountant").length;
  const avocats = rows.filter((l) => l.profession === "lawyer").length;
  const interested = rows.filter(
    (l) => l.outreach_status === "interested" || l.outreach_status === "onboarded",
  ).length;

  const TILES = [
    { label: "Professionnels", value: rows.length, detail: "leads capturés" },
    { label: "Experts-comptables", value: comptables, detail: "mentionnés" },
    { label: "Avocats", value: avocats, detail: "mentionnés" },
    { label: "Chauds", value: interested, detail: "intéressés ou embarqués" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Prospection</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les experts-comptables et avocats que vos utilisateurs mentionnent en invitant leurs
          experts. Socle de la future place de marché — à démarcher.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((t) => (
          <div key={t.label} className="rounded-[1.5rem] border bg-card p-5">
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {t.value.toLocaleString("fr-FR")}
            </p>
            <p className="mt-1 text-xs font-medium">{t.label}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t.detail}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[1.75rem] border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun professionnel capturé pour l’instant. Dès qu’un utilisateur invite son
            expert-comptable ou son avocat, il apparaît ici.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[1.75rem] border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Professionnel</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium">Métier</th>
                  <th className="px-5 py-3 text-center font-medium">Mentions</th>
                  <th className="px-5 py-3 font-medium">Recommandé par</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((l) => {
                  const meta = PRO[l.profession as "accountant" | "lawyer"];
                  const Icon = meta.icon;
                  return (
                    <tr key={l.id} className="align-middle">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ${meta.tone}`}>
                            <Icon className="size-4.5" strokeWidth={1.75} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{l.full_name || "—"}</p>
                            {l.firm_name ? (
                              <p className="truncate text-xs text-muted-foreground">{l.firm_name}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <a
                          href={`mailto:${l.email}`}
                          className="block truncate text-brand-strong underline-offset-2 hover:underline"
                        >
                          {l.email}
                        </a>
                        {l.phone ? (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="size-3" />
                            {l.phone}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${meta.tone}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center tabular-nums text-muted-foreground">
                        {l.referral_count}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="truncate text-sm">
                          {l.source_organization_id
                            ? (orgNames.get(l.source_organization_id) ?? "—")
                            : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">{fmtDate(l.created_at)}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <LeadStatusSelect id={l.id} status={l.outreach_status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
