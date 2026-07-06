"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Mail,
  ShieldCheck,
  Stamp,
} from "lucide-react";
import { approveAndSendLetter, type LetterState } from "@/lib/cases/letters";

const INITIAL: LetterState = {};

/**
 * Écran de relecture d'un courrier : contenu éditable, choix du canal, puis
 * validation explicite (« J'ai relu, envoyer en mon nom »). C'est cette
 * validation qui écrit le hash du contenu dans approval_logs — aucun envoi
 * sans elle.
 */
export function ReviewLetter({
  letter,
  caseId,
  embedded = false,
}: {
  letter: {
    id: string;
    subject: string;
    body_md: string;
    status: string;
    channel: string | null;
    approved_at: string | null;
  };
  caseId: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (prev: LetterState, fd: FormData) => {
      const res = await approveAndSendLetter(prev, fd);
      // Inline : on reste dans le flux (revalidatePath rafraîchit le RSC → statut
      // « envoyé »). Sur la page dédiée : retour au dossier.
      if (res.success) {
        if (embedded) router.refresh();
        else router.push(`/app/dossiers/${caseId}`);
      }
      return res;
    },
    INITIAL,
  );
  const [body, setBody] = useState(letter.body_md);
  const [channel, setChannel] = useState<"email" | "postal">("email");
  const sent = letter.status === "sent";
  const wrap = embedded ? "" : "rounded-[1.75rem] border bg-card p-6 sm:p-7";

  if (sent) {
    return (
      <div className={embedded ? "" : "rounded-[1.75rem] border bg-card p-7"}>
        <div className="flex items-center gap-2 text-emerald-700">
          <ShieldCheck className="size-5" />
          <h2 className="font-semibold">Courrier validé et envoyé</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Validé{letter.approved_at ? ` le ${new Date(letter.approved_at).toLocaleDateString("fr-FR")}` : ""} —
          {letter.channel === "postal" ? " lettre recommandée" : " email"}. La
          preuve de validation (hash du contenu) est archivée.
        </p>
        <article className="mt-5 whitespace-pre-line rounded-2xl bg-muted/50 p-5 text-[15px] leading-relaxed">
          {letter.body_md}
        </article>
      </div>
    );
  }

  return (
    <form action={action} className={wrap}>
      <input type="hidden" name="letterId" value={letter.id} />
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="body" value={body} />

      <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Objet
      </h2>
      <p className="mt-1 font-medium">{letter.subject}</p>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Relisez et corrigez si besoin
      </h2>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={16}
        className="mt-2 w-full rounded-2xl border bg-background p-4 text-[15px] leading-relaxed outline-none transition-colors focus:border-brand"
      />

      <div className="mt-5">
        <p className="text-sm font-medium">Mode d’envoi</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            { v: "email" as const, icon: Mail, label: "Email", desc: "Les réponses reviennent dans le dossier." },
            { v: "postal" as const, icon: Stamp, label: "Lettre recommandée", desc: "Valeur juridique, suivi de distribution." },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setChannel(o.v)}
              className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                channel === o.v ? "border-brand bg-brand-soft" : "hover:bg-muted/50"
              }`}
            >
              <o.icon className={`mt-0.5 size-5 shrink-0 ${channel === o.v ? "text-brand-strong" : "text-muted-foreground"}`} />
              <span>
                <span className="block text-sm font-medium">{o.label}</span>
                <span className="block text-xs text-muted-foreground">{o.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800 ring-1 ring-amber-200">
        Le courrier est envoyé <b>en votre nom</b>, jamais au nom de BLEME. En
        validant, vous confirmez avoir relu le contenu. Rien n’est envoyé sans
        cette validation.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          J’ai relu, envoyer en mon nom
        </button>
        {state.error ? (
          <span role="alert" className="flex items-center gap-2 text-sm text-red-600">
            <CircleAlert className="size-4 shrink-0" />
            {state.error}
          </span>
        ) : null}
        {state.success ? (
          <span role="status" className="flex items-center gap-2 text-sm text-emerald-700">
            <CircleCheck className="size-4 shrink-0" />
            {state.success}
          </span>
        ) : null}
      </div>
    </form>
  );
}
