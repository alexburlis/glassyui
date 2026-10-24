import type { ReactNode } from 'react';
import { GlassScrollArea } from '@/components/liquid/scroll-area';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteNav } from '@/components/site/site-nav';
import { PRO_ORIGIN, GITHUB, newIssueUrl, sourceUrl } from '@/lib/site-links';
import { nativeComponentDocs, getNativeComponentDoc } from '@/lib/native-component-docs';
import { componentCategories, componentDocs } from './component-docs-data';
import { DocsMobileNav, DocsNavLink, type DocsMobileNavGroup } from './docs-mobile-nav';
import { DocsSidebarCurrent } from './docs-sidebar-current';
import { DocsTocLinks } from './docs-toc-links';

type DocsShellProps = {
  children: ReactNode;
  /** Route of the page, marked as current in the sidebar. */
  current: string;
  /** Names the page in the Contribute block under the table of contents. */
  contribute?: { sourcePath?: string; subject: string };
  /**
   * Fills the right column on a page without a table of contents. With one, it sits under the
   * table of contents and stays in view with it from 1280px wide, where the article still gets its
   * full measure; below that the page shows its own copies of both.
   */
  rail?: { content: ReactNode; label: string };
  toc?: Array<{ href: string; title: string }>;
  /** Names the table of contents. */
  tocTitle?: string;
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

const documentationGroup: DocsMobileNavGroup = {
  label: 'Documentation',
  links: [
    { href: '/docs', label: 'Getting Started' },
    { href: '/components', label: 'All components' },
    { href: '/mobile', label: 'React Native' },
    { href: '/guides', label: 'Guides' },
    { href: '/blog', label: 'Blog' },
    { href: PRO_ORIGIN, label: 'Templates', external: true },
    { href: GITHUB.repository, label: 'GitHub', external: true },
  ],
};

const sidebarGroups: DocsMobileNavGroup[] = [
  {
    ...documentationGroup,
    links: [...documentationGroup.links, { href: '/r/registry.json', label: 'Registry JSON' }],
  },
  ...categoryGroups,
];

// The menu's summary names the current page, so the gallery reads as Components there.
const mobileNavGroups: DocsMobileNavGroup[] = [
  {
    ...documentationGroup,
    links: documentationGroup.links.map((link) =>
      link.href === '/components' ? { ...link, label: 'Components' } : link,
    ),
  },
  ...categoryGroups,
];

/** The sidebar marks each guide or article's section current. */
function isCurrent(href: string, current: string) {
  return href === '/guides' || href === '/blog'
    ? current === href || current.startsWith(`${href}/`)
    : href === current;
}

export function DocsShell({
  children,
  contribute,
  current,
  rail,
  toc = [],
  tocTitle = 'On this page',
}: DocsShellProps) {
  const hasToc = toc.length > 0;
  const hasRail = Boolean(rail);

  // A table of contents with a rail stacks the two in the right column; a page with neither has none.
  const layoutModifier =
    hasToc && hasRail ? ' docs-layout--stack' : hasToc || hasRail ? '' : ' docs-layout--no-toc';

  const contributeLinks = contribute ? (
    <div className="docs-contribute">
      <p>Contribute</p>
      <a href={newIssueUrl('bug_report', `[Bug]: ${contribute.subject}: `)}>Report an issue</a>
      <a href={newIssueUrl('component_request')}>Request a component</a>
      {contribute.sourcePath ? <a href={sourceUrl(contribute.sourcePath)}>View source</a> : null}
    </div>
  ) : null;

  return (
    <>
      <SiteNav className="docs-topbar" />
      <DocsMobileNav groups={mobileNavGroups} />

      <div className={`docs-layout${layoutModifier}`}>
        <aside className="docs-sidebar" data-analytics-source="sidebar" aria-label="Documentation">
          <GlassScrollArea className="docs-sidebar-scroll">
            <div className="docs-sidebar-groups">
              <DocsSidebarCurrent current={current} />
              {sidebarGroups.map((group) => (
                <div className="docs-sidebar-section" key={group.label}>
                  <p className="docs-sidebar-label">{group.label}</p>
                  <ul role="list">
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <DocsNavLink current={isCurrent(link.href, current)} link={link} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </GlassScrollArea>
        </aside>

        <main className="docs-main" id="main-content">
          {children}
        </main>

        {hasToc && rail ? (
          // The rail's own links keep their colours: only the table of contents is .docs-toc.
          <div className="docs-toc-stack">
            <nav className="docs-toc" aria-label={tocTitle}>
              <p>{tocTitle}</p>
              <DocsTocLinks items={toc} />
              {contributeLinks}
            </nav>
            <aside className="docs-toc-rail" aria-label={rail.label}>
              {rail.content}
            </aside>
          </div>
        ) : hasToc ? (
          <aside className="docs-toc" aria-label={tocTitle}>
            <p>{tocTitle}</p>
            <DocsTocLinks items={toc} />
            {contributeLinks}
          </aside>
        ) : hasRail && rail ? (
          <aside className="docs-toc docs-rail" aria-label={rail.label}>
            {rail.content}
          </aside>
        ) : null}
      </div>
      <SiteFooter />
    </>
  );
}
