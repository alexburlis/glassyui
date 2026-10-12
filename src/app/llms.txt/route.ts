import {
  componentCategories,
  componentDocs,
  initializeShadcn,
  publicRegistryMapping,
} from '@/components/docs/component-docs-data';
import { guides } from '@/components/docs/guide-data';
import { PRO_ORIGIN, GITHUB, SITE_URL } from '@/lib/site-links';

export const dynamic = 'force-static';

/**
 * A map of the site for language models, in the llms.txt layout: a title, a summary and links
 * with a line each. `/llms-full.txt` carries the same pages in full.
 */
export function GET() {
  const addCommand = initializeShadcn.replace(' init', ' add');

  const link = (title: string, path: string, note: string) =>
    `- [${title}](${SITE_URL}${path}): ${note}`;

  const lines = [
    '# Glassy UI',
    '',
    `> Glassy UI components for React. ${componentDocs.length} accessible components that bend what sits behind them, installed with the shadcn CLI as source you own. Free and MIT licensed.`,
    '',
    `Glassy UI ships as a shadcn-compatible registry: no package to update, every file lands in your repo. It needs Tailwind CSS 4 and a project initialised with shadcn. Add this mapping to \`components.json\`, then install any component with \`${addCommand} @glassyui/<name>\`:`,
    '',
    '```json',
    publicRegistryMapping,
    '```',
    '',
    '## Docs',
    '',
    link('Getting started', '/docs', 'Set up the registry and add a component'),
    link('All components', '/components', 'Every component with a live demo'),
    `- [Templates](${PRO_ORIGIN}): Complete Next.js sites built from Glassy UI components, in Glassy UI Pro`,
    link(
      'React Native',
      '/mobile',
      'The same components for React Native and Expo apps, from @glassyui-native',
    ),
    ...guides.map((guide) => link(guide.title, `/guides/${guide.slug}`, guide.description)),
    '',
  ];

  for (const category of componentCategories) {
    const inCategory = componentDocs.filter((component) => component.category === category);

    if (inCategory.length === 0) continue;

    lines.push(`## ${category}`, '');

    for (const component of inCategory) {
      lines.push(link(component.name, component.route ?? '/components', component.description));
    }

    lines.push('');
  }

  lines.push(
    '## Optional',
    '',
    link(
      'Full documentation as one file',
      '/llms-full.txt',
      'Every component with install, usage and API',
    ),
    link(
      'Registry index',
      '/r/registry.json',
      'The machine-readable list of everything installable',
    ),
    `- [Source on GitHub](${GITHUB.repository}): The repository`,
    `- [Changelog](${GITHUB.changelog}): What changed, release by release`,
    '',
  );

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
