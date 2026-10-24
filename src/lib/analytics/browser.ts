import type { PostHog, Properties } from 'posthog-js';
import {
  INTERACTION_EVENTS,
  captureLink,
  interactionProperties,
  listenForLinks,
  observeBannerImpression,
  type SiteAction,
} from './interactions';
import type { AnalyticsConfig } from './config';
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  CONSENT_VERSION,
  parseConsent,
  type ConsentPreference,
} from './consent';

const SDK_PERMISSION_COOKIE = 'glassyui_analytics_sdk_permission';

const SDK_STORAGE = 'ph_glassyui_analytics';

const OPTIONAL_STORAGE = [
  SDK_PERMISSION_COOKIE,
  SDK_STORAGE,
  `${SDK_STORAGE}_window_id`,
  `${SDK_STORAGE}_primary_window_exists`,
  `${SDK_STORAGE}_session_registered_properties`,
];

let sdk: PostHog | null = null;

let activeConfig: AnalyticsConfig | null = null;

let removeLinks: (() => void) | null = null;

let removeImpressions: (() => void) | null = null;

function captureInteraction(event: (typeof INTERACTION_EVENTS)[number], properties: Properties) {
  if (!sdk || !trackingAllowed(activeConfig)) return;
  sdk.capture(event, interactionProperties(properties, pagePath));
}

export function captureAction(action: SiteAction) {
  captureInteraction('site_action', action);
}

/** An asynchronous result belongs only to the permission window where its action began. */
export function actionOutcome(action: Pick<SiteAction, 'source' | 'action'>) {
  const instance = sdk;
  const actionGeneration = generation;
  const allowed = Boolean(instance && trackingAllowed(activeConfig));

  return (outcome: SiteAction['outcome']) => {
    if (!allowed || sdk !== instance || generation !== actionGeneration) return;
    captureAction({ ...action, outcome });
  };
}

export function captureSearchResult(href: string) {
  captureLink(href, 'search', captureInteraction, pagePath);
}

let generation = 0;

let starting = false;

let locallyRefused = false;

let lastPage: string | null = null;

const pending = new Set<AbortController>();

function productionHost() {
  return ['glassyui.com', 'pro.glassyui.com', 'www.glassyui.com'].includes(location.hostname);
}

export function readConsent() {
  const value = document.cookie.split('; ').find((entry) => entry.startsWith(`${CONSENT_COOKIE}=`));

  try {
    return parseConsent(value ? decodeURIComponent(value.slice(CONSENT_COOKIE.length + 1)) : null);
  } catch {
    return null;
  }
}

export function preferenceSignal() {
  return (
    navigator.globalPrivacyControl === true ||
    navigator.doNotTrack === '1' ||
    navigator.doNotTrack === 'yes'
  );
}

export function trackingAllowed(config: AnalyticsConfig | null) {
  if (locallyRefused || !config?.token || config.signal || preferenceSignal()) return false;

  if (productionHost() && location.protocol !== 'https:') return false;
  const preference = readConsent();

  return preference?.decision === 'accepted' || (preference === null && config.mode === 'opt-out');
}

export function writeConsent(decision: ConsentPreference['decision']) {
  // A refused/failed save must keep this document off even if an older accepted cookie remains.
  locallyRefused = true;
  const now = Date.now();

  const preference: ConsentPreference = {
    decision,
    version: CONSENT_VERSION,
    purpose: 'analytics',
    updatedAt: now,
    expiresAt: now + CONSENT_MAX_AGE_SECONDS * 1000,
  };

  if (productionHost() && location.protocol !== 'https:') return false;

  const secure = location.protocol === 'https:' ? '; Secure' : '';
  const domain = productionHost() ? '; Domain=glassyui.com' : '';

  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(preference))}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}${domain}`;

  const saved = readConsent()?.decision === decision && readConsent()?.updatedAt === now;

  if (saved && decision === 'accepted') locallyRefused = false;

  return saved;
}

function clearOptionalStorage() {
  for (const key of OPTIONAL_STORAGE) {
    // Storage can be blocked independently of cookies. Never touch appearance/docs settings.
    for (const store of ['localStorage', 'sessionStorage'] as const) {
      try {
        window[store].removeItem(key);
      } catch {
        console.warn('Glassy UI could not clear optional analytics storage.');
      }
    }

    for (const domain of ['', '; Domain=glassyui.com', '; Domain=pro.glassyui.com']) {
      document.cookie = `${key}=; Max-Age=0; Path=/; SameSite=Lax${domain}${location.protocol === 'https:' ? '; Secure' : ''}`;
    }
  }
}

export function stopAnalytics() {
  generation += 1;
  activeConfig = null;
  removeLinks?.();
  removeLinks = null;
  removeImpressions?.();
  removeImpressions = null;
  starting = false;
  lastPage = null;
  pending.forEach((controller) => controller.abort());
  pending.clear();
  const previous = sdk;

  sdk = null;

  if (previous) {
    previous.opt_out_capturing();
    // The pinned SDK shutdown omits these timer/listener owners.
    previous.pageViewManager.destroy();
    previous.sessionManager?.destroy();
    // before_send always returns null: SDK batches/retries contain no events to flush.
    void previous.shutdown();
  }

  clearOptionalStorage();
}

function pagePath(pathname: string) {
  const path = pathname.replace(/^\/pro(?=\/|$)/, '') || '/';

  const pages = [
    '/',
    '/components',
    '/docs',
    '/mobile',
    '/guides',
    '/blog',
    '/privacy',
    '/cookie-policy',
    '/imprint',
    '/license',
    '/refund-policy',
    '/thanks',
  ];

  if (pages.includes(path)) return path;

  // Dynamic path segments can contain private content. Send only the route family.
  for (const family of ['/components/', '/docs/', '/guides/', '/blog/']) {
    if (path.startsWith(family)) return `${family}[page]`;
  }

  return null;
}

function siteOrigin() {
  return location.hostname.startsWith('pro.') || location.pathname.startsWith('/pro')
    ? 'https://pro.glassyui.com'
    : 'https://glassyui.com';
}

function referrerKind() {
  if (!document.referrer) return 'direct';

  try {
    return ['glassyui.com', 'pro.glassyui.com', 'www.glassyui.com'].includes(
      new URL(document.referrer).hostname,
    )
      ? 'same_site'
      : 'external';
  } catch {
    return 'direct';
  }
}

// Parse the SDK event boundary into scalar properties approved for our transport.
/* oxlint-disable anti-slop/no-runtime-typeof -- SDK Properties are untyped; validate their scalar values at this delivery boundary. */
function webAnalyticsProperties(properties: Properties) {
  const result: Record<string, string | number | null> = {};

  for (const key of [
    '$session_id',
    '$window_id',
    '$pageview_id',
    '$prev_pageview_id',
    '$lib',
    '$lib_version',
    '$browser',
    '$browser_version',
    '$os',
    '$os_version',
    '$device_type',
    '$screen_width',
    '$screen_height',
    '$viewport_width',
    '$viewport_height',
    '$prev_pageview_duration',
    '$prev_pageview_last_scroll',
    '$prev_pageview_last_scroll_percentage',
    '$prev_pageview_max_scroll',
    '$prev_pageview_max_scroll_percentage',
    '$prev_pageview_last_content',
    '$prev_pageview_last_content_percentage',
    '$prev_pageview_max_content',
    '$prev_pageview_max_content_percentage',
    '$web_vitals_LCP_value',
    '$web_vitals_INP_value',
    '$web_vitals_CLS_value',
    '$web_vitals_FCP_value',
  ]) {
    const value = properties[key];

    if (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) {
      result[key] = value;
    }
  }

  if (typeof properties.$prev_pageview_pathname === 'string') {
    result.$prev_pageview_pathname = pagePath(properties.$prev_pageview_pathname);
  }

  return result;
}
/* oxlint-enable anti-slop/no-runtime-typeof */

export async function startAnalytics(config: AnalyticsConfig) {
  if (!trackingAllowed(config) || sdk || starting) return;
  starting = true;
  const currentGeneration = generation;

  try {
    const [{ PostHog }] = await Promise.all([
      import('posthog-js/no-external'),
      import('posthog-js/dist/web-vitals'),
    ]);

    if (currentGeneration !== generation || !trackingAllowed(config)) return;
    const instance = new PostHog();

    instance.init(config.token!, {
      api_host: config.host,
      persistence_name: 'glassyui_analytics',
      persistence: 'memory',
      disable_persistence: true,
      split_storage: false,
      cookie_expiration: 180,
      // This technical flag must be removable from either site. Identity stays in memory.
      cross_subdomain_cookie: productionHost(),
      secure_cookie: location.protocol === 'https:',
      consent_persistence_name: SDK_PERMISSION_COOKIE,
      opt_out_capturing_persistence_type: 'cookie',
      opt_out_capturing_by_default: true,
      opt_out_persistence_by_default: true,
      respect_dnt: true,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: true,
      capture_dead_clicks: false,
      rageclick: false,
      capture_heatmaps: false,
      capture_performance: { web_vitals: true, web_vitals_attribution: false },
      capture_exceptions: false,
      disable_session_recording: true,
      enable_recording_console_log: false,
      disable_surveys: true,
      disable_surveys_automatic_display: true,
      disable_product_tours: true,
      disable_conversations: true,
      disable_web_experiments: true,
      disable_external_dependency_loading: true,
      advanced_disable_flags: true,
      advanced_disable_feature_flags: true,
      person_profiles: 'never',
      save_campaign_params: false,
      save_referrer: false,
      disable_scroll_properties: false,
      disableDeviceModel: true,
      request_batching: false,
      disable_beacon: true,
      disable_compression: true,
      tracing_headers: [],
      logs: { captureConsoleLogs: false },
      debug: false,
      before_send: (event) => {
        if (
          !event ||
          currentGeneration !== generation ||
          !trackingAllowed(config) ||
          !['$pageview', '$pageleave', '$web_vitals', ...INTERACTION_EVENTS].includes(event.event)
        )
          return null;

        const eventUrl = new URL(event.properties.$current_url ?? location.href, location.origin);
        const path = pagePath(eventUrl.pathname);

        if (path === null) return null;
        const controller = new AbortController();
        const origin = siteOrigin();

        pending.add(controller);
        // SDK shutdown flushes retry queues even after opt-out. Own this one transport,
        // with no queue/retry/beacon, and return null BEFORE the SDK enqueues anything.
        void fetch(`${config.host}/i/v0/e`, {
          method: 'POST',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          keepalive: event.event !== '$pageview',
          body: JSON.stringify({
            api_key: config.token,
            event: event.event,
            distinct_id: event.properties.distinct_id,
            timestamp: new Date().toISOString(),
            properties: {
              ...webAnalyticsProperties(event.properties),
              ...interactionProperties(event.properties, pagePath),
              $lib_custom_api_host: `${location.origin}${config.host}`,
              $current_url: `${origin}${path}`,
              $pathname: path,
              $host: new URL(origin).host,
              referrer_kind: referrerKind(),
              analytics_basis:
                readConsent()?.decision === 'accepted' ? 'consent' : 'legitimate_interest',
              $process_person_profile: false,
              $geoip_disable: true,
              $ip: '0.0.0.0',
            },
          }),
        })
          .then((response) => {
            if (!response.ok) console.warn('Glassy UI analytics delivery failed.');
          })
          .catch(() => {
            if (!controller.signal.aborted) console.warn('Glassy UI analytics delivery failed.');
          })
          .finally(() => pending.delete(controller));

        return null;
      },
    });
    instance.opt_in_capturing({ captureEventName: false });
    sdk = instance;
    activeConfig = config;
    removeLinks = listenForLinks(captureInteraction, pagePath);
    // Navigation can finish while the SDK chunk loads. Remember the page actually captured.
    capturePage(config, location.pathname);
  } finally {
    if (currentGeneration === generation) starting = false;
  }
}

export function capturePage(config: AnalyticsConfig, pathname: string) {
  if (!sdk || !trackingAllowed(config) || lastPage === pathname) return;

  if (lastPage && pagePath(lastPage)) {
    sdk.capture('$pageleave', { $current_url: `${siteOrigin()}${pagePath(lastPage)}` });
  }

  removeImpressions?.();
  lastPage = pathname;
  sdk.capture('$pageview');
  removeImpressions =
    pathname === '/components' ? observeBannerImpression(captureInteraction) : null;
}
