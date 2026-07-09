"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  FolderInput,
  LoaderCircle,
  MailPlus,
  Sparkles,
  Tag,
  UploadCloud,
} from "lucide-react";
import {
  addPastedEmail,
  assignItemToCase,
  createLabel,
  prepareInboxUpload,
  finalizeInboxImport,
  setItemLabel,
  type InboxState,
} from "@/lib/inbox/actions";
import { createClient } from "@/lib/supabase/client";
import { LABEL_COLORS } from "@/lib/inbox/label-colors";
import { EmailAnalysisModal } from "@/components/app/email-analysis-modal";
import { ScanButton, useCanScan } from "@/components/app/scan-button";

const MAX_SIZE = 25 * 1024 * 1024;

const INITIAL: InboxState = {};

function Feedback({ state }: { state: InboxState }) {
  if (state.error) {
    return (
      <p role="alert" className="flex items-center gap-2 text-sm text-red-600">
        <CircleAlert className="size-4 shrink-0" />
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-emerald-700">
        <CircleCheck className="size-4 shrink-0" />
        {state.success}
      </p>
    );
  }
  return null;
}

/** Adresse de transfert, copiable en un clic. */
export function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard indisponible : l'adresse reste sélectionnable */
        }
      }}
      className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 font-mono text-[13px] text-white transition-all duration-300 hover:bg-ink-soft active:scale-[0.98]"
      title="Copier l’adresse"
    >
      {address}
      {copied ? (
        <Check className="size-3.5 text-emerald-400" />
      ) : (
        <Copy className="size-3.5 opacity-70" />
      )}
    </button>
  );
}

/** Dépôt vers la boîte : le SCAN caméra est mis en avant (cadrage auto,
 * lisibilité vérifiée avant envoi), le glisser-déposer reste en secondaire.
 * Upload DIRECT navigateur → Storage (URL signée). */
export function InboxUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<InboxState>({});
  const [dragging, setDragging] = useState(false);
  const canScan = useCanScan();

  async function handleFile(file: File | undefined) {
    if (!file || pending) return;
    setState({});
    if (file.size === 0) return setState({ error: "Choisissez un fichier." });
    if (file.size > MAX_SIZE) return setState({ error: "Fichier trop lourd (25 Mo maximum)." });
    setPending(true);
    try {
      const prep = await prepareInboxUpload({ fileName: file.name, mimeType: file.type, sizeBytes: file.size });
      if (prep.error || !prep.path || !prep.token) {
        return setState({ error: prep.error ?? "Impossible de préparer l’envoi." });
      }
      const supabase = createClient();
      // storage-js ignore options.contentType pour un Blob → on retype (sans copie).
      const body =
        prep.contentType && file.type !== prep.contentType
          ? file.slice(0, file.size, prep.contentType)
          : file;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .uploadToSignedUrl(prep.path, prep.token, body, { contentType: prep.contentType });
      if (upErr) return setState({ error: "Échec de l’envoi. Réessayez." });
      setState(await finalizeInboxImport({ path: prep.path, fileName: file.name, mimeType: file.type, sizeBytes: file.size }));
    } catch {
      setState({ error: "Une erreur est survenue. Réessayez." });
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,.txt,.eml,.doc,.docx"
        onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)}
      />
      {canScan ? (
        <ScanButton
          disabled={pending}
          onFile={(file) => void handleFile(file)}
          subtitle="Cadrage automatique, lisibilité vérifiée avant l'ajout à la boîte"
        />
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
          canScan ? "py-5" : "py-7"
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
              ? "ou glissez un fichier, un export WhatsApp, une photo"
              : "Glissez un fichier, un export WhatsApp, une photo"}
        </span>
        <span className="text-xs text-muted-foreground">
          PDF, photos, Word, email, texte · 25 Mo max
        </span>
      </button>
      <Feedback state={state} />
    </div>
  );
}

/** Coller un email reçu ailleurs, en attendant l'adresse active. */
export function PasteEmailForm() {
  const [state, action, pending] = useActionState(addPastedEmail, INITIAL);
  return (
    <details className="group rounded-[1.75rem] border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-5 py-4 text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden">
        <MailPlus className="size-4 text-brand-strong" />
        Coller un email
        <span className="ml-auto text-xs text-muted-foreground group-open:hidden">
          Ouvrir
        </span>
      </summary>
      <form action={action} className="flex flex-col gap-3 border-t px-5 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            name="fromName"
            placeholder="Expéditeur (ex. SARL Bâti Concept)"
            className="rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand"
          />
          <input
            name="subject"
            required
            placeholder="Objet de l’email"
            className="rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand"
          />
        </div>
        <textarea
          name="body"
          required
          rows={5}
          placeholder="Collez ici le contenu de l’email…"
          className="rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? "Ajout…" : "Ajouter à la boîte"}
          </button>
          <Feedback state={state} />
        </div>
      </form>
    </details>
  );
}

/** Créer un libellé (nom + couleur). */
export function NewLabelForm() {
  const [state, action, pending] = useActionState(createLabel, INITIAL);
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground [&::-webkit-details-marker]:hidden">
        <Tag className="size-3.5" />
        Nouveau libellé
      </summary>
      <form action={action} className="mt-3 flex flex-wrap items-center gap-2.5">
        <input
          name="name"
          required
          maxLength={40}
          placeholder="Ex. Chantier Balard"
          className="rounded-xl border bg-background px-3.5 py-2 text-sm outline-none transition-colors focus:border-brand"
        />
        <span className="flex items-center gap-1.5">
          {Object.entries(LABEL_COLORS).map(([value, c], i) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={value}
                defaultChecked={i === 0}
                className="peer sr-only"
              />
              <span
                className={`block size-6 rounded-full ${c.dot} ring-offset-2 transition-all peer-checked:ring-2 peer-checked:ring-ink/60`}
                title={value}
              />
            </label>
          ))}
        </span>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-white transition-all duration-300 hover:bg-ink-soft active:scale-[0.98] disabled:opacity-60"
        >
          Créer
        </button>
        <Feedback state={state} />
      </form>
    </details>
  );
}

type LabelOption = { id: string; name: string; color: string };
type CaseOption = { id: string; title: string; case_type: string };

/** Actions d'un élément ouvert : libellé (appliqué au changement) + versement.
 * Pour un email, « Verser au dossier » ouvre l'analyse IA (popup) avant fusion ;
 * pour les autres sources, versement direct (déterministe) comme avant. */
export function ItemActions({
  itemId,
  source,
  labelId,
  labels,
  cases,
}: {
  itemId: string;
  source: string;
  labelId: string | null;
  labels: LabelOption[];
  cases: CaseOption[];
}) {
  const router = useRouter();
  const [state, assign, pending] = useActionState(assignItemToCase, INITIAL);
  const labelFormRef = useRef<HTMLFormElement>(null);
  const [pickedCase, setPickedCase] = useState("");
  const [modalCase, setModalCase] = useState<CaseOption | null>(null);
  const isEmail = source === "email";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        {labels.length > 0 ? (
          <form ref={labelFormRef} action={setItemLabel} className="flex items-center gap-2">
            <input type="hidden" name="id" value={itemId} />
            <Tag className="size-3.5 text-muted-foreground" />
            <select
              name="labelId"
              defaultValue={labelId ?? ""}
              onChange={() => labelFormRef.current?.requestSubmit()}
              className="rounded-xl border bg-background px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-brand"
            >
              <option value="">Sans libellé</option>
              {labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </form>
        ) : null}

        {cases.length > 0 && isEmail ? (
          <div className="flex items-center gap-2">
            <FolderInput className="size-3.5 text-muted-foreground" />
            <select
              value={pickedCase}
              onChange={(e) => setPickedCase(e.target.value)}
              className="max-w-52 rounded-xl border bg-background px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-brand"
            >
              <option value="" disabled>
                Choisir un dossier…
              </option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!pickedCase}
              onClick={() => {
                const c = cases.find((x) => x.id === pickedCase);
                if (c) setModalCase(c);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-xs font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
            >
              <Sparkles className="size-3.5" />
              Analyser et verser
            </button>
          </div>
        ) : cases.length > 0 ? (
          <form action={assign} className="flex items-center gap-2">
            <input type="hidden" name="id" value={itemId} />
            <FolderInput className="size-3.5 text-muted-foreground" />
            <select
              name="caseId"
              required
              defaultValue=""
              className="max-w-52 rounded-xl border bg-background px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-brand"
            >
              <option value="" disabled>
                Choisir un dossier…
              </option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-brand px-3.5 py-1.5 text-xs font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
            >
              {pending ? "Versement…" : "Verser au dossier"}
            </button>
          </form>
        ) : null}
      </div>
      <Feedback state={state} />

      {modalCase ? (
        <EmailAnalysisModal
          itemId={itemId}
          caseId={modalCase.id}
          caseTitle={modalCase.title}
          caseType={modalCase.case_type}
          onDone={() => {
            setModalCase(null);
            router.refresh();
          }}
          onCancel={() => setModalCase(null)}
        />
      ) : null}
    </div>
  );
}
