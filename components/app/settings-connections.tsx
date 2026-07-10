"use client";

import Image from "next/image";
import { useActionState, useState, useTransition } from "react";
import { Check, CircleAlert, ExternalLink, LoaderCircle, Unplug } from "lucide-react";
import {
  connectIntegration,
  disconnectIntegration,
  type IntegrationState,
} from "@/lib/integrations/actions";
import { PROVIDERS, SUPPORTED_PROVIDERS, type ProviderId } from "@/lib/integrations/providers-meta";
import { SyncNowButton } from "@/components/app/sync-now-button";
import { relativeTimeFr } from "@/lib/format";

/*
 * Connexion d'un logiciel comptable (Paramètres → Connexions). Générique :
 * piloté par le descripteur du fournisseur (logo, champs, aide). Les
 * identifiants sont vérifiés contre l'API puis chiffrés côté serveur ; jamais
 * réaffichés. Lecture seule : BLEME ne modifie rien dans la comptabilité.
 */

const INITIAL: IntegrationState = {};

export type IntegrationInfo = {
  provider: string;
  status: string;
  company_name: string | null;
  last_sync_at: string | null;
  last_error: string | null;
} | null;

function Logo({ provider, className }: { provider: ProviderId; className?: string }) {
  const m = PROVIDERS[provider];
  return <Image src={m.logo} alt={m.label} width={Math.round(20 * m.logoAspect)} height={20} className={className ?? "h-5 w-auto"} />;
}

function ConnectForm({ provider }: { provider: ProviderId }) {
  const meta = PROVIDERS[provider];
  const [state, action, pending] = useActionState(connectIntegration, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="provider" value={provider} />
      {meta.fields.map((f) => (
        <input
          key={f.name}
          type="password"
          name={f.name}
          required
          autoComplete="off"
          aria-label={f.label}
          placeholder={f.placeholder}
          className="h-11 w-full rounded-full border bg-background px-4 font-mono text-sm outline-none transition-colors focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-brand/30"
        />
      ))}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-full bg-brand px-5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {pending ? "Vérification…" : `Connecter ${meta.label}`}
      </button>
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
}

export function IntegrationConnection({
  provider,
  integration,
}: {
  provider: ProviderId;
  integration: IntegrationInfo;
}) {
  const meta = PROVIDERS[provider];
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, startDisconnect] = useTransition();

  if (integration) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border bg-background p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-8 items-center rounded-full bg-white px-2.5 shadow-sm ring-1 ring-black/5">
            <Logo provider={provider} />
          </span>
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              integration.status === "error"
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            <Check className="size-3.5" />
            {integration.status === "error" ? "À reconnecter" : "Connecté"}
            {integration.company_name ? ` · ${integration.company_name}` : ""}
          </span>
          <span className="text-xs text-muted-foreground" suppressHydrationWarning>
            {integration.last_sync_at ? `synchronisé ${relativeTimeFr(integration.last_sync_at)}` : "sync en attente"}
          </span>
        </div>

        {integration.status === "error" && integration.last_error ? (
          <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800 ring-1 ring-amber-200">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            {integration.last_error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <SyncNowButton provider={provider} />
          {confirmDisconnect ? (
            <span className="flex items-center gap-2">
              <button
                type="button"
                disabled={disconnecting}
                onClick={() => startDisconnect(async () => disconnectIntegration(provider))}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-300 hover:bg-red-700 disabled:opacity-60"
              >
                {disconnecting ? <LoaderCircle className="size-4 animate-spin" /> : <Unplug className="size-4" />}
                Confirmer
              </button>
              <button type="button" onClick={() => setConfirmDisconnect(false)} className="text-sm text-muted-foreground hover:text-foreground">
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

        {integration.status === "error" ? (
          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium">Reconnecter (vos factures et dossiers sont conservés) :</p>
            <ConnectForm provider={provider} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-background p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-8 items-center rounded-full bg-white px-2.5 shadow-sm ring-1 ring-black/5">
          <Logo provider={provider} />
        </span>
      </div>
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{meta.blurb}</p>

      <details className="rounded-2xl border bg-card px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">Où trouver vos identifiants ?</summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
          {meta.howto.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        {meta.planNote ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 ring-1 ring-amber-200">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
            {meta.planNote}
          </p>
        ) : null}
        {meta.howtoUrl ? (
          <a
            href={meta.howtoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-strong hover:underline"
          >
            Guide officiel {meta.label}
            <ExternalLink className="size-3" />
          </a>
        ) : null}
      </details>

      <ConnectForm provider={provider} />
    </div>
  );
}

/** Liste des connexions (une carte par fournisseur supporté). */
export function IntegrationConnections({ integrations }: { integrations: NonNullable<IntegrationInfo>[] }) {
  const byProvider = new Map(integrations.map((i) => [i.provider, i]));
  return (
    <div className="flex flex-col gap-3">
      {SUPPORTED_PROVIDERS.map((p) => (
        <IntegrationConnection key={p} provider={p} integration={byProvider.get(p) ?? null} />
      ))}
      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        Lecture seule : BLEME lit vos factures clients et leur statut de règlement, et n’écrit jamais rien
        dans votre comptabilité. Déconnecter un logiciel supprime les factures importées ; vos dossiers créés restent.
      </p>
    </div>
  );
}
