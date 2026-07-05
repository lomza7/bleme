const ITEMS = [
  "Facture impayée",
  "Litige client",
  "Mise en demeure",
  "Amende contestée",
  "Demande gracieuse",
  "Relance client",
  "Solde bloqué",
  "Devis contesté",
];

/** Bandeau défilant des types de blèmes pris en charge. */
export function Marquee() {
  return (
    <div className="overflow-hidden border-y bg-background py-4 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
      <div className="flex w-max animate-marquee">
        {[0, 1].map((copy) => (
          <ul
            key={copy}
            aria-hidden={copy === 1}
            className="flex shrink-0 items-center"
          >
            {ITEMS.map((item) => (
              <li
                key={item}
                className="flex items-center gap-10 pr-10 text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground"
              >
                {item}
                <span
                  aria-hidden
                  className="size-1.5 rotate-45 bg-brand/50"
                />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
