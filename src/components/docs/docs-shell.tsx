import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteNav } from '@/components/site/site-nav';
import { PRO_ORIGIN, GITHUB, newIssueUrl, sourceUrl } from '@/lib/site-links';
import { nativeComponentDocs, getNativeComponentDoc } from '@/lib/native-component-docs';
import { componentCategories, componentDocs } from './component-docs-data';
import { DocsMobileNav, type DocsMobileNavGroup } from './docs-mobile-nav';

type DocsShellProps = {
  children: ReactNode;
  /** Route of the page, marked as current in the sidebar. */
  current: string;
  /** Names the page in the Contribute block under the table of contents. */
  contribute?: { sourcePath?: string; subject: string };
  /** Fills the right column on a page without a table of contents. */
  rail?: { content: ReactNode; label: string };
  toc?: Array<{ href: string; title: string }>;
};

const categoryGroups: DocsMobileNavGroup[] = componentCategories
  .map((category) => ({
    label: category,
    links: componentDocs
      .filter((component) => component.category === category)
      .map((component) => ({
        href: component.route ?? '/components',
        label: component.name.replace('Glass ', ''),
      })),
  }))
  .filter((group) => group.links.length > 0);

categoryGroups.push({
  label: 'Expo interactions',
  links: nativeComponentDocs.map((component) => ({
    href: `/components/${component.id}`,
    label: getNativeComponentDoc(component.id)!.item.title.replace('Glass ', ''),
  })),
});

const mobileNavGroups: DocsMobileNavGroup[] = [
  {
    label: 'Documentation',
    links: [
      { href: '/docs', label: 'Getting Started' },
      { href: '/components', label: 'Components' },
      { href: '/mobile', label: 'React Native' },
      { href: PRO_ORIGIN, label: 'Templates' },
      { href: '/guides', label: 'Guides' },
      { href: GITHUB.repository, label: 'GitHub' },
    ],
  },
  ...categoryGroups,
];

export function DocsShell({ children, contribute, current, rail, toc = [] }: DocsShellProps) {
  const hasToc = toc.length > 0;
  const hasRail = !hasToc && Boolean(rail);

  return (
    <>
      <SiteNav className="docs-topbar" />
      <DocsMobileNav groups={mobileNavGroups} />

      <div className={`docs-layout${hasToc || hasRail ? '' : ' docs-layout--no-toc'}`}>
        <aside className="docs-sidebar" aria-label="Documentation">
          <div className="docs-sidebar-section">
            <p>Documentation</p>
            <Link aria-current={current === '/docs' ? 'page' : undefined} href="/docs">
              Getting Started
            </Link>
            <Link aria-current={current === '/components' ? 'page' : undefined} href="/components">
              All components
            </Link>
            <Link href="/mobile">React Native</Link>
            <a href={PRO_ORIGIN}>Templates</a>
            <Link aria-current={current.startsWith('/guides') ? 'page' : undefined} href="/guides">
              Guides
            </Link>
            <a href={GITHUB.repository}>GitHub</a>
            <a href="/r/registry.json">Registry JSON</a>
          </div>
          {categoryGroups.map((group) => (
            <div className="docs-sidebar-section" key={group.label}>
              <p>{group.label}</p>
              {group.links.map((link) => (
                <Link
                  aria-current={link.href === current ? 'page' : undefined}
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </aside>

        <main className="docs-main" id="main-content">
          {children}
        </main>

        {hasToc ? (
          <aside className="docs-toc" aria-label="On this page">
            <p>On this page</p>
            {toc.map((item) => (
              <a href={item.href} key={item.href}>
                {item.title}
              </a>
            ))}
            {contribute ? (
              <div className="docs-contribute">
                <p>Contribute</p>
                <a href={newIssueUrl('bug_report', `[Bug]: ${contribute.subject}: `)}>
                  Report an issue
                </a>
                <a href={newIssueUrl('component_request')}>Request a component</a>
                {contribute.sourcePath ? (
                  <a href={sourceUrl(contribute.sourcePath)}>View source</a>
                ) : null}
              </div>
            ) : null}
          </aside>
        ) : null}

        {hasRail && rail ? (
          <aside className="docs-toc docs-rail" aria-label={rail.label}>
            {rail.content}
          </aside>
        ) : null}
      </div>
      <SiteFooter />
    </>
  );
}
