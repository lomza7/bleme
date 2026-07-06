import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LETTER_KINDS } from "@/lib/cases/letter-meta";
import { PageHeader } from "@/components/app/ui";
import { RelanceCalendar, type CalEvent } from "@/components/app/relance-calendar";

export const metadata: Metadata = { title: "Agenda" };

/*
 * Agenda des relances — MES dossiers uniquement. Client user-scoped : les RLS
 * (organization_id in user_org_ids()) garantissent qu'on ne voit que les
 * dossiers de son organisation. On agrège les dates pilotées par les agents :
 * prochaines relances (Sacha), courriers envoyés (Marius), retours clients,
 * échéances de récupération. Le « distribué » (accusé Merci Facteur) s'ajoutera
 * quand l'envoi postal réel sera branché.
 */
export default async function AgendaPage() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: cases }, { data: letters }, { data: replies }] = await Promise.all([
    sb
      .from("cases")
      .select("id, title, status, next_action_at, next_action_label, next_letter_kind, expected_recovery_at")
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agenda des relances"
        sub="Toutes les échéances de vos dossiers, au même endroit. Vos agents les tiennent à jour."
      />
      <RelanceCalendar events={events} />
    </div>
  );
}
