import type { MetadataRoute } from 'next';
import { componentDocs } from '@/components/docs/component-docs-data';
import { guides } from '@/components/docs/guide-data';
import { SITE_URL } from '@/lib/site-links';
import { nativeComponentDocs } from '@/lib/native-component-docs';
import { getBlogSitemapEntries } from '@/lib/blog';
import { FREE_TEMPLATES, freeTemplatePath } from '@/lib/templates';

export const revalidate = 900;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
    {
      url: `${SITE_URL}/templates`,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
  ];

  return [
    ...routes,
    ...['/mobile', '/guides', '/blog', ...guides.map((guide) => `/guides/${guide.slug}`)].map(
      (route) => ({
        url: `${SITE_URL}${route}`,
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      }),
    ),
    ...componentDocs.map((component) => ({
      url: `${SITE_URL}${component.route}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    // A template's preview is its page's frame, not a page of its own.
    ...FREE_TEMPLATES.flatMap((template) =>
      template.status === 'available'
        ? [
            {
              url: `${SITE_URL}${freeTemplatePath(template.slug)}`,
              changeFrequency: 'monthly' as const,
              priority: 0.8,
            },
          ]
        : [],
    ),
    ...nativeComponentDocs.map((component) => ({
      url: `${SITE_URL}/components/${component.id}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...(await getBlogSitemapEntries()),
  ];
}
