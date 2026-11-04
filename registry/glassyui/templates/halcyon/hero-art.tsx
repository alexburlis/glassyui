'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { GlassSceneBackdropPainter } from '../../glass-scene';
import { motionReduced } from '../../lib/liquid-motion';

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
 * hero's real size, so nothing stretches. The hero carries data-tight when the card leaves too
 * little room for the scroll hint.
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
      // At rest the horizon crosses the open face between the label and the email field, well
      // off the card's middle, where a line would pass the domed glass unbent. Scrolling lifts
      // the glass, so the line sinks through it.
      const label = card.querySelector<HTMLElement>('.halcyon-waitlist-label');
      const field = card.querySelector<HTMLElement>('.halcyon-waitlist-input');

      const open =
        label && field
          ? (topWithin(label, hero) + label.offsetHeight + topWithin(field, hero)) / 2
          : top + cardHeight * 0.3;

      const horizon = Math.round(Math.min(height - 40, open));

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

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
  }, [cardRef, heroRef]);

  return art;
}

export const svgAttribute = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

export const svgLayer = (width: number, height: number, defs: string, body: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs}</defs>${body}</svg>`,
  )}`;

/** Decodes each named SVG layer into an image. */
export async function decodeLayers<Name extends string>(urls: Record<Name, string>) {
  const entries = await Promise.all(
    Object.entries<string>(urls).map(async ([name, url]) => {
      const image = new Image();

      image.src = url;
      await image.decode();

      return [name, image] as const;
    }),
  );

  // SAFETY: the entries are the layers passed in, each decoded under its own name.
  return Object.fromEntries(entries) as Record<Name, HTMLImageElement>;
}

/** Rasterises each layer once per density, at its own size, so a frame only places bitmaps. */
export function rasterCache<Name extends string>(images: Record<Name, HTMLImageElement>) {
  const rasters = new Map<string, HTMLCanvasElement>();

  return (name: Name, density: number) => {
    const key = `${name}@${density}`;
    const image = images[name];
    let canvas = rasters.get(key);

    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * density));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * density));
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      rasters.set(key, canvas);
    }

    return canvas;
  };
}

/** The night's navy, painted once per size, until a dawn's layers have decoded. */
export function paintNight(): GlassSceneBackdropPainter {
  let painted = '';

  return (context, { width, height, density }) => {
    const picture = `${width}x${height}@${density}`;

    if (picture === painted) return false;

    painted = picture;
    context.fillStyle = '#0e1424';
    context.fillRect(0, 0, width, height);
  };
}

// The horizon's line and glow, in a strip this far above and below it.
const HORIZON_STRIP = 40;

/**
 * The measured dawn in five layers, so the aurora can rise into place and its rays sway between
 * the sky and the sea: the same picture the page shows and the glass refracts.
 */
function heroLayers(art: Art) {
  const { width, height, horizon, band, rays, stars } = art;
  const accent = svgAttribute(art.accent);
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

  // The aurora's band fades in from its top and out at its bottom, wherever it is drawn.
  const bandMask = `<linearGradient id="band-fade" x2="0" y2="1"><stop stop-color="white" stop-opacity="0"/><stop offset="${width <= 560 ? '.12' : '.3'}" stop-color="white"/><stop offset=".82" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><mask id="band-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${band}"><rect width="${width}" height="${band}" fill="url(#band-fade)"/></mask>`;

  const inBand = (content: string) => `<g mask="url(#band-mask)">${content}</g>`;

  return {
    sky: svgLayer(
      width,
      horizon,
      `<linearGradient id="sky" x2="0" y2="1"><stop stop-color="#080d1a"/><stop offset=".32" stop-color="#0c1222"/><stop offset=".6" stop-color="#111a33"/><stop offset=".82" stop-color="#1c2242"/><stop offset=".94" stop-color="#2c2a4a"/><stop offset="1" stop-color="#3a3150"/></linearGradient><radialGradient id="sky-peach" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${width / 2} ${horizon}) scale(${width * 0.52} ${horizon * 0.58})"><stop stop-color="#ffb38a" stop-opacity=".36"/><stop offset=".44" stop-color="#ffb38a" stop-opacity=".12"/><stop offset=".74" stop-color="#ffb38a" stop-opacity="0"/></radialGradient><radialGradient id="sky-light" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${width / 2} ${horizon}) scale(${width * 0.28} ${horizon * 0.26})"><stop stop-color="#ffdecc" stop-opacity=".3"/><stop offset=".72" stop-color="#ffdecc" stop-opacity="0"/></radialGradient>`,
      `<rect width="${width}" height="${horizon}" fill="url(#sky)"/><rect width="${width}" height="${horizon}" fill="url(#sky-light)"/><rect width="${width}" height="${horizon}" fill="url(#sky-peach)"/>${starMarkup}`,
    ),
    glow: svgLayer(
      width,
      band,
      `${bandMask}<linearGradient id="aqua"><stop stop-color="#3ad1e0" stop-opacity="0"/><stop offset=".22" stop-color="#3ad1e0" stop-opacity=".75"/><stop offset=".5" stop-color="#86e9f1"/><stop offset=".78" stop-color="#3ad1e0" stop-opacity=".75"/><stop offset="1" stop-color="#3ad1e0" stop-opacity="0"/></linearGradient><linearGradient id="peach"><stop offset=".1" stop-color="#ffb38a" stop-opacity="0"/><stop offset=".38" stop-color="#ffb38a" stop-opacity=".9"/><stop offset=".62" stop-color="#ffc9a8" stop-opacity=".9"/><stop offset=".9" stop-color="#ffb38a" stop-opacity="0"/></linearGradient><linearGradient id="curve-line"><stop offset=".04" stop-color="#e6fdff" stop-opacity="0"/><stop offset=".3" stop-color="#e6fdff" stop-opacity=".5"/><stop offset=".5" stop-color="#f4feff" stop-opacity=".85"/><stop offset=".7" stop-color="#e6fdff" stop-opacity=".5"/><stop offset=".96" stop-color="#e6fdff" stop-opacity="0"/></linearGradient>${[48, 22, 6].map((blur) => `<filter id="b${blur}" filterUnits="userSpaceOnUse" x="-240" y="-360" width="1920" height="1320"><feGaussianBlur stdDeviation="${blur}"/></filter>`).join('')}`,
      inBand(
        `<svg width="${width}" height="${band}" viewBox="0 0 1440 600" preserveAspectRatio="none"><path d="${curve}" fill="none" stroke="url(#aqua)" stroke-width="230" opacity=".3" transform="translate(0 -100)" filter="url(#b48)"/><path d="${curve}" fill="none" stroke="url(#peach)" stroke-width="80" opacity=".5" transform="translate(0 34)" filter="url(#b22)"/><path d="${curve}" fill="none" stroke="url(#aqua)" stroke-width="16" opacity=".8" filter="url(#b6)"/><path d="${curve}" fill="none" stroke="url(#curve-line)" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>`,
      ),
    ),
    rays: svgLayer(
      width,
      band,
      `${bandMask}<linearGradient id="ray" x1="0" x2="0" y1="1" y2="0"><stop stop-color="#d4fafc" stop-opacity=".95"/><stop offset=".14" stop-color="#3ad1e0" stop-opacity=".8"/><stop offset=".55" stop-color="#3ad1e0" stop-opacity=".2"/><stop offset="1" stop-color="#3ad1e0" stop-opacity="0"/></linearGradient><filter id="soft"><feGaussianBlur stdDeviation=".7"/></filter>`,
      inBand(
        `<svg width="${width}" height="${band}" viewBox="0 0 ${width} 600" preserveAspectRatio="none"><g fill="url(#ray)" filter="url(#soft)">${rayMarkup}</g></svg>`,
      ),
    ),
    sea: svgLayer(
      width,
      sea,
      `<linearGradient id="sea" x2="0" y2="1"><stop stop-color="#1f2342"/><stop offset=".34" stop-color="#151c36"/><stop offset="1" stop-color="#0f1628"/></linearGradient><radialGradient id="sea-peach" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${width / 2} 0) scale(${width * 0.34} ${sea * 0.44})"><stop stop-color="#ffb38a" stop-opacity=".26"/><stop offset=".72" stop-color="#ffb38a" stop-opacity="0"/></radialGradient><radialGradient id="sea-aqua" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${width / 2} 0) scale(${width * 0.7} ${sea * 0.6})"><stop stop-color="${accent}" stop-opacity=".1"/><stop offset=".74" stop-color="${accent}" stop-opacity="0"/></radialGradient><radialGradient id="sea-fade" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${width / 2} 0) scale(${width * 0.56} ${sea})"><stop offset=".1" stop-color="white"/><stop offset=".78" stop-color="white" stop-opacity="0"/></radialGradient><pattern id="sea-lines" width="${width}" height="7" y="0" patternUnits="userSpaceOnUse"><rect width="${width}" height="1" fill="#ffe2d2" fill-opacity=".08"/></pattern><mask id="sea-mask" maskUnits="userSpaceOnUse"><rect width="${width}" height="${sea}" fill="url(#sea-fade)"/></mask>`,
      `<rect width="${width}" height="${sea}" fill="url(#sea)"/><rect width="${width}" height="${sea}" fill="url(#sea-aqua)"/><rect width="${width}" height="${sea}" fill="url(#sea-peach)"/><rect width="${width}" height="${sea}" fill="url(#sea-lines)" mask="url(#sea-mask)"/>`,
    ),
    horizon: svgLayer(
      width,
      HORIZON_STRIP * 2,
      `<linearGradient id="horizon"><stop stop-color="#ffccb4" stop-opacity="0"/><stop offset=".22" stop-color="#ffcdb4" stop-opacity=".5"/><stop offset=".5" stop-color="#fff2ea" stop-opacity=".95"/><stop offset=".78" stop-color="#ffcdb4" stop-opacity=".5"/><stop offset="1" stop-color="#ffccb4" stop-opacity="0"/></linearGradient><filter id="horizon-glow" x="-10%" y="-1000%" width="120%" height="2100%"><feGaussianBlur stdDeviation="11"/></filter>`,
      `<rect y="${HORIZON_STRIP - 3}" width="${width}" height="7" fill="#ffb38a" fill-opacity=".26" filter="url(#horizon-glow)"/><rect y="${HORIZON_STRIP}" width="${width}" height="1" fill="url(#horizon)"/>`,
    ),
  };
}

type Layers = Record<keyof ReturnType<typeof heroLayers>, HTMLImageElement>;

// The aurora rises into place over the first moments, then its rays sway, slowly, for good.
const DAWN_MS = 1800;

const SWAY_MS = 15_000;

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Paints the dawn for the hero's GlassScene. Each layer is drawn once into a canvas at the
 * backdrop's density; a frame then only places them. Returns false while nothing moves.
 */
export function useHeroPainter(art: Art | null): GlassSceneBackdropPainter {
  const [layers, setLayers] = useState<{ art: Art; images: Layers } | null>(null);

  useEffect(() => {
    if (!art) return;

    let cancelled = false;

    void decodeLayers(heroLayers(art)).then((images) => {
      if (!cancelled) setLayers({ art, images });
    });

    return () => {
      cancelled = true;
    };
  }, [art]);

  return useMemo(() => {
    if (!layers) return paintNight();

    const { art: drawnArt, images } = layers;
    const raster = rasterCache(images);
    let painted = '';

    return (context, { width, height, density, time }) => {
      const still = motionReduced();
      const rise = still ? 0 : 48 * (1 - easeOut(Math.min(time / DAWN_MS, 1)));
      const span = still ? 1 : 0.1 + 0.9 * easeOut(Math.min(Math.max((time - 120) / 1600, 0), 1));
      const phase = (Math.max(time - DAWN_MS, 0) / SWAY_MS) % 2;
      const sway = still ? 0.5 : 0.5 - 0.5 * Math.cos(Math.PI * (phase < 1 ? phase : 2 - phase));
      const picture = `${width}x${height}@${density} ${rise.toFixed(2)} ${span.toFixed(3)} ${sway.toFixed(4)}`;

      if (picture === painted) return false;

      painted = picture;

      const { band, bandY, horizon } = drawnArt;
      const bandTop = bandY - band / 2;
      // The rays breathe about a point a little below the band's middle, as before.
      const centre = width / 2;
      const origin = bandTop + band * 0.56;

      const draw = (name: keyof Layers, top: number) => {
        const image = images[name];

        context.drawImage(raster(name, density), 0, top, image.naturalWidth, image.naturalHeight);
      };

      context.clearRect(0, 0, width, height);
      // The art was measured at the hero's size; a resize repaints it before it is measured again.
      context.scale(width / drawnArt.width, height / drawnArt.height);
      draw('sky', 0);
      draw('glow', bandTop + rise);
      context.save();
      context.translate(centre, origin + rise + 5 - 10 * sway);
      context.scale(1, 0.94 + 0.12 * sway);
      context.translate(-centre, -origin);
      draw('rays', bandTop);
      context.restore();
      draw('sea', horizon);
      context.save();
      context.translate(centre, 0);
      context.scale(span, 1);
      context.translate(-centre, 0);
      draw('horizon', horizon - HORIZON_STRIP);
      context.restore();
    };
  }, [layers]);
}
