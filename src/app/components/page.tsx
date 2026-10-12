import type { Metadata } from 'next';
import { shareCard, shareMetadata } from '@/lib/share';
import { componentCategories, componentDocs } from '@/components/docs/component-docs-data';
import { DocsShell } from '@/components/docs/docs-shell';
import { ComponentGrid, ReleaseFeedbackProvider } from '@/components/site/component-grid';
import { ProCard } from '@/components/site/pro-card';
import { TemplatesSection } from '@/components/site/templates-section';

const description = `Browse the ${componentDocs.length} Glassy UI components for React in the source registry, each one live.`;

export const metadata: Metadata = {
  title: 'Components',
  description,
  alternates: {
    canonical: '/components',
  },
  ...shareMetadata({
    card: shareCard(
      'components',
      'Four live demos on red ribbon artwork: buttons, switches, a slider and a segmented control, beside the words: Components. One glass.',
    ),
    title: 'Glassy UI components',
    description,
    url: '/components',
  }),
};

const categories = componentCategories
  .map((category) => ({
    category,
    components: componentDocs
      .filter((component) => component.category === category)
      .map((component) => {
        if (!component.route) throw new Error(`${component.id} has no page.`);

        return {
          description: component.description,
          id: component.id,
          isNew: component.isNew,
          name: component.name,
          route: component.route,
        };
      }),
    id: category.toLowerCase(),
  }))
  .filter((group) => group.components.length > 0)
  .map((group, index, groups) => ({
    ...group,
    // Card backdrops run on across sections, so no two sections open alike.
    offset: groups.slice(0, index).reduce((count, earlier) => count + earlier.components.length, 0),
  }));

export default function ComponentsPage() {
  return (
    <DocsShell current="/components" rail={{ content: <ProCard />, label: 'Glassy UI Pro' }}>
      <header className="docs-page-header">
        <h1>Components</h1>
        <p>
          {componentDocs.length} components, one glass. Every demo on this page is live, and each
          one installs as source with a single command.
        </p>
      </header>
      <ReleaseFeedbackProvider>
        {categories.map((group) => (
          <section
            aria-labelledby={`${group.id}-title`}
            className="docs-section components-category"
            id={group.id}
            key={group.id}
          >
            <h2 id={`${group.id}-title`}>{group.category}</h2>
            <ComponentGrid components={group.components} offset={group.offset} />
          </section>
        ))}
      </ReleaseFeedbackProvider>
      <TemplatesSection />
    </DocsShell>
  );
}
