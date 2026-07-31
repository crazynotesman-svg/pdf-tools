/**
 * Public surface of the PDF engine.
 *
 * Import from `@/lib/pdf` everywhere (island, tests, future API). The four
 * operations are pure functions; nothing here imports React or touches the
 * DOM at module scope.
 */
export type {
  ToolType,
  PdfInput,
  PdfOutput,
  PdfImageOutput,
} from './types';
export { stripExt, bytesToBlob } from './types';

export { mergePdfs, mergePdfsToOutput } from './merge';
export { splitPdf, type SplitMode } from './split';
export { rotatePdf, rotatePdfToOutput, type RotationStep } from './rotate';
export { pdfToImages, type ToImageOptions } from './toImage';
