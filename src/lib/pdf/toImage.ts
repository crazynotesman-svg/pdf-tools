/**
 * toImage.ts — render each PDF page to a raster image (JPG or PNG).
 *
 * This is the only module that touches the DOM (a <canvas>), and ONLY inside
 * the function body — never at import time. pdf.js is imported dynamically so
 * the module can be evaluated on the server during island SSR without hitting
 * any browser-only globals. The pdf.js worker is loaded via a Vite `?url`
 * import and assigned lazily on first call (client-side only).
 */
import type { PdfInput, PdfImageOutput } from './types';
import { stripExt } from './types';

/** Worker URL resolved by Vite (emitted as a static asset in the build). */
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export interface ToImageOptions {
  /** Output format. Defaults to JPEG (smaller, white background). */
  format?: 'image/jpeg' | 'image/png';
  /** Render scale (device-independent). 2 ≈ print quality. */
  scale?: number;
  /** JPEG quality 0..1 (ignored for PNG). */
  quality?: number;
}

let workerReady = false;
function ensureWorker(pdfjs: typeof import('pdfjs-dist')): void {
  if (!workerReady) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    workerReady = true;
  }
}

/**
 * Render every page of `input` to an image.
 *
 * @returns one PdfImageOutput per page, in page order.
 */
export async function pdfToImages(
  input: PdfInput,
  options: ToImageOptions = {},
): Promise<PdfImageOutput[]> {
  // Dynamic import keeps pdf.js (and its browser globals) out of SSR.
  const pdfjs = await import('pdfjs-dist');
  ensureWorker(pdfjs);

  const format = options.format ?? 'image/jpeg';
  const scale = options.scale ?? 2;
  const quality = options.quality ?? 0.92;
  const ext = format === 'image/png' ? 'png' : 'jpg';
  const base = stripExt(input.name);

  const loadingTask = pdfjs.getDocument({ data: input.bytes.slice() });
  const pdf = await loadingTask.promise;

  const outputs: PdfImageOutput[] = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('pdfToImages: 2D canvas context unavailable');

      // JPEG has no alpha; paint white so transparent areas aren't black.
      if (format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      await page.render({ canvasContext: ctx, viewport }).promise;
      // eslint-disable-next-line no-await-in-loop
      const blob = await canvasToBlob(canvas, format, quality);
      outputs.push({ name: `${base}-p${i}.${ext}`, blob, mime: format });
      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }

  // Optional client-side compression to keep downloads small.
  return compressAll(outputs, format, quality);
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      format,
      quality,
    );
  });
}

async function compressAll(
  outputs: PdfImageOutput[],
  format: string,
  quality: number,
): Promise<PdfImageOutput[]> {
  try {
    const imageCompression = (await import('browser-image-compression')).default;
    return await Promise.all(
      outputs.map(async (out) => {
        const compressed = await imageCompression(out.blob, {
          fileType: format,
          initialQuality: quality,
          useWebWorker: true,
          maxWidthOrHeight: 4096,
        });
        return { ...out, blob: compressed as Blob };
      }),
    );
  } catch {
    // Compression is a best-effort optimization; fall back to raw blobs.
    return outputs;
  }
}
