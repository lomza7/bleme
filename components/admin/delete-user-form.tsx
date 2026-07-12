"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, Trash2 } from "lucide-react";
import { deletePlatformUser } from "@/lib/admin/users-actions";

function DeleteSubmitButton({ canSubmit }: { canSubmit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!canSubmit || pending}
      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-red-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-red-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45"
    >
      {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      {pending ? "Suppression…" : canSubmit ? "Supprimer définitivement" : "Retapez l’email exact"}
    </button>
  );
}

export function DeleteUserForm({ userId, email }: { userId: string; email: string }) {
  const [confirmation, setConfirmation] = useState("");
  const canSubmit = confirmation.trim().toLowerCase() === email.toLowerCase();

  return (
    <details className="inline-block text-left">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 ring-1 ring-red-100 transition-colors hover:bg-red-100">
        <Trash2 className="size-3.5" />
        Supprimer
      </summary>
      <form action={deletePlatformUser} className="mt-2 w-72 rounded-2xl border border-red-100 bg-red-50 p-3 text-left shadow-sm">
        <input type="hidden" name="userId" value={userId} />
        <p className="text-xs font-medium text-red-900">Suppression définitive</p>
        <p className="mt-1 text-[11px] leading-relaxed text-red-800/80">
          Retire le compte Auth. Si ses organisations sont mono-utilisateur,
          purge aussi dossiers, preuves, API, compta et fichiers.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-red-900">
          Tapez exactement <span className="font-mono font-semibold">{email}</span>.
        </p>
        <label className="mt-2 block text-[11px] font-medium text-red-900" htmlFor={`delete-${userId}`}>
          Email de confirmation
        </label>
        <input
          id={`delete-${userId}`}
          name="confirmation"
          type="email"
          required
          autoComplete="off"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="email exact"
          className="mt-1 w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-xs text-red-950 outline-none transition focus:border-red-400"
        />
        <DeleteSubmitButton canSubmit={canSubmit} />
      </form>
    </details>
  );
}
