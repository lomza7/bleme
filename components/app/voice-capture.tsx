"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, Mic, PenLine, RotateCcw, Square } from "lucide-react";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";
import { TranscriptionModal } from "@/components/app/transcription-modal";

type State = "idle" | "recording" | "ready" | "manual";

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  return MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
}

/*
 * Récit vocal → transcription réelle. On enregistre, puis à « J'ai terminé » une
 * pop-up (TranscriptionModal) montre Nora écrire le récit à toute vitesse ; on
 * valide, et le transcript reste éditable à l'écrit. Sans clé STT → saisie texte.
 */
export function VoiceCapture({
  value,
  onChange,
  transcriber,
  light = true,
}: {
  value: string;
  onChange: (text: string) => void;
  /** Transcripteur injecté (anonyme via /api/voice/transcribe) ; défaut authentifié. */
  transcriber?: (blob: Blob) => Promise<{ transcript?: string; error?: string }>;
  /** true = fond clair (app), false = tunnel sombre (acquisition). */
  light?: boolean;
}) {
  const [state, setState] = useState<State>(value.trim() ? "manual" : "idle");
  const [seconds, setSeconds] = useState(0);
  const [text, setText] = useState(value);
  const [note, setNote] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null); // non-null → modal de transcription

  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
  }
  useEffect(() => cleanup, []);

  function setStory(v: string) {
    setText(v);
    onChange(v);
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      chunksRef.current = [];
      // Débit borné (32 kbps) : ~2 Mo pour 8 min → sous la limite de corps Vercel
      // (~4,5 Mo) pour la transcription anonyme, sans surcoût de qualité pour de la parole.
      const rec = new MediaRecorder(stream, {
        ...(MediaRecorder.isTypeSupported(mime) ? { mimeType: mime } : {}),
        audioBitsPerSecond: 32000,
      });
      recRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mime });
        cleanup();
        setBlob(b); // ouvre la pop-up de transcription
        setState("idle");
      };
      rec.start();
      setSeconds(0);
      setNote(null);
      // Arrêt auto à 8 min : garde-fou de taille + on ne demande pas un roman.
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          const n = s + 1;
          if (n >= 480 && recRef.current?.state === "recording") recRef.current.stop();
          return n;
        });
      }, 1000);
      setState("recording");
    } catch {
      setNote("Micro indisponible. Écrivez votre récit ci-dessous.");
      setState("manual");
    }
  }

  function stop() {
    recRef.current?.stop(); // déclenche onstop → ouvre la pop-up
  }

  function restart() {
    setStory("");
    setSeconds(0);
    setNote(null);
    setBlob(null);
    setState("idle");
  }

  // Thème : clair (app) vs sombre (tunnel d'acquisition).
  const cardCls = light ? "border bg-background" : "border border-white/10 bg-white/[0.06]";
  const mutedCls = light ? "text-muted-foreground" : "text-ink-muted";
  const linkCls = light
    ? "text-muted-foreground hover:text-foreground"
    : "text-ink-muted hover:text-ink-foreground";
  const fieldCls = light
    ? "border bg-background"
    : "border border-white/10 bg-white/[0.06] text-ink-foreground placeholder:text-ink-muted/60";

  const view = (() => {
    if (state === "idle") {
      return (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={start}
            className={`group flex w-full flex-col items-center gap-4 rounded-[1.5rem] px-8 py-10 text-center transition-all duration-300 hover:border-brand/50 ${cardCls}`}
          >
            <span className="relative flex size-16 items-center justify-center rounded-full bg-brand text-brand-foreground transition-transform duration-300 group-hover:scale-105">
              <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-brand/40 [animation-duration:2.2s] motion-reduce:hidden" />
              <Mic className="relative size-7" />
            </span>
            <span className="font-semibold">Appuyez et racontez votre blème</span>
            <span className={`max-w-sm text-sm leading-relaxed ${mutedCls}`}>
              Comme à un ami, 2 à 5 minutes. Nora transcrit tout, vous relisez ensuite.
            </span>
          </button>
          <button type="button" onClick={() => setState("manual")} className={`inline-flex items-center gap-2 self-start text-sm transition-colors ${linkCls}`}>
            <PenLine className="size-4" />
            Je préfère écrire
          </button>
        </div>
      );
    }

    if (state === "recording") {
      return (
        <div className={`rounded-[1.5rem] p-6 ${cardCls}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="relative flex size-3">
                <span className="absolute inline-flex size-3 animate-ping rounded-full bg-brand opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex size-3 rounded-full bg-brand" />
              </span>
              <span className="font-mono text-2xl font-semibold tabular-nums">{fmt(seconds)}</span>
              <span className={`text-sm ${mutedCls}`}>enregistrement…</span>
            </div>
            <button type="button" onClick={stop} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98]">
              <Square className="size-3.5" />
              J’ai terminé
            </button>
          </div>
          <p className={`mt-4 text-sm ${mutedCls}`}>Le contexte, les dates, les montants, où ça bloque. Plus vous en dites, plus le dossier est solide.</p>
        </div>
      );
    }

    // ready / manual → textarea éditable
    return (
      <div className="flex flex-col gap-2">
        {state === "ready" ? (
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <span className="flex size-6 items-center justify-center overflow-hidden rounded-lg bg-brand-soft">
                <SpriteAvatar src="/agents/nora.webp" alt="Nora" className="h-5" />
              </span>
              Transcrit — relisez et corrigez, votre version fait foi.
            </p>
            <button type="button" onClick={restart} className={`inline-flex items-center gap-1.5 text-sm transition-colors ${linkCls}`}>
              <RotateCcw className="size-3.5" />
              Réenregistrer
            </button>
          </div>
        ) : null}
        {note ? (
          <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800 ring-1 ring-amber-200">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            {note}
          </p>
        ) : null}
        <textarea
          autoFocus
          rows={7}
          value={text}
          onChange={(e) => setStory(e.target.value)}
          placeholder="La mission ou le chantier, ce qui était convenu, ce qui s’est passé, où ça bloque…"
          className={`w-full rounded-2xl p-4 text-sm leading-relaxed outline-none transition-colors focus:border-brand ${fieldCls}`}
        />
        {state === "manual" ? (
          <button type="button" onClick={restart} className={`inline-flex items-center gap-2 self-start text-sm transition-colors ${linkCls}`}>
            <Mic className="size-4" />
            Enregistrer à la voix plutôt
          </button>
        ) : null}
      </div>
    );
  })();

  return (
    <>
      {view}
      {blob ? (
        <TranscriptionModal
          blob={blob}
          transcriber={transcriber}
          onValidate={(t) => {
            setStory(t);
            setState("ready");
            setBlob(null);
          }}
          onManual={(n) => {
            setNote(n);
            setState("manual");
            setBlob(null);
          }}
          onRetry={() => {
            setBlob(null);
            setSeconds(0);
            setState("idle");
          }}
        />
      ) : null}
    </>
  );
}
