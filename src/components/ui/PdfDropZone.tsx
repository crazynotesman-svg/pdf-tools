/**
 * PdfDropZone — the ONLY browser-side component that touches the DOM for the
 * PDF feature.
 *
 * Design boundary (T9):
 *   - This island contains NO PDF algorithm. It only orchestrates: read the
 *     selected File(s) into byte buffers, hand them to the pure functions in
 *     `@/lib/pdf`, then offer the result(s) as download links.
 *   - All PDF logic lives in `src/lib/pdf/*` (merge / split / rotate / toImage).
 *   - All visible copy comes from the type-safe `t()` translator, so there is
 *     zero hard-coded UI text and the three locales stay in sync.
 *
 * The parent Astro page passes `operation` (which tool) + `locale`; it does
 * not import or run any PDF code itself.
 */
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { t } from '@/i18n/ui';
import type { Locale } from '@/i18n/config';
import type { ToolType, PdfInput } from '@/lib/pdf';
import { mergePdfs, splitPdf, rotatePdf, pdfToImages, stripExt, bytesToBlob } from '@/lib/pdf';

interface Props {
  /** Which operation to run — driven by the tool's `toolType`. */
  operation: ToolType;
  /** Active locale, for zero-hardcoded UI text. */
  locale: Locale;
}

type Status = 'idle' | 'processing' | 'done' | 'error';

interface DownloadItem {
  name: string;
  url: string;
}

const PDF_MIME = 'application/pdf';

// Inline upload glyph (no external icon font).
const UploadIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-10 w-10"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M17 8l-5-5-5 5" />
    <path d="M12 3v12" />
  </svg>
);

export default function PdfDropZone({ operation, locale }: Props) {
  const tl = (k: Parameters<typeof t>[1]) => t(locale, k);

  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [results, setResults] = useState<DownloadItem[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [degrees, setDegrees] = useState<90 | 180 | 270>(90);
  const [format, setFormat] = useState<'image/jpeg' | 'image/png'>('image/jpeg');

  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<string[]>([]);

  const multiple = operation === 'merge';
  const hint = t(locale, (`pdfUi.${operation}Hint`) as Parameters<typeof t>[1]);

  // Revoke any created object URLs when the island unmounts.
  useEffect(
    () => () => {
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  function revokePrevious(): void {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
  }

  function addFiles(picked: File[]): void {
    if (picked.length === 0) return;
    setFiles((prev) => (multiple ? [...prev, ...picked] : picked));
    setStatus('idle');
    setErrorMsg('');
  }

  function onFiles(e: ChangeEvent<HTMLInputElement>): void {
    addFiles(e.target.files ? Array.from(e.target.files) : []);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>): void {
    e.preventDefault();
    addFiles(e.dataTransfer.files ? Array.from(e.dataTransfer.files) : []);
  }

  async function process(): Promise<void> {
    if (files.length === 0) {
      setErrorMsg(tl('pdfUi.noFile'));
      setStatus('error');
      return;
    }

    revokePrevious();
    setStatus('processing');
    setErrorMsg('');

    try {
      const inputs: PdfInput[] = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          bytes: new Uint8Array(await f.arrayBuffer()),
        })),
      );

      const items: DownloadItem[] = [];

      if (operation === 'merge') {
        const bytes = await mergePdfs(inputs);
        const url = URL.createObjectURL(bytesToBlob(bytes, PDF_MIME));
        items.push({ name: `${stripExt(inputs[0].name)}-merged.pdf`, url });
      } else if (operation === 'split') {
        const outs = await splitPdf(inputs[0]);
        for (const o of outs) {
          const url = URL.createObjectURL(bytesToBlob(o.bytes, PDF_MIME));
          items.push({ name: o.name, url });
        }
      } else if (operation === 'rotate') {
        const bytes = await rotatePdf(inputs[0], degrees);
        const url = URL.createObjectURL(bytesToBlob(bytes, PDF_MIME));
        items.push({ name: `${stripExt(inputs[0].name)}-rotated.pdf`, url });
      } else {
        const imgs = await pdfToImages(inputs[0], { format, quality: 0.92 });
        for (const img of imgs) {
          const url = URL.createObjectURL(img.blob);
          items.push({ name: img.name, url });
        }
      }

      urlsRef.current = items.map((i) => i.url);
      setResults(items);
      setStatus('done');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[PdfDropZone] processing failed:', err);
      setErrorMsg(tl('pdfUi.errorGeneric'));
      setStatus('error');
    }
  }

  function clearAll(): void {
    revokePrevious();
    setFiles([]);
    setResults([]);
    setStatus('idle');
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-on-surface">{tl('pdfUi.title')}</h2>
      <p className="mt-1 text-sm text-on-surface-variant">{hint}</p>

      <label
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className="group relative mt-4 flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-neon-blue/50 bg-gradient-to-br from-neon-blue/5 to-electric-purple/5 px-6 py-12 text-center transition-transform duration-300 hover:scale-[1.01] hover:border-neon-blue"
      >
        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-neon-blue to-electric-purple text-white">
            {UploadIcon}
          </div>
          <span className="text-base font-medium text-on-surface">{tl('pdfUi.drop')}</span>
          <span className="mt-3 inline-flex items-center rounded-lg bg-neon-blue px-4 py-2 text-sm font-semibold text-white transition-colors">
            {tl('pdfUi.selectFiles')}
          </span>
          <span className="mt-3 text-xs text-on-surface-variant">PDF · Max 50MB</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple={multiple}
          onChange={onFiles}
          className="hidden"
        />
      </label>

      {files.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-on-surface-variant">
          <li className="font-medium text-on-surface">{tl('pdfUi.selected')}:</li>
          {files.map((f, i) => (
            <li key={i} className="truncate">
              {f.name}
            </li>
          ))}
        </ul>
      )}

      {operation === 'rotate' && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <span className="font-medium text-on-surface-variant">{tl('pdfUi.rotateLabel')}:</span>
          <select
            value={degrees}
            onChange={(e) => setDegrees(Number(e.target.value) as 90 | 180 | 270)}
            className="rounded-sm border border-border-subtle bg-surface-container-high px-2 py-1 text-on-surface"
          >
            <option value={90}>90°</option>
            <option value={180}>180°</option>
            <option value={270}>270°</option>
          </select>
        </div>
      )}

      {operation === 'toImage' && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <span className="font-medium text-on-surface-variant">{tl('pdfUi.formatLabel')}:</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as 'image/jpeg' | 'image/png')}
            className="rounded-sm border border-border-subtle bg-surface-container-high px-2 py-1 text-on-surface"
          >
            <option value="image/jpeg">JPG</option>
            <option value="image/png">PNG</option>
          </select>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={process}
          disabled={status === 'processing'}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'processing' ? tl('pdfUi.processing') : tl('pdfUi.process')}
        </button>
        {(files.length > 0 || results.length > 0) && (
          <button type="button" onClick={clearAll} className="btn-secondary">
            {tl('pdfUi.clear')}
          </button>
        )}
      </div>

      {status === 'error' && <p className="mt-3 text-sm text-red-600">{errorMsg}</p>}

      {results.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-on-surface">{tl('pdfUi.download')}:</p>
          <ul className="space-y-2">
            {results.map((r, i) => (
              <li key={i}>
                <a
                  href={r.url}
                  download={r.name}
                  className="glass-card inline-flex items-center rounded-lg border border-border-subtle bg-white px-4 py-2 text-sm font-medium text-neon-blue transition-colors hover:text-electric-purple"
                >
                  {r.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
