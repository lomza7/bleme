// Carte d'un envoi sur la page Suivi (composant serveur, animations CSS).
//
// Hiérarchie voulue : le DOSSIER d'abord (c'est comme ça que l'utilisateur
// pense), puis le courrier, puis le voyage — un stepper horizontal à icônes
// qui se dessine en cascade au chargement (segments .anim-grow-x), le jalon
// courant pulsé (.anim-ring), le segment actif en pointillés qui défilent
// (.anim-dash), et la fraîcheur de la dernière information bien visible.
//
// Sémantique des couleurs respectée : brand = EN COURS uniquement — un envoi
// abouti (distribué, AR signé, réponse reçue) est émeraude, posé, sans
// pulsation ni pointillés. Budget d'animations : les boucles infinies
// (ring/dash) sont réservées aux premières cartes (animate) ; les halos
// animate-ping portent motion-reduce:hidden (convention du repo), les .anim-*
// sont coupées par globals.css sous prefers-reduced-motion.

import Link from "next/link";
import { Check, ChevronRight, Mail, Send, Stamp, TriangleAlert } from "lucide-react";
import { ALERT_STAGES, DONE_STAGES, trackingProgress } from "@/lib/courrier/tracking";
import { STEP_ICONS } from "@/components/app/letter-tracking";
import { LETTER_KINDS } from "@/lib/cases/letter-meta";
import { relativeTimeFr } from "@/lib/format";

export type EnvoiRow = {
  id: string;
  case_id: string;
  kind: string;
  channel: string | null;
  subject: string;
  sent_at: string | null;
  tracking_status: string | null;
  tracking_status_at: string | null;
  cases: { title: string } | null;
};

/**
 * Stepper horizontal du voyage : nœuds à icônes, segments qui se dessinent en
 * cascade, jalon courant pulsé, segment actif en pointillés animés.
 * `animate=false` fige les boucles infinies (cartes au-delà du pli).
 */
export function TrailWide({
  channel,
  sentAt,
  trackingStatus,
  baseDelayMs = 0,
  animate = true,
}: {
  channel: string | null;
  sentAt: string | null;
  trackingStatus: string | null;
  baseDelayMs?: number;
  animate?: boolean;
}) {
  const p = trackingProgress({ channel, sentAt, trackingStatus });
  const currentIdx = Math.max(0, p.done - 1);
  // Terminal heureux : plus rien « en cours » — tout est émeraude, statique.
  const finished = DONE_STAGES.has(trackingStatus ?? "");
  return (
    <div className="flex items-center" aria-hidden>
      {p.steps.map((s, i) => {
        const done = s.rank <= p.rank;
        const current = i === currentIdx && done && !finished;
        const Icon = STEP_ICONS[s.key] ?? Send;
        return (
          <div key={s.key} className={`flex items-center ${i > 0 ? "min-w-0 flex-1" : ""}`}>
            {i > 0 ? (
              done ? (
                // Segment franchi : se dessine de gauche à droite, en cascade.
                <span
                  className="anim-grow-x mx-1 h-0.5 min-w-3 flex-1 rounded-full bg-emerald-400"
                  style={{ "--delay": `${baseDelayMs + i * 110}ms` } as React.CSSProperties}
                />
              ) : i === currentIdx + 1 && !p.alert && !finished ? (
                // Segment actif : pointillés qui défilent vers le prochain jalon
                // (période 8 = diviseur de l'offset -128 → boucle sans à-coup).
                <svg
                  className="mx-1 h-1 min-w-3 flex-1"
                  viewBox="0 0 60 2"
                  preserveAspectRatio="none"
                >
                  <line
                    x1="0"
                    y1="1"
                    x2="60"
                    y2="1"
                    className={`stroke-brand/60 ${animate ? "anim-dash" : ""}`}
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              ) : (
                <span className="mx-1 h-0.5 min-w-3 flex-1 rounded-full bg-border" />
              )
            ) : null}
            <span className="relative flex size-7 shrink-0 items-center justify-center">
              {current && !p.alert && animate ? (
                <span className="anim-ring absolute inset-0 rounded-full bg-brand/40" />
              ) : null}
              <span
                className={`relative flex size-7 items-center justify-center rounded-full ${
                  current
                    ? p.alert
                      ? "bg-amber-100 text-amber-700"
                      : "bg-brand text-brand-foreground"
                    : done
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {current && p.alert ? (
                  <TriangleAlert className="size-3.5" />
                ) : done && !current ? (
                  <Check className="size-3.5" />
                ) : (
                  <Icon className="size-3.5" />
                )}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Point de fraîcheur : pulse tant que la dernière info a moins de 24 h. */
export function FreshnessDot({
  tone,
  fresh,
}: {
  tone: "brand" | "emerald" | "amber";
  fresh: boolean;
}) {
  const solid =
    tone === "amber" ? "bg-amber-500" : tone === "emerald" ? "bg-emerald-500" : "bg-brand";
  return (
    <span className="relative flex size-2">
      {fresh ? (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden ${solid}`}
        />
      ) : null}
      <span className={`relative inline-flex size-2 rounded-full ${solid}`} />
    </span>
  );
}

export function EnvoiCard({ envoi, index = 0 }: { envoi: EnvoiRow; index?: number }) {
  const kindLabel = LETTER_KINDS[envoi.kind]?.label ?? "Courrier";
  const postal = envoi.channel === "postal";
  const alert = ALERT_STAGES.has(envoi.tracking_status ?? "");
  const done = DONE_STAGES.has(envoi.tracking_status ?? "");
  const p = trackingProgress({
    channel: envoi.channel,
    sentAt: envoi.sent_at,
    trackingStatus: envoi.tracking_status,
  });
  const lastAt = envoi.tracking_status_at ?? envoi.sent_at;
  // Rendu serveur (page dynamique) : l'horloge de la requête fait foi.
  // eslint-disable-next-line react-hooks/purity
  const fresh = lastAt ? Date.now() - new Date(lastAt).getTime() < 24 * 3600 * 1000 : false;
  const tone = alert ? "amber" : done ? "emerald" : "brand";
  const delay = Math.min(index, 8) * 80;

  return (
    <Link
      href={`/app/dossiers/${envoi.case_id}/courrier/${envoi.id}`}
      className={`anim-load group rounded-2xl border bg-card p-4 outline-none transition-all duration-500 ease-fluid hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-lg hover:shadow-zinc-950/[0.05] focus-visible:border-brand/50 focus-visible:ring-2 focus-visible:ring-brand/40 sm:p-5 ${
        alert ? "ring-1 ring-amber-200" : ""
      }`}
      style={{ "--delay": `${delay}ms` } as React.CSSProperties}
    >
      {/* Ligne 1 — le dossier d'abord, la fraîcheur à droite. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
              alert
                ? "bg-amber-100 text-amber-700"
                : done
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-brand-soft text-brand-strong"
            }`}
          >
            {postal ? <Stamp className="size-4.5" /> : <Mail className="size-4.5" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold">
              {envoi.cases?.title ?? envoi.subject}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {kindLabel} · {postal ? "recommandé" : "email"}
              {envoi.cases?.title ? ` · ${envoi.subject}` : ""}
            </span>
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-2 pt-0.5">
          {lastAt ? (
            <span className="flex items-center gap-1.5">
              <FreshnessDot tone={tone} fresh={fresh} />
              <span className="text-xs tabular-nums text-muted-foreground">
                {relativeTimeFr(lastAt)}
              </span>
            </span>
          ) : null}
          <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" />
        </span>
      </div>

      {/* Ligne 2 — le voyage. */}
      <div className="mt-4">
        <TrailWide
          channel={envoi.channel}
          sentAt={envoi.sent_at}
          trackingStatus={envoi.tracking_status}
          baseDelayMs={delay + 150}
          animate={index < 6}
        />
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span
            className={`line-clamp-2 text-[13px] font-medium ${
              alert ? "text-amber-700" : done ? "text-emerald-700" : "text-foreground"
            }`}
          >
            {p.label}
          </span>
          {!alert ? (
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {p.done}/{p.steps.length}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

/**
 * Trail de démonstration pour l'état vide : le voyage type d'un recommandé,
 * animé — la promesse se voit avant le premier envoi. Grille à colonnes
 * égales : les libellés restent alignés sous leur jalon, connecteurs dessinés
 * de centre à centre derrière les nœuds.
 */
export function DemoTrail() {
  const steps: { key: string; label: string }[] = [
    { key: "submitted", label: "Envoyé" },
    { key: "printed", label: "Imprimé, posté" },
    { key: "in_transit", label: "En acheminement" },
    { key: "delivered", label: "Distribué" },
    { key: "ar_signed", label: "AR signé" },
  ];
  const currentIdx = 2;
  return (
    <div className="w-full max-w-md" aria-hidden>
      <div className="grid grid-cols-5">
        {steps.map((s, i) => {
          const done = i < currentIdx;
          const current = i === currentIdx;
          const Icon = STEP_ICONS[s.key] ?? Send;
          return (
            <div key={s.key} className="relative flex flex-col items-center gap-1.5">
              {/* Connecteur : du centre de la colonne précédente au centre de
                  celle-ci, derrière le nœud. */}
              {i > 0 ? (
                i <= currentIdx ? (
                  <span
                    className="anim-grow-x absolute left-[-50%] top-3 h-0.5 w-full rounded-full bg-emerald-400"
                    style={{ "--delay": `${i * 160}ms` } as React.CSSProperties}
                  />
                ) : i === currentIdx + 1 ? (
                  <svg
                    className="absolute left-[-50%] top-2.5 h-1 w-full"
                    viewBox="0 0 60 2"
                    preserveAspectRatio="none"
                  >
                    <line
                      x1="0"
                      y1="1"
                      x2="60"
                      y2="1"
                      className="anim-dash stroke-brand/60"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                ) : (
                  <span className="absolute left-[-50%] top-3 h-0.5 w-full rounded-full bg-border" />
                )
              ) : null}
              <span className="relative flex size-6 shrink-0 items-center justify-center">
                {current ? (
                  <span className="anim-ring absolute inset-0 rounded-full bg-brand/40" />
                ) : null}
                <span
                  className={`relative flex size-6 items-center justify-center rounded-full ${
                    current
                      ? "bg-brand text-brand-foreground"
                      : done
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="size-3" /> : <Icon className="size-3" />}
                </span>
              </span>
              <span
                className={`hidden text-center text-[10px] leading-tight min-[400px]:block ${
                  current ? "font-semibold text-brand-strong" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
