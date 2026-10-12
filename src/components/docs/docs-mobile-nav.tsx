'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type DocsMobileNavGroup = {
  label: string;
  links: Array<{
    href: string;
    label: string;
  }>;
};

type DocsMobileNavProps = {
  groups: DocsMobileNavGroup[];
};

export function DocsMobileNav({ groups }: DocsMobileNavProps) {
  const pathname = usePathname();

  const currentLink = groups.flatMap((group) => group.links).find((link) => link.href === pathname);

  return (
    <details className="docs-mobile-nav">
      <summary>
        Browse docs
        <span>{currentLink?.label ?? 'Getting Started'}</span>
      </summary>
      <nav aria-label="Mobile documentation navigation">
        {groups.map((group) => (
          <div key={group.label}>
            <p>{group.label}</p>
            {group.links.map((link) => (
              <Link
                aria-current={link.href === pathname ? 'page' : undefined}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </details>
  );
}
