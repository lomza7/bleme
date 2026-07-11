import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSecret } from "@/lib/secrets";
import { drainDue } from "@/lib/webhooks/deliver";

/*
 * Cron de reprise des livraisons de webhooks : rejoue les livraisons en échec
 * dont le backoff est écoulé (la 1ʳᵉ tentative, elle, part en temps réel via
 * after()). Même auth que compta-sync (Authorization: Bearer ${CRON_SECRET},
 * comparaison constant-time). Cadence QUOTIDIENNE sur Vercel Hobby — repasser
 * en fréquent (ex. toutes les 5 min) sur Vercel Pro pour des retries rapides.
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
  const processed = await drainDue(200);
  return NextResponse.json({ ok: true, processed });
}
