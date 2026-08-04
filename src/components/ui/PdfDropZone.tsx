/**
 * PdfDropZone — the ONLY browser-side component that touches the DOM for the
 * PDF feature.
 *
 * Design boundary:
 *   - No PDF algorithm here. It orchestrates: read File(s) → call pure
 *     functions in `@/lib/pdf` → offer downloads.
 *   - Operations dispatch through the `buildOperations` configuration map
 *     (operation → { multiple, accept, hintKey, process, renderOptions }).
 *     There is NO if/else chain on `operation`.
 *   - All visible copy comes from the type-safe `t()` translator.
 *   - Analytics go through `@/lib/analytics` (noop today).
 *
 * Phase 2.2.2 state machine: idle → uploading (reading files) → processing
 * (engine) → completed | error. The drop panel shows a pure-CSS spinner during
 * work and a success panel with a primary download button when done.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { t, type TranslationKey } from '@/i18n/ui';
import type { Locale } from '@/i18n/config';
import type { ToolType, PdfInput } from '@/lib/pdf';
import { trackEvent, EVENTS } from '@/lib/analytics';
import {
  mergePdfs,
  splitPdf,
  rotatePdf,
  pdfToImages,
  compressPdf,
  protectPdf,
  unlockPdf,
  watermarkPdf,
  stripExt,
  bytesToBlob,
} from '@/lib/pdf';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

interface Props {
  /** Which operation to run — driven by the tool's `toolType`. */
  operation: ToolType;
  /** Active locale, for zero-hardcoded UI text. */
  locale: Locale;
}

type Status = 'idle' | 'uploading' | 'processing' | 'done' | 'error';
type Translator = (key: TranslationKey) => string;

interface OutputItem {
  name: string;
  url: string;
}

/** Runtime option values shared by the per-tool panels. */
interface OpState {
  degrees: 90 | 180 | 270;
  format: 'image/jpeg' | 'image/png';
  compressMode: 'standard' | 'strong';
  quality: number;
  password: string;
  watermarkText: string;
  opacity: number;
}

const INITIAL_OP: OpState = {
  degrees: 90,
  format: 'image/jpeg',
  compressMode: 'standard',
  quality: 70,
  password: '',
  watermarkText: '',
  opacity: 15,
};

/** One entry per toolType — the ONLY place that knows about individual tools. */
interface OperationConfig {
  multiple: boolean;
  accept: string;
  hintKey: TranslationKey;
  process: (inputs: PdfInput[], opts: OpState) => Promise<OutputItem[]>;
  renderOptions?: (opts: OpState, update: (patch: Partial<OpState>) => void) => ReactNode;
}

const PDF_MIME = 'application/pdf';
const pdfAccept = 'application/pdf';
const selectCls =
  'rounded-lg border border-border-subtle bg-surface-container-high px-2 py-1.5 text-sm text-on-surface';
const inputCls =
  'w-full rounded-lg border border-border-subtle bg-surface-container-high px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:border-neon-blue focus:outline-none';
const labelCls = 'text-sm font-medium text-on-surface-variant';

function toItems(out: { name: string; bytes: Uint8Array }[]): OutputItem[] {
  return out.map((o) => ({ name: o.name, url: URL.createObjectURL(bytesToBlob(o.bytes, PDF_MIME)) }));
}

/** Human-readable file size (KB/MB). */
function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Builds the operation table for the active locale. */
function buildOperations(tl: Translator): Record<ToolType, OperationConfig> {
  return {
    merge: {
      multiple: true,
      accept: pdfAccept,
      hintKey: 'pdfUi.mergeHint',
      process: async (inputs) => {
        const bytes = await mergePdfs(inputs);
        const url = URL.createObjectURL(bytesToBlob(bytes, PDF_MIME));
        return [{ name: `${stripExt(inputs[0].name)}-merged.pdf`, url }];
      },
    },
    split: {
      multiple: false,
      accept: pdfAccept,
      hintKey: 'pdfUi.splitHint',
      process: async (inputs) => toItems(await splitPdf(inputs[0])),
    },
    rotate: {
      multiple: false,
      accept: pdfAccept,
      hintKey: 'pdfUi.rotateHint',
      process: async (inputs, opts) => {
        const out = await rotatePdf(inputs[0], opts.degrees);
        const url = URL.createObjectURL(bytesToBlob(out, PDF_MIME));
        return [{ name: `${stripExt(inputs[0].name)}-rotated.pdf`, url }];
      },
      renderOptions: (opts, update) => (
        <div className="flex items-center gap-3 text-sm">
          <span className={labelCls}>{tl('pdfUi.rotateLabel')}:</span>
          <select
            value={opts.degrees}
            onChange={(e) => update({ degrees: Number(e.target.value) as 90 | 180 | 270 })}
            className={selectCls}
          >
            <option value={90}>90°</option>
            <option value={180}>180°</option>
            <option value={270}>270°</option>
          </select>
        </div>
      ),
    },
    toImage: {
      multiple: false,
      accept: pdfAccept,
      hintKey: 'pdfUi.toImageHint',
      process: async (inputs, opts) => {
        const imgs = await pdfToImages(inputs[0], { format: opts.format, quality: 0.92 });
        return imgs.map((img) => ({ name: img.name, url: URL.createObjectURL(img.blob) }));
      },
      renderOptions: (opts, update) => (
        <div className="flex items-center gap-3 text-sm">
          <span className={labelCls}>{tl('pdfUi.formatLabel')}:</span>
          <select
            value={opts.format}
            onChange={(e) => update({ format: e.target.value as 'image/jpeg' | 'image/png' })}
            className={selectCls}
          >
            <option value="image/jpeg">JPG</option>
            <option value="image/png">PNG</option>
          </select>
        </div>
      ),
    },
    compress: {
      multiple: false,
      accept: pdfAccept,
      hintKey: 'pdfUi.compressHint',
      process: async (inputs, opts) => {
        const out = await compressPdf(inputs[0], {
          mode: opts.compressMode,
          quality: opts.quality / 100,
        });
        return toItems([out]);
      },
      renderOptions: (opts, update) => (
        <div className="space-y-3 text-sm">
          <div className="space-y-2">
            <span className={labelCls}>{tl('pdfUi.compressModeLabel')}:</span>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border-subtle p-3">
              <input
                type="radio"
                name="compressMode"
                checked={opts.compressMode === 'standard'}
                onChange={() => update({ compressMode: 'standard' })}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-on-surface">{tl('pdfUi.compressStandard')}</span>
                <span className="block text-xs text-on-surface-variant">
                  {tl('pdfUi.compressStandardDesc')}
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border-subtle p-3">
              <input
                type="radio"
                name="compressMode"
                checked={opts.compressMode === 'strong'}
                onChange={() => update({ compressMode: 'strong' })}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-on-surface">{tl('pdfUi.compressStrong')}</span>
                <span className="block text-xs text-on-surface-variant">
                  {tl('pdfUi.compressStrongDesc')}
                </span>
              </span>
            </label>
          </div>
          {opts.compressMode === 'strong' && (
            <label className="flex items-center gap-3">
              <span className={labelCls}>{tl('pdfUi.qualityLabel')}: {opts.quality}%</span>
              <input
                type="range"
                min={20}
                max={95}
                step={5}
                value={opts.quality}
                onChange={(e) => update({ quality: Number(e.target.value) })}
                className="flex-1 accent-neon-blue"
              />
            </label>
          )}
        </div>
      ),
    },
    protect: {
      multiple: false,
      accept: pdfAccept,
      hintKey: 'pdfUi.protectHint',
      process: async (inputs, opts) => {
        const out = await protectPdf(inputs[0], { userPassword: opts.password });
        return toItems([out]);
      },
      renderOptions: (opts, update) => (
        <label className="block space-y-1.5">
          <span className={labelCls}>{tl('pdfUi.passwordLabel')}</span>
          <input
            type="password"
            value={opts.password}
            onChange={(e) => update({ password: e.target.value })}
            placeholder={tl('pdfUi.passwordPlaceholder')}
            className={inputCls}
          />
        </label>
      ),
    },
    unlock: {
      multiple: false,
      accept: pdfAccept,
      hintKey: 'pdfUi.unlockHint',
      process: async (inputs, opts) => {
        const out = await unlockPdf(inputs[0], opts.password);
        return toItems([out]);
      },
      renderOptions: (opts, update) => (
        <label className="block space-y-1.5">
          <span className={labelCls}>{tl('pdfUi.unlockPasswordLabel')}</span>
          <input
            type="password"
            value={opts.password}
            onChange={(e) => update({ password: e.target.value })}
            placeholder={tl('pdfUi.passwordPlaceholder')}
            className={inputCls}
          />
        </label>
      ),
    },
    watermark: {
      multiple: false,
      accept: pdfAccept,
      hintKey: 'pdfUi.watermarkHint',
      process: async (inputs, opts) => {
        const out = await watermarkPdf(inputs[0], {
          text: opts.watermarkText,
          opacity: opts.opacity / 100,
        });
        return toItems([out]);
      },
      renderOptions: (opts, update) => (
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className={labelCls}>{tl('pdfUi.watermarkTextLabel')}</span>
            <input
              type="text"
              value={opts.watermarkText}
              onChange={(e) => update({ watermarkText: e.target.value })}
              placeholder={tl('pdfUi.watermarkPlaceholder')}
              className={inputCls}
            />
          </label>
          <label className="flex items-center gap-3">
            <span className={labelCls}>{tl('pdfUi.opacityLabel')}: {opts.opacity}%</span>
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={opts.opacity}
              onChange={(e) => update({ opacity: Number(e.target.value) })}
              className="flex-1 accent-neon-blue"
            />
          </label>
        </div>
      ),
    },
  };
}

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

/** Pure-CSS spinner (Tailwind animate-spin, no JS, no asset). */
const Spinner = (
  <span
    className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-neon-blue/30 border-t-neon-blue"
    role="status"
    aria-label="processing"
  />
);

export default function PdfDropZone({ operation, locale }: Props) {
  const tl: Translator = (key) => t(locale, key);

  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [results, setResults] = useState<OutputItem[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [opts, setOpts] = useState<OpState>(INITIAL_OP);
  const [feedback, setFeedback] = useState<'yes' | 'no' | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pageCounts, setPageCounts] = useState<Record<number, number>>({});

  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<string[]>([]);
  const filesRef = useRef<File[]>([]);

  const config = buildOperations(tl)[operation];
  const multiple = config.multiple;
  const hint = tl(config.hintKey);

  function updateOpts(patch: Partial<OpState>): void {
    setOpts((prev) => ({ ...prev, ...patch }));
  }

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
    const next = multiple ? [...filesRef.current, ...picked] : picked;
    filesRef.current = next;
    setFiles(next);
    setStatus('idle');
    setErrorMsg('');
    setFeedback(null);
    setDragging(false);
    // Privacy-first events: aggregate params only (no file names/content).
    trackEvent(EVENTS.uploadStarted, { locale, tool: operation, files: next.length });
    trackEvent(EVENTS.fileSelected, {
      locale,
      tool: operation,
      files: next.length,
      size_bytes: next.reduce((s, f) => s + f.size, 0),
    });
    // Best-effort page counts for the newly selected files (Phase 2.3.4).
    void readPageCounts(picked, multiple ? next.length - picked.length : 0);
  }

  /** Read page counts for newly selected files; failures are silently ignored. */
  async function readPageCounts(list: File[], offset: number): Promise<void> {
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      const counts: Record<number, number> = {};
      for (const [k, f] of list.entries()) {
        try {
          const buf = new Uint8Array(await f.arrayBuffer());
          const pdf = await pdfjs.getDocument({ data: buf }).promise;
          counts[k + offset] = pdf.numPages;
          await pdf.destroy();
        } catch {
          /* non-PDF or unreadable — page info omitted */
        }
      }
      setPageCounts((prev) => ({ ...prev, ...counts }));
    } catch {
      /* pdfjs unavailable — skip page info */
    }
  }

  function onFiles(e: ChangeEvent<HTMLInputElement>): void {
    addFiles(e.target.files ? Array.from(e.target.files) : []);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>): void {
    e.preventDefault();
    addFiles(e.dataTransfer.files ? Array.from(e.dataTransfer.files) : []);
  }

  const busy = status === 'uploading' || status === 'processing';

  async function process(): Promise<void> {
    if (files.length === 0) {
      setErrorMsg(tl('pdfUi.noFile'));
      setStatus('error');
      return;
    }

    revokePrevious();
    setStatus('uploading');
    setErrorMsg('');
    const startTime = performance.now();
    trackEvent(EVENTS.processingStarted, { locale, tool: operation, files: files.length });

    try {
      const inputs: PdfInput[] = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          bytes: new Uint8Array(await f.arrayBuffer()),
        })),
      );

      setStatus('processing');
      const items = await config.process(inputs, opts);

      urlsRef.current = items.map((i) => i.url);
      setResults(items);
      setStatus('done');
      trackEvent(EVENTS.processingCompleted, {
        locale,
        tool: operation,
        files: files.length,
        results: items.length,
        duration_ms: Math.round(performance.now() - startTime),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[PdfDropZone] processing failed:', err);
      trackEvent(EVENTS.processingFailed, {
        locale,
        tool: operation,
        duration_ms: Math.round(performance.now() - startTime),
      });
      const msg =
        err instanceof Error && err.message.includes('incorrect password')
          ? tl('pdfUi.wrongPassword')
          : tl('pdfUi.errorGeneric');
      setErrorMsg(msg);
      setStatus('error');
    }
  }

  function clearAll(): void {
    revokePrevious();
    filesRef.current = [];
    setPageCounts({});
    setFiles([]);
    setResults([]);
    setStatus('idle');
    setErrorMsg('');
    setFeedback(null);
    setOpts(INITIAL_OP);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-on-surface">{tl('pdfUi.title')}</h2>
        <p className="text-sm text-on-surface-variant">{hint}</p>
      </div>

      {/* ===== Drop / working / success panel ===== */}
      {status === 'done' ? (
        <div className="mt-5 flex flex-col items-center rounded-2xl border border-emerald-200 bg-emerald-50/70 px-6 py-12 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <p className="mt-4 font-medium text-on-surface">{tl('pdfUi.completed')}</p>
          {results.length === 1 && (
            <a
              href={results[0].url}
              download={results[0].name}
              onClick={() => trackEvent(EVENTS.downloadClicked, { locale, tool: operation })}
              className="btn-primary mt-6 px-8 py-3 text-base"
            >
              {tl('pdfUi.download')} · {results[0].name}
            </a>
          )}
          {results.length > 1 && (
            <>
              <a
                href={results[0].url}
                download={results[0].name}
                onClick={() => trackEvent(EVENTS.downloadClicked, { locale, tool: operation })}
                className="btn-primary mt-6 px-8 py-3 text-base"
              >
                {tl('pdfUi.download')} · {results.length} {tl('pdfUi.files')}
              </a>
              <ul className="mt-4 flex max-w-md flex-wrap justify-center gap-2">
                {results.map((r, i) => (
                  <li key={i}>
                    <a
                      href={r.url}
                      download={r.name}
                      onClick={() => trackEvent(EVENTS.downloadClicked, { locale, tool: operation })}
                      className="text-sm text-neon-blue underline underline-offset-2 hover:text-electric-purple"
                    >
                      {r.name}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          {/* Process another file (Phase 2.3.5) — resets to a fresh upload. */}
          <button
            type="button"
            onClick={() => {
              trackEvent(EVENTS.processAgainClicked, { locale, tool: operation });
              clearAll();
            }}
            className="btn-secondary mt-5"
          >
            {tl('pdfUi.processAnother')}
          </button>
        </div>
      ) : (
        <label
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          className={`group relative mt-5 flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all duration-300 ${
            busy
              ? 'border-neon-blue/40 bg-gradient-to-br from-neon-blue/5 to-electric-purple/5'
              : dragging
                ? 'scale-[1.01] border-neon-blue bg-gradient-to-br from-neon-blue/10 to-electric-purple/10'
                : 'border-neon-blue/50 bg-gradient-to-br from-neon-blue/5 to-electric-purple/5 hover:scale-[1.01] hover:border-neon-blue'
          }`}
        >
          <div className="relative z-10 flex flex-col items-center">
            {busy ? (
              <>
                {Spinner}
                <span className="mt-4 text-base font-medium text-on-surface">
                  {status === 'uploading' ? tl('pdfUi.uploading') : tl('pdfUi.processing')}
                </span>
              </>
            ) : (
              <>
                <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-neon-blue to-electric-purple text-white">
                  {UploadIcon}
                </div>
                <span className="text-base font-medium text-on-surface">
                  {dragging ? tl('pdfUi.dropActive') : tl('pdfUi.drop')}
                </span>
                <span className="mt-3 inline-flex items-center rounded-lg bg-gradient-to-br from-neon-blue to-electric-purple px-5 py-2.5 text-sm font-semibold text-white shadow-sm">
                  {tl('pdfUi.selectFiles')}
                </span>
                <span className="mt-3 text-xs text-on-surface-variant">{tl('pdfUi.formatHint')}</span>
              </>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={config.accept}
            multiple={multiple}
            onChange={onFiles}
            className="hidden"
          />
        </label>
      )}

      {files.length > 0 && status !== 'done' && (
        <ul className="mt-4 space-y-1 text-sm text-on-surface-variant">
          <li className="font-medium text-on-surface">
            {tl('pdfUi.selected')} ({files.length}):
          </li>
          {files.map((f, i) => (
            <li key={i} className="truncate">
              <span className="font-medium text-on-surface">{f.name}</span>
              <span className="text-xs text-on-surface-variant/80">
                {' · '}
                {formatSize(f.size)}
                {pageCounts[i] ? ` · ${pageCounts[i]} ${tl('pdfUi.pages')}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      {config.renderOptions && !busy && status !== 'done' && (
        <div className="mt-4 space-y-3">{config.renderOptions(opts, updateOpts)}</div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={process}
          disabled={busy}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? tl('pdfUi.processing') : tl('pdfUi.process')}
        </button>
        {(files.length > 0 || results.length > 0) && !busy && (
          <button type="button" onClick={clearAll} className="btn-secondary">
            {tl('pdfUi.clear')}
          </button>
        )}
      </div>

      {status === 'error' && <p className="mt-3 text-sm text-red-600">{errorMsg}</p>}

      {status === 'done' && results.length > 0 && !feedback && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-border-subtle bg-white/60 px-4 py-3">
          <span className="text-sm text-on-surface-variant">{tl('pdfUi.feedbackTitle')}</span>
          <button
            type="button"
            onClick={() => {
              setFeedback('yes');
              trackEvent(EVENTS.feedbackPositive, { locale, tool: operation });
            }}
            aria-label={tl('pdfUi.feedbackYes')}
            className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-3 py-1.5 text-sm font-medium text-on-surface transition-colors hover:border-neon-blue hover:text-neon-blue"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M7 10v12" />
              <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
            </svg>
            {tl('pdfUi.feedbackYes')}
          </button>
          <button
            type="button"
            onClick={() => {
              setFeedback('no');
              trackEvent(EVENTS.feedbackNegative, { locale, tool: operation });
            }}
            aria-label={tl('pdfUi.feedbackNo')}
            className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-3 py-1.5 text-sm font-medium text-on-surface transition-colors hover:border-neon-blue hover:text-neon-blue"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M17 14V2" />
              <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
            </svg>
            {tl('pdfUi.feedbackNo')}
          </button>
        </div>
      )}
      {status === 'done' && feedback && (
        <p className="mt-5 text-sm font-medium text-neon-blue">{tl('pdfUi.feedbackThanks')}</p>
      )}
    </div>
  );
}
