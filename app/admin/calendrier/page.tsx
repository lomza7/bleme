import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { LETTER_KINDS } from "@/lib/cases/letter-meta";
import { RelanceCalendar, type CalEvent } from "@/components/admin/relance-calendar";

export const metadata: Metadata = { title: "Calendrier des relances" };

/*
 * Calendrier des relances (cross-organisations, service-role). Agrège les dates
 * pilotées par les agents : prochaines relances (Sacha), courriers envoyés
 * (Marius), retours clients, échéances de récupération. Le « distribué » (accusé
 * Merci Facteur) s'ajoutera quand l'envoi postal réel sera branché.
 */
export default async function AdminCalendrierPage() {
  const sb = createServiceClient();
  const [{ data: cases }, { data: letters }, { data: replies }] = await Promise.all([
    sb
      .from("cases")
      .select("id, title, status, case_type, next_action_at, next_action_label, next_letter_kind, expected_recovery_at")
      .eq("is_sample", false),
    sb.from("letters").select("case_id, kind, sent_at").not("sent_at", "is", null),
    sb.from("debtor_replies").select("case_id, received_at"),
  ]);

  const titleById = new Map((cases ?? []).map((c) => [c.id, c.title]));
  const open = (s: string) => s !== "resolved" && s !== "closed";
  const events: CalEvent[] = [];

  for (const c of cases ?? []) {
    if (c.next_action_at && open(c.status)) {
      events.push({
        date: c.next_action_at,
        type: "relance",
        caseId: c.id,
        title: c.title,
        label:
          c.next_action_label ||
          (c.next_letter_kind ? `Relance : ${LETTER_KINDS[c.next_letter_kind]?.label ?? c.next_letter_kind}` : "Prochaine action"),
        agent: "sacha",
      });
    }
    if (c.expected_recovery_at && open(c.status)) {
      events.push({
        date: c.expected_recovery_at,
        type: "recovery",
        caseId: c.id,
        title: c.title,
        label: "Échéance de récupération estimée",
        agent: null,
      });
    }
  }
  for (const l of letters ?? []) {
    events.push({
      date: l.sent_at,
      type: "sent",
      caseId: l.case_id,
      title: titleById.get(l.case_id) ?? "Dossier",
      label: `Envoyé : ${LETTER_KINDS[l.kind]?.label ?? l.kind}`,
      agent: "marius",
    });
  }
  for (const r of replies ?? []) {
    events.push({
      date: r.received_at,
      type: "reply",
      caseId: r.case_id,
      title: titleById.get(r.case_id) ?? "Dossier",
      label: "Retour du client",
      agent: null,
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Calendrier des relances</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Toutes les échéances de tous les dossiers, au même endroit. Alimenté par les agents : Sacha planifie les relances, Marius trace les envois.
      </p>
      <div className="mt-6">
        <RelanceCalendar events={events} />
      </div>
    </div>
  );
}
