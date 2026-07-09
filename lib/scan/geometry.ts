/*
 * Géométrie du scan : correction de perspective en pur JavaScript (Canvas).
 * Pas d'OpenCV (~9 Mo de WASM, rédhibitoire sur un réseau de chantier) : une
 * homographie 4 points + échantillonnage bilinéaire suffisent pour redresser
 * un document photographié de biais.
 */

export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point]; // TL, TR, BR, BL

/** Côté max du document redressé : assez pour l'OCR vision, JPEG < 2 Mo. */
export const MAX_OUTPUT_SIDE = 2400;

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Ordonne 4 points en TL, TR, BR, BL (somme min = TL, diff max = TR…). */
export function orderQuad(points: Point[]): Quad {
  const bySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y));
  const byDiff = [...points].sort((a, b) => a.x - a.y - (b.x - b.y));
  return [bySum[0], byDiff[byDiff.length - 1], bySum[bySum.length - 1], byDiff[0]];
}

/** Quad par défaut : cadre en retrait de 8 % — point de départ du réglage manuel. */
export function insetQuad(width: number, height: number, ratio = 0.08): Quad {
  const mx = width * ratio;
  const my = height * ratio;
  return [
    { x: mx, y: my },
    { x: width - mx, y: my },
    { x: width - mx, y: height - my },
    { x: mx, y: height - my },
  ];
}

/** Aire d'un quadrilatère (formule du lacet). */
export function quadArea(q: Quad): number {
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/**
 * Dimensions de sortie : moyenne des côtés opposés (plus stable que le max,
 * qui étire l'image quand un bord est mal placé), plafonnée à MAX_OUTPUT_SIDE.
 */
export function outputSize(q: Quad): { width: number; height: number } {
  const w = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2;
  const h = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
  const scale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(w, h));
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

/**
 * Homographie destination → source (8 inconnues, élimination de Gauss avec
 * pivot partiel). dst = rectangle de sortie (0,0)…(w,h), src = les 4 coins
 * pointés sur la photo.
 */
function homography(dst: Quad, src: Quad): number[] | null {
  // 8 équations : pour chaque coin, u=(a x+b y+c)/(g x+h y+1), v=(d x+e y+f)/(…)
  const m: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = dst[i];
    const { x: u, y: v } = src[i];
    m.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    m.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    if (Math.abs(m[pivot][col]) < 1e-10) return null; // quad dégénéré
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let row = 0; row < 8; row++) {
      if (row === col) continue;
      const f = m[row][col] / m[col][col];
      for (let k = col; k < 9; k++) m[row][k] -= f * m[col][k];
    }
  }
  return m.map((row, i) => row[8] / row[i]);
}

/**
 * Redresse le document : pour chaque pixel de sortie, retrouve sa position
 * dans la photo source (mapping inverse) et échantillonne en bilinéaire.
 * ~7 M pixels max → quelques centaines de ms sur mobile, à appeler derrière
 * un spinner, jamais dans la boucle de prévisualisation.
 */
export function warpPerspective(
  src: ImageData,
  quad: Quad,
  outWidth: number,
  outHeight: number,
): ImageData | null {
  const dstRect: Quad = [
    { x: 0, y: 0 },
    { x: outWidth, y: 0 },
    { x: outWidth, y: outHeight },
    { x: 0, y: outHeight },
  ];
  const h = homography(dstRect, quad);
  if (!h) return null;
  const [a, b, c, d, e, f, g, hh] = h;

  const out = new ImageData(outWidth, outHeight);
  const sp = src.data;
  const dp = out.data;
  const sw = src.width;
  const sh = src.height;

  let di = 0;
  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x++) {
      const denom = g * x + hh * y + 1;
      const sx = (a * x + b * y + c) / denom;
      const sy = (d * x + e * y + f) / denom;
      if (sx < 0 || sy < 0 || sx > sw - 1 || sy > sh - 1) {
        dp[di] = dp[di + 1] = dp[di + 2] = 255;
        dp[di + 3] = 255;
        di += 4;
        continue;
      }
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, sw - 1);
      const y1 = Math.min(y0 + 1, sh - 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;
      dp[di] = sp[i00] * w00 + sp[i10] * w10 + sp[i01] * w01 + sp[i11] * w11;
      dp[di + 1] = sp[i00 + 1] * w00 + sp[i10 + 1] * w10 + sp[i01 + 1] * w01 + sp[i11 + 1] * w11;
      dp[di + 2] = sp[i00 + 2] * w00 + sp[i10 + 2] * w10 + sp[i01 + 2] * w01 + sp[i11 + 2] * w11;
      dp[di + 3] = 255;
      di += 4;
    }
  }
  return out;
}
