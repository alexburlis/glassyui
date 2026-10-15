import { BlockList, isIP } from 'node:net';
import { POSTHOG_HOST, type AnalyticsConfig } from './config';
import { consentMode, parseCountry, REVIEWED_OPT_OUT_COUNTRIES } from './consent';

// Published Cloudflare proxy networks, checked October 5, 2026:
// https://www.cloudflare.com/ips/ . New/unlisted peers fail closed.
const cloudflare = new BlockList();

for (const subnet of [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
]) {
  const [address, prefix] = subnet.split('/');

  cloudflare.addSubnet(address, Number(prefix), isIP(address) === 4 ? 'ipv4' : 'ipv6');
}

function trustedCountry(headers: Headers): string | null {
  if (process.env.ANALYTICS_TRUST_CLOUDFLARE_PROXY !== 'true' || headers.has('cf-worker'))
    return null;

  // The reviewed Traefik ingress strips untrusted forwarded headers and writes the
  // socket peer as X-Real-IP. Never substitute a visitor address or an XFF chain.
  const peer = headers.get('x-real-ip');
  const family = peer === null ? 0 : isIP(peer);

  if (peer === null || family === 0 || !cloudflare.check(peer, family === 4 ? 'ipv4' : 'ipv6'))
    return null;

  return parseCountry(headers.get('cf-ipcountry'));
}

export function analyticsConfig(headers: Headers): AnalyticsConfig & { country: string | null } {
  const token = process.env.POSTHOG_PROJECT_TOKEN ?? '';
  const host = process.env.POSTHOG_HOST ?? POSTHOG_HOST;
  const configured = /^phc_[a-zA-Z0-9_-]+$/.test(token) && host === POSTHOG_HOST;
  const signal = headers.get('sec-gpc') === '1' || headers.get('dnt') === '1';
  const country = trustedCountry(headers);

  const mode = consentMode({
    country,
    trustedCountry: country !== null,
    reviewedOptOutCountries: REVIEWED_OPT_OUT_COUNTRIES,
  });

  // Country is returned only to make the selected region verifiable. The client
  // parser discards it; it is neither persisted nor attached to analytics events.
  return {
    token: configured ? token : null,
    host: POSTHOG_HOST,
    mode,
    signal,
    country,
  };
}
