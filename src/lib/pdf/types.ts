/**
 * PDF engine — shared types & the operation enum.
 *
 * This module is intentionally framework-free: no React, no Astro, no DOM. The
 * four operations (merge / split / rotate / toImage) are pure functions that
 * take byte buffers and return byte buffers / blobs. The React island
 * (PdfDropZone) is the ONLY place that touches the DOM and orchestrates these.
 *
 * Keeping the operation union here means the tool page, the router and the
 * island all agree on the same four values without importing `astro:content`.
 */

/** The eight browser-side PDF operations, matching `toolType` in the schema. */
export type ToolType =
  | 'merge'
  | 'split'
  | 'rotate'
  | 'toImage'
  | 'compress'
  | 'protect'
  | 'unlock'
  | 'watermark';

/** One input document: original file name + raw bytes. */
export interface PdfInput {
  name: string;
  bytes: Uint8Array;
}

/** One resulting PDF document. */
export interface PdfOutput {
  name: string;
  bytes: Uint8Array;
}

/** One resulting raster image (from toImage). */
export interface PdfImageOutput {
  name: string;
  blob: Blob;
  mime: string;
}

/** Strip a known extension (e.g. ".pdf") so we can build derived file names. */
export function stripExt(name: string): string {
  return name.replace(/\.[^./\\]+$/, '');
}

/**
 * Build a Blob from raw PDF bytes.
 *
 * We copy into a freshly-allocated ArrayBuffer first. TS 5.7+ widened typed
 * arrays to `Uint8Array<ArrayBufferLike>`, so passing `bytes` straight to
 * `new Blob([bytes])` can fail the type-check (a `SharedArrayBuffer` view is
 * not a valid `BufferSource`). `new Uint8Array(n)` is always `ArrayBuffer`-
 * backed, which satisfies `Blob`'s `BlobPart` and is also a safe copy.
 */
export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type });
}
