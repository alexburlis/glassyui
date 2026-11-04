'use client';

import { useEffect } from 'react';
import { focusFragmentAfterNavigation } from '@/lib/fragment-focus';

/**
 * A link the router follows, such as Installation guide to /docs#installation, scrolls to its
 * fragment without moving the keyboard's place, so the next Tab would jump back to the link or the
 * top of the page. The browser moves it when it follows such a link itself; this does the same for
 * the router.
 */
export function FragmentNavigationFocus() {
  useEffect(() => {
    // The router takes a link's click on the document, so the window hears it afterwards.
    const onClick = (event: MouseEvent) => {
      if (!event.defaultPrevented) return;

      const link = event.target instanceof Element ? event.target.closest('a[href*="#"]') : null;

      if (link instanceof HTMLAnchorElement) focusFragmentAfterNavigation(link.href);
    };

    window.addEventListener('click', onClick);

    return () => window.removeEventListener('click', onClick);
  }, []);

  return null;
}
