"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";

function formatFr(v: number, suffix: string) {
  return `${Math.round(v).toLocaleString("fr-FR")}${suffix}`.replace(/ /g, " ");
}

/**
 * Nombre qui se compte à l'entrée dans le viewport (format français).
 * Rend la valeur finale côté serveur : sans JS, le chiffre est juste là.
 */
export function CountUp({
  value,
  suffix = "",
  className,
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const started = inView && !reduce;
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => formatFr(v, suffix));

  useEffect(() => {
    if (started) {
      const controls = animate(mv, value, {
        duration: 1.8,
        ease: [0.16, 1, 0.3, 1],
      });
      return () => controls.stop();
    }
  }, [started, value, mv]);

  if (!started) {
    return (
      <span ref={ref} className={className}>
        {formatFr(value, suffix)}
      </span>
    );
  }
  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  );
}
