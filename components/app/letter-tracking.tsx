// Suivi d'envoi type « suivi colis » (composants serveur, animations CSS
// uniquement — anim-ring/reduced-motion gérés dans globals.css).
//
// Trois niveaux de zoom :
//  - TrackingDots      : pastilles de progression (carte dossier, très compact)
//  - LetterTrackingCompact : pastilles + situation courante (ligne de courrier)
//  - LetterTrackingPanel   : stepper vertical détaillé avec chaque passage
//    horodaté (page du courrier) + lien de suivi La Poste + alertes.

import {
  Check,
  ExternalLink,
  FileSignature,
  MailCheck,
  MailOpen,
  Mailbox,
  Printer,
  Reply,
  Send,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from "lucide-react";
import {
  ALERT_STAGES,
  laPosteTrackingUrl,
  stepKeyFor,
  trackingProgress,
} from "@/lib/courrier/tracking";
import { relativeDays } from "@/lib/format";

export type TrackingInfo = {
  channel: string | null;
  sentAt: string | null;
  trackingStatus: string | null;
  trackingStatusAt?: string | null;
};

export type TrackingEventRow = {
  stage: string;
  label: string;
  detail: string | null;
  occurred_at: string;
};

// Marche à suivre factuelle par anomalie — chaque étape a la sienne (un
// incident d'acheminement n'est pas un problème d'adresse).
const ALERT_ADVICE: Record<string, string> = {
  returned: "Vérifiez l’adresse du destinataire, puis renvoyez le courrier.",
  problem: "Incident signalé par La Poste — l’acheminement peut reprendre. Suivez l’évolution avant tout nouvel envoi.",
  bounced: "Vérifiez l’adresse email du destinataire, ou envoyez en recommandé.",
  failed: "L’envoi n’a pas abouti. Vérifiez l’adresse email du destinataire, ou envoyez en recommandé.",
  suppressed: "Adresse bloquée après des échecs répétés — corrigez l’adresse email, ou envoyez en recommandé.",
  complained: "Le destinataire a signalé cet email comme indésirable. Privilégiez un envoi en recommandé.",
};

const STEP_ICONS: Record<string, LucideIcon> = {
  submitted: Send,
  printed: Printer,
  in_transit: Truck,
  delivered: Mailbox,
  ar_signed: FileSignature,
  email_delivered: MailCheck,
  opened: MailOpen,
  replied: Reply,
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
  });
  const time = d.toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} à ${time}`;
}

/** Pastilles de progression, sans texte (aria-label porte l'info). */
export function TrackingDots({
  tracking,
  className = "",
}: {
  tracking: TrackingInfo;
  className?: string;
}) {
  const p = trackingProgress(tracking);
  if (!tracking.sentAt) return null;
  return (
    <span
      className={`inline-flex items-center ${className}`}
      role="img"
      aria-label={`Suivi de l’envoi : ${p.label}`}
    >
      {p.steps.map((s, i) => {
        const done = s.rank <= p.rank;
        const current = done && (i === p.steps.length - 1 || p.steps[i + 1].rank > p.rank);
        return (
          <span key={s.key} className="flex items-center">
            {i > 0 ? (
              <span
                className={`h-px w-3 sm:w-4 ${done ? "bg-emerald-400" : "bg-border"}`}
              />
            ) : null}
            <span className="relative flex size-2 items-center justify-center">
              {current && !p.alert ? (
                <span className="anim-ring absolute inset-0 rounded-full bg-brand/50" />
              ) : null}
              <span
                className={`size-2 rounded-full ${
                  current
                    ? p.alert
                      ? "bg-amber-500"
                      : "bg-brand"
                    : done
                      ? "bg-emerald-500"
                      : "border border-border bg-muted"
                }`}
              />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Ligne compacte : pastilles + situation courante + fraîcheur. */
export function LetterTrackingCompact({ tracking }: { tracking: TrackingInfo }) {
  if (!tracking.sentAt) return null;
  const p = trackingProgress(tracking);
  return (
    <span className="mt-1 flex min-w-0 items-center gap-2">
      <TrackingDots tracking={tracking} className="shrink-0" />
      <span
        className={`truncate text-xs ${p.alert ? "font-medium text-amber-700" : "text-muted-foreground"}`}
      >
        {p.label}
        {tracking.trackingStatusAt ? ` · ${relativeDays(tracking.trackingStatusAt)}` : ""}
      </span>
    </span>
  );
}

/**
 * Stepper vertical détaillé : un jalon par étape, chaque passage horodaté en
 * sous-ligne (pris en charge, en cours de distribution…), segment courant
 * animé, alertes (pli retourné, email non délivré) et lien La Poste.
 */
export function LetterTrackingPanel({
  tracking,
  trackingNumber,
  events,
}: {
  tracking: TrackingInfo;
  trackingNumber?: string | null;
  /** letter_tracking_events du courrier, ordre chronologique croissant. */
  events: TrackingEventRow[];
}) {
  if (!tracking.sentAt) return null;
  const p = trackingProgress(tracking);
  const alertEvent = [...events].reverse().find((e) => ALERT_STAGES.has(e.stage));

  return (
    <div className="mt-5 rounded-2xl border bg-background p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Suivi de l’envoi
        </h3>
        {tracking.channel === "postal" && trackingNumber ? (
          <a
            href={laPosteTrackingUrl(trackingNumber)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-strong hover:underline"
          >
            Suivre sur laposte.fr · {trackingNumber}
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>

      {p.alert ? (
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800 ring-1 ring-amber-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            {p.label}
            {alertEvent?.detail ? ` — ${alertEvent.detail}` : ""}{" "}
            {ALERT_ADVICE[tracking.trackingStatus ?? ""] ?? ""}
          </span>
        </p>
      ) : null}

      <ol className="mt-4 flex flex-col">
        {p.steps.map((s, i) => {
          const done = s.rank <= p.rank;
          const current = done && (i === p.steps.length - 1 || p.steps[i + 1].rank > p.rank);
          const last = i === p.steps.length - 1;
          const Icon = STEP_ICONS[s.key] ?? Send;
          const stepEvents =
            s.key === "submitted"
              ? []
              : events.filter((e) => stepKeyFor(tracking.channel, e.stage) === s.key);
          return (
            <li key={s.key} className="flex gap-3">
              {/* Colonne pastille + connecteur */}
              <div className="flex flex-col items-center">
                <span className="relative flex size-8 shrink-0 items-center justify-center">
                  {current && !p.alert ? (
                    <span className="anim-ring absolute inset-0 rounded-full bg-brand/40" />
                  ) : null}
                  <span
                    className={`relative flex size-8 items-center justify-center rounded-full ${
                      current
                        ? p.alert
                          ? "bg-amber-100 text-amber-700"
                          : "bg-brand text-brand-foreground"
                        : done
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done && !current ? (
                      <Check className="size-4" aria-hidden />
                    ) : (
                      <Icon className="size-4" aria-hidden />
                    )}
                  </span>
                </span>
                {!last ? (
                  <span
                    className={`w-px flex-1 ${
                      p.steps[i + 1].rank <= p.rank
                        ? "bg-emerald-300"
                        : current
                          ? "bg-[linear-gradient(to_bottom,var(--color-brand)_50%,transparent_50%)] bg-[length:1px_8px]"
                          : "bg-border"
                    }`}
                    style={{ minHeight: "0.9rem" }}
                  />
                ) : null}
              </div>
              {/* Contenu du jalon */}
              <div className={`min-w-0 flex-1 ${last ? "" : "pb-4"}`}>
                <p
                  className={`text-sm leading-8 ${
                    current
                      ? "font-semibold"
                      : done
                        ? "font-medium"
                        : "text-muted-foreground"
                  }`}
                >
                  {s.short}
                  {s.key === "opened" ? (
                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                      (indicatif)
                    </span>
                  ) : null}
                </p>
                {s.key === "submitted" && tracking.sentAt ? (
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {fmtDateTime(tracking.sentAt)}
                  </p>
                ) : null}
                {stepEvents.map((e, j) => (
                  <p key={j} className="mt-0.5 text-xs text-muted-foreground">
                    <span className={e.stage === "returned" || e.stage === "problem" ? "text-amber-700" : ""}>
                      {e.label}
                    </span>{" "}
                    <span className="tabular-nums">— {fmtDateTime(e.occurred_at)}</span>
                  </p>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
