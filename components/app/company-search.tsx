"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, LoaderCircle, Search, ShieldCheck } from "lucide-react";
import { searchCompanies } from "@/lib/companies/actions";
import type { CompanyHit } from "@/lib/companies/types";

/*
 * Champ « client / débiteur » avec recherche d'entreprise (annuaire officiel).
 * En sélectionnant une entreprise, on capture son SIREN → la fiche légale
 * complète (Pappers) sera récupérée et stockée à la création du dossier.
 * La saisie libre reste possible (particulier, entreprise absente de l'annuaire).
 */
export function CompanySearch({
  value,
  onChange,
  placeholder = "Nom de l’entreprise ou du client",
}: {
  value: string;
  onChange: (v: { name: string; siren: string | null }) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [hits, setHits] = useState<CompanyHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedSiren, setSelectedSiren] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Fermer au clic extérieur.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function schedule(q: string) {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const res = await searchCompanies(q);
      setHits(res);
      setLoading(false);
      setOpen(true);
    }, 350);
  }

  function handleInput(v: string) {
    setQuery(v);
    setSelectedSiren(null);
    onChange({ name: v, siren: null });
    setOpen(true);
    schedule(v);
  }

  function select(hit: CompanyHit) {
    setQuery(hit.nom);
    setSelectedSiren(hit.siren);
    onChange({ name: hit.nom, siren: hit.siren });
    setOpen(false);
    setHits([]);
  }

  return (
    <div ref={box} className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
          {selectedSiren ? <Building2 className="size-4 text-brand-strong" /> : <Search className="size-4" />}
        </span>
        <input
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-2xl border bg-background py-2.5 pl-11 pr-10 text-sm outline-none transition-colors focus:border-brand"
        />
        {loading ? (
          <LoaderCircle className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : selectedSiren ? (
          <ShieldCheck className="absolute right-4 top-1/2 size-4 -translate-y-1/2 text-emerald-600" />
        ) : null}
      </div>

      {selectedSiren ? (
        <p className="mt-1.5 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-600" />
          Entreprise identifiée · SIREN {selectedSiren} — fiche officielle rattachée à la création.
        </p>
      ) : (
        <p className="mt-1.5 px-1 text-xs text-muted-foreground">
          Cherchez l’entreprise pour récupérer son siège et sa fiche officielle — ou saisissez un nom librement.
        </p>
      )}

      {open && (hits.length > 0 || (!loading && query.trim().length >= 2)) ? (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border bg-card shadow-lg shadow-zinc-950/[0.08]">
          {hits.length > 0 ? (
            <ul className="max-h-72 overflow-y-auto py-1">
              {hits.map((h) => (
                <li key={h.siren}>
                  <button
                    type="button"
                    onClick={() => select(h)}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-brand-soft/50"
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                      <Building2 className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{h.nom}</span>
                        {h.radiee ? (
                          <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">radiée</span>
                        ) : null}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[h.formeJuridique, [h.codePostal, h.ville].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || `SIREN ${h.siren}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">Aucune entreprise trouvée. Vous pouvez saisir le nom librement.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
