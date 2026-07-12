import Link from "next/link";
import { Sparkles } from "lucide-react";

/** Bandeau d'incitation Pro pour les fonctionnalités réservées au forfait Pro. */
export function ProUpsell({ feature }: { feature: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[1.5rem] border border-brand/30 bg-brand-soft/40 p-5">
      <Sparkles className="size-5 shrink-0 text-brand-strong" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-medium">{feature} font partie du forfait Pro.</span>{" "}
        <span className="text-muted-foreground">
          Passez au Pro (9 € HT/mois) : 1 dossier inclus par mois, API et stockage illimité.
        </span>
      </p>
      <Link
        href="/app/abonnement"
        className="shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-strong"
      >
        Passer au Pro
      </Link>
    </div>
  );
}
