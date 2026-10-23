// The reveal is one fragment shader over the stage. A ball of thick glass swells out of the dark
// in front of the mark and magnifies it; the ball squares into a rounded tile and slowly comes
// closer while the magnification relaxes; then the glass clears, the tile fades to an outline
// and goes, leaving the mark exactly where the page has it.
//
// The glass only ever moves and uniformly scales the mark, never stretches or bends it: colour
// splits because each wavelength is scaled a touch differently, and the rim's colour is light
// the bevel catches, not displaced pixels.
//
// Lengths are fractions of the mark's larger side, so the reveal keeps its proportions at any size.

/** Seconds the reveal takes at its regular pace. */
export const LOGO_REVEAL_LENGTH = 1.7;

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
uniform sampler2D mark;
uniform sampler2D still;
uniform int taps;
uniform vec3 hues[8];
uniform float shifts[8];

uniform vec4 markRect;
uniform float exposure;
uniform float rest;
uniform vec2 centre;
uniform float extent;
uniform float radius;
uniform float corner;
uniform float morph;
uniform float bevel;
uniform float zoom;
uniform vec2 view;
uniform float split;
uniform float glass;
uniform float glow;
uniform float haze;
uniform float shine;

const vec2 KEY = vec2(-0.5547, -0.8321);
const float TAU = 6.2831853;

float unit;
float px;

vec4 over(vec4 content) {
  return content + backdrop * (1.0 - content.a);
}

// The mark as act one sees it: from the high-resolution picture, at its page rectangle.
vec4 markAt(vec2 point, float bias) {
  vec2 uv = (point - markRect.xy) / markRect.zw + 0.5;
  vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));

  return texture(mark, uv, bias) * (inside.x * inside.y);
}

// The mark exactly as the page draws it, for the moment the glass has gone.
vec4 stillAt(vec2 point) {
  vec2 uv = point / stage;
  vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));

  return texture(still, uv, 0.0) * (inside.x * inside.y);
}

vec4 light(vec4 base, vec3 amount) {
  vec3 lit = mix(base.rgb * (1.0 - 0.55 * amount), base.rgb + amount, dark);
  float alpha = max(base.a, dark * min(max(amount.r, max(amount.g, amount.b)), 1.0));

  return vec4(lit, alpha);
}

// A circle when the radius is half the size and the corner exponent 2; a rounded square with
// continuously curving corners as the radius falls and the exponent rises.
float body(vec2 p) {
  vec2 q = abs(p - centre) - extent + radius;
  vec2 m = max(q, 0.0);
  float rounded = pow(pow(m.x, corner) + pow(m.y, corner), 1.0 / corner);

  return min(max(q.x, q.y), 0.0) + rounded - radius;
}

vec3 rainbow(float x) {
  return 0.5 + 0.5 * cos(TAU * (x + vec3(0.0, 0.33, 0.67)));
}

void main() {
  unit = max(markRect.z, markRect.w) / 1.8;
  px = stage.x / pixels.x;
  vec2 p = vec2(gl_FragCoord.x, pixels.y - gl_FragCoord.y) * (stage / pixels);
  vec2 e = vec2(0.5, 0.0);
  vec2 slope = vec2(body(p + e.xy) - body(p - e.xy), body(p + e.yx) - body(p - e.yx));
  float steep = max(length(slope), 1e-5);
  vec2 normal = slope / steep;
  float d = body(p) / steep;
  float cover = clamp(0.5 - d / px, 0.0, 1.0) * step(0.001, glass);

  // Outside the glass the stage is dark until the glass has gone.
  vec4 plain = over(stillAt(p) * rest);
  vec4 seen = plain;

  if (cover > 0.0) {
    float depth = clamp(-d / bevel, 0.0, 1.0);
    float rim = (1.0 - depth) * (1.0 - depth);
    vec2 rel = p - centre;
    vec3 sum = vec3(0.0);
    float alpha = 0.0;

    // Each wavelength sees the mark scaled a touch differently, so edges split into colour
    // while the mark keeps its shape.
    for (int i = 0; i < 8; i++) {
      if (i >= taps) break;
      float k = 1.0 + split * shifts[i];
      vec2 point = centre + view + rel / (zoom * k);
      vec4 through = over(markAt(point, 0.25 + 1.2 * rim) * exposure);
      sum += hues[i] * through.rgb;
      alpha += through.a;
    }

    vec4 glassy = vec4(sum, alpha / float(taps));
    vec2 middle = centre + view + rel / zoom;

    // Thick glass scatters some of what it magnifies, so it glows from within.
    vec4 scatter = (markAt(middle, 3.5) * 0.4 + markAt(middle, 5.5) * 0.6) * exposure;
    glassy.rgb += scatter.rgb * haze * dark;

    // The bevel catches the mark's light as colour: a soft spectral band, brightest where the
    // mark lies nearest the rim.
    vec2 inward = middle - normal * bevel * 0.9 / zoom;
    float near = dot((markAt(inward, 5.0) * exposure).rgb, vec3(0.333));
    // Hue runs smoothly with depth and the rim's direction, so it has no seam.
    vec3 band = rainbow(depth * 1.4 + 0.12 * normal.x - 0.08 * normal.y + 0.08);
    glassy.rgb += band * pow(rim, mix(2.6, 0.9, morph)) * (0.25 + 1.1 * near) * glow * dark;

    // A darker band just inside the polished edge, where the bevel looks out at the dark.
    float shade = exp(-pow((d + 0.05 * unit) / (0.03 * unit), 2.0));
    glassy.rgb *= 1.0 - 0.5 * shade * glass * dark;

    // Once the glass has relaxed, hand over to the page's own picture of the mark.
    glassy = mix(glassy, over(stillAt(p)), rest);
    seen = mix(plain, glassy, cover);
  }

  float facing = max(dot(normal, KEY), 0.0);
  float away = max(dot(normal, -KEY), 0.0);
  float side = pow(abs(normal.x), 6.0);
  float w = 0.004 * unit + px;
  float edge = exp(-pow((d + w) / w, 2.0));
  float face = exp(-pow((d + bevel * 0.42) / (0.006 * unit + px), 2.0)) * morph;
  float walls = (exp(-pow((d - 0.025 * unit) / (0.005 * unit + px), 2.0)) +
    0.5 * exp(-pow((d - 0.065 * unit) / (0.012 * unit), 2.0))) * morph;
  float ring = exp(-pow((d + 0.06 * extent) / (0.01 * unit + px), 2.0)) * (1.0 - morph);
  float glint = exp(-pow((d - 0.16 * unit) / (0.04 * unit), 2.0)) * side * (1.0 - 0.6 * morph);
  float halo = exp(-max(d, 0.0) / (0.18 * unit)) * (1.0 - cover);

  // Cool where the rim faces the light, warm on the far side.
  vec3 tint = mix(vec3(1.0, 0.76, 0.46), vec3(0.62, 0.84, 1.0), facing);
  vec3 spectral = rainbow(0.35 * normal.x + 0.25 * normal.y + 0.1);
  vec3 rimLight = mix(mix(vec3(1.0), tint, 0.5), spectral, 0.45 * glow) * edge * (0.5 + 0.9 * pow(facing, 1.5) + 0.6 * pow(away, 2.0));
  vec3 lines = vec3(0.86, 0.92, 1.0) * (face * (0.05 + 0.1 * facing) + ring * 0.22 + walls * 0.08 * (0.4 + side) + glint * 0.16);
  vec3 bloom = vec3(0.6, 0.72, 0.9) * halo * 0.05 * exposure;

  // A softbox up and to the left reflects in the face as a soft highlight, on the glass over
  // the mark.
  vec2 q = (p - centre) / extent;
  vec2 key = mat2(0.82, -0.57, 0.57, 0.82) * (q - vec2(-0.42, -0.5));
  float softbox = exp(-(key.x * key.x / 0.025 + key.y * key.y / 0.006)) * 0.8;
  // The face reflects more of the room towards its rim and the room is brighter above.
  float fresnel = pow(1.0 - clamp(-d / extent, 0.0, 1.0), 3.0) * (0.5 + 0.5 * (-q.y));
  vec3 sheen = vec3(0.92, 0.96, 1.0) * softbox * shine * cover +
    vec3(0.55, 0.65, 0.8) * fresnel * 0.12 * cover;
  vec4 c = light(seen, (rimLight + lines + bloom + sheen) * glass);

  float noise = fract(sin(dot(gl_FragCoord.xy + seed, vec2(12.9898, 78.233))) * 43758.5453);
  c.rgb += (noise - 0.5) / 255.0 * c.a * step(0.001, glass);
  colour = clamp(c, 0.0, 1.0);
}`;

/** The mark's rectangle on the stage: its centre and size, in stage pixels. */
type LogoRevealLayout = { x: number; y: number; width: number; height: number };

type LogoRevealStage = {
  /** The stage colour, premultiplied, 0 to 1. */
  backdrop: [number, number, number, number];
  /** Whether highlights add light (a dark stage) or shade (a light one). */
  dark: boolean;
  /** The glass thickness preference: 1 is regular; thicker glass magnifies and splits more. */
  thickness: number;
};

export type LogoRevealRenderer = {
  /** Draws the reveal `time` seconds in. */
  draw: (time: number) => void;
  /** The mark at high resolution, for the glass to magnify. */
  setMark: (source: TexImageSource) => void;
  /** The mark as the page draws it, at the canvas's own resolution, and where it sits. */
  setStill: (source: TexImageSource, layout: LogoRevealLayout) => void;
  setStage: (stage: LogoRevealStage) => void;
  /** Wavelengths sampled per pixel, from 3 to 8. */
  setTaps: (taps: number) => void;
  resize: (width: number, height: number, ratio: number) => void;
  /** The largest texture side the GPU accepts. */
  limit: number;
  dispose: () => void;
};

const clamp = (value: number, low = 0, high = 1) => Math.min(Math.max(value, low), high);

/** How far through [start, end] the time is, from 0 to 1. */
const span = (time: number, start: number, end: number) => clamp((time - start) / (end - start));

const mix = (a: number, b: number, x: number) => a + (b - a) * x;

const smooth = (x: number) => x * x * (3 - 2 * x);

const easeOut = (x: number) => 1 - (1 - x) ** 3;

const sineInOut = (x: number) => (1 - Math.cos(Math.PI * x)) / 2;

/** A settle with one small overshoot, about 7%. */
const spring = (x: number) => (x >= 1 ? 1 : 1 - Math.exp(-6.5 * x) * Math.cos(7.5 * x));

/**
 * Weights for `taps` wavelengths from red to violet. Each channel's weights sum to 1, so plain
 * glass passes white unchanged and only scaling separates the colours.
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
function revealFrame(time: number, layout: LogoRevealLayout, thickness: number) {
  const t = clamp(time, 0, LOGO_REVEAL_LENGTH);
  const unit = Math.max(layout.width, layout.height, 1);
  const morph = sineInOut(span(t, 0.22, 0.52));
  const clear = sineInOut(span(t, 1.06, 1.3));

  // The glass springs up to size with one small overshoot, then keeps drifting closer.
  const half =
    unit * (0.4 + 0.66 * spring(span(t, 0.04, 0.7)) + 0.05 * sineInOut(span(t, 0.6, 1.3)));

  // Magnification eases off from the moment the glass appears, never in steps.
  const swell = 1 - easeOut(span(t, 0.08, 1.3));
  const settled = t >= LOGO_REVEAL_LENGTH;
  const depth = 0.7 + 0.3 * thickness;

  const pairs = {
    centre: [layout.x, layout.y],
    view: [0, 0],
  } satisfies Record<string, readonly [number, number]>;

  const floats = {
    exposure: smooth(span(t, 0.12, 0.17)),
    rest: settled ? 1 : span(t, 1.3, 1.5),
    extent: half,
    radius: mix(half, 0.46 * half, morph),
    corner: mix(2, 2.7, morph),
    morph,
    bevel: mix(half, 0.3 * unit, morph) * (0.8 + 0.2 * thickness),
    zoom: settled ? 1 : mix(1 + 0.32 * depth * swell, 1, clear),
    split: settled ? 0 : 0.06 * depth * (1 - clear),
    glass: settled
      ? 0
      : easeOut(span(t, 0.06, 0.24)) * (1 - 0.75 * clear) * (1 - span(t, 1.32, 1.55)),
    glow: 0.9 * (1 - clear),
    haze: mix(1.0, 0.3, morph) * (1 - clear),
    shine: smooth(span(t, 0.1, 0.35)) * (1 - clear),
  } satisfies Record<string, number>;

  return { floats, pairs };
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
  const textures: WebGLTexture[] = [];
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

    for (const texture of textures) gl.deleteTexture(texture);

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

    const texture = (unit: number, name: string) => {
      const created = gl.createTexture();

      if (!created) throw new Error('The logo reveal could not create a texture.');

      textures.push(created);
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, created);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // An empty pixel until the mark is drawn.
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array(4),
      );
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.uniform1i(location(name), unit);

      return created;
    };

    const markTexture = texture(0, 'mark');
    const stillTexture = texture(1, 'still');

    const upload = (unit: number, target: WebGLTexture, source: TexImageSource) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, target);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.generateMipmap(gl.TEXTURE_2D);
    };

    let thickness = 1;
    let layout: LogoRevealLayout = { x: 0, y: 0, width: 0, height: 0 };

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
      setMark(source) {
        upload(0, markTexture, source);
      },
      setStill(source, next) {
        layout = next;
        upload(1, stillTexture, source);
      },
      setStage(stage) {
        const [r, g, b, a] = stage.backdrop;

        gl.uniform4f(location('backdrop'), r, g, b, a);
        float('dark', stage.dark ? 1 : 0);
        thickness = stage.thickness;
      },
      setTaps,
      resize(width, height, ratio) {
        canvas.width = Math.max(1, Math.round(width * ratio));
        canvas.height = Math.max(1, Math.round(height * ratio));
        gl.viewport(0, 0, canvas.width, canvas.height);
        pair('stage', [width, height]);
        pair('pixels', [canvas.width, canvas.height]);
      },
      draw(time) {
        if (gl.isContextLost()) return;

        const { floats, pairs } = revealFrame(time, layout, thickness);

        for (const [name, value] of Object.entries(floats)) float(name, value);

        for (const [name, value] of Object.entries(pairs)) pair(name, value);

        gl.uniform4f(
          location('markRect'),
          layout.x,
          layout.y,
          Math.max(layout.width, 1) * (1 + MARGIN * 2),
          Math.max(layout.height, 1) * (1 + MARGIN * 2),
        );
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

// The sharp picture's clear margin, as a fraction of the mark on each side.
const MARGIN = 0.4;

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

/**
 * Pictures of the mark: one as the page lays it out, at the canvas's resolution, so the last
 * frame lands on the real mark; and one `detail` times sharper at the mark's own aspect, for the
 * glass to magnify. An SVG rasterises sharp at either size.
 */
export function paintMark(
  figure: HTMLElement,
  mark: HTMLImageElement,
  pixelWidth: number,
  pixelHeight: number,
  detail: number,
  limit: number,
) {
  const box = figure.getBoundingClientRect();
  const markBox = mark.getBoundingClientRect();

  if (!box.width || !box.height || !markBox.width || !markBox.height)
    throw new Error('The logo reveal could not measure its mark.');

  const still = document.createElement('canvas');
  still.width = pixelWidth;
  still.height = pixelHeight;
  const ink = still.getContext('2d');
  const scale = pixelWidth / box.width;
  const sharp = document.createElement('canvas');
  // A clear margin around the sharp picture lets its blurred glow fade out before its edge.
  const room = 1 + MARGIN * 2;
  const fit = Math.min(detail, limit / (Math.max(markBox.width, markBox.height) * scale * room));
  sharp.width = Math.max(1, Math.round(markBox.width * scale * fit * room));
  sharp.height = Math.max(1, Math.round(markBox.height * scale * fit * room));
  const pen = sharp.getContext('2d');

  if (!ink || !pen) throw new Error('The logo reveal could not draw its mark.');

  ink.scale(pixelWidth / box.width, pixelHeight / box.height);
  ink.drawImage(
    mark,
    markBox.left - box.left,
    markBox.top - box.top,
    markBox.width,
    markBox.height,
  );
  pen.drawImage(
    mark,
    (sharp.width * MARGIN) / room,
    (sharp.height * MARGIN) / room,
    sharp.width / room,
    sharp.height / room,
  );

  // Client rectangles are in the page's (possibly scaled) pixels; the stage uses the figure's own.
  const toStage = figure.clientWidth / box.width;

  return {
    still,
    sharp,
    layout: {
      x: (markBox.left + markBox.width / 2 - box.left) * toStage,
      y: (markBox.top + markBox.height / 2 - box.top) * toStage,
      width: markBox.width * toStage,
      height: markBox.height * toStage,
    } satisfies LogoRevealLayout,
  };
}
