import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Export RGPD : toutes les données du compte au format JSON. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const [{ data: profile }, { data: organizations }, { data: cases }, { data: events }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("organizations").select("*"),
      supabase.from("cases").select("*").order("created_at"),
      supabase.from("case_events").select("*").order("event_date"),
    ]);

  const payload = {
    exporte_le: new Date().toISOString(),
    compte: { id: user.id, email: user.email },
    profil: profile,
    organisations: organizations,
    dossiers: cases,
    evenements: events,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="bleme-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
