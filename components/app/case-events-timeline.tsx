// Chronologie verticale des évènements d'un dossier (composant serveur).
// Rend les évènements dans l'ordre reçu (déjà trié par l'appelant), avec
// pour chaque item une pastille + icône selon le type, le titre, la date
// formatée en FR, la description éventuelle et un badge de source (IA / auto / vous).

import {
  Circle,
  CheckCircle2,
  CircleCheck,
  FileText,
  Flag,
  HandCoins,
  Handshake,
  Mail,
  MessageCircle,
  PenLine,
  Send,
  ShieldQuestion,
  Sparkles,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from "lucide-react";

export type TimelineEvent = {
  date: string;
  type: string;
  title: string;
  description: string | null;
  source: string;
};

// Association type d'évènement → icône lucide. Types inconnus : Circle (défaut).
const TYPE_ICONS: Record<string, LucideIcon> = {
  created: Sparkles,
  documents: FileText,
  letter_ready: PenLine,
  letter_sent: Send,
  letter_tracking: Truck,
  response: PenLine,
  debtor_reply: MessageCircle,
  email: Mail,
  whatsapp_import: MessageCircle,
  whatsapp_message: MessageCircle,
  devil_review: ShieldQuestion,
  escalation_draft: Flag,
  escalation: Flag,
  settlement: Handshake,
  payment: CheckCircle2,
  payment_detected: HandCoins,
  closed: CircleCheck,
  risk_noted: TriangleAlert,
};

// Association source → libellé et style du badge.
const SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  ai: { label: "IA", className: "bg-brand-soft text-brand-strong" },
  system: { label: "auto", className: "bg-muted" },
  user: { label: "vous", className: "bg-emerald-100 text-emerald-700" },
};

function formatDateFr(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function CaseEventsTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun évènement pour l&apos;instant.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-4">
      {events.map((event, index) => {
        const Icon = TYPE_ICONS[event.type] ?? Circle;
        const badge = SOURCE_BADGES[event.source];

        return (
          <li key={index} className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium">{event.title}</span>
                {badge ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                ) : null}
              </div>
              <p className="text-xs tabular-nums text-muted-foreground">
                {formatDateFr(event.date)}
              </p>
              {event.description !== null ? (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {event.description}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
