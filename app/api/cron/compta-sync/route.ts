import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSecret } from "@/lib/secrets";
import { syncPennylaneOrg } from "@/lib/integrations/sync";

/*
 * Cron de synchronisation comptable (première infra cron du projet —
 * vercel.json, horaire). Vercel appelle ce endpoint avec le header
 * `Authorization: Bearer ${CRON_SECRET}` (variable d'env du projet ; on la
 * résout via le coffre comme partout). Chaque organisation connectée est
 * synchronisée (changelogs Pennylane → upsert + détections) ; les erreurs
 * d'une org n'empêchent pas les autres.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function secretsMatch(got: string, expected: string): boolean {
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request): Promise<Response> {
  const expected = await getSecret("CRON_SECRET");
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !got || !secretsMatch(got, expected)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const sb = createServiceClient();
  const startedAt = Date.now();
  // Les plus anciennes synchros d'abord ; bornage par run (la suivante
  // reprendra) pour rester dans la fenêtre d'exécution.
  const { data: integrations } = await sb
    .from("org_integrations")
    .select("id, organization_id, provider, status, sync_cursor")
    .neq("status", "disconnected")
    .order("last_sync_at", { ascending: true, nullsFirst: true })
    .limit(25);

  let ok = 0;
  let failed = 0;
  for (const integration of integrations ?? []) {
    // Budget temps : on ne démarre pas une org à moins de 60 s de la limite.
    if (Date.now() - startedAt > (maxDuration - 60) * 1000) break;
    // « Claim » avant de lancer : si ce run est tué en plein import, l'org
    // passe quand même en fin de file — une org trop lourde ne peut pas
    // affamer toutes les autres à chaque passage.
    await sb
      .from("org_integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", integration.id);
    const res = await syncPennylaneOrg(sb, integration);
    if (res.ok) ok++;
    else failed++;
  }
  return NextResponse.json({ ok, failed, total: (integrations ?? []).length });
}
