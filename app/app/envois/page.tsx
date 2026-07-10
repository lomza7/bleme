import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Mail, PackageSearch, Stamp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/ui";
import { LetterTrackingCompact } from "@/components/app/letter-tracking";
import { LETTER_KINDS } from "@/lib/cases/letter-meta";
import { ALERT_STAGES } from "@/lib/courrier/tracking";

export const metadata: Metadata = { title: "Suivi des envois" };

/*
 * Vitrine du suivi : TOUS les courriers réellement partis de l'organisation,
 * chacun avec sa progression type « suivi colis » (webhooks Merci Facteur /
 * Resend). L'utilisateur voit d'un coup d'œil où en est chaque démarche —
 * sans ouvrir les dossiers un par un.
 */

// Jalons terminaux « heureux » : le pli/l'email est arrivé (ou mieux).
const DONE_STAGES = new Set(["delivered", "ar_signed", "replied"]);

const FILTRES = [
  { key: "tous", label: "Tous" },
  { key: "en-cours", label: "En cours" },
  { key: "aboutis", label: "Aboutis" },
  { key: "a-verifier", label: "À vérifier" },
] as const;

type SentLetter = {
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

function bucket(l: SentLetter): "en-cours" | "aboutis" | "a-verifier" {
  if (ALERT_STAGES.has(l.tracking_status ?? "")) return "a-verifier";
  if (DONE_STAGES.has(l.tracking_status ?? "")) return "aboutis";
  return "en-cours";
}

export default async function EnvoisPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const { filtre = "tous" } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("letters")
    .select(
      "id, case_id, kind, channel, subject, sent_at, tracking_status, tracking_status_at, cases(title)",
    )
    .eq("status", "sent")
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(200)
    .returns<SentLetter[]>();

  const all = data ?? [];
  const counts = { tous: all.length, "en-cours": 0, aboutis: 0, "a-verifier": 0 };
  for (const l of all) counts[bucket(l)] += 1;
  const filtered = filtre === "tous" ? all : all.filter((l) => bucket(l) === filtre);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Suivi des envois"
        sub="Chaque courrier suivi en temps réel, de l’impression à l’accusé de réception — et chaque email jusqu’à la réponse."
      />

      <div className="flex flex-wrap gap-1.5">
        {FILTRES.map((f) => {
          const active = f.key === filtre;
          const n = counts[f.key];
          return (
            <Link
              key={f.key}
              href={f.key === "tous" ? "/app/envois" : `/app/envois?filtre=${f.key}`}
              className={
                active
                  ? "rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground"
                  : "rounded-full border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground"
              }
            >
              {f.label}
              {n > 0 ? <span className="ml-1.5 opacity-70">{n}</span> : null}
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-[1.75rem] border bg-card p-10">
          <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
            <PackageSearch className="size-5" />
          </span>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            {all.length === 0
              ? "Dès qu’un courrier part, il apparaît ici avec son suivi en temps réel : imprimé, remis à La Poste, distribué, accusé de réception signé — et pour les emails : délivré, ouvert, réponse reçue. Vous êtes prévenu à chaque étape (cloche et email)."
              : "Aucun envoi ne correspond à ce filtre."}
          </p>
          {all.length === 0 ? (
            <Link
              href="/app/dossiers"
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong"
            >
              Voir mes dossiers
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((l) => {
            const kindLabel = LETTER_KINDS[l.kind]?.label ?? "Courrier";
            const postal = l.channel === "postal";
            const alert = ALERT_STAGES.has(l.tracking_status ?? "");
            return (
              <Link
                key={l.id}
                href={`/app/dossiers/${l.case_id}/courrier/${l.id}`}
                className={`flex flex-col gap-2 rounded-2xl border bg-card p-4 transition-colors duration-300 hover:border-brand/50 hover:bg-brand-soft/40 sm:flex-row sm:items-center sm:gap-4 ${
                  alert ? "ring-1 ring-amber-200" : ""
                }`}
              >
                <span className="flex min-w-0 items-center gap-3 sm:flex-1">
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                      alert ? "bg-amber-100 text-amber-700" : "bg-brand-soft text-brand-strong"
                    }`}
                  >
                    {postal ? <Stamp className="size-4" /> : <Mail className="size-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {kindLabel}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {postal ? "recommandé" : "email"}
                        {l.cases?.title ? ` · ${l.cases.title}` : ""}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {l.subject}
                    </span>
                  </span>
                </span>
                <span className="min-w-0 sm:w-80 sm:shrink-0">
                  <LetterTrackingCompact
                    tracking={{
                      channel: l.channel,
                      sentAt: l.sent_at,
                      trackingStatus: l.tracking_status,
                      trackingStatusAt: l.tracking_status_at,
                    }}
                  />
                </span>
                <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
