import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';
import { PRO_ORIGIN } from './src/lib/site-links';

const sourceCommit = process.env.SOURCE_COMMIT;

const release =
  process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? (sourceCommit ? `glassyui@${sourceCommit}` : undefined);

if (process.env.NEXT_PUBLIC_SENTRY_DSN && !/^glassyui@[0-9a-f]{40}$/.test(release ?? '')) {
  throw new Error('Sentry requires the exact GlassyUI source commit.');
}

const nextConfig: NextConfig = {
  // The production image (Dockerfile) runs the traced standalone server.
  output: 'standalone',
  images: {
    localPatterns: [{ pathname: '/**', search: '' }, { pathname: '/share/blog/**' }],
  },
  env: { NEXT_PUBLIC_SENTRY_RELEASE: release ?? '' },
  outputFileTracingIncludes: {
    '/blog': ['./content/blog/*.mdx'],
    '/blog/*': ['./content/blog/*.mdx'],
    '/sitemap.xml': ['./content/blog/*.mdx'],
    '/search-index.json': ['./content/blog/*.mdx'],
    '/components/*': ['./src/components/examples/*.tsx', './fixtures/expo-consumer/usage/*.tsx'],
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  async redirects() {
    return [
      { source: '/pro', destination: `${PRO_ORIGIN}/`, permanent: true },
      { source: '/pro/:path*', destination: `${PRO_ORIGIN}/:path*`, permanent: true },
      // Retired template and guide addresses lead to Glassy UI Pro.
      ...['/templates', '/templates/:path*', '/guides/portfolio'].map((source) => ({
        source,
        destination: PRO_ORIGIN,
        permanent: true,
      })),
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.glassyui.com' }],
        destination: 'https://glassyui.com/:path*',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [{ source: '/api/pulse/i/v0/e', destination: 'https://eu.i.posthog.com/i/v0/e/' }];
  },
  async headers() {
    return [
      {
        source: '/',
        headers: [
          {
            key: 'Link',
            value:
              '</llms.txt>; rel="describedby"; type="text/plain", </llms-full.txt>; rel="describedby"; type="text/plain", </docs>; rel="service-doc"; type="text/html", </r/registry.json>; rel="service-desc"; type="application/json"',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [{ key: 'Vary', value: 'Accept' }],
      },
      ...(release
        ? [{ source: '/:path*', headers: [{ key: 'X-GlassyUI-Release', value: release }] }]
        : []),
      // Link previews: every address carries its file's hash (src/lib/share.ts), so a cache may
      // keep each one for good.
      {
        source: '/share/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Messages reads a loop by byte range. The proxy in front of the app compresses whole
      // responses, and a shared cache holding the compressed copy answers a range with the whole
      // file, which Messages rejects. Shared caches therefore pass the loops to the app, which
      // answers ranges itself; browsers still keep them.
      {
        source: '/share/loops/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, max-age=31536000, immutable' }],
      },
      {
        source: '/r/:path*.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: 'burlis-management-gmbh',
  project: 'glassyui',
  sentryUrl: 'https://de.sentry.io/',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: {
    name: release,
    create: Boolean(process.env.SENTRY_AUTH_TOKEN),
    finalize: Boolean(process.env.SENTRY_AUTH_TOKEN),
  },
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN, deleteSourcemapsAfterUpload: true },
  webpack: {
    autoInstrumentServerFunctions: false,
    autoInstrumentMiddleware: false,
    autoInstrumentAppDirectory: false,
    automaticVercelMonitors: false,
  },
  telemetry: false,
  errorHandler: () => {
    throw new Error('Sentry release or source-map upload failed.');
  },
  silent: true,
});
