import "server-only";
import { getSecret } from "@/lib/secrets";

/*
 * Transcription vocale (STT), agnostique du fournisseur. On essaie, dans l'ordre,
 * les clés présentes dans le coffre (/admin/cles) : Groq (Whisper large-v3, FR,
 * rapide, quasi gratuit — recommandé), puis Deepgram (nova-2), puis OpenAI
 * (gpt-4o-transcribe). Aucune clé → null (l'UI retombe sur la saisie texte).
 * Tout échoue en silence côté produit : le parcours n'est jamais bloqué.
 */

export type Transcription = { text: string; provider: string };

export async function transcribe(blob: Blob, mime: string): Promise<Transcription | null> {
  const type = mime || blob.type || "audio/webm";

  // 1) Groq — Whisper large-v3 (OpenAI-compatible), français, ultra rapide.
  const groq = await getSecret("GROQ_API_KEY");
  if (groq) {
    try {
      const form = new FormData();
      form.append("file", new File([blob], "recit.webm", { type }));
      form.append("model", "whisper-large-v3");
      form.append("language", "fr");
      form.append("response_format", "text");
      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groq}` },
        body: form,
        signal: AbortSignal.timeout(60000),
      });
      if (res.ok) {
        const text = (await res.text()).trim();
        if (text) return { text, provider: "groq:whisper-large-v3" };
      }
    } catch {
      /* fournisseur suivant */
    }
  }

  // 2) Deepgram — nova-2 (envoi des octets bruts).
  const dg = await getSecret("DEEPGRAM_API_KEY");
  if (dg) {
    try {
      const res = await fetch(
        "https://api.deepgram.com/v1/listen?model=nova-2&language=fr&smart_format=true&punctuate=true",
        {
          method: "POST",
          headers: { Authorization: `Token ${dg}`, "Content-Type": type },
          body: blob,
          signal: AbortSignal.timeout(60000),
        },
      );
      if (res.ok) {
        const d = await res.json();
        const text: string = d?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
        if (text) return { text, provider: "deepgram:nova-2" };
      }
    } catch {
      /* fournisseur suivant */
    }
  }

  // 3) OpenAI — gpt-4o-transcribe (OpenAI-compatible).
  const oa = await getSecret("OPENAI_API_KEY");
  if (oa) {
    try {
      const form = new FormData();
      form.append("file", new File([blob], "recit.webm", { type }));
      form.append("model", "gpt-4o-transcribe");
      form.append("language", "fr");
      form.append("response_format", "text");
      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${oa}` },
        body: form,
        signal: AbortSignal.timeout(60000),
      });
      if (res.ok) {
        const text = (await res.text()).trim();
        if (text) return { text, provider: "openai:gpt-4o-transcribe" };
      }
    } catch {
      /* rien de plus */
    }
  }

  return null;
}
