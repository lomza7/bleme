import { cn } from "@/lib/utils";

/*
 * Reveals 100 % CSS (voir globals.css) : au chargement (.anim-load) ou
 * liés au scroll (.anim-scroll, animation-timeline: view()). Aucune
 * dépendance à l'hydratation : sans JS, sans support navigateur ou en
 * reduced-motion, le contenu est simplement visible.
 */

export function Reveal({
  children,
  delay = 0,
  className,
  onLoad = false,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  /** true : anime au chargement (hero, above the fold) au lieu du scroll. */
  onLoad?: boolean;
}) {
  return (
    <div
      className={cn(onLoad ? "anim-load" : "anim-scroll", className)}
      style={{ "--delay": `${delay}s` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

export function RevealStagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  /** Conservé pour compatibilité d'API ; le décalage vient du scroll. */
  stagger?: number;
}) {
  return <div className={className}>{children}</div>;
}

export function RevealItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("anim-scroll", className)}>{children}</div>;
}
