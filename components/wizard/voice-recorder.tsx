"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, RotateCcw, Square } from "lucide-react";

type RecState = "idle" | "recording" | "paused" | "done" | "denied";

const TARGET_SECONDS = 300; // jauge sur 5 min

function encouragement(s: number) {
  if (s < 30) return "Lancez-vous : le contexte, les dates, les montants.";
  if (s < 120) return "Bien. Qui, quand, combien : continuez.";
  if (s < 300)
    return "Parfait, c’est la bonne longueur. Ajoutez ce qui compte pour vous.";
  return "Vous pouvez conclure quand vous voulez, rien ne coupe.";
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function VoiceRecorder({
  onDone,
  onDenied,
  light,
}: {
  onDone: (seconds: number) => void;
  onDenied: () => void;
  light?: boolean;
}) {
  const [state, setState] = useState<RecState>("idle");
  const [seconds, setSeconds] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function cleanup() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    streamRef.current = null;
    recorderRef.current = null;
    audioCtxRef.current = null;
  }

  useEffect(() => cleanup, []);

  function drawLoop(analyser: AnalyserNode) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;

    const bars = 48;
    const render = () => {
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barW = canvas.width / bars;
      const brand = getComputedStyle(canvas).color;
      ctx.fillStyle = brand;
      for (let i = 0; i < bars; i++) {
        const v = data[Math.floor((i / bars) * data.length * 0.7)] / 255;
        const h = Math.max(canvas.height * 0.06, v * canvas.height);
        const x = i * barW;
        const y = (canvas.height - h) / 2;
        ctx.globalAlpha = 0.35 + v * 0.65;
        ctx.beginPath();
        ctx.roundRect(x + barW * 0.2, y, barW * 0.6, h, barW * 0.3);
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(render);
    };
    render();
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.start();

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      drawLoop(analyser);

      intervalRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
      setState("recording");
    } catch {
      setState("denied");
      onDenied();
    }
  }

  function pause() {
    recorderRef.current?.pause();
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState("paused");
  }

  function resume() {
    recorderRef.current?.resume();
    intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    setState("recording");
  }

  function stop() {
    recorderRef.current?.stop();
    cleanup();
    setState("done");
    onDone(seconds);
  }

  function reset() {
    cleanup();
    setSeconds(0);
    setState("idle");
  }

  const progress = Math.min(1, seconds / TARGET_SECONDS);
  const inTargetZone = seconds >= 120;

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={start}
        className={`group flex w-full flex-col items-center gap-5 rounded-[1.75rem] px-8 py-12 transition-all duration-500 ease-fluid hover:ring-brand/60 ${light ? "bg-card border hover:bg-brand-soft/60" : "bg-white/[0.05] ring-1 ring-white/10 hover:bg-white/[0.08]"}`}
      >
        <span className="relative flex size-20 items-center justify-center rounded-full bg-brand text-brand-foreground transition-transform duration-500 ease-fluid group-hover:scale-105">
          <span
            aria-hidden
            className="absolute inset-0 animate-ping rounded-full bg-brand/40 [animation-duration:2.2s] motion-reduce:hidden"
          />
          <Mic className="relative size-8" />
        </span>
        <span className="text-lg font-semibold">
          Appuyez et racontez votre blème
        </span>
        <span
          className={`max-w-sm text-center text-sm leading-relaxed ${light ? "text-muted-foreground" : "text-ink-muted"}`}
        >
          Comme vous le raconteriez à un ami. Visez 2 à 5 minutes : plus vous
          donnez de contexte, plus le dossier sera solide.
        </span>
      </button>
    );
  }

  if (state === "done") {
    return (
      <div
        className={`flex items-center justify-between gap-4 rounded-[1.75rem] px-7 py-6 ${light ? "bg-card border" : "bg-white/[0.05] ring-1 ring-white/10"}`}
      >
        <div className="flex items-center gap-4">
          <span className="flex size-11 items-center justify-center rounded-full bg-brand/15 text-brand">
            <Mic className="size-5" />
          </span>
          <div>
            <p className="font-medium">Récit enregistré · {fmt(seconds)}</p>
            <p
              className={`text-sm ${light ? "text-muted-foreground" : "text-ink-muted"}`}
            >
              L’IA l’analysera à la création du dossier.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all duration-300 ${light ? "bg-card border hover:bg-brand-soft/60" : "bg-white/[0.07] ring-1 ring-white/10 hover:bg-white/[0.12]"}`}
        >
          <RotateCcw className="size-4" />
          Recommencer
        </button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-[1.75rem] p-7 ${light ? "bg-card border" : "bg-white/[0.05] ring-1 ring-white/10"}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="relative flex size-3">
            {state === "recording" && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:hidden" />
            )}
            <span className="relative inline-flex size-3 rounded-full bg-brand" />
          </span>
          <span className="font-mono text-2xl font-semibold tabular-nums">
            {fmt(seconds)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {state === "recording" ? (
            <button
              type="button"
              onClick={pause}
              aria-label="Mettre en pause"
              className={`flex size-11 items-center justify-center rounded-full transition-all duration-300 ${light ? "bg-card border hover:bg-brand-soft/60" : "bg-white/[0.08] ring-1 ring-white/10 hover:bg-white/[0.14]"}`}
            >
              <Pause className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={resume}
              aria-label="Reprendre"
              className={`flex size-11 items-center justify-center rounded-full transition-all duration-300 ${light ? "bg-card border hover:bg-brand-soft/60" : "bg-white/[0.08] ring-1 ring-white/10 hover:bg-white/[0.14]"}`}
            >
              <Play className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
          >
            <Square className="size-3.5" />
            J’ai terminé
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="mt-6 h-16 w-full text-brand"
        aria-hidden
      />

      <div className="mt-6">
        <div
          className={`h-1.5 overflow-hidden rounded-full ${light ? "bg-card" : "bg-white/[0.08]"}`}
        >
          <div
            className="h-full rounded-full bg-brand transition-all duration-1000 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-4">
          <p
            className={`text-sm ${light ? "text-muted-foreground" : "text-ink-muted"}`}
          >
            {encouragement(seconds)}
          </p>
          <p
            className={`shrink-0 text-xs ${light ? "text-muted-foreground" : "text-ink-muted/70"}`}
          >
            {inTargetZone ? "Zone idéale atteinte" : "Objectif : 2 à 5 min"}
          </p>
        </div>
      </div>
    </div>
  );
}
