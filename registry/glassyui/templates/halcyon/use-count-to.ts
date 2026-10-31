'use client';

import { useEffect, useRef, useState } from 'react';
import { motionReduced } from '../../lib/liquid-motion';

/**
 * A figure that counts to `target` with an ease-out, from `from` when given or else from the
 * figure it shows. Reduced motion sets it at once.
 */
export function useCountTo(target: number, duration: number, from?: number, delay = 0) {
  const [value, setValue] = useState(target);
  const shown = useRef(target);

  useEffect(() => {
    const begin = from ?? shown.current;
    let frame = 0;

    const step = (start: number) => (now: number) => {
      const progress =
        motionReduced() || begin === target
          ? 1
          : Math.min(1, Math.max(0, (now - start) / duration));

      const next = Math.round(begin + (target - begin) * (1 - Math.pow(1 - progress, 3)));

      shown.current = next;
      setValue(next);

      if (progress < 1) frame = requestAnimationFrame(step(start));
    };

    frame = requestAnimationFrame(step(performance.now() + delay));

    return () => cancelAnimationFrame(frame);
  }, [delay, duration, from, target]);

  return value;
}
