import type { ComponentDoc } from '@/components/docs/component-docs-data';
import { SITE_URL } from './site-links';

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

  if (component.installedDependencies.length > 0) {
    sections.push(
      `Packages it adds: ${component.installedDependencies.map((name) => `\`${name}\``).join(', ')}.`,
    );
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

  return sections.join('\n\n');
}
