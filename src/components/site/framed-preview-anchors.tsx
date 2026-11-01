'use client';

import { useEffect } from 'react';

/**
 * Keeps a template's in-page links scrolling only its own frame on the template's page. A fragment
 * link scrolls every scrolling ancestor of its target, so in the same-origin frame it would also
 * scroll the page around it. Opened full screen, the links behave natively.
 */
export function FramedPreviewAnchors() {
  useEffect(() => {
    if (window.self === window.top) return;

    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
      const id = link instanceof HTMLAnchorElement ? decodeURIComponent(link.hash.slice(1)) : '';
      const target = id ? document.getElementById(id) : null;

      if (!target) return;

      event.preventDefault();

      const root = document.documentElement;
      const padding = Number.parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;

      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - padding });

      // The navigation would have moved the keyboard's place to the target, so the next Tab goes
      // on from there. A target that cannot take focus, such as a section, takes it until it
      // loses it again.
      if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
        target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
      }

      target.focus({ preventScroll: true });
    };

    document.addEventListener('click', onClick);

    return () => document.removeEventListener('click', onClick);
  }, []);

  return null;
}
