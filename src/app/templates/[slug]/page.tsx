import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getComponentDoc } from '@/components/docs/component-docs-data';
import { CopyChip } from '@/components/site/copy-chip';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteNav } from '@/components/site/site-nav';
import { installCommand } from '@/lib/install-command';
import { shareCard, shareMetadata } from '@/lib/share';
import { sourceUrl } from '@/lib/site-links';
import { FREE_TEMPLATES, freeTemplatePath, getAvailableTemplate } from '@/lib/templates';
import registry from '../../../../registry.json';
import '@/styles/template-page.css';

export const dynamicParams = false;

export function generateStaticParams() {
  return FREE_TEMPLATES.flatMap((template) =>
    template.status === 'available' ? [{ slug: template.slug }] : [],
  );
}

type TemplatePageProps = { params: Promise<{ slug: string }> };

function installation(registryItem: string) {
  const item = registry.items.find((candidate) => candidate.name === registryItem);

  // The item's first file is the template's own page component.
  const source = item?.files?.[0]?.path;

  if (!item || !source) throw new Error(`Missing registry item ${registryItem}`);

  const components = (item.registryDependencies ?? []).map((dependency) => {
    const id = dependency.replace('@glassyui/', '');
    const doc = getComponentDoc(id);

    if (!doc) throw new Error(`${registryItem} uses ${id}, which has no component page.`);

    return { id, name: doc.name.replace(/^Glass /, '') };
  });

  return { components, source };
}

export async function generateMetadata({ params }: TemplatePageProps): Promise<Metadata> {
  const template = getAvailableTemplate((await params).slug);

  if (!template) return {};

  const title = `${template.name}, a free ${template.kind.toLowerCase()} template`;
  const description = `${template.summary} Built from Glassy UI components; install it with one shadcn command.`;
  const url = freeTemplatePath(template.slug);

  return {
    title,
    description,
    alternates: { canonical: url },
    ...shareMetadata({
      card: shareCard(
        `templates/${template.slug}`,
        `The ${template.name} template, live, beside its name.`,
      ),
      title,
      description,
      url,
      type: 'article',
    }),
  };
}

export default async function TemplatePage({ params }: TemplatePageProps) {
  const template = getAvailableTemplate((await params).slug);

  if (!template) notFound();

  const { components, source } = installation(template.registryItem);
  const preview = `${freeTemplatePath(template.slug)}/preview`;

  return (
    <>
      <SiteNav />
      <main className="home template-page" id="main-content">
        <section aria-labelledby="template-title" className="home-hero template-page-hero">
          <p className="template-page-kind">Free template · {template.kind}</p>
          <h1 className="home-title" id="template-title">
            {template.name}
          </h1>
          <p className="home-lead">{template.summary}</p>
          <CopyChip command={installCommand([template.registryItem], 'react')} />
          <p className="template-page-links">
            <a href={sourceUrl(source)}>View the source</a>
          </p>
        </section>

        <section aria-label={`${template.name}, live`} className="template-preview">
          <div className="template-preview-frame">
            <iframe src={preview} title={`${template.name} template, live`} />
          </div>
          <a className="home-section-link template-preview-open" href={preview}>
            Open full screen<span aria-hidden> ›</span>
          </a>
        </section>

        <section aria-labelledby="template-components" className="template-page-section">
          <h2 id="template-components">Built from Glassy UI</h2>
          <ul className="template-page-components">
            {components.map((component) => (
              <li key={component.id}>
                <Link href={`/components/${component.id}`}>{component.name}</Link>
              </li>
            ))}
          </ul>
          <h2>Make it yours</h2>
          <p>
            {template.name} is a {template.theme} page: set{' '}
            <code>data-lg-theme=&quot;{template.theme}&quot;</code> on <code>&lt;html&gt;</code>.
            Set <code>--{template.slug}-accent</code> and{' '}
            <code>--{template.slug}-accent-rotate</code> for the accent, and{' '}
            <code>--{template.slug}-serif</code> and <code>--{template.slug}-sans</code> for the
            fonts.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
