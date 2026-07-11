import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { accessCan, getMyAccess } from "@/lib/permissions/server";
import { API_SCOPES } from "@/lib/api/scopes";
import { PageHeader } from "@/components/app/ui";
import { ApiKeysManager, type ApiKeyRow } from "@/components/app/api-keys";

export const metadata: Metadata = { title: "Clés API" };

export default async function ApiKeysPage() {
  const access = await getMyAccess();
  if (!access?.organizationId || !accessCan(access, "api.manage")) redirect("/app/parametres");

  const supabase = await createClient();
  // Scopé à l'org courante (celle sur laquelle create/revoke opèrent) : sans ce
  // filtre, la RLS listerait les clés de TOUTES les orgs où le membre a
  // api.manage, alors que les actions n'agissent que sur cette org-ci.
  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, scopes, last_used_at, created_at, revoked_at, expires_at")
    .eq("organization_id", access.organizationId)
    .order("created_at", { ascending: false })
    .returns<ApiKeyRow[]>();

  // Ne proposer que les droits que le créateur possède réellement (sinon un
  // scope demandé serait silencieusement retiré à la création).
  const availableScopes = API_SCOPES.filter((s) => accessCan(access, s.cap));

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/app/parametres"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Paramètres
      </Link>
      <PageHeader
        title="Clés API"
        sub="Connectez BLEME à vos outils. Une clé donne un accès en lecture, limité à votre organisation et aux droits que vous choisissez."
      />
      <ApiKeysManager keys={keys ?? []} availableScopes={availableScopes} />
    </div>
  );
}
