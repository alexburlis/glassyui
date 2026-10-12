import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-links';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/diagnostics', '/test', '/toggle', '/search-index.json'],
      other: { 'Content-Signal': 'search=yes, ai-input=no, ai-train=no' },
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
