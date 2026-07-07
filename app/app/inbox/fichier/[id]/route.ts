import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Télécharge une pièce jointe d'email via une URL signée courte (RLS appliquée :
 * un utilisateur ne peut ouvrir que les pièces jointes de son organisation). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: att } = await supabase
    .from("inbox_attachments")
    .select("storage_path, file_name")
    .eq("id", id)
    .maybeSingle();
  if (!att) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(att.storage_path, 60, { download: att.file_name });
  if (error || !data) {
    return NextResponse.json({ error: "Lien indisponible" }, { status: 500 });
  }
  return NextResponse.redirect(data.signedUrl);
}
