/*
 * Transcripteur ANONYME côté client (tunnel pré-signup) : POST direct de l'audio
 * vers /api/voice/transcribe (endpoint public borné). Même forme de retour que
 * le pipeline authentifié → interchangeable dans TranscriptionModal/VoiceCapture.
 */
export async function transcribePublic(
  blob: Blob,
): Promise<{ transcript?: string; error?: string }> {
  try {
    const res = await fetch("/api/voice/transcribe", {
      method: "POST",
      headers: { "content-type": blob.type || "audio/webm" },
      body: blob,
    });
    if (res.status === 429) return { error: "rate_limited" };
    if (res.status === 413) return { error: "too_large" };
    if (!res.ok) return { error: "failed" };
    const d = (await res.json().catch(() => ({}))) as { transcript?: string; error?: string };
    return d.transcript ? { transcript: d.transcript } : { error: d.error || "failed" };
  } catch {
    return { error: "failed" };
  }
}
