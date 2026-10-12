import { analyticsConfig } from '@/lib/analytics/server-config';

export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';

export function GET(request: Request) {
  return Response.json(analyticsConfig(request.headers), {
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'CDN-Cache-Control': 'no-store',
      'Cloudflare-CDN-Cache-Control': 'no-store',
      Vary: 'CF-IPCountry, X-Real-IP, CF-Worker, Sec-GPC, DNT',
    },
  });
}
