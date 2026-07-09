import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { LetterAddress } from "@/lib/courrier/merci-facteur";

/*
 * Lettre A4 générée côté serveur (pdf-lib) à partir du texte EXACTEMENT
 * approuvé par l'utilisateur (hash approval_logs) : bloc expéditeur, bloc
 * destinataire, date, objet, mention recommandé, corps paginé. Aucune
 * réécriture du contenu — mise en page uniquement.
 */

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 64;
const SIZE = 11;
const LEAD = 16;

// Les polices standard PDF encodent en WinAnsi (Latin-1 + ponctuation
// typographique). On normalise les blancs exotiques et on remplace tout
// caractère hors répertoire par un équivalent sûr — jamais de troncature.
const NOT_WINANSI =
  /[^\n\x20-\x7E¡-ÿ€‘’‚“”„–—…‰‹›ŒœŠšŸŽžˆ˜†‡•™]/g;

function sanitize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .replace(/[\u2010-\u2012]/g, "-")
    .replace(NOT_WINANSI, "'");
}

type Font = Awaited<ReturnType<PDFDocument["embedFont"]>>;

/** Coupe un texte en lignes tenant dans maxWidth (coupe brute des mots trop longs). */
function wrap(text: string, font: Font, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    const words = raw.split(/ +/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const probe = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(probe, size) <= maxWidth) {
        line = probe;
        continue;
      }
      if (line) lines.push(line);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word;
        continue;
      }
      let chunk = "";
      for (const ch of word) {
        if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      line = chunk;
    }
    lines.push(line);
  }
  return lines;
}

function addressLines(a: LetterAddress): string[] {
  // Ordre AFNOR : dénomination, personne, complément/service, voie, CP+ville.
  return [
    a.societe?.trim() || null,
    a.nom?.trim() || null,
    a.complement?.trim() || null,
    a.adresse.trim(),
    `${a.codePostal.trim()} ${a.ville.trim().toUpperCase()}`,
  ].filter((l): l is string => Boolean(l));
}

/**
 * Construit le PDF de la lettre et le renvoie en base64 (format attendu par
 * l'API Merci Facteur, champ content.letter.base64files).
 */
export async function buildLetterPdf(input: {
  subject: string;
  bodyMd: string;
  exp: LetterAddress;
  dest: LetterAddress;
  registered?: boolean;
}): Promise<string> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const width = A4[0] - MARGIN * 2;

  let page = doc.addPage(A4);
  let y = A4[1] - MARGIN;

  const drawLine = (text: string, f: Font, size: number, x = MARGIN) => {
    page.drawText(text, { x, y, size, font: f });
    y -= LEAD;
  };
  const newPageIfNeeded = () => {
    if (y < MARGIN + LEAD) {
      page = doc.addPage(A4);
      y = A4[1] - MARGIN;
    }
  };

  // Bloc expéditeur (haut gauche).
  for (const l of addressLines(input.exp)) drawLine(sanitize(l), font, SIZE);

  // Bloc destinataire (à droite, sous l'expéditeur — zone fenêtre C5/C4).
  y -= LEAD * 2;
  for (const l of addressLines(input.dest)) drawLine(sanitize(l), font, SIZE, 320);

  // Date (alignée sur le bloc destinataire).
  y -= LEAD;
  const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  drawLine(sanitize(`${input.exp.ville.trim()}, le ${date}`), font, SIZE, 320);

  // Objet + mention d'envoi.
  y -= LEAD;
  for (const l of wrap(sanitize(`Objet : ${input.subject}`), bold, SIZE, width)) {
    newPageIfNeeded();
    drawLine(l, bold, SIZE);
  }
  if (input.registered !== false) {
    drawLine("Lettre recommandée avec accusé de réception", font, SIZE);
  }
  y -= LEAD;

  // Corps : le texte approuvé, paginé.
  for (const l of wrap(sanitize(input.bodyMd), font, SIZE, width)) {
    newPageIfNeeded();
    drawLine(l, font, SIZE);
  }

  return doc.saveAsBase64();
}

/**
 * Met en page une annexe IMAGE (JPEG/PNG) en PDF A4 imprimable, avec le nom
 * de la pièce en en-tête (le destinataire sait ce qu'il regarde). Les annexes
 * déjà en PDF sont jointes telles quelles, sans passer par ici.
 */
export async function imageToPdfBase64(input: {
  fileName: string;
  mimeType: string;
  base64: string;
}): Promise<string> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bytes = Buffer.from(input.base64, "base64");
  const image =
    input.mimeType === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);

  const page = doc.addPage(A4);
  const caption = wrap(sanitize(`Pièce jointe — ${input.fileName}`), font, 9, A4[0] - MARGIN * 2)[0] ?? "";
  page.drawText(caption, {
    x: MARGIN,
    y: A4[1] - MARGIN,
    size: 9,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });

  // Image ajustée dans la zone utile (ratio conservé), centrée horizontalement.
  const maxW = A4[0] - MARGIN * 2;
  const maxH = A4[1] - MARGIN * 2 - 24;
  const scale = Math.min(maxW / image.width, maxH / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  page.drawImage(image, {
    x: MARGIN + (maxW - w) / 2,
    y: A4[1] - MARGIN - 24 - h,
    width: w,
    height: h,
  });

  return doc.saveAsBase64();
}
