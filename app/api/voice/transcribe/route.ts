import { NextResponse } from "next/server";
import { transcribe } from "@/lib/transcription/stt";
import { allowAnonTranscribe } from "@/lib/transcription/rate-limit";

/*
 * Transcription vocale ANONYME (tunnel d'acquisition /nouveau, pré-signup).
 * Endpoint public — non authentifié par nature — donc BORNÉ : rate-limit par IP
 * (peppée) + plafond de taille. Réutilise le moteur STT (Groq/Deepgram/OpenAI)
 * sans org. Échoue en douceur (l'UI retombe sur la saisie texte) sauf 429/413.
 * Le pipeline authentifié (org) passe, lui, par lib/transcription/actions.ts.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // < limite de corps Vercel (~4,5 Mo)

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  try {
    if (!(await allowAnonTranscribe(ip))) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) {
      return NextResponse.json({ error: "too_large" }, { status: 413 });
    }
    const mime = req.headers.get("content-type") || "audio/webm";
    const result = await transcribe(new Blob([buf], { type: mime }), mime);
    // 200 même sans provider/échec doux → l'UI bascule proprement sur le texte.
    if (!result) return NextResponse.json({ error: "no_provider" }, { status: 200 });
    return NextResponse.json({ transcript: result.text }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 200 });
  }
}
