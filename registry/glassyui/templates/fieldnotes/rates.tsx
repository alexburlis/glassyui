'use client';

import { useEffect, useRef, useState } from 'react';
import { GlassButton } from '../../glass-button';
import { GlassPanel } from '../../glass-panel';
import { GlassSegmentedControl, GlassSegmentedControlItem } from '../../glass-segmented-control';
import { motionReduced } from '../../lib/liquid-motion';
import { Stamp } from './icons';
import { Folio, slotted } from './parts';

type Billing = 'monthly' | 'yearly';

const PLANS = [
  {
    name: 'Reader',
    monthly: 0,
    yearly: 0,
    per: { monthly: 'free, always', yearly: 'free, always' },
    audience: 'For stakeholders who read and listen',
    action: 'Join as a reader',
  },
  {
    name: 'Researcher',
    monthly: 18,
    yearly: 15,
    per: { monthly: 'per editor a month', yearly: 'per editor a month, billed yearly' },
    audience: 'For people who run and tag interviews',
    action: 'Start free',
  },
  {
    name: 'Team',
    monthly: 32,
    yearly: 27,
    per: { monthly: 'per editor a month', yearly: 'per editor a month, billed yearly' },
    audience: 'For teams who share one taxonomy',
    action: 'Talk to us',
  },
];

// An empty cell is a dash on screen and its reason, "Not included" unless the row says otherwise,
// to assistive technology.
const FEATURES: readonly { name: string; cells: string[]; absent?: string }[] = [
  { name: 'Interviews', cells: ['Read anything shared', 'Unlimited', 'Unlimited'] },
  { name: 'Transcription', cells: ['', '20 hours a month', '60 hours a month per editor'] },
  {
    name: 'Tags and patterns',
    cells: ['View', 'Tag, search and confirm', 'Plus a shared taxonomy'],
  },
  { name: 'Insight pages', cells: ['Read and comment', 'Publish', 'Publish with review'] },
  { name: 'Readers', cells: ['', 'Unlimited, free', 'Unlimited, free'], absent: 'Not applicable' },
  { name: 'Redaction', cells: ['', 'Names and numbers', 'Custom rules per study'] },
  {
    name: 'Retention',
    cells: ['', 'Delete recordings after a set time', 'Per-study schedules and legal hold'],
  },
  { name: 'Single sign-on', cells: ['', '', 'Included'] },
  { name: 'Support', cells: ['Help centre', 'Email, next working day', 'A named person'] },
];

/**
 * Rates: three plans in a table with the recommended one under a pane of glass. The prices count
 * over to yearly billing, and on a phone one plan shows at a time beside the features.
 */
export function Rates({ onStartFree }: { onStartFree: () => void }) {
  const [billing, setBilling] = useState<Billing>('monthly');
  const [plan, setPlan] = useState('1');
  const [prices, setPrices] = useState(() => PLANS.map((entry) => entry.monthly));
  const frame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const changeBilling = (value: string) => {
    const next: Billing = value === 'yearly' ? 'yearly' : 'monthly';
    const targets = PLANS.map((entry) => entry[next]);
    const from = prices;

    setBilling(next);
    cancelAnimationFrame(frame.current);

    if (motionReduced()) {
      setPrices(targets);

      return;
    }

    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / 460);
      const eased = 1 - (1 - progress) ** 3;

      setPrices(from.map((price, index) => Math.round(price + (targets[index] - price) * eased)));

      if (progress < 1) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
  };

  return (
    <section
      aria-labelledby="fieldnotes-rates-title"
      className="fieldnotes-section fieldnotes-rates"
      id="rates"
    >
      <div className="fieldnotes-wrap">
        <Folio name="Rates" page="11" />
        <div className="fieldnotes-grid fieldnotes-rates-head">
          <h2 className="fieldnotes-h2" data-reveal="focus" id="fieldnotes-rates-title">
            Subscription <em>rates</em>.
          </h2>
          <div className="fieldnotes-rates-side">
            <p className="fieldnotes-dek">
              Readers are always free. You pay for the people who tag.
            </p>
            <GlassSegmentedControl
              aria-label="Billing period"
              className="fieldnotes-segmented"
              value={billing}
              onValueChange={changeBilling}
            >
              <GlassSegmentedControlItem value="monthly">Monthly</GlassSegmentedControlItem>
              <GlassSegmentedControlItem value="yearly">Yearly</GlassSegmentedControlItem>
            </GlassSegmentedControl>
            <p>Yearly billing gives you two months free.</p>
          </div>
        </div>
        <GlassSegmentedControl
          aria-label="Show plan"
          className="fieldnotes-segmented fieldnotes-rates-plans"
          value={plan}
          onValueChange={setPlan}
        >
          {PLANS.map((entry, index) => (
            <GlassSegmentedControlItem key={entry.name} value={String(index)}>
              {entry.name}
            </GlassSegmentedControlItem>
          ))}
        </GlassSegmentedControl>
        <div
          aria-label="Plans and prices"
          className="fieldnotes-pricing"
          data-show={plan}
          role="table"
        >
          <GlassPanel
            aria-hidden
            className="fieldnotes-pane fieldnotes-pricing-glass"
            lens
            variant="card"
          />
          <Stamp
            centre="★"
            className="fieldnotes-pricing-stamp"
            id="fieldnotes-pricing-stamp"
            ring="MOST TEAMS START HERE ·"
          />
          <div className="fieldnotes-pricing-row fieldnotes-pricing-head" role="row">
            <span role="columnheader">
              <span className="fieldnotes-sr-only">Feature</span>
            </span>
            {PLANS.map((entry, index) => (
              <div key={entry.name} data-column={index} role="columnheader">
                <p className="fieldnotes-pricing-plan">{entry.name}</p>
                <p className="fieldnotes-pricing-price">
                  <span className="fieldnotes-pricing-amount">${prices[index]}</span>
                  <span className="fieldnotes-pricing-per">{entry.per[billing]}</span>
                </p>
                <span className="fieldnotes-pricing-for">{entry.audience}</span>
              </div>
            ))}
          </div>
          {FEATURES.map((feature) => (
            <div key={feature.name} className="fieldnotes-pricing-row" role="row">
              <span role="rowheader">{feature.name}</span>
              {feature.cells.map((cell, index) => (
                <span
                  key={index}
                  data-absent={cell ? undefined : ''}
                  data-column={index}
                  role="cell"
                >
                  {cell || (
                    <>
                      <span aria-hidden>—</span>
                      <span className="fieldnotes-sr-only">{feature.absent ?? 'Not included'}</span>
                    </>
                  )}
                </span>
              ))}
            </div>
          ))}
          <div className="fieldnotes-pricing-row fieldnotes-pricing-foot" role="row">
            <span role="cell">
              <span className="fieldnotes-sr-only">Choose a plan</span>
            </span>
            <span data-column={0} role="cell">
              <GlassButton {...slotted} className="fieldnotes-button-md">
                <a href="#start" onClick={onStartFree}>
                  {PLANS[0].action}
                </a>
              </GlassButton>
            </span>
            <span data-column={1} role="cell">
              <GlassButton {...slotted} className="fieldnotes-button-md" variant="prominent">
                <a href="#start" onClick={onStartFree}>
                  {PLANS[1].action}
                </a>
              </GlassButton>
            </span>
            <span data-column={2} role="cell">
              <GlassButton {...slotted} className="fieldnotes-button-md">
                <a href="mailto:hello@fieldnotes.example">{PLANS[2].action}</a>
              </GlassButton>
            </span>
          </div>
        </div>
        <p className="fieldnotes-rates-note">
          Prices exclude VAT. Billed in US dollars, euros or pounds.
        </p>
      </div>
    </section>
  );
}
