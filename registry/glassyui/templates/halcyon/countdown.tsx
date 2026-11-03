'use client';

import { useEffect, useRef, useState } from 'react';
import { GlassPanel } from '../../glass-panel';
import { motionReduced } from '../../lib/liquid-motion';

const UNITS = ['days', 'hours', 'minutes', 'seconds'] as const;

function partsUntil(target: number, now: number) {
  const seconds = Math.floor(Math.max(0, target - now) / 1000);

  return [
    Math.floor(seconds / 86400),
    Math.floor(seconds / 3600) % 24,
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ];
}

/**
 * One digit that rolls up to its next value. The roll plays only while the countdown is on
 * screen and motion is allowed; otherwise the digit changes in place.
 */
function Digit({ value, roll }: { value: string; roll: boolean }) {
  const [shown, setShown] = useState<{ current: string; previous: string | null; turn: number }>({
    current: value,
    previous: null,
    turn: 0,
  });

  if (shown.current !== value) {
    setShown({
      current: value,
      previous: roll ? shown.current : null,
      turn: shown.turn + 1,
    });
  }

  return (
    <span className="halcyon-countdown-slot">
      {shown.previous !== null ? (
        <span key={`out-${shown.turn}`} className="halcyon-countdown-out">
          {shown.previous}
        </span>
      ) : null}
      <span
        key={`in-${shown.turn}`}
        className={shown.previous !== null ? 'halcyon-countdown-in' : undefined}
      >
        {shown.current}
      </span>
    </span>
  );
}

/**
 * Days, hours, minutes and seconds until `target`, in the visitor's own time, on one slab of glass.
 * The time is read after the page loads, so a page built ahead of time never shows a stale count.
 */
export function Countdown({ target, labelledBy }: { target: Date; labelledBy: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState<number | null>(null);
  const [onScreen, setOnScreen] = useState(false);
  const time = target.getTime();

  useEffect(() => {
    let timer = 0;

    const tick = () => {
      const current = Date.now();

      setNow(current);

      // Each tick lands just after the second turns, so the digits change together.
      if (current < time) timer = window.setTimeout(tick, 1000 - (current % 1000) + 8);
    };

    tick();

    return () => window.clearTimeout(timer);
  }, [time]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) return;

    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));

    observer.observe(root);

    return () => observer.disconnect();
  }, []);

  const parts = now === null ? null : partsUntil(time, now);
  const roll = onScreen && !motionReduced();

  const summary =
    parts === null
      ? ''
      : now !== null && now >= time
        ? 'Invites are going out now.'
        : `${parts[0]} days, ${parts[1]} hours and ${parts[2]} minutes until invites begin.`;

  return (
    <GlassPanel
      ref={rootRef}
      aria-describedby="halcyon-countdown-summary"
      aria-labelledby={labelledBy}
      className="halcyon-pane halcyon-countdown"
      lens
      role="timer"
      variant="card"
    >
      {UNITS.map((unit, index) => {
        const digits = parts === null ? '––' : String(parts[index]).padStart(2, '0');

        return (
          <div key={unit} className="halcyon-countdown-unit">
            <span aria-hidden className="halcyon-countdown-value">
              {[...digits].map((digit, place) => (
                <Digit key={place} roll={roll} value={digit} />
              ))}
            </span>
            <span aria-hidden className="halcyon-countdown-label">
              {unit}
            </span>
          </div>
        );
      })}
      {/* Announced once a minute at most: the summary leaves the seconds out. */}
      <p className="halcyon-sr-only" id="halcyon-countdown-summary">
        {summary}
      </p>
    </GlassPanel>
  );
}
