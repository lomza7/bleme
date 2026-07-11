import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions/server";
import { buildComptaCsv, fetchComptaCases, withinPeriod, type Period } from "@/lib/export/comptable";

/** Export comptable CSV : encaissements + indemnités par période. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!(await can("export.data"))) {
    return NextResponse.json({ error: "Droit insuffisant" }, { status: 403 });
  }

  const raw = request.nextUrl.searchParams.get("periode");
  const period: Period = raw === "annee" || raw === "tout" ? raw : "mois";

  const now = Date.now();
  const cases = (await fetchComptaCases(supabase)).filter((c) => withinPeriod(c, period, now));
  const csv = buildComptaCsv(cases);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bleme-compta-${period}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
