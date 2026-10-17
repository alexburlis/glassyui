'use client';

import { useEffect, useState } from 'react';

type TocItem = { href: string; title: string };

/** The section a reader is in sits this far below the top of the window, under the header. */
const READING_LINE = 140;

/** The table of contents, marking the section the reader has scrolled to. */
export function DocsTocLinks({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | undefined>(items[0]?.href);

  useEffect(() => {
    const sections = items
      .map((item) => document.querySelector<HTMLElement>(item.href))
      .filter((section): section is HTMLElement => section !== null);

    if (sections.length === 0) return;
    let frame = 0;

    const update = () => {
      frame = 0;

      const atEnd =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;

      let current = sections[0];

      for (const section of sections) {
        if (section.getBoundingClientRect().top <= READING_LINE) current = section;
      }

      setActive(`#${(atEnd ? sections[sections.length - 1] : current).id}`);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [items]);

  return (
    <div className="docs-toc-links">
      {items.map((item) => (
        <a
          aria-current={item.href === active ? 'location' : undefined}
          href={item.href}
          key={item.href}
        >
          {item.title}
        </a>
      ))}
    </div>
  );
}
