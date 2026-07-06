"use client";

import { Printer } from "lucide-react";

/** Îlot client : impression / enregistrement PDF via le navigateur. */
export function PrintButton({ label = "Imprimer / Enregistrer en PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-ink-soft active:scale-[0.98] print:hidden"
    >
      <Printer className="size-4" />
      {label}
    </button>
  );
}
