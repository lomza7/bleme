"use client";

import { useFormStatus } from "react-dom";
import { ArrowRight, CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";

export const inputClass =
  "w-full rounded-2xl bg-white/[0.06] px-4 py-3.5 text-[15px] text-ink-foreground ring-1 ring-white/10 transition-all duration-300 placeholder:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-brand";

export function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-foreground/90">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-ink-muted/70">{hint}</p> : null}
    </div>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group mt-2 inline-flex w-full items-center justify-center gap-3 rounded-full bg-brand py-3.5 text-[15px] font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : (
        <>
          {children}
          <ArrowRight className="size-4 transition-transform duration-500 ease-fluid group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  );
}

export function FormAlert({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  if (!error && !success) return null;
  if (error) {
    return (
      <p
        role="alert"
        className="flex items-start gap-2.5 rounded-2xl bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-200 ring-1 ring-red-500/30"
      >
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        {error}
      </p>
    );
  }
  return (
    <p
      role="status"
      className="flex items-start gap-2.5 rounded-2xl bg-brand/10 px-4 py-3 text-sm leading-relaxed text-ink-foreground ring-1 ring-brand/30"
    >
      <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand" />
      {success}
    </p>
  );
}
