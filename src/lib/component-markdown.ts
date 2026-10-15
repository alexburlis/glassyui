import type { ComponentDoc } from '@/components/docs/component-docs-data';
import { SITE_URL } from './site-links';
import { dependencyCommand, registryItemUrl } from './install-command';
import { getNativeUsage } from './native-usage-source';

const fence = (code: string, language = 'tsx') => `\`\`\`${language}\n${code.trim()}\n\`\`\``;

/**
 * One component's page as plain markdown: what it is, how to install and use it, and its API.
 * It is written for models and people reading without a browser, so it carries no demo.
 */
export function componentMarkdown(component: ComponentDoc, headingLevel = 2) {
  const heading = (level: number, text: string) => `${'#'.repeat(headingLevel + level)} ${text}`;
  const sections = [`${'#'.repeat(headingLevel)} ${component.name}`, component.description];

  sections.push(`Page: ${SITE_URL}${component.route ?? '/components'}`);
  sections.push(heading(1, 'Install'), fence(component.install, 'bash'));
  sections.push(
    'For a React 19+ app with Tailwind CSS 4 and a shadcn components.json. The complete item URL needs no registry mapping. The component page also offers pnpm, modern Yarn and bun commands.',
    heading(2, 'Manual installation'),
    `Copy the complete files from ${registryItemUrl(component.registryItem, 'react')}. Keep the lib and styles directories. If @/ points at src, use src/components/glassyui. Installed modules import their stylesheets; no separate stylesheet import is needed.`,
    component.installedFiles.map((file) => `- \`${file}\``).join('\n'),
    'Set data-lg-theme="light" on a light app’s root, or data-lg-theme="dark" on a dark app’s root. Keep it in sync with the app theme. When using GlassProvider, match defaultTheme to the app’s initial theme.',
  );

  if (component.installedDependencies.length > 0) {
    sections.push(fence(dependencyCommand(component.installedDependencies, 'react'), 'bash'));
  }

  if (component.usage) sections.push(heading(1, 'Usage'), fence(component.usage));

  for (const example of component.examples) {
    sections.push(heading(2, example.title), fence(example.code));
  }

  if (component.api.length > 0) {
    sections.push(
      heading(1, 'API'),
      component.api.map((entry) => `- \`${entry.name}\`: ${entry.description}`).join('\n'),
    );
  }

  for (const note of component.notes ?? []) {
    sections.push(heading(1, note.title), note.body);
  }

  const native = getNativeUsage(component.registryItem);

  if (native) {
    sections.push(
      heading(1, 'React Native'),
      `For Expo SDK 55 or later. Set up components.json as described in ${SITE_URL}/guides/expo.`,
      fence(native.install, 'bash'),
      `Manual source: ${registryItemUrl(component.registryItem, 'react-native')}. Install its listed packages with npx expo install, then rebuild your development build.`,
      ...(native.alsoUses.length > 0
        ? [
            `This usage also uses ${native.alsoUses.join(', ')}. Install the complete example:`,
            fence(native.example, 'bash'),
          ]
        : []),
      fence(native.source),
    );
  }

  return sections.join('\n\n');
}
