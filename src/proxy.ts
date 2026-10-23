import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prefersMarkdown } from '@/lib/markdown-negotiation';

/** Negotiate Markdown from the free site's actual HTML. */
export function proxy(request: NextRequest) {
  // This site mutates through API routes and exports no page Server Actions.
  if (request.method === 'POST')
    return new NextResponse(null, {
      status: 405,
      headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' },
    });

  if (
    (request.method === 'GET' || request.method === 'HEAD') &&
    !request.headers.has('rsc') &&
    !request.nextUrl.pathname.includes('.') &&
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
  matcher: ['/((?!api(?:/|$)|_next(?:/|$)).*)'],
};
