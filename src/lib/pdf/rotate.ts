/**
 * rotate.ts — rotate pages of a PDF.
 *
 * Pure function. Rotation is ADDED to each page's existing orientation
 * (modulo 360) so repeated runs are predictable. No DOM, no network.
 */
import { PDFDocument, degrees } from 'pdf-lib';
import type { PdfInput } from './types';
import { stripExt } from './types';

export type RotationStep = 90 | 180 | 270;

/**
 * Rotate pages of `input` by `step` degrees.
 *
 * @param input the source PDF.
 * @param step  clockwise rotation to apply (90 | 180 | 270).
 * @param pages which pages to rotate; 'all' or 1-based indices.
 */
export async function rotatePdf(
  input: PdfInput,
  step: RotationStep,
  pages: 'all' | number[] = 'all',
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input.bytes);
  const total = doc.getPageCount();

  const targets: number[] =
    pages === 'all'
      ? doc.getPageIndices()
      : pages
          .map((p) => p - 1)
          .filter((i) => i >= 0 && i < total);

  for (const idx of targets) {
    const page = doc.getPages()[idx];
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + step) % 360));
  }

  return doc.save();
}

/** Convenience wrapper that returns a named PdfOutput for download. */
export async function rotatePdfToOutput(
  input: PdfInput,
  step: RotationStep,
  pages: 'all' | number[] = 'all',
): Promise<{ name: string; bytes: Uint8Array }> {
  const bytes = await rotatePdf(input, step, pages);
  return { name: `${stripExt(input.name)}-rotated.pdf`, bytes };
}
