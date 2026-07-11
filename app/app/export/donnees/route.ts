import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions/server";

/** Export RGPD : toutes les données du compte au format JSON. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!(await can("export.data"))) {
    return NextResponse.json({ error: "Droit insuffisant" }, { status: 403 });
  }

  const [
    { data: profile },
    { data: organizations },
    { data: cases },
    { data: events },
    { data: letters },
    { data: documents },
    { data: approvals },
    { data: replies },
    { data: invitations },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("organizations").select("*"),
    supabase.from("cases").select("*").order("created_at"),
    supabase.from("case_events").select("*").order("event_date"),
    supabase
      .from("letters")
      .select("id, case_id, kind, status, subject, body_md, channel, content_sha256, approved_at, sent_at, created_at")
      .order("created_at"),
    supabase
      .from("documents")
      .select("id, case_id, file_name, mime_type, size_bytes, doc_class, created_at")
      .order("created_at"),
    supabase.from("approval_logs").select("*").order("created_at"),
    supabase.from("debtor_replies").select("*").order("received_at"),
    supabase
      .from("invitations")
      .select("id, kind, role, email, full_name, firm_name, status, created_at, accepted_at")
      .order("created_at"),
  ]);

  const payload = {
    exporte_le: new Date().toISOString(),
    compte: { id: user.id, email: user.email },
    profil: profile,
    organisations: organizations,
    dossiers: cases,
    evenements: events,
    courriers: letters,
    pieces: documents,
    preuves_de_validation: approvals,
    retours_client: replies,
    invitations,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="bleme-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
