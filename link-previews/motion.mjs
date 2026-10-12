// The choreography of both loops: every pose, light and camera move is a pure function of
// playback time that repeats exactly every DURATION seconds, so the last frame flows into the
// first. World units are pixels; y points down and z towards the viewer. The real desk capture
// lies on the z = 0 plane, the iOS capture of the React Native fixture stands in front of its
// right edge, and one pill of clear glass rests on the product, springs to its next stop and
// returns. The helpers (timing curves, springs, orbit camera, projection, lens samples) are the
// Through glass film's.
import { COPY, CUT, DURATION, HEIGHT, WIDTH } from './timeline.mjs';

const TAU = Math.PI * 2;

export const clamp01 = (u) => Math.max(0, Math.min(1, u));

export const lerp = (a, b, u) => a + (b - a) * u;

export const mix3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

/** A cubic Bézier timing curve, as CSS and After Effects define them. */
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1,
    bx = 3 * (x2 - x1) - cx,
    ax = 1 - cx - bx;

  const cy = 3 * y1,
    by = 3 * (y2 - y1) - cy,
    ay = 1 - cy - by;

  const x = (s) => ((ax * s + bx) * s + cx) * s;
  const y = (s) => ((ay * s + by) * s + cy) * s;
  const dx = (s) => (3 * ax * s + 2 * bx) * s + cx;

  return (u) => {
    if (u <= 0) return 0;

    if (u >= 1) return 1;
    let s = u;

    for (let index = 0; index < 8; index += 1) {
      const error = x(s) - u;
      const slope = dx(s);

      if (Math.abs(error) < 1e-6 || Math.abs(slope) < 1e-6) break;
      s -= error / slope;
    }

    return y(clamp01(s));
  };
}

export const ease = {
  outExpo: bezier(0.16, 1, 0.3, 1),
  inOutQuart: bezier(0.76, 0, 0.24, 1),
  inOut: bezier(0.65, 0, 0.35, 1),
};

/** A spring settle from 0 to 1: damping ratio 1 − bounce, as Apple parameterizes springs. */
export function spring(age, duration, bounce = 0.12) {
  if (age <= 0) return 0;
  const zeta = 1 - bounce;
  const omega = TAU / duration;
  const decay = Math.exp(-zeta * omega * age);
  const omegaD = omega * Math.sqrt(Math.max(1e-6, 1 - zeta * zeta));

  return 1 - decay * (Math.cos(omegaD * age) + ((zeta * omega) / omegaD) * Math.sin(omegaD * age));
}

export function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;

  return x - Math.floor(x);
}

/** Playback time folded into one loop. */
const loop = (t) => ((t % DURATION) + DURATION) % DURATION;

/**
 * Smooth drift in about [-1, 1] for a hand-held camera: three harmonics of the loop at seeded
 * phases, so it repeats exactly with the take.
 */
function drift(t, seed) {
  const u = (TAU * t) / DURATION;
  const phase = (k) => hash(seed * 31 + k) * TAU;

  return (
    0.55 * Math.sin(u + phase(1)) +
    0.3 * Math.sin(2 * u + phase(2)) +
    0.15 * Math.sin(3 * u + phase(3))
  );
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const normalize = (v) => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;

  return [v[0] / length, v[1] / length, v[2] / length];
};

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const scale = (v, s) => [v[0] * s, v[1] * s, v[2] * s];

/** Column-major local-to-world rotation (Rz·Ry·Rx); the shaders and projections share it. */
export function rotation([x, y, z]) {
  const cx = Math.cos(x),
    sx = Math.sin(x);

  const cy = Math.cos(y),
    sy = Math.sin(y);

  const cz = Math.cos(z),
    sz = Math.sin(z);

  return [
    cz * cy,
    sz * cy,
    -sy,
    cz * sy * sx - sz * cx,
    sz * sy * sx + cz * cx,
    cy * sx,
    cz * sy * cx + sz * sx,
    sz * sy * cx - cz * sx,
    cy * cx,
  ];
}

export const rotate = (m, [x, y, z]) => [
  m[0] * x + m[3] * y + m[6] * z,
  m[1] * x + m[4] * y + m[7] * z,
  m[2] * x + m[5] * y + m[8] * z,
];

// ---------------------------------------------------------------------------------------------
// The world

// The homepage desk, captured at 4× from its 1200 × 750 CSS-pixel layout, lies on z = 0.
const DESK_SCALE = 1.6;

export const DESK = { center: [960, 540, 0], half: [960, 600], corner: 22 };

/** A point on the desk, from the page's CSS pixels. */
export const desk = (x, y, z = 0) => [x * DESK_SCALE, y * DESK_SCALE - 60, z];

// Measured from the page: rectangles in CSS pixels and their corner radii.
const WIDGETS = [
  { x: 28, y: 56, w: 320, h: 186.3, r: 24, kind: 'panel' },
  { x: 842, y: 56, w: 330, h: 350.9, r: 24, kind: 'panel' },
  { x: 263.5, y: 662, w: 673, h: 76, r: 26, kind: 'dock' },
];

// The iOS capture of the React Native fixture, standing in front of the desk's right edge.
export const PHONE = {
  center: [1900, 760, 640],
  half: [214, 465],
  yaw: -0.2,
  corner: 54,
};

const onPhone = (x, y, depth) =>
  add(PHONE.center, rotate(rotation([0, PHONE.yaw, 0]), [x, y, depth]));

// The Today screen's segmented control, in the phone's own frame: measured from the capture.
const SEGMENTS = { day: [-127, -275], week: [0, -275], month: [126, -275], depth: 50 };

// ---------------------------------------------------------------------------------------------
// Each cut: its camera, the pill's stops and the type's place.

const CUTS = {
  // A low macro along the dock, the type on the soft wallpaper above it. The pill rests across
  // Calendar and Maps, springs back along the icons to Photos and returns.
  home: {
    shot: {
      target: desk(575, 652),
      dist: 1180,
      focal: 2300,
      yaw: 0.27,
      pitch: -0.2,
      aperture: 40,
      orbit: 0.018,
      tilt: 0.006,
      breathe: 0.012,
      focusOn: 'pill',
    },
    pill: { size: 1, start: desk(652, 699, 54), turn: [0.04, 0.1, -0.03] },
    stops: [
      { at: 0.9, to: desk(512, 701, 54), duration: 1.55, bounce: 0.12, swell: 0.1 },
      { at: 3.6, to: desk(652, 699, 54), duration: 1.55, bounce: 0.12, swell: 0.1 },
    ],
    sprites: ['desk'],
  },
  // The phone's upper half on the right, the desk soft behind it. The pill rests on Day, springs
  // to Week and Month, then glides back to Day, swelling while it slides as the system's own
  // glass does under a finger.
  mobile: {
    shot: {
      target: [1578, 583, 640],
      dist: 2250,
      focal: 2350,
      yaw: -0.22,
      pitch: 0.03,
      aperture: 60,
      orbit: 0.02,
      tilt: 0.006,
      breathe: 0.01,
      focusOn: 'phone',
    },
    pill: { size: 0.62, start: onPhone(...SEGMENTS.day, SEGMENTS.depth), turn: [0, PHONE.yaw, 0] },
    stops: [
      {
        at: 0.7,
        to: onPhone(...SEGMENTS.week, SEGMENTS.depth),
        duration: 0.75,
        bounce: 0.15,
        swell: 0.14,
      },
      {
        at: 2.2,
        to: onPhone(...SEGMENTS.month, SEGMENTS.depth),
        duration: 0.75,
        bounce: 0.15,
        swell: 0.14,
      },
      {
        at: 3.9,
        to: onPhone(...SEGMENTS.day, SEGMENTS.depth),
        duration: 1.1,
        bounce: 0.12,
        swell: 0.18,
      },
    ],
    sprites: ['desk', 'phone'],
    // The soft desk behind the type is busy: a pool of ivory light lets the lines read on it.
    scrim: { center: [290, 185], half: [470, 260], opacity: 0.9 },
  },
};

const SCENE = CUTS[CUT];

/**
 * The pill's travel: each stop springs from the previous one. A stop that has not started yet
 * this loop is still settling from the last loop, so the track repeats exactly.
 */
function track(t) {
  const u = loop(t);
  const { start } = SCENE.pill;
  const stops = SCENE.stops;
  let p = start;
  let swell = 0;

  stops.forEach((stop, index) => {
    const from = index === 0 ? stops[stops.length - 1].to : stops[index - 1].to;
    const delta = sub(stop.to, from);
    const age = u >= stop.at ? u - stop.at : u + DURATION - stop.at;
    const settle = spring(age, stop.duration, stop.bounce);
    // Moves that began last loop are complete except for what is still settling.
    const done = u >= stop.at ? settle : settle - 1;

    p = add(p, scale(delta, done));
    swell += stop.swell * Math.sin(Math.PI * clamp01(age / (stop.duration * 0.9)));
  });

  return { p, swell };
}

// ---------------------------------------------------------------------------------------------
// Camera

function orbit(target, dist, yaw, pitch, roll) {
  const eye = add(target, [
    dist * Math.sin(yaw) * Math.cos(pitch),
    -dist * Math.sin(pitch),
    dist * Math.cos(yaw) * Math.cos(pitch),
  ]);

  const forward = normalize([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
  const right0 = normalize(cross(forward, [0, 1, 0]));
  const down0 = cross(right0, forward);
  const right = add(scale(right0, Math.cos(roll)), scale(down0, Math.sin(roll)));
  const down = add(scale(right0, -Math.sin(roll)), scale(down0, Math.cos(roll)));

  return { eye, right, down, forward };
}

/** The camera's position and orientation alone: a slow orbit and breath, held by hand. */
function basisAt(t) {
  const shot = SCENE.shot;
  const u = (TAU * t) / DURATION;
  const hand = [drift(t, 1) * 4, drift(t, 2) * 3, 0];
  const roll = drift(t, 3) * 0.002;

  return {
    ...orbit(
      add(shot.target, hand),
      shot.dist * (1 + shot.breathe * Math.sin(u + 4.0)),
      shot.yaw + shot.orbit * Math.sin(u + 0.6),
      shot.pitch + shot.tilt * Math.sin(u + 2.1),
      roll,
    ),
    focal: shot.focal,
    shot,
  };
}

export function cameraAt(t) {
  const basis = basisAt(t);
  const { shot } = basis;
  let point = shot.target;

  if (shot.focusOn === 'pill') {
    const pill = pillAt(t);
    point = [pill.x, pill.y, pill.z];
  } else if (shot.focusOn === 'phone') {
    point = onPhone(...SEGMENTS.week, 0);
  }

  return {
    eye: basis.eye,
    right: basis.right,
    down: basis.down,
    forward: basis.forward,
    focal: basis.focal,
    cx: WIDTH / 2,
    cy: HEIGHT / 2,
    focus: Math.max(200, dot(sub(point, basis.eye), basis.forward)),
    aperture: shot.aperture,
  };
}

/** A camera moved across its aperture and jittered within a pixel, for one sub-frame. */
export function lensSample(camera, jitter, disc) {
  const ax = disc[0] * camera.aperture;
  const ay = disc[1] * camera.aperture;

  return {
    ...camera,
    eye: add(camera.eye, add(scale(camera.right, ax), scale(camera.down, ay))),
    cx: camera.cx + jitter[0] + (camera.focal * ax) / camera.focus,
    cy: camera.cy + jitter[1] + (camera.focal * ay) / camera.focus,
  };
}

export function projectPoint(camera, p) {
  const d = [p[0] - camera.eye[0], p[1] - camera.eye[1], p[2] - camera.eye[2]];
  const z = dot(d, camera.forward);

  return [
    camera.cx + (camera.focal * dot(d, camera.right)) / z,
    camera.cy + (camera.focal * dot(d, camera.down)) / z,
    z,
  ];
}

// ---------------------------------------------------------------------------------------------
// The glass pill

const PILL = { hw: 150, hh: 58, hz: 36, radius: 58, bevel: 30 };

export function pillAt(t) {
  const { p: base, swell } = track(t);
  // At rest it floats: a few pixels of slow bob, two and three times a loop.
  const u = (TAU * t) / DURATION;
  const bob = [Math.sin(2 * u + 0.4) * 4, Math.sin(3 * u + 1.3) * 3, 0];
  const p = add(base, scale(bob, SCENE.pill.size));
  // Light catches it as it slides: a slight turn into the direction of travel.
  const turn = SCENE.pill.turn;
  const size = SCENE.pill.size * (1 + swell);

  return {
    x: p[0],
    y: p[1],
    z: p[2],
    hw: PILL.hw * size,
    hh: PILL.hh * size,
    hz: PILL.hz * size,
    radius: PILL.radius * size,
    bevel: PILL.bevel * size,
    sphere: 0,
    turn,
    alpha: 1,
    lens: 1,
    glint: 1,
    depthBehind: 90,
    dispersion: 1,
    shadowDepth: 0,
    shadowOffset: [0.012, -0.02],
  };
}

export function bodiesAt(t) {
  return [pillAt(t)];
}

// ---------------------------------------------------------------------------------------------
// Light

/** The key light travels once around the glass every loop, so its rim light never jumps. */
export function keyAt(t) {
  const angle = -2.3 + (TAU * t) / DURATION;

  return normalize([Math.cos(angle) * 0.8, Math.sin(angle) * 0.8 - 0.25, 0.75]);
}

export function studioAt() {
  // Ivory, as the site's light appearance: never pure white.
  return { tone: [0.905, 0.896, 0.872], floor: 0.86 };
}

// ---------------------------------------------------------------------------------------------
// Planes, rims and type

const INK = [0.0159, 0.0159, 0.0176];

// The site's tertiary text, #66666a, in linear light: the headline's second line steps back.
const TERTIARY = [0.1329, 0.1329, 0.1413];

function deskSprite() {
  return {
    texture: 'desk',
    mode: 'capture',
    center: DESK.center,
    axes: [
      [DESK.half[0], 0, 0],
      [0, DESK.half[1], 0],
    ],
    corner: [DESK.half[0], DESK.half[1], DESK.corner],
    shade: true,
    sheen: [0, 1, 0, 0],
  };
}

function phoneSprite() {
  const m = rotation([0, PHONE.yaw, 0]);

  return {
    texture: 'phone',
    mode: 'capture',
    center: PHONE.center,
    axes: [rotate(m, [PHONE.half[0], 0, 0]), rotate(m, [0, PHONE.half[1], 0])],
    corner: [PHONE.half[0], PHONE.half[1], PHONE.corner],
    shade: true,
  };
}

/** Light running slowly around the rims of the real glass panels, once a loop. */
export function rimsFor(t) {
  const angle = -2.4 + (TAU * t) / DURATION;
  const light = [Math.cos(angle), Math.sin(angle)];

  return WIDGETS.map((widget) => {
    const half = [(widget.w / 2) * DESK_SCALE + 6, (widget.h / 2) * DESK_SCALE + 6];

    return {
      center: desk(widget.x + widget.w / 2, widget.y + widget.h / 2, 0.6),
      axes: [
        [half[0], 0, 0],
        [0, half[1], 0],
      ],
      half,
      radius: widget.r * DESK_SCALE,
      light,
      power: 0.85,
    };
  });
}

/** Type set in frame pixels from its pen position and baseline. It never moves: a loop has no
 * entrance, and the poster frame must already carry it. */
function line(metrics, name, x, baseline, tint) {
  const m = metrics[name];

  return {
    texture: name,
    mode: 'text',
    screen: true,
    center: [x - m.origin + m.width / 2, baseline - m.baseline + m.height / 2, 0],
    axes: [
      [m.width / 2, 0, 0],
      [0, m.height / 2, 0],
    ],
    tint,
    slide: [0, 0],
  };
}

// The share-image lockup from DESIGN.md: a 44 px mark beside a 30 px semibold wordmark, 14 px
// apart, centred on the text.
export const LOCKUP = { x: 64, centre: 76, mark: 44, gap: 14 };

// The headline sits under the lockup on clean space, the second line in the tertiary colour.
export const TYPE = { x: 64, first: 196, second: 276 };

export const MARK_SIZE = LOCKUP.mark;

export function spritesAt(t, metrics) {
  const backdrop = [];

  if (SCENE.sprites.includes('desk')) backdrop.push(deskSprite());

  if (SCENE.sprites.includes('phone')) backdrop.push(phoneSprite());

  if (SCENE.scrim) {
    backdrop.push({
      texture: 'headline',
      mode: 'scrim',
      screen: true,
      center: [...SCENE.scrim.center, 0],
      axes: [
        [SCENE.scrim.half[0], 0, 0],
        [0, SCENE.scrim.half[1], 0],
      ],
      tint: [0.92, 0.912, 0.89],
      opacity: SCENE.scrim.opacity,
    });
  }

  backdrop.push({
    texture: 'mark',
    mode: 'art',
    screen: true,
    center: [LOCKUP.x + LOCKUP.mark / 2, LOCKUP.centre, 0],
    axes: [
      [LOCKUP.mark / 2, 0, 0],
      [0, LOCKUP.mark / 2, 0],
    ],
  });
  // The wordmark's x-height centred on the mark.
  backdrop.push(
    line(metrics, 'name', LOCKUP.x + LOCKUP.mark + LOCKUP.gap, LOCKUP.centre + 11, INK),
  );
  backdrop.push(line(metrics, 'headline', TYPE.x - 3, TYPE.first, INK));
  backdrop.push(line(metrics, 'second', TYPE.x - 3, TYPE.second, TERTIARY));

  return { backdrop, overlay: [] };
}

/** The text the film bakes: name, words, size and tracking in ems. */
export const TEXTS = {
  name: { text: 'Glassy UI', size: 30, tracking: 0.012 },
  headline: { text: COPY.headline, size: 76, tracking: -0.015 },
  second: { text: COPY.second, size: 76, tracking: -0.015 },
};

// ---------------------------------------------------------------------------------------------
// Sampling

/** The widest defocus blur, in frame pixels, on any visible part of the desk, phone or pill. */
export function defocusAt(t) {
  const camera = cameraAt(t);
  let widest = 0;

  if (!camera.aperture) return widest;

  const consider = (point) => {
    const [x, y, depth] = projectPoint(camera, point);

    if (depth <= 0 || x < 0 || x > WIDTH || y < 0 || y > HEIGHT) return;
    widest = Math.max(
      widest,
      camera.aperture * camera.focal * Math.abs(1 / camera.focus - 1 / depth),
    );
  };

  for (let i = 0; i <= 8; i += 1)
    for (let j = 0; j <= 8; j += 1) consider(desk(i * 150, j * 93.75));

  if (SCENE.sprites.includes('phone')) {
    for (let i = -1; i <= 1; i += 0.5)
      for (let j = -1; j <= 1; j += 0.25)
        consider(onPhone(i * PHONE.half[0], j * PHONE.half[1], 0));
  }

  const pill = pillAt(t);
  consider([pill.x, pill.y, pill.z]);

  return widest;
}

/** Screen points that move with the fastest parts of the picture, by stable id. */
export function probePoints(t) {
  const camera = cameraAt(t);
  const points = new Map();
  const pill = pillAt(t);
  const m = rotation(pill.turn);

  [
    [0, 0, 0],
    [pill.hw, pill.hh, pill.hz],
    [-pill.hw, pill.hh, -pill.hz],
    [pill.hw, -pill.hh, 0],
  ].forEach((corner, index) => {
    const offset = rotate(m, corner);
    points.set(
      `pill:${index}`,
      projectPoint(camera, [pill.x + offset[0], pill.y + offset[1], pill.z + offset[2]]),
    );
  });

  [
    [0, 0],
    [1920, 0],
    [0, 1200],
    [1920, 1200],
    [960, 600],
  ].forEach(([x, y], index) => points.set(`desk:${index}`, projectPoint(camera, [x, y - 60, 0])));

  return points;
}

export { TAU };
