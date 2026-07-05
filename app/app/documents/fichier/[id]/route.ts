import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Télécharge un document via une URL signée courte (RLS appliquée). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path, file_name")
    .eq("id", id)
    .maybeSingle();
  if (!doc) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 60, { download: doc.file_name });
  if (error || !data) {
    return NextResponse.json({ error: "Lien indisponible" }, { status: 500 });
  }
  return NextResponse.redirect(data.signedUrl);
}
