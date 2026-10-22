// A capsule of thick glass carries the lockup into view, in three beats, drawn by one fragment
// shader over the stage.
//
// Arrival: the stage is dark and the lockup is lit only where the glass is. The capsule glides in
// over the mark on the library's ease-out, magnifying it a little and pulling the strokes nearest
// its rim out into the bevel, where they split into colour.
//
// Pass: the capsule's leading end springs out across the name. While it moves, the end cap
// stretches the letters it is reaching, split into colour, and lets them go as it passes.
//
// Settle: the glass relaxes to plain, one highlight runs along it, the stage lights come up
// around it and its rim fades, leaving the lockup exactly where the page has it.
//
// Lengths are fractions of the capsule's height, which follows the lockup's, so the reveal keeps
// its proportions at any size.

/** Seconds the reveal takes at its regular pace. */
export const LOGO_REVEAL_LENGTH = 2.6;

const VERTEX = `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
out vec4 colour;

uniform vec2 stage;
uniform vec2 pixels;
uniform vec4 backdrop;
uniform float dark;
uniform float seed;
uniform sampler2D lockup;
uniform int taps;
uniform vec3 hues[8];
uniform float shifts[8];

uniform vec2 centre;
uniform vec2 size;
uniform float bevel;
uniform float zoom;
uniform float bend;
uniform float smear;
uniform float split;
uniform float rims;
uniform float haze;
uniform float sweep;
uniform float shine;
uniform float inside;
uniform float outside;
uniform float soft;
uniform float bloom;

const vec2 KEY = vec2(-0.5547, -0.8321);

float px;

vec4 over(vec4 content) {
  return content + backdrop * (1.0 - content.a);
}

vec4 lockupAt(vec2 point, float bias) {
  vec2 uv = point / stage;
  vec2 within = step(vec2(0.0), uv) * step(uv, vec2(1.0));

  return texture(lockup, uv, bias) * (within.x * within.y);
}

// Highlights add light on a dark stage and shade on a light one, as glass edges do.
vec4 light(vec4 base, vec3 amount) {
  vec3 lit = mix(base.rgb * (1.0 - 0.55 * amount), base.rgb + amount, dark);
  float alpha = max(base.a, dark * min(max(amount.r, max(amount.g, amount.b)), 1.0));

  return vec4(lit, alpha);
}

float capsule(vec2 p) {
  vec2 q = abs(p - centre) - size + size.y;

  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - size.y;
}

void main() {
  px = stage.x / pixels.x;
  vec2 p = vec2(gl_FragCoord.x, pixels.y - gl_FragCoord.y) * (stage / pixels);
  vec2 e = vec2(0.5, 0.0);
  vec2 slope = vec2(capsule(p + e.xy) - capsule(p - e.xy), capsule(p + e.yx) - capsule(p - e.yx));
  vec2 normal = slope / max(length(slope), 1e-5);
  float d = capsule(p);
  float cover = clamp(0.5 - d / px, 0.0, 1.0);
  vec4 plain = over(lockupAt(p, 0.0) * outside);
  vec4 seen = plain;

  if (cover > 0.0) {
    // 0 at the rim, 1 where the bevel meets the flat face.
    float depth = clamp(-d / bevel, 0.0, 1.0);
    float rim = (1.0 - depth) * (1.0 - depth);
    // The ends pull hardest, the long edges gently, and the leading end reaches further back
    // while it moves.
    float lead = smoothstep(0.2, 1.0, (p.x - centre.x) / max(size.x, 1.0));
    float pull = bend * (0.35 + 0.65 * abs(normal.x)) + smear * lead * lead;
    float bias = soft * (0.3 + 2.0 * rim);
    // A capsule of glass is a rod: it magnifies across its spine and only rounds out at the ends,
    // so type under it grows taller without sliding along it.
    float run = max(size.x - size.y, 0.0);
    vec2 spine = vec2(clamp(p.x, centre.x - run, centre.x + run), centre.y);
    vec2 rel = p - spine;
    vec3 sum = vec3(0.0);
    float alpha = 0.0;

    // The bevel pulls the strokes nearest the rim out into it; violet bends further than red.
    for (int i = 0; i < 8; i++) {
      if (i >= taps) break;
      float k = 1.0 + split * shifts[i];
      float magnify = 1.0 + (zoom - 1.0) * (1.0 + 0.3 * (k - 1.0));
      vec2 point = spine + rel / magnify - normal * (pull * rim * k);
      vec4 through = over(lockupAt(point, bias) * inside);
      sum += hues[i] * through.rgb;
      alpha += through.a;
    }

    // Thick glass scatters a little of what it magnifies, so it glows from within.
    vec2 middle = spine + rel / zoom;
    vec4 scatter = (lockupAt(middle, 3.5) * 0.4 + lockupAt(middle, 5.5) * 0.6) * inside;
    vec4 glass = vec4(sum + scatter.rgb * haze * dark, alpha / float(taps));

    // A darker band just inside the polished edge, where the bevel looks out at the dark.
    float band = exp(-pow((d + 0.09 * size.y) / (0.07 * size.y), 2.0));
    glass.rgb *= 1.0 - 0.45 * band * rims * dark;
    seen = mix(plain, glass, cover);
  }

  float facing = max(dot(normal, KEY), 0.0);
  float away = max(dot(normal, -KEY), 0.0);
  float w = 0.012 * size.y + px;
  float edge = exp(-pow((d + w) / w, 2.0));
  float face = exp(-pow((d + bevel * 0.45) / (0.02 * size.y + px), 2.0));
  float wall = exp(-pow((d - 0.06 * size.y) / (0.018 * size.y + px), 2.0));
  float halo = exp(-max(d, 0.0) / (0.5 * size.y)) * (1.0 - cover);
  // One slanted highlight runs along the glass as it settles.
  float across = p.x - (centre.x - size.x + sweep * 2.0 * size.x) + 0.35 * (p.y - centre.y);
  float sheen = exp(-pow(across / (0.9 * size.y), 2.0)) * shine * cover;

  // Cool where the rim faces the light, warm on the far side.
  vec3 tint = mix(vec3(1.0, 0.76, 0.46), vec3(0.62, 0.84, 1.0), facing);
  vec3 rimLight = mix(vec3(1.0), tint, 0.45) * edge * (0.3 + 0.6 * pow(facing, 1.5) + 0.35 * pow(away, 2.0));
  vec3 lines = vec3(0.86, 0.92, 1.0) * (face * (0.05 + 0.1 * facing) + wall * 0.06);
  vec3 glow = vec3(0.6, 0.72, 0.9) * halo * 0.05;
  // The lockup glows only where it can be seen: through the glass, just past its rim, or once
  // the stage lights come up.
  float shown = max(outside, inside * max(cover, exp(-max(d, 0.0) / (0.4 * size.y))));
  vec3 amount = (rimLight + lines + glow) * rims + vec3(sheen * mix(0.12, 0.32, dark)) +
    textureLod(lockup, p / stage, 4.5).rgb * bloom * shown;
  vec4 c = light(seen, amount);

  // Half a level of noise keeps the soft glows from banding while the glass is there.
  float noise = fract(sin(dot(gl_FragCoord.xy + seed, vec2(12.9898, 78.233))) * 43758.5453);
  c.rgb += (noise - 0.5) / 255.0 * c.a * step(0.001, rims + bloom + shine);
  colour = clamp(c, 0.0, 1.0);
}`;

/** The finished lockup's box and its mark's horizontal extent, in stage pixels. */
type LogoRevealLayout = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  markLeft: number;
  markRight: number;
};

type LogoRevealStage = {
  /** The stage colour, premultiplied, 0 to 1. */
  backdrop: [number, number, number, number];
  /** Whether highlights add light (a dark stage) or shade (a light one). */
  dark: boolean;
  /** The glass thickness preference: 1 is regular, thicker glass bends and splits more. */
  thickness: number;
};

export type LogoRevealRenderer = {
  /** Draws the reveal `time` seconds in. */
  draw: (time: number) => void;
  /** The finished lockup at the canvas's own resolution. */
  setLockup: (source: TexImageSource, layout: LogoRevealLayout) => void;
  setStage: (stage: LogoRevealStage) => void;
  /** Wavelengths sampled per pixel, from 3 to 8. */
  setTaps: (taps: number) => void;
  resize: (width: number, height: number, ratio: number) => void;
  /** The largest canvas side the GPU accepts. */
  limit: number;
  dispose: () => void;
};

const clamp = (value: number, low = 0, high = 1) => Math.min(Math.max(value, low), high);

/** How far through [start, end] the time is, from 0 to 1. */
const span = (time: number, start: number, end: number) => clamp((time - start) / (end - start));

const mix = (a: number, b: number, x: number) => a + (b - a) * x;

const smooth = (x: number) => x * x * (3 - 2 * x);

const sineInOut = (x: number) => (1 - Math.cos(Math.PI * x)) / 2;

/** A CSS cubic-bezier timing function, solved for x by bisection. */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const curve = (t: number, a: number, b: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;

  return (x: number) => {
    let low = 0;
    let high = 1;

    for (let step = 0; step < 24; step++) {
      const t = (low + high) / 2;

      if (curve(t, x1, x2) < x) low = t;
      else high = t;
    }

    return curve((low + high) / 2, y1, y2);
  };
}

/** The library's arrival curve, --lg-ease-out. */
const easeOut = bezier(0.32, 0.72, 0, 1);

/** A settle with one small overshoot, about 9%. */
const spring = (x: number) => (x >= 1 ? 1 : 1 - Math.exp(-6 * x) * Math.cos(8 * x));

/**
 * Weights for `taps` wavelengths from red to violet. Each channel's weights sum to 1, so plain
 * glass passes white unchanged and only bending separates the colours.
 */
function spectrum(taps: number) {
  const bump = (x: number, middle: number, width: number) =>
    Math.max(0, 1 - ((x - middle) / width) ** 2);

  const raw = Array.from({ length: taps }, (_, index) => {
    const x = index / (taps - 1);

    return [bump(x, 0, 0.42) + 0.35 * bump(x, 1, 0.25), bump(x, 0.48, 0.3), bump(x, 0.85, 0.3)];
  });

  const totals = [0, 1, 2].map((channel) =>
    raw.reduce((sum, weights) => sum + weights[channel], 0),
  );

  return {
    hues: raw.map((weights) => weights.map((weight, channel) => weight / totals[channel])),
    shifts: raw.map((_, index) => (index / (taps - 1)) * 2 - 1),
  };
}

/** Every uniform for one moment of the reveal, for glass `thickness` times regular. */
function revealFrame(time: number, height: number, layout: LogoRevealLayout, thickness: number) {
  const t = clamp(time, 0, LOGO_REVEAL_LENGTH);
  const tall = capsuleHeight(layout, height);
  const half = tall / 2;
  const middle = (layout.top + layout.bottom) / 2;
  const mark = (layout.markLeft + layout.markRight) / 2;
  // Long enough to carry the mark with a margin of glass on either side.
  const pill = Math.max(tall * 1.25, layout.markRight - layout.markLeft + tall * 0.7);
  const reach = layout.right + tall * 0.3;

  // The arriving capsule's centre, then its leading end once it springs out across the name.
  const arrival = mix(layout.left - tall * 1.4, mark, easeOut(span(t, 0.04, 0.95)));

  const end = (at: number) =>
    mix(mark + pill / 2, reach, spring(span(at, 0.82, 1.9))) + Math.min(arrival - mark, 0);

  const left = arrival - pill / 2;
  const right = Math.max(end(t), arrival + pill / 2);
  const speed = Math.abs(end(t + 0.01) - end(t - 0.01)) / 0.02;
  const settled = t >= LOGO_REVEAL_LENGTH;
  const relax = sineInOut(span(t, 1.7, 2.3));

  const pairs = {
    centre: [(left + right) / 2, middle],
    size: [(right - left) / 2, half],
  } satisfies Record<string, readonly [number, number]>;

  const floats = {
    bevel: half * 0.5 * (0.75 + 0.25 * thickness),
    zoom: settled ? 1 : 1 + 0.42 * (0.7 + 0.3 * thickness) * (1 - sineInOut(span(t, 0.35, 2.3))),
    bend: settled ? 0 : half * 0.6 * (0.6 + 0.4 * thickness) * (1 - relax),
    // The end cap reaches back hardest at the pass's fastest moment.
    smear: settled
      ? 0
      : clamp(speed / (tall * 6)) * tall * 0.55 * (0.6 + 0.4 * thickness) * (1 - relax),
    split: settled ? 0 : 0.14 * (0.5 + 0.5 * thickness) * (1 - sineInOut(span(t, 1.8, 2.3))),
    rims: settled ? 0 : easeOut(span(t, 0, 0.3)) * (1 - span(t, 2.15, 2.55)),
    haze: settled ? 0 : 0.3 * smooth(span(t, 0.1, 0.5)) * (1 - span(t, 1.6, 2.2)),
    sweep: mix(-0.3, 1.3, span(t, 1.85, 2.45)),
    shine: settled ? 0 : Math.sin(Math.PI * span(t, 1.85, 2.45)),
    inside: smooth(span(t, 0.1, 0.45)),
    outside: settled ? 1 : sineInOut(span(t, 1.75, 2.35)),
    soft: settled ? 0 : 1 - span(t, 2.2, LOGO_REVEAL_LENGTH),
    bloom: settled ? 0 : 0.12 * smooth(span(t, 0.3, 0.6)) * (1 - span(t, 1.9, 2.4)),
  } satisfies Record<string, number>;

  return { floats, pairs };
}

/** The capsule's height: a little over the lockup's, kept inside the stage. */
function capsuleHeight(layout: LogoRevealLayout, height: number) {
  return Math.max(Math.min((layout.bottom - layout.top) * 2, height * 0.86), 1);
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);

  if (!shader) throw new Error('The logo reveal could not create a shader.');

  try {
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`The logo reveal shader did not compile: ${gl.getShaderInfoLog(shader)}`);
    }

    return shader;
  } catch (error) {
    gl.deleteShader(shader);
    throw error;
  }
}

/** One WebGL2 program over a full-stage triangle. Throws where WebGL2 is unavailable. */
export function createLogoRevealRenderer(canvas: HTMLCanvasElement): LogoRevealRenderer {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
    stencil: false,
  });

  if (!gl) throw new Error('The logo reveal needs WebGL2.');

  const program = gl.createProgram();

  if (!program) throw new Error('The logo reveal could not create a program.');

  const shaders: WebGLShader[] = [];
  let texture: WebGLTexture | null = null;
  let vertices: WebGLVertexArrayObject | null = null;

  const releaseShaders = () => {
    const attached = gl.getAttachedShaders(program);

    for (const shader of shaders) {
      if (attached?.includes(shader)) gl.detachShader(program, shader);

      gl.deleteShader(shader);
    }

    shaders.length = 0;
  };

  // Deletes what it made but keeps the context: React mounts effects twice in development, and a
  // canvas whose context was lost on purpose never gets another.
  const release = () => {
    releaseShaders();
    gl.useProgram(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindVertexArray(null);

    if (texture) gl.deleteTexture(texture);

    if (vertices) gl.deleteVertexArray(vertices);

    gl.deleteProgram(program);
  };

  try {
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, FRAGMENT],
    ] as const) {
      const shader = compile(gl, type, source);

      shaders.push(shader);
      gl.attachShader(program, shader);
    }

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`The logo reveal program did not link: ${gl.getProgramInfoLog(program)}`);
    }

    releaseShaders();
    gl.useProgram(program);
    vertices = gl.createVertexArray();
    gl.bindVertexArray(vertices);

    const locations = new Map<string, WebGLUniformLocation | null>();

    const location = (name: string) => {
      if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name));

      return locations.get(name) ?? null;
    };

    const float = (name: string, value: number) => gl.uniform1f(location(name), value);

    const pair = (name: string, [x, y]: readonly [number, number]) =>
      gl.uniform2f(location(name), x, y);

    texture = gl.createTexture();

    if (!texture) throw new Error('The logo reveal could not create a texture.');

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // An empty pixel until the lockup is drawn.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.uniform1i(location('lockup'), 0);

    let height = 1;
    let thickness = 1;

    let layout: LogoRevealLayout = {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      markLeft: 0,
      markRight: 0,
    };

    const setTaps = (taps: number) => {
      const count = Math.round(clamp(taps, 3, 8));
      const { hues, shifts } = spectrum(count);

      gl.uniform1i(location('taps'), count);
      gl.uniform3fv(location('hues'), hues.flat());
      gl.uniform1fv(location('shifts'), shifts);
    };

    setTaps(7);
    gl.disable(gl.BLEND);

    // SAFETY: WebGL2 defines MAX_TEXTURE_SIZE as a GLint parameter, which reads as a number.
    const largest = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;

    return {
      limit: Math.min(largest, 4096),
      setLockup(source, next) {
        layout = next;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.generateMipmap(gl.TEXTURE_2D);
      },
      setStage(stage) {
        const [r, g, b, a] = stage.backdrop;

        gl.uniform4f(location('backdrop'), r, g, b, a);
        float('dark', stage.dark ? 1 : 0);
        thickness = stage.thickness;
      },
      setTaps,
      resize(width, nextHeight, ratio) {
        height = nextHeight;
        canvas.width = Math.max(1, Math.round(width * ratio));
        canvas.height = Math.max(1, Math.round(nextHeight * ratio));
        gl.viewport(0, 0, canvas.width, canvas.height);
        pair('stage', [width, nextHeight]);
        pair('pixels', [canvas.width, canvas.height]);
      },
      draw(time) {
        if (gl.isContextLost()) return;

        const { floats, pairs } = revealFrame(time, height, layout, thickness);

        for (const [name, value] of Object.entries(floats)) float(name, value);

        for (const [name, value] of Object.entries(pairs)) pair(name, value);

        float('seed', (time * 61.7) % 97);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      dispose: release,
    };
  } catch (error) {
    release();
    throw error;
  }
}

/** Reads any CSS colour as sRGB through a one-pixel canvas, premultiplied, 0 to 1. */
export function readColour(value: string): [number, number, number, number] {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ink = canvas.getContext('2d', { willReadFrequently: true });

  if (!ink) return [0, 0, 0, 0];

  ink.fillStyle = value;
  ink.fillRect(0, 0, 1, 1);

  const [r, g, b, a] = ink.getImageData(0, 0, 1, 1).data;
  const alpha = a / 255;

  return [(r / 255) * alpha, (g / 255) * alpha, (b / 255) * alpha, alpha];
}

type LogoRevealParts = {
  figure: HTMLElement;
  mark: HTMLImageElement;
  /** The name's element. Its last child is the text. */
  name: HTMLElement;
  /** An empty inline block at the name's baseline. */
  baseline: HTMLElement;
};

/**
 * The finished lockup as the page lays it out, drawn at the canvas's resolution: the mark where
 * its image sits and each character of the name where the browser placed it, so the last frame
 * lands on the real lockup.
 */
export function paintLockup(
  { baseline, figure, mark, name }: LogoRevealParts,
  pixelWidth: number,
  pixelHeight: number,
) {
  const box = figure.getBoundingClientRect();
  const canvas = document.createElement('canvas');
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  const ink = canvas.getContext('2d');

  if (!ink || !box.width || !box.height)
    throw new Error('The logo reveal could not draw its lockup.');

  // Client rectangles are in the page's (possibly scaled) pixels; the stage uses the figure's own.
  const toStage = figure.clientWidth / box.width;
  const markBox = mark.getBoundingClientRect();
  const nameBox = name.getBoundingClientRect();
  const style = getComputedStyle(name);
  const text = name.lastChild;
  const rtl = style.direction === 'rtl';

  ink.scale(pixelWidth / box.width, pixelHeight / box.height);
  ink.drawImage(
    mark,
    markBox.left - box.left,
    markBox.top - box.top,
    markBox.width,
    markBox.height,
  );
  ink.font = [
    style.fontStyle,
    style.fontVariantCaps === 'small-caps' ? 'small-caps' : '',
    style.fontWeight,
    style.fontSize,
    style.fontFamily,
  ]
    .filter(Boolean)
    .join(' ');
  ink.fillStyle = style.color;
  ink.textAlign = rtl ? 'right' : 'left';
  ink.textBaseline = 'alphabetic';

  // Browsers paint a line's text from whole device pixels, so the canvas does too.
  const across = pixelWidth / box.width;
  const down = pixelHeight / box.height;
  const snapX = (x: number) => Math.round(x * across) / across;
  const snapY = (y: number) => Math.round(y * down) / down;

  if (text?.nodeType === Node.TEXT_NODE && text.textContent) {
    const range = document.createRange();
    const y = snapY(baseline.getBoundingClientRect().top - box.top);
    let index = 0;

    for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(
      text.textContent,
    )) {
      range.setStart(text, index);
      range.setEnd(text, index + segment.length);
      index += segment.length;

      const glyph = range.getClientRects()[0];

      if (glyph && segment.trim())
        ink.fillText(segment, snapX((rtl ? glyph.right : glyph.left) - box.left), y);
    }
  }

  const stageX = (x: number) => (x - box.left) * toStage;
  const stageY = (y: number) => (y - box.top) * toStage;

  return {
    canvas,
    layout: {
      left: stageX(Math.min(markBox.left, nameBox.left)),
      right: stageX(Math.max(markBox.right, nameBox.right)),
      top: stageY(Math.min(markBox.top, nameBox.top)),
      bottom: stageY(Math.max(markBox.bottom, nameBox.bottom)),
      markLeft: stageX(markBox.left),
      markRight: stageX(markBox.right),
    } satisfies LogoRevealLayout,
  };
}
