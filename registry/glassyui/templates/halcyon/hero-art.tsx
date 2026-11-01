'use client';

import { useEffect, useState, type RefObject } from 'react';

type Ray = { height: number; opacity: number; width: number; x: number; y: number };

type Star = { big: boolean; opacity: number; radius: number; x: number; y: number };

type Art = { rays: Ray[]; stars: Star[]; width: number; horizon: number };

// The aurora's curve across a 1440 x 600 band: M0 150 C380 250 560 338 720 338 S1100 260 1440 170.
const CURVE = [
  [
    [0, 150],
    [380, 250],
    [560, 338],
    [720, 338],
  ],
  [
    [720, 338],
    [880, 338],
    [1100, 260],
    [1440, 170],
  ],
] as const;

const CURVE_POINTS = CURVE.flatMap((segment) =>
  Array.from({ length: 121 }, (_, index) => {
    const t = index / 120;
    const u = 1 - t;
    const weights = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];

    return {
      x: segment.reduce((sum, point, at) => sum + point[0] * weights[at], 0),
      y: segment.reduce((sum, point, at) => sum + point[1] * weights[at], 0),
    };
  }),
);

/** The curve's height at a fraction of the band's width. */
function curveAt(fraction: number) {
  const x = fraction * 1440;

  const next = Math.max(
    1,
    CURVE_POINTS.findIndex((point) => point.x >= x),
  );

  const a = CURVE_POINTS[next - 1];
  const b = CURVE_POINTS[next] ?? a;

  return a.y + (b.y - a.y) * ((x - a.x) / (b.x - a.x || 1));
}

/** The same sequence every time, so the sky never reshuffles between visits. */
function seeded(seed: number) {
  let state = seed;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;

    return state / 4294967296;
  };
}

function drawRays(width: number) {
  const random = seeded(11);
  const rays: Ray[] = [];

  for (let x = 8; x < width - 12; x += 2.5 + random() * 8) {
    const side = Math.abs(x / width - 0.5) * 2;
    const base = curveAt(x / width) + (random() - 0.5) * 10;
    const height = 56 + random() * 150 + (1 - side) * 110 * random();
    const rayWidth = 0.6 + random() * (random() < 0.1 ? 8 : 2.2);
    const opacity = (0.14 + random() * 0.56) * (1 - Math.pow(side, 3) * 0.75);

    rays.push({ height, opacity, width: rayWidth, x, y: base - height });
  }

  return rays;
}

function drawStars(width: number, height: number) {
  const random = seeded(5);
  const stars: Star[] = [];
  const count = Math.round((width * height) / 5200);

  for (let index = 0; index < count; index++) {
    const x = 8 + random() * (width - 16);
    const y = Math.pow(random(), 1.3) * height * 0.94;
    const big = random() < 0.03;
    const opacity = (0.25 + random() * 0.6) * (0.2 + 0.8 * (1 - y / height));

    stars.push({ big, opacity, radius: big ? 1.25 : 0.35 + random() * 0.7, x, y });
  }

  return stars;
}

/**
 * Lays the aurora and the horizon behind the waitlist card and draws the stars and rays at the
 * hero's real size, so nothing stretches. The hero carries --band-y and --horizon, and
 * data-tight when the card leaves too little room for the scroll hint.
 */
export function useHeroArt(
  heroRef: RefObject<HTMLElement | null>,
  cardRef: RefObject<HTMLElement | null>,
) {
  const [art, setArt] = useState<Art | null>(null);

  useEffect(() => {
    const hero = heroRef.current;
    const card = cardRef.current;

    if (!hero || !card) return;

    let frame = 0;

    const layout = () => {
      const height = hero.offsetHeight;
      const width = hero.offsetWidth;
      const top = card.offsetTop;
      const cardHeight = card.offsetHeight;
      // On phones the card fills the width: the aurora's arms end level with its top edge, so
      // only the rays rise above it.
      const narrow = width <= 560;
      const band = parseFloat(getComputedStyle(hero).getPropertyValue('--band-h')) || 600;
      const bandY = narrow ? top - 16 + band * 0.25 : top + cardHeight / 2;
      const horizon = Math.round(Math.min(height - 40, top + cardHeight * (narrow ? 0.6 : 0.72)));

      hero.style.setProperty('--band-y', `${Math.round(bandY)}px`);
      hero.style.setProperty('--horizon', `${horizon}px`);
      hero.toggleAttribute('data-tight', height - (top + cardHeight) < 104);
      setArt((drawn) =>
        drawn && Math.abs(width - drawn.width) <= 24 && Math.abs(horizon - drawn.horizon) <= 24
          ? drawn
          : {
              rays: drawn && Math.abs(width - drawn.width) <= 24 ? drawn.rays : drawRays(width),
              stars: drawStars(width, horizon),
              width,
              horizon,
            },
      );
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layout);
    };

    const resize = new ResizeObserver(schedule);

    resize.observe(hero);
    resize.observe(card);
    void document.fonts?.ready.then(schedule);
    layout();

    // The rays sway only while the hero is on screen.
    const away = new IntersectionObserver(([entry]) =>
      hero.toggleAttribute('data-away', !entry.isIntersecting),
    );

    away.observe(hero);

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      away.disconnect();
    };
  }, [cardRef, heroRef]);

  return art;
}

export function HeroArt({ art }: { art: Art | null }) {
  return (
    <div aria-hidden className="halcyon-hero-art">
      <div className="halcyon-hero-sky" />
      <svg
        className="halcyon-hero-stars"
        preserveAspectRatio="xMinYMin slice"
        viewBox={art ? `0 0 ${art.width} ${art.horizon}` : undefined}
      >
        {art?.stars.map((star, index) => (
          <g key={index}>
            {star.big ? (
              <circle
                cx={star.x.toFixed(1)}
                cy={star.y.toFixed(1)}
                fill="#cfefff"
                opacity={(star.opacity * 0.2).toFixed(2)}
                r="3.6"
              />
            ) : null}
            <circle
              cx={star.x.toFixed(1)}
              cy={star.y.toFixed(1)}
              fill="#eaf4ff"
              opacity={star.opacity.toFixed(2)}
              r={star.radius.toFixed(2)}
            />
          </g>
        ))}
      </svg>
      <div className="halcyon-aurora">
        <svg className="halcyon-aurora-glow" preserveAspectRatio="none" viewBox="0 0 1440 600">
          <defs>
            <linearGradient id="halcyon-au-aqua" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#3ad1e0" stopOpacity="0" />
              <stop offset=".22" stopColor="#3ad1e0" stopOpacity=".75" />
              <stop offset=".5" stopColor="#86e9f1" />
              <stop offset=".78" stopColor="#3ad1e0" stopOpacity=".75" />
              <stop offset="1" stopColor="#3ad1e0" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="halcyon-au-peach" x1="0" x2="1" y1="0" y2="0">
              <stop offset=".1" stopColor="#ffb38a" stopOpacity="0" />
              <stop offset=".38" stopColor="#ffb38a" stopOpacity=".9" />
              <stop offset=".62" stopColor="#ffc9a8" stopOpacity=".9" />
              <stop offset=".9" stopColor="#ffb38a" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="halcyon-au-line" x1="0" x2="1" y1="0" y2="0">
              <stop offset=".04" stopColor="#e6fdff" stopOpacity="0" />
              <stop offset=".3" stopColor="#e6fdff" stopOpacity=".5" />
              <stop offset=".5" stopColor="#f4feff" stopOpacity=".85" />
              <stop offset=".7" stopColor="#e6fdff" stopOpacity=".5" />
              <stop offset=".96" stopColor="#e6fdff" stopOpacity="0" />
            </linearGradient>
            {[48, 22, 6].map((blur) => (
              <filter
                key={blur}
                filterUnits="userSpaceOnUse"
                height="1320"
                id={`halcyon-au-b${blur}`}
                width="1920"
                x="-240"
                y="-360"
              >
                <feGaussianBlur stdDeviation={blur} />
              </filter>
            ))}
          </defs>
          <path
            d="M0 150C380 250 560 338 720 338S1100 260 1440 170"
            fill="none"
            filter="url(#halcyon-au-b48)"
            opacity=".3"
            stroke="url(#halcyon-au-aqua)"
            strokeWidth="230"
            transform="translate(0 -100)"
          />
          <path
            d="M0 150C380 250 560 338 720 338S1100 260 1440 170"
            fill="none"
            filter="url(#halcyon-au-b22)"
            opacity=".5"
            stroke="url(#halcyon-au-peach)"
            strokeWidth="80"
            transform="translate(0 34)"
          />
          <path
            d="M0 150C380 250 560 338 720 338S1100 260 1440 170"
            fill="none"
            filter="url(#halcyon-au-b6)"
            opacity=".8"
            stroke="url(#halcyon-au-aqua)"
            strokeWidth="16"
          />
          <path
            d="M0 150C380 250 560 338 720 338S1100 260 1440 170"
            fill="none"
            stroke="url(#halcyon-au-line)"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <svg
          className="halcyon-aurora-rays"
          preserveAspectRatio="none"
          viewBox={`0 0 ${art?.width ?? 1440} 600`}
        >
          <defs>
            <linearGradient id="halcyon-au-ray" x1="0" x2="0" y1="1" y2="0">
              <stop offset="0" stopColor="#d4fafc" stopOpacity=".95" />
              <stop offset=".14" stopColor="#3ad1e0" stopOpacity=".8" />
              <stop offset=".55" stopColor="#3ad1e0" stopOpacity=".2" />
              <stop offset="1" stopColor="#3ad1e0" stopOpacity="0" />
            </linearGradient>
            <filter id="halcyon-au-soft">
              <feGaussianBlur stdDeviation="0.7" />
            </filter>
          </defs>
          <g fill="url(#halcyon-au-ray)" filter="url(#halcyon-au-soft)">
            {art?.rays.map((ray, index) => (
              <rect
                key={index}
                height={ray.height.toFixed(1)}
                opacity={ray.opacity.toFixed(2)}
                width={ray.width.toFixed(2)}
                x={ray.x.toFixed(1)}
                y={ray.y.toFixed(1)}
              />
            ))}
          </g>
        </svg>
      </div>
      <div className="halcyon-hero-sea" />
      <div className="halcyon-hero-horizon" />
    </div>
  );
}
