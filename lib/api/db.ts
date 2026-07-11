import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/*
 * Frontière de contournement RLS de l'API publique. Une requête API est
 * authentifiée par clé et exécutée en service-role (RLS inerte) : CHAQUE
 * requête DOIT être filtrée par l'organisation de la clé. Ce wrapper renvoie
 * des builders déjà filtrés par organization_id — les handlers ne construisent
 * jamais un accès non scopé. (Une règle ESLint interdit createServiceClient
 * directement sous app/api/v1.)
 */
export function orgDb(orgId: string) {
  const sb = createServiceClient();
  return {
    orgId,
    /** SELECT déjà filtré par org — on chaîne ensuite eq/order/limit/… */
    select(table: string, columns = "*") {
      return sb.from(table).select(columns).eq("organization_id", orgId);
    },
    /** INSERT avec organization_id FORCÉ (jamais depuis le body). */
    insert(table: string, row: Record<string, unknown>) {
      return sb.from(table).insert({ ...row, organization_id: orgId });
    },
    /** UPDATE déjà filtré par org. */
    update(table: string, patch: Record<string, unknown>) {
      return sb.from(table).update(patch).eq("organization_id", orgId);
    },
    /** RPC (ex. upsert idempotent). L'appelant reste responsable du scoping. */
    rpc(fn: string, args: Record<string, unknown>) {
      return sb.rpc(fn, args);
    },
  };
}
