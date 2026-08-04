/**
 * analytics.ts — privacy-first analytics (Phase 3.1.1).
 *
 * Design:
 *   - Default provider is `none`: NOTHING is loaded, zero script, zero impact
 *     on Core Web Vitals.
 *   - Enable via env `PUBLIC_ANALYTICS_PROVIDER` = `plausible` (| `umami` |
 *     `ga4` reserved). Script injection happens in src/components/analytics/
 *     Analytics.astro; this module only dispatches events.
 *   - No cookies, no personal data. Events carry aggregate params only
 *     (tool type, counts, sizes, durations) — never file names, contents or
 *     PDF metadata.
 *   - Event names are centralized in `EVENTS`. Legacy names (`tool_started`,
 *     `tool_completed`, `tool_failed`, `feedback`+vote) are kept as a
 *     compatibility alias layer so historical call sites never break data
 *     continuity; no new code should use them.
 *
 * SSR-safety: every public function guards on `typeof window`; the provider
 * is chosen at build time from `import.meta.env` (inlined by Astro).
 */

export type AnalyticsProviderName = 'none' | 'plausible' | 'umami' | 'ga4';

export interface TrackEventProps {
  [key: string]: string | number | boolean | undefined;
}

export type PageType = 'home' | 'tool' | 'blog' | 'legal' | 'other';

export interface PageViewInfo {
  locale: string;
  pathname: string;
  pageType: PageType;
}

export interface AnalyticsProvider {
  track(name: string, props?: TrackEventProps): void;
  pageView(info: PageViewInfo): void;
}

/* ------------------------------------------------------------------ */
/* Event constants — single source of truth (no scattered strings).    */
/* ------------------------------------------------------------------ */

export const EVENTS = {
  viewHome: 'view_home',
  clickToolCard: 'click_tool_card',
  clickCategory: 'click_category',
  clickClusterTool: 'click_cluster_tool',
  clickBlogToolCta: 'click_blog_tool_cta',
  clickToolBlogArticle: 'click_tool_blog_article',
  uploadStarted: 'upload_started',
  fileSelected: 'file_selected',
  processingStarted: 'processing_started',
  processingCompleted: 'processing_completed',
  downloadClicked: 'download_clicked',
  processAgainClicked: 'process_again_clicked',
  processingFailed: 'processing_failed',
  unsupportedFile: 'unsupported_file',
  feedbackPositive: 'feedback_positive',
  feedbackNegative: 'feedback_negative',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/**
 * Compatibility aliases: old event name → new event name. Old names remain a
 * valid entry point (mapped to the new event) but are NOT emitted directly
 * anymore. Kept so any data pipeline built on the old names keeps working.
 */
const EVENT_ALIASES: Record<string, EventName> = {
  tool_started: EVENTS.processingStarted,
  tool_completed: EVENTS.processingCompleted,
  tool_failed: EVENTS.processingFailed,
};

/* ------------------------------------------------------------------ */
/* Providers                                                           */
/* ------------------------------------------------------------------ */

const noopProvider: AnalyticsProvider = {
  track: () => undefined,
  pageView: () => undefined,
};

interface PlausibleWindow {
  plausible?: (event: string, opts?: { props?: TrackEventProps }) => void;
}
interface UmamiWindow {
  umami?: { track: (event: string, data?: TrackEventProps) => void };
}
interface GtagWindow {
  gtag?: (cmd: 'event' | 'config' | 'js', arg1: string, arg2?: TrackEventProps) => void;
}

function createPlausibleProvider(): AnalyticsProvider {
  return {
    track(name, props) {
      const w = window as unknown as PlausibleWindow;
      if (typeof w.plausible === 'function') {
        w.plausible(name, props ? { props } : undefined);
      }
    },
    // Plausible's script tracks page views automatically; nothing to do.
    pageView: () => undefined,
  };
}

/** Reserved: needs Analytics.astro to inject the Umami script first. */
function createUmamiProvider(): AnalyticsProvider {
  return {
    track(name, props) {
      const w = window as unknown as UmamiWindow;
      if (typeof w.umami?.track === 'function') w.umami.track(name, props);
    },
    pageView: () => undefined,
  };
}

/** Reserved: needs Analytics.astro to inject the gtag script first. */
function createGa4Provider(): AnalyticsProvider {
  return {
    track(name, props) {
      const w = window as unknown as GtagWindow;
      if (typeof w.gtag === 'function') w.gtag('event', name, props ?? {});
    },
    pageView: () => undefined,
  };
}

function resolveProviderName(): AnalyticsProviderName {
  const raw = import.meta.env.PUBLIC_ANALYTICS_PROVIDER as string | undefined;
  return raw === 'plausible' || raw === 'umami' || raw === 'ga4' ? raw : 'none';
}

let provider: AnalyticsProvider = (() => {
  switch (resolveProviderName()) {
    case 'plausible':
      return createPlausibleProvider();
    case 'umami':
      return createUmamiProvider();
    case 'ga4':
      return createGa4Provider();
    default:
      return noopProvider;
  }
})();

/** Swap the provider at runtime (e.g. tests / opt-in flows). */
export function setAnalyticsProvider(p: AnalyticsProvider): void {
  provider = p;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** Fire a named event with optional flat properties. SSR-safe no-op. */
export function trackEvent(name: string, props?: TrackEventProps): void {
  if (typeof window === 'undefined') return;

  // Legacy `feedback` + { vote } compatibility → typed feedback events.
  if (name === 'feedback' && props && 'vote' in props) {
    const { vote, ...rest } = props;
    provider.track(vote === 'no' ? EVENTS.feedbackNegative : EVENTS.feedbackPositive, rest);
    return;
  }

  provider.track(EVENT_ALIASES[name] ?? name, props);
}

/** Page-view with context. Static pages: Plausible auto-tracks; this enriches. */
export function trackPageView(info: PageViewInfo): void {
  if (typeof window === 'undefined') return;
  provider.pageView(info);
}

/**
 * Legacy helper — kept as a compatibility entry point. Maps old actions to
 * the new event names. Do NOT add new call sites; use `trackEvent(EVENTS.x)`.
 */
export function trackToolEvent(
  action: 'started' | 'completed' | 'failed' | 'feedback',
  tool: string,
  extra?: TrackEventProps,
): void {
  const name =
    action === 'started'
      ? EVENTS.processingStarted
      : action === 'completed'
        ? EVENTS.processingCompleted
        : action === 'failed'
          ? EVENTS.processingFailed
          : EVENTS.feedbackPositive;
  trackEvent(name, { tool, ...extra });
}
