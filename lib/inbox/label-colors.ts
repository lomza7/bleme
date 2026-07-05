/*
 * Palette des libellés de la boîte de réception. Module neutre (ni client
 * ni serveur) : importable depuis la page serveur ET les composants client
 * — un objet exporté depuis un fichier "use client" deviendrait une
 * référence client vide côté serveur.
 */
export const LABEL_COLORS: Record<string, { dot: string; chip: string }> = {
  sable: { dot: "bg-amber-400", chip: "bg-amber-100 text-amber-800" },
  terracotta: { dot: "bg-brand", chip: "bg-brand-soft text-brand-strong" },
  olive: { dot: "bg-lime-500", chip: "bg-lime-100 text-lime-800" },
  ardoise: { dot: "bg-slate-400", chip: "bg-slate-200 text-slate-700" },
  prune: { dot: "bg-purple-400", chip: "bg-purple-100 text-purple-800" },
};
