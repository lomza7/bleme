"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CircleAlert,
  CircleCheck,
  Landmark,
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
/** Adresse postale préremplissable (dernière saisie utilisateur — jamais devinée). */
export type AddressDefaults = {
  nom?: string | null;
  societe?: string | null;
  adresse?: string | null;
  complement?: string | null;
  codePostal?: string | null;
  ville?: string | null;
} | null;

export function ReviewLetter({
  letter,
  caseId,
  embedded = false,
  defaultEmail = "",
  defaultToAddress = null,
  defaultFromAddress = null,
  suggestedRecipients = [],
}: {
  letter: {
    id: string;
    subject: string;
    body_md: string;
    status: string;
    channel: string | null;
    approved_at: string | null;
    /** Renseigné UNIQUEMENT si le courrier est réellement parti (journal honnête). */
    sent_at?: string | null;
  };
  caseId: string;
  embedded?: boolean;
  /** Email du débiteur déjà connu (préremplissage) ; l'utilisateur peut le corriger. */
  defaultEmail?: string;
  /** Adresses postales déjà connues (dossier / organisation), corrigeables. */
  defaultToAddress?: AddressDefaults;
  defaultFromAddress?: AddressDefaults;
  /** Destinataires proposés par Basile (démarche admin) : choix en un clic. */
  suggestedRecipients?: SuggestedRecipient[];
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
  const [toEmail, setToEmail] = useState(defaultEmail);
  const [toAddr, setToAddr] = useState<AddrState>(() => toAddrState(defaultToAddress));
  const [fromAddr, setFromAddr] = useState<AddrState>(() => toAddrState(defaultFromAddress));
  const sent = letter.status === "sent";
  const wrap = embedded ? "" : "rounded-[1.75rem] border bg-card p-6 sm:p-7";

  if (sent) {
    const reallySent = Boolean(letter.sent_at);
    return (
      <div className={embedded ? "" : "rounded-[1.75rem] border bg-card p-7"}>
        <div className="flex items-center gap-2 text-emerald-700">
          <ShieldCheck className="size-5" />
          <h2 className="font-semibold">{reallySent ? "Courrier validé et envoyé" : "Courrier validé"}</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Validé{letter.approved_at ? ` le ${new Date(letter.approved_at).toLocaleDateString("fr-FR")}` : ""} —
          {letter.channel === "postal" ? " lettre recommandée" : " email"}. La
          preuve de validation (hash du contenu) est archivée.
        </p>
        {!reallySent ? (
          <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800 ring-1 ring-amber-200">
            Votre validation et sa preuve sont enregistrées ; l’expédition réelle n’est pas
            encore partie (interrupteur d’envoi ou coordonnées à compléter — voir la chronologie).
          </p>
        ) : null}
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
      <input type="hidden" name="toEmail" value={channel === "email" ? toEmail : ""} />

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

      {channel === "email" ? (
        <div className="mt-4">
          <label htmlFor="toEmail" className="text-sm font-medium">
            Email du destinataire
          </label>
          <input
            id="toEmail"
            type="email"
            value={toEmail}
            onChange={(e) => setToEmail(e.target.value)}
            placeholder="destinataire@exemple.fr"
            className="mt-1.5 w-full rounded-2xl border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Les réponses reviennent dans votre boîte de réception BLEME. Vérifiez l’adresse : le
            courrier part à cette adresse exacte.
          </p>
        </div>
      ) : (
        <div className="mt-4">
          {suggestedRecipients.length > 0 ? (
            <div className="mb-4 rounded-2xl border border-brand/30 bg-brand-soft/40 p-4">
              <p className="text-sm font-medium">
                {suggestedRecipients.length > 1
                  ? "Destinataires proposés par Basile"
                  : "Destinataire proposé par Basile"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Adresses issues de l’annuaire officiel. Choisissez : les champs se remplissent, vous
                gardez la main.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {suggestedRecipients.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => r.address && setToAddr(toAddrState(r.address))}
                    disabled={!r.address}
                    className="flex items-start gap-3 rounded-xl border bg-background p-3 text-left transition-colors hover:border-brand/60 hover:bg-brand-soft/50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Landmark className="mt-0.5 size-4 shrink-0 text-brand-strong" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{r.nom}</span>
                      <span className="block text-xs text-muted-foreground">
                        {r.address
                          ? `${r.address.codePostal} ${r.address.ville}${r.motif ? ` · ${r.motif}` : ""}`
                          : `Adresse à compléter${r.motif ? ` · ${r.motif}` : ""}`}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <AddressFields
              legend="Destinataire"
              prefix="to"
              value={toAddr}
              onChange={setToAddr}
              hint="Le nom (ou l’organisme) et l’adresse imprimés sur le recommandé."
            />
            <AddressFields
              legend="Expéditeur (vous)"
              prefix="from"
              value={fromAddr}
              onChange={setFromAddr}
              hint="Votre adresse : elle figure sur la lettre et reçoit les retours."
            />
          </div>
        </div>
      )}

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

const addressInputCls =
  "w-full rounded-2xl border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand";

type AddrState = { nom: string; societe: string; adresse: string; complement: string; codePostal: string; ville: string };

/** Destinataire proposé par l'agent (nom + motif + adresse officielle résolue). */
export type SuggestedRecipient = { nom: string; motif: string; address: AddressDefaults };

function toAddrState(a: AddressDefaults): AddrState {
  return {
    nom: a?.nom ?? "",
    societe: a?.societe ?? "",
    adresse: a?.adresse ?? "",
    complement: a?.complement ?? "",
    codePostal: a?.codePostal ?? "",
    ville: a?.ville ?? "",
  };
}

/** Bloc d'adresse postale CONTRÔLÉ (champs nommés `{prefix}Nom`, `{prefix}Adresse`…). */
function AddressFields({
  legend,
  prefix,
  value,
  onChange,
  hint,
}: {
  legend: string;
  prefix: "to" | "from";
  value: AddrState;
  onChange: (v: AddrState) => void;
  hint: string;
}) {
  const set = (k: keyof AddrState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });
  return (
    <fieldset className="rounded-2xl border p-4">
      <legend className="px-1.5 text-sm font-medium">{legend}</legend>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="mt-3 flex flex-col gap-2.5">
        <input name={`${prefix}Nom`} value={value.nom} onChange={set("nom")} placeholder="Nom, prénom" className={addressInputCls} />
        <input name={`${prefix}Societe`} value={value.societe} onChange={set("societe")} placeholder="Organisme / société (facultatif)" className={addressInputCls} />
        <input name={`${prefix}Adresse`} value={value.adresse} onChange={set("adresse")} placeholder="N° et voie" className={addressInputCls} />
        <input name={`${prefix}Complement`} value={value.complement} onChange={set("complement")} placeholder="Complément (bâtiment, service…) — facultatif" className={addressInputCls} />
        <div className="grid grid-cols-[7rem_1fr] gap-2.5">
          <input name={`${prefix}Cp`} value={value.codePostal} onChange={set("codePostal")} placeholder="75800" inputMode="numeric" className={addressInputCls} />
          <input name={`${prefix}Ville`} value={value.ville} onChange={set("ville")} placeholder="Ville" className={addressInputCls} />
        </div>
      </div>
    </fieldset>
  );
}
