import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Calculator,
  Clock,
  Crown,
  Mail,
  Scale,
  Sparkles,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/ui";
import { InvitationActions, InviteButton } from "@/components/app/team-invite";

export const metadata: Metadata = { title: "Mon équipe" };

const ROLE_LABEL: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  member: "Membre",
};

const PRO = {
  accountant: { label: "Expert-comptable", icon: Calculator, tile: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  lawyer: { label: "Avocat", icon: Scale, tile: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
} as const;

function initialsOf(name: string): string {
  return (
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "B"
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default async function EquipePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: org }, { data: members }, { data: invitations }, { data: profile }] =
    await Promise.all([
      supabase.from("organizations").select("id, name").limit(1).maybeSingle(),
      supabase
        .from("organization_members")
        .select("id, role, user_id, created_at")
        .order("created_at"),
      supabase
        .from("invitations")
        .select(
          "id, kind, role, email, full_name, firm_name, phone, status, created_at, expires_at, token, accepted_user_id",
        )
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    ]);

  const myRole = members?.find((m) => m.user_id === user.id)?.role;
  const canGrantAdmin = myRole === "owner";

  // Identités des coéquipiers : profiles n'est lisible que pour soi et
  // auth.users est hors RLS → helper SECURITY DEFINER cloisonné à l'org. Repli
  // silencieux (« Membre ») tant que la fonction n'est pas déployée.
  type MemberDisplay = { user_id: string; full_name: string | null; email: string | null };
  const { data: memberDisplay } = org
    ? await supabase.rpc("org_members_display", { p_org: org.id })
    : { data: null };
  const displayByUser = new Map<string, MemberDisplay>(
    ((memberDisplay as MemberDisplay[] | null) ?? []).map((d) => [d.user_id, d]),
  );

  const invites = invitations ?? [];
  const teamInvites = invites.filter((i) => i.kind === "team" && i.status === "pending");
  const expertInvites = invites.filter(
    (i) => (i.kind === "accountant" || i.kind === "lawyer") && i.status === "pending",
  );
  // eslint-disable-next-line react-hooks/purity -- horodatage d'affichage des invitations expirées
  const now = Date.now();

  const memberRows = (members ?? []).map((m) => {
    const isMe = m.user_id === user.id;
    const disp = displayByUser.get(m.user_id);
    const name = isMe
      ? profile?.full_name?.trim() || user.email || "Vous"
      : disp?.full_name?.trim() || disp?.email?.split("@")[0] || "Membre";
    const email = isMe ? user.email : (disp?.email ?? "");
    return { id: m.id, role: m.role, name, email, isMe };
  });

  const teamCount = memberRows.length + teamInvites.length;

  return (
    <div className="flex flex-col gap-8 duration-500 animate-in fade-in-0">
      <PageHeader
        title="Mon équipe"
        sub={
          org?.name
            ? `Les personnes qui travaillent sur les dossiers de ${org.name} — et les experts qui vous accompagnent.`
            : "Invitez vos coéquipiers et les experts qui vous accompagnent."
        }
      >
        <InviteButton canGrantAdmin={canGrantAdmin} />
      </PageHeader>

      {/* ── Coéquipiers ─────────────────────────────────────────────────── */}
      <section
        style={{ animationDelay: "60ms" }}
        className="overflow-hidden rounded-[1.75rem] border bg-card duration-500 animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both"
      >
        <div className="flex items-center gap-3 border-b bg-gradient-to-b from-brand-soft/50 to-card px-6 py-5">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong ring-1 ring-brand/15">
            <Users className="size-5" strokeWidth={1.75} />
          </span>
          <div className="flex-1">
            <h2 className="font-semibold">Coéquipiers</h2>
            <p className="text-xs text-muted-foreground">
              {teamCount} personne{teamCount > 1 ? "s" : ""} sur votre espace
            </p>
          </div>
        </div>

        <div>
          {memberRows.map((m, i) => (
            <div
              key={m.id}
              style={{ animationDelay: `${120 + i * 45}ms` }}
              className="flex items-center justify-between gap-4 border-b px-6 py-4 duration-500 animate-in fade-in-0 fill-mode-both last:border-b-0"
            >
              <div className="flex min-w-0 items-center gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-strong">
                  {initialsOf(m.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {m.name}
                    {m.isMe ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">c’est vous</span>
                    ) : null}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{m.email}</p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {m.role === "owner" ? <Crown className="size-3 text-brand" /> : null}
                {ROLE_LABEL[m.role] ?? m.role}
              </span>
            </div>
          ))}

          {teamInvites.map((inv, i) => {
            const expired = new Date(inv.expires_at).getTime() < now;
            const who = inv.full_name?.trim() || inv.email;
            return (
              <div
                key={inv.id}
                style={{ animationDelay: `${120 + (memberRows.length + i) * 45}ms` }}
                className="flex items-center justify-between gap-3 border-b bg-muted/20 px-6 py-4 duration-500 animate-in fade-in-0 fill-mode-both last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-brand/40 bg-brand-soft/40 text-brand-strong">
                    <Mail className="size-4.5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{who}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {inv.full_name ? inv.email : `Invité·e le ${fmtDate(inv.created_at)}`}
                      {inv.role === "admin" ? " · Administrateur" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium sm:inline-flex ${
                      expired
                        ? "bg-muted text-muted-foreground"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    <Clock className="size-3" />
                    {expired ? "Expirée" : "En attente"}
                  </span>
                  <InvitationActions id={inv.id} kind="team" token={inv.token} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Experts externes ────────────────────────────────────────────── */}
      <section
        style={{ animationDelay: "140ms" }}
        className="overflow-hidden rounded-[1.75rem] border bg-card duration-500 animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both"
      >
        <div className="flex items-center gap-3 border-b px-6 py-5">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-ink text-ink-foreground">
            <Sparkles className="size-5" strokeWidth={1.75} />
          </span>
          <div className="flex-1">
            <h2 className="font-semibold">Vos experts</h2>
            <p className="text-xs text-muted-foreground">
              L’expert-comptable et l’avocat qui vous accompagnent
            </p>
          </div>
        </div>

        {expertInvites.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <div className="flex gap-2">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                <Calculator className="size-5" strokeWidth={1.75} />
              </span>
              <span className="flex size-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200">
                <Scale className="size-5" strokeWidth={1.75} />
              </span>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Invitez votre expert-comptable ou votre avocat : ils reçoivent un mot de votre
              part, et vous gardez leurs coordonnées à portée de main.
            </p>
          </div>
        ) : (
          <div>
            {expertInvites.map((inv, i) => {
              const meta = PRO[inv.kind as "accountant" | "lawyer"];
              const Icon = meta.icon;
              const expired = new Date(inv.expires_at).getTime() < now;
              const who = inv.full_name?.trim() || inv.email;
              return (
                <div
                  key={inv.id}
                  style={{ animationDelay: `${200 + i * 45}ms` }}
                  className="flex items-center justify-between gap-3 border-b px-6 py-4 duration-500 animate-in fade-in-0 fill-mode-both last:border-b-0"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${meta.tile}`}>
                      <Icon className="size-5" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{who}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {inv.firm_name ? `${inv.firm_name} · ` : ""}
                        {inv.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
                      {meta.label}
                      {expired ? " · expirée" : ""}
                    </span>
                    <InvitationActions id={inv.id} kind={inv.kind as "accountant" | "lawyer"} token={null} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        Les coéquipiers accèdent à vos dossiers et peuvent préparer les pièces et valider les
        envois. Les experts sont invités par email : ils n’ont pas accès à votre espace pour
        l’instant.
      </p>
    </div>
  );
}
