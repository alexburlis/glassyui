import { PRO_OFFER } from '@/lib/pro-teaser';
import { PRO_ORIGIN } from '@/lib/site-links';

type Point = readonly [x: number, y: number];

/*
  The art is 200 by 232 CSS pixels on the card's Vermilion: a Pro site in a glass window, with a
  pale ribbon behind it that turns over once, as the logo's band does. The ribbon follows a cubic
  centreline, and its width is the full width times the cosine of how far it has turned, so the
  front face narrows to an edge at the turn and the back face opens out after it. Both ends lie
  well outside the art, so its slow drift never shows one.
*/
const CENTRELINE: readonly [Point, Point, Point, Point] = [
  [-40, 172],
  [30, 134],
  [64, 18],
  [246, 44],
];

const RIBBON_WIDTH = 30;

const TURN_FROM = 0.42;

const TURN_TO = 0.72;

const EDGE_ON = (TURN_FROM + TURN_TO) / 2;

const STEPS = 32;

/** The centreline's point at t, from 0 to 1, and its unit normal there, pointing up the art. */
function centreline(t: number) {
  const [a, b, c, d] = CENTRELINE;
  const u = 1 - t;

  const along = (axis: 0 | 1) =>
    u ** 3 * a[axis] + 3 * u ** 2 * t * b[axis] + 3 * u * t ** 2 * c[axis] + t ** 3 * d[axis];

  const slope = (axis: 0 | 1) =>
    3 * u ** 2 * (b[axis] - a[axis]) +
    6 * u * t * (c[axis] - b[axis]) +
    3 * t ** 2 * (d[axis] - c[axis]);

  const length = Math.hypot(slope(0), slope(1));

  return { x: along(0), y: along(1), normalX: slope(1) / length, normalY: -slope(0) / length };
}

/** One edge of the ribbon between two places on the centreline. Side 1 starts as the top edge. */
function ribbonEdge(from: number, to: number, side: 1 | -1): Point[] {
  return Array.from({ length: STEPS + 1 }, (_, index) => {
    const t = from + ((to - from) * index) / STEPS;
    const { x, y, normalX, normalY } = centreline(t);
    const progress = Math.min(Math.max((t - TURN_FROM) / (TURN_TO - TURN_FROM), 0), 1);
    const turned = Math.PI * progress ** 2 * (3 - 2 * progress);
    const offset = (side * RIBBON_WIDTH * Math.cos(turned)) / 2;

    return [x + normalX * offset, y + normalY * offset];
  });
}

const toPath = (points: Point[]) =>
  points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L');

/** A face of the ribbon: out along one edge and back along the other. */
const ribbonFace = (from: number, to: number) =>
  `M${toPath([...ribbonEdge(from, to, 1), ...ribbonEdge(from, to, -1).reverse()])}Z`;

const FRONT = ribbonFace(0, EDGE_ON);

const BACK = ribbonFace(EDGE_ON, 1);

/** The light caught along the front face's top edge. */
const LIP = `M${toPath(ribbonEdge(0, EDGE_ON - 0.02, 1))}`;

const START = centreline(0);

const TURN = centreline(EDGE_ON);

const END = centreline(1);

/** The card's art: a Pro site in a glass window rising in front of a pale turning ribbon. */
function ProCardArt() {
  return (
    <span aria-hidden className="pro-card-art">
      <svg className="pro-card-ribbon" height="256" viewBox="-12 -12 224 256" width="224">
        <defs>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id="pro-card-front"
            x1={START.x}
            x2={TURN.x}
            y1={START.y}
            y2={TURN.y}
          >
            <stop stopColor="#fff" />
            <stop offset="0.36" stopColor="#fff1e8" />
            <stop offset="0.74" stopColor="#ffd9c4" />
            <stop offset="1" stopColor="#ffbe9c" />
          </linearGradient>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id="pro-card-back"
            x1={TURN.x}
            x2={END.x}
            y1={TURN.y}
            y2={END.y}
          >
            <stop stopColor="#ffad86" />
            <stop offset="0.3" stopColor="#ffc8a9" />
            <stop offset="1" stopColor="#fff0e6" />
          </linearGradient>
          <linearGradient id="pro-card-lip" x2="1" y2="0.7">
            <stop stopColor="#fff5eb" />
            <stop offset="0.4" stopColor="#ffc9a9" />
            <stop offset="1" stopColor="#ff936b" />
          </linearGradient>
          <filter height="140%" id="pro-card-soft" width="140%" x="-20%" y="-20%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        <g
          className="pro-card-ribbon-shadow"
          filter="url(#pro-card-soft)"
          transform="translate(0 7)"
        >
          <path d={FRONT} />
          <path d={BACK} />
        </g>
        <path d={BACK} fill="url(#pro-card-back)" />
        <path d={FRONT} fill="url(#pro-card-front)" />
        <path
          d={LIP}
          fill="none"
          stroke="url(#pro-card-lip)"
          strokeLinecap="round"
          strokeWidth="1.6"
        />
      </svg>
      <span className="pro-card-window">
        <span className="pro-card-window-bar">
          <i />
          <i />
          <i />
        </span>
        <span className="pro-card-page">
          <span className="pro-card-page-nav">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <i className="pro-card-page-title" />
          <i className="pro-card-page-lead" />
          <i className="pro-card-page-button" />
          <span className="pro-card-page-cards">
            <i />
            <i />
            <i />
          </span>
        </span>
      </span>
    </span>
  );
}

/** The Pro card beside the gallery: what Pro is, what it costs today and the way in. */
export function ProCard() {
  return (
    <a className="pro-card" href={PRO_ORIGIN}>
      <ProCardArt />
      <span className="pro-card-body">
        <span className="pro-card-title">
          Glassy UI <span className="pro-badge">Pro</span>
        </span>
        <span className="pro-card-text">Complete sites built with these components.</span>
        <span className="pro-card-price">
          {PRO_OFFER.earlyBirdOpen ? (
            <>
              <strong>${PRO_OFFER.earlyBirdPrice}</strong> for the first {PRO_OFFER.earlyBirdCap}
            </>
          ) : (
            <>
              <strong>${PRO_OFFER.regularPrice}</strong>, paid once
            </>
          )}
        </span>
        <span className="pro-card-action">
          Pre-order<span aria-hidden> ›</span>
        </span>
      </span>
    </a>
  );
}
