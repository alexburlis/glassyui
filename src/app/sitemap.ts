import type { MetadataRoute } from 'next';
import { componentDocs } from '@/components/docs/component-docs-data';
import { guides } from '@/components/docs/guide-data';
import { SITE_URL } from '@/lib/site-links';
import { nativeComponentDocs } from '@/lib/native-component-docs';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: '2026-10-10',
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/docs`,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/components`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ];

  return [
    ...routes,
    ...['/mobile', '/guides', ...guides.map((guide) => `/guides/${guide.slug}`)].map((route) => ({
      url: `${SITE_URL}${route}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...componentDocs.map((component) => ({
      url: `${SITE_URL}${component.route}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...nativeComponentDocs.map((component) => ({
      url: `${SITE_URL}/components/${component.id}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
