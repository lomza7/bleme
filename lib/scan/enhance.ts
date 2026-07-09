/*
 * Amélioration de lisibilité du document redressé, façon « scanner » :
 * étirement de contraste par percentiles (robuste aux pixels aberrants).
 * Deux rendus : couleur (fidèle, doux) et noir & blanc (texte renforcé,
 * utile pour les factures photographiées sur un chantier mal éclairé).
 */

export type EnhanceMode = "couleur" | "nb";

/** Étire la luminance entre les percentiles [lo, hi] → [0, 255]. */
function stretchBounds(img: ImageData, lo: number, hi: number): { min: number; max: number } {
  const { data } = img;
  const hist = new Array<number>(256).fill(0);
  const n = data.length / 4;
  for (let p = 0; p < data.length; p += 4) {
    hist[Math.round((data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000)]++;
  }
  let acc = 0;
  let min = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= n * lo) {
      min = i;
      break;
    }
  }
  acc = 0;
  let max = 255;
  for (let i = 255; i >= 0; i--) {
    acc += hist[i];
    if (acc >= n * (1 - hi)) {
      max = i;
      break;
    }
  }
  return max - min < 10 ? { min: 0, max: 255 } : { min, max };
}

/** Améliore EN PLACE le document redressé selon le mode choisi. */
export function enhanceDocument(img: ImageData, mode: EnhanceMode): void {
  const { data } = img;
  if (mode === "nb") {
    // N&B : étirement agressif sur la luminance — papier blanc, encre noire.
    const { min, max } = stretchBounds(img, 0.05, 0.95);
    const scale = 255 / (max - min);
    for (let p = 0; p < data.length; p += 4) {
      const lum = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;
      const v = Math.max(0, Math.min(255, (lum - min) * scale));
      data[p] = data[p + 1] = data[p + 2] = v;
    }
    return;
  }
  // Couleur : étirement doux, même gain sur les 3 canaux (teintes préservées).
  const { min, max } = stretchBounds(img, 0.01, 0.99);
  const scale = 255 / (max - min);
  for (let p = 0; p < data.length; p += 4) {
    data[p] = Math.max(0, Math.min(255, (data[p] - min) * scale));
    data[p + 1] = Math.max(0, Math.min(255, (data[p + 1] - min) * scale));
    data[p + 2] = Math.max(0, Math.min(255, (data[p + 2] - min) * scale));
  }
}
