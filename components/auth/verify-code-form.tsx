"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { resendEmailCode, verifyEmailCode, type AuthState } from "@/lib/auth/actions";
import { FormAlert } from "@/components/auth/fields";

const INITIAL: AuthState = {};
const LEN = 6;

/*
 * Saisie du code de vérification : 6 cases, auto-focus, collage intelligent
 * (on colle « 123456 » d'un coup), navigation flèches/backspace, soumission
 * automatique dès la 6e case remplie. Le code complet part dans un champ caché.
 */
export function VerifyCodeForm({ next = "/app" }: { next?: string }) {
  const [state, action, pending] = useActionState(verifyEmailCode, INITIAL);
  const [resendState, resendAction, resending] = useActionState(resendEmailCode, INITIAL);
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(""));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const code = digits.join("");

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  // Compte à rebours anti-spam : démarré au clic sur « Renvoyer » (aligné sur
  // le cooldown serveur de 45 s), décrémenté par un timer.
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function setAt(i: number, v: string) {
    setDigits((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }

  function onChange(i: number, raw: string) {
    const v = raw.replace(/\D/g, "");
    if (!v) {
      setAt(i, "");
      return;
    }
    // Collage : on répartit les chiffres sur les cases à partir d'ici.
    if (v.length > 1) {
      setDigits((prev) => {
        const next = [...prev];
        for (let k = 0; k < v.length && i + k < LEN; k++) next[i + k] = v[k];
        return next;
      });
      const landed = Math.min(i + v.length, LEN - 1);
      inputs.current[landed]?.focus();
      return;
    }
    setAt(i, v);
    if (i < LEN - 1) inputs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < LEN - 1) inputs.current[i + 1]?.focus();
  }

  // Soumission automatique dès que les 6 chiffres sont là.
  useEffect(() => {
    if (code.length === LEN && !pending) formRef.current?.requestSubmit();
  }, [code, pending]);

  return (
    <div className="flex flex-col gap-6">
      <form ref={formRef} action={action} className="flex flex-col gap-5">
        <FormAlert error={state.error} />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="code" value={code} />
        <div className="flex justify-between gap-2" onPaste={(e) => {
          const t = e.clipboardData.getData("text").replace(/\D/g, "");
          if (t) {
            e.preventDefault();
            onChange(0, t.slice(0, LEN));
          }
        }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              value={d}
              onChange={(e) => onChange(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={i === 0 ? LEN : 1}
              aria-label={`Chiffre ${i + 1}`}
              className="h-14 w-full rounded-2xl border bg-background text-center text-xl font-semibold tabular-nums outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          ))}
        </div>
        <button
          type="submit"
          disabled={pending || code.length !== LEN}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Vérifier mon email
        </button>
      </form>

      <form action={resendAction} className="text-center" onSubmit={() => setCooldown(45)}>
        <FormAlert success={resendState.success} error={resendState.error} />
        <p className="text-sm text-ink-muted">
          Pas reçu de code ?{" "}
          <button
            type="submit"
            disabled={resending || cooldown > 0}
            className="font-medium text-ink-foreground underline-offset-4 hover:underline disabled:opacity-50 disabled:no-underline"
          >
            {cooldown > 0 ? `Renvoyer dans ${cooldown} s` : resending ? "Envoi…" : "Renvoyer un code"}
          </button>
        </p>
      </form>
    </div>
  );
}
