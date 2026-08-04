/**
 * unlock.ts — remove password protection from a PDF.
 *
 * Per Phase 2.1 constraint #3: ONLY unlock with a KNOWN password. There is no
 * password cracking, no dictionary or brute-force logic anywhere in this code.
 * If the user does not know the password, the file cannot be unlocked — the UI
 * must say so explicitly.
 *
 * Implementation reality (pure browser, no server):
 *   - Files WITHOUT an open password (e.g. permission-restricted PDFs that open
 *     freely) are repacked losslessly by pdf-lib — content stays fully intact.
 *   - Files WITH an open password must be opened with the password. pdf-lib
 *     cannot load password-encrypted documents, so we verify the password with
 *     pdf.js and rebuild the pages as high-quality images. The visual content
 *     is preserved; the text layer becomes part of the image.
 *
 * Pure function: bytes + password -> bytes. pdf.js is imported dynamically
 * inside the function body (SSR-safe, same pattern as toImage.ts).
 */
import { PDFDocument } from 'pdf-lib';
import type { PdfInput, PdfOutput } from './types';
import { stripExt } from './types';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/**
 * Remove password protection from `input` using `password` (may be empty for
 * files that open without a password).
 */
export async function unlockPdf(
  input: PdfInput,
  password: string,
): Promise<PdfOutput> {
  // Fast path: the file opens without a password (permission-restricted or
  // owner-password-only). Repacking removes the restrictions losslessly.
  try {
    const doc = await PDFDocument.load(input.bytes);
    const bytes = await doc.save();
    return { name: `${stripExt(input.name)}-unlocked.pdf`, bytes };
  } catch {
    // Fall through: the file requires an open password.
  }

  if (!password) {
    throw new Error('unlockPdf: this PDF requires a password');
  }

  // Verify the password with pdf.js (wrong password throws PasswordException)
  // and rebuild the pages as images so the unlocked file opens without a
  // password. Only reached with a user-supplied password — never brute-forced.
  const bytes = await rasterizeUnlocked(input, password);
  return { name: `${stripExt(input.name)}-unlocked.pdf`, bytes };
}

async function rasterizeUnlocked(input: PdfInput, password: string): Promise<Uint8Array> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const loadingTask = pdfjs.getDocument({ data: input.bytes.slice(), password });
  const src = await loadingTask.promise;

  const out = await PDFDocument.create();
  try {
    for (let i = 1; i <= src.numPages; i++) {
      const page = await src.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('unlockPdf: 2D canvas context unavailable');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      page.cleanup();

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
          'image/jpeg',
          0.92,
        );
      });
      const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const vp1 = page.getViewport({ scale: 1 });
      const w = vp1.width;
      const h = vp1.height;
      const outPage = out.addPage([w, h]);
      outPage.drawImage(jpg, { x: 0, y: 0, width: w, height: h });
    }
  } finally {
    await src.destroy();
  }

  return out.save();
}
