'use client';

import { useEffect, useRef, useState } from 'react';
import { motionReduced } from '../../lib/liquid-motion';
import { GlassPanel } from '../../glass-panel';
import { GlassSegmentedControl, GlassSegmentedControlItem } from '../../glass-segmented-control';
import { CheckIcon } from './icons';
import { StoreMenu, type StoreLinks, type StorePlatform } from './store-menu';

type Period = 'yearly' | 'monthly';

const PLANS: Record<Period, { price: number; per: string; note: string }> = {
  yearly: {
    price: 39.99,
    per: 'a year, after your free week',
    note: 'That’s $3.33 a month, billed once a year.',
  },
  monthly: {
    price: 7.99,
    per: 'a month, after your free week',
    note: 'Billed monthly. Cancel whenever you like.',
  },
};

const INCLUDED = [
  'Every sound scene and sleep story, with a new story each Sunday',
  'Breathing sessions from one minute to twenty',
  'Downloads for nights without signal',
  'Up to five people in one household',
];

/** A price that counts to its new value when the billing period changes. */
function useCountedPrice(target: number) {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    const from = shownRef.current;

    if (from === target) return;

    const start = performance.now();
    let frame = requestAnimationFrame(tick);

    function tick(now: number) {
      const progress = motionReduced() ? 1 : Math.min(1, (now - start) / 620);
      const value = progress === 1 ? target : from + (target - from) * (1 - (1 - progress) ** 3);

      shownRef.current = value;
      setShown(value);

      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(frame);
  }, [target]);

  return shown;
}

export function PricingPlan({
  storeLinks,
  onDemo,
}: {
  storeLinks?: StoreLinks;
  onDemo: (platform: StorePlatform) => void;
}) {
  const [period, setPeriod] = useState<Period>('yearly');
  const plan = PLANS[period];
  const price = useCountedPrice(plan.price);

  return (
    <GlassPanel
      aria-labelledby="still-plan-title"
      className="still-plan still-pane still-rise"
      lens
      role="group"
      variant="card"
    >
      <div className="still-plan-top">
        <h3 id="still-plan-title">Everything in Still</h3>
        <GlassSegmentedControl
          aria-label="Billing period"
          className="still-period"
          value={period}
          onValueChange={(value) => setPeriod(value === 'monthly' ? 'monthly' : 'yearly')}
        >
          <GlassSegmentedControlItem value="yearly">Yearly</GlassSegmentedControlItem>
          <GlassSegmentedControlItem value="monthly">Monthly</GlassSegmentedControlItem>
        </GlassSegmentedControl>
      </div>
      <div aria-live="polite">
        <p className="still-price">
          <span className="still-price-figure">
            <span aria-hidden>${price.toFixed(2)}</span>
            <span className="still-sr-only">${plan.price.toFixed(2)}</span>
          </span>
          <span className="still-price-per">{plan.per}</span>
        </p>
        <p className="still-price-note">{plan.note}</p>
      </div>
      <ul className="still-plan-list">
        {INCLUDED.map((item) => (
          <li key={item}>
            <CheckIcon />
            {item}
          </li>
        ))}
      </ul>
      <div className="still-plan-action">
        <StoreMenu links={storeLinks} onDemo={onDemo} />
      </div>
      <p className="still-plan-fine">We’ll remind you two days before the week ends.</p>
    </GlassPanel>
  );
}
