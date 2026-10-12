// The film page: loads the real captures and artwork, bakes the type, and renders any frame on
// request by accumulating sub-frames across the shutter, the pixel, the lens and the spectrum.
import { FPS, HEIGHT, SHUTTER, WIDTH } from './timeline.mjs';
import {
  TEXTS,
  bodiesAt,
  cameraAt,
  defocusAt,
  keyAt,
  lensSample,
  probePoints,
  projectPoint,
  rimsFor,
  spritesAt,
  studioAt,
} from './motion.mjs';
import { createRenderer, imageTexture } from './optics.mjs';

// The macOS system font, SF Pro, as the site's own stack resolves in Chrome. Chrome ignores
// WebKit's -apple-system keyword, and a font named "SF Pro Display" is not installed, so that
// stack fell back to Helvetica.
const FONT = 'system-ui';

const TEXT_SCALE = 2;

// Enough samples for smooth dispersion and depth of field even when nothing moves.
const MIN_SUBFRAMES = 24;

const MAX_SUBFRAMES = 160;

// The finish, in the order the final pass applies it. Values sit at the edge of visibility.
const LOOK = {
  threshold: 2.0,
  // halation, bloom mix, exposure, vignette (EV at the corners)
  finish: [0.03, 0.02, 1.0, -0.2],
  // contrast, saturation, split-tone amount, grain (8-bit code values at mid-grey)
  grade: [1.03, 1.02, 1.0, 0.7],
  // chromatic aberration at the corners (px), unused, unused, unused
  lens: [0.3, 0, 0, 0],
};

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Film asset failed to load: ${url.slice(0, 100)}`));
    image.src = url;
  });
}

function bakeText(spec) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const size = spec.size * TEXT_SCALE;

  const setup = () => {
    ctx.font = `${spec.weight ?? 600} ${size}px ${FONT}`;
    ctx.letterSpacing = `${spec.tracking * size}px`;
    ctx.textBaseline = 'alphabetic';
  };

  setup();
  const m = ctx.measureText(spec.text);
  const pad = Math.ceil(size * 0.1);
  const left = Math.ceil(m.actualBoundingBoxLeft);
  const ascent = Math.ceil(m.actualBoundingBoxAscent);
  canvas.width = left + Math.ceil(m.actualBoundingBoxRight) + pad * 2;
  canvas.height = ascent + Math.ceil(m.actualBoundingBoxDescent) + pad * 2;
  setup();
  ctx.fillStyle = '#fff';
  ctx.fillText(spec.text, pad + left, pad + ascent);

  return {
    canvas,
    metrics: {
      width: canvas.width / TEXT_SCALE,
      height: canvas.height / TEXT_SCALE,
      baseline: (pad + ascent) / TEXT_SCALE,
      origin: (pad + left) / TEXT_SCALE,
      advance: m.width / TEXT_SCALE,
    },
  };
}

function r2(index) {
  const g = 1.324717957244746;

  return [(0.5 + index / g) % 1, (0.5 + index / (g * g)) % 1];
}

/** A pixel offset drawn from a narrow Gaussian: the reconstruction filter. */
function jitterSample(index) {
  const [a, b] = r2(index);
  const radius = Math.min(1.5, Math.sqrt(-2 * Math.log(Math.max(1e-6, a))) * 0.42);

  return [radius * Math.cos(2 * Math.PI * b), radius * Math.sin(2 * Math.PI * b)];
}

/** A point on the unit disc, by the concentric mapping, for the lens aperture. */
function discSample(index) {
  const [a, b] = r2(index + 101).map((value) => value * 2 - 1);

  if (a === 0 && b === 0) return [0, 0];

  const [radius, angle] =
    Math.abs(a) > Math.abs(b)
      ? [a, (Math.PI / 4) * (b / a)]
      : [b, Math.PI / 2 - (Math.PI / 4) * (a / b)];

  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

/**
 * Enough sub-frames that the fastest point moves at most about 1.5 px between samples, and that
 * the copies of a defocused edge across the lens sit about 1.6 px apart.
 */
export function subframesAt(t) {
  const a = probePoints(t - SHUTTER / 2);
  const b = probePoints(t + SHUTTER / 2);
  let travel = 0;

  for (const [id, from] of a) {
    const to = b.get(id);

    if (!to || from[2] <= 0 || to[2] <= 0) continue;

    if (
      Math.abs(from[0] - WIDTH / 2) > WIDTH * 1.15 ||
      Math.abs(from[1] - HEIGHT / 2) > HEIGHT * 1.5
    )
      continue;
    travel = Math.max(travel, Math.hypot(to[0] - from[0], to[1] - from[1]));
  }

  const floor = MIN_SUBFRAMES;
  const lens = Math.ceil(Math.PI * (defocusAt(t) / 1.6) ** 2);

  return Math.max(floor, Math.min(MAX_SUBFRAMES, Math.max(lens, Math.ceil(travel / 1.5))));
}

function screenBox(camera, piece) {
  const radius = Math.hypot(piece.hw, piece.hh, piece.hz) * 1.08 + 4;
  const [x, y, depth] = projectPoint(camera, [piece.x, piece.y, piece.z]);

  if (depth <= radius * 1.2) return [0, 0, WIDTH, HEIGHT];

  const extent =
    (camera.focal * radius) / Math.sqrt(Math.max(1, depth * depth - radius * radius)) + 3;

  return [
    Math.max(0, Math.floor(x - extent)),
    Math.max(0, Math.floor(y - extent)),
    Math.min(WIDTH, Math.ceil(x + extent)),
    Math.min(HEIGHT, Math.ceil(y + extent)),
  ];
}

export async function createFilm(canvas, markSvg) {
  const [mark, desk, phone] = await Promise.all([
    loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markSvg)}`),
    loadImage('./desk-light-4x.webp'),
    loadImage('./ios-light.webp'),
  ]);

  await document.fonts.ready;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const renderer = createRenderer(canvas);
  const { gl } = renderer;
  const metrics = {};
  const textures = {};

  for (const [name, spec] of Object.entries(TEXTS)) {
    const baked = bakeText(spec);
    metrics[name] = baked.metrics;
    textures[name] = imageTexture(gl, baked.canvas, false);
  }

  const markCanvas = document.createElement('canvas');
  markCanvas.width = 1024;
  markCanvas.height = 1024;
  markCanvas.getContext('2d').drawImage(mark, 0, 0, 1024, 1024);
  textures.mark = imageTexture(gl, markCanvas, false);
  textures.desk = imageTexture(gl, desk, true);
  textures.phone = imageTexture(gl, phone, true);

  function sceneAt(t, index, count, stride) {
    const camera = lensSample(
      cameraAt(t),
      jitterSample((index * 7) % 997),
      discSample((index * 11 + 3) % 991),
    );

    const bodies = bodiesAt(t)
      .map((piece) => ({ ...piece, screenBox: screenBox(camera, piece) }))
      .filter(({ screenBox: box }) => box[2] > box[0] && box[3] > box[1]);

    return {
      camera,
      bodies,
      sprites: spritesAt(t, metrics),
      rims: rimsFor(t),
      studio: studioAt(t),
      key: keyAt(t),
      // One wavelength per sub-frame, spread evenly across the frame's samples.
      lambda: (((index * stride) % count) + 0.5) / count,
    };
  }

  let rendered = -1;

  return {
    metrics,

    /** Renders a frame; returns how many sub-frames it took. */
    render(frame, subframes = null) {
      const t = frame / FPS;
      const count = subframes ?? subframesAt(t);
      const stride = [7, 11, 13, 17, 19, 23].find((k) => gcd(k, count) === 1) ?? 1;
      renderer.beginFrame();

      for (let index = 0; index < count; index += 1) {
        const time = t + ((index + 0.5) / count - 0.5) * SHUTTER;
        renderer.subframe(sceneAt(time, index, count, stride), textures);
      }

      renderer.endFrame(frame, LOOK);
      rendered = frame;

      return count;
    },

    async read(mode) {
      if (rendered < 0) throw new Error('No frame has been rendered.');
      const bytes = renderer.read(mode);

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(',') + 1));
        reader.onerror = () => reject(new Error('The frame could not be encoded.'));
        reader.readAsDataURL(new Blob([bytes]));
      });
    },
  };
}
