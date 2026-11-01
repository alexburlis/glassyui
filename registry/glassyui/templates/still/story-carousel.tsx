'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { motionReduced } from '../../lib/liquid-motion';
import { GlassBadge } from '../../glass-badge';
import { GlassButton } from '../../glass-button';
import { GlassSurface } from '../../glass-surface';
import { LeftIcon, RightIcon } from './icons';
import {
  HutArt,
  LibraryArt,
  LighthouseArt,
  MapArt,
  MarketArt,
  ObservatoryArt,
  OrchardArt,
  RiverArt,
} from './story-art';

type Story = { title: string; minutes: number; shelf: string; reader: string; art: ReactNode };

const STORIES: Story[] = [
  {
    title: 'The lighthouse keeper’s last winter',
    minutes: 34,
    shelf: 'Coastal',
    reader: 'Ines Varga',
    art: <LighthouseArt />,
  },
  {
    title: 'A slow boat up the river',
    minutes: 29,
    shelf: 'Travel',
    reader: 'Tomas Hale',
    art: <RiverArt />,
  },
  {
    title: 'The library after closing',
    minutes: 31,
    shelf: 'Quiet places',
    reader: 'Ruth Okafor',
    art: <LibraryArt />,
  },
  {
    title: 'Night market, after rain',
    minutes: 26,
    shelf: 'City',
    reader: 'Kenji Arai',
    art: <MarketArt />,
  },
  {
    title: 'The orchard in October',
    minutes: 38,
    shelf: 'Seasons',
    reader: 'Margit Sole',
    art: <OrchardArt />,
  },
  {
    title: 'Letters from a mountain hut',
    minutes: 33,
    shelf: 'Mountains',
    reader: 'Ada Brennan',
    art: <HutArt />,
  },
  {
    title: 'The cartographer’s quiet year',
    minutes: 41,
    shelf: 'Fiction',
    reader: 'Felix Mora',
    art: <MapArt />,
  },
  {
    title: 'Snow on the observatory',
    minutes: 27,
    shelf: 'Winter',
    reader: 'Noor Haddad',
    art: <ObservatoryArt />,
  },
];

type View = { first: number; last: number; atStart: boolean; atEnd: boolean };

/**
 * The sleep stories as a row that snaps to each card, running to the screen's edge while its
 * first card lines up with the page. The buttons and the arrow keys move one story; Home and End
 * go to either end. The count says which stories are in view.
 */
export function StoryCarousel() {
  const trackRef = useRef<HTMLUListElement>(null);
  const [view, setView] = useState<View>({ first: 1, last: 4, atStart: true, atEnd: false });

  // The distance from one card to the next.
  const stride = () => {
    const [first, second] = trackRef.current?.querySelectorAll('li') ?? [];

    if (!first || !second) return trackRef.current?.clientWidth ?? 0;

    return second.offsetLeft - first.offsetLeft;
  };

  useEffect(() => {
    const track = trackRef.current;

    if (!track) return;

    let frame = 0;

    const update = () => {
      frame = 0;

      const step = stride();
      const style = getComputedStyle(track);
      const gap = Number.parseFloat(style.columnGap) || 0;
      const inner = track.clientWidth - Number.parseFloat(style.paddingLeft);
      const end = track.scrollWidth - track.clientWidth;
      const x = track.scrollLeft;
      const visible = Math.max(1, Math.floor((inner + gap) / step + 0.04));
      let first = Math.min(STORIES.length, Math.round(x / step) + 1);

      if (x >= end - 2) first = Math.max(1, STORIES.length - visible + 1);

      const next = {
        first,
        last: Math.min(STORIES.length, first + visible - 1),
        atStart: x <= 2,
        atEnd: x >= end - 2,
      };

      setView((shown) =>
        shown.first === next.first &&
        shown.last === next.last &&
        shown.atStart === next.atStart &&
        shown.atEnd === next.atEnd
          ? shown
          : next,
      );
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    const observer = new ResizeObserver(schedule);

    observer.observe(track);
    track.addEventListener('scroll', schedule, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      track.removeEventListener('scroll', schedule);
    };
  }, []);

  const behavior = (): ScrollBehavior => (motionReduced() ? 'auto' : 'smooth');

  const go = (direction: 1 | -1) => {
    trackRef.current?.scrollBy({ left: direction * stride(), behavior: behavior() });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const track = trackRef.current;

    if (!track) return;

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      go(event.key === 'ArrowRight' ? 1 : -1);
    } else if (event.target === track && (event.key === 'Home' || event.key === 'End')) {
      event.preventDefault();
      track.scrollTo({ left: event.key === 'Home' ? 0 : track.scrollWidth, behavior: behavior() });
    }
  };

  const count =
    view.first === view.last
      ? `${view.first} of ${STORIES.length}`
      : `${view.first}–${view.last} of ${STORIES.length}`;

  return (
    <section
      aria-labelledby="still-stories-title"
      className="still-section still-stories"
      id="stories"
    >
      <div
        aria-labelledby="still-stories-title"
        aria-roledescription="carousel"
        className="still-carousel"
        role="region"
        onKeyDown={onKeyDown}
      >
        <div className="still-wrap still-carousel-bar">
          <header className="still-rise">
            <p className="still-eyebrow">Sleep stories</p>
            <h2 className="still-h2" id="still-stories-title">
              Stories that don’t go anywhere.
            </h2>
            <p className="still-lede">
              Unhurried tales read by voices chosen for how little they rush. Most listeners drift
              off before the middle. A new one arrives every Sunday.
            </p>
          </header>
          <div className="still-carousel-controls">
            <GlassButton
              aria-controls="still-story-track"
              aria-disabled={view.atStart}
              aria-label="Previous story"
              className="still-carousel-button still-button"
              lens={false}
              onClick={() => {
                if (!view.atStart) go(-1);
              }}
            >
              <LeftIcon />
            </GlassButton>
            <span aria-live="polite" className="still-carousel-count">
              {count}
            </span>
            <GlassButton
              aria-controls="still-story-track"
              aria-disabled={view.atEnd}
              aria-label="Next story"
              className="still-carousel-button still-button"
              lens={false}
              onClick={() => {
                if (!view.atEnd) go(1);
              }}
            >
              <RightIcon />
            </GlassButton>
          </div>
        </div>
        <ul
          ref={trackRef}
          aria-label="Sleep stories. Use the arrow keys to move through them."
          className="still-carousel-track"
          id="still-story-track"
          tabIndex={0}
        >
          {STORIES.map((story, index) => (
            <li key={story.title} className="still-carousel-item">
              <article aria-labelledby={`still-story-${index}`} className="still-story">
                {story.art}
                <GlassSurface className="still-story-meta still-pane" lens>
                  <div className="still-story-chips">
                    <GlassBadge>{story.minutes} min</GlassBadge>
                    {story.shelf}
                  </div>
                  <h3 id={`still-story-${index}`}>{story.title}</h3>
                  <p>Read by {story.reader}</p>
                </GlassSurface>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
