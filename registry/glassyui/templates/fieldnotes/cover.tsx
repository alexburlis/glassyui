'use client';

import { useEffect, useRef } from 'react';
import { GlassBadge } from '../../glass-badge';
import { GlassButton } from '../../glass-button';
import { GlassPanel } from '../../glass-panel';
import { Icon, Stamp } from './icons';
import { Initials, slotted } from './parts';

/** The issue's sections: the cover's contents and the menu list them, with their numerals. */
export const CONTENTS = [
  { id: 'letter', numeral: 'I', title: 'The letter', menuTitle: 'The letter', page: '02' },
  { id: 'try', numeral: 'II', title: 'Tag a moment', menuTitle: 'Tag a moment', page: '05' },
  {
    id: 'chapters',
    numeral: 'III',
    title: 'Four chapters',
    menuTitle: 'Four chapters',
    page: '06',
  },
  { id: 'field', numeral: 'IV', title: 'From the field', menuTitle: 'From the field', page: '09' },
  { id: 'rates', numeral: 'V', title: 'Rates', menuTitle: 'Rates', page: '11' },
  {
    id: 'letters',
    numeral: 'VI',
    title: 'Letters',
    menuTitle: 'Letters to the editor',
    page: '12',
  },
] as const;

// Nine of the fourteen participants have raised it.
const PARTICIPANTS = Array.from({ length: 14 }, (_, index) => index < 9);

function Collage() {
  return (
    <div aria-hidden className="fieldnotes-collage">
      <div className="fieldnotes-piece fieldnotes-scrap fieldnotes-folder">
        <span className="fieldnotes-folder-label">
          Study 03<span className="fieldnotes-wide-only"> · Month-end close</span>
        </span>
      </div>
      <div className="fieldnotes-piece fieldnotes-scrap fieldnotes-index">
        <span className="fieldnotes-hand">P07 keeps a second spreadsheet.</span>
        <span className="fieldnotes-hand fieldnotes-hand-small">ask P02 and P05 about theirs</span>
      </div>
      <div className="fieldnotes-piece fieldnotes-strip">
        <div className="fieldnotes-strip-paper">
          <span className="fieldnotes-typed">
            <b>04:19 · Dana R.</b>
            <br />
            <mark>Honestly, that spreadsheet is the real system.</mark> The official dashboard is
            what I show my manager.
          </span>
        </div>
      </div>
      <span className="fieldnotes-piece fieldnotes-tape fieldnotes-cover-tape-a" />
      <span className="fieldnotes-piece fieldnotes-tape fieldnotes-cover-tape-b" />
      <Stamp
        centre="P07"
        className="fieldnotes-piece fieldnotes-cover-stamp"
        id="fieldnotes-cover-stamp"
        ring="TAGGED · PAIN POINT · ISSUE 14 ·"
      />
    </div>
  );
}

/** The cover: the founder's headline and standfirst beside a desk of interview scraps. */
export function Cover({ onStartFree }: { onStartFree: () => void }) {
  const floatRef = useRef<HTMLDivElement>(null);

  // The card's slow drift runs only while it is on screen.
  useEffect(() => {
    const float = floatRef.current;

    if (!float || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(([entry]) =>
      float.toggleAttribute('data-live', entry.isIntersecting),
    );

    observer.observe(float);

    return () => observer.disconnect();
  }, []);

  return (
    <section aria-labelledby="fieldnotes-cover-title" className="fieldnotes-cover" id="cover">
      <div className="fieldnotes-wrap">
        <div className="fieldnotes-dateline">
          <span>Volume II · Autumn</span>
          <span className="fieldnotes-dateline-mid">
            The Fieldnotes letter, on research that lasts
          </span>
          <span>9 minute read</span>
        </div>
        <div className="fieldnotes-cover-grid">
          <p className="fieldnotes-eyebrow fieldnotes-kicker">A letter from the founder</p>
          <h1 className="fieldnotes-cover-title" id="fieldnotes-cover-title">
            <span className="fieldnotes-line">Research should</span>
            <span className="fieldnotes-line">
              <em>outlive</em> the readout.
            </span>
          </h1>
          <div className="fieldnotes-teaser">
            <p className="fieldnotes-eyebrow">Inside, page 05</p>
            <blockquote>
              “I’ve stopped mentioning it because it sounds like complaining.”
            </blockquote>
            <a href="#try">
              <span>Tag it yourself</span>
              <Icon className="fieldnotes-lean fieldnotes-lean-right" name="right" />
            </a>
          </div>
          <div className="fieldnotes-lede">
            <p className="fieldnotes-standfirst">
              Most interviews are heard once, summarised in a deck and forgotten. Fieldnotes keeps
              every conversation tagged and searchable, so the pattern you spot in September can
              still find the quote from March.
            </p>
            <div className="fieldnotes-byline">
              <Initials initials="MA" />
              <p>
                <span className="fieldnotes-byline-name">By Maren Ashdown</span>
                <span className="fieldnotes-byline-role">
                  Founder, and a researcher for eleven years
                </span>
              </p>
            </div>
            <div className="fieldnotes-cover-actions">
              <GlassButton {...slotted} className="fieldnotes-button-lg" variant="prominent">
                <a href="#start" onClick={onStartFree}>
                  Start free
                </a>
              </GlassButton>
              <GlassButton {...slotted} className="fieldnotes-button-lg">
                <a href="#letter">
                  Read the letter
                  <Icon className="fieldnotes-lean fieldnotes-lean-down" name="down" />
                </a>
              </GlassButton>
            </div>
            <p className="fieldnotes-cover-note">
              Your first 20 interviews are free. No card needed.
            </p>
          </div>
          <figure className="fieldnotes-cover-art">
            <Collage />
            <div ref={floatRef} className="fieldnotes-cover-float">
              <GlassPanel className="fieldnotes-pane fieldnotes-cover-card" lens variant="card">
                <div className="fieldnotes-cover-card-top">
                  <GlassBadge className="fieldnotes-badge" dot>
                    Pattern forming
                  </GlassBadge>
                  <span className="fieldnotes-cover-card-meta">3 studies</span>
                </div>
                <p className="fieldnotes-cover-card-title">The spreadsheet is the real system</p>
                <p className="fieldnotes-cover-card-sub">
                  Raised by 9 of 14 participants since March
                </p>
                <div aria-hidden className="fieldnotes-dots">
                  {PARTICIPANTS.map((raised, index) => (
                    <i key={index} data-on={raised ? '' : undefined} />
                  ))}
                </div>
              </GlassPanel>
            </div>
            <figcaption className="fieldnotes-sr-only">
              An example pattern in Fieldnotes: the spreadsheet is the real system, raised by 9 of
              14 participants across 3 studies.
            </figcaption>
          </figure>
        </div>
        <nav aria-label="In this issue" className="fieldnotes-contents">
          <p className="fieldnotes-eyebrow">In this issue</p>
          <ol>
            {CONTENTS.map((entry) => (
              <li key={entry.id}>
                <a href={`#${entry.id}`}>
                  <span className="fieldnotes-contents-numeral">{entry.numeral}</span>
                  <span className="fieldnotes-contents-title">{entry.title}</span>
                  <span className="fieldnotes-contents-page">{entry.page}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </section>
  );
}

const MARKS = [
  {
    name: 'Larkmere',
    width: 140,
    art: (
      <path
        d="M4 22c5-8 11-12 19-11-5 2-8 5-10 10M12 21c4-4 9-6 14-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    ),
    text: { x: 32, y: 22.5, className: 'fieldnotes-mark-larkmere', label: 'Larkmere' },
  },
  {
    name: 'Tidelock',
    width: 150,
    art: (
      <path
        d="M4 13c3-3 6-3 9 0s6 3 9 0M4 20c3-3 6-3 9 0s6 3 9 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    ),
    text: { x: 30, y: 21.5, className: 'fieldnotes-mark-tidelock', label: 'TIDELOCK' },
  },
  {
    name: 'Orrery',
    width: 120,
    art: (
      <>
        <ellipse
          cx="14"
          cy="16"
          fill="none"
          rx="11"
          ry="5.5"
          stroke="currentColor"
          strokeWidth="1.6"
          transform="rotate(-24 14 16)"
        />
        <circle cx="14" cy="16" fill="currentColor" r="3.4" />
      </>
    ),
    text: { x: 32, y: 21.5, className: 'fieldnotes-mark-orrery', label: 'orrery' },
  },
  {
    name: 'Fernhaven',
    width: 150,
    art: (
      <path
        d="M12 27V7M12 11l-5-3M12 11l5-3M12 16l-6-3M12 16l6-3M12 21l-6-3M12 21l6-3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    ),
    text: { x: 26, y: 22, className: 'fieldnotes-mark-fernhaven', label: 'Fernhaven' },
  },
  {
    name: 'Quillon',
    width: 124,
    art: (
      <path
        d="M5 26L22 6c-2 8-6 13-12 15"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    ),
    text: { x: 28, y: 22, className: 'fieldnotes-mark-quillon', label: 'Quillon' },
  },
  {
    name: 'Hollow Pine',
    width: 160,
    art: (
      <path
        d="M12 5l8 13h-5l6 9H3l6-9H4z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    ),
    text: { x: 28, y: 21.5, className: 'fieldnotes-mark-hollow-pine', label: 'HOLLOW PINE' },
  },
];

/** The researchers who already use it, and six of their teams' wordmarks. */
export function Proof() {
  return (
    <section aria-label="Teams using Fieldnotes" className="fieldnotes-proof">
      <div className="fieldnotes-wrap fieldnotes-proof-inner">
        <p className="fieldnotes-proof-lead">
          <strong>4,200 researchers</strong> keep their interviews in Fieldnotes, at teams including
        </p>
        <ul className="fieldnotes-proof-marks">
          {MARKS.map((mark) => (
            <li key={mark.name}>
              <svg aria-label={mark.name} role="img" viewBox={`0 0 ${mark.width} 32`}>
                {mark.art}
                <text
                  className={mark.text.className}
                  fill="currentColor"
                  x={mark.text.x}
                  y={mark.text.y}
                >
                  {mark.text.label}
                </text>
              </svg>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
