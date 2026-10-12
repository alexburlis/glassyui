import fs from 'node:fs';
import path from 'node:path';

// Draws the desk and Duo's Vermilion wallpapers in public/wallpapers. A
// broad ribbon turns over once in the open middle, as the logo's band does, and an apricot band
// runs low across the dock, over silver swells. The ribbons cross the rims of the player, the
// control centre and the dock at a 1200 px desk, so every pane of glass has an edge to bend.

const WIDTH = 1600;

const HEIGHT = 1000;

// Each ribbon follows a smooth line through these points. A twist turns it over between two
// fractions of its length: its face narrows as it turns edge-on, then widens showing its back.
const RIBBONS = {
  broad: {
    points: [
      [-180, 196],
      [60, 236],
      [300, 356],
      [520, 530],
      [760, 626],
      [1000, 592],
      [1220, 474],
      [1440, 356],
      [1780, 282],
    ],
    width: 120,
    twist: [0.47, 0.68],
  },
  low: {
    points: [
      [-180, 850],
      [180, 912],
      [560, 920],
      [900, 868],
      [1200, 776],
      [1460, 684],
      [1780, 614],
    ],
    width: 58,
  },
};

const THEMES = {
  light: {
    base: ['#fbfbfc', '#e3e5e9'],
    glow: ['#ffffff', 0.95],
    swell: ['#e6e8ec', '#ffffff', '#e1e3e8'],
    band: ['#cfd2d8', '#ffffff', '#d3d6db'],
    shadow: 0.2,
    sheen: 0.32,
  },
  dark: {
    base: ['#36363b', '#1c1c1f'],
    glow: ['#45454c', 0.6],
    swell: ['#2c2c31', '#3d3d44', '#2a2a2f'],
    band: ['#3c3c43', '#64646c', '#3c3c43'],
    shadow: 0.5,
    sheen: 0.24,
  },
  'duo-light': {
    base: ['#c2c9d4', '#8e98a8'],
    glow: ['#e0e5ed', 0.8],
    swell: ['#aeb8c7', '#d8dfe8', '#99a5b7'],
    band: ['#8796ad', '#c7d1df', '#8091aa'],
    shadow: 0.3,
    sheen: 0.32,
  },
  'duo-dark': {
    base: ['#566275', '#394353'],
    glow: ['#7c889b', 0.55],
    swell: ['#435168', '#69778d', '#3e4d65'],
    band: ['#52647d', '#929fb2', '#4f627c'],
    shadow: 0.45,
    sheen: 0.26,
  },
};

const round = (value) => Number(value.toFixed(1));

const smoothstep = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// Points along a Catmull-Rom spline through the given points.
function spline(points, steps = 30) {
  const padded = [points[0], ...points, points[points.length - 1]];
  const line = [];

  for (let index = 1; index < padded.length - 2; index += 1) {
    const [p0, p1, p2, p3] = padded.slice(index - 1, index + 3);

    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;

      const axis = (k) =>
        0.5 *
        (2 * p1[k] +
          (p2[k] - p0[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t +
          (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t * t * t);

      line.push([axis(0), axis(1)]);
    }
  }

  line.push(points[points.length - 1]);

  return line;
}

// A path through the points as cubic Bezier curves, closed or open.
function curve(points, closed) {
  const count = points.length;

  const at = (index) =>
    closed ? points[(index + count) % count] : points[Math.max(0, Math.min(count - 1, index))];

  let d = `M${round(points[0][0])} ${round(points[0][1])}`;

  for (let index = 0; index < (closed ? count : count - 1); index += 1) {
    const [p0, p1, p2, p3] = [at(index - 1), at(index), at(index + 1), at(index + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];

    d += `C${[...c1, ...c2, ...p2].map(round).join(' ')}`;
  }

  return closed ? `${d}Z` : d;
}

// Every fifth point and the last, which the curve through them still follows closely.
const sparse = (points) =>
  points.filter((_, index) => index % 5 === 0 || index === points.length - 1);

/**
 * The visible faces of a ribbon, front then back: each as an outline and its upper edge, which
 * catches the light. A turn lands one sample exactly edge-on, so the two faces meet at a point.
 */
function faces({ points, width, twist }) {
  const line = spline(points);
  let length = 0;

  const samples = line.map((point, index) => {
    const previous = line[Math.max(0, index - 1)];
    const next = line[Math.min(line.length - 1, index + 1)];
    const size = Math.hypot(next[0] - previous[0], next[1] - previous[1]);

    if (index > 0) length += Math.hypot(point[0] - previous[0], point[1] - previous[1]);

    // Points up the page for a ribbon running left to right.
    return {
      point,
      s: length,
      normal: [(next[1] - previous[1]) / size, (previous[0] - next[0]) / size],
    };
  });

  const turn = (s) =>
    twist ? Math.PI * smoothstep((s / length - twist[0]) / (twist[1] - twist[0])) : 0;

  const edges = (point, normal, angle) => {
    const half = Math.max(0.8, Math.abs(Math.cos(angle)) * (width / 2));

    return {
      upper: [point[0] + normal[0] * half, point[1] + normal[1] * half],
      lower: [point[0] - normal[0] * half, point[1] - normal[1] * half],
    };
  };

  const front = [];
  const back = [];

  samples.forEach(({ point, s, normal }, index) => {
    const previous = samples[index - 1];
    const angle = turn(s);

    if (previous && turn(previous.s) < Math.PI / 2 && angle > Math.PI / 2) {
      let low = previous.s;
      let high = s;

      for (let step = 0; step < 40; step += 1) {
        const middle = (low + high) / 2;

        if (turn(middle) < Math.PI / 2) low = middle;
        else high = middle;
      }

      const k = (low - previous.s) / (s - previous.s);
      const mix = (a, b) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      const tip = edges(mix(previous.point, point), mix(previous.normal, normal), Math.PI / 2);

      front.push(tip);
      back.push(tip);
    }

    (angle <= Math.PI / 2 ? front : back).push(edges(point, normal, angle));
  });

  // A ribbon that never turns shows only its front.
  return [front, back].flatMap((face) => {
    if (face.length < 2) return [];

    const upper = sparse(face.map((edge) => edge.upper));
    const lower = sparse(face.map((edge) => edge.lower));

    return [{ outline: curve([...upper, ...lower.reverse()], true), upper: curve(upper, false) }];
  });
}

function wallpaper(theme) {
  const broad = faces(RIBBONS.broad);
  const low = faces(RIBBONS.low);

  // The low band first, so the broad ribbon's shadow falls on it.
  const all = [
    ...low.map((face) => ({ ...face, fill: 'apricot', lip: 2.5, sheen: 26 })),
    ...broad.map((face, index) => ({
      ...face,
      fill: index === 0 ? 'front' : 'back',
      lip: 3,
      sheen: 54,
    })),
  ];

  const stops = (colours) =>
    colours
      .map(
        (colour, index) =>
          `<stop offset="${round(index / (colours.length - 1))}" stop-color="${colour}"/>`,
      )
      .join('');

  const defs = [
    `<linearGradient id="base" x2="0" y2="1">${stops(theme.base)}</linearGradient>`,
    `<radialGradient id="glow" cx=".5" cy=".36" r=".62"><stop stop-color="${theme.glow[0]}" stop-opacity="${theme.glow[1]}"/><stop offset="1" stop-color="${theme.glow[0]}" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="swell" x2="1" y2=".4">${stops(theme.swell)}</linearGradient>`,
    `<linearGradient id="band" x2="1" y2=".6">${stops(theme.band)}</linearGradient>`,
    // The front darkens as it turns away from the light; the back brightens as it comes round.
    `<linearGradient id="front" gradientUnits="userSpaceOnUse" x1="0" y1="200" x2="940" y2="610"><stop stop-color="#ffc6a0"/><stop offset=".32" stop-color="#ff7d52"/><stop offset=".72" stop-color="#f04a28"/><stop offset="1" stop-color="#b73016"/></linearGradient>`,
    `<linearGradient id="back" gradientUnits="userSpaceOnUse" x1="940" y1="610" x2="1600" y2="300"><stop stop-color="#a92a14"/><stop offset=".28" stop-color="#dc4127"/><stop offset=".7" stop-color="#ff7448"/><stop offset="1" stop-color="#ffab84"/></linearGradient>`,
    `<linearGradient id="apricot" gradientUnits="userSpaceOnUse" x1="0" y1="900" x2="1600" y2="620"><stop stop-color="#ffd9c0"/><stop offset=".5" stop-color="#ffac82"/><stop offset="1" stop-color="#ff8656"/></linearGradient>`,
    `<linearGradient id="lip" gradientUnits="userSpaceOnUse" x2="1600" y2="600"><stop stop-color="#fff8f2"/><stop offset=".5" stop-color="#ffd6bd"/><stop offset="1" stop-color="#ffb08c"/></linearGradient>`,
    '<filter id="drop" x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>',
    '<filter id="soft" x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>',
    ...all.flatMap((face, index) => [
      `<path id="f${index}" d="${face.outline}"/>`,
      `<path id="u${index}" d="${face.upper}"/>`,
      `<clipPath id="c${index}"><use href="#f${index}"/></clipPath>`,
    ]),
  ];

  const body = [
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#base)"/>`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>`,
    // Broad silver swells that catch the light behind the ribbons.
    '<path d="M-120 780C260 680 560 850 900 770S1380 580 1720 610" fill="none" stroke="url(#swell)" stroke-width="160"/>',
    '<path d="M-120 1010C240 990 420 912 760 912S1240 952 1720 836" fill="none" stroke="url(#band)" stroke-width="54"/>',
    ...all.map(
      (_, index) =>
        `<use href="#f${index}" opacity="${theme.shadow}" filter="url(#drop)" transform="translate(0 14)"/>`,
    ),
    // Each face, a soft sheen along its upper edge, and the lit lip of that edge.
    ...all.map(
      (face, index) =>
        `<use href="#f${index}" fill="url(#${face.fill})"/>` +
        `<use href="#u${index}" clip-path="url(#c${index})" fill="none" stroke="#fff" stroke-width="${face.sheen}" opacity="${theme.sheen}" filter="url(#soft)"/>` +
        `<use href="#u${index}" fill="none" stroke="url(#lip)" stroke-width="${face.lip}" stroke-linecap="round"/>`,
    ),
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="xMidYMid slice">
  <defs>
    ${defs.join('\n    ')}
  </defs>
  ${body.join('\n  ')}
</svg>
`;
}

for (const [name, theme] of Object.entries(THEMES)) {
  const file = path.join('public/wallpapers', `vermilion-desk-${name}.svg`);

  fs.writeFileSync(file, wallpaper(theme));
  console.log(`${file} ${fs.statSync(file).size} bytes`);
}
