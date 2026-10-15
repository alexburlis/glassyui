import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

require('./register-tsx.mjs');

const {
  CONSENT_COOKIE,
  CONSENT_VERSION,
  CONSENT_MAX_AGE_SECONDS,
  REVIEWED_OPT_OUT_COUNTRIES,
  parseConsent,
  consentMode,
} = require('../src/lib/analytics/consent.ts');

const { analyticsConfig } = require('../src/lib/analytics/server-config.ts');

const now = Date.UTC(2026, 9, 4, 12);

const lifetime = 180 * 86400 * 1000;

const accepted = {
  decision: 'accepted',
  version: 'analytics-v1',
  purpose: 'analytics',
  updatedAt: now - 1000,
  expiresAt: now - 1000 + lifetime,
};

const rejected = { ...accepted, decision: 'rejected' };

const input = {
  country: null,
  trustedCountry: false,
  reviewedOptOutCountries: [],
};

const failures = [];

const checks = [];

function check(name, assertion) {
  try {
    assertion();
    checks.push(name);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

function serverConfig(headers, trust = 'true') {
  const previous = process.env.ANALYTICS_TRUST_CLOUDFLARE_PROXY;

  if (trust === null) delete process.env.ANALYTICS_TRUST_CLOUDFLARE_PROXY;
  else process.env.ANALYTICS_TRUST_CLOUDFLARE_PROXY = trust;

  try {
    return analyticsConfig(headers);
  } finally {
    if (previous === undefined) delete process.env.ANALYTICS_TRUST_CLOUDFLARE_PROXY;
    else process.env.ANALYTICS_TRUST_CLOUDFLARE_PROXY = previous;
  }
}

check('the product regional default is limited to the US', () => {
  assert.deepEqual(REVIEWED_OPT_OUT_COUNTRIES, ['US']);
});

// This is the production server config boundary: a caller-supplied country is usable only
// beside a strict socket-peer address supplied by the ingress proxy. XFF is never a fallback.
const regionCases = [
  ['Cloudflare IPv4 US', { 'x-real-ip': '173.245.48.1', 'cf-ipcountry': 'US' }, 'opt-out', 'US'],
  ['Cloudflare IPv6 US', { 'x-real-ip': '2606:4700::1', 'cf-ipcountry': 'US' }, 'opt-out', 'US'],
  [
    'Cloudflare upper IPv4 range',
    { 'x-real-ip': '173.245.63.255', 'cf-ipcountry': 'US' },
    'opt-out',
    'US',
  ],
  [
    'Cloudflare mixed-case IPv6',
    { 'x-real-ip': '2A06:98C0::1', 'cf-ipcountry': 'US' },
    'opt-out',
    'US',
  ],
  [
    'direct IPv4 country spoof',
    { 'x-real-ip': '203.0.113.10', 'cf-ipcountry': 'US' },
    'opt-in',
    null,
  ],
  [
    'direct IPv6 country spoof',
    { 'x-real-ip': '2001:db8::1', 'cf-ipcountry': 'US' },
    'opt-in',
    null,
  ],
  [
    'just below Cloudflare IPv4 range',
    { 'x-real-ip': '173.245.47.255', 'cf-ipcountry': 'US' },
    'opt-in',
    null,
  ],
  [
    'just above Cloudflare IPv4 range',
    { 'x-real-ip': '173.245.64.0', 'cf-ipcountry': 'US' },
    'opt-in',
    null,
  ],
  [
    'outside Cloudflare IPv6 range',
    { 'x-real-ip': '2606:4701::1', 'cf-ipcountry': 'US' },
    'opt-in',
    null,
  ],
  ['missing socket peer', { 'cf-ipcountry': 'US' }, 'opt-in', null],
  ['malformed socket peer', { 'x-real-ip': 'cloudflare', 'cf-ipcountry': 'US' }, 'opt-in', null],
  [
    'socket peer with IPv4 port',
    { 'x-real-ip': '173.245.48.1:443', 'cf-ipcountry': 'US' },
    'opt-in',
    null,
  ],
  [
    'socket peer with IPv6 brackets',
    { 'x-real-ip': '[2606:4700::1]', 'cf-ipcountry': 'US' },
    'opt-in',
    null,
  ],
  [
    'socket peer with CIDR',
    { 'x-real-ip': '173.245.48.1/32', 'cf-ipcountry': 'US' },
    'opt-in',
    null,
  ],
  [
    'multiple socket peers',
    { 'x-real-ip': '173.245.48.1, 203.0.113.10', 'cf-ipcountry': 'US' },
    'opt-in',
    null,
  ],
  ['missing country', { 'x-real-ip': '173.245.48.1' }, 'opt-in', null],
  ['lowercase country', { 'x-real-ip': '173.245.48.1', 'cf-ipcountry': 'us' }, 'opt-in', null],
  ['malformed country', { 'x-real-ip': '173.245.48.1', 'cf-ipcountry': 'USA' }, 'opt-in', null],
  ['multiple countries', { 'x-real-ip': '173.245.48.1', 'cf-ipcountry': 'US, DE' }, 'opt-in', null],
  [
    'reserved unknown country',
    { 'x-real-ip': '173.245.48.1', 'cf-ipcountry': 'XX' },
    'opt-in',
    null,
  ],
  ['unassigned country', { 'x-real-ip': '173.245.48.1', 'cf-ipcountry': 'QZ' }, 'opt-in', null],
  ['Tor country', { 'x-real-ip': '173.245.48.1', 'cf-ipcountry': 'T1' }, 'opt-in', null],
  [
    'XFF cannot substitute for socket peer',
    { 'x-forwarded-for': '173.245.48.1', 'cf-ipcountry': 'US' },
    'opt-in',
    null,
  ],
  [
    'XFF cannot override direct socket peer',
    { 'x-real-ip': '203.0.113.10', 'x-forwarded-for': '173.245.48.1', 'cf-ipcountry': 'US' },
    'opt-in',
    null,
  ],
  [
    'CF client and Ray headers cannot substitute for peer',
    { 'cf-connecting-ip': '173.245.48.1', 'cf-ray': 'fake-ORD', 'cf-ipcountry': 'US' },
    'opt-in',
    null,
  ],
  [
    'underscore alias cannot substitute for peer',
    { x_real_ip: '173.245.48.1', 'cf-ipcountry': 'US' },
    'opt-in',
    null,
  ],
  [
    'Worker subrequest cannot use edge country',
    { 'x-real-ip': '173.245.48.1', 'cf-ipcountry': 'US', 'cf-worker': 'worker.example.com' },
    'opt-in',
    null,
  ],
  [
    'empty Worker marker still rejects country',
    { 'x-real-ip': '173.245.48.1', 'cf-ipcountry': 'US', 'cf-worker': '' },
    'opt-in',
    null,
  ],
];

for (const country of ['DE', 'GB', 'CH', 'CA', 'AU', 'NZ', 'MX', 'JP']) {
  regionCases.push([
    `trusted ${country} remains opt-in`,
    { 'x-real-ip': '173.245.48.1', 'cf-ipcountry': country },
    'opt-in',
    country,
  ]);
}

for (const [name, headers, mode, country] of regionCases) {
  check(`server config: ${name}`, () => {
    const actual = serverConfig(new Headers(headers));

    assert.deepEqual([actual.mode, actual.country ?? null], [mode, country]);
  });
}

for (const header of ['x-real-ip', 'cf-ipcountry']) {
  check(`server config: repeated ${header} fails closed`, () => {
    const headers = new Headers({ 'x-real-ip': '173.245.48.1', 'cf-ipcountry': 'US' });

    headers.append(header, header === 'x-real-ip' ? '173.245.48.1' : 'US');
    assert.equal(serverConfig(headers).mode, 'opt-in');
  });
}

for (const trust of [null, '', 'false', 'TRUE', '1', 'unreviewed']) {
  check(
    `server config: ${trust === null ? 'missing' : JSON.stringify(trust)} proxy attestation fails closed`,
    () => {
      const actual = serverConfig(
        new Headers({ 'x-real-ip': '173.245.48.1', 'cf-ipcountry': 'US' }),
        trust,
      );

      assert.deepEqual([actual.mode, actual.country ?? null], ['opt-in', null]);
    },
  );
}

check('first-party preference identity and proposed expiry', () => {
  assert.equal(CONSENT_COOKIE, 'glassy-ui-analytics-consent');
  assert.equal(CONSENT_VERSION, 'analytics-v1');
  assert.equal(CONSENT_MAX_AGE_SECONDS, 180 * 86400);
});

for (const preference of [accepted, rejected]) {
  check(`valid ${preference.decision} preference`, () => {
    assert.deepEqual(parseConsent(JSON.stringify(preference), now), preference);
  });
}

for (const [name, raw] of [
  ['missing', null],
  ['empty', ''],
  ['malformed JSON', '{'],
  ['primitive', 'true'],
  ['wrong decision', JSON.stringify({ ...accepted, decision: 'dismissed' })],
  ['wrong purpose', JSON.stringify({ ...accepted, purpose: 'marketing' })],
  ['expired acceptance', JSON.stringify({ ...accepted, expiresAt: now })],
  ['expired refusal', JSON.stringify({ ...rejected, expiresAt: now })],
  ['future timestamp', JSON.stringify({ ...accepted, updatedAt: now + 60000 })],
  ['inverted timestamps', JSON.stringify({ ...accepted, expiresAt: accepted.updatedAt - 1 })],
  [
    'overlong duration',
    JSON.stringify({ ...accepted, expiresAt: accepted.updatedAt + lifetime + 1 }),
  ],
  ['invalid timestamp', JSON.stringify({ ...accepted, updatedAt: 'yesterday' })],
  ['materially changed acceptance', JSON.stringify({ ...accepted, version: 'analytics-v0' })],
]) {
  check(`discard ${name}`, () => assert.equal(parseConsent(raw, now), null));
}

check('material purpose change keeps a current refusal', () => {
  const preference = { ...rejected, version: 'analytics-v0' };

  assert.deepEqual(parseConsent(JSON.stringify(preference), now), preference);
});

const modeCases = [
  ['unknown fresh visit', {}, 'opt-in'],
  ['fresh EU visit', { country: 'DE', trustedCountry: true }, 'opt-in'],
  ['fresh UK visit', { country: 'GB', trustedCountry: true }, 'opt-in'],
  ['fresh Swiss visit', { country: 'CH', trustedCountry: true }, 'opt-in'],
  ['unreviewed US visit', { country: 'US', trustedCountry: true }, 'opt-in'],
  [
    'trusted reviewed opt-out',
    { country: 'US', trustedCountry: true, reviewedOptOutCountries: ['US'] },
    'opt-out',
  ],
  ['untrusted reviewed country', { country: 'US', reviewedOptOutCountries: ['US'] }, 'opt-in'],
  [
    'invalid reviewed country',
    { country: 'XX', trustedCountry: true, reviewedOptOutCountries: ['XX'] },
    'opt-in',
  ],
  [
    'unassigned country cannot become permissive',
    { country: 'QZ', trustedCountry: true, reviewedOptOutCountries: ['QZ'] },
    'opt-in',
  ],
  [
    'unknown cannot use reviewed list',
    { trustedCountry: true, reviewedOptOutCountries: ['US'] },
    'opt-in',
  ],
  [
    'moving from implicit opt-out to unknown requires consent',
    { reviewedOptOutCountries: ['US'] },
    'opt-in',
  ],
];

for (const country of [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
  'GB',
  'CH',
]) {
  modeCases.push([
    `${country} cannot be weakened by a regional allowlist`,
    { country, trustedCountry: true, reviewedOptOutCountries: [country] },
    'opt-in',
  ]);
}

for (const [name, overrides, expected] of modeCases) {
  check(name, () => {
    const actual = consentMode({ ...input, ...overrides });

    assert.equal(actual, expected);
  });
}

if (failures.length) {
  console.error(
    `Analytics consent contract failed (${failures.length}/${checks.length + failures.length}):`,
  );
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Analytics regional mode and storage contract passed (${checks.length} checks).`);
