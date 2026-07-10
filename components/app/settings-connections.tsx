"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Check,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  Unplug,
} from "lucide-react";
import {
  connectPennylane,
  disconnectPennylane,
  syncPennylaneNow,
  type IntegrationState,
} from "@/lib/integrations/actions";
import { relativeTimeFr } from "@/lib/format";

/*
 * Connexion Pennylane (Paramètres → Connexions). Le token est vérifié contre
 * l'API puis chiffré côté serveur — il n'est jamais réaffiché. Lecture seule :
 * BLEME ne modifie RIEN dans la comptabilité de l'utilisateur.
 */

const INITIAL: IntegrationState = {};

export type IntegrationInfo = {
  status: string;
  company_name: string | null;
  last_sync_at: string | null;
  last_error: string | null;
} | null;

export function PennylaneConnection({
  integration,
  unpaidCount,
}: {
  integration: IntegrationInfo;
  unpaidCount: number;
}) {
  const [state, action, pending] = useActionState(connectPennylane, INITIAL);
  const [syncing, startSync] = useTransition();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, startDisconnect] = useTransition();

  const tokenForm = (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="password"
          name="token"
          required
          autoComplete="off"
          placeholder="Collez votre token API Pennylane"
          className="h-11 flex-1 rounded-full border bg-background px-4 font-mono text-sm outline-none transition-colors focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-brand/30"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {pending ? "Vérification…" : "Connecter"}
        </button>
      </div>
      {state.error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-red-600">
          <CircleAlert className="size-4 shrink-0" />
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="flex items-center gap-2 text-sm text-emerald-700">
          <Check className="size-4 shrink-0" />
          {state.success}
        </p>
      ) : null}
    </form>
  );

  if (integration) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-emerald-800">
              Pennylane connecté{integration.company_name ? ` — ${integration.company_name}` : ""}
            </p>
            <p className="text-xs text-emerald-700/80" suppressHydrationWarning>
              {integration.last_sync_at
                ? `Dernière synchronisation ${relativeTimeFr(integration.last_sync_at)} · ${unpaidCount} facture${unpaidCount > 1 ? "s" : ""} impayée${unpaidCount > 1 ? "s" : ""} détectée${unpaidCount > 1 ? "s" : ""}`
                : "Première synchronisation en attente"}
            </p>
          </div>
        </div>

        {integration.status === "error" && integration.last_error ? (
          <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800 ring-1 ring-amber-200">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            {integration.last_error}
          </p>
        ) : null}

        {integration.status === "error" ? (
          <div className="rounded-2xl border bg-background p-4">
            <p className="mb-3 text-sm font-medium">
              Reconnecter avec un nouveau token (vos factures et dossiers sont conservés) :
            </p>
            {tokenForm}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={syncing}
            onClick={() => startSync(async () => syncPennylaneNow())}
            className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium transition-colors duration-300 hover:border-brand/60 hover:bg-brand-soft disabled:opacity-60"
          >
            {syncing ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4 text-brand-strong" />
            )}
            Synchroniser maintenant
          </button>
          {confirmDisconnect ? (
            <span className="flex items-center gap-2">
              <button
                type="button"
                disabled={disconnecting}
                onClick={() => startDisconnect(async () => disconnectPennylane())}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-300 hover:bg-red-700 disabled:opacity-60"
              >
                {disconnecting ? <LoaderCircle className="size-4 animate-spin" /> : <Unplug className="size-4" />}
                Confirmer la déconnexion
              </button>
              <button
                type="button"
                onClick={() => setConfirmDisconnect(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Annuler
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDisconnect(true)}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground"
            >
              <Unplug className="size-4" />
              Déconnecter
            </button>
          )}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Lecture seule : BLEME lit vos factures clients et leur statut de règlement,
          et n’écrit jamais rien dans votre comptabilité. Déconnecter supprime les
          factures importées (vos dossiers créés restent).
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
        Connectez votre comptabilité : vos factures clients impayées apparaissent
        dans BLEME, chacune prête à devenir un dossier en un clic — et quand une
        facture est réglée, vous êtes prévenu pour solder le dossier.
      </p>

      <details className="rounded-2xl border bg-background px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">
          Où trouver votre token API Pennylane ?
        </summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            Dans Pennylane : <span className="font-medium text-foreground">Paramètres → Connectivité → Développeurs</span>{" "}
            → « Générer un token API ».
          </li>
          <li>
            Choisissez les permissions <span className="font-medium text-foreground">Lecture seule</span> (BLEME n’a
            besoin que de lire vos factures clients).
          </li>
          <li>Copiez le token affiché (il ne sera montré qu’une fois) et collez-le ci-dessous.</li>
        </ol>
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 ring-1 ring-amber-200">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          L’onglet Développeurs nécessite un plan Pennylane Essential ou supérieur.
        </p>
        <a
          href="https://pennylane.readme.io/docs/generating-my-api-token"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-strong hover:underline"
        >
          Guide officiel Pennylane
          <ExternalLink className="size-3" />
        </a>
      </details>

      {tokenForm}
    </div>
  );
}
