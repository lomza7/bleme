"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ScanLine } from "lucide-react";

// Chargé à la demande : le scanner (caméra + traitement d'image) ne pèse rien
// tant qu'on ne l'ouvre pas, et n'a aucun sens côté serveur.
const DocumentScanner = dynamic(
  () => import("@/components/app/document-scanner").then((m) => m.DocumentScanner),
  { ssr: false },
);

/** L'appareil a-t-il une caméra ? Rendu après montage : pas de mismatch
 * d'hydratation, et le bouton scan n'apparaît jamais sur un poste sans webcam. */
export function useCanScan(): boolean {
  const [canScan, setCanScan] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!navigator.mediaDevices?.getUserMedia) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (alive && devices.some((d) => d.kind === "videoinput")) setCanScan(true);
      })
      .catch(() => {
        // Énumération bloquée avant permission sur certains navigateurs :
        // on laisse tenter, le scanner gère lui-même le refus caméra.
        if (alive) setCanScan(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  return canScan;
}

/** Bouton « Scanner un document » mis en avant + ouverture du scanner plein
 * écran. Le fichier produit (JPEG ou PDF multi-pages) part dans `onFile`,
 * c'est-à-dire le même pipeline que le dépôt classique. À n'afficher que si
 * `useCanScan()` est vrai. */
export function ScanButton({
  onFile,
  disabled,
  subtitle = "Cadrage automatique, lisibilité vérifiée avant l'ajout au dossier",
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  subtitle?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-4 rounded-[1.75rem] bg-brand px-6 py-5 text-left text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.99] disabled:opacity-60"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
          <ScanLine className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Scanner un document</span>
          <span className="block text-xs opacity-85">{subtitle}</span>
        </span>
      </button>
      {open ? (
        <DocumentScanner
          onClose={() => setOpen(false)}
          onComplete={(file) => {
            setOpen(false);
            onFile(file);
          }}
        />
      ) : null}
    </>
  );
}
