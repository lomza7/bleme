"use client";

import { useActionState } from "react";
import { CircleAlert, CircleCheck, Download, Trash2 } from "lucide-react";
import { installSkill, removeSkill, type HermesState } from "@/lib/admin/hermes-actions";

const INITIAL: HermesState = {};

function Feedback({ state }: { state: HermesState }) {
  if (state.error) {
    return (
      <p role="alert" className="flex items-center gap-2 text-xs text-red-600">
        <CircleAlert className="size-3.5 shrink-0" />
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="flex items-center gap-2 text-xs text-emerald-700">
        <CircleCheck className="size-3.5 shrink-0" />
        {state.success}
      </p>
    );
  }
  return null;
}

export function InstallSkillButton({ name }: { name: string }) {
  const [state, action, pending] = useActionState(installSkill, INITIAL);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="name" value={name} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-[11px] font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
      >
        <Download className="size-3" />
        {pending ? "Installation…" : "Installer"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function RemoveSkillButton({ name }: { name: string }) {
  const [state, action, pending] = useActionState(removeSkill, INITIAL);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="name" value={name} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-60"
      >
        <Trash2 className="size-3" />
        {pending ? "Retrait…" : "Retirer"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
