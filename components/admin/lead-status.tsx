"use client";

import { useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { updateLeadStatus } from "@/lib/admin/leads-actions";

const LABELS: Record<string, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  interested: "Intéressé",
  declined: "Décliné",
  onboarded: "Embarqué",
};

const TONE: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  contacted: "bg-amber-100 text-amber-800",
  interested: "bg-brand-soft text-brand-strong",
  declined: "bg-red-100 text-red-700",
  onboarded: "bg-emerald-100 text-emerald-800",
};

/** Sélecteur de statut de démarchage, auto-enregistré au changement. */
export function LeadStatusSelect({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <span className="relative inline-flex items-center">
      <select
        aria-label="Statut de démarchage"
        defaultValue={status}
        disabled={pending}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("id", id);
          fd.set("status", e.target.value);
          start(() => updateLeadStatus(fd));
        }}
        className={`cursor-pointer appearance-none rounded-full py-1 pl-3 pr-7 text-xs font-medium outline-none ring-0 transition-colors focus:ring-2 focus:ring-brand disabled:opacity-60 ${
          TONE[status] ?? TONE.new
        }`}
      >
        {Object.entries(LABELS).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 flex items-center">
        {pending ? (
          <LoaderCircle className="size-3 animate-spin" />
        ) : (
          <svg viewBox="0 0 12 12" className="size-2.5 opacity-60" aria-hidden>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </span>
  );
}
