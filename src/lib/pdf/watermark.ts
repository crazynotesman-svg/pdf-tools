/**
 * watermark.ts — overlay a repeating text watermark on every page.
 *
 * Pure function: bytes -> bytes. Uses pdf-lib's built-in Helvetica (a standard
 * font, no embedding needed). Text is drawn on a diagonal tile grid with a
 * configurable opacity, size and rotation. No DOM, no network.
 */
import { PDFDocument, StandardFonts, rgb, degrees, type RGB } from 'pdf-lib';
import type { PdfInput, PdfOutput } from './types';
import { stripExt } from './types';

export interface WatermarkOptions {
  /** Watermark text (e.g. "CONFIDENTIAL"). */
  text: string;
  /** Opacity 0..1. Defaults to 0.15. */
  opacity?: number;
  /** Tile rotation in degrees. Defaults to -30 (diagonal). */
  rotation?: number;
  /** Font size in PDF points. Defaults to 48. */
  size?: number;
  /** Watermark color. Defaults to a soft slate gray. */
  color?: RGB;
}

/**
 * Add a tiled diagonal watermark to every page of `input`.
 */
export async function watermarkPdf(
  input: PdfInput,
  options: WatermarkOptions,
): Promise<PdfOutput> {
  const text = options.text;
  if (!text) {
    throw new Error('watermarkPdf: watermark text is required');
  }

  const doc = await PDFDocument.load(input.bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = options.size ?? 48;
  const opacity = options.opacity ?? 0.15;
  const rotation = options.rotation ?? -30;
  const color = options.color ?? rgb(0.42, 0.47, 0.55);
  const textWidth = font.widthOfTextAtSize(text, size);

  for (const page of doc.getPages()) {
    const w = page.getWidth();
    const h = page.getHeight();

    // Tile step sized so the diagonal grid covers the whole page.
    const stepX = textWidth + 160;
    const stepY = 200;
    const diag = Math.ceil((w + h) / 2);

    for (let y = -diag; y <= h; y += stepY) {
      for (let x = -diag; x <= w; x += stepX) {
        page.drawText(text, {
          x,
          y,
          size,
          font,
          color,
          opacity,
          rotate: degrees(rotation),
        });
      }
    }
  }

  const bytes = await doc.save();
  return { name: `${stripExt(input.name)}-watermarked.pdf`, bytes };
}
