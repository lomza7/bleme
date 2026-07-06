"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, CircleAlert, PenLine, RotateCcw } from "lucide-react";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";
import { createClient } from "@/lib/supabase/client";
import { prepareVoiceUpload, transcribeVoice } from "@/lib/transcription/actions";

const EASE = [0.16, 1, 0.3, 1] as const;
type Phase = "working" | "reveal" | "error";

/*
 * Pop-up de transcription : après « J'ai terminé », Nora « écoute » (upload +
 * STT), puis ÉCRIT le récit à toute vitesse (effet machine à écrire), et on
 * valide. Rappel : le transcript reste modifiable à l'écrit ensuite.
 */
export function TranscriptionModal({
  blob,
  onValidate,
  onManual,
  onRetry,
}: {
  blob: Blob;
  onValidate: (text: string) => void;
  onManual: (note: string) => void;
  onRetry: () => void;
}) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("working");
  const [full, setFull] = useState("");
  const [shown, setShown] = useState("");
  const [edited, setEdited] = useState(""); // transcript corrigeable AVANT validation
  const [errMsg, setErrMsg] = useState("");
  const started = useRef(false);

  // Upload + transcription (une seule fois).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const prep = await prepareVoiceUpload();
        if (prep.error || !prep.path || !prep.token) {
          setErrMsg(prep.error ?? "Envoi impossible.");
          return setPhase("error");
        }
        const supabase = createClient();
        const { error: upErr } = await supabase.storage
          .from("documents")
          .uploadToSignedUrl(prep.path, prep.token, blob, { contentType: blob.type });
        if (upErr) {
          setErrMsg("Envoi de l’audio impossible.");
          return setPhase("error");
        }
        const res = await transcribeVoice(prep.path);
        if (res.transcript) {
          setFull(res.transcript);
          setEdited(res.transcript);
          setPhase("reveal");
          return;
        }
        setErrMsg(res.error === "no_provider" ? "La transcription n’est pas encore activée." : "La transcription a échoué.");
        setPhase("error");
      } catch {
        setErrMsg("Une erreur est survenue.");
        setPhase("error");
      }
    })();
  }, [blob]);

  // Effet « machine à écrire » très rapide.
  useEffect(() => {
    if (phase !== "reveal" || !full) return;
    if (reduce) {
      const id = setTimeout(() => setShown(full), 0);
      return () => clearTimeout(id);
    }
    const step = Math.max(4, Math.round(full.length / 90)); // ~1,5 s quelle que soit la longueur
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(full.length, i + step);
      setShown(full.slice(0, i));
      if (i >= full.length) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [phase, full, reduce]);

  const revealing = phase === "reveal" && shown.length < full.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        role="dialog"
        aria-modal
        initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem] border bg-card shadow-2xl"
      >
        {/* En-tête agent */}
        <div className="flex items-center gap-3 border-b bg-gradient-to-b from-brand-soft/70 to-card p-5">
          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-brand-soft to-brand/15 ring-1 ring-brand/25">
            <SpriteAvatar src="/agents/nora.webp" alt="Nora" className="h-10" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Nora</p>
            <p className="text-xs text-muted-foreground">
              {phase === "working" ? "écoute votre récit…" : phase === "reveal" ? (revealing ? "écrit ce que vous avez dit…" : "relisez et corrigez, puis validez") : "n’a pas pu transcrire"}
            </p>
          </div>
          {phase === "working" || revealing ? (
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-2 animate-bounce rounded-full bg-brand" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
          ) : null}
        </div>

        {/* Corps */}
        <div className="min-h-[9rem] flex-1 overflow-y-auto p-5">
          {phase === "working" ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-6 text-center">
              <span className="flex items-end gap-1.5">
                {[0.2, 0.6, 1, 0.5, 0.8, 0.35, 0.7].map((h, i) => (
                  <motion.span
                    key={i}
                    className="w-1.5 rounded-full bg-brand"
                    animate={reduce ? undefined : { height: [`${h * 8}px`, `${h * 34}px`, `${h * 8}px`] }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }}
                    style={{ height: `${h * 20}px` }}
                  />
                ))}
              </span>
              <p className="text-sm text-muted-foreground">Envoi de l’audio, puis transcription — quelques secondes.</p>
            </div>
          ) : phase === "reveal" ? (
            revealing ? (
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                {shown}
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-brand align-middle" />
              </p>
            ) : (
              <textarea
                autoFocus
                value={edited}
                onChange={(e) => setEdited(e.target.value)}
                rows={7}
                className="w-full resize-none rounded-2xl border bg-background p-4 text-[15px] leading-relaxed outline-none transition-colors focus:border-brand"
              />
            )
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-6 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <CircleAlert className="size-5" />
              </span>
              <p className="text-sm font-medium">{errMsg}</p>
              <p className="max-w-xs text-sm text-muted-foreground">Pas de souci — vous pouvez écrire votre récit à la place, ou réessayer.</p>
            </div>
          )}
        </div>

        {/* Pied : validation */}
        <div className="border-t bg-muted/30 p-5">
          {phase === "reveal" && !revealing ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!edited.trim()}
                  onClick={() => onValidate(edited.trim())}
                  className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-50"
                >
                  <Check className="size-4" />
                  Valider ce transcript
                </button>
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RotateCcw className="size-3.5" />
                  Réenregistrer
                </button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Corrigez directement ci-dessus si besoin — et vous pourrez encore y revenir à l’écrit plus tard.
              </p>
            </>
          ) : phase === "error" ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onManual(errMsg)}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-ink-soft active:scale-[0.98]"
              >
                <PenLine className="size-4" />
                Écrire mon récit
              </button>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw className="size-3.5" />
                Réessayer
              </button>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">Nora travaille…</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
