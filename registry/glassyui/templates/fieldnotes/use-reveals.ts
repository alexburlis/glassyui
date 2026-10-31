'use client';

import { useEffect, type RefObject } from 'react';
import { motionReduced } from '../../lib/liquid-motion';

/**
 * Moves each [data-reveal] element under the root into place as it scrolls in. An element is
 * displaced only while it is still below the fold, so nothing on screen ever jumps back, and
 * without script or with reduced motion nothing is displaced at all. The stylesheet draws the
 * displaced state for data-reveal-state="armed" and the move for "in".
 */
export function useReveals(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;

    if (!root || !('IntersectionObserver' in window) || motionReduced()) return;

    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          reveal.unobserve(entry.target);
          entry.target.setAttribute('data-reveal-state', 'in');
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.15 },
    );

    const arm = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          arm.unobserve(entry.target);

          if (entry.boundingClientRect.top < window.innerHeight) continue;
          entry.target.setAttribute('data-reveal-state', 'armed');
          reveal.observe(entry.target);
        }
      },
      { rootMargin: '0px 0px 45% 0px' },
    );

    for (const element of root.querySelectorAll('[data-reveal]')) arm.observe(element);

    return () => {
      arm.disconnect();
      reveal.disconnect();
    };
  }, [rootRef]);
}
