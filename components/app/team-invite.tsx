"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useFormStatus } from "react-dom";
import {
  ArrowRight,
  Calculator,
  Check,
  ChevronLeft,
  CircleAlert,
  Copy,
  Link2,
  LoaderCircle,
  RefreshCw,
  Scale,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  resendInvitation,
  revokeInvitation,
  sendInvitation,
  type InviteKind,
  type InviteState,
} from "@/lib/team/actions";

/*
 * Flux d'invitation en modale, en trois temps : choix (équipe / comptable /
 * avocat) → formulaire adapté → confirmation. Animé avec motion/react et la
 * courbe maison [0.16, 1, 0.3, 1], en cascade, magnétique, mobile-first (feuille
 * qui monte du bas sur téléphone). Respecte prefers-reduced-motion.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

type KindMeta = {
  label: string;
  short: string;
  desc: string;
  icon: typeof Users;
  tile: string;
};

const KINDS: Record<InviteKind, KindMeta> = {
  team: {
    label: "Un membre de mon équipe",
    short: "Membre d'équipe",
    desc: "Associé, conjoint, salarié — il rejoint votre espace, suit les dossiers et aide à préparer et valider les envois.",
    icon: Users,
    tile: "bg-brand-soft text-brand-strong ring-brand/15",
  },
  accountant: {
    label: "Mon expert-comptable",
    short: "Expert-comptable",
    desc: "Il suit vos factures et vos relances. On lui envoie une invitation soignée à votre nom.",
    icon: Calculator,
    tile: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  lawyer: {
    label: "Mon avocat",
    short: "Avocat",
    desc: "Pour vos litiges. On garde ses coordonnées et on l'invite à échanger avec vous par email.",
    icon: Scale,
    tile: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  },
};

const inputClass =
  "w-full rounded-2xl border bg-background px-4 py-3 text-[15px] transition-all duration-300 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-brand";

// ── Bouton d'ouverture + orchestration de la modale ──────────────────────────
export function InviteButton({ canGrantAdmin = false }: { canGrantAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-2.5 rounded-full bg-brand py-2.5 pl-5 pr-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
      >
        Inviter quelqu’un
        <span className="flex size-7 items-center justify-center rounded-full bg-white/20 transition-transform duration-500 ease-fluid group-hover:translate-x-0.5">
          <UserPlus className="size-4" />
        </span>
      </button>
      <AnimatePresence>
        {open ? (
          <InviteFlow key="invite-flow" canGrantAdmin={canGrantAdmin} onClose={() => setOpen(false)} />
        ) : null}
      </AnimatePresence>
    </>
  );
}

type Step = "choose" | "form" | "success";

function InviteFlow({
  canGrantAdmin,
  onClose,
}: {
  canGrantAdmin: boolean;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose");
  const [kind, setKind] = useState<InviteKind | null>(null);
  const [result, setResult] = useState<InviteState>({});
  const [pending, startTransition] = useTransition();

  const dialogRef = useRef<HTMLDivElement>(null);

  // Fermeture propre : on rafraîchit pour synchroniser la liste des invitations.
  const close = () => {
    if (result.success) router.refresh();
    onClose();
  };
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  // Verrou du scroll, touche Échap, focus initial + piège de focus + restauration
  // du focus sur l'élément déclencheur à la fermeture (accessibilité modale).
  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement as HTMLElement | null;
    dialog?.focus();

    const focusables = (): HTMLElement[] =>
      dialog
        ? Array.from(
            dialog.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => el.offsetParent !== null)
        : [];

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || active === dialog || !dialog.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, []);

  const choose = (k: InviteKind) => {
    setKind(k);
    setResult({});
    setStep("form");
  };

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const res = await sendInvitation({}, formData);
      setResult(res);
      if (res.success) setStep("success");
    });
  };

  const transition = { duration: reduce ? 0 : 0.45, ease: EASE };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <motion.button
        type="button"
        aria-label="Fermer"
        onClick={close}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-sm"
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal
        aria-label="Inviter quelqu’un"
        tabIndex={-1}
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
        transition={transition}
        className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border bg-card shadow-2xl shadow-ink/10 outline-none sm:max-w-lg sm:rounded-[1.75rem]"
      >
        <AnimatePresence mode="wait" initial={false}>
          {step === "choose" ? (
            <motion.div
              key="choose"
              initial={reduce ? false : { opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16 }}
              transition={transition}
              className="flex min-h-0 flex-1 flex-col"
            >
              <ChooseStep onClose={close} onChoose={choose} reduce={!!reduce} />
            </motion.div>
          ) : step === "form" && kind ? (
            <motion.div
              key="form"
              initial={reduce ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16 }}
              transition={transition}
              className="flex min-h-0 flex-1 flex-col"
            >
              <FormStep
                kind={kind}
                canGrantAdmin={canGrantAdmin}
                pending={pending}
                error={result.error}
                onBack={() => setStep("choose")}
                onSubmit={submit}
              />
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={reduce ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={transition}
              className="flex min-h-0 flex-1 flex-col"
            >
              <SuccessStep
                result={result}
                reduce={!!reduce}
                onAgain={() => {
                  setKind(null);
                  setResult({});
                  setStep("choose");
                }}
                onClose={close}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ── Étape 1 : choix du type ──────────────────────────────────────────────────
function ChooseStep({
  onClose,
  onChoose,
  reduce,
}: {
  onClose: () => void;
  onChoose: (k: InviteKind) => void;
  reduce: boolean;
}) {
  const order: InviteKind[] = ["team", "accountant", "lawyer"];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-4 border-b bg-gradient-to-b from-brand-soft/60 to-card px-6 pb-5 pt-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Qui souhaitez-vous inviter&nbsp;?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Un coéquipier, ou un professionnel qui vous accompagne.
          </p>
        </div>
        <CloseX onClose={onClose} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4 sm:p-5">
        {order.map((k, i) => {
          const meta = KINDS[k];
          const Icon = meta.icon;
          return (
            <motion.button
              key={k}
              type="button"
              onClick={() => onChoose(k)}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.4, ease: EASE, delay: reduce ? 0 : 0.06 + i * 0.07 }}
              className="group flex items-center gap-4 rounded-[1.35rem] border bg-card p-4 text-left transition-all duration-500 ease-fluid hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg hover:shadow-ink/[0.05] active:scale-[0.99]"
            >
              <span
                className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ring-1 transition-transform duration-500 ease-fluid group-hover:scale-105 ${meta.tile}`}
              >
                <Icon className="size-6" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{meta.label}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                  {meta.desc}
                </span>
              </span>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all duration-500 ease-fluid group-hover:bg-brand group-hover:text-brand-foreground group-hover:translate-x-0.5">
                <ArrowRight className="size-4" />
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ── Étape 2 : formulaire adapté au type ──────────────────────────────────────
function FormStep({
  kind,
  canGrantAdmin,
  pending,
  error,
  onBack,
  onSubmit,
}: {
  kind: InviteKind;
  canGrantAdmin: boolean;
  pending: boolean;
  error?: string;
  onBack: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  const meta = KINDS[kind];
  const Icon = meta.icon;
  const isTeam = kind === "team";
  return (
    <form action={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-4 sm:px-5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ${meta.tile}`}>
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Inviter&nbsp;: {meta.short}</p>
          <p className="truncate text-xs text-muted-foreground">
            {isTeam ? "Il rejoindra votre espace" : "On l'invite par email"}
          </p>
        </div>
      </div>

      <input type="hidden" name="kind" value={kind} />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
        {isTeam ? (
          <>
            <TeamRoleField canGrantAdmin={canGrantAdmin} />
            <TextField name="email" label="Son adresse email" type="email" required placeholder="associe@entreprise.fr" autoFocus hint="Il rejoint l'équipe en créant son compte avec cette adresse." />
            <TextField name="fullName" label="Son nom" placeholder="Sacha Morel" optional />
          </>
        ) : (
          <>
            <TextField name="fullName" label="Son nom" placeholder="Me Sacha Morel" autoFocus optional />
            <TextField name="firmName" label={kind === "accountant" ? "Cabinet / société" : "Cabinet"} placeholder={kind === "accountant" ? "Cabinet Morel & Associés" : "Cabinet Morel Avocats"} optional />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField name="email" label="Son email" type="email" required placeholder="contact@cabinet.fr" />
              <TextField name="phone" label="Téléphone" type="tel" placeholder="01 23 45 67 89" optional />
            </div>
          </>
        )}
        <div className="flex flex-col gap-2">
          <label htmlFor="message" className="text-sm font-medium">
            Un mot pour l’inviter <span className="font-normal text-muted-foreground">· facultatif</span>
          </label>
          <textarea
            id="message"
            name="message"
            rows={3}
            maxLength={600}
            placeholder={
              isTeam
                ? "Salut ! Je t'ajoute sur BLEME pour qu'on suive les impayés ensemble."
                : "Bonjour, je centralise mes dossiers sur BLEME — je voulais vous y associer."
            }
            className={`${inputClass} resize-none`}
          />
        </div>

        {error ? (
          <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-red-100">
            <CircleAlert className="size-4 shrink-0" />
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-3 border-t bg-muted/30 px-4 py-4 sm:px-5">
        <SubmitInvite pending={pending} label={isTeam ? "Envoyer l'invitation" : "Inviter"} />
      </div>
    </form>
  );
}

function TeamRoleField({ canGrantAdmin }: { canGrantAdmin: boolean }) {
  const [role, setRole] = useState<"member" | "admin">("member");
  if (!canGrantAdmin) return <input type="hidden" name="role" value="member" />;
  const opts: { value: "member" | "admin"; label: string; hint: string }[] = [
    { value: "member", label: "Membre", hint: "Suit et prépare les dossiers" },
    { value: "admin", label: "Administrateur", hint: "Gère aussi l'équipe et le compte" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Son rôle</span>
      <input type="hidden" name="role" value={role} />
      <div className="grid grid-cols-2 gap-2">
        {opts.map((o) => {
          const active = role === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setRole(o.value)}
              aria-pressed={active}
              className={`rounded-2xl border p-3 text-left transition-all duration-300 ${
                active
                  ? "border-brand bg-brand-soft ring-1 ring-brand/30"
                  : "border-border bg-background hover:border-brand/30"
              }`}
            >
              <span className={`block text-sm font-semibold ${active ? "text-brand-strong" : ""}`}>
                {o.label}
              </span>
              <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">{o.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TextField({
  name,
  label,
  type = "text",
  placeholder,
  required = false,
  optional = false,
  autoFocus = false,
  hint,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
  autoFocus?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
        {optional ? <span className="font-normal text-muted-foreground"> · facultatif</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        className={inputClass}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SubmitInvite({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="group inline-flex items-center gap-2.5 rounded-full bg-brand py-2.5 pl-5 pr-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
    >
      {label}
      <span className="flex size-7 items-center justify-center rounded-full bg-white/20 transition-transform duration-500 ease-fluid group-hover:translate-x-0.5">
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
      </span>
    </button>
  );
}

// ── Étape 3 : confirmation ───────────────────────────────────────────────────
function SuccessStep({
  result,
  reduce,
  onAgain,
  onClose,
}: {
  result: InviteState;
  reduce: boolean;
  onAgain: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-9 text-center">
      <motion.span
        initial={reduce ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 18, delay: reduce ? 0 : 0.05 }}
        className="flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200"
      >
        <Check className="size-8" strokeWidth={2.5} />
      </motion.span>
      <h2 className="mt-5 text-lg font-semibold tracking-tight">C’est envoyé.</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{result.success}</p>

      {result.inviteUrl ? <CopyInviteLink url={result.inviteUrl} emailed={result.emailed} /> : null}

      <div className="mt-7 flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={onAgain}
          className="inline-flex items-center justify-center gap-2 rounded-full border bg-card px-5 py-2.5 text-sm font-medium transition-all duration-300 hover:bg-muted active:scale-[0.98]"
        >
          <UserPlus className="size-4" />
          Inviter quelqu’un d’autre
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-ink-foreground transition-all duration-300 hover:bg-ink-soft active:scale-[0.98]"
        >
          Terminé
        </button>
      </div>
    </div>
  );
}

function CopyInviteLink({ url, emailed }: { url: string; emailed?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-6 w-full rounded-2xl bg-muted/50 p-4 text-left">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Link2 className="size-3.5" />
        {emailed ? "Ou partagez le lien directement" : "Partagez ce lien pour l'inviter"}
      </p>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* presse-papiers indisponible */
          }
        }}
        className="mt-2 flex w-full items-center gap-2 rounded-xl bg-ink px-3.5 py-2.5 text-left font-mono text-[12px] text-white transition-all duration-300 hover:bg-ink-soft active:scale-[0.99]"
      >
        <span className="min-w-0 flex-1 truncate">{url}</span>
        {copied ? (
          <Check className="size-4 shrink-0 text-emerald-400" />
        ) : (
          <Copy className="size-4 shrink-0 opacity-70" />
        )}
      </button>
    </div>
  );
}

function CloseX({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Fermer"
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground"
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    </button>
  );
}

// ── Actions par ligne d'invitation en attente ────────────────────────────────
export function InvitationActions({
  id,
  kind,
  token,
}: {
  id: string;
  kind: InviteKind;
  token: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const inviteUrl =
    kind === "team" && token
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/rejoindre/${token}`
      : null;
  return (
    <div className="flex items-center gap-1">
      {inviteUrl ? (
        <button
          type="button"
          title="Copier le lien d'invitation"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(inviteUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              /* presse-papiers indisponible */
            }
          }}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground"
        >
          {copied ? <Check className="size-4 text-emerald-600" /> : <Link2 className="size-4" />}
        </button>
      ) : null}
      <form action={resendInvitation}>
        <input type="hidden" name="id" value={id} />
        <IconSubmit title="Renvoyer l'email" spinning>
          <RefreshCw className="size-4" />
        </IconSubmit>
      </form>
      <form action={revokeInvitation}>
        <input type="hidden" name="id" value={id} />
        <IconSubmit title="Annuler l'invitation" danger>
          <Trash2 className="size-4" />
        </IconSubmit>
      </form>
    </div>
  );
}

function IconSubmit({
  children,
  title,
  danger = false,
  spinning = false,
}: {
  children: React.ReactNode;
  title: string;
  danger?: boolean;
  spinning?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      title={title}
      aria-label={title}
      disabled={pending}
      className={`flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 disabled:opacity-50 ${
        danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-muted hover:text-foreground"
      }`}
    >
      {pending ? (
        <LoaderCircle className={`size-4 ${spinning ? "animate-spin" : ""}`} />
      ) : (
        children
      )}
    </button>
  );
}
