/*
 * Détection automatique du document dans l'image : seuillage d'Otsu sur la
 * luminance (le papier est presque toujours plus clair que le fond), plus
 * grande composante connexe, puis coins extrêmes. Tourne sur une vignette
 * (~200 px) pour rester temps réel dans la prévisualisation caméra.
 * Quand la détection échoue (papier blanc sur fond blanc…), l'appelant
 * retombe sur un cadre par défaut que l'utilisateur ajuste à la main.
 */

import { orderQuad, quadArea, type Quad } from "@/lib/scan/geometry";

/** Aire minimale du document : 12 % de l'image, sinon détection rejetée. */
const MIN_AREA_RATIO = 0.12;

function luminance(img: ImageData): Uint8Array {
  const { data, width, height } = img;
  const out = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;
  }
  return out;
}

/** Seuil d'Otsu : sépare papier (clair) et fond (sombre) sans paramètre. */
function otsu(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 127;
  let maxVar = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      best = t;
    }
  }
  return best;
}

/**
 * Plus grande composante connexe (4-voisinage, parcours en largeur itératif
 * sur pile — pas de récursion, l'image fait ≤ ~40 000 pixels).
 */
function largestComponent(mask: Uint8Array, width: number, height: number): Uint8Array | null {
  const labels = new Int32Array(mask.length); // 0 = non visité
  const stack = new Int32Array(mask.length);
  let bestLabel = 0;
  let bestSize = 0;
  let label = 0;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    label++;
    let size = 0;
    let top = 0;
    stack[top++] = start;
    labels[start] = label;
    while (top > 0) {
      const idx = stack[--top];
      size++;
      const x = idx % width;
      const y = (idx / width) | 0;
      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x < width - 1 ? idx + 1 : -1,
        y > 0 ? idx - width : -1,
        y < height - 1 ? idx + width : -1,
      ];
      for (const n of neighbors) {
        if (n >= 0 && mask[n] && !labels[n]) {
          labels[n] = label;
          stack[top++] = n;
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestLabel = label;
    }
  }
  if (bestSize < mask.length * MIN_AREA_RATIO) return null;
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = labels[i] === bestLabel ? 1 : 0;
  return out;
}

/**
 * Cherche le document dans l'image et renvoie ses 4 coins (coordonnées de
 * l'image passée), ou null si rien de plausible. Passer une VIGNETTE
 * (~200 px de large) puis remettre à l'échelle côté appelant.
 */
export function detectDocumentQuad(img: ImageData): Quad | null {
  const { width, height } = img;
  const gray = luminance(img);
  // Convention d'Otsu : fond ≤ seuil, papier > seuil.
  const threshold = otsu(gray);
  // Contraste trop faible entre papier et fond : Otsu coupe dans du bruit.
  let below = 0;
  for (let i = 0; i < gray.length; i++) if (gray[i] <= threshold) below++;
  const ratio = below / gray.length;
  if (ratio < 0.05 || ratio > 0.95) return null;

  const mask = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) mask[i] = gray[i] > threshold ? 1 : 0;
  const comp = largestComponent(mask, width, height);
  if (!comp) return null;

  // Coins = points extrêmes de la composante selon x+y et x−y.
  let tl = -1, br = -1, tr = -1, bl = -1;
  let minSum = Infinity, maxSum = -Infinity, minDiff = Infinity, maxDiff = -Infinity;
  for (let i = 0; i < comp.length; i++) {
    if (!comp[i]) continue;
    const x = i % width;
    const y = (i / width) | 0;
    const sum = x + y;
    const diff = x - y;
    if (sum < minSum) {
      minSum = sum;
      tl = i;
    }
    if (sum > maxSum) {
      maxSum = sum;
      br = i;
    }
    if (diff > maxDiff) {
      maxDiff = diff;
      tr = i;
    }
    if (diff < minDiff) {
      minDiff = diff;
      bl = i;
    }
  }
  if (tl < 0 || br < 0 || tr < 0 || bl < 0) return null;
  const toPoint = (i: number) => ({ x: i % width, y: (i / width) | 0 });
  const quad = orderQuad([toPoint(tl), toPoint(tr), toPoint(br), toPoint(bl)]);

  // Garde-fous : aire plausible et coins réellement distincts.
  if (quadArea(quad) < width * height * MIN_AREA_RATIO) return null;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    if (Math.hypot(a.x - b.x, a.y - b.y) < Math.min(width, height) * 0.15) return null;
  }
  return quad;
}

/** Luminance moyenne (0-255) d'une vignette — pour l'indice « manque de lumière ». */
export function meanLuminance(img: ImageData): number {
  const gray = luminance(img);
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  return sum / gray.length;
}
