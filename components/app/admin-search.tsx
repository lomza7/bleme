"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle, Landmark, LoaderCircle, Search, ShieldCheck } from "lucide-react";
import { searchAdmins } from "@/lib/administrations/actions";
import type { AdminAddress, AdminHit } from "@/lib/administrations/types";

/*
 * Champ « administration / service » avec recherche dans l'annuaire officiel
 * de l'administration (adresses postales réelles). En sélectionnant un service,
 * on capture son adresse — jamais devinée. Deux échappatoires : saisie libre
 * (service absent de l'annuaire) et « je ne sais pas » (Basile déterminera le
 * destinataire à partir du récit et proposera son adresse réelle).
 */
export function AdminSearch({
  value,
  onChange,
  onHelp,
  helpActive,
}: {
  value: string;
  onChange: (v: { name: string; address: AdminAddress | null }) => void;
  /** Bascule « je ne sais pas » : le destinataire sera déterminé par l'agent. */
  onHelp: (active: boolean) => void;
  helpActive: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [hits, setHits] = useState<AdminHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null);

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
      const res = await searchAdmins(q);
      setHits(res);
      setLoading(false);
      setOpen(true);
    }, 350);
  }

  function handleInput(v: string) {
    setQuery(v);
    setPicked(false);
    onChange({ name: v, address: null });
    setOpen(true);
    schedule(v);
  }

  function select(hit: AdminHit) {
    setQuery(hit.nom);
    setPicked(true);
    onChange({ name: hit.nom, address: hit.address });
    setOpen(false);
    setHits([]);
  }

  if (helpActive) {
    return (
      <div className="rounded-2xl border border-brand/40 bg-brand-soft/50 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground">
            <HelpCircle className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Basile trouvera le bon interlocuteur</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Racontez simplement votre situation à l’étape suivante. À partir de votre récit et de
              vos pièces, Basile identifie la ou les administrations compétentes et récupère leur
              adresse officielle — vous choisirez avant tout envoi.
            </p>
            <button
              type="button"
              onClick={() => onHelp(false)}
              className="mt-3 text-sm font-medium text-brand-strong underline-offset-4 hover:underline"
            >
              Je connais l’administration, la saisir moi-même
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={box} className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
          {picked ? <Landmark className="size-4 text-brand-strong" /> : <Search className="size-4" />}
        </span>
        <input
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder="Préfecture, service des impôts, tribunal administratif…"
          autoComplete="off"
          className="w-full rounded-2xl border bg-background py-2.5 pl-11 pr-10 text-sm outline-none transition-colors focus:border-brand"
        />
        {loading ? (
          <LoaderCircle className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : picked ? (
          <ShieldCheck className="absolute right-4 top-1/2 size-4 -translate-y-1/2 text-emerald-600" />
        ) : null}
      </div>

      {picked ? (
        <p className="mt-1.5 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-600" />
          Service identifié à l’annuaire officiel — adresse rattachée au dossier.
        </p>
      ) : (
        <p className="mt-1.5 px-1 text-xs text-muted-foreground">
          Cherchez le service pour récupérer son adresse officielle, saisissez-le librement, ou{" "}
          <button
            type="button"
            onClick={() => onHelp(true)}
            className="font-medium text-brand-strong underline-offset-4 hover:underline"
          >
            demandez à Basile de le trouver
          </button>
          .
        </p>
      )}

      {open && (hits.length > 0 || (!loading && query.trim().length >= 2)) ? (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border bg-card shadow-lg shadow-zinc-950/[0.08]">
          {hits.length > 0 ? (
            <ul className="max-h-72 overflow-y-auto py-1">
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => select(h)}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-brand-soft/50"
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                      <Landmark className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{h.nom}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[h.type, h.address ? `${h.address.codePostal} ${h.address.ville}` : "adresse à compléter"]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3">
              <p className="text-sm text-muted-foreground">Aucun service trouvé à l’annuaire.</p>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onHelp(true);
                }}
                className="mt-1.5 text-sm font-medium text-brand-strong underline-offset-4 hover:underline"
              >
                Laisser Basile trouver le bon interlocuteur
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
