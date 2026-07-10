"use client";

import { useFormStatus } from "react-dom";
import { FolderPlus, LoaderCircle } from "lucide-react";

/** Bouton « Créer le dossier » d'une facture détectée (état d'attente réel). */
export function CreateCaseFromInvoiceButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <FolderPlus className="size-4" />}
      {pending ? "Création…" : "Créer le dossier"}
    </button>
  );
}
