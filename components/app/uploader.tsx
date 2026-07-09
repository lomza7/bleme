"use client";

import { useRef, useState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, Mail, MessageCircle, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { prepareUpload, finalizeUpload, type DocState } from "@/lib/documents/actions";
import { AnalysisModal } from "@/components/app/analysis-modal";
import { ScanButton, useCanScan } from "@/components/app/scan-button";
import { EmailPieceModal, WhatsAppHelpModal } from "@/components/app/add-piece-modals";
import type { PieceAnalysis } from "@/lib/cases/analysis-types";

const MAX_SIZE = 25 * 1024 * 1024;

/** Dépôt de pièce : le SCAN caméra est l'action mise en avant (cadrage auto,
 * redressement, contrôle de lisibilité avant envoi — la moitié des utilisateurs
 * photographient leurs factures sur chantier) ; le clic / glisser-déposer reste
 * disponible en secondaire et accepte PLUSIEURS fichiers à la fois. Envoi DIRECT
 * navigateur → Storage (URL signée) pour tenir 25 Mo même en prod. Avec `kinds`,
 * catégorise la pièce. Avec `caseEmail`, propose l'ajout par email + WhatsApp/SMS. */
export function Uploader({
  scope,
  kinds,
  caseEmail,
}: {
  scope: string;
  kinds?: { value: string; label: string }[];
  caseEmail?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState(kinds?.[0]?.value ?? "");
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [state, setState] = useState<DocState>({});
  const [dragging, setDragging] = useState(false);
  const [modal, setModal] = useState<PieceAnalysis | null>(null);
  const [sheet, setSheet] = useState<null | "email" | "whatsapp">(null);
  const canScan = useCanScan();
  const showMethods = caseEmail !== undefined;

  // Envoi d'UN fichier : URL signée → upload direct → enregistrement + Nora.
  async function uploadOne(file: File): Promise<DocState> {
    if (file.size === 0) return { error: `« ${file.name} » est vide.` };
    if (file.size > MAX_SIZE) return { error: `« ${file.name} » dépasse 25 Mo.` };
    const docKind = kinds && kinds.length > 0 ? kind || null : null;
    const prep = await prepareUpload({
      scope,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    if (prep.error || !prep.path || !prep.token) {
      return { error: prep.error ?? "Impossible de préparer l’envoi." };
    }
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
    if (upErr) return { error: `Échec de l’envoi de « ${file.name} ».` };
    return await finalizeUpload({
      scope,
      path: prep.path,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      docKind,
    });
  }

  // Traite une sélection (une ou plusieurs pièces), en série pour ne pas saturer
  // le bridge (Nora tourne sur chaque pièce). Une pièce seule ouvre sa popup
  // d'analyse ; plusieurs → message récapitulatif.
  async function handleFiles(files: File[]) {
    if (!files.length || pending) return;
    setState({});
    setModal(null);
    setPending(true);
    try {
      if (files.length === 1) {
        setProgress(null);
        const res = await uploadOne(files[0]);
        setState(res);
        if (res.analysis) setModal(res.analysis);
      } else {
        let ok = 0;
        const errors: string[] = [];
        for (let i = 0; i < files.length; i++) {
          setProgress({ done: i, total: files.length });
          const res = await uploadOne(files[i]);
          if (res.error) errors.push(res.error);
          else ok++;
        }
        setState({
          success:
            ok > 0
              ? `${ok} pièce${ok > 1 ? "s" : ""} ajoutée${ok > 1 ? "s" : ""}${errors.length ? ` · ${errors.length} en échec` : ""}. Nora les lit et les classe.`
              : undefined,
          error: ok === 0 ? errors[0] ?? "Aucune pièce n’a pu être ajoutée." : undefined,
        });
      }
    } catch {
      setState({ error: "Une erreur est survenue. Réessayez." });
    } finally {
      setPending(false);
      setProgress(null);
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
          multiple
          className="sr-only"
          accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,.txt,.eml,.doc,.docx"
          onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
        />
        {canScan ? (
          <ScanButton disabled={pending} onFile={(file) => void handleFiles([file])} />
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
            handleFiles(Array.from(e.dataTransfer.files ?? []));
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
              ? progress
                ? `Envoi ${progress.done + 1}/${progress.total}…`
                : "Envoi en cours…"
              : canScan
                ? "ou glissez un ou plusieurs fichiers ici"
                : "Glissez vos fichiers ici, ou cliquez"}
          </span>
          <span className="text-xs text-muted-foreground">
            PDF, photos, Word, email · plusieurs à la fois · 25 Mo max
          </span>
        </button>

        {/* Autres façons d'apporter des pièces (email, conversations) */}
        {showMethods ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSheet("email")}
              className="flex items-center justify-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-sm font-medium transition-colors hover:border-brand/60 hover:bg-brand-soft/40"
            >
              <Mail className="size-4 text-brand-strong" />
              Par email
            </button>
            <button
              type="button"
              onClick={() => setSheet("whatsapp")}
              className="flex items-center justify-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-sm font-medium transition-colors hover:border-brand/60 hover:bg-brand-soft/40"
            >
              <MessageCircle className="size-4 text-brand-strong" />
              WhatsApp / SMS
            </button>
          </div>
        ) : null}

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
      {modal ? <AnalysisModal analysis={modal} onClose={() => setModal(null)} /> : null}
      {sheet === "email" ? <EmailPieceModal address={caseEmail} onClose={() => setSheet(null)} /> : null}
      {sheet === "whatsapp" ? <WhatsAppHelpModal onClose={() => setSheet(null)} /> : null}
    </>
  );
}
