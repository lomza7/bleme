"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Check,
  CircleAlert,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { createApiKeyAction, revokeApiKeyAction, type ApiKeyState } from "@/lib/api/actions";
import { API_SCOPES } from "@/lib/api/scopes";

type Scope = { cap: string; label: string; hint: string };

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
  expires_at: string | null;
};

const INITIAL: ApiKeyState = {};
const SCOPE_LABEL = new Map<string, string>(API_SCOPES.map((s) => [s.cap, s.label]));

function whenText(iso: string | null): string {
  if (!iso) return "jamais";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function ApiKeysManager({ keys, availableScopes }: { keys: ApiKeyRow[]; availableScopes: Scope[] }) {
  const active = keys.filter((k) => !k.revoked_at);
  const revoked = keys.filter((k) => k.revoked_at);

  return (
    <div className="flex flex-col gap-6">
      <CreateKeyForm availableScopes={availableScopes} />

      <section className="rounded-[1.75rem] border bg-card p-6 sm:p-8">
        <h2 className="text-lg font-semibold">Vos clés</h2>
        {active.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Aucune clé active. Créez-en une ci-dessus pour brancher un outil externe.
          </p>
        ) : (
          <ul className="mt-4 divide-y">
            {active.map((k) => (
              <KeyRow key={k.id} k={k} />
            ))}
          </ul>
        )}

        {revoked.length > 0 ? (
          <details className="mt-6">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              {revoked.length} clé{revoked.length > 1 ? "s" : ""} révoquée{revoked.length > 1 ? "s" : ""}
            </summary>
            <ul className="mt-2 divide-y opacity-60">
              {revoked.map((k) => (
                <KeyRow key={k.id} k={k} />
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        Authentifiez chaque requête avec l’en-tête <code className="rounded bg-muted px-1">Authorization: Bearer VOTRE_CLÉ</code>.
        Base : <code className="rounded bg-muted px-1">/api/v1</code>. L’envoi de courrier n’est jamais accessible par
        l’API (validation humaine requise).
      </p>
    </div>
  );
}

function CreateKeyForm({ availableScopes }: { availableScopes: Scope[] }) {
  const [state, action, pending] = useActionState(createApiKeyAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  // Réinitialise les champs une fois la clé créée (le secret reste affiché).
  useEffect(() => {
    if (state.secret) formRef.current?.reset();
  }, [state.secret]);

  return (
    <section className="rounded-[1.75rem] border bg-card p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
          <KeyRound className="size-4.5" />
        </span>
        <h2 className="text-lg font-semibold">Nouvelle clé</h2>
      </div>

      {state.secret ? <RevealOnce secret={state.secret} /> : null}

      <form ref={formRef} action={action} className="mt-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="key-name" className="text-sm font-medium">
            Nom
          </label>
          <input
            id="key-name"
            name="name"
            required
            maxLength={80}
            placeholder="Ex. Zapier, script de synchro…"
            className="w-full rounded-2xl border bg-background px-4 py-3 text-[15px] outline-none transition-all duration-300 focus:ring-2 focus:ring-brand"
          />
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-medium">Droits de la clé</legend>
          {availableScopes.length === 0 ? (
            <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200">
              Vous n’avez aucun droit de lecture à déléguer à une clé. Demandez « Voir les dossiers »
              ou « Voir la compta » à un propriétaire.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {availableScopes.map((s) => (
                <label
                  key={s.cap}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border bg-background px-4 py-3 transition-colors hover:border-brand/40"
                >
                  <input type="checkbox" name="scopes" value={s.cap} defaultChecked className="mt-1 size-4 accent-brand" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{s.label}</span>
                    <span className="block text-xs text-muted-foreground">{s.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        {state.error ? (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-red-100">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            {state.error}
          </p>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={pending || availableScopes.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Créer la clé
          </button>
        </div>
      </form>
    </section>
  );
}

function RevealOnce({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponible : l'utilisateur copie à la main
    }
  };
  return (
    <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
        <ShieldCheck className="size-4" />
        Votre clé est prête. Copiez-la maintenant — elle ne sera plus jamais affichée.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-2.5 font-mono text-sm ring-1 ring-emerald-200">
          {secret}
        </code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
    </div>
  );
}

function KeyRow({ k }: { k: ApiKeyRow }) {
  const [state, action, pending] = useActionState(revokeApiKeyAction, INITIAL);
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <KeyRound className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{k.name}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">{k.key_prefix}••••••••</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {k.scopes.map((s) => SCOPE_LABEL.get(s) ?? s).join(" · ") || "aucun droit"}
          {" — "}dernière utilisation : {whenText(k.last_used_at)}
        </p>
      </div>

      {k.revoked_at ? (
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Révoquée</span>
      ) : confirming ? (
        <form action={action} className="flex shrink-0 items-center gap-2">
          <input type="hidden" name="id" value={k.id} />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <TriangleAlert className="size-3.5" />}
            Confirmer la révocation
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Annuler
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-red-300 hover:text-red-600"
        >
          <Trash2 className="size-3.5" />
          Révoquer
        </button>
      )}

      {state.error ? (
        <p role="alert" className="w-full text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </li>
  );
}
