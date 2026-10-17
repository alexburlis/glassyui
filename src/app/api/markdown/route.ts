import type { NextRequest } from 'next/server';
import TurndownService from 'turndown';

/** Convert the same public HTML served to browsers, with no provider or parallel content store. */
export async function GET(request: NextRequest) {
  const pathname =
    request.headers.get('x-glassyui-markdown-path') ??
    request.nextUrl.searchParams.get('path') ??
    '';

  if (
    !pathname.startsWith('/') ||
    pathname.startsWith('//') ||
    /[\s.%?#\\]/.test(pathname) ||
    /^\/(api|_next)(\/|$)/.test(pathname)
  ) {
    return new Response('Invalid page path.', { status: 400 });
  }

  // Fetch only this server. External redirects, including Pro, pass back to the caller.
  const origin = `http://127.0.0.1:${process.env.PORT ?? '3000'}`;

  // Each segment is encoded, so the client's path can only name a page on this server.
  const page = pathname
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  const url = new URL(page, origin);

  if (url.origin !== origin) return new Response('Invalid page path.', { status: 400 });

  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'text/html' },
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  });

  const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Accept' });
  const link = response.headers.get('link');

  if (link) headers.set('Link', link);

  const location = response.headers.get('location');

  if (location) {
    headers.set('Location', location);

    return new Response(null, { status: response.status, headers });
  }

  if (!response.headers.get('content-type')?.startsWith('text/html')) {
    return new Response('The requested resource is not an HTML page.', { status: 406, headers });
  }

  const converter = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  converter.remove(['head', 'title', 'script', 'style', 'canvas', 'noscript']);
  converter.remove((node) => node.nodeName.toLowerCase() === 'svg');
  const markdown = converter.turndown(await response.text());
  headers.set('Content-Type', 'text/markdown; charset=utf-8');

  return new Response(`${markdown}\n`, { status: response.status, headers });
}
