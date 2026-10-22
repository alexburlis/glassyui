'use client';

import { captureAction, captureSearchResult } from '@/lib/analytics/browser';

import { useCommandState } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  GlassCommand,
  GlassCommandDialog,
  GlassCommandEmpty,
  GlassCommandGroup,
  GlassCommandInput,
  GlassCommandItem,
  GlassCommandList,
  GlassCommandSeparator,
  GlassCommandShortcut,
} from '@/components/liquid/command';
import { GlassKbd, GlassKbdGroup } from '@/components/liquid/kbd';
import { usePreferences } from '@/components/liquid/provider';
import { PRO_ORIGIN, REPOSITORY } from '@/lib/site-links';
import { changeTheme } from '@/lib/change-theme';

type Entry = { category?: string; description: string; href: string; title: string };

type SearchIndex = { components: Entry[]; guides: Entry[]; articles: Entry[] };

/** Opens the search from anywhere, such as the desk's menu bar. */
export const OPEN_SEARCH_EVENT = 'glassy:open-search';

const PAGES: Entry[] = [
  {
    description: 'Set up your app and install a component',
    href: '/docs',
    title: 'Getting started',
  },
  { description: 'Every component, live', href: '/components', title: 'All components' },
  { description: 'Complete sites in Glassy UI Pro', href: PRO_ORIGIN, title: 'Templates' },
  { description: 'Step-by-step tutorials', href: '/guides', title: 'Guides' },
  { description: 'Liquid glass tutorials for web and mobile apps', href: '/blog', title: 'Blog' },
];

/**
 * Score from 0 (hidden) to 1. Every query token must match. Title matches rank
 * above keyword prefixes; the weakest title match still beats a keyword match.
 */
function score(value: string, search: string, keywords: string[] = []) {
  const title = value.toLowerCase();

  const tags = keywords
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/);

  const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) return 1;

  const words = title.split(/[^a-z0-9]+/);

  const one = (token: string): number => {
    if (title === token) return 1;

    if (title.startsWith(token)) return 0.95;

    if (words.some((word) => word.startsWith(token))) return 0.85;

    if (title.includes(token)) return 0.7;

    if (tags.some((tag) => tag.startsWith(token))) return 0.4;

    return 0;
  };

  const scores = tokens.map(one);

  return scores.includes(0) ? 0 : scores.reduce((total, next) => total + next, 0) / scores.length;
}

// Render ⌘ on the server, then choose the platform's modifier after hydration.
const subscribeToNothing = () => () => {};

const usesCommandKey = () => /Mac|iPhone|iPad/.test(navigator.userAgent);

const assumeCommandKey = () => true;

const LOAD_FAILED = 'The component list did not load. Close the search and open it again to retry.';

/**
 * Keep the live region mounted while search is open so result changes are announced.
 */
function SearchStatus({ failed }: { failed: boolean }) {
  const count = useCommandState((state) => state.filtered.count);
  const query = useCommandState((state) => state.search);

  const message = failed
    ? LOAD_FAILED
    : query.trim() === ''
      ? ''
      : count === 0
        ? 'No results.'
        : `${count} ${count === 1 ? 'result' : 'results'}.`;

  return (
    <p className="lg-visually-hidden" role="status">
      {message}
    </p>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden className="site-search-icon" viewBox="0 0 20 20">
      <circle cx="9" cy="9" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m13 13 3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

/**
 * Use a modifier-key shortcut so typing a single character cannot open search.
 */
export function SiteSearch() {
  const router = useRouter();
  const { preferences, setPreferences } = usePreferences();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const mac = useSyncExternalStore(subscribeToNothing, usesCommandKey, assumeCommandKey);
  const requested = useRef(false);

  // Fetch once on focus, hover or opening; failed requests may retry.
  const load = useCallback(() => {
    if (requested.current) return;

    requested.current = true;
    fetch('/search-index.json')
      .then((response) => {
        if (!response.ok) throw new Error(`The search index answered ${response.status}.`);

        return response.json();
      })
      .then((next: SearchIndex) => {
        setIndex(next);
        setFailed(false);
      })
      .catch(() => {
        requested.current = false;
        setFailed(true);
      });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    const onOpen = () => setOpen(true);

    document.addEventListener('keydown', onKeyDown);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      captureAction({ source: 'search', action: 'search_open', outcome: 'opened' });
      load();
    }
  }, [load, open]);

  const go = (href: string) => {
    captureSearchResult(href);
    setOpen(false);
    router.push(href);
  };

  const light = preferences.theme === 'light';

  const entries = (group: string, list: Entry[]) =>
    list.map((entry) => (
      <GlassCommandItem
        key={entry.href}
        keywords={[group, entry.category ?? '', entry.description]}
        onSelect={() => go(entry.href)}
        value={entry.title}
      >
        {entry.title}
        {entry.category ? <GlassCommandShortcut>{entry.category}</GlassCommandShortcut> : null}
      </GlassCommandItem>
    ));

  return (
    <>
      <button
        aria-label="Search"
        className="site-search"
        onClick={() => setOpen(true)}
        onFocus={load}
        onPointerEnter={load}
        type="button"
      >
        <SearchIcon />
        <span className="site-search-label">Search</span>
        <GlassKbdGroup aria-hidden className="site-search-keys">
          <GlassKbd>{mac ? '⌘' : 'Ctrl'}</GlassKbd>
          <GlassKbd>K</GlassKbd>
        </GlassKbdGroup>
      </button>
      <GlassCommandDialog onOpenChange={setOpen} open={open} title="Search Glassy UI">
        <GlassCommand filter={score} label="Search Glassy UI">
          <GlassCommandInput placeholder="Search components, guides and pages…" />
          <SearchStatus failed={failed && !index} />
          {failed && !index ? <p className="site-search-note">{LOAD_FAILED}</p> : null}
          <GlassCommandList>
            <GlassCommandEmpty>No results.</GlassCommandEmpty>
            {index ? (
              <>
                <GlassCommandGroup heading="Components">
                  {entries('Component', index.components)}
                </GlassCommandGroup>
                <GlassCommandGroup heading="Guides">
                  {entries('Guide', index.guides)}
                </GlassCommandGroup>
                <GlassCommandGroup heading="Blog">
                  {entries('Article', index.articles)}
                </GlassCommandGroup>
              </>
            ) : null}
            <GlassCommandGroup heading="Pages">{entries('Page', PAGES)}</GlassCommandGroup>
            <GlassCommandSeparator />
            <GlassCommandGroup heading="Actions">
              <GlassCommandItem
                keywords={['appearance', 'dark', 'light', 'mode']}
                onSelect={() => {
                  setOpen(false);
                  captureAction({
                    source: 'search',
                    action: 'theme',
                    outcome: 'selected',
                    choice: light ? 'dark' : 'light',
                  });
                  changeTheme(() => setPreferences({ theme: light ? 'dark' : 'light' }));
                }}
                value="Switch appearance action"
              >
                {light ? 'Switch to dark' : 'Switch to light'}
              </GlassCommandItem>
              <GlassCommandItem
                keywords={['install', 'shadcn', 'manual', 'command']}
                onSelect={() => go('/docs#installation')}
                value="Open installation guidance action"
              >
                Installation guide
              </GlassCommandItem>
              <GlassCommandItem
                keywords={['source', 'repository', 'code']}
                onSelect={() => {
                  setOpen(false);
                  captureSearchResult(REPOSITORY);
                  window.open(REPOSITORY, '_blank', 'noopener');
                }}
                value="Open GitHub action"
              >
                Open GitHub
              </GlassCommandItem>
            </GlassCommandGroup>
          </GlassCommandList>
          <div aria-hidden className="site-search-hints">
            <span>
              <GlassKbd>↑</GlassKbd>
              <GlassKbd>↓</GlassKbd> to move
            </span>
            <span>
              <GlassKbd>↵</GlassKbd> to open
            </span>
            <span>
              <GlassKbd>esc</GlassKbd> to close
            </span>
          </div>
        </GlassCommand>
      </GlassCommandDialog>
    </>
  );
}
