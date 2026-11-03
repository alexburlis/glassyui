'use client';

import { useEffect, useState, type RefObject } from 'react';

type Ray = { height: number; opacity: number; width: number; x: number; y: number };

type Star = { big: boolean; opacity: number; radius: number; x: number; y: number };

type Art = {
  rays: Ray[];
  stars: Star[];
  width: number;
  height: number;
  horizon: number;
  band: number;
  bandY: number;
  accent: string;
};

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
  const b = CURVE_POINTS[next];

  return a.y + (b.y - a.y) * ((x - a.x) / (b.x - a.x));
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

/** The element's top within an ancestor, without the transforms that move it while scrolling. */
export function topWithin(element: HTMLElement, ancestor: HTMLElement) {
  let top = element.offsetTop;

  for (
    let parent = element.offsetParent;
    parent instanceof HTMLElement && parent !== ancestor;
    parent = parent.offsetParent
  ) {
    top += parent.offsetTop;
  }

  return top;
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
      const top = topWithin(card, hero);
      const cardHeight = card.offsetHeight;
      // On phones the card fills the width: the aurora's arms end level with its top edge, so
      // only the rays rise above it.
      const narrow = width <= 560;
      const style = getComputedStyle(hero);
      const band = parseFloat(style.getPropertyValue('--band-h'));
      const accent = style.getPropertyValue('--hc-accent').trim();
      const bandY = narrow ? top - 16 + band * 0.25 : top + cardHeight / 2;
      // At rest the horizon runs behind the middle of the email field, clear of every edge, and
      // the rims bend it on both sides. Scrolling lifts the glass, so the line sinks through it.
      const field = card.querySelector<HTMLElement>('.halcyon-waitlist-input');

      const fieldMiddle = field
        ? topWithin(field, hero) + field.offsetHeight / 2
        : top + cardHeight * 0.6;

      const horizon = Math.round(Math.min(height - 40, fieldMiddle));

      hero.style.setProperty('--band-y', `${Math.round(bandY)}px`);
      hero.style.setProperty('--horizon', `${horizon}px`);
      hero.toggleAttribute('data-tight', height - (top + cardHeight) < 104);
      setArt((drawn) =>
        drawn &&
        drawn.width === width &&
        drawn.height === height &&
        drawn.horizon === horizon &&
        drawn.band === band &&
        drawn.bandY === bandY &&
        drawn.accent === accent
          ? drawn
          : {
              rays: drawn?.width === width ? drawn.rays : drawRays(width),
              stars: drawStars(width, horizon),
              width,
              height,
              horizon,
              band,
              bandY,
              accent,
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

/** The image shown by the hero and sampled by its glass share this measured dawn. */
export function heroBackdrop(art: Art | null) {
  if (!art) return undefined;

  const { width, height, horizon, band, bandY, rays, stars } = art;

  const accent = art.accent
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;');

  const sea = height - horizon;
  const curve = 'M0 150C380 250 560 338 720 338S1100 260 1440 170';

  const starMarkup = stars
    .map(
      (star) =>
        `${star.big ? `<circle cx="${star.x.toFixed(1)}" cy="${star.y.toFixed(1)}" r="3.6" fill="#cfefff" opacity="${(star.opacity * 0.2).toFixed(2)}"/>` : ''}<circle cx="${star.x.toFixed(1)}" cy="${star.y.toFixed(1)}" r="${star.radius.toFixed(2)}" fill="#eaf4ff" opacity="${star.opacity.toFixed(2)}"/>`,
    )
    .join('');

  const rayMarkup = rays
    .map(
      (ray) =>
        `<rect x="${ray.x.toFixed(1)}" y="${ray.y.toFixed(1)}" width="${ray.width.toFixed(2)}" height="${ray.height.toFixed(1)}" opacity="${ray.opacity.toFixed(2)}"/>`,
    )
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="sky" x2="0" y2="1"><stop stop-color="#080d1a"/><stop offset=".32" stop-color="#0c1222"/><stop offset=".6" stop-color="#111a33"/><stop offset=".82" stop-color="#1c2242"/><stop offset=".94" stop-color="#2c2a4a"/><stop offset="1" stop-color="#3a3150"/></linearGradient>
      <radialGradient id="sky-peach" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${width / 2} ${horizon}) scale(${width * 0.52} ${horizon * 0.58})"><stop stop-color="#ffb38a" stop-opacity=".36"/><stop offset=".44" stop-color="#ffb38a" stop-opacity=".12"/><stop offset=".74" stop-color="#ffb38a" stop-opacity="0"/></radialGradient>
      <radialGradient id="sky-light" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${width / 2} ${horizon}) scale(${width * 0.28} ${horizon * 0.26})"><stop stop-color="#ffdecc" stop-opacity=".3"/><stop offset=".72" stop-color="#ffdecc" stop-opacity="0"/></radialGradient>
      <linearGradient id="sea" x2="0" y2="1"><stop stop-color="#1f2342"/><stop offset=".34" stop-color="#151c36"/><stop offset="1" stop-color="#0f1628"/></linearGradient>
      <radialGradient id="sea-peach" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${width / 2} ${horizon}) scale(${width * 0.34} ${sea * 0.44})"><stop stop-color="#ffb38a" stop-opacity=".26"/><stop offset=".72" stop-color="#ffb38a" stop-opacity="0"/></radialGradient>
      <radialGradient id="sea-aqua" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${width / 2} ${horizon}) scale(${width * 0.7} ${sea * 0.6})"><stop stop-color="${accent}" stop-opacity=".1"/><stop offset=".74" stop-color="${accent}" stop-opacity="0"/></radialGradient>
      <radialGradient id="sea-fade" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${width / 2} ${horizon}) scale(${width * 0.56} ${sea})"><stop offset=".1" stop-color="white"/><stop offset=".78" stop-color="white" stop-opacity="0"/></radialGradient>
      <pattern id="sea-lines" width="${width}" height="7" y="${horizon}" patternUnits="userSpaceOnUse"><rect width="${width}" height="1" fill="#ffe2d2" fill-opacity=".08"/></pattern>
      <mask id="sea-mask" maskUnits="userSpaceOnUse"><rect width="${width}" height="${height}" fill="url(#sea-fade)"/></mask>
      <linearGradient id="band-fade" x2="0" y2="1"><stop stop-color="white" stop-opacity="0"/><stop offset="${width <= 560 ? '.12' : '.3'}" stop-color="white"/><stop offset=".82" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
      <mask id="band-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${band}"><rect width="${width}" height="${band}" fill="url(#band-fade)"/></mask>
      <linearGradient id="aqua"><stop stop-color="#3ad1e0" stop-opacity="0"/><stop offset=".22" stop-color="#3ad1e0" stop-opacity=".75"/><stop offset=".5" stop-color="#86e9f1"/><stop offset=".78" stop-color="#3ad1e0" stop-opacity=".75"/><stop offset="1" stop-color="#3ad1e0" stop-opacity="0"/></linearGradient>
      <linearGradient id="peach"><stop offset=".1" stop-color="#ffb38a" stop-opacity="0"/><stop offset=".38" stop-color="#ffb38a" stop-opacity=".9"/><stop offset=".62" stop-color="#ffc9a8" stop-opacity=".9"/><stop offset=".9" stop-color="#ffb38a" stop-opacity="0"/></linearGradient>
      <linearGradient id="curve-line"><stop offset=".04" stop-color="#e6fdff" stop-opacity="0"/><stop offset=".3" stop-color="#e6fdff" stop-opacity=".5"/><stop offset=".5" stop-color="#f4feff" stop-opacity=".85"/><stop offset=".7" stop-color="#e6fdff" stop-opacity=".5"/><stop offset=".96" stop-color="#e6fdff" stop-opacity="0"/></linearGradient>
      <linearGradient id="ray" x1="0" x2="0" y1="1" y2="0"><stop stop-color="#d4fafc" stop-opacity=".95"/><stop offset=".14" stop-color="#3ad1e0" stop-opacity=".8"/><stop offset=".55" stop-color="#3ad1e0" stop-opacity=".2"/><stop offset="1" stop-color="#3ad1e0" stop-opacity="0"/></linearGradient>
      ${[48, 22, 6].map((blur) => `<filter id="b${blur}" filterUnits="userSpaceOnUse" x="-240" y="-360" width="1920" height="1320"><feGaussianBlur stdDeviation="${blur}"/></filter>`).join('')}
      <filter id="soft"><feGaussianBlur stdDeviation=".7"/></filter>
      <linearGradient id="horizon"><stop stop-color="#ffccb4" stop-opacity="0"/><stop offset=".22" stop-color="#ffcdb4" stop-opacity=".5"/><stop offset=".5" stop-color="#fff2ea" stop-opacity=".95"/><stop offset=".78" stop-color="#ffcdb4" stop-opacity=".5"/><stop offset="1" stop-color="#ffccb4" stop-opacity="0"/></linearGradient>
      <filter id="horizon-glow" x="-10%" y="-1000%" width="120%" height="2100%"><feGaussianBlur stdDeviation="11"/></filter>
    </defs>
    <rect width="${width}" height="${horizon}" fill="url(#sky)"/>
    <rect width="${width}" height="${horizon}" fill="url(#sky-light)"/>
    <rect width="${width}" height="${horizon}" fill="url(#sky-peach)"/>
    ${starMarkup}
    <g transform="translate(0 ${bandY - band / 2})"><g mask="url(#band-mask)">
      <svg width="${width}" height="${band}" viewBox="0 0 1440 600" preserveAspectRatio="none">
        <path d="${curve}" fill="none" stroke="url(#aqua)" stroke-width="230" opacity=".3" transform="translate(0 -100)" filter="url(#b48)"/>
        <path d="${curve}" fill="none" stroke="url(#peach)" stroke-width="80" opacity=".5" transform="translate(0 34)" filter="url(#b22)"/>
        <path d="${curve}" fill="none" stroke="url(#aqua)" stroke-width="16" opacity=".8" filter="url(#b6)"/>
        <path d="${curve}" fill="none" stroke="url(#curve-line)" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
      </svg>
      <svg width="${width}" height="${band}" viewBox="0 0 ${width} 600" preserveAspectRatio="none"><g fill="url(#ray)" filter="url(#soft)">${rayMarkup}</g></svg>
    </g></g>
    <rect y="${horizon}" width="${width}" height="${sea}" fill="url(#sea)"/>
    <rect y="${horizon}" width="${width}" height="${sea}" fill="url(#sea-aqua)"/>
    <rect y="${horizon}" width="${width}" height="${sea}" fill="url(#sea-peach)"/>
    <rect y="${horizon}" width="${width}" height="${sea}" fill="url(#sea-lines)" mask="url(#sea-mask)"/>
    <rect y="${horizon - 3}" width="${width}" height="7" fill="#ffb38a" fill-opacity=".26" filter="url(#horizon-glow)"/>
    <rect y="${horizon}" width="${width}" height="1" fill="url(#horizon)"/>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
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
