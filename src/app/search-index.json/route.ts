import { componentDocs } from '@/components/docs/component-docs-data';
import { guides } from '@/components/docs/guide-data';
import { getBlogPosts } from '@/lib/blog';
import { FREE_TEMPLATES, freeTemplatePath } from '@/lib/templates';

export const revalidate = 900;

/** What the site search lists. It is fetched the first time the search opens, so no page carries it. */
export async function GET() {
  return Response.json({
    components: componentDocs.map((component) => ({
      category: component.category,
      description: component.description,
      href: component.route ?? '/components',
      title: component.name.replace('Glass ', ''),
    })),
    guides: [
      {
        description:
          'The same components for React Native and Expo apps on iOS, Android and the web.',
        href: '/mobile',
        title: 'Glassy UI for React Native',
      },
      ...guides.map((guide) => ({
        description: guide.description,
        href: `/guides/${guide.slug}`,
        title: guide.title,
      })),
    ],
    templates: FREE_TEMPLATES.flatMap((template) =>
      template.status === 'available'
        ? [
            {
              description: template.summary,
              href: freeTemplatePath(template.slug),
              title: `${template.name} template`,
            },
          ]
        : [],
    ),
    articles: (await getBlogPosts()).map((post) => ({
      description: post.description,
      href: `/blog/${post.slug}`,
      title: post.title,
    })),
  });
}
