export function euros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function dateFr(d: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(new Date(d));
}

export function dateLongFr(d: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(d));
}

export function relativeDays(d: string | Date): string {
  const days = Math.round(
    (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (days < -1) return `il y a ${-days} j`;
  if (days === -1) return "hier";
  if (days === 0) return "aujourd’hui";
  if (days === 1) return "demain";
  return `dans ${days} j`;
}

/** Fraîcheur fine (« à l’instant », « il y a 2 h », « il y a 3 j »). */
export function relativeTimeFr(d: string | Date): string {
  const min = Math.round((Date.now() - new Date(d).getTime()) / 60_000);
  if (min < 1) return "à l’instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.round(h / 24);
  return days === 1 ? "hier" : `il y a ${days} j`;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}
