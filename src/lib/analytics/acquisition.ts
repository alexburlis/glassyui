import type { PostHog } from 'posthog-js';

export const ACQUISITION_IDLE_MS = 30 * 60 * 1000;

const STORAGE_PROPERTY = 'glassy_acquisition';

const REFERRERS = [
  {
    source: 'x',
    medium: 'social',
    domain: 'x.com',
    hosts: ['x.com', 'twitter.com', 't.co'],
  },
  { source: 'github', medium: 'referral', domain: 'github.com', hosts: ['github.com'] },
  { source: 'google', medium: 'search', domain: 'google.com', hosts: ['google.com'] },
  { source: 'bing', medium: 'search', domain: 'bing.com', hosts: ['bing.com'] },
  { source: 'duckduckgo', medium: 'search', domain: 'duckduckgo.com', hosts: ['duckduckgo.com'] },
  {
    source: 'linkedin',
    medium: 'social',
    domain: 'linkedin.com',
    hosts: ['linkedin.com', 'lnkd.in'],
  },
  {
    source: 'reddit',
    medium: 'social',
    domain: 'reddit.com',
    hosts: ['reddit.com', 'redd.it'],
  },
  {
    source: 'youtube',
    medium: 'social',
    domain: 'youtube.com',
    hosts: ['youtube.com', 'youtu.be'],
  },
] as const;

const DIRECT = { source: 'direct', medium: 'direct', campaign: null, domain: '' } as const;

const INTERNAL = { source: 'same_site', medium: 'internal', campaign: null, domain: '' } as const;

const OTHER = { source: 'other', medium: 'referral', campaign: null, domain: '' } as const;

const PAID_X = {
  source: 'x',
  medium: 'paid_social',
  campaign: 'x-launch',
  domain: 'x.com',
} as const;

const ACQUISITIONS = [
  ...REFERRERS.map(({ source, medium, domain }) => ({ source, medium, domain, campaign: null })),
  DIRECT,
  INTERNAL,
  OTHER,
  PAID_X,
];

type Acquisition = (typeof ACQUISITIONS)[number];

type StoredAcquisition = Acquisition & { landing: string; lastActive: number };

type AcquisitionProperties = {
  acquisition_source: Acquisition['source'];
  acquisition_medium: Acquisition['medium'];
  acquisition_campaign: Acquisition['campaign'];
  acquisition_landing_path: string;
  utm_source: Acquisition['source'];
  utm_medium: Acquisition['medium'];
  utm_campaign?: 'x-launch';
  $referring_domain?: string;
};

function paidCampaign(url: URL): Acquisition | null {
  const params = url.searchParams;

  if (
    params.getAll('utm_source').length === 1 &&
    params.getAll('utm_medium').length === 1 &&
    params.getAll('utm_campaign').length === 1 &&
    params.get('utm_source') === 'x' &&
    params.get('utm_medium') === 'paid_social' &&
    params.get('utm_campaign') === 'x-launch'
  ) {
    return PAID_X;
  }

  return null;
}

function referringSource(referrer: string): Acquisition {
  if (!referrer) return DIRECT;

  try {
    const url = new URL(referrer);

    if (!['https:', 'http:'].includes(url.protocol)) {
      return OTHER;
    }

    if (['glassyui.com', 'www.glassyui.com', 'pro.glassyui.com'].includes(url.hostname)) {
      return INTERNAL;
    }

    const referral = REFERRERS.find(({ hosts }) =>
      hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)),
    );

    return referral
      ? {
          source: referral.source,
          medium: referral.medium,
          campaign: null,
          domain: referral.domain,
        }
      : OTHER;
  } catch {
    return OTHER;
  }
}

/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof -- Parse untrusted SDK cookie state into the bounded acquisition model. */
function parseStoredAcquisition(
  value: unknown,
  now: number,
  pagePath: (pathname: string) => string | null,
): StoredAcquisition | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('source' in value) ||
    !('medium' in value) ||
    !('campaign' in value) ||
    !('domain' in value) ||
    !('landing' in value) ||
    !('lastActive' in value)
  )
    return null;

  if (
    typeof value.landing !== 'string' ||
    pagePath(value.landing) !== value.landing ||
    typeof value.lastActive !== 'number' ||
    !Number.isSafeInteger(value.lastActive) ||
    value.lastActive > now ||
    now - value.lastActive >= ACQUISITION_IDLE_MS
  )
    return null;

  const candidate = ACQUISITIONS.find(
    ({ source, medium, campaign, domain }) =>
      source === value.source &&
      medium === value.medium &&
      campaign === value.campaign &&
      domain === value.domain,
  );

  if (candidate) return { ...candidate, landing: value.landing, lastActive: value.lastActive };

  return null;
}

/* oxlint-enable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof */

export function startAcquisition(instance: PostHog, pagePath: (pathname: string) => string | null) {
  const now = Date.now();
  const incoming = paidCampaign(new URL(location.href));
  const previous = parseStoredAcquisition(instance.get_property(STORAGE_PROPERTY), now, pagePath);

  const attribution =
    incoming || !previous
      ? {
          ...(incoming ?? referringSource(document.referrer)),
          landing: pagePath(location.pathname) ?? '/',
          lastActive: now,
        }
      : { ...previous, lastActive: now };

  instance.register({ [STORAGE_PROPERTY]: attribution });
}

export function acquisitionProperties(
  instance: PostHog,
  pagePath: (pathname: string) => string | null,
) {
  const now = Date.now();
  const previous = parseStoredAcquisition(instance.get_property(STORAGE_PROPERTY), now, pagePath);

  const attribution: StoredAcquisition = previous
    ? { ...previous, lastActive: now }
    : {
        source: 'direct',
        medium: 'direct',
        campaign: null,
        domain: '',
        landing: pagePath(location.pathname) ?? '/',
        lastActive: now,
      };

  instance.register({ [STORAGE_PROPERTY]: attribution });

  const properties: AcquisitionProperties = {
    acquisition_source: attribution.source,
    acquisition_medium: attribution.medium,
    acquisition_campaign: attribution.campaign,
    acquisition_landing_path: attribution.landing,
    utm_source: attribution.source,
    utm_medium: attribution.medium,
  };

  if (attribution.campaign) properties.utm_campaign = attribution.campaign;

  if (attribution.domain) properties.$referring_domain = attribution.domain;

  return properties;
}
