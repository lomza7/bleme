"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Wrench } from "lucide-react";
import type { ORModel } from "@/lib/admin/hermes-actions";

/*
 * Combobox des modèles OpenRouter : recherche libre (id + nom), liste
 * scrollable, badge « outils » pour les modèles routant le tool use.
 * Remplace le <datalist> natif qui ne filtre que par préfixe saisi.
 */
export function ModelPicker({
  name,
  defaultValue,
  models,
  onSelect,
  placeholder,
}: {
  name?: string;
  defaultValue?: string;
  models: ORModel[];
  // Mode « ajouteur » : quand fourni, sélectionner un modèle appelle onSelect
  // et remet le champ à zéro au lieu de porter une valeur (pas d'input caché).
  onSelect?: (id: string) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const choose = (id: string) => {
    if (onSelect) {
      onSelect(id);
      setValue("");
    } else {
      setValue(id);
    }
    setOpen(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? models.filter(
          (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
        )
      : models;
    return list.slice(0, 120);
  }, [models, query]);

  return (
    <div ref={rootRef} className="relative">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setQuery("");
        }}
        className="flex w-full items-center justify-between gap-2 rounded-xl border bg-background px-3.5 py-2.5 text-left font-mono text-xs outline-none transition-colors focus:border-brand"
      >
        <span className="truncate">{value || placeholder || "Choisir un modèle…"}</span>
        <ChevronDown className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <>
          {/* clic extérieur = fermeture */}
          <button
            type="button"
            aria-label="Fermer"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
            tabIndex={-1}
          />
          <div className="absolute z-20 mt-1.5 w-full min-w-72 overflow-hidden rounded-2xl border bg-card shadow-xl">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Rechercher parmi ${models.length} modèles…`}
              className="w-full border-b bg-background px-4 py-2.5 text-sm outline-none"
            />
            <ul className="max-h-72 overflow-y-auto">
              {filtered.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => choose(m.id)}
                    className={`flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-muted ${
                      m.id === value ? "bg-brand-soft/50" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs">{m.id}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {m.name}
                      </span>
                    </span>
                    {m.tools ? (
                      <span
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 ring-1 ring-emerald-200"
                        title="Tool use routé : compatible skills à outils"
                      >
                        <Wrench className="size-2.5" />
                        outils
                      </span>
                    ) : null}
                    {m.id === value ? <Check className="size-3.5 shrink-0 text-brand" /> : null}
                  </button>
                </li>
              ))}
              {filtered.length === 0 ? (
                <li className="px-4 py-3 text-xs text-muted-foreground">
                  Aucun modèle ne correspond — le champ accepte aussi un slug
                  saisi tel quel.
                </li>
              ) : null}
              {query.trim() && filtered.length > 0 ? (
                <li className="border-t">
                  <button
                    type="button"
                    onClick={() => choose(query.trim())}
                    className="w-full px-4 py-2 text-left font-mono text-[11px] text-muted-foreground hover:bg-muted"
                  >
                    Utiliser tel quel : « {query.trim()} »
                  </button>
                </li>
              ) : null}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
