import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prefersMarkdown } from '@/lib/markdown-negotiation';

/** Negotiate Markdown from the free site's actual HTML. */
export function proxy(request: NextRequest) {
  if (
    (request.method === 'GET' || request.method === 'HEAD') &&
    prefersMarkdown(request.headers.get('accept'))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/api/markdown';
    url.search = '';
    const headers = new Headers(request.headers);
    // Next restores the visitor's URL before invoking an internally rewritten route.
    headers.set('x-glassyui-markdown-path', request.nextUrl.pathname);

    return NextResponse.rewrite(url, { request: { headers } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    {
      source: '/((?!api(?:/|$)|_next(?:/|$)|.*\\.).*)',
      // Match before Next.js strips the RSC header from the proxy's Request.
      missing: [{ type: 'header', key: 'rsc' }],
    },
  ],
};
