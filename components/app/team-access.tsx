"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check,
  CircleAlert,
  LoaderCircle,
  Mail,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import {
  updateInvitation,
  updateMemberAccess,
  type InviteState,
} from "@/lib/team/actions";
import {
  CAPABILITY_GROUPS,
  permissionsFromRole,
  roleFromPermissions,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type Capability,
  type MemberRole,
  type PermissionSet,
} from "@/lib/permissions/capabilities";

/*
 * Deux surfaces de gestion de « Mon équipe », animées et sobres :
 *  • MemberAccessButton : éditeur de droits par membre (préréglage de rôle +
 *    réglage fin capacité par capacité), enregistré via update_member_access.
 *  • EditInviteButton : corriger l'adresse email d'une invitation en attente
 *    et la renvoyer d'un geste.
 */

const EASE = [0.16, 1, 0.3, 1] as const;
const PRESETS: MemberRole[] = ["manager", "collaborator", "viewer", "accountant"];

function Shell({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  const reduce = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Verrou du scroll, Échap, focus initial + piège de focus + restauration.
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <motion.button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-sm"
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal
        aria-label={label}
        tabIndex={-1}
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
        className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border bg-card shadow-2xl shadow-ink/10 outline-none sm:max-w-lg sm:rounded-[1.75rem]"
      >
        {children}
      </motion.div>
    </div>
  );
}

// ── Éditeur de droits d'un membre ────────────────────────────────────────────
export function MemberAccessButton({
  userId,
  name,
  role,
  permissions,
}: {
  userId: string;
  name: string;
  role: string;
  permissions: PermissionSet;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-300 hover:border-brand/40 hover:text-foreground active:scale-[0.98]"
      >
        <SlidersHorizontal className="size-3.5" />
        Droits
      </button>
      <AnimatePresence>
        {open ? (
          <AccessDialog
            key="access"
            userId={userId}
            name={name}
            role={role}
            permissions={permissions}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

function AccessDialog({
  userId,
  name,
  role,
  permissions,
  onClose,
}: {
  userId: string;
  name: string;
  role: string;
  permissions: PermissionSet;
  onClose: () => void;
}) {
  const router = useRouter();
  const [perms, setPerms] = useState<PermissionSet>(() => ({ ...permissions }));
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<InviteState>({});

  const derived = roleFromPermissions(perms);
  // 'admin' hérité affiché tel quel ; sinon on dérive le libellé du jeu de droits.
  const currentLabel = role === "admin" ? "Administrateur" : ROLE_LABELS[derived];

  const applyPreset = (r: MemberRole) => {
    if (r === "custom") return;
    setPerms(permissionsFromRole(r as Exclude<MemberRole, "custom">));
  };
  const toggle = (cap: Capability) => setPerms((p) => ({ ...p, [cap]: !p[cap] }));

  const save = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("userId", userId);
      fd.set("role", derived === "custom" ? "member" : derived);
      fd.set("permissions", JSON.stringify(perms));
      const res = await updateMemberAccess({}, fd);
      setResult(res);
      if (res.success) {
        router.refresh();
        setTimeout(onClose, 500);
      }
    });
  };

  return (
    <Shell onClose={onClose} label={`Droits de ${name}`}>
      <div className="flex items-center gap-3 border-b bg-gradient-to-b from-brand-soft/50 to-card px-5 py-4">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong ring-1 ring-brand/15">
          <ShieldCheck className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Droits de {name}</p>
          <p className="truncate text-xs text-muted-foreground">
            Rôle actuel&nbsp;: {currentLabel}
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
        {/* Préréglages */}
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Partir d’un rôle
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {PRESETS.map((r) => {
              const active = derived === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => applyPreset(r)}
                  aria-pressed={active}
                  className={`rounded-2xl border p-3 text-left transition-all duration-300 ${
                    active ? "border-brand bg-brand-soft ring-1 ring-brand/30" : "border-border bg-background hover:border-brand/30"
                  }`}
                >
                  <span className={`block text-sm font-semibold ${active ? "text-brand-strong" : ""}`}>
                    {ROLE_LABELS[r]}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">
                    {ROLE_DESCRIPTIONS[r]}
                  </span>
                </button>
              );
            })}
          </div>
          {derived === "custom" ? (
            <p className="mt-2 text-xs text-brand-strong">Réglages personnalisés.</p>
          ) : null}
        </div>

        {/* Réglage fin */}
        <div className="flex flex-col gap-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Réglage fin
          </p>
          {CAPABILITY_GROUPS.map((group) => (
            <div key={group.key} className="rounded-2xl border bg-background/40 p-4">
              <p className="text-sm font-semibold">{group.label}</p>
              <div className="mt-2.5 flex flex-col gap-2.5">
                {group.caps.map((c) => (
                  <label key={c.cap} className="flex cursor-pointer items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-sm">{c.label}</span>
                      {c.hint ? (
                        <span className="block text-[11px] leading-tight text-muted-foreground">{c.hint}</span>
                      ) : null}
                    </span>
                    <Switch checked={Boolean(perms[c.cap])} onChange={() => toggle(c.cap)} />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {result.error ? (
          <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-red-100">
            <CircleAlert className="size-4 shrink-0" />
            {result.error}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : result.success ? <Check className="size-4" /> : null}
          {result.success ? "Enregistré" : "Enregistrer les droits"}
        </button>
      </div>
    </Shell>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 ${
        checked ? "bg-brand" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-300 ease-fluid ${
          checked ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

// ── Correction de l'email d'une invitation ───────────────────────────────────
export function EditInviteButton({
  id,
  currentEmail,
  currentName,
}: {
  id: string;
  currentEmail: string;
  currentName: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        title="Corriger l'adresse"
        aria-label="Corriger l'adresse"
        onClick={() => setOpen(true)}
        className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
          <path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <AnimatePresence>
        {open ? (
          <EditInviteDialog
            key="edit-invite"
            id={id}
            currentEmail={currentEmail}
            currentName={currentName}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

function EditInviteDialog({
  id,
  currentEmail,
  currentName,
  onClose,
}: {
  id: string;
  currentEmail: string;
  currentName: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<InviteState>({});

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const res = await updateInvitation({}, formData);
      setResult(res);
      if (res.success) {
        router.refresh();
        setTimeout(onClose, 700);
      }
    });
  };

  const inputClass =
    "w-full rounded-2xl border bg-background px-4 py-3 text-[15px] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <Shell onClose={onClose} label="Corriger l'invitation">
      <form action={submit} className="flex flex-col">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong ring-1 ring-brand/15">
            <Mail className="size-5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-semibold">Corriger l’invitation</p>
            <p className="text-xs text-muted-foreground">Mauvaise adresse email&nbsp;? Corrigez-la ici.</p>
          </div>
        </div>

        <input type="hidden" name="id" value={id} />
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="edit-email" className="text-sm font-medium">Nouvelle adresse email</label>
            <input id="edit-email" name="email" type="email" defaultValue={currentEmail} required className={inputClass} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="edit-name" className="text-sm font-medium">
              Nom <span className="font-normal text-muted-foreground">· facultatif</span>
            </label>
            <input id="edit-name" name="fullName" defaultValue={currentName ?? ""} placeholder="Sacha Morel" className={inputClass} />
          </div>

          {result.error ? (
            <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-red-100">
              <CircleAlert className="size-4 shrink-0" />
              {result.error}
            </p>
          ) : result.success ? (
            <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200">
              <Check className="size-4 shrink-0" />
              {result.success}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Annuler
          </button>
          <button
            type="submit"
            name="resend"
            value=""
            disabled={pending}
            className="rounded-full border bg-card px-4 py-2.5 text-sm font-medium transition-all duration-300 hover:bg-muted active:scale-[0.98] disabled:opacity-60"
          >
            Enregistrer
          </button>
          <button
            type="submit"
            name="resend"
            value="1"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Corriger & renvoyer
          </button>
        </div>
      </form>
    </Shell>
  );
}
