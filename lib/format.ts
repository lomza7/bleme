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

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}
