/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// Vite asset-URL imports (e.g. `import workerUrl from 'pdfjs-dist/...?url'`).
// Declared here so `astro check` (tsc) accepts the `?url` suffix. astro/client
// may also declare this; redeclaring a compatible module is harmless.
declare module '*?url' {
  const src: string;
  export default src;
}

// browser-image-compression ships minimal/no types in some versions; declare a
// narrow, sufficient signature so the client island type-checks.
declare module 'browser-image-compression' {
  interface ImageCompressionOptions {
    fileType?: string;
    initialQuality?: number;
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
    [key: string]: unknown;
  }
  function imageCompression(
    file: Blob,
    options?: ImageCompressionOptions,
  ): Promise<File>;
  export default imageCompression;
}
