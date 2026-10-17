'use client';

import { useLayoutEffect, useRef } from 'react';

/**
 * Brings the sidebar's current page into view inside the sidebar's own scroll area, so a page far
 * down the list does not open with its link hidden. The window itself never scrolls.
 */
export function DocsSidebarCurrent({ current }: { current: string }) {
  const marker = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const sidebar = marker.current?.closest<HTMLElement>('.docs-sidebar');
    const item = sidebar?.querySelector<HTMLElement>('[aria-current="page"]');

    if (!sidebar || !item) return;
    const frame = sidebar.getBoundingClientRect();
    const link = item.getBoundingClientRect();

    if (link.top >= frame.top + 24 && link.bottom <= frame.bottom - 24) return;
    sidebar.scrollTop += link.top - frame.top - (frame.height - link.height) / 2;
  }, [current]);

  return <span hidden ref={marker} />;
}
