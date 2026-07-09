"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Camera,
  Check,
  CircleAlert,
  CircleCheck,
  Contrast,
  LoaderCircle,
  Plus,
  RotateCcw,
  ScanLine,
  Send,
  Trash2,
  Wand2,
  X,
  Zap,
  ZapOff,
} from "lucide-react";
import {
  insetQuad,
  orderQuad,
  outputSize,
  warpPerspective,
  type Point,
  type Quad,
} from "@/lib/scan/geometry";
import { detectDocumentQuad, meanLuminance } from "@/lib/scan/detect";
import { assessQuality, QUALITY_ANALYSIS_WIDTH, type QualityReport } from "@/lib/scan/quality";
import { enhanceDocument, type EnhanceMode } from "@/lib/scan/enhance";
import { buildPdfFromJpegs } from "@/lib/scan/pdf";

const EASE = [0.16, 1, 0.3, 1] as const;
/** Largeur de la vignette d'analyse temps réel (coût ~1 ms par frame). */
const LIVE_DETECT_WIDTH = 200;
/** Largeur de détection au moment de la capture (plus précise, une seule fois). */
const CAPTURE_DETECT_WIDTH = 360;

type Phase = "camera" | "adjust" | "processing" | "result" | "pages";
type ScannedPage = { blob: Blob; url: string };
type ScanResult = { blob: Blob; url: string; report: QualityReport };

/*
 * Scanner de document plein écran, façon application de scan native :
 * caméra arrière → détection automatique des contours en direct → capture →
 * réglage des 4 coins → redressement de perspective → contrôle qualité
 * (netteté, lumière, reflets) AVANT envoi → multi-pages assemblées en PDF.
 * Tout le traitement est local (Canvas) : rien ne part tant que l'utilisateur
 * n'a pas terminé, et une photo illisible est arrêtée à la source.
 */
export function DocumentScanner({
  onComplete,
  onClose,
}: {
  onComplete: (file: File) => void;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("camera");
  const [error, setError] = useState<string | null>(null);

  // — Caméra
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [videoDims, setVideoDims] = useState<{ w: number; h: number } | null>(null);
  const [liveQuad, setLiveQuad] = useState<Quad | null>(null);
  const [liveHint, setLiveHint] = useState("Cadrez le document bien à plat");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // — Capture et recadrage
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragIdxRef = useRef<number | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [dispSize, setDispSize] = useState<{ w: number; h: number } | null>(null);
  const [quad, setQuad] = useState<Quad | null>(null);

  // — Résultat et pages
  const rawWarpedRef = useRef<{ data: ImageData; report: QualityReport } | null>(null);
  const [mode, setMode] = useState<EnhanceMode>("couleur");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  // Toutes les object URLs créées, révoquées au démontage (fuites mémoire).
  const urlsRef = useRef<Set<string>>(new Set());
  const makeUrl = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urlsRef.current.add(url);
    return url;
  }, []);
  const dropUrl = useCallback((url: string | null) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    urlsRef.current.delete(url);
  }, []);
  useEffect(() => {
    const urls = urlsRef.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  // ————————————————————————————— Caméra —————————————————————————————

  useEffect(() => {
    if (phase !== "camera") return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        // Caméra arrière, résolution max raisonnable : le document redressé
        // doit rester net pour la lecture vision de Nora.
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 3264 },
            height: { ideal: 2448 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as ({ torch?: boolean } | undefined);
        setTorchSupported(Boolean(caps?.torch));
      } catch {
        setError(
          "Impossible d'accéder à la caméra. Autorisez l'accès dans votre navigateur, ou déposez un fichier classique.",
        );
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setTorchOn(false);
      setVideoDims(null);
      setLiveQuad(null);
    };
  }, [phase]);

  // Boucle de détection temps réel : contours + indice lumière sur une
  // vignette, ~3 fois par seconde — le flux vidéo reste fluide.
  useEffect(() => {
    if (phase !== "camera") return;
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) return;
      if (!liveCanvasRef.current) liveCanvasRef.current = document.createElement("canvas");
      const canvas = liveCanvasRef.current;
      const scale = LIVE_DETECT_WIDTH / video.videoWidth;
      canvas.width = LIVE_DETECT_WIDTH;
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const found = detectDocumentQuad(img);
      setLiveQuad(
        found
          ? (found.map((p) => ({ x: p.x / scale, y: p.y / scale })) as unknown as Quad)
          : null,
      );
      if (meanLuminance(img) < 60) setLiveHint("Manque de lumière — rapprochez-vous d'une source");
      else if (found) setLiveHint("Document détecté — capturez");
      else setLiveHint("Cadrez le document bien à plat");
    }, 350);
    return () => clearInterval(timer);
  }, [phase]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn((v) => !v);
    } catch {
      setTorchSupported(false);
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = frameCanvasRef.current ?? document.createElement("canvas");
    frameCanvasRef.current = canvas;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    // Détection plus fine sur l'image figée pour préremplir le cadrage.
    const scale = CAPTURE_DETECT_WIDTH / canvas.width;
    const small = document.createElement("canvas");
    small.width = CAPTURE_DETECT_WIDTH;
    small.height = Math.max(1, Math.round(canvas.height * scale));
    const sctx = small.getContext("2d", { willReadFrequently: true });
    let detected: Quad | null = null;
    if (sctx) {
      sctx.drawImage(canvas, 0, 0, small.width, small.height);
      const found = detectDocumentQuad(sctx.getImageData(0, 0, small.width, small.height));
      if (found) detected = found.map((p) => ({ x: p.x / scale, y: p.y / scale })) as unknown as Quad;
    }

    rawWarpedRef.current = null;
    setImgDims({ w: canvas.width, h: canvas.height });
    setQuad(detected ?? insetQuad(canvas.width, canvas.height));
    canvas.toBlob(
      (blob) => {
        if (!blob) return setError("Capture impossible. Réessayez.");
        setCapturedUrl((prev) => {
          dropUrl(prev);
          return makeUrl(blob);
        });
        setPhase("adjust");
      },
      "image/jpeg",
      0.92,
    );
  }

  // ———————————————————————— Réglage des coins ————————————————————————

  useEffect(() => {
    if (phase !== "adjust") return;
    const img = imgRef.current;
    if (!img) return;
    const ro = new ResizeObserver(() => {
      if (img.clientWidth && img.clientHeight) setDispSize({ w: img.clientWidth, h: img.clientHeight });
    });
    ro.observe(img);
    return () => ro.disconnect();
  }, [phase, capturedUrl]);

  const toImageCoords = useCallback(
    (e: React.PointerEvent<SVGSVGElement>): Point | null => {
      if (!imgDims || !dispSize) return null;
      const rect = e.currentTarget.getBoundingClientRect();
      const scale = imgDims.w / rect.width;
      return {
        x: Math.max(0, Math.min(imgDims.w, (e.clientX - rect.left) * scale)),
        y: Math.max(0, Math.min(imgDims.h, (e.clientY - rect.top) * scale)),
      };
    },
    [imgDims, dispSize],
  );

  function onCornerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!quad || !imgDims || !dispSize) return;
    const pos = toImageCoords(e);
    if (!pos) return;
    // Coin le plus proche, dans un rayon généreux (~36 px écran) pour le pouce.
    const grabRadius = (36 * imgDims.w) / dispSize.w;
    let best = -1;
    let bestDist = grabRadius;
    quad.forEach((p, i) => {
      const d = Math.hypot(p.x - pos.x, p.y - pos.y);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best < 0) return;
    dragIdxRef.current = best;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onCornerMove(e: React.PointerEvent<SVGSVGElement>) {
    const idx = dragIdxRef.current;
    if (idx === null) return;
    const pos = toImageCoords(e);
    if (!pos) return;
    setQuad((q) => {
      if (!q) return q;
      const next = [...q] as Quad;
      next[idx] = pos;
      return next;
    });
  }

  function redetect() {
    const canvas = frameCanvasRef.current;
    if (!canvas || !imgDims) return;
    const scale = CAPTURE_DETECT_WIDTH / canvas.width;
    const small = document.createElement("canvas");
    small.width = CAPTURE_DETECT_WIDTH;
    small.height = Math.max(1, Math.round(canvas.height * scale));
    const sctx = small.getContext("2d", { willReadFrequently: true });
    if (!sctx) return;
    sctx.drawImage(canvas, 0, 0, small.width, small.height);
    const found = detectDocumentQuad(sctx.getImageData(0, 0, small.width, small.height));
    setQuad(
      found
        ? (found.map((p) => ({ x: p.x / scale, y: p.y / scale })) as unknown as Quad)
        : insetQuad(imgDims.w, imgDims.h, 0.02),
    );
  }

  // —————————————————— Redressement + contrôle qualité ——————————————————

  async function processCapture(nextMode: EnhanceMode) {
    const canvas = frameCanvasRef.current;
    if (!canvas || !quad) return;
    setPhase("processing");
    // Laisse le spinner se peindre avant le calcul bloquant.
    await new Promise((r) => setTimeout(r, 30));
    try {
      let raw = rawWarpedRef.current;
      if (!raw) {
        const ordered = orderQuad([...quad]);
        const { width, height } = outputSize(ordered);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("no-context");
        const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const warped = warpPerspective(src, ordered, width, height);
        if (!warped) throw new Error("degenerate-quad");
        // Qualité mesurée sur l'image BRUTE redressée (avant amélioration) :
        // c'est la lisibilité optique réelle — un flou reste un flou même
        // contrasté. Ramenée à une largeur fixe, les seuils en dépendent.
        const qw = Math.min(QUALITY_ANALYSIS_WIDTH, width);
        const qh = Math.max(1, Math.round((height * qw) / width));
        const qCanvas = document.createElement("canvas");
        qCanvas.width = width;
        qCanvas.height = height;
        qCanvas.getContext("2d")?.putImageData(warped, 0, 0);
        const qSmall = document.createElement("canvas");
        qSmall.width = qw;
        qSmall.height = qh;
        const qctx = qSmall.getContext("2d", { willReadFrequently: true });
        if (!qctx) throw new Error("no-context");
        qctx.drawImage(qCanvas, 0, 0, qw, qh);
        const report = assessQuality(qctx.getImageData(0, 0, qw, qh), { width, height });
        raw = { data: warped, report };
        rawWarpedRef.current = raw;
      }
      const work = new ImageData(
        new Uint8ClampedArray(raw.data.data),
        raw.data.width,
        raw.data.height,
      );
      enhanceDocument(work, nextMode);
      const out = document.createElement("canvas");
      out.width = work.width;
      out.height = work.height;
      out.getContext("2d")?.putImageData(work, 0, 0);
      const blob = await new Promise<Blob | null>((res) => out.toBlob(res, "image/jpeg", 0.85));
      if (!blob) throw new Error("encode-failed");
      const report = raw.report;
      setResult((prev) => {
        dropUrl(prev?.url ?? null);
        return { blob, url: makeUrl(blob), report };
      });
      setMode(nextMode);
      setPhase("result");
    } catch {
      setError("Le traitement de l'image a échoué. Reprenez la photo.");
      setPhase("adjust");
    }
  }

  // ——————————————————————— Pages et envoi ———————————————————————

  function retake() {
    rawWarpedRef.current = null;
    setResult((prev) => {
      dropUrl(prev?.url ?? null);
      return null;
    });
    setError(null);
    setPhase("camera");
  }

  function keepPage() {
    if (!result) return;
    setPages((p) => [...p, { blob: result.blob, url: result.url }]);
    setResult(null);
    rawWarpedRef.current = null;
    setPhase("pages");
  }

  function removePage(index: number) {
    setPages((p) => {
      dropUrl(p[index]?.url ?? null);
      return p.filter((_, i) => i !== index);
    });
  }

  async function finish() {
    if (pages.length === 0 || finishing) return;
    setFinishing(true);
    try {
      const stamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, "-");
      const file =
        pages.length === 1
          ? new File([pages[0].blob], `scan-${stamp}.jpg`, { type: "image/jpeg" })
          : new File(
              [await buildPdfFromJpegs(pages.map((p) => p.blob))],
              `scan-${stamp}.pdf`,
              { type: "application/pdf" },
            );
      onComplete(file);
    } catch {
      setError("Impossible d'assembler le document. Réessayez.");
      setFinishing(false);
    }
  }

  const attemptClose = useCallback(() => {
    if (pages.length > 0 || result || phase === "adjust") setConfirmExit(true);
    else onClose();
  }, [pages.length, result, phase, onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") attemptClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [attemptClose]);

  // ————————————————————————————— Rendu —————————————————————————————

  const scaleX = imgDims && dispSize ? dispSize.w / imgDims.w : 1;
  const scaleY = imgDims && dispSize ? dispSize.h / imgDims.h : 1;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Scanner un document"
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
    >
      {/* Barre du haut */}
      <div className="flex items-center justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          onClick={attemptClose}
          aria-label="Fermer le scanner"
          className="rounded-full bg-white/10 p-2.5 transition-colors hover:bg-white/20"
        >
          <X className="size-5" />
        </button>
        <p className="flex items-center gap-2 text-sm font-medium">
          <ScanLine className="size-4 text-brand" />
          Scanner un document
          {pages.length > 0 ? (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">
              {pages.length} page{pages.length > 1 ? "s" : ""}
            </span>
          ) : null}
        </p>
        {phase === "camera" && torchSupported ? (
          <button
            onClick={toggleTorch}
            aria-label={torchOn ? "Éteindre la lampe" : "Allumer la lampe"}
            className={`rounded-full p-2.5 transition-colors ${torchOn ? "bg-brand text-brand-foreground" : "bg-white/10 hover:bg-white/20"}`}
          >
            {torchOn ? <Zap className="size-5" /> : <ZapOff className="size-5" />}
          </button>
        ) : (
          <span className="size-10" />
        )}
      </div>

      {/* ——— Phase caméra ——— */}
      {phase === "camera" ? (
        <>
          <div className="relative min-h-0 flex-1">
            {error ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <CircleAlert className="size-8 text-amber-400" />
                <p className="max-w-sm text-sm text-white/80">{error}</p>
                <button
                  onClick={onClose}
                  className="mt-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black"
                >
                  Revenir au dépôt de fichier
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  onLoadedMetadata={(e) =>
                    setVideoDims({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })
                  }
                  className="h-full w-full object-contain"
                />
                {videoDims ? (
                  <svg
                    viewBox={`0 0 ${videoDims.w} ${videoDims.h}`}
                    preserveAspectRatio="xMidYMid meet"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  >
                    {liveQuad ? (
                      <polygon
                        points={liveQuad.map((p) => `${p.x},${p.y}`).join(" ")}
                        className="fill-emerald-400/15 stroke-emerald-400"
                        strokeWidth={3}
                        vectorEffect="non-scaling-stroke"
                        strokeLinejoin="round"
                      />
                    ) : null}
                  </svg>
                ) : null}
              </>
            )}
          </div>
          {!error ? (
            <div className="flex flex-col items-center gap-4 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <p
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                  liveQuad ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/85"
                }`}
              >
                {liveHint}
              </p>
              <div className="relative flex w-full items-center justify-center gap-6">
                {pages.length > 0 ? (
                  <button
                    onClick={() => setPhase("pages")}
                    className="absolute left-6 flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-sm transition-colors hover:bg-white/20"
                  >
                    <CircleCheck className="size-4 text-emerald-400" />
                    {pages.length}
                  </button>
                ) : null}
                <button
                  onClick={capture}
                  disabled={!videoDims}
                  aria-label="Capturer le document"
                  className="group rounded-full border-4 border-white/90 p-1.5 transition-transform active:scale-95 disabled:opacity-40"
                >
                  <span className="block size-14 rounded-full bg-white transition-colors group-active:bg-white/80" />
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {/* ——— Phase réglage des coins ——— */}
      {phase === "adjust" && capturedUrl && imgDims ? (
        <>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={capturedUrl}
                alt="Document capturé"
                draggable={false}
                className="max-h-[62dvh] w-auto max-w-full select-none rounded-lg"
              />
              {dispSize && quad ? (
                <svg
                  width={dispSize.w}
                  height={dispSize.h}
                  className="absolute inset-0 touch-none"
                  onPointerDown={onCornerDown}
                  onPointerMove={onCornerMove}
                  onPointerUp={() => (dragIdxRef.current = null)}
                  onPointerCancel={() => (dragIdxRef.current = null)}
                >
                  <polygon
                    points={quad.map((p) => `${p.x * scaleX},${p.y * scaleY}`).join(" ")}
                    className="fill-emerald-400/10 stroke-emerald-400"
                    strokeWidth={2}
                    strokeLinejoin="round"
                  />
                  {quad.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x * scaleX} cy={p.y * scaleY} r={26} className="fill-transparent" />
                      <circle
                        cx={p.x * scaleX}
                        cy={p.y * scaleY}
                        r={11}
                        className="fill-white stroke-emerald-400"
                        strokeWidth={3}
                      />
                    </g>
                  ))}
                </svg>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-center gap-4 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <p className="text-sm text-white/70">Ajustez les coins sur les bords du document</p>
            {error ? (
              <p role="alert" className="flex items-center gap-2 text-sm text-amber-300">
                <CircleAlert className="size-4 shrink-0" />
                {error}
              </p>
            ) : null}
            <div className="flex w-full max-w-md items-center justify-center gap-3">
              <button
                onClick={retake}
                className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/20"
              >
                <RotateCcw className="size-4" />
                Reprendre
              </button>
              <button
                onClick={redetect}
                className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/20"
              >
                <Wand2 className="size-4" />
                Auto
              </button>
              <button
                onClick={() => processCapture(mode)}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-strong active:scale-[0.98]"
              >
                <Check className="size-4" />
                Valider le cadrage
              </button>
            </div>
          </div>
        </>
      ) : null}

      {/* ——— Phase traitement ——— */}
      {phase === "processing" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <LoaderCircle className="size-8 animate-spin text-brand" />
          <p className="text-sm text-white/75">Redressement et contrôle de lisibilité…</p>
        </div>
      ) : null}

      {/* ——— Phase résultat + verdict qualité ——— */}
      {phase === "result" && result ? (
        <>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.url}
              alt="Document redressé"
              className="max-h-[54dvh] w-auto max-w-full rounded-lg shadow-2xl"
            />
          </div>
          <div className="flex flex-col items-center gap-4 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {/* Rendu couleur / noir & blanc */}
            <div className="flex rounded-full bg-white/10 p-1">
              {(["couleur", "nb"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => m !== mode && processCapture(m)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    mode === m ? "bg-white text-black" : "text-white/75 hover:text-white"
                  }`}
                >
                  <Contrast className="size-3.5" />
                  {m === "couleur" ? "Couleur" : "Noir & blanc"}
                </button>
              ))}
            </div>

            {/* Verdict de lisibilité */}
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className={`w-full max-w-md rounded-2xl p-3.5 text-sm ${
                result.report.verdict === "bonne"
                  ? "bg-emerald-500/15 text-emerald-200"
                  : result.report.verdict === "moyenne"
                    ? "bg-amber-500/15 text-amber-200"
                    : "bg-red-500/20 text-red-200"
              }`}
            >
              <p className="flex items-center gap-2 font-medium">
                {result.report.verdict === "bonne" ? (
                  <>
                    <CircleCheck className="size-4 shrink-0" />
                    Bonne qualité — document lisible pour l&apos;analyse.
                  </>
                ) : result.report.verdict === "moyenne" ? (
                  <>
                    <CircleAlert className="size-4 shrink-0" />
                    Qualité moyenne — la lecture peut être incomplète.
                  </>
                ) : (
                  <>
                    <CircleAlert className="size-4 shrink-0" />
                    Qualité insuffisante pour extraire les informations.
                  </>
                )}
              </p>
              {result.report.issues.length > 0 ? (
                <ul className="mt-1.5 flex flex-col gap-1 text-xs opacity-90">
                  {result.report.issues.map((issue) => (
                    <li key={issue}>• {issue}</li>
                  ))}
                </ul>
              ) : null}
            </motion.div>

            <div className="flex w-full max-w-md items-center justify-center gap-3">
              <button
                onClick={retake}
                className={`flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
                  result.report.verdict === "faible"
                    ? "flex-1 bg-brand text-brand-foreground hover:bg-brand-strong"
                    : "bg-white/10 hover:bg-white/20"
                }`}
              >
                <RotateCcw className="size-4" />
                Reprendre la photo
              </button>
              <button
                onClick={keepPage}
                className={`flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                  result.report.verdict === "faible"
                    ? "bg-white/10 text-white/80 hover:bg-white/20"
                    : "flex-1 bg-brand text-brand-foreground hover:bg-brand-strong active:scale-[0.98]"
                }`}
              >
                <Check className="size-4" />
                {result.report.verdict === "faible" ? "Utiliser quand même" : "Garder cette page"}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {/* ——— Phase pages : récapitulatif et envoi ——— */}
      {phase === "pages" ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="mx-auto grid max-w-md grid-cols-3 gap-3">
              {pages.map((p, i) => (
                <div key={p.url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={`Page ${i + 1}`}
                    className="aspect-[3/4] w-full rounded-xl object-cover ring-1 ring-white/15"
                  />
                  <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px]">
                    {i + 1}
                  </span>
                  <button
                    onClick={() => removePage(i)}
                    aria-label={`Supprimer la page ${i + 1}`}
                    className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 transition-colors hover:bg-red-500/80"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setPhase("camera")}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/25 text-white/70 transition-colors hover:border-white/50 hover:text-white"
              >
                <Plus className="size-6" />
                <span className="text-xs font-medium">Ajouter une page</span>
              </button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-3 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {error ? (
              <p role="alert" className="flex items-center gap-2 text-sm text-amber-300">
                <CircleAlert className="size-4 shrink-0" />
                {error}
              </p>
            ) : null}
            {pages.length > 1 ? (
              <p className="text-xs text-white/60">
                Les {pages.length} pages seront regroupées en un seul document PDF.
              </p>
            ) : null}
            <button
              onClick={finish}
              disabled={pages.length === 0 || finishing}
              className="flex w-full max-w-md items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-all hover:bg-brand-strong active:scale-[0.98] disabled:opacity-50"
            >
              {finishing ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {finishing
                ? "Préparation…"
                : `Terminer et envoyer${pages.length > 1 ? ` (${pages.length} pages)` : ""}`}
            </button>
            {pages.length === 0 ? (
              <button
                onClick={() => setPhase("camera")}
                className="flex items-center gap-2 text-sm text-white/70 underline-offset-2 hover:underline"
              >
                <Camera className="size-4" />
                Scanner une première page
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {/* ——— Confirmation d'abandon ——— */}
      {confirmExit ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-black">
            <p className="text-sm font-semibold">Abandonner le scan ?</p>
            <p className="mt-1 text-sm text-black/60">
              {pages.length > 0
                ? `Les ${pages.length} page${pages.length > 1 ? "s" : ""} scannée${pages.length > 1 ? "s" : ""} ne seront pas envoyées.`
                : "La photo en cours sera perdue."}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmExit(false)}
                className="rounded-full px-4 py-2 text-sm font-medium text-black/70 transition-colors hover:bg-black/5"
              >
                Continuer le scan
              </button>
              <button
                onClick={onClose}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Abandonner
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
