"use client";

import { useEffect, useState } from "react";
import { euros } from "@/lib/format";

/*
 * Chiffre qui se compte à l'apparition (~900 ms, ease-out). Rendu serveur =
 * valeur finale (pas de mismatch d'hydratation, contenu correct sans JS) ;
 * l'animation démarre au montage. Coupé sous prefers-reduced-motion.
 * En euros, les paliers intermédiaires sont arrondis à l'euro (pas de
 * centimes qui clignotent) — la valeur exacte est posée à la fin.
 */
export function CountUp({
  value,
  kind = "count",
  delayMs = 0,
  className,
}: {
  value: number;
  /** "euros" : `value` est en CENTIMES, formaté via euros(). */
  kind?: "euros" | "count";
  delayMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    let raf = 0;
    // Valeur nulle ou reduced-motion : alignement direct, sans animation
    // (posé au prochain frame — jamais de setState synchrone dans l'effet).
    if (value <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      raf = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(raf);
    }
    let start: number | null = null;
    const duration = 900;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = value * eased;
      setDisplay(
        p >= 1 ? value : kind === "euros" ? Math.round(current / 100) * 100 : Math.round(current),
      );
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    // Zéro posé IMMÉDIATEMENT (pas au bout du délai) : sinon la tuile se
    // révèle en montrant la valeur finale puis « saute » à 0 avant de compter.
    raf = requestAnimationFrame(() => setDisplay(0));
    const timer = window.setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [value, kind, delayMs]);

  return (
    <span className={className} suppressHydrationWarning>
      {kind === "euros" ? euros(display) : display.toLocaleString("fr-FR")}
    </span>
  );
}
