"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { CircleAlert, CircleCheck, LoaderCircle, ScanLine, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { prepareUpload, finalizeUpload, type DocState } from "@/lib/documents/actions";
import { AnalysisModal } from "@/components/app/analysis-modal";
import type { PieceAnalysis } from "@/lib/cases/analysis-types";

// Chargé à la demande : le scanner (caméra + traitement d'image) ne pèse rien
// tant qu'on ne l'ouvre pas, et n'a aucun sens côté serveur.
const DocumentScanner = dynamic(
  () => import("@/components/app/document-scanner").then((m) => m.DocumentScanner),
  { ssr: false },
);

const MAX_SIZE = 25 * 1024 * 1024;

/** Dépôt de pièce : le SCAN caméra est l'action mise en avant (cadrage auto,
 * redressement, contrôle de lisibilité avant envoi — la moitié des utilisateurs
 * photographient leurs factures sur chantier) ; le clic / glisser-déposer reste
 * disponible en secondaire. Envoi DIRECT navigateur → Storage (URL signée)
 * pour tenir 25 Mo même en prod. Avec `kinds`, catégorise la pièce. */
export function Uploader({
  scope,
  kinds,
}: {
  scope: string;
  kinds?: { value: string; label: string }[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState(kinds?.[0]?.value ?? "");
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<DocState>({});
  const [dragging, setDragging] = useState(false);
  const [modal, setModal] = useState<PieceAnalysis | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [canScan, setCanScan] = useState(false);

  // Le bouton scan n'apparaît que si l'appareil a une caméra (rendu après
  // montage : pas de mismatch d'hydratation).
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

  async function handleFile(file: File | undefined) {
    if (!file || pending) return;
    setState({});
    if (file.size === 0) return setState({ error: "Choisissez un fichier." });
    if (file.size > MAX_SIZE) return setState({ error: "Fichier trop lourd (25 Mo maximum)." });

    setPending(true);
    try {
      const docKind = kinds && kinds.length > 0 ? kind || null : null;
      // 1. URL d'upload signée (côté serveur, sous RLS).
      const prep = await prepareUpload({
        scope,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      if (prep.error || !prep.path || !prep.token) {
        return setState({ error: prep.error ?? "Impossible de préparer l’envoi." });
      }
      // 2. Upload direct des octets vers le Storage (ne passe pas par la fonction).
      // storage-js IGNORE options.contentType pour un Blob : la part multipart
      // porte file.type, vide pour un HEIC/.eml → octet-stream → refusé par le
      // bucket. On retype le Blob (partage les octets, aucune copie) pour porter
      // le bon MIME résolu côté serveur.
      const supabase = createClient();
      const body =
        prep.contentType && file.type !== prep.contentType
          ? file.slice(0, file.size, prep.contentType)
          : file;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .uploadToSignedUrl(prep.path, prep.token, body, { contentType: prep.contentType });
      if (upErr) return setState({ error: "Échec de l’envoi. Réessayez." });
      // 3. Enregistrement + extraction + Nora (métadonnées seulement).
      const res = await finalizeUpload({
        scope,
        path: prep.path,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        docKind,
      });
      setState(res);
      if (res.analysis) setModal(res.analysis);
    } catch {
      setState({ error: "Une erreur est survenue. Réessayez." });
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {kinds && kinds.length > 0 ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Type de pièce
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand"
            >
              {kinds.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,.txt,.eml,.doc,.docx"
          onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)}
        />
        {canScan ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setScanOpen(true)}
            className="flex w-full items-center gap-4 rounded-[1.75rem] bg-brand px-6 py-5 text-left text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.99] disabled:opacity-60"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <ScanLine className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Scanner un document</span>
              <span className="block text-xs opacity-85">
                Cadrage automatique, lisibilité vérifiée avant l&apos;ajout au dossier
              </span>
            </span>
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0] ?? undefined);
          }}
          className={`flex w-full flex-col items-center gap-2 rounded-[1.75rem] border-2 border-dashed px-6 text-center transition-all duration-300 ${
            canScan ? "py-5" : "py-8"
          } ${
            dragging
              ? "border-brand bg-brand-soft"
              : "border-brand/30 bg-brand-soft/40 hover:border-brand/60 hover:bg-brand-soft/70"
          } ${pending ? "opacity-60" : ""}`}
        >
          {pending ? (
            <LoaderCircle className="size-6 animate-spin text-brand-strong" />
          ) : (
            <UploadCloud className="size-6 text-brand-strong" />
          )}
          <span className="text-sm font-medium">
            {pending
              ? "Envoi en cours…"
              : canScan
                ? "ou glissez un fichier ici"
                : "Glissez un fichier ici, ou cliquez"}
          </span>
          <span className="text-xs text-muted-foreground">
            PDF, photos, Word, email · 25 Mo max
          </span>
        </button>
        {state.error ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-red-600">
            <CircleAlert className="size-4 shrink-0" />
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p role="status" className="flex items-center gap-2 text-sm text-emerald-700">
            <CircleCheck className="size-4 shrink-0" />
            {state.success}
          </p>
        ) : null}
      </div>
      {scanOpen ? (
        <DocumentScanner
          onClose={() => setScanOpen(false)}
          onComplete={(file) => {
            setScanOpen(false);
            void handleFile(file);
          }}
        />
      ) : null}
      {modal ? <AnalysisModal analysis={modal} onClose={() => setModal(null)} /> : null}
    </>
  );
}
