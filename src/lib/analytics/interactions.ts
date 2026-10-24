import type { Properties } from 'posthog-js';

/** Fixed categories only: never pass labels, input values or arbitrary URLs to capture. */
export const INTERACTION_EVENTS = [
  'pro_banner_click',
  'pro_banner_impression',
  'pro_link_click',
  'pro_checkout_click',
  'site_link_click',
  'site_action',
] as const;

const SOURCES = [
  'banner',
  'template',
  'announcement',
  'navigation',
  'footer',
  'sidebar',
  'search',
  'content',
  'hero',
  'docs',
] as const;

const ACTIONS = [
  'install_copy',
  'source_copy',
  'platform',
  'theme',
  'search_open',
  'signup',
] as const;

const OUTCOMES = ['requested', 'accepted', 'failed', 'succeeded', 'selected', 'opened'] as const;

const CHOICES = ['react', 'react-native', 'light', 'dark'] as const;

type Source = (typeof SOURCES)[number];

type InteractionEvent = (typeof INTERACTION_EVENTS)[number];

type Capture = (event: InteractionEvent, properties: Properties) => void;

type PagePath = (pathname: string) => string | null;

export type SiteAction = {
  source: Source;
  action: (typeof ACTIONS)[number];
  outcome: (typeof OUTCOMES)[number];
  choice?: (typeof CHOICES)[number];
};

function linkDestination(href: string, pagePath: PagePath) {
  const url = new URL(href, location.href);

  if (!['https:', 'http:'].includes(url.protocol)) return null;

  if (url.hostname === 'pro.glassyui.com') return 'pro';

  if (['glassyui.com', 'www.glassyui.com', location.hostname].includes(url.hostname)) {
    if (url.pathname.startsWith('/r/')) return 'registry';

    return pagePath(url.pathname);
  }

  if (url.hostname === 'github.com') return 'github';

  return 'external';
}

export function interactionProperties(properties: Properties, pagePath: PagePath) {
  const result: Record<string, string> = {};

  for (const [key, allowed] of Object.entries({
    source: SOURCES,
    action: ACTIONS,
    outcome: OUTCOMES,
    choice: CHOICES,
  })) {
    const value = properties[key];

    if (allowed.some((entry) => entry === value)) result[key] = String(value);
  }

  const destination = properties.destination;

  if (
    ['pro', 'checkout', 'registry', 'github', 'external'].some((entry) => entry === destination)
  ) {
    result.destination = String(destination);
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Validate untyped SDK properties at the transport boundary.
  } else if (typeof destination === 'string' && pagePath(destination) === destination) {
    result.destination = destination;
  }

  return result;
}

export function captureLink(href: string, source: Source, capture: Capture, pagePath: PagePath) {
  const destination = linkDestination(href, pagePath);

  if (!destination) return;
  capture(
    destination === 'pro'
      ? source === 'banner'
        ? 'pro_banner_click'
        : 'pro_link_click'
      : 'site_link_click',
    {
      source,
      destination,
    },
  );
}

export function listenForLinks(capture: Capture, pagePath: PagePath) {
  const controller = new AbortController();

  const click = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      (event.type === 'click' ? event.button !== 0 : event.button !== 1)
    )
      return;
    const target = event.target instanceof Element ? event.target : null;
    const anchor = target?.closest('a[href]');

    if (!(anchor instanceof HTMLAnchorElement)) return;

    // Component demonstrations can contain visitor content and are not site navigation.
    if (anchor.closest('.docs-demo, .component-demo, [data-analytics-ignore]')) return;
    const marker = anchor.closest('[data-analytics-source]')?.getAttribute('data-analytics-source');

    const source =
      SOURCES.find((entry) => entry === marker) ??
      (anchor.closest('header') ? 'navigation' : anchor.closest('footer') ? 'footer' : 'content');

    if (anchor.hasAttribute('data-analytics-checkout')) {
      capture('pro_checkout_click', { source, destination: 'checkout' });
    } else {
      captureLink(anchor.href, source, capture, pagePath);
    }
  };

  document.addEventListener('click', click, { capture: true, signal: controller.signal });
  document.addEventListener('auxclick', click, { capture: true, signal: controller.signal });

  return () => controller.abort();
}

/** One viewable gallery promotion per pageview, under the caller's permission lifecycle. */
export function observeBannerImpression(capture: Capture) {
  let banner: Element | null = null;
  let disposed = false;
  let recorded = false;

  const observer = new IntersectionObserver(
    (entries) => {
      if (disposed || recorded || document.visibilityState !== 'visible') return;

      if (
        !entries.some(
          (entry) =>
            entry.target === banner &&
            entry.target.isConnected &&
            entry.isIntersecting &&
            entry.intersectionRatio >= 0.5,
        )
      )
        return;
      recorded = true;
      capture('pro_banner_impression', { source: 'banner', destination: 'pro' });
      observer.disconnect();
      mutations.disconnect();
      document.removeEventListener('visibilitychange', visibility);
    },
    { threshold: 0.5 },
  );

  const watch = () => {
    if (disposed || recorded || document.visibilityState !== 'visible') return;
    const next = document.querySelector('a.pro-card[data-analytics-source="banner"]');

    if (next === banner) return;
    observer.disconnect();
    banner = next;

    if (banner) observer.observe(banner);
  };

  const visibility = () => {
    observer.disconnect();
    banner = null;
    watch();
  };

  // App Router can stream the gallery rail after its pathname effect has run.
  const mutations = new MutationObserver(watch);

  mutations.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('visibilitychange', visibility);
  watch();

  return () => {
    disposed = true;
    observer.disconnect();
    mutations.disconnect();
    document.removeEventListener('visibilitychange', visibility);
  };
}
