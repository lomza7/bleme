import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions/server";
import { buildDossierZip } from "@/lib/export/dossier-zip";

/** ZIP « dossier prêt pour un professionnel » : synthèse PDF + courriers + pièces. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!(await can("export.data"))) {
    return NextResponse.json({ error: "Droit insuffisant" }, { status: 403 });
  }

  const id = z.string().uuid().safeParse(request.nextUrl.searchParams.get("id"));
  if (!id.success) return NextResponse.json({ error: "Dossier invalide" }, { status: 400 });

  const res = await buildDossierZip(supabase, createServiceClient(), id.data);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 404 });

  return new NextResponse(new Uint8Array(res.buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${res.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
