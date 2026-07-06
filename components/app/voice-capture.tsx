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
}: {
  value: string;
  onChange: (text: string) => void;
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
      const rec = new MediaRecorder(stream, MediaRecorder.isTypeSupported(mime) ? { mimeType: mime } : undefined);
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
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
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

  const view = (() => {
    if (state === "idle") {
      return (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={start}
            className="group flex w-full flex-col items-center gap-4 rounded-[1.5rem] border bg-background px-8 py-10 text-center transition-all duration-300 hover:border-brand/50 hover:bg-brand-soft/30"
          >
            <span className="relative flex size-16 items-center justify-center rounded-full bg-brand text-brand-foreground transition-transform duration-300 group-hover:scale-105">
              <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-brand/40 [animation-duration:2.2s] motion-reduce:hidden" />
              <Mic className="relative size-7" />
            </span>
            <span className="font-semibold">Appuyez et racontez votre blème</span>
            <span className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Comme à un ami, 2 à 5 minutes. Nora transcrit tout, vous relisez ensuite.
            </span>
          </button>
          <button type="button" onClick={() => setState("manual")} className="inline-flex items-center gap-2 self-start text-sm text-muted-foreground transition-colors hover:text-foreground">
            <PenLine className="size-4" />
            Je préfère écrire
          </button>
        </div>
      );
    }

    if (state === "recording") {
      return (
        <div className="rounded-[1.5rem] border bg-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="relative flex size-3">
                <span className="absolute inline-flex size-3 animate-ping rounded-full bg-brand opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex size-3 rounded-full bg-brand" />
              </span>
              <span className="font-mono text-2xl font-semibold tabular-nums">{fmt(seconds)}</span>
              <span className="text-sm text-muted-foreground">enregistrement…</span>
            </div>
            <button type="button" onClick={stop} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98]">
              <Square className="size-3.5" />
              J’ai terminé
            </button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Le contexte, les dates, les montants, où ça bloque. Plus vous en dites, plus le dossier est solide.</p>
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
            <button type="button" onClick={restart} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
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
          className="w-full rounded-2xl border bg-background p-4 text-sm leading-relaxed outline-none transition-colors focus:border-brand"
        />
        {state === "manual" ? (
          <button type="button" onClick={restart} className="inline-flex items-center gap-2 self-start text-sm text-muted-foreground transition-colors hover:text-foreground">
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
