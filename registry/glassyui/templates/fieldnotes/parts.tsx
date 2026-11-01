'use client';

import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { GlassAvatar } from '../../glass-avatar';
import { motionReduced } from '../../lib/liquid-motion';

// Spread onto a component rather than written as a prop: for Base UI projects the shadcn CLI
// rewrites a literal asChild prop into a render prop, which these Radix-based parts do not take.
export const slotted = { asChild: true };

/** A section's running head. */
export function Folio({ name, page }: { name: string; page: string }) {
  return (
    <div className="fieldnotes-folio">
      <span>{name}</span>
      <span className="fieldnotes-folio-page">{page}</span>
    </div>
  );
}

export type Tone = 'oxblood' | 'ochre' | 'sage' | 'plum' | 'ink';

/** Decorative: the name always sits beside it. */
export function Initials({
  initials,
  small,
  tone = 'oxblood',
}: {
  initials: string;
  small?: boolean;
  tone?: Tone;
}) {
  return (
    <GlassAvatar
      aria-hidden
      className="fieldnotes-avatar"
      data-tone={tone}
      fallback={initials}
      size={small ? 'sm' : 'md'}
    />
  );
}

export function PullQuote({
  initials,
  large,
  name,
  quote,
  role,
  tone,
}: {
  initials: string;
  large?: boolean;
  name: string;
  quote: string;
  role: string;
  tone: Tone;
}) {
  return (
    <figure
      className={clsx('fieldnotes-pullquote', large && 'fieldnotes-pullquote-large')}
      data-reveal="rise"
    >
      <span aria-hidden className="fieldnotes-pullquote-mark">
        “
      </span>
      <blockquote>
        <p>{quote}</p>
      </blockquote>
      <figcaption>
        <Initials initials={initials} tone={tone} />
        <span>
          <b>{name}</b>
          {role}
        </span>
      </figcaption>
    </figure>
  );
}

const format = (value: number, decimals: number) =>
  value.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/**
 * A number that counts up from zero as it scrolls into view. It starts counting only if it was
 * below the fold, so a number already on screen never drops back, and it stays put under reduced
 * motion. Assistive technology reads the final value.
 */
export function Count({ decimals = 0, to }: { decimals?: number; to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(to);

  useEffect(() => {
    const element = ref.current;

    if (!element || !('IntersectionObserver' in window) || motionReduced()) return;

    let frame = 0;

    const count = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        count.disconnect();
        const start = performance.now();

        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / 1200);

          setShown(to * (1 - (1 - progress) ** 3));

          if (progress < 1) frame = requestAnimationFrame(step);
        };

        frame = requestAnimationFrame(step);
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.15 },
    );

    const arm = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        arm.disconnect();

        if (entry.boundingClientRect.top < window.innerHeight) return;
        setShown(0);
        count.observe(element);
      },
      { rootMargin: '0px 0px 45% 0px' },
    );

    arm.observe(element);

    return () => {
      arm.disconnect();
      count.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [to]);

  return (
    <>
      <span ref={ref} aria-hidden>
        {format(shown, decimals)}
      </span>
      <span className="fieldnotes-sr-only">{format(to, decimals)}</span>
    </>
  );
}
