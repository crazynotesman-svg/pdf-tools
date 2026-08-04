/**
 * protect.ts — add a password to a PDF.
 *
 * Per Phase 2.1 constraint #2: the UI copy must NEVER claim military-grade or
 * bank-level encryption. Use only "Password protect PDF locally in your
 * browser". Implementation uses jsPDF's built-in standard PDF encryption
 * (RC4, revision 2) — old but universally supported by PDF viewers.
 *
 * Pure-frontend reality: pdf-lib (used elsewhere) cannot WRITE encrypted PDFs,
 * and no browser library can keep the text layer while adding a password to an
 * existing file. So this tool renders every page as a high-quality image and
 * re-emits an encrypted PDF (jsPDF `options.encryption`). Visual content is
 * preserved; the text layer becomes part of the image — the FAQ/UI say so.
 *
 * jsPDF is imported dynamically inside the function body so it is split into
 * its own chunk and never loaded on pages for the other tools.
 */
import type { PdfInput, PdfOutput } from './types';
import { stripExt } from './types';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export interface ProtectOptions {
  /** Password the recipient must enter to open the file. */
  userPassword: string;
  /** Owner password (full control). Defaults to the user password. */
  ownerPassword?: string;
}

/**
 * Encrypt `input` with `userPassword`. All permission bits stay enabled — we
 * only lock opening the file.
 */
export async function protectPdf(
  input: PdfInput,
  options: ProtectOptions,
): Promise<PdfOutput> {
  if (!options.userPassword) {
    throw new Error('protectPdf: a password is required');
  }

  const { jsPDF } = await import('jspdf');

  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const loadingTask = pdfjs.getDocument({ data: input.bytes.slice() });
  const src = await loadingTask.promise;

  // `encryption` is a jsPDF constructor option (its TS types omit it).
  const doc = new jsPDF({
    unit: 'pt',
    format: [595.28, 841.89],
    orientation: 'portrait',
    compress: true,
    encryption: {
      userPassword: options.userPassword,
      ownerPassword: options.ownerPassword ?? options.userPassword,
      userPermissions: ['print', 'modify', 'copy', 'annot-forms'],
    },
  } as never);

  try {
    for (let i = 1; i <= src.numPages; i++) {
      const page = await src.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('protectPdf: 2D canvas context unavailable');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      page.cleanup();

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const vp1 = page.getViewport({ scale: 1 });
      const w = vp1.width;
      const h = vp1.height;
      const orient = w > h ? 'landscape' : 'portrait';

      if (i === 1) {
        doc.addImage(dataUrl, 'JPEG', 0, 0, w, h);
      } else {
        doc.addPage([w, h], orient);
        doc.addImage(dataUrl, 'JPEG', 0, 0, w, h);
      }
    }
  } finally {
    await src.destroy();
  }

  const out = doc.output('arraybuffer');
  return { name: `${stripExt(input.name)}-protected.pdf`, bytes: new Uint8Array(out) };
}
