/*
 * Contrôle qualité du scan AVANT envoi : netteté (variance du laplacien),
 * exposition (histogramme) et reflets. Le but produit : bloquer les photos
 * dont Nora ne pourra rien extraire — plutôt reprendre la photo sur place
 * que découvrir une pièce illisible dans le dossier.
 *
 * Les verdicts restent indicatifs : l'utilisateur peut toujours forcer
 * l'envoi (pilier #3 — sa décision prime), le dossier garde alors une pièce
 * marquée « qualité faible » par la vision en aval.
 */

export type QualityVerdict = "bonne" | "moyenne" | "faible";

export type QualityReport = {
  verdict: QualityVerdict;
  /** Problèmes détectés, formulés pour l'utilisateur (français, actionnables). */
  issues: string[];
  /** Netteté : variance du laplacien sur la luminance (échelle interne). */
  sharpness: number;
  /** Luminance moyenne 0-255. */
  brightness: number;
};

// Seuils calés sur des documents (texte imprimé) évalués à ~1000 px de large.
// Volontairement prudents : une page presque vide a peu de contours, on ne
// veut pas la rejeter à tort — on bloque uniquement le flou franc.
const SHARPNESS_REJECT = 14;
const SHARPNESS_WARN = 45;
const DARK_REJECT = 45;
const DARK_WARN = 75;
const BRIGHT_WARN = 232;
const GLARE_RATIO_WARN = 0.06; // > 6 % de pixels saturés = reflet probable
/** En dessous de ce côté min (px), la vision perd trop de détail. */
const MIN_SIDE_WARN = 700;

/** Largeur d'analyse : la netteté dépend de l'échelle, on normalise. */
export const QUALITY_ANALYSIS_WIDTH = 1000;

function luminance(img: ImageData): Float32Array {
  const { data, width, height } = img;
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  return out;
}

/** Variance du laplacien (noyau croix) — mesure classique de netteté. */
function laplacianVariance(gray: Float32Array, width: number, height: number): number {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/**
 * Évalue la lisibilité du document redressé. `img` doit être une version
 * ~QUALITY_ANALYSIS_WIDTH px de large (les seuils de netteté en dépendent) ;
 * `fullSize` = dimensions réelles de la sortie, pour l'alerte résolution.
 */
export function assessQuality(
  img: ImageData,
  fullSize: { width: number; height: number },
): QualityReport {
  const gray = luminance(img);
  const sharpness = laplacianVariance(gray, img.width, img.height);

  let sum = 0;
  let saturated = 0;
  for (let i = 0; i < gray.length; i++) {
    sum += gray[i];
    if (gray[i] >= 250) saturated++;
  }
  const brightness = sum / gray.length;
  const glareRatio = saturated / gray.length;

  const issues: string[] = [];
  let verdict: QualityVerdict = "bonne";
  const downgrade = (to: QualityVerdict) => {
    if (to === "faible" || verdict === "bonne") verdict = to;
  };

  if (sharpness < SHARPNESS_REJECT) {
    issues.push("La photo est floue : le texte ne sera pas lisible. Stabilisez le téléphone et reprenez.");
    downgrade("faible");
  } else if (sharpness < SHARPNESS_WARN) {
    issues.push("Netteté limite : certaines mentions risquent d'être mal lues.");
    downgrade("moyenne");
  }

  if (brightness < DARK_REJECT) {
    issues.push("Photo trop sombre : rapprochez-vous d'une source de lumière.");
    downgrade("faible");
  } else if (brightness < DARK_WARN) {
    issues.push("Éclairage faible : la lecture sera moins fiable.");
    downgrade("moyenne");
  } else if (brightness > BRIGHT_WARN) {
    issues.push("Photo surexposée : éloignez le document de la lumière directe.");
    downgrade("moyenne");
  }

  if (glareRatio > GLARE_RATIO_WARN && brightness <= BRIGHT_WARN) {
    issues.push("Reflet détecté : inclinez légèrement le document ou coupez le flash.");
    downgrade("moyenne");
  }

  if (Math.min(fullSize.width, fullSize.height) < MIN_SIDE_WARN) {
    issues.push("Document trop petit dans le cadre : rapprochez-vous avant de reprendre.");
    downgrade("moyenne");
  }

  return { verdict, issues, sharpness, brightness };
}
