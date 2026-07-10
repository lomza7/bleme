"use client";

import { useTransition } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { syncPennylaneNow } from "@/lib/integrations/actions";

/** Bouton « Synchroniser » du panneau compta (état d'attente réel). */
export function SyncNowButton() {
  const [syncing, startSync] = useTransition();
  return (
    <button
      type="button"
      disabled={syncing}
      onClick={() => startSync(async () => syncPennylaneNow())}
      className="inline-flex items-center gap-2 rounded-full border bg-background px-3.5 py-2 text-xs font-medium transition-colors duration-300 hover:border-brand/60 hover:bg-brand-soft disabled:opacity-60"
    >
      {syncing ? (
        <LoaderCircle className="size-3.5 animate-spin" />
      ) : (
        <RefreshCw className="size-3.5 text-brand-strong" />
      )}
      {syncing ? "Synchronisation…" : "Synchroniser"}
    </button>
  );
}
