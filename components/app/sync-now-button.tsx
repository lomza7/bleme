"use client";

import { useTransition } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { syncAllIntegrations, syncIntegration } from "@/lib/integrations/actions";

/**
 * Bouton « Synchroniser ». Sans `provider` : synchronise toutes les connexions
 * (cockpit). Avec `provider` : uniquement celle-ci (carte des réglages).
 */
export function SyncNowButton({ provider }: { provider?: string }) {
  const [syncing, startSync] = useTransition();
  return (
    <button
      type="button"
      disabled={syncing}
      onClick={() =>
        startSync(async () => {
          if (provider) await syncIntegration(provider);
          else await syncAllIntegrations();
        })
      }
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
