import fs from 'node:fs/promises';

// Builds the ribbon SVGs in public/brand from its construction. The ribbon is a band laid on a
// superellipse and given one full twist: it turns edge-on at the top-left and bottom-right corners,
// so its front face runs over the top-right and its back face over the bottom-left. The back face is
// the front face turned 180 degrees about the centre, so each file stores one face outline.
const BRAND = 'public/brand';

const CENTRE = 32;

const EXPONENT = 4.4;

const FIT_TOLERANCE = 0.03;

// The detail cut is for 64 px and up; the compact cut thickens the band for favicons and menus.
const DETAIL = { radius: 22.3, width: 9, twist: 0.64 };

const COMPACT = { radius: 22, width: 10.4, twist: 0.58 };

const round = (value) => +value.toFixed(2);

const point = ([x, y]) => `${round(x)} ${round(y)}`;

// Polar superellipse: smooth everywhere, unlike the |cos t|^(2/n) parameterisation.
function centreline(radius, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const r = radius / (Math.abs(cos) ** EXPONENT + Math.abs(sin) ** EXPONENT) ** (1 / EXPONENT);

  return [CENTRE + r * cos, CENTRE + r * sin];
}

function ribbon({ radius, width, twist }) {
  const smoothstep = (u) =>
    u <= -1 ? 0 : u >= 1 ? 1 : 0.5 - 0.5 * Math.cos(((u + 1) / 2) * Math.PI);

  const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
  const bottomRight = Math.PI / 4;
  const topLeft = (5 * Math.PI) / 4;

  // How far the band has turned; it passes edge-on, at a quarter turn, at each pinch.
  const turn = (angle) =>
    Math.PI *
    (smoothstep(wrap(angle - bottomRight) / twist) + smoothstep(wrap(angle - topLeft) / twist));

  const edgeAt = (angle, side) => {
    const [x, y] = centreline(radius, angle);
    const [ax, ay] = centreline(radius, angle + 1e-5);
    const [bx, by] = centreline(radius, angle - 1e-5);
    const length = Math.hypot(ax - bx, ay - by);
    const offset = side * (width / 2) * Math.cos(turn(angle));

    return [x - ((ay - by) / length) * offset, y + ((ax - bx) / length) * offset];
  };

  // The front face runs from the top-left pinch over the top-right corner to the bottom-right pinch.
  const start = topLeft;
  const end = bottomRight + 2 * Math.PI;
  const corner = (start + end) / 2;
  const distance = ([x, y]) => Math.hypot(x - CENTRE, y - CENTRE);
  const outerSide = distance(edgeAt(corner, 1)) > distance(edgeAt(corner, -1)) ? 1 : -1;
  const outer = fitEdge(edgeAt, start, end, outerSide);
  const inner = fitEdge(edgeAt, start, end, -outerSide);

  const curves = (segments) =>
    segments.map((segment) => `C${segment.slice(1).map(point).join(' ')}`).join('');

  const outline = (outer, inner) => {
    const reversedInner = [...inner].reverse().map(([a, b, c, d]) => [d, c, b, a]);

    return `M${point(outer[0][0])}${curves(outer)}L${point(reversedInner[0][0])}${curves(reversedInner)}Z`;
  };

  // A Vermilion underside follows the full band from its lower-right pinch to a clean cut.
  // Build it from the same edges, then turn it with the back face in svgDocument.
  const accentStart = start;
  const accentEnd = start + 0.62;

  return {
    face: outline(outer, inner),
    accent: outline(
      fitEdge(edgeAt, accentStart, accentEnd, outerSide),
      fitEdge(edgeAt, accentStart, accentEnd, -outerSide),
    ),
  };
}

// A Catmull-Rom spline through the fewest samples that stays within tolerance of the true edge.
// Samples bunch up at the pinches, where the edge turns fastest.
function fitEdge(edgeAt, start, end, side) {
  const dense = Array.from({ length: 2401 }, (_, index) =>
    edgeAt(start + (end - start) * (index / 2400), side),
  );

  const distanceToEdge = ([px, py]) => {
    let nearest = Infinity;

    for (let index = 0; index < dense.length - 1; index++) {
      const [x1, y1] = dense[index];
      const [x2, y2] = dense[index + 1];
      const dx = x2 - x1;
      const dy = y2 - y1;

      const along = Math.max(
        0,
        Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1e-12)),
      );

      nearest = Math.min(nearest, Math.hypot(px - (x1 + along * dx), py - (y1 + along * dy)));
    }

    return nearest;
  };

  const bezierAt = (segment, u) => {
    const v = 1 - u;

    return [0, 1].map(
      (axis) =>
        v * v * v * segment[0][axis] +
        3 * v * v * u * segment[1][axis] +
        3 * v * u * u * segment[2][axis] +
        u * u * u * segment[3][axis],
    );
  };

  for (let count = 8; count <= 80; count += 2) {
    const samples = Array.from({ length: count + 1 }, (_, index) =>
      edgeAt(start + (end - start) * (0.5 - 0.5 * Math.cos(Math.PI * (index / count))), side),
    );

    const segments = samples.slice(0, -1).map((current, index) => {
      const previous = samples[Math.max(index - 1, 0)];
      const next = samples[index + 1];
      const after = samples[Math.min(index + 2, count)];

      return [
        current,
        [current[0] + (next[0] - previous[0]) / 6, current[1] + (next[1] - previous[1]) / 6],
        [next[0] - (after[0] - current[0]) / 6, next[1] - (after[1] - current[1]) / 6],
        next,
      ];
    });

    const error = Math.max(
      ...segments.flatMap((segment) =>
        Array.from({ length: 11 }, (_, index) =>
          distanceToEdge(bezierAt(segment, (index + 1) / 12)),
        ),
      ),
    );

    if (error < FIT_TOLERANCE) {
      return segments;
    }
  }

  throw new Error('The ribbon edge did not fit within tolerance.');
}

// Flat silhouettes keep the twist in the outline, with no painted light or shadow.
function svgDocument(
  { face, accent },
  { color = '#000', tile = false, adaptive = false, monochrome = false } = {},
) {
  const colorAttribute = color === 'currentColor' ? '' : ` color="${color}"`;

  const theme = adaptive
    ? '\n  <style>@media (prefers-color-scheme: dark) { :root { color: #fff; } }</style>'
    : '';

  const background = tile ? '\n  <path fill="#fff" d="M0 0h64v64H0z"/>' : '';

  const transform = tile ? ' transform="translate(32 32) scale(.72) translate(-32 -32)"' : '';

  const fold = monochrome
    ? ''
    : `\n    <path fill="#f04a28" d="${accent}" transform="rotate(180 32 32)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"${colorAttribute}>
  <title>Glassy UI</title>${theme}${background}
  <g fill="currentColor"${transform}>
    <path d="${face}" transform="rotate(180 32 32)"/>
    <path d="${face}"/>${fold}
  </g>
</svg>\n`;
}

const detail = ribbon(DETAIL);

const compact = ribbon(COMPACT);

await fs.writeFile(`${BRAND}/glassyui-logo.svg`, svgDocument(detail));

await fs.writeFile(`${BRAND}/glassyui-logo-white.svg`, svgDocument(compact, { color: '#fff' }));

await fs.writeFile(`${BRAND}/glassyui-logo-compact.svg`, svgDocument(compact));

await fs.writeFile(
  `${BRAND}/glassyui-glyph.svg`,
  svgDocument(compact, { color: 'currentColor', monochrome: true }),
);

await fs.writeFile(`${BRAND}/glassyui-app-icon.svg`, svgDocument(detail, { tile: true }));

// An SVG favicon follows the browser appearance, independently of the site's saved theme.
await fs.writeFile('src/app/icon.svg', svgDocument(compact, { adaptive: true }));
