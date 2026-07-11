import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  can as canCap,
  type Capability,
  type PermissionSet,
} from "@/lib/permissions/capabilities";

/*
 * Accès du membre courant : rôle + jeu de capacités effectif, dérivés de
 * organization_members. Sert à gater l'UI (masquer/désactiver) ET les actions
 * serveur (requireCap avant toute écriture/envoi). La barrière DURE reste la
 * RLS/fonction has_capability en base ; ce helper est la couche applicative.
 */

export type MyAccess = {
  userId: string;
  email: string | null;
  organizationId: string | null;
  role: string;
  permissions: PermissionSet;
};

export async function getMyAccess(): Promise<MyAccess | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!org) {
    return { userId: user.id, email: user.email ?? null, organizationId: null, role: "member", permissions: {} };
  }

  const { data: m } = await supabase
    .from("organization_members")
    .select("role, permissions")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? null,
    organizationId: org.id,
    role: m?.role ?? "member",
    permissions: (m?.permissions as PermissionSet | null) ?? {},
  };
}

export function accessCan(access: MyAccess | null, cap: Capability): boolean {
  if (!access) return false;
  return canCap(access.role, access.permissions, cap);
}

/** Raccourci : le membre courant a-t-il cette capacité ? */
export async function can(cap: Capability): Promise<boolean> {
  return accessCan(await getMyAccess(), cap);
}

/*
 * Accès du membre courant dans UNE org précise (pas la « première » adhésion).
 * Indispensable pour gater une action sur une ressource dont l'org est connue
 * (ex. envoi d'un courrier : l'autorisation doit être évaluée dans l'org du
 * dossier, jamais dans une org arbitraire d'un membre multi-org).
 */
export async function getAccessForOrg(orgId: string): Promise<MyAccess | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: m } = await supabase
    .from("organization_members")
    .select("role, permissions")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!m) return null; // pas membre de cette org
  return {
    userId: user.id,
    email: user.email ?? null,
    organizationId: orgId,
    role: m.role ?? "member",
    permissions: (m.permissions as PermissionSet | null) ?? {},
  };
}

/** Le membre courant a-t-il cette capacité DANS cette org précise ? */
export async function canForOrg(orgId: string, cap: Capability): Promise<boolean> {
  return accessCan(await getAccessForOrg(orgId), cap);
}

/** Garde d'action serveur : lève si la capacité manque. Renvoie l'accès sinon. */
export async function requireCap(cap: Capability): Promise<MyAccess> {
  const access = await getMyAccess();
  if (!accessCan(access, cap)) {
    throw new Error("Vous n'avez pas le droit d'effectuer cette action.");
  }
  return access as MyAccess;
}
