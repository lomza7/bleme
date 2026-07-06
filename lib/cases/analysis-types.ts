// Types partagés serveur + client pour l'analyse d'une pièce (pas de
// "use server" / "server-only" ici : importable côté client pour la popup).

export type Finding = { level: "ok" | "warn"; message: string };

export type AnalysisFact = {
  field: string;
  label: string;
  value: string;
  confidence: number;
};

export type PieceAnalysis = {
  fileName: string;
  kindLabel: string;
  kindConfirmed: boolean; // le contenu corrobore-t-il le type déclaré ?
  facts: AnalysisFact[];
  coherence: Finding[];
};
