// The reveal is a ray-traced glass solid over the stage. Each pixel's ray meets the glass, bends
// in through its front surface, crosses it (bouncing once if light cannot leave), bends out of
// its back and lands on the plane of the mark just behind it, so the mark warps only as real
// glass would warp it. Each wavelength traces its own index, which splits colour; Fresnel
// reflections show a studio of softboxes. The body morphs from a domed lens into a thick
// rounded tile and settles flat; then it keeps coming towards the camera, past the mark and out
// of the studio's light, so its highlights slide off the rim and thin to hairlines and the
// glass, with nothing left to reflect over a dark stage, leaves the mark where it lies.
//
// Lengths are fractions of the mark's larger side, so the reveal keeps its proportions at any size.

/** Seconds the reveal takes at its regular pace. */
export const LOGO_REVEAL_LENGTH = 2.6;

// The beats below are written at a quicker pace and played this much slower, so the glass
// moves with weight.
const PACE = 1.3;

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
uniform float rounding;
uniform float depth;
uniform float edge;
uniform float dome;
uniform float ior;
uniform float split;
uniform float gap;
uniform float tilt;
uniform float glass;
uniform float haze;
uniform float lamp;
uniform float drift;
uniform float grow;

// Lengths in the shader are in units of the glass's half size, so marching tolerances scale.
float unit;

vec4 over(vec4 content) {
  return content + backdrop * (1.0 - content.a);
}

vec4 markAt(vec2 point, float bias) {
  vec2 uv = (point - markRect.xy) / markRect.zw + 0.5;
  vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));

  return texture(mark, uv, bias) * (inside.x * inside.y) * exposure;
}

vec4 stillAt(vec2 point) {
  vec2 uv = point / stage;
  vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));

  return texture(still, uv, 0.0) * (inside.x * inside.y);
}

// The glass: a rounded rectangle in plan, extruded to a slab whose edges are rounded too, with a
// slight dome on both faces. Radius = 1 and depth = edge = 1 make it a sphere.
float body(vec3 p) {
  vec2 q = abs(p.xy) - 1.0 + rounding;
  float plan = min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - rounding;
  float r2 = clamp(dot(p.xy, p.xy), 0.0, 1.0);
  float thick = depth + dome * (1.0 - r2);
  vec2 w = vec2(plan + edge, abs(p.z) - thick + edge);

  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - edge;
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.0015, 0.0);

  return normalize(vec3(
    body(p + e.xyy) - body(p - e.xyy),
    body(p + e.yxy) - body(p - e.yxy),
    body(p + e.yyx) - body(p - e.yyx)
  ));
}

// A dark studio: a large softbox up and to the right, a smaller fill down and to the left, a thin
// strip on the left and a faint floor, so the glass catches light at opposite corners.
vec3 studio(vec3 d) {
  // As the lights move away they slide out towards the horizon, so their reflections run off
  // the rim, and fall dim with distance.
  vec2 away = vec2(0.9, -0.5) * drift;
  float key = smoothstep(0.35, 0.0, length((d.xy - vec2(0.55, -0.6) - away) / vec2(0.5, 0.3)) - 0.6) * step(d.z, 0.2);
  float fill = smoothstep(0.3, 0.0, length((d.xy - vec2(-0.6, 0.6) + away) / vec2(0.4, 0.25)) - 0.5) * step(d.z, 0.2);
  float strip = smoothstep(0.08, 0.0, abs(d.x + 0.78) - 0.03) * smoothstep(0.6, 0.2, abs(d.y + 0.1)) * step(d.z, 0.3);
  float ground = smoothstep(0.1, 0.9, d.y) * 0.05;
  // A soft overhead and a band of light around the horizon catch every grazing edge.
  // Studio lights are many times brighter than the page; glass shows them only in reflection.
  float above = 0.6 * smoothstep(0.2, -0.9, d.y);
  float horizon = 3.0 * exp(-d.z * d.z / 0.05);
  vec3 light = vec3(1.0, 0.98, 0.95) * key * 9.0 + vec3(0.95, 0.97, 1.0) * fill * 5.0 +
    vec3(0.85, 0.92, 1.0) * strip * 3.0 +
    vec3(0.8, 0.86, 0.95) * (above + horizon) + ground;
  light *= lamp;

  return mix(vec3(0.94, 0.94, 0.93) - light * 0.5, light, dark);
}

mat2 turn(float a) {
  float c = cos(a);
  float s = sin(a);

  return mat2(c, -s, s, c);
}

// Where a camera ray through stage point p meets the mark's plane after passing the glass, for
// refractive index n. Returns the plane point and, in z, the Fresnel reflectance at entry.
vec4 trace(vec2 p, float n, out vec3 reflected, out float path) {
  vec3 o = vec3((p - centre) / extent, -4.0);
  vec3 d = vec3(0.0, 0.0, 1.0);
  o.xz = turn(tilt) * o.xz;
  d.xz = turn(tilt) * d.xz;
  reflected = vec3(0.0);
  path = 0.0;
  float t = 0.0;
  bool hit = false;

  for (int i = 0; i < 64; i++) {
    float h = body(o + d * t);
    if (h < 0.0008) { hit = true; break; }
    t += h;
    if (t > 8.0) break;
  }

  if (!hit) return vec4(p, 0.0, 0.0);

  vec3 a = o + d * t;
  vec3 na = normalAt(a);
  float cosi = clamp(-dot(d, na), 0.0, 1.0);
  float f0 = pow((n - 1.0) / (n + 1.0), 2.0);
  float fresnel = f0 + (1.0 - f0) * pow(1.0 - cosi, 5.0);
  reflected = reflect(d, na);
  vec3 r = refract(d, na, 1.0 / n);
  vec3 q = a - na * 0.003;

  // Inside the glass: march to the far surface, bounce off it once if light cannot leave.
  for (int bounce = 0; bounce < 2; bounce++) {
    float s = 0.004;
    for (int i = 0; i < 48; i++) {
      float h = -body(q + r * s);
      if (h < 0.0008) break;
      s += max(h, 0.004);
      if (s > 6.0) break;
    }
    path += s;
    q += r * s;
    vec3 nb = normalAt(q);
    vec3 out_ = refract(r, -nb, n);
    if (dot(out_, out_) > 0.0) { r = out_; break; }
    r = reflect(r, -nb);
    q -= nb * 0.003;
  }

  // Back to the stage and on to the mark's plane, just behind the glass.
  q.xz = turn(-tilt) * q.xz;
  r.xz = turn(-tilt) * r.xz;
  float plane = depth + dome + gap;
  float k = r.z > 0.02 ? (plane - q.z) / r.z : 0.0;
  vec2 land = q.xy + r.xy * max(k, 0.0);

  return vec4(centre + land * extent, fresnel, r.z > 0.02 ? 1.0 : 0.0);
}

void main() {
  unit = extent;
  vec2 p = vec2(gl_FragCoord.x, pixels.y - gl_FragCoord.y) * (stage / pixels);
  vec4 plain = over(stillAt(p) * rest);
  vec2 local = (p - centre) / extent;

  // Only pixels near the glass are traced; a wider band around it carries its glow.
  float reach = max(abs(local.x), abs(local.y));

  if (glass <= 0.0 || reach > 1.7) {
    colour = plain;
    return;
  }

  bool near = reach <= 1.25;

  // The glass's outline on screen, in its own units: its silhouette, as the camera looks
  // straight at it.
  vec2 plan = abs(local) - 1.0 + rounding;
  float outline = min(max(plan.x, plan.y), 0.0) + length(max(plan, 0.0)) - rounding;
  float pixel = (stage.x / pixels.x) / extent;

  vec3 sum = vec3(0.0);
  float alpha = 0.0;
  float fresnel = 0.0;
  vec3 mirror = vec3(0.0);
  float covered = 0.0;
  float thickness = 0.0;

  // Each wavelength sees a slightly different index, so the glass splits colour where it bends.
  for (int i = 0; i < 8; i++) {
    if (i >= taps) break;
    vec3 reflected = vec3(0.0);
    float path = 0.0;
    vec4 seen = near ? trace(p, ior * (1.0 + split * shifts[i]), reflected, path) : vec4(p, 0.0, 0.0);
    // A ray that misses the glass sees the dark stage; the mark is lit only through the glass.
    bool missed = dot(reflected, reflected) == 0.0;
    float steep = smoothstep(-0.22, 0.0, outline);
    vec4 behind = missed ? plain : seen.w > 0.5 ? over(markAt(seen.xy, 0.3 + 3.5 * steep)) : backdrop;
    sum += hues[i] * behind.rgb;
    alpha += behind.a;
    if (dot(reflected, reflected) > 0.0) {
      covered += 1.0;
      fresnel += seen.z;
      mirror += hues[i] * studio(reflected);
      thickness += path;
    }
  }

  float count = float(taps);
  vec4 through = vec4(sum, alpha / count);
  float shine = 0.0;
  vec3 reflection = vec3(0.0);

  if (covered > 0.0) {
    float share = covered / count;
    fresnel /= covered;
    thickness /= covered;
    // Thick glass absorbs a little and scatters some of the mark's light within it.
    // Thick glass absorbs warm light first, so its depths read cool and blue.
    through.rgb *= mix(vec3(1.0), vec3(0.82, 0.9, 1.05), clamp(thickness * 0.25, 0.0, 1.0) * dark * lamp);
    through.rgb += vec3(0.004, 0.008, 0.016) * dark * lamp * share;
    // Light scattered in the glass lifts its depths to a milky navy, brighter towards the key
    // light up and to the left.
    float milk = (0.035 + 0.04 * smoothstep(1.2, -0.6, local.x + local.y)) * mix(1.6, 1.0, 1.0 - rounding);
    through.rgb += vec3(0.55, 0.65, 0.85) * milk * glass * lamp * dark * share;
    vec4 glow = (markAt(centre + local * extent * 0.8, 4.0) * 0.5 + markAt(centre + local * extent * 0.7, 6.0) * 0.5);
    through.rgb += glow.rgb * haze * dark * share;
    // Beyond its lights the studio is the stage, so once they have gone the glass reflects
    // only the stage and disappears into it.
    reflection = mirror / covered + backdrop.rgb * dark;
    shine = fresnel * glass * share;
  }

  // Light around the glass, from its outline on screen: a soft halo, streaks where the side
  // lights catch its left and right walls, the slab's walls as faint rings outside the tile and,
  // on the ball, a second ring where light turns back inside it.
  vec2 g = normalize(sign(local) * max(plan, vec2(1e-4)) + 1e-6);
  float outside = max(outline, 0.0);
  float halo = exp(-outside * grow / 0.22) * step(0.0, outline) * 0.07;
  float streak = exp(-pow((outline - 0.12 / grow) / (0.035 / grow), 2.0)) * pow(abs(g.x), 10.0) * (0.18 + 0.3 * rounding);
  float walls = (exp(-pow((outline - 0.035 / grow) / (0.01 / grow), 2.0)) + 0.6 * exp(-pow((outline - 0.09 / grow) / (0.016 / grow), 2.0))) * (1.0 - rounding) * 1.8 * 0.06;
  float ring = 0.0;
  // Light focused round the inside of the ball's rim, warm where its colours gather.
  float caustic = exp(-pow((outline + 0.11) / 0.014, 2.0)) * pow(rounding, 3.0) * 0.45;
  // The polished edge stays dark except at the corners facing the key and the fill, where it
  // catches them as bright slivers.
  // As the lights leave, the slivers run round the corners and narrow until they go out.
  float bearing = -0.785 + 0.6 * drift;
  float facing = abs(dot(g, vec2(cos(bearing), sin(bearing))));
  float edgeLine = exp(-pow((outline + 0.02 / grow) / (0.022 / grow), 2.0)) * (0.06 + 1.6 * pow(facing, 8.0 + 18.0 * drift)) * 0.7;
  vec3 aura = (vec3(0.7, 0.8, 0.95) * (halo * exposure + streak + walls + ring) +
    mix(vec3(1.0, 0.86, 0.7), vec3(0.75, 0.9, 1.0), facing) * edgeLine +
    vec3(1.0, 0.82, 0.25) * caustic * exposure) * glass * lamp;

  float cover = clamp(0.5 - outline / pixel, 0.0, 1.0);
  vec4 c = mix(mix(plain, through, cover), over(stillAt(p)), rest);
  // Reflection adds light; a soft shoulder keeps bright studio light from clipping hard.
  vec3 lit = c.rgb * (1.0 - shine * cover) + reflection * shine * cover;
  c.rgb = mix(c.rgb, lit / (1.0 + max(lit - 1.0, 0.0)), dark);
  c.rgb += aura * dark;
  c.a = max(c.a, dot(aura, vec3(0.333)) * dark);
  float noise = fract(sin(dot(gl_FragCoord.xy + seed, vec2(12.9898, 78.233))) * 43758.5453);
  // Fine grain while the glass is there, as a lens would record it; none once it lands.
  c.rgb += (noise - 0.5) * mix(1.0, 5.0, glass * lamp) / 255.0 * c.a;
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

/** Eases in and out with no linear stretch in the middle, for an unhurried ending. */
const gentle = (x: number) => x * x * x * (x * (6 * x - 15) + 10);

const sineInOut = (x: number) => (1 - Math.cos(Math.PI * x)) / 2;

/** A heavy, critically damped settle: it arrives without overshoot or bounce. */
const spring = (x: number) => (1 - (1 + 6 * x) * Math.exp(-6 * x)) / (1 - 7 * Math.exp(-6));

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
  const t = clamp(time, 0, LOGO_REVEAL_LENGTH) / PACE;
  const unit = Math.max(layout.width, layout.height, 1);
  const morph = sineInOut(span(t, 0.2, 0.62));
  // The face settles flat, then the lights move away and dim with distance.
  const flat = gentle(span(t, 0.9, 1.45));
  const away = gentle(span(t, 1.0, 1.9));
  // Then it comes on towards the camera, faster as it goes, and passes out of the frame.
  const rush = span(t, 1.12, 2) ** 2.4;
  const grow = 1 + 1.4 * rush;
  const settled = time >= LOGO_REVEAL_LENGTH;

  // The glass springs up to size with one small overshoot, then keeps drifting closer.
  const size = 0.66 + 0.34 * spring(span(t, 0.03, 0.85)) + 0.06 * sineInOut(span(t, 0.55, 1.4));

  const pairs = {
    centre: [layout.x, layout.y],
  } satisfies Record<string, readonly [number, number]>;

  const floats = {
    // Close around the mark, so it fills most of the glass.
    extent: unit * 0.86 * size * grow,
    grow,
    exposure: smooth(span(t, 0.1, 0.17)),
    rest: settled ? 1 : gentle(span(t, 1.4, 1.75)),
    // A sphere first, then a slab with rounded corners and edges, as thick as a quarter of it.
    // A domed, lens-like ball first, then a slab a quarter as thick, rounded at corners and edges.
    rounding: mix(1, 0.46, morph),
    depth: mix(0.5, 0.3, morph),
    edge: mix(0.5, 0.3, morph),
    // The face bulges most while the glass is new and settles flatter as it comes to rest.
    dome: mix(0.2, 0.32 - 0.18 * sineInOut(span(t, 0.5, 1.2)), morph) * (1 - flat),
    // The glass keeps its index to the end: flat over the mark, it no longer moves it.
    ior: 1 + 0.5 * (0.8 + 0.2 * thickness),
    split: settled ? 0 : 0.035 * (0.6 + 0.4 * thickness),
    gap: 0.04,
    tilt: 0,
    glass: settled ? 0 : smooth(span(t, 0.03, 0.2)) * (1 - span(t, 1.96, 2)),
    haze: mix(0.12, 0.08, morph) * (1 - flat),
    // What is left of the studio's light on the glass, falling off as the lights leave.
    lamp: settled ? 0 : 1 - gentle(span(t, 1.18, 1.96)),
    drift: away,
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
