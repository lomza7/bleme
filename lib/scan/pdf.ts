/*
 * Assemblage des pages scannées en un PDF unique, côté navigateur (pdf-lib,
 * import dynamique : ne pèse rien tant qu'on ne termine pas un scan
 * multi-pages). Un devis de 3 pages = UNE pièce dans le dossier, pas trois
 * photos éparses — et la vision de Nora lit les PDF nativement.
 */

/** Pages JPEG → un PDF (une image par page, dimensions préservées à 150 dpi). */
export async function buildPdfFromJpegs(pages: Blob[]): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  for (const page of pages) {
    const jpg = await doc.embedJpg(await page.arrayBuffer());
    // Le PDF compte en points (72/pouce) ; nos scans visent ~150 dpi.
    const w = (jpg.width * 72) / 150;
    const h = (jpg.height * 72) / 150;
    const p = doc.addPage([w, h]);
    p.drawImage(jpg, { x: 0, y: 0, width: w, height: h });
  }
  const bytes = await doc.save();
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}
