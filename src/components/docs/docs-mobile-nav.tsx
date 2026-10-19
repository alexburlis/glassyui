'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';

type DocsNavLinkData = {
  href: string;
  label: string;
  /** Leaves the docs: another site, or the repository. */
  external?: boolean;
};

export type DocsMobileNavGroup = {
  label: string;
  links: DocsNavLinkData[];
};

type DocsMobileNavProps = {
  groups: DocsMobileNavGroup[];
};

/** One link in the docs sidebar or the mobile menu, marked when it is the current page. */
export function DocsNavLink({ current, link }: { current: boolean; link: DocsNavLinkData }) {
  if (link.external) {
    return (
      <a className="docs-nav-link" href={link.href}>
        {link.label}
        <svg aria-hidden="true" className="docs-nav-external" viewBox="0 0 10 10">
          <path
            d="M3 2h5v5M8 2 2.5 7.5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.25"
          />
        </svg>
      </a>
    );
  }

  return (
    <Link aria-current={current ? 'page' : undefined} className="docs-nav-link" href={link.href}>
      {link.label}
    </Link>
  );
}

export function DocsMobileNav({ groups }: DocsMobileNavProps) {
  const pathname = usePathname();
  const list = useRef<HTMLElement>(null);

  const currentLink = groups
    .flatMap((group) => group.links)
    .find(
      (link) => link.href === pathname || (link.href === '/blog' && pathname.startsWith('/blog/')),
    );

  return (
    <details
      className="docs-mobile-nav"
      onToggle={(event) => {
        // The menu scrolls on its own, so open it at the current page rather than at the top.
        if (!event.currentTarget.open || !list.current) return;
        const item = list.current.querySelector<HTMLElement>('[aria-current="page"]');

        if (item) {
          list.current.scrollTop =
            item.offsetTop - (list.current.clientHeight - item.offsetHeight) / 2;
        }
      }}
    >
      <summary>
        Browse docs
        <span>{currentLink?.label ?? 'Getting Started'}</span>
      </summary>
      <nav aria-label="Mobile documentation navigation" ref={list}>
        {groups.map((group) => (
          <div className="docs-sidebar-section" key={group.label}>
            <p className="docs-sidebar-label">{group.label}</p>
            <ul role="list">
              {group.links.map((link) => (
                <li key={link.href}>
                  <DocsNavLink current={link === currentLink} link={link} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </details>
  );
}
