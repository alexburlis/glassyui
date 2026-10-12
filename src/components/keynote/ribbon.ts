// The ribbon from its construction in scripts/build-brand-mark.mjs, sampled so the keynote can
// draw it on a canvas as well as in SVG. Detail cut, on a 64-unit canvas.
const CENTRE = 32;

const EXPONENT = 4.4;

const RADIUS = 22.3;

const WIDTH = 9;

const TWIST = 0.64;

const BOTTOM_RIGHT = Math.PI / 4;

const TOP_LEFT = (5 * Math.PI) / 4;

// The Vermilion underside follows the band for this far past the lower-right pinch.
const ACCENT = 0.62;

const STEPS = 720;

const smoothstep = (u: number) =>
  u <= -1 ? 0 : u >= 1 ? 1 : 0.5 - 0.5 * Math.cos(((u + 1) / 2) * Math.PI);

const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

function centreline(angle: number): [number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const r = RADIUS / (Math.abs(cos) ** EXPONENT + Math.abs(sin) ** EXPONENT) ** (1 / EXPONENT);

  return [CENTRE + r * cos, CENTRE + r * sin];
}

// How far the band has turned: edge-on, a quarter turn, at each pinch.
const turn = (angle: number) =>
  Math.PI *
  (smoothstep(wrap(angle - BOTTOM_RIGHT) / TWIST) + smoothstep(wrap(angle - TOP_LEFT) / TWIST));

function edge(angle: number, side: 1 | -1): [number, number] {
  const [x, y] = centreline(angle);
  const [ax, ay] = centreline(angle + 1e-5);
  const [bx, by] = centreline(angle - 1e-5);
  const length = Math.hypot(ax - bx, ay - by);
  const offset = side * (WIDTH / 2) * Math.cos(turn(angle));

  return [x - ((ay - by) / length) * offset, y + ((ax - bx) / length) * offset];
}

const format = ([x, y]: [number, number]) => `${x.toFixed(3)} ${y.toFixed(3)}`;

// One edge out and the other back. The edges cross at each pinch, where the band is edge-on;
// the default nonzero fill keeps both lobes.
function band(from: number, to: number) {
  const count = Math.max(2, Math.ceil((STEPS * (to - from)) / (2 * Math.PI)));

  const angles = Array.from(
    { length: count + 1 },
    (_, index) => from + ((to - from) * index) / count,
  );

  const outer = angles.map((angle) => format(edge(angle, 1)));
  const inner = angles.reverse().map((angle) => format(edge(angle, -1)));

  return `M${outer.join('L')}L${inner.join('L')}Z`;
}

/** The whole band, from the top-left pinch clockwise back to it. */
export const RIBBON_BAND = band(TOP_LEFT, TOP_LEFT + 2 * Math.PI);

/** The Vermilion fold, just past the lower-right pinch. */
export const RIBBON_FOLD = band(BOTTOM_RIGHT + 2 * Math.PI, BOTTOM_RIGHT + 2 * Math.PI + ACCENT);

/** The fold's colour, the logo's one accent. */
export const VERMILION = '#f04a28';
