'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GlassButton, GlassHeader, usePreferences } from '@/components/liquid';
import { PRO_ORIGIN, GITHUB } from '@/lib/site-links';
import { BrandMark } from './app-icons';
import { GithubMark } from './github-mark';
import { SiteSearch } from './site-search';
import { crossfadeTheme } from '@/lib/crossfade-theme';

const NAV_LINKS = [
  { href: '/components', label: 'Components' },
  { href: '/mobile', label: 'Mobile' },
  { href: '/docs', label: 'Docs' },
  // Templates are Glassy UI Pro's.
  { href: PRO_ORIGIN, label: 'Templates' },
  { href: '/guides', label: 'Guides' },
];

function NavigationLinks({ pathname }: { pathname: string }) {
  return (
    <>
      {NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          aria-current={isCurrentSection(pathname, link.href) ? 'page' : undefined}
          href={link.href}
        >
          {link.label}
        </Link>
      ))}
      <a className="site-nav-github" href={GITHUB.repository}>
        <GithubMark className="site-nav-github-mark" />
        GitHub
      </a>
    </>
  );
}

function isCurrentSection(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ThemeToggle({ className }: { className?: string }) {
  const { setPreferences } = usePreferences();

  // The document attribute is already right before hydration, so it decides the next theme.
  const toggleTheme = () => {
    const light = document.documentElement.getAttribute('data-lg-theme') === 'light';

    crossfadeTheme(() => setPreferences({ theme: light ? 'dark' : 'light' }));
  };

  return (
    <GlassButton
      aria-label="Change appearance"
      className={clsx('site-icon-button', className)}
      onClick={toggleTheme}
      size="sm"
      variant="ghost"
    >
      <span aria-hidden className="site-theme-icons">
        <svg aria-hidden className="site-theme-icon site-theme-icon--sun" viewBox="0 0 20 20">
          <circle cx="10" cy="10" fill="currentColor" r="3.6" />
          <path
            d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.6"
          />
        </svg>
        <svg aria-hidden className="site-theme-icon site-theme-icon--moon" viewBox="0 0 20 20">
          <path d="M16.6 12.6A7 7 0 0 1 7.4 3.4a7 7 0 1 0 9.2 9.2Z" fill="currentColor" />
        </svg>
      </span>
    </GlassButton>
  );
}

export function SiteNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <GlassHeader
      className={clsx('site-nav', className)}
      condenseOnScroll
      brand={
        <Link className="site-brand" href="/">
          <BrandMark className="site-brand-mark" />
          <span className="site-brand-name">Glassy UI</span>
        </Link>
      }
      actions={
        <>
          <SiteSearch />
          <ThemeToggle />
        </>
      }
    >
      <NavigationLinks pathname={pathname} />
    </GlassHeader>
  );
}
