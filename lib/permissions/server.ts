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

/** Garde d'action serveur : lève si la capacité manque. Renvoie l'accès sinon. */
export async function requireCap(cap: Capability): Promise<MyAccess> {
  const access = await getMyAccess();
  if (!accessCan(access, cap)) {
    throw new Error("Vous n'avez pas le droit d'effectuer cette action.");
  }
  return access as MyAccess;
}
