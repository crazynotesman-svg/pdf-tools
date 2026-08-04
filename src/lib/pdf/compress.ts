/**
 * compress.ts — reduce a PDF's file size.
 *
 * Two modes (per Phase 2.1 constraint #1):
 *   - 'standard' (DEFAULT): PDF-preserving repack via pdf-lib — the text layer,
 *     fonts and quality are all kept; gains depend on the source file's
 *     structure (redundant objects, verbose xref, unused metadata).
 *   - 'strong' (OPT-IN): rasterize every page to a JPEG and rebuild the PDF.
 *     Maximum size reduction, but pages become images (the searchable text
 *     layer is lost). The UI must clearly distinguish both modes.
 *
 * Pure function: bytes -> bytes. pdf.js is imported dynamically inside the
 * function body so the module stays SSR-safe (same pattern as toImage.ts).
 */
import { PDFDocument } from 'pdf-lib';
import type { PdfInput, PdfOutput } from './types';
import { stripExt } from './types';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export type CompressMode = 'standard' | 'strong';

export interface CompressOptions {
  /** Compression strategy. Defaults to 'standard' (text-preserving). */
  mode?: CompressMode;
  /** JPEG quality 0..1 for 'strong' mode (default 0.7). */
  quality?: number;
  /** Render scale for 'strong' mode (default 1.5). */
  scale?: number;
}

/**
 * Compress `input`.
 *
 * 'standard': reload + re-save the document with object streams and a trimmed
 * metadata block. Zero visual change, text stays selectable.
 *
 * 'strong': render each page to a JPEG and rebuild the PDF page-by-page. The
 * original page size is preserved; only the rasterized image is embedded.
 */
export async function compressPdf(
  input: PdfInput,
  options: CompressOptions = {},
): Promise<PdfOutput> {
  const mode = options.mode ?? 'standard';
  const bytes =
    mode === 'strong'
      ? await compressStrong(input, options.quality ?? 0.7, options.scale ?? 1.5)
      : await compressStandard(input);
  return { name: `${stripExt(input.name)}-compressed.pdf`, bytes };
}

/** PDF-preserving repack: object streams + minimal metadata. */
async function compressStandard(input: PdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input.bytes);
  // Trim the document-info block (safe, reproducible output).
  doc.setTitle('');
  doc.setAuthor('');
  doc.setSubject('');
  doc.setKeywords([]);
  doc.setProducer('');
  doc.setCreator('');
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  // Object streams compress the internal object graph (lossless).
  return doc.save({ useObjectStreams: true });
}

/** Rasterize every page to JPEG and rebuild the PDF (opt-in strong mode). */
async function compressStrong(
  input: PdfInput,
  quality: number,
  scale: number,
): Promise<Uint8Array> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const loadingTask = pdfjs.getDocument({ data: input.bytes.slice() });
  const src = await loadingTask.promise;

  const out = await PDFDocument.create();
  try {
    for (let i = 1; i <= src.numPages; i++) {
      const page = await src.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('compressPdf: 2D canvas context unavailable');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      page.cleanup();

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
          'image/jpeg',
          quality,
        );
      });
      const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const outPage = out.addPage([page.getViewport({ scale: 1 }).width, page.getViewport({ scale: 1 }).height]);
      outPage.drawImage(jpg, {
        x: 0,
        y: 0,
        width: outPage.getWidth(),
        height: outPage.getHeight(),
      });
    }
  } finally {
    await src.destroy();
  }

  return out.save();
}
