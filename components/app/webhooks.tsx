"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Check,
  CircleAlert,
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Webhook,
} from "lucide-react";
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  rotateWebhookSecret,
  sendTestWebhook,
  setWebhookEnabled,
  type WebhookState,
} from "@/lib/webhooks/actions";
import { WEBHOOK_EVENTS } from "@/lib/webhooks/events";

export type WebhookEndpointRow = {
  id: string;
  url: string;
  description: string | null;
  enabled_events: string[];
  status: string;
  failure_count: number;
  last_delivery_at: string | null;
  disabled_at: string | null;
  created_at: string;
};

export type DeliveryRow = {
  id: string;
  endpoint_id: string;
  event_type: string;
  status: string;
  response_code: number | null;
  attempts: number;
  created_at: string;
  delivered_at: string | null;
};

const INITIAL: WebhookState = {};
const EVENT_LABEL = new Map<string, string>(WEBHOOK_EVENTS.map((e) => [e.type, e.label]));

function when(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function CopyBox({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
        <ShieldCheck className="size-4" />
        Secret de signature — copiez-le maintenant, il ne sera plus affiché.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-2.5 font-mono text-sm ring-1 ring-emerald-200">
          {secret}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(secret);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* copie manuelle */
            }
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
    </div>
  );
}

export function WebhooksManager({ endpoints, deliveries }: { endpoints: WebhookEndpointRow[]; deliveries: DeliveryRow[] }) {
  return (
    <div className="flex flex-col gap-6">
      <CreateForm />

      <section className="rounded-[1.75rem] border bg-card p-6 sm:p-8">
        <h2 className="text-lg font-semibold">Vos endpoints</h2>
        {endpoints.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Aucun endpoint. Ajoutez-en un ci-dessus pour recevoir les événements.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {endpoints.map((e) => (
              <EndpointCard key={e.id} e={e} />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[1.75rem] border bg-card p-6 sm:p-8">
        <h2 className="text-lg font-semibold">Journal des livraisons</h2>
        {deliveries.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Aucune livraison pour l’instant.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Événement</th>
                  <th className="pb-2 pr-4 font-medium">Statut</th>
                  <th className="pb-2 pr-4 font-medium">Code</th>
                  <th className="pb-2 pr-4 font-medium">Essais</th>
                  <th className="pb-2 font-medium">Quand</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2 pr-4 font-medium">{EVENT_LABEL.get(d.event_type) ?? d.event_type}</td>
                    <td className="py-2 pr-4">
                      <DeliveryBadge status={d.status} />
                    </td>
                    <td className="py-2 pr-4 tabular-nums text-muted-foreground">{d.response_code ?? "—"}</td>
                    <td className="py-2 pr-4 tabular-nums text-muted-foreground">{d.attempts}</td>
                    <td className="py-2 text-muted-foreground">{when(d.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        Chaque requête porte <code className="rounded bg-muted px-1">X-Bleme-Signature: t=…,v1=…</code> (HMAC-SHA256 de{" "}
        <code className="rounded bg-muted px-1">t.corps</code>) et <code className="rounded bg-muted px-1">X-Bleme-Id</code>{" "}
        (clé d’idempotence). Vérifiez la signature et rejetez au-delà de 5 min d’écart. Le contenu ne porte que des
        références (ids) : rappelez l’API avec votre clé pour le détail.
      </p>
    </div>
  );
}

function DeliveryBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    succeeded: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
    delivering: "bg-sky-50 text-sky-700 ring-sky-200",
    failed: "bg-orange-50 text-orange-700 ring-orange-200",
    dead: "bg-red-50 text-red-700 ring-red-200",
  };
  const labels: Record<string, string> = {
    succeeded: "Livré",
    pending: "En attente",
    delivering: "En cours",
    failed: "Échec (retry)",
    dead: "Abandonné",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${map[status] ?? "bg-muted text-muted-foreground ring-transparent"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function CreateForm() {
  const [state, action, pending] = useActionState(createWebhookEndpoint, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.secret) formRef.current?.reset();
  }, [state.secret]);

  return (
    <section className="rounded-[1.75rem] border bg-card p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
          <Webhook className="size-4.5" />
        </span>
        <h2 className="text-lg font-semibold">Nouvel endpoint</h2>
      </div>

      {state.secret ? <CopyBox secret={state.secret} /> : null}

      <form ref={formRef} action={action} className="mt-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wh-url" className="text-sm font-medium">
            URL (https)
          </label>
          <input
            id="wh-url"
            name="url"
            type="url"
            required
            placeholder="https://exemple.com/webhooks/bleme"
            className="w-full rounded-2xl border bg-background px-4 py-3 text-[15px] outline-none transition-all duration-300 focus:ring-2 focus:ring-brand"
          />
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-medium">Événements</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {WEBHOOK_EVENTS.map((ev) => (
              <label
                key={ev.type}
                className="flex cursor-pointer items-center gap-2.5 rounded-2xl border bg-background px-3.5 py-2.5 transition-colors hover:border-brand/40"
              >
                <input type="checkbox" name="events" value={ev.type} defaultChecked className="size-4 accent-brand" />
                <span className="text-sm">{ev.label}</span>
              </label>
            ))}
          </div>
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
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Créer l’endpoint
          </button>
        </div>
      </form>
    </section>
  );
}

function EndpointCard({ e }: { e: WebhookEndpointRow }) {
  const [test, testAction, testing] = useActionState(sendTestWebhook, INITIAL);
  const [toggle, toggleAction] = useActionState(setWebhookEnabled, INITIAL);
  const [rotate, rotateAction, rotating] = useActionState(rotateWebhookSecret, INITIAL);
  const [del, delAction, deleting] = useActionState(deleteWebhookEndpoint, INITIAL);
  const [confirmDel, setConfirmDel] = useState(false);
  const disabled = e.status === "disabled";

  return (
    <li className="rounded-2xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm">{e.url}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                disabled ? "bg-muted text-muted-foreground ring-transparent" : "bg-emerald-50 text-emerald-700 ring-emerald-200"
              }`}
            >
              {disabled ? "Désactivé" : "Actif"}
            </span>
            <span className="text-xs text-muted-foreground">
              {e.enabled_events.length} événement{e.enabled_events.length > 1 ? "s" : ""} · dernier envoi {when(e.last_delivery_at)}
              {e.failure_count > 0 ? ` · ${e.failure_count} échec(s)` : ""}
            </span>
          </p>
        </div>
      </div>

      {rotate.secret ? <CopyBox secret={rotate.secret} /> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={testAction}>
          <input type="hidden" name="id" value={e.id} />
          <button
            type="submit"
            disabled={testing || disabled}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground disabled:opacity-50"
          >
            {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Ping de test
          </button>
        </form>

        <form action={toggleAction}>
          <input type="hidden" name="id" value={e.id} />
          <input type="hidden" name="enable" value={disabled ? "true" : "false"} />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
          >
            {disabled ? "Réactiver" : "Désactiver"}
          </button>
        </form>

        <form action={rotateAction}>
          <input type="hidden" name="id" value={e.id} />
          <button
            type="submit"
            disabled={rotating}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground disabled:opacity-50"
          >
            {rotating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Nouveau secret
          </button>
        </form>

        {confirmDel ? (
          <form action={delAction} className="inline-flex items-center gap-2">
            <input type="hidden" name="id" value={e.id} />
            <button
              type="submit"
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Confirmer
            </button>
            <button type="button" onClick={() => setConfirmDel(false)} className="rounded-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">
              Annuler
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDel(true)}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-red-300 hover:text-red-600"
          >
            <Trash2 className="size-3.5" />
            Supprimer
          </button>
        )}
      </div>

      {test.error || test.success || toggle.error || rotate.error || del.error ? (
        <p className={`mt-2 text-xs ${test.success ? "text-emerald-600" : "text-red-600"}`}>
          {test.error || test.success || toggle.error || rotate.error || del.error}
        </p>
      ) : null}
    </li>
  );
}
