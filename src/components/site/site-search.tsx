'use client';

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
  GlassKbd,
  GlassKbdGroup,
  usePreferences,
} from '@/components/liquid';
import { PRO_ORIGIN, REPOSITORY } from '@/lib/site-links';
import { INSTALL_COMMAND } from './install-command';
import { crossfadeTheme } from '@/lib/crossfade-theme';

type Entry = { category?: string; description: string; href: string; title: string };

type SearchIndex = { components: Entry[]; guides: Entry[] };

/** Opens the search from anywhere, such as the desk's menu bar. */
export const OPEN_SEARCH_EVENT = 'glassy:open-search';

const PAGES: Entry[] = [
  {
    description: 'Set up the registry and add a component',
    href: '/docs',
    title: 'Getting started',
  },
  { description: 'Every component, live', href: '/components', title: 'All components' },
  { description: 'Complete sites in Glassy UI Pro', href: PRO_ORIGIN, title: 'Templates' },
  { description: 'Step-by-step tutorials', href: '/guides', title: 'Guides' },
];

// How long the search says it copied before it closes.
const COPIED_MS = 700;

/**
 * How well one item answers the query, from 0 (hide it) to 1. Titles count most: the whole title,
 * then the start of a word in it, then anywhere in it; the description and category only count when
 * a word in them begins with what was typed. Every word of the query has to land.
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

// The shortcut reads ⌘K on systems with a Command key and Ctrl K elsewhere. The server has no device to ask,
// so it renders ⌘ and a browser on another system corrects it once it hydrates.
const subscribeToNothing = () => () => {};

const usesCommandKey = () => /Mac|iPhone|iPad/.test(navigator.userAgent);

const assumeCommandKey = () => true;

const LOAD_FAILED = 'The component list did not load. Close the search and open it again to retry.';

const COPY_REFUSED = 'The browser would not copy. Select the command on the home page.';

/**
 * What the search tells a screen reader as the list narrows. It stays mounted while the search is
 * open, so its changes are announced; a line that appears already written would not be.
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
 * The site's search, built from its own Command component. It opens with ⌘K (Ctrl K elsewhere),
 * lists every component, guide and page, and can flip the theme. It has no single-key shortcut,
 * which WCAG 2.1.4 would require a way to turn off.
 */
export function SiteSearch() {
  const router = useRouter();
  const { preferences, setPreferences } = usePreferences();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'refused'>('idle');
  const [wasOpen, setWasOpen] = useState(false);
  const mac = useSyncExternalStore(subscribeToNothing, usesCommandKey, assumeCommandKey);
  const requested = useRef(false);

  // Each opening starts fresh, and what the copy item said stays put while the search closes.
  if (open !== wasOpen) {
    setWasOpen(open);

    if (open) setCopy('idle');
  }

  // The list is a static file, fetched the first time anyone reaches for the search.
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
        // Say so, and let the next opening try again.
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
    if (open) load();
  }, [load, open]);

  // The item says it copied, then the search closes. Opening it again first cancels the close.
  useEffect(() => {
    if (copy !== 'copied') return;

    const timer = window.setTimeout(() => setOpen(false), COPIED_MS);

    return () => window.clearTimeout(timer);
  }, [copy]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  // If the browser refuses, the search stays open and says so.
  const copyInstall = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopy('copied');
    } catch {
      setCopy('refused');
    }
  };

  const light = preferences.theme === 'light';

  // Said outside the dialog, which closes a moment after the copy: a region inside it would go
  // with it before it was read.
  const announcement =
    copy === 'copied'
      ? 'Copied the install command to the clipboard.'
      : copy === 'refused'
        ? COPY_REFUSED
        : '';

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
      <span className="lg-visually-hidden" role="status">
        {announcement}
      </span>
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
              </>
            ) : null}
            <GlassCommandGroup heading="Pages">{entries('Page', PAGES)}</GlassCommandGroup>
            <GlassCommandSeparator />
            <GlassCommandGroup heading="Actions">
              <GlassCommandItem
                keywords={['appearance', 'dark', 'light', 'mode']}
                onSelect={() => {
                  setOpen(false);
                  crossfadeTheme(() => setPreferences({ theme: light ? 'dark' : 'light' }));
                }}
                value="Switch appearance action"
              >
                {light ? 'Switch to dark' : 'Switch to light'}
              </GlassCommandItem>
              <GlassCommandItem
                keywords={['install', 'shadcn', 'copy', 'command']}
                onSelect={copyInstall}
                value="Copy the install command action"
              >
                {copy === 'copied'
                  ? 'Copied to the clipboard'
                  : copy === 'refused'
                    ? COPY_REFUSED
                    : 'Copy the install command'}
              </GlassCommandItem>
              <GlassCommandItem
                keywords={['source', 'repository', 'code']}
                onSelect={() => {
                  setOpen(false);
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
