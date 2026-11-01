'use client';

import { useEffect, useRef, useState } from 'react';
import { motionReduced } from '../../lib/liquid-motion';
import { useCountTo } from './use-count-to';

type StatCounterProps = {
  /** The figure, or minutes when shown as hours and minutes. */
  count: number;
  /** Where the count starts when the figure scrolls into view. */
  from: number;
  /** What the figure measures; read first by screen readers. */
  label: string;
  /** What screen readers hear for the figure, such as "3 hours 50 minutes". */
  spoken: string;
  hoursAndMinutes?: boolean;
};

/**
 * A figure that counts up once, when it first scrolls into view. Figures already on screen,
 * and every figure under reduced motion, show their value from the start.
 */
export function StatCounter({ count, from, label, spoken, hoursAndMinutes }: StatCounterProps) {
  const figureRef = useRef<HTMLSpanElement>(null);
  const [stage, setStage] = useState<'shown' | 'waiting' | 'counting'>('shown');

  const value = useCountTo(
    stage === 'waiting' ? from : count,
    1400,
    stage === 'shown' ? undefined : from,
    120,
  );

  useEffect(() => {
    const figure = figureRef.current;

    if (!figure || motionReduced() || figure.getBoundingClientRect().top < window.innerHeight) {
      return;
    }

    setStage('waiting');

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        observer.disconnect();
        setStage('counting');
      },
      { threshold: 0.9 },
    );

    observer.observe(figure);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="halcyon-stat">
      <dt>{label}</dt>
      <dd>
        <span ref={figureRef} aria-hidden className="halcyon-stat-figure">
          {hoursAndMinutes ? (
            <>
              {Math.floor(value / 60)}
              <span className="halcyon-stat-unit">h</span>
              {String(value % 60).padStart(2, '0')}
              <span className="halcyon-stat-unit">min</span>
            </>
          ) : (
            value.toLocaleString('en-GB')
          )}
        </span>
        <span className="halcyon-sr-only">{spoken}</span>
      </dd>
    </div>
  );
}
