import { renderBlogRss } from '@/lib/blog';

export const revalidate = 900;

export async function GET() {
  return new Response(await renderBlogRss(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900',
    },
  });
}
