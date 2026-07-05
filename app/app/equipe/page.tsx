import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Crown, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ComingSoonCard, PageHeader } from "@/components/app/ui";

export const metadata: Metadata = { title: "Mon équipe" };

const ROLES: Record<string, string> = {
  owner: "Propriétaire",
  member: "Membre",
  admin: "Admin",
};

export default async function EquipePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: org }, { data: members }] = await Promise.all([
    supabase.from("organizations").select("name").limit(1).maybeSingle(),
    supabase
      .from("organization_members")
      .select("id, role, user_id, created_at")
      .order("created_at"),
  ]);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Mon équipe"
        sub={org?.name ? `Les personnes qui travaillent sur les dossiers de ${org.name}.` : undefined}
      />

      <div className="overflow-hidden rounded-[1.75rem] border bg-card">
        {(members ?? []).map((m) => {
          const isMe = m.user_id === user.id;
          const name = isMe ? (profile?.full_name ?? user.email ?? "Vous") : "Membre";
          const initials = String(name)
            .split(/[\s@.]+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase())
            .join("");
          return (
            <div
              key={m.id}
              className="flex items-center justify-between gap-4 border-b px-6 py-5 last:border-b-0"
            >
              <div className="flex min-w-0 items-center gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-strong">
                  {initials || "B"}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {name}
                    {isMe ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        c’est vous
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {isMe ? user.email : ""}
                  </p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {m.role === "owner" ? <Crown className="size-3 text-brand" /> : null}
                {ROLES[m.role] ?? m.role}
              </span>
            </div>
          );
        })}
      </div>

      <ComingSoonCard icon={<UserPlus className="size-5" />} title="Inviter un collègue">
        Le multi-utilisateurs arrive : votre associé, votre conjoint qui gère
        l’admin ou votre comptable pourront suivre les dossiers, préparer les
        pièces et valider les envois, chacun avec son rôle.
      </ComingSoonCard>
    </div>
  );
}
