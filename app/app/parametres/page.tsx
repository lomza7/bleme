import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Cable, ShieldAlert, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/ui";
import { OrganizationForm, ProfileForm } from "@/components/app/settings-forms";
import { IntegrationConnections, type IntegrationInfo } from "@/components/app/settings-connections";

export const metadata: Metadata = { title: "Paramètres" };

export default async function ParametresPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: org }, { data: integrations }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
    supabase.from("organizations").select("name, siret").limit(1).maybeSingle(),
    supabase
      .from("org_integrations")
      .select("provider, status, company_name, last_sync_at, last_error")
      .returns<NonNullable<IntegrationInfo>[]>(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Paramètres"
        sub={`Connecté avec ${user.email}. Ces informations alimentent vos courriers.`}
      />

      <section className="rounded-[1.75rem] border bg-card p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
            <UserRound className="size-4.5" />
          </span>
          <h2 className="text-lg font-semibold">Mon profil</h2>
        </div>
        <div className="mt-6">
          <ProfileForm
            fullName={profile?.full_name ?? ""}
            phone={profile?.phone ?? ""}
          />
        </div>
      </section>

      <section className="rounded-[1.75rem] border bg-card p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
            <Building2 className="size-4.5" />
          </span>
          <h2 className="text-lg font-semibold">Mon entreprise</h2>
        </div>
        <div className="mt-6">
          <OrganizationForm name={org?.name ?? ""} siret={org?.siret ?? ""} />
        </div>
      </section>

      <section className="rounded-[1.75rem] border bg-card p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
            <Cable className="size-4.5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Connexions</h2>
            <p className="text-xs text-muted-foreground">
              Votre logiciel comptable, branché sur vos blèmes.
            </p>
          </div>
        </div>
        <div className="mt-6">
          <IntegrationConnections integrations={integrations ?? []} />
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-red-200 bg-red-50/50 p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-red-100 text-red-600">
            <ShieldAlert className="size-4.5" />
          </span>
          <h2 className="text-lg font-semibold">Zone sensible</h2>
        </div>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Supprimer votre compte efface définitivement vos dossiers,
          chronologies et documents sous 30 jours. Pensez à{" "}
          <Link href="/app/export" className="font-medium text-foreground underline underline-offset-2">
            exporter vos données
          </Link>{" "}
          d’abord. La suppression en self-service arrive ; en attendant,
          écrivez-nous et c’est fait sous 48 h.
        </p>
      </section>
    </div>
  );
}
