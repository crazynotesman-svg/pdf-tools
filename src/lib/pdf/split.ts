/**
 * split.ts — split a PDF into several smaller PDFs.
 *
 * Pure function. Two modes:
 *   - { mode: 'each' }                 -> one file per page (default)
 *   - { mode: 'ranges', ranges }       -> one file per 1-based inclusive range
 *
 * Page indices are 0-based internally; ranges are expressed 1-based so the UI
 * can show natural "pages 1–3" labels. No DOM, no network.
 */
import { PDFDocument } from 'pdf-lib';
import type { PdfInput, PdfOutput } from './types';
import { stripExt } from './types';

export type SplitMode =
  | { mode: 'each' }
  | { mode: 'ranges'; ranges: Array<[number, number]> };

/**
 * Split `input` into one or more PDFs.
 *
 * @param input the source PDF.
 * @param options split mode; defaults to one file per page.
 */
export async function splitPdf(
  input: PdfInput,
  options: SplitMode = { mode: 'each' },
): Promise<PdfOutput[]> {
  const doc = await PDFDocument.load(input.bytes);
  const count = doc.getPageCount();
  const base = stripExt(input.name);

  // Build groups of 0-based page indices.
  const groups: number[][] = [];
  if (options.mode === 'each') {
    for (let i = 0; i < count; i++) groups.push([i]);
  } else {
    for (const [start, end] of options.ranges) {
      const from = Math.max(1, Math.min(start, count));
      const to = Math.max(from, Math.min(end, count));
      const grp: number[] = [];
      for (let i = from; i <= to; i++) grp.push(i - 1);
      groups.push(grp);
    }
  }

  const results: PdfOutput[] = [];
  for (const grp of groups) {
    if (grp.length === 0) continue;
    const part = await PDFDocument.create();
    const pages = await part.copyPages(doc, grp);
    for (const page of pages) part.addPage(page);
    const bytes = await part.save();
    const first = grp[0] + 1;
    const last = grp[grp.length - 1] + 1;
    const name =
      grp.length === 1 ? `${base}-p${first}.pdf` : `${base}-p${first}-${last}.pdf`;
    results.push({ name, bytes });
  }

  return results;
}
