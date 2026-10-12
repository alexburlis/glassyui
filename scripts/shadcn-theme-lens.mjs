// The rim lens of the Glassy UI theme for shadcn/ui: Glassy UI's own Chromium lens
// (useLensFilter in registry/glassyui/lib/use-refraction-filter.tsx) without the
// script that measures each element.
//
// The components draw a map for each element from its measured size; a theme
// cannot measure, so each filter derives its map from the element's own box. The
// box, flooded and blurred, tells every pixel how deep into the glass it sits
// (A = Phi(d / sigma) along a straight edge). A table turns that depth into a
// height whose slope is the components' inward offset at that depth, and an
// offset of one CSS pixel reads the slope, so the map is the same at any pixel
// density. (A convolution would read it per device pixel and bend half as far
// on a 2x screen.)
// The offsets come from the components' rim profile, ported below from
// registry/glassyui/lib/refraction-map.ts (slabOffset and lensProfile).
//
// `node scripts/build-shadcn-theme.mjs` writes glassy-lens.svg from here, and
// `--check` fails when it is stale.

// The components' defaults: the rim is as wide as the corner radius, the glass is
// 1.4 times as thick as its rim, with an index of 1.5, and splits by 0.16. They
// bend red, green and blue by 0.92, 1 and 1.08 of the offset. On a card the theme
// bends red by 0.92 and green with blue by 1.04, their mean; buttons bend as one,
// by 1. Every pass costs frames: scrolling a dashboard with ten cards and five
// clear buttons over artwork in Chrome, nearly every frame ran late with three
// colours, one in ten with two colours on buttons too, and none like this.
const THICKNESS_RATIO = 1.4;

const IOR = 1.5;

const DISPERSION = 0.16;

// From refraction-map.ts.
const LENS_AIR_GAP = 8;

const LENS_REACH = 0.7;

const LENS_FOLD = 0.75;

const LENS_PROFILE_STEPS = 512;

// A rim is as wide as the corner it rounds: 14 px on shadcn's cards (rounded-xl),
// and half the height on a pill, so each stock button height gets its own lens.
const LENS_FILTERS = [
  {
    id: 'pane',
    bevel: 14,
    sigma: 8,
    split: true,
    note: "Cards and alerts: a 14 px rim, the corner of shadcn's default card",
  },
  {
    id: 'slab',
    bevel: 18,
    sigma: 9,
    note: 'Buttons 36 px tall (h-9, size-9) and any other height',
  },
  { id: 'slab-12', bevel: 12, sigma: 6, note: 'Buttons 24 px tall (h-6, size-6)' },
  { id: 'slab-14', bevel: 14, sigma: 7, note: 'Buttons 28 px tall (h-7, size-7)' },
  { id: 'slab-16', bevel: 16, sigma: 8, note: 'Buttons 32 px tall (h-8, size-8)' },
  { id: 'slab-20', bevel: 20, sigma: 10, note: 'Buttons 40 px tall (h-10, size-10)' },
];

function slabOffset(s, bevel, thickness, ior) {
  const u = s / bevel;
  const v = 1 - Math.max(u, 0.002);
  let rise = 1;
  let steepness = 0;

  if (u < 1) {
    const v4 = v ** 4;

    rise = (1 - v4) ** 0.25;
    steepness = v ** 3 * Math.max(1 - v4, 1e-6) ** -0.75;
  }

  const slope = Math.min(((0.7 * thickness) / bevel) * steepness, 12);
  const height = thickness * (0.3 + 0.7 * rise);
  const tilt = Math.hypot(slope, 1);
  const sinTilt = slope / tilt;
  const cosTilt = 1 / tilt;
  const eta = 1 / ior;
  const root = Math.sqrt(Math.max(1 - eta * eta * sinTilt * sinTilt, 0));
  const bend = eta * cosTilt - root;
  const along = bend * sinTilt;
  const down = Math.max(eta - bend * cosTilt, 0.05);
  const sinOut = ior * Math.abs(along);
  const cosOut = Math.sqrt(Math.max(1 - sinOut * sinOut, 0));
  const leaving = (ior * along) / Math.max(sinOut, 1);

  return -(along * (height / down) + leaving * (LENS_AIR_GAP / Math.max(cosOut, 0.1)));
}

// The inward offset, in CSS pixels, at each depth into the rim.
function lensProfile(bevel) {
  const thickness = bevel * THICKNESS_RATIO;
  const cap = LENS_REACH * bevel;
  const step = bevel / LENS_PROFILE_STEPS;
  const offsets = new Float64Array(LENS_PROFILE_STEPS + 1);

  for (let index = 0; index < LENS_PROFILE_STEPS; index += 1) {
    offsets[index] = cap * Math.tanh(slabOffset(index * step, bevel, thickness, IOR) / cap);
  }

  for (let index = LENS_PROFILE_STEPS - 1; index >= 0; index -= 1) {
    offsets[index] = Math.min(offsets[index], offsets[index + 1] + LENS_FOLD * step);
  }

  return (depth) => {
    if (depth >= bevel) return 0;

    return offsets[Math.round((Math.max(depth, 0) / bevel) * LENS_PROFILE_STEPS)];
  };
}

// The standard normal distribution and its inverse, closely enough for 8-bit maps.
function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));

  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);

  return x >= 0 ? y : -y;
}

const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

function inversePhi(p) {
  let low = -8;
  let high = 8;

  for (let index = 0; index < 60; index += 1) {
    const middle = (low + high) / 2;

    if (phi(middle) < p) low = middle;
    else high = middle;
  }

  return (low + high) / 2;
}

const round = (value, places) => Math.round(value * 10 ** places) / 10 ** places;

function filter({ id, bevel, sigma, split = false, note }) {
  const offset = lensProfile(bevel);

  // The height at a depth is the offset summed from the edge to that depth.
  const height = (depth) => {
    const top = Math.min(depth, bevel);
    const slices = 400;
    let sum = 0;

    for (let index = 0; index < slices; index += 1) {
      sum += offset(((index + 0.5) / slices) * top) * (top / slices);
    }

    return sum;
  };

  const total = height(bevel);
  const table = [];

  // The table runs over the blurred box's alpha, which is 0.5 at the edge.
  for (let index = 0; index <= 100; index += 1) {
    const alpha = index / 100;

    table.push(
      alpha <= 0.5 ? 0 : alpha >= 1 ? 1 : round(height(sigma * inversePhi(alpha)) / total, 4),
    );
  }

  // The map holds 0.5 + T(x + 1) - T(x), about 0.5 + T' half a pixel along, and
  // T' is the offset over the total height, so a scale of the total gives the
  // offset. (Centring it cost frames.)
  const scale = (factor) => round(total * factor, 2);

  // Red and cyan bent apart, added as opaque colour, then given the page's alpha
  // back: inside a frosted header or dialog the page is see-through, and adding
  // translucent copies would turn it grey.
  const splitPasses = `    <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale(1 - DISPERSION / 2)}" xChannelSelector="R" yChannelSelector="G" result="r"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale(1 + DISPERSION / 4)}" xChannelSelector="R" yChannelSelector="G" result="gb"/>
    <feColorMatrix in="r" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1" result="red"/>
    <feColorMatrix in="gb" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 1" result="cyan"/>
    <feComposite in="red" in2="cyan" operator="arithmetic" k2="1" k3="1" result="split"/>
    <feComposite in="split" in2="gb" operator="in"/>`;

  const bendPass = `    <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale(1)}" xChannelSelector="R" yChannelSelector="G"/>`;

  return `  <!-- ${note}, reading the page from up to ${round(offset(0), 1)} px further in. -->
  <filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feFlood flood-color="#fff" result="box"/>
    <feGaussianBlur in="box" stdDeviation="${sigma}" edgeMode="none" result="depth"/>
    <feComponentTransfer in="depth" result="height">
      <feFuncA type="table" tableValues="${table.join(' ')}"/>
    </feComponentTransfer>
    <feOffset in="height" dx="-1" result="east"/>
    <feOffset in="height" dy="-1" result="south"/>
    <feComposite in="east" in2="height" operator="arithmetic" k2="1" k3="-1" k4="0.5" result="across"/>
    <feComposite in="south" in2="height" operator="arithmetic" k2="1" k3="-1" k4="0.5" result="down"/>
    <feColorMatrix in="across" type="matrix" values="0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1" result="x"/>
    <feColorMatrix in="down" type="matrix" values="0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 1" result="y"/>
    <feComposite in="x" in2="y" operator="arithmetic" k2="1" k3="1" result="map"/>
${split ? splitPasses : bendPass}
  </filter>`;
}

export function lensSvg() {
  return `<!-- Written by \`node scripts/build-shadcn-theme.mjs\` from
     scripts/shadcn-theme-lens.mjs; edit that file, not this one.

     The rim lens of the Glassy UI theme for shadcn/ui: Glassy UI's own Chromium
     lens, without the script that measures each element. Wherever
     glassy-theme.css says url('./glassy-lens.svg#<id>'), the build writes that one
     filter into the registry item as a data: URL, so the item stays CSS only.

     The theme frosts the page first (blur() before url()), so each filter bends
     frosted glass, as the components do: the element's own box, flooded and
     blurred, is turned into the components' rim profile, read across and down.
     On cards red bends by 0.92 of it and green with blue by 1.04; buttons bend
     as one. Only Chromium renders SVG filters in backdrop-filter, so the theme
     applies these in Chromium alone. -->
<svg xmlns="http://www.w3.org/2000/svg">
${LENS_FILTERS.map(filter).join('\n')}
</svg>
`;
}
