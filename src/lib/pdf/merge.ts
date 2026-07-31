/**
 * merge.ts — combine several PDFs into one.
 *
 * Pure function: input buffers -> output buffer. Uses pdf-lib's `copyPages`
 * so each source page is embedded once into a fresh target document. No DOM,
 * no network. Runs entirely in the browser.
 */
import { PDFDocument } from 'pdf-lib';
import type { PdfInput, PdfOutput } from './types';

/**
 * Merge multiple PDFs (in the given order) into a single PDF.
 *
 * @param inputs ordered list of { name, bytes }; at least one is required.
 * @returns the merged document as raw bytes.
 */
export async function mergePdfs(inputs: PdfInput[]): Promise<Uint8Array> {
  if (inputs.length === 0) {
    throw new Error('mergePdfs: at least one input is required');
  }

  const out = await PDFDocument.create();

  for (const input of inputs) {
    const src = await PDFDocument.load(input.bytes);
    const indices = src.getPageIndices();
    const pages = await out.copyPages(src, indices);
    for (const page of pages) {
      out.addPage(page);
    }
  }

  return out.save();
}

/** Convenience wrapper that returns a named PdfOutput for download. */
export async function mergePdfsToOutput(inputs: PdfInput[]): Promise<PdfOutput> {
  const bytes = await mergePdfs(inputs);
  const first = stripExtOf(inputs[0].name);
  return { name: `${first}-merged.pdf`, bytes };
}

function stripExtOf(name: string): string {
  return name.replace(/\.[^./\\]+$/, '');
}
