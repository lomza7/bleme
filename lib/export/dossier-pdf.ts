import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/*
 * Génère la synthèse PDF d'un dossier (identité, société débitrice, montants,
 * chronologie, courriers avec preuves, pièces numérotées) avec pdf-lib — texte
 * posé programmatiquement, sans navigateur (fiable en serverless). Registre
 * non-juridique : « synthèse », « modèle », jamais de conseil.
 */

export type DossierPdfData = {
  orgName: string;
  title: string;
  caseTypeLabel: string;
  statusLabel: string;
  debtorName: string;
  createdAtLabel: string;
  amountClaimed: number; // centimes
  amountRecovered: number; // centimes
  company: { nom: string; extra: string[] } | null;
  summary: string | null;
  events: { dateLabel: string; title: string; description: string | null }[];
  letters: { label: string; statusLabel: string; detail: string | null }[];
  approvals: string[];
  replies: { header: string; text: string }[];
  documents: string[];
  eurosFmt: (cents: number) => string;
};

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 54;
const INK = rgb(0.1, 0.09, 0.11);
const MUTED = rgb(0.42, 0.42, 0.46);
const BRAND = rgb(0.62, 0.25, 0.05);

// pdf-lib (Helvetica/WinAnsi) couvre le français + € ; on remplace les
// caractères typographiques hors jeu et on RETIRE les caractères de contrôle
// (C0 non-blancs, DEL, C1 0x80-0x9F : non encodables WinAnsi — un seul octet,
// issu d'un email Windows-1252 mal décodé par exemple, ferait lever drawText
// et planterait tout l'export). \n est préservé : wrap() splitte dessus.
function safe(s: string): string {
  return (s || "")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[   ]/g, " ")
    .replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, "")
    .replace(/[^\x0A\x20-\xFF€•·]/g, "");
}

class Writer {
  doc!: PDFDocument;
  page!: PDFPage;
  font!: PDFFont;
  bold!: PDFFont;
  y = 0;
  readonly width = A4[0];
  readonly contentW = A4[0] - MARGIN * 2;

  async init() {
    this.doc = await PDFDocument.create();
    this.font = await this.doc.embedFont(StandardFonts.Helvetica);
    this.bold = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.addPage();
  }

  private addPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - MARGIN;
  }

  private ensure(space: number) {
    if (this.y - space < MARGIN) this.addPage();
  }

  gap(n = 8) {
    this.y -= n;
  }

  /** Coupe un « mot » plus large que la colonne (nom de fichier, URL) caractère par caractère. */
  private breakWord(word: string, font: PDFFont, size: number, maxW: number): string[] {
    const parts: string[] = [];
    let cur = "";
    for (const ch of word) {
      if (font.widthOfTextAtSize(cur + ch, size) > maxW && cur) {
        parts.push(cur);
        cur = ch;
      } else {
        cur += ch;
      }
    }
    if (cur) parts.push(cur);
    return parts.length ? parts : [word];
  }

  private wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
    const out: string[] = [];
    for (const rawLine of text.split("\n")) {
      const words = rawLine
        .split(/\s+/)
        .filter(Boolean)
        .flatMap((w) =>
          font.widthOfTextAtSize(w, size) > maxW ? this.breakWord(w, font, size, maxW) : [w],
        );
      if (words.length === 0) {
        out.push("");
        continue;
      }
      let line = "";
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(test, size) > maxW && line) {
          out.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) out.push(line);
    }
    return out;
  }

  line(
    text: string,
    opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number; lh?: number } = {},
  ) {
    const size = opts.size ?? 10.5;
    const font = opts.bold ? this.bold : this.font;
    const color = opts.color ?? INK;
    const indent = opts.indent ?? 0;
    const lh = opts.lh ?? size * 1.4;
    const lines = this.wrap(safe(text), font, size, this.contentW - indent);
    for (const l of lines) {
      this.ensure(lh);
      if (l) this.page.drawText(l, { x: MARGIN + indent, y: this.y - size, size, font, color });
      this.y -= lh;
    }
  }

  heading(text: string) {
    this.gap(14);
    this.ensure(22);
    // Filet + titre de section.
    this.page.drawRectangle({ x: MARGIN, y: this.y - 2, width: 22, height: 2.5, color: BRAND });
    this.y -= 12;
    this.line(text.toUpperCase(), { size: 9, bold: true, color: MUTED, lh: 14 });
    this.gap(2);
  }

  keyVal(rows: { k: string; v: string }[]) {
    const size = 10.5;
    for (const { k, v } of rows) {
      this.ensure(size * 1.5);
      this.page.drawText(safe(k), { x: MARGIN, y: this.y - size, size, font: this.font, color: MUTED });
      this.page.drawText(safe(v), { x: MARGIN + 160, y: this.y - size, size, font: this.bold, color: INK });
      this.y -= size * 1.6;
    }
  }

  async bytes(): Promise<Uint8Array> {
    return this.doc.save();
  }
}

export async function buildDossierPdf(d: DossierPdfData): Promise<Uint8Array> {
  const w = new Writer();
  await w.init();

  // En-tête
  w.line("BLEME", { size: 16, bold: true, color: BRAND, lh: 20 });
  w.line("Dossier prêt pour un professionnel", { size: 9, color: MUTED, lh: 16 });
  w.gap(10);
  w.line(d.title, { size: 18, bold: true, lh: 24 });
  w.line(`${d.caseTypeLabel} · ${d.debtorName} · ${d.statusLabel}`, { size: 10.5, color: MUTED });
  w.line(`${d.orgName} · créé le ${d.createdAtLabel}`, { size: 9.5, color: MUTED });

  w.heading("Montants");
  w.keyVal([
    { k: "Montant réclamé", v: d.eurosFmt(d.amountClaimed) },
    { k: "Montant récupéré", v: d.eurosFmt(d.amountRecovered) },
    { k: "Reste dû", v: d.eurosFmt(Math.max(0, d.amountClaimed - d.amountRecovered)) },
  ]);

  if (d.company) {
    w.heading("Société débitrice");
    w.line(d.company.nom, { bold: true });
    for (const e of d.company.extra) w.line(e, { size: 10, color: MUTED });
  }

  if (d.summary) {
    w.heading("Synthèse du dossier");
    w.line(d.summary, { size: 10.5, lh: 15 });
  }

  if (d.events.length) {
    w.heading("Chronologie");
    for (const e of d.events) {
      w.line(e.dateLabel, { size: 9, bold: true, color: BRAND, lh: 13 });
      w.line(e.description ? `${e.title} — ${e.description}` : e.title, { size: 10.5, indent: 6, lh: 14 });
      w.gap(3);
    }
  }

  w.heading("Courriers");
  if (d.letters.length) {
    for (const l of d.letters) {
      w.line(`${l.label}  ·  ${l.statusLabel}`, { size: 10.5, bold: true, lh: 14 });
      if (l.detail) w.line(l.detail, { size: 9, color: MUTED, indent: 6, lh: 13 });
      w.gap(3);
    }
  } else {
    w.line("Aucun courrier.", { color: MUTED });
  }

  if (d.replies.length) {
    w.heading("Retours du client");
    for (const r of d.replies) {
      w.line(r.header, { size: 9, color: MUTED, lh: 13 });
      w.line(r.text, { size: 10.5, indent: 6, lh: 14 });
      w.gap(3);
    }
  }

  w.heading("Preuves de validation");
  if (d.approvals.length) {
    for (const a of d.approvals) w.line(`· ${a}`, { size: 9, color: MUTED, lh: 13 });
  } else {
    w.line("Aucune validation enregistrée.", { color: MUTED });
  }

  w.heading("Pièces jointes");
  if (d.documents.length) {
    d.documents.forEach((name, i) => w.line(`${String(i + 1).padStart(2, "0")}.  ${name}`, { size: 10, lh: 14 }));
  } else {
    w.line("Aucune pièce.", { color: MUTED });
  }

  w.gap(18);
  w.line(
    "Document généré par BLEME. Modèles et suggestions, à faire valider par un professionnel en cas de doute.",
    { size: 8, color: MUTED, lh: 11 },
  );

  return w.bytes();
}
