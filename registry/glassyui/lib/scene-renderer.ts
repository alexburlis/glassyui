import { createSpring, localRect, stepSpring } from './liquid-motion';
import { SLAB_AIR_GAP, SLAB_MAX_SLOPE, SLAB_MIN_RISE, SLAB_RISE_SPAN } from './slab-optics';
import type { Spring } from './liquid-motion';
import type { GlassSceneRegistry } from './scene-context';

/*
 * The WebGL2 renderer behind GlassScene.
 *
 * Every registered glass element becomes a rounded box in one signed distance
 * field. Boxes fold together with a smooth minimum, so neighbours melt into a
 * single body when they come close. Each pixel inside the field is treated as
 * a thick slab of glass whose top curves down into a rounded bevel at the edge
 * and that floats a little above the scene's backdrop image. Light follows
 * Snell's law through the curved top, the slab, the flat underside and the air
 * gap, split into a spectrum of wavelengths, so the rim bends and fringes the
 * backdrop with colour where real glass would, and reflects all of it back
 * past the critical angle. The top reflects its surroundings with the exact
 * Fresnel term, tinted glass darkens and colours light with the length of its
 * path, and the shadow under tinted glass takes on its colour. Highlights come
 * from a fixed light above the top left, so the glass answers to what lies
 * behind it and never to where the pointer is. Glass that carries text keeps
 * it legible: where the backdrop would bring the face too close to the text
 * colour, the face dims or lifts just enough.
 *
 * Only the cells of the canvas that some glass can reach are drawn, and each
 * cell folds only the panes that reach it, so large scenes stay cheap.
 *
 * The canvas replaces the CSS material only while it really draws. Before the
 * first frame, and whenever WebGL2 is missing, lost or turned off by an
 * accessibility setting, elements keep their CSS glass. The root always says
 * which one shows in data-lg-scene-renderer: css, webgl or off.
 */

export type SceneOptics = {
  /** Refractive index. Window glass is about 1.5. */
  ior: number;
  /** Height of the glass slab in CSS pixels. Thicker glass bends further. */
  thickness: number;
  /** Width of the curved rim in CSS pixels. */
  bevel: number;
  /**
   * Spreads the refractive index by 0.4 times this value from red to violet
   * light. Flint glass spreads it by about 0.05. 0 turns it off.
   */
  dispersion: number;
  /** Multiplier on every element's frost radius. */
  frost: number;
  /** Strength of reflections and highlights. */
  specular: number;
};

export type SceneSettings = {
  /** Lets elements that set --lg-scene-flow ripple and wobble like liquid. */
  flow: boolean;
  optics: SceneOptics;
};

export type SceneRenderer = {
  update: (settings: SceneSettings) => void;
  destroy: () => void;
};

type SceneRendererOptions = {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  backdrop: HTMLElement;
  registry: GlassSceneRegistry;
  settings: SceneSettings;
};

const MAX_PANES = 24;

// The loop keeps drawing this long after the last sign of change, so a
// transition that starts a frame late still gets every frame.
const TAIL_MS = 400;

// Canvas and texture sizes stay bounded so a huge scene cannot exhaust a
// phone's GPU memory.
const MAX_PIXELS = 4_200_000;

const MAX_TEXTURE = 4096;

// The light sits above the top left, where interfaces conventionally light their surfaces.
const LIGHT = (() => {
  const [x, y, z] = [-0.5, -0.7, 0.5];
  const length = Math.hypot(x, y, z);

  return [x / length, y / length, z / length];
})();

// Shadows fade out within this distance, which bounds the drawn area.
const SHADOW_REACH = 70;

// The share of a tinted pane's shadow made of light that crossed the glass
// and took on its colour.
const SHADOW_TINT = 0.3;

// A flowing edge sways by up to this much per unit of flow.
const WOBBLE = 8;

// A leaving pane below this presence is invisible and is dropped.
const CULL = 0.004;

// Text on glass keeps this contrast with the face behind it. The margin over
// WCAG's 4.5:1 absorbs rounding to 8-bit colour.
const INK_CONTRAST = 4.6;

const RASTER_THROTTLE_MS = 150;

// Resolution steps the loop falls back to while frames run slow. An idle
// scene always finishes with a full-resolution frame.
const SCALES = [1, 0.75, 0.5];

const WARNING = 'Glassy UI GlassScene: ';

const RENDERER = 'data-lg-scene-renderer';

const STATE = 'data-lg-scene-state';

const BACKDROP = 'data-lg-scene-backdrop';

const SCALE = 'data-lg-scene-scale';

const ACTIVE = 'data-lg-scene';

const warned = new Set<string>();

const warnOnce = (key: string, message: string) => {
  if (warned.has(key)) return;

  warned.add(key);
  console.warn(WARNING + message);
};

// A golden-angle spiral spreads the frost taps evenly over a unit disk.
const DISK = Array.from({ length: 9 }, (_, index) => {
  const radius = Math.sqrt((index + 0.5) / 9);
  const angle = index * 2.39996;

  return `vec2(${(radius * Math.cos(angle)).toFixed(5)}, ${(radius * Math.sin(angle)).toFixed(5)})`;
}).join(', ');

// Cauchy's law makes the index linear in 1 / λ². Measured from the index at
// the helium d line, 587.6 nm, where glass indices are quoted, violet light
// (400 nm) and red light (700 nm) sit at these shares of the full spread.
const VIOLET = (1 / 400 ** 2 - 1 / 587.6 ** 2) / (1 / 400 ** 2 - 1 / 700 ** 2);

const RED = VIOLET - 1;

// Seven bands of the visible spectrum, each at its place from violet (0) to
// red (1) in 1 / λ², with what it adds to red, green and blue: the CIE colour
// matching functions taken to linear sRGB, negative lobes dropped. Every
// channel's weights sum to 1, so light that does not split stays white.
const BANDS = [
  [0.1472, 0.0346, 0, 0.3599],
  [0.3827, 0, 0, 0.5828],
  [0.5611, 0, 0.3283, 0.0573],
  [0.6995, 0, 0.5228, 0],
  [0.8089, 0.5476, 0.1489, 0],
  [0.897, 0.3774, 0, 0],
  [0.9689, 0.0405, 0, 0],
];

// Where each channel's light lands on average along the same line.
const CENTROID = [1, 2, 3].map(
  (channel) =>
    BANDS.reduce((sum, band) => sum + band[0] * band[channel], 0) /
    BANDS.reduce((sum, band) => sum + band[channel], 0),
);

// Each vertex carries a cell corner and the mask of panes that can reach the
// cell. The mask is an integer, so it goes to the fragment shader flat.
const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 a_corner;
layout(location = 1) in uint a_mask;
flat out uint v_mask;
void main() {
  v_mask = a_mask;
  gl_Position = vec4(a_corner, 0.0, 1.0);
}`;

/*
 * Glass model, per pixel p in CSS pixels from the scene's top left:
 *
 * - Distance: each pane is a rounded box. The fold is Inigo Quilez's
 *   quadratic smooth minimum, h = max(k - |a - b|, 0) / k and
 *   d = min(a, b) - h² k / 4, which bridges panes closer than k. Material
 *   (tint, frost, bevel, alpha) blends with the same weight, so a bridge
 *   takes on the look of both sides. A pane can change the fold only within
 *   about k of the others, so a cell folds just the panes whose shadow and
 *   bridges can reach it.
 * - Height: with s the depth inside the edge and u = s / W across a bevel of
 *   width W, the surface rises as f(u) = (1 - (1 - u)^4)^(1/4): vertical at
 *   the edge, flat from u = 1. The slab is z = T (0.3 + 0.7 f) thick and its
 *   slope is 0.7 T / W · f'(u).
 * - Refraction: the view ray (0, 0, -1) bends through the surface normal into
 *   the glass (GLSL refract, eta = 1 / n), crosses the slab, bends again at
 *   the flat underside, where n sin θ = sin θ', and crosses an air gap to the
 *   backdrop. The rim bends rays toward the middle, so it magnifies the
 *   backdrop beneath it; past the steepest point the shift turns back, which
 *   gives the mirrored strip real glass shows at its edge. The flat face
 *   shows the backdrop in place.
 * - Total internal reflection: the underside's exact Fresnel term rises to 1
 *   at the critical angle, sin θ = 1 / n, and the backdrop fades into the
 *   surroundings the glass reflects back up.
 * - Dispersion: violet and red light each take their own path, with indices
 *   from Cauchy's law. Seven bands of the spectrum between the two add up to
 *   red, green and blue, so white light fans out into a rainbow where the
 *   glass tilts and stays white where it does not. Narrow fans use the three
 *   channel centroids, wide ones a blur that matches the band spacing.
 * - Frost: nine disk taps plus a matching mip level blur the refracted image,
 *   in proportion to the slab's thickness.
 * - Absorption: tinted glass passes (1 - a) of the light across its full
 *   thickness and, by Beer-Lambert, an exponential share of that along the
 *   path the ray really takes.
 * - Reflection: the top's exact Fresnel term, less its value head on so the
 *   face stays clear, mirrors the surroundings: the backdrop beside the glass
 *   where the mirrored ray points down, a bright blurred sky where it points
 *   up. The edge catches a fixed light above the top left in a hairline.
 *   Nothing brighter runs parallel to it inside the glass: a band there reads
 *   as a cushion, and what shows at the rim should be the bending.
 * - Shadow: a soft drop shadow. Part of it is light that crossed the glass, so
 *   tinted glass casts a shadow of its colour whose brightest channel darkens
 *   as much as under clear glass.
 * - Legibility: a pane with ink passes the luminance range its face may take
 *   while that ink keeps its contrast. In linear light the face scales down
 *   to the cap or mixes toward white up to the floor, leaving the outermost
 *   pixel of the rim at full light.
 */
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

#define MAX_PANES ${MAX_PANES}

const float SHADOW_REACH = ${SHADOW_REACH.toFixed(1)};
const float AIR_GAP = ${SLAB_AIR_GAP.toFixed(1)};
const float SHADOW_TINT = ${SHADOW_TINT.toFixed(2)};
const float VIOLET = ${VIOLET.toFixed(5)};
const float RED = ${RED.toFixed(5)};
const vec3 LIGHT = vec3(${LIGHT.map((value) => value.toFixed(5)).join(', ')});
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const vec2 DISK[9] = vec2[9](${DISK});
const float BAND_AT[7] = float[7](${BANDS.map(([at]) => at.toFixed(4)).join(', ')});
const vec3 BAND_RGB[7] = vec3[7](${BANDS.map(([, red, green, blue]) => `vec3(${red.toFixed(4)}, ${green.toFixed(4)}, ${blue.toFixed(4)})`).join(', ')});
const vec3 CENTROID = vec3(${CENTROID.map((value) => value.toFixed(4)).join(', ')});

uniform sampler2D u_backdrop;
uniform vec2 u_size;
uniform vec2 u_backing;
uniform vec4 u_texMap;
uniform float u_baseLod;
uniform float u_density;
uniform vec4 u_rect[MAX_PANES];  // centre x, centre y, half width, half height
uniform vec4 u_radii[MAX_PANES]; // corner radius, merge radius, frost radius, seed
uniform vec4 u_tint[MAX_PANES];  // premultiplied
uniform vec4 u_extra[MAX_PANES]; // flow, press, bevel width, alpha
uniform vec2 u_face[MAX_PANES];  // luminance cap and floor for legible ink
uniform vec4 u_optics; // ior, thickness, dispersion, specular
uniform vec4 u_look;   // shadow, highlight, flow amplitude, pixel ratio
uniform float u_time;

flat in highp uint v_mask;

out vec4 fragColor;

vec3 sampleAt(vec2 q, float lod) {
  return textureLod(u_backdrop, q * u_texMap.xy + u_texMap.zw, lod).rgb;
}

// Signed distance to a rounded box and its outward gradient.
vec3 roundedBox(vec2 p, vec2 b, float r) {
  vec2 s = vec2(p.x < 0.0 ? -1.0 : 1.0, p.y < 0.0 ? -1.0 : 1.0);
  vec2 q = abs(p) - b + r;

  if (q.x > 0.0 && q.y > 0.0) {
    float l = length(q);
    return vec3(l - r, s * q / l);
  }

  if (q.x > q.y) return vec3(q.x - r, s.x, 0.0);

  return vec3(q.y - r, 0.0, s.y);
}

vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

// Dims a face brighter than cap and lifts one darker than lift, so the text
// on it keeps its contrast whatever lies behind.
vec3 legible(vec3 c, float cap, float lift) {
  vec3 l = toLinear(c);
  float y = dot(l, LUMA);

  if (y > cap) l *= cap / y;
  else if (y < lift) l = mix(l, vec3(1.0), (lift - y) / max(1.0 - y, 1e-4));

  return toSrgb(l);
}

// A logistic step, 1 / (1 + e^(1.7 x / sigma)), in base 2.
float softStep(float x, float sigma) {
  return 1.0 / (1.0 + exp2(clamp(2.4526 * x / sigma, -40.0, 40.0)));
}

// Slow travelling waves bend a flowing pane's outline, by up to 7.95 pixels
// along each axis per unit of flow.
vec2 warp(vec2 p, float t, float seed) {
  return vec2(
    sin(p.y / 90.0 + t * 0.9 + seed) + 0.5 * sin(p.x / 47.0 - t * 1.3 + seed * 1.7),
    sin(p.x / 90.0 - t * 0.8 + seed * 2.3) + 0.5 * sin(p.y / 47.0 + t * 1.1 + seed * 0.6)
  ) * 5.3;
}

// Surface ripples tilt a flowing pane's normals.
vec2 ripple(vec2 p, float t) {
  vec2 a = p / 38.0;
  float c = cos(a.x * 0.7 + a.y * 0.9 - t * 1.1) * 0.4;

  return vec2(cos(a.x + t * 1.7) * 0.6 + c * 0.7, cos(a.y - t * 1.3) * 0.6 + c * 0.9);
}

// Unpolarised Fresnel reflectance where light passes from index a into index
// b, arriving at cos i and leaving at cos t. Past the critical angle cos t is
// 0 and it reflects everything.
float fresnel(float a, float b, float cosI, float cosT) {
  float s = (a * cosI - b * cosT) / (a * cosI + b * cosT);
  float q = (a * cosT - b * cosI) / (a * cosT + b * cosI);

  return 0.5 * (s * s + q * q);
}

// Follows the view ray down through glass of index n that is z thick here.
// Returns where it lands on the backdrop, as a shift from where it entered;
// 1 / cos of its angle inside, which stretches the path through the glass;
// and the share of light the underside lets out, relative to head on.
vec4 through(vec3 N, float n, float z) {
  vec3 inside = refract(vec3(0.0, 0.0, -1.0), N, 1.0 / n);
  float cosB = max(-inside.z, 0.05);
  float sinOut = n * length(inside.xy);
  float cosOut = sqrt(max(1.0 - sinOut * sinOut, 0.0));
  // Past the critical angle the ray lands as if it had left at grazing
  // angle, so the backdrop stays continuous as it fades out.
  vec2 leaving = n * inside.xy / max(sinOut, 1.0);
  vec2 shift = inside.xy * (z / cosB) + leaving * (AIR_GAP / max(cosOut, 0.1));
  float head = (n - 1.0) / (n + 1.0);

  return vec4(shift, 1.0 / cosB, clamp((1.0 - fresnel(n, 1.0, cosB, cosOut)) / (1.0 - head * head), 0.0, 1.0));
}

// The shadow under glass of this tint, premultiplied.
vec4 castShadow(vec2 p, float shadow, vec4 tint) {
  vec3 filtered = 1.0 - tint.a + tint.rgb;
  filtered /= max(max(filtered.r, filtered.g), max(filtered.b, 1e-4));

  if (shadow < 0.002 || min(min(filtered.r, filtered.g), filtered.b) > 0.996) return vec4(0.0, 0.0, 0.0, shadow);

  float strength = min(shadow / (1.0 - SHADOW_TINT), 1.0);

  return vec4(sampleAt(p, u_baseLod) * filtered * (strength * SHADOW_TINT), strength);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_backing.y - gl_FragCoord.y) * (u_size / u_backing);
  float t = u_time;
  float amp = u_look.z;

  float d = 1e5;
  vec2 g = vec2(0.0, -1.0);
  vec4 tint = vec4(0.0);
  float frost = 0.0;
  float bevel = 1.0;
  float flow = 0.0;
  float press = 0.0;
  float alpha = 0.0;
  float cap = 1.0;
  float lift = 0.0;

  uint panes = v_mask;

  for (int i = 0; i < MAX_PANES; i++) {
    if ((panes >> uint(i)) == 0u) break;
    if ((panes & (1u << uint(i))) == 0u) continue;

    vec4 rect = u_rect[i];
    vec4 radii = u_radii[i];
    vec4 extra = u_extra[i];
    vec2 q = p - rect.xy;

    if (extra.x * amp > 0.0) q += extra.x * amp * warp(p, t, radii.w);

    vec3 sd = roundedBox(q, rect.zw, radii.x);
    float k = radii.y;
    float h = max(k - abs(d - sd.x), 0.0) / k;
    float w = d < sd.x ? h * 0.5 : 1.0 - h * 0.5;

    d = min(d, sd.x) - h * h * k * 0.25;
    g = mix(g, sd.yz, w);
    tint = mix(tint, u_tint[i], w);
    frost = mix(frost, radii.z, w);
    bevel = mix(bevel, extra.z, w);
    flow = mix(flow, extra.x, w);
    press = mix(press, extra.y, w);
    alpha = mix(alpha, extra.w, w);
    cap = mix(cap, u_face[i].x, w);
    lift = mix(lift, u_face[i].y, w);
  }

  if (d > SHADOW_REACH) {
    fragColor = vec4(0.0);
    return;
  }

  float shadow = u_look.x * alpha * (0.6 * softStep(d - 8.0 * g.y, 14.0) + 0.4 * softStep(d, 3.0));
  float cover = clamp(0.5 - d * u_look.w, 0.0, 1.0);

  if (cover <= 0.0) {
    fragColor = castShadow(p, shadow, tint);
    return;
  }

  float s = -d;
  float W = max(bevel, 1.0);
  float u = s / W;
  float v = 1.0 - max(u, 0.002);
  float v4 = v * v * v * v;
  bool inBevel = u < 1.0;
  float f = inBevel ? pow(1.0 - v4, 0.25) : 1.0;
  float fp = inBevel ? v * v * v * pow(max(1.0 - v4, 1e-6), -0.75) : 0.0;
  float T = u_optics.y;
  float rise = ${SLAB_MIN_RISE.toFixed(1)} + ${SLAB_RISE_SPAN.toFixed(1)} * f;
  float z = T * rise;
  float slope = min(${SLAB_RISE_SPAN.toFixed(1)} * T / W * fp, ${SLAB_MAX_SLOPE.toFixed(1)});

  float gradLength = length(g);
  vec2 n2 = gradLength > 1e-4 ? g / gradLength : vec2(0.0, -1.0);
  vec2 tilt = slope * n2;

  if (flow * amp > 0.0) tilt += flow * amp * 0.18 * ripple(p, t);

  vec3 N = normalize(vec3(tilt, 1.0));
  float ior = max(u_optics.x, 1.0);
  vec4 ray = through(N, ior, z);
  vec2 base = p + ray.xy;

  float R = frost * rise;
  float lod = max(log2(max(R * u_density * 0.5, 1.0)), u_baseLod);

  // Violet and red land at the ends of a short line; the spectrum between
  // them only shows once that line spans half a device pixel.
  float spread = 0.4 * u_optics.z;
  vec2 violet = base;
  vec2 span = vec2(0.0);

  if (spread > 0.0 && dot(tilt, tilt) > 1e-8) {
    violet = p + through(N, ior + spread * VIOLET, z).xy;
    span = p + through(N, max(ior + spread * RED, 1.0), z).xy - violet;
  }

  float spanLength = length(span);
  bool split = spanLength * u_look.w >= 0.5;
  float texels = spanLength * u_density;
  float lodSplit = max(lod, log2(max(texels * 0.14, 1.0)));
  bool sharp = R < 0.5 && lodSplit <= u_baseLod;
  vec3 col = vec3(0.0);

  if (R >= 0.5) {
    for (int i = 0; i < 9; i++) col += sampleAt(base + DISK[i] * R, lod);
    col /= 9.0;
  } else if (!split || !sharp) {
    col = sampleAt(base, u_baseLod);
  }

  if (split) {
    vec3 bands = vec3(0.0);

    if (texels > 3.0) {
      for (int k = 0; k < 7; k++) bands += BAND_RGB[k] * sampleAt(violet + span * BAND_AT[k], lodSplit);
    } else {
      bands = vec3(
        sampleAt(violet + span * CENTROID.r, lodSplit).r,
        sampleAt(violet + span * CENTROID.g, lodSplit).g,
        sampleAt(violet + span * CENTROID.b, lodSplit).b
      );
    }

    // Sharp glass shows the spectrum as it is; frosted or widely split glass
    // keeps its own detail and takes on the colour the spectrum adds.
    col = sharp ? bands : col + bands - sampleAt(base, lodSplit);
  }

  float luma = dot(col, LUMA);
  col = mix(vec3(luma), col, 1.25);

  float cosIn = sqrt(max(1.0 - (1.0 - N.z * N.z) / (ior * ior), 0.0));
  float head = (ior - 1.0) / (ior + 1.0);
  head *= head;
  float reflectance = clamp((fresnel(1.0, ior, N.z, cosIn) - head) / (1.0 - head) * u_optics.w, 0.0, 1.0);
  vec3 sky = vec3(1.0);

  if (ray.w < 0.996 || reflectance > 0.004) {
    sky = mix(sampleAt(p + n2 * 18.0, log2(max(u_density, 1.0)) + 3.5), vec3(1.0), 0.3);
  }

  if (ray.w < 0.996) col = mix(sky, col, ray.w);

  float depth = rise * ray.z;
  float passed = exp2(log2(max(1.0 - tint.a, 1e-4)) * depth);
  col = col * passed + tint.rgb / max(tint.a, 1e-4) * (1.0 - passed);

  if (reflectance > 0.004) {
    vec3 mirrored = vec3(2.0 * N.z * N.xy, 2.0 * N.z * N.z - 1.0);
    float up = smoothstep(-0.3, 0.1, mirrored.z);
    vec3 env = sky;

    if (up < 1.0) {
      float reach = min((z + AIR_GAP) / max(-mirrored.z, 1e-3), 200.0);
      env = mix(sampleAt(p + mirrored.xy * reach, log2(max(u_density, 1.0)) + 1.5), sky, up);
    }

    col = mix(col, env, reflectance);
  }

  float facing = pow(abs(dot(n2, normalize(LIGHT.xy))), 1.5);
  col += exp(-max(s, 0.0) / 0.9) * 0.34 * (0.3 + 0.7 * facing) * u_look.y;

  // A pressed pane brightens as a whole, wherever it was touched.
  col = mix(col, vec3(1.0), 0.08 * press);

  col = clamp(col, 0.0, 1.0);

  if (cap < 1.0 || lift > 0.0) col = mix(col, legible(col, cap, lift), smoothstep(0.5, 2.0, s));

  float a = cover * alpha;
  vec4 under = a < 0.999 ? castShadow(p, shadow, tint) : vec4(0.0);
  fragColor = vec4(col * a + (1.0 - a) * under.rgb, a + (1.0 - a) * under.a);
}`;

const UNIFORMS = [
  'u_backdrop',
  'u_size',
  'u_backing',
  'u_texMap',
  'u_baseLod',
  'u_density',
  'u_rect',
  'u_radii',
  'u_tint',
  'u_extra',
  'u_face',
  'u_optics',
  'u_look',
  'u_time',
] as const;

type Uniforms = Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

type Gpu = {
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  cells: WebGLBuffer;
  texture: WebGLTexture;
  uniforms: Uniforms;
  maxTexture: number;
};

// Offsets into the packed frame. Every value a draw depends on lives here, so
// comparing two frames tells whether anything on screen would change.
const RECT = 0;

const RADII = 96;

const TINT = 192;

const EXTRA = 288;

const OPTICS = 384;

const LOOK = 388;

const TEX_MAP = 392;

const BASE_LOD = 396;

const DENSITY = 397;

const TIME = 398;

const COUNT = 399;

const SIZE = 400;

const BACKING = 402;

const FACE = 404;

const FRAME_LENGTH = 452;

type Rgba = [number, number, number, number];

type Pane = {
  element: HTMLElement;
  seed: number;
  cx: number;
  cy: number;
  hx: number;
  hy: number;
  radius: number;
  /** Premultiplied. */
  tint: Rgba;
  frost: number;
  merge: number;
  flow: number;
  /** Brightest and darkest the face may get while its ink stays legible. */
  cap: number;
  lift: number;
  opacity: number;
  presence: Spring;
  press: Spring;
  /** Still fading out after its element was hidden or removed. */
  ghost: boolean;
};

const TRANSPARENT: Rgba = [0, 0, 0, 0];

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

const channel = (token: string, scale: number) =>
  token === 'none'
    ? 0
    : token.endsWith('%')
      ? (Number(token.slice(0, -1)) / 100) * scale
      : Number(token);

const hexColour = (hex: string): Rgba | null => {
  const digits = hex.length <= 4 ? [...hex].map((digit) => digit + digit).join('') : hex;

  if (!/^[\da-f]{6}([\da-f]{2})?$/i.test(digits)) return null;

  const value = (index: number) => parseInt(digits.slice(index, index + 2), 16) / 255;

  return [value(0), value(2), value(4), digits.length === 8 ? value(6) : 1];
};

// Reads the sRGB colours browsers serialise for registered <color> properties
// without touching a canvas.
const quickColour = (text: string): Rgba | null => {
  if (text.startsWith('#')) return hexColour(text.slice(1));

  const match = /^(rgba?|color)\((.*)\)$/i.exec(text);

  if (!match) return null;

  const tokens = match[2].split(/[\s,/]+/).filter(Boolean);
  const isColourFunction = match[1].toLowerCase() === 'color';

  if (isColourFunction && tokens.shift()?.toLowerCase() !== 'srgb') return null;

  if (tokens.length < 3 || tokens.length > 4) return null;

  if (!tokens.every((token) => token === 'none' || NUMBER.test(token.replace(/%$/, ''))))
    return null;

  const scale = isColourFunction ? 1 : 255;

  return [
    channel(tokens[0], scale) / scale,
    channel(tokens[1], scale) / scale,
    channel(tokens[2], scale) / scale,
    tokens[3] === undefined ? 1 : channel(tokens[3], 1),
  ];
};

const colourCache = new Map<string, Rgba>();

let colourProbe: CanvasRenderingContext2D | null = null;

// Any other colour syntax is painted into one pixel and read back.
const probeColour = (text: string): Rgba | null => {
  if (!CSS.supports('color', text)) return null;

  colourProbe ??= (() => {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;

    return probe.getContext('2d', { willReadFrequently: true });
  })();

  if (!colourProbe) return null;

  colourProbe.clearRect(0, 0, 1, 1);
  colourProbe.fillStyle = text;
  colourProbe.fillRect(0, 0, 1, 1);
  const [red, green, blue, alpha] = colourProbe.getImageData(0, 0, 1, 1).data;

  return [red / 255, green / 255, blue / 255, alpha / 255];
};

const premultiply = ([red, green, blue, alpha]: Rgba): Rgba => {
  const a = clamp01(alpha);

  return [clamp01(red) * a, clamp01(green) * a, clamp01(blue) * a, a];
};

const parseColour = (value: string): Rgba => {
  const text = value.trim();

  if (!text || text === 'transparent') return TRANSPARENT;

  const quick = quickColour(text);

  if (quick && quick.every(Number.isFinite)) return premultiply(quick);

  const cached = colourCache.get(text);

  if (cached) return cached;

  const probed = probeColour(text);

  if (!probed) {
    warnOnce(`colour:${text}`, `"${text}" is not a colour, so the glass ignores it.`);

    return TRANSPARENT;
  }

  if (colourCache.size > 256) colourCache.clear();

  const colour = premultiply(probed);
  colourCache.set(text, colour);

  return colour;
};

const toLinear = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

// The face luminance range that keeps text in this premultiplied colour
// legible. Ink brighter than 0.18, where the two bounds meet, caps how bright
// the face may get; darker ink sets how bright it must stay. Transparent ink
// leaves the glass as it is.
const faceRange = ([red, green, blue, alpha]: Rgba): [number, number] => {
  if (alpha <= 0) return [1, 0];

  const ink =
    0.2126 * toLinear(red / alpha) +
    0.7152 * toLinear(green / alpha) +
    0.0722 * toLinear(blue / alpha);

  return ink >= 0.18
    ? [clamp01((ink + 0.05) / INK_CONTRAST - 0.05), 0]
    : [1, clamp01(INK_CONTRAST * (ink + 0.05) - 0.05)];
};

// Finds the first url() in a computed background-image and undoes CSS escapes.
const firstUrl = (value: string) => {
  const match =
    /url\(\s*(?:"((?:[^"\\]|\\[\s\S])*)"|'((?:[^'\\]|\\[\s\S])*)'|([^)\s]*))\s*\)/i.exec(value);

  if (!match) return null;

  const raw = match[1] ?? match[2] ?? match[3] ?? '';

  const url = raw.replace(/\\([\da-f]{1,6}\s?|[\s\S])/gi, (_, escape: string) =>
    /^[\da-f]/i.test(escape) ? String.fromCodePoint(parseInt(escape, 16)) : escape,
  );

  return url || null;
};

const describeUrl = (url: string) => (url.length > 80 ? `${url.slice(0, 77)}...` : url);

// WebGL reads same-origin, data: and blob: images without CORS.
const needsCors = (url: string) => {
  const target = new URL(url, document.baseURI);

  return /^https?:$/.test(target.protocol) && target.origin !== window.origin;
};

export function createSceneRenderer({
  root,
  canvas,
  backdrop,
  registry,
  settings: initialSettings,
}: SceneRendererOptions): SceneRenderer {
  const setAttribute = (name: string, value: string) => {
    if (root.getAttribute(name) !== value) root.setAttribute(name, value);
  };

  const context = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
  });

  if (!context) {
    warnOnce('webgl2', 'WebGL2 is unavailable, so the scene keeps its CSS glass.');
    setAttribute(RENDERER, 'css');

    return { update: () => {}, destroy: () => {} };
  }

  const gl = context;
  let settings = initialSettings;
  let gpu: Gpu | null = null;
  let lost = gl.isContextLost();
  let failed = false;
  let destroyed = false;
  // True once the canvas has drawn the scene and until it hands back to CSS.
  let live = false;
  let mode: 'on' | 'off' = 'on';
  let reducedMotion = false;
  let lowQuality = false;
  let hidden = document.hidden;
  let onscreen = false;
  let frameId = 0;
  let lastTick = 0;
  let tailUntil = 0;
  let flowTime = 0;
  let flowing = false;
  let snapPresence = true;
  let dirty = true;
  let seedCounter = 0;
  let scaleIndex = 0;
  let shadowStrength = 0;
  let highlightStrength = 0;
  const deltas: number[] = [];

  const box = { left: 0, top: 0, width: 0, height: 0 };
  // Where the backdrop layer sits, relative to the box. It fills the box,
  // unless the scene pins it to the viewport and scrolling carries the box.
  const backdropBox = { left: 0, top: 0, width: 0, height: 0 };
  const records = new Map<HTMLElement, Pane>();
  let drawn: Pane[] = [];
  const frame = new Float32Array(FRAME_LENGTH);
  const previous = new Float32Array(FRAME_LENGTH);
  // Cell vertices, reused between frames: a corner as two floats, then a mask.
  let cellFloats = new Float32Array(0);
  let cellMasks = new Uint32Array(0);
  let cellVertices = 0;
  let cellsReady = false;
  let uniformsReady = false;

  // Backdrop image, from the CSS value to the texture on the GPU.
  let requestedUrl: string | null | undefined;
  let loadGeneration = 0;
  let image: HTMLImageElement | null = null;
  let imageUrl: string | null = null;
  let fill = 'rgb(255, 255, 255)';

  // The backdrop image lands at left/top in the raster, stepX/stepY raster
  // pixels per image pixel.
  let raster: {
    canvas: HTMLCanvasElement;
    key: string;
    url: string;
    width: number;
    height: number;
    left: number;
    top: number;
    stepX: number;
    stepY: number;
  } | null = null;

  let rasterAt = 0;
  let uploaded = false;

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const transparencyQuery = window.matchMedia('(prefers-reduced-transparency: reduce)');
  const contrastQuery = window.matchMedia('(prefers-contrast: more)');
  const forcedQuery = window.matchMedia('(forced-colors: active)');
  let resolutionQuery: MediaQueryList | null = null;

  // Values that fall outside the quick paths (calc() in engines without
  // @property) are resolved by a hidden element inside the backdrop layer.
  let probe: HTMLSpanElement | null = null;
  const probeCache = new Map<string, number>();

  const resolve = (raw: string, property: 'width' | 'flexGrow') => {
    const key = `${property}:${raw}`;
    const cached = probeCache.get(key);

    if (cached !== undefined) return cached;

    if (!probe) {
      probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;height:0;';
      backdrop.append(probe);
    }

    probe.style[property] = raw;
    const value = parseFloat(getComputedStyle(probe)[property]);
    probe.style[property] = '';
    const result = Number.isFinite(value) ? value : 0;

    if (probeCache.size > 256) probeCache.clear();

    probeCache.set(key, result);

    return result;
  };

  const readLength = (style: CSSStyleDeclaration, name: string) => {
    const raw = style.getPropertyValue(name).trim();

    if (!raw) return 0;

    if (raw.endsWith('px') && NUMBER.test(raw.slice(0, -2))) return Number(raw.slice(0, -2));

    if (NUMBER.test(raw)) return Number(raw);

    return resolve(raw, 'width');
  };

  const readNumber = (style: CSSStyleDeclaration, name: string) => {
    const raw = style.getPropertyValue(name).trim();

    if (!raw) return 0;

    return NUMBER.test(raw) ? Number(raw) : resolve(raw, 'flexGrow');
  };

  const measureBox = () => {
    if (root.getAttribute('data-lg-backdrop-space') !== 'viewport') {
      box.left = 0;
      box.top = 0;
      box.width = root.clientWidth;
      box.height = root.clientHeight;
      const layer = localRect(backdrop, root);
      backdropBox.left = layer.left;
      backdropBox.top = layer.top;
      backdropBox.width = layer.width;
      backdropBox.height = layer.height;

      return;
    }

    const rect = root.getBoundingClientRect();
    const scaleX = root.offsetWidth ? rect.width / root.offsetWidth : 1;
    const scaleY = root.offsetHeight ? rect.height / root.offsetHeight : 1;

    box.left = rect.left + root.clientLeft * scaleX;
    box.top = rect.top + root.clientTop * scaleY;
    box.width = Math.max(rect.width - (root.offsetWidth - root.clientWidth) * scaleX, 0);
    box.height = Math.max(rect.height - (root.offsetHeight - root.clientHeight) * scaleY, 0);

    const layer = backdrop.getBoundingClientRect();

    backdropBox.left = layer.left - box.left;
    backdropBox.top = layer.top - box.top;
    backdropBox.width = layer.width;
    backdropBox.height = layer.height;
  };

  // Glass nested inside other registered glass keeps its CSS material: one
  // field cannot show glass on top of glass.
  const eligible = (element: HTMLElement) => {
    if (element === root || !element.isConnected || !root.contains(element)) return false;

    for (let node = element.parentElement; node && node !== root; node = node.parentElement) {
      if (registry.elements.has(node)) return false;
    }

    return true;
  };

  const opacityOf = (element: HTMLElement, style: CSSStyleDeclaration) => {
    let opacity = Number(style.opacity);

    for (let node = element.parentElement; node && node !== root; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity);
    }

    return Number.isFinite(opacity) ? clamp01(opacity) : 1;
  };

  const radiusOf = (style: CSSStyleDeclaration, width: number, height: number) => {
    const token = style.borderTopLeftRadius.split(' ')[0] ?? '0';
    const value = parseFloat(token);

    if (!Number.isFinite(value)) return 0;

    return token.endsWith('%') ? (value / 100) * Math.min(width, height) : value;
  };

  const measure = (pane: Pane, style: CSSStyleDeclaration) => {
    const { element } = pane;
    const local = root.getAttribute('data-lg-backdrop-space') !== 'viewport';
    const rect = local ? localRect(element, root) : element.getBoundingClientRect();
    const scale = element.offsetWidth ? rect.width / element.offsetWidth : 1;

    pane.cx = rect.left + rect.width / 2 - box.left;
    pane.cy = rect.top + rect.height / 2 - box.top;
    pane.hx = rect.width / 2;
    pane.hy = rect.height / 2;
    pane.radius = Math.min(
      radiusOf(style, element.offsetWidth, element.offsetHeight) * scale,
      pane.hx,
      pane.hy,
    );
    pane.tint = parseColour(style.getPropertyValue('--lg-scene-tint'));
    pane.frost = readLength(style, '--lg-scene-frost');
    pane.merge = readLength(style, '--lg-scene-merge');
    pane.flow = readNumber(style, '--lg-scene-flow');
    [pane.cap, pane.lift] = faceRange(parseColour(style.getPropertyValue('--lg-scene-ink')));
    pane.press.target = clamp01(readNumber(style, '--lg-press'));
    pane.opacity = opacityOf(element, style);
  };

  const release = (pane: Pane) => {
    pane.element.removeAttribute(ACTIVE);
    records.delete(pane.element);
    resizeObserver.unobserve(pane.element);
  };

  // Hands every element back to its CSS glass.
  const deactivate = () => {
    for (const pane of records.values()) release(pane);

    live = false;
    drawn = [];
    snapPresence = true;
    dirty = true;
  };

  const stop = () => {
    if (frameId) cancelAnimationFrame(frameId);

    frameId = 0;
    lastTick = 0;
  };

  const canDraw = () => !destroyed && !lost && !failed && mode === 'on' && gpu !== null;

  const fail = (key: string, message: string) => {
    deactivate();
    image = null;
    imageUrl = null;
    raster = null;
    uploaded = false;
    setAttribute(RENDERER, 'css');
    setAttribute(BACKDROP, 'error');
    warnOnce(key, message);
  };

  /*
   * The renderer loads the backdrop as the layer does, so the browser
   * downloads a same-origin image once. Only another origin needs a CORS copy
   * for WebGL; asking for it after the shared load lets the browser answer
   * from cache when the response allows any origin.
   */
  const load = (url: string) => {
    loadGeneration += 1;
    const generation = loadGeneration;

    const request = (cors: boolean, onLoad: (next: HTMLImageElement) => void) => {
      const next = new Image();
      let delivered = false;

      const loaded = () => {
        if (delivered || generation !== loadGeneration || destroyed) return;

        delivered = true;
        onLoad(next);
      };

      if (cors) next.crossOrigin = 'anonymous';

      next.decoding = 'async';
      next.addEventListener('load', loaded, { once: true });
      next.addEventListener('error', () => {
        if (generation !== loadGeneration || destroyed) return;

        fail(
          'backdrop',
          cors
            ? `the backdrop image ${describeUrl(url)} failed to load with CORS, so WebGL cannot read it and the scene keeps its CSS glass. Serve it from this origin or with CORS headers.`
            : `the backdrop image ${describeUrl(url)} failed to load, so the scene keeps its CSS glass.`,
        );
      });
      next.src = url;

      // A preloaded theme image is already drawable. Waiting for its load event would leave
      // the old wallpaper in the canvas for a paint after the page has changed appearance.
      if (next.complete && next.naturalWidth > 0) loaded();
    };

    const accept = (next: HTMLImageElement) => {
      if (!next.naturalWidth || !next.naturalHeight) {
        fail(
          'backdrop',
          `the backdrop image ${describeUrl(url)} has no size, so the scene keeps its CSS glass.`,
        );

        return;
      }

      image = next;
      imageUrl = url;
      dirty = true;
      wake();
    };

    setAttribute(BACKDROP, 'loading');
    request(false, (shared) => {
      if (needsCors(url)) request(true, accept);
      else accept(shared);
    });
  };

  const checkBackdrop = () => {
    // After React removes a scene and before it destroys the renderer, a
    // navigation's head update still wakes the observers. The detached layer
    // has no computed style, which is not a missing backdrop.
    if (!backdrop.isConnected) return;

    const url = firstUrl(getComputedStyle(backdrop).backgroundImage);

    if (url === requestedUrl) return;

    requestedUrl = url;

    if (url) load(url);
    else {
      loadGeneration += 1;
      fail('backdrop', 'the scene has no backdrop image, so it keeps its CSS glass.');
    }
  };

  // The raster fills transparent parts of the backdrop with the colour behind
  // the scene, as the page would.
  const readFill = () => {
    for (let node: HTMLElement | null = root; node; node = node.parentElement) {
      const colour = getComputedStyle(node).backgroundColor;
      const rgba = parseColour(colour);

      if (rgba[3] > 0) return colour;
    }

    return 'rgb(255, 255, 255)';
  };

  const readLook = () => {
    const style = getComputedStyle(root);
    const shadow = Number(style.getPropertyValue('--lg-scene-shadow'));
    const highlight = Number(style.getPropertyValue('--lg-scene-highlight'));

    shadowStrength = Number.isFinite(shadow) ? shadow : 0;
    highlightStrength = Number.isFinite(highlight) ? highlight : 0;
  };

  const coverFit = (width: number, height: number, source: HTMLImageElement) => {
    const scale = Math.max(width / source.naturalWidth, height / source.naturalHeight);

    return {
      scale,
      offsetX: (width - source.naturalWidth * scale) / 2,
      offsetY: (height - source.naturalHeight * scale) / 2,
    };
  };

  const upload = () => {
    if (!gpu || !raster) return false;

    gl.bindTexture(gl.TEXTURE_2D, gpu.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, raster.canvas);
    } catch (error) {
      fail(
        'backdrop',
        `the backdrop image ${describeUrl(raster.url)} cannot be read by WebGL (${
          error instanceof Error ? error.message : String(error)
        }). Serve it from this origin or with CORS headers.`,
      );

      return false;
    }

    gl.generateMipmap(gl.TEXTURE_2D);
    uploaded = true;
    dirty = true;

    return true;
  };

  // Draws the backdrop exactly as CSS paints it (cover, centred) into a
  // canvas at up to 2x resolution, then uploads it with mipmaps for frost.
  const ensureRaster = (force: boolean) => {
    if (!gpu || !image || !imageUrl) return false;

    const width = Math.max(backdropBox.width, 1);
    const height = Math.max(backdropBox.height, 1);

    const density = Math.min(
      window.devicePixelRatio || 1,
      lowQuality ? 1 : 2,
      MAX_TEXTURE / width,
      MAX_TEXTURE / height,
      gpu.maxTexture / width,
      gpu.maxTexture / height,
    );

    const textureWidth = Math.max(1, Math.ceil(width * density));
    const textureHeight = Math.max(1, Math.ceil(height * density));
    const key = `${textureWidth}x${textureHeight}@${density}|${fill}|${imageUrl}`;

    if (raster?.key === key) return uploaded || upload();

    const now = performance.now();

    if (
      raster &&
      raster.url === imageUrl &&
      uploaded &&
      !force &&
      now - rasterAt < RASTER_THROTTLE_MS
    )
      return true;

    const target = raster?.canvas ?? document.createElement('canvas');
    const context2d = target.getContext('2d');

    if (!context2d) {
      fail('raster', 'a 2D canvas is unavailable, so the scene keeps its CSS glass.');

      return false;
    }

    // The image's edges snap to whole raster pixels, as CSS snaps a
    // background. Firefox resamples an SVG drawn at a fractional size, which
    // would blur the glass by half a pixel.
    const fit = coverFit(width, height, image);
    const left = Math.round(fit.offsetX * density);
    const top = Math.round(fit.offsetY * density);
    const drawnWidth = Math.round((fit.offsetX + image.naturalWidth * fit.scale) * density) - left;
    const drawnHeight = Math.round((fit.offsetY + image.naturalHeight * fit.scale) * density) - top;

    target.width = textureWidth;
    target.height = textureHeight;
    context2d.setTransform(1, 0, 0, 1, 0, 0);
    context2d.fillStyle = fill;
    context2d.fillRect(0, 0, textureWidth, textureHeight);
    context2d.drawImage(image, left, top, drawnWidth, drawnHeight);

    raster = {
      canvas: target,
      key,
      url: imageUrl,
      width: textureWidth,
      height: textureHeight,
      left,
      top,
      stepX: drawnWidth / image.naturalWidth,
      stepY: drawnHeight / image.naturalHeight,
    };
    rasterAt = now;
    uploaded = false;

    return upload();
  };

  const createPane = (element: HTMLElement): Pane => {
    seedCounter += 1;

    return {
      element,
      seed: seedCounter * 1.618,
      cx: 0,
      cy: 0,
      hx: 0,
      hy: 0,
      radius: 0,
      tint: TRANSPARENT,
      frost: 0,
      merge: 0,
      flow: 0,
      cap: 1,
      lift: 0,
      opacity: 1,
      presence: createSpring(0.35, 0.3, snapPresence ? 1 : 0),
      press: createSpring(0.2, 0.3, 0),
      ghost: false,
    };
  };

  // Reads the DOM into pane records and advances every spring. Returns
  // whether anything is still moving.
  const sync = (dt: number) => {
    measureBox();
    checkBackdrop();
    readLook();

    const seen = new Set<Pane>();

    for (const element of registry.elements) {
      if (seen.size >= MAX_PANES) break;

      if (!eligible(element)) continue;

      const style = getComputedStyle(element);

      if (style.visibility !== 'visible' || element.getClientRects().length === 0) continue;

      let pane = records.get(element);

      if (!pane) {
        pane = createPane(element);
        records.set(element, pane);
        resizeObserver.observe(element);
      }

      measure(pane, style);

      if (pane.hx <= 0 || pane.hy <= 0) continue;

      pane.ghost = false;
      pane.presence.target = 1;
      seen.add(pane);
    }

    for (const pane of records.values()) {
      if (seen.has(pane)) continue;

      const { element } = pane;

      // An element that unmounted or hid itself dissolves; one that left the
      // scene or the registry returns to CSS at once.
      const dissolves =
        !reducedMotion &&
        pane.hx > 0 &&
        (!element.isConnected || (registry.elements.has(element) && eligible(element)));

      if (!dissolves) {
        release(pane);
        continue;
      }

      pane.ghost = true;
      pane.presence.target = 0;
    }

    let moving = false;

    for (const pane of records.values()) {
      moving = stepSpring(pane.presence, dt, reducedMotion) || moving;
      moving = stepSpring(pane.press, dt, reducedMotion) || moving;

      if (pane.ghost && pane.presence.value < CULL) release(pane);
    }

    flowing =
      settings.flow &&
      !reducedMotion &&
      !lowQuality &&
      [...records.values()].some((pane) => pane.flow > 0 && pane.presence.value >= CULL);

    return moving;
  };

  // Panes fold in order of decreasing merge radius, so a wide merge never
  // swallows a narrower one folded before it. Live panes claim slots first.
  const pack = (ratio: number, backingWidth: number, backingHeight: number) => {
    const live = [...records.values()].filter((pane) => !pane.ghost);

    const ghosts = [...records.values()]
      .filter((pane) => pane.ghost)
      .sort((a, b) => b.presence.value - a.presence.value);

    drawn = [...live, ...ghosts]
      .slice(0, MAX_PANES)
      .filter((pane) => pane.presence.value >= CULL)
      .sort((a, b) => b.merge - a.merge);

    frame.fill(0);

    const { optics } = settings;

    drawn.forEach((pane, index) => {
      const presence = pane.presence.value;
      const scale = 0.6 + 0.4 * presence;
      const halfX = pane.hx * scale;
      const halfY = pane.hy * scale;
      const bevel = Math.max(Math.min(optics.bevel, pane.radius, pane.hx, pane.hy), 1) * scale;

      frame.set([pane.cx, pane.cy, halfX, halfY], RECT + index * 4);
      frame.set(
        [pane.radius * scale, Math.max(pane.merge, 1e-4), pane.frost * optics.frost, pane.seed],
        RADII + index * 4,
      );
      frame.set(pane.tint, TINT + index * 4);
      frame.set(
        [pane.flow, pane.press.value, bevel, clamp01(presence) * pane.opacity],
        EXTRA + index * 4,
      );
      frame.set([pane.cap, pane.lift], FACE + index * 2);
    });

    frame.set([optics.ior, optics.thickness, optics.dispersion, optics.specular], OPTICS);

    frame[TIME] = flowing ? flowTime : 0;
    frame.set([shadowStrength, highlightStrength, flowing ? 1 : 0, ratio], LOOK);

    if (raster && image) {
      /*
       * The raster may lag a resize by a few frames. Mapping through the
       * backdrop's image pixels keeps it aligned meanwhile: box point q shows
       * image pixel (q - b - o) / s now, b being where the backdrop layer
       * sits in the box, which is raster pixel left + (q - b - o) step / s.
       */
      const fit = coverFit(Math.max(backdropBox.width, 1), Math.max(backdropBox.height, 1), image);
      const densityX = raster.stepX / fit.scale;
      const densityY = raster.stepY / fit.scale;

      frame.set(
        [
          densityX / raster.width,
          densityY / raster.height,
          (raster.left - (fit.offsetX + backdropBox.left) * densityX) / raster.width,
          (raster.top - (fit.offsetY + backdropBox.top) * densityY) / raster.height,
        ],
        TEX_MAP,
      );
      frame[BASE_LOD] = Math.max(Math.log2(densityX / ratio), 0);
      frame[DENSITY] = densityX;
    }

    frame[COUNT] = drawn.length;
    frame.set([box.width, box.height], SIZE);
    frame.set([backingWidth, backingHeight], BACKING);
  };

  /*
   * Splits the canvas into the cells that some glass can reach and writes two
   * triangles per cell, each vertex carrying the mask of panes that reach the
   * cell. A pane reaches its shadow's extent, twice the widest merge radius it
   * can fold with (past which the smooth minimum leaves visible pixels
   * unchanged) and the sway of a flowing edge. Every edge of those areas cuts
   * the canvas into columns and rows; a cell's mask is its column's mask and
   * its row's, and equal neighbours along a row join into one quad. Returns
   * the number of vertices.
   */
  const buildCells = (backingWidth: number, backingHeight: number) => {
    const ratioX = backingWidth / frame[SIZE];
    const ratioY = backingHeight / frame[SIZE + 1];
    const areas: number[] = [];

    const reach = (bit: number, cx: number, cy: number, halfX: number, halfY: number) => {
      const x0 = Math.max(Math.floor((cx - halfX) * ratioX), 0);
      const x1 = Math.min(Math.ceil((cx + halfX) * ratioX), backingWidth);
      const y0 = Math.max(Math.floor((cy - halfY) * ratioY), 0);
      const y1 = Math.min(Math.ceil((cy + halfY) * ratioY), backingHeight);

      if (x1 > x0 && y1 > y0) areas.push(x0, x1, y0, y1, 2 ** bit);
    };

    for (let index = 0; index < drawn.length; index += 1) {
      const rect = RECT + index * 4;
      const sway = frame[LOOK + 2] > 0 ? WOBBLE * frame[EXTRA + index * 4] : 0;
      const grow = SHADOW_REACH + 1 + 2 * frame[RADII + index * 4 + 1] + sway;

      reach(index, frame[rect], frame[rect + 1], frame[rect + 2] + grow, frame[rect + 3] + grow);
    }

    const edges = (offset: number) => {
      const values = new Set<number>();

      for (let index = offset; index < areas.length; index += 5)
        values.add(areas[index]).add(areas[index + 1]);

      return [...values].sort((a, b) => a - b);
    };

    const columns = edges(0);
    const rows = edges(2);

    const masks = (lines: number[], offset: number) =>
      lines.slice(0, -1).map((start, index) => {
        let mask = 0;

        for (let area = 0; area < areas.length; area += 5) {
          if (areas[area + offset] <= start && areas[area + offset + 1] >= lines[index + 1])
            mask |= areas[area + 4];
        }

        return mask;
      });

    const columnMasks = masks(columns, 0);
    const rowMasks = masks(rows, 2);
    const needed = columnMasks.length * rowMasks.length * 6 * 3;

    if (cellFloats.length < needed) {
      const data = new ArrayBuffer(Math.max(needed, cellFloats.length * 2) * 4);
      cellFloats = new Float32Array(data);
      cellMasks = new Uint32Array(data);
    }

    let vertices = 0;

    const corner = (x: number, y: number, mask: number) => {
      cellFloats[vertices * 3] = (x / backingWidth) * 2 - 1;
      cellFloats[vertices * 3 + 1] = 1 - (y / backingHeight) * 2;
      cellMasks[vertices * 3 + 2] = mask;
      vertices += 1;
    };

    const quad = (x0: number, x1: number, y0: number, y1: number, mask: number) => {
      corner(x0, y0, mask);
      corner(x1, y0, mask);
      corner(x0, y1, mask);
      corner(x0, y1, mask);
      corner(x1, y0, mask);
      corner(x1, y1, mask);
    };

    rowMasks.forEach((rowMask, row) => {
      let start = 0;
      let open = 0;

      columnMasks.forEach((columnMask, column) => {
        const mask = columnMask & rowMask;

        if (mask === open) return;

        if (open) quad(columns[start], columns[column], rows[row], rows[row + 1], open);

        start = column;
        open = mask;
      });

      if (open) quad(columns[start], columns.at(-1) ?? 0, rows[row], rows[row + 1], open);
    });

    return vertices;
  };

  const sameValues = (offset: number, length: number) => {
    for (let index = offset; index < offset + length; index += 1) {
      if (frame[index] !== previous[index]) return false;
    }

    return true;
  };

  const changed = (offset: number, length = 1) => !uniformsReady || !sameValues(offset, length);

  // Time, tint, frost and press change the material without changing a cell.
  // Compare every input buildCells reads before reusing its partition and buffer.
  const sameCells = () => {
    if (
      !cellsReady ||
      frame[COUNT] !== previous[COUNT] ||
      !sameValues(SIZE, 4) ||
      frame[LOOK + 2] !== previous[LOOK + 2]
    )
      return false;

    for (let index = 0; index < drawn.length; index += 1) {
      if (
        !sameValues(RECT + index * 4, 4) ||
        frame[RADII + index * 4 + 1] !== previous[RADII + index * 4 + 1] ||
        frame[EXTRA + index * 4] !== previous[EXTRA + index * 4]
      )
        return false;
    }

    return true;
  };

  const render = (final: boolean) => {
    if (!canDraw() || !gpu || !image || box.width < 1 || box.height < 1) return;

    const scale = final ? 1 : SCALES[scaleIndex];
    let ratio = Math.min(window.devicePixelRatio || 1, lowQuality ? 1 : 2) * scale;

    if (box.width * box.height * ratio * ratio > MAX_PIXELS)
      ratio = Math.sqrt(MAX_PIXELS / (box.width * box.height));

    const backingWidth = Math.max(1, Math.round(box.width * ratio));
    const backingHeight = Math.max(1, Math.round(box.height * ratio));

    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
      dirty = true;
    }

    fill = readFill();

    if (!ensureRaster(final) || !raster) return;

    pack(backingWidth / box.width, backingWidth, backingHeight);

    if (!dirty && sameValues(0, FRAME_LENGTH)) return;

    const { uniforms } = gpu;
    const updateCells = !sameCells();

    if (updateCells) {
      cellVertices = buildCells(backingWidth, backingHeight);
      cellsReady = true;
    }

    gl.viewport(0, 0, backingWidth, backingHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (cellVertices > 0) {
      gl.useProgram(gpu.program);
      gl.bindVertexArray(gpu.vao);

      if (updateCells) {
        gl.bindBuffer(gl.ARRAY_BUFFER, gpu.cells);
        gl.bufferData(gl.ARRAY_BUFFER, cellFloats.subarray(0, cellVertices * 3), gl.DYNAMIC_DRAW);
      }

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, gpu.texture);

      if (!uniformsReady) gl.uniform1i(uniforms.u_backdrop, 0);

      if (changed(SIZE, 2)) gl.uniform2f(uniforms.u_size, frame[SIZE], frame[SIZE + 1]);

      if (changed(BACKING, 2)) gl.uniform2f(uniforms.u_backing, frame[BACKING], frame[BACKING + 1]);

      if (changed(TEX_MAP, 4)) gl.uniform4fv(uniforms.u_texMap, frame, TEX_MAP, 4);

      if (changed(BASE_LOD)) gl.uniform1f(uniforms.u_baseLod, frame[BASE_LOD]);

      if (changed(DENSITY)) gl.uniform1f(uniforms.u_density, frame[DENSITY]);

      if (changed(RECT, MAX_PANES * 4)) gl.uniform4fv(uniforms.u_rect, frame, RECT, MAX_PANES * 4);

      if (changed(RADII, MAX_PANES * 4))
        gl.uniform4fv(uniforms.u_radii, frame, RADII, MAX_PANES * 4);

      if (changed(TINT, MAX_PANES * 4)) gl.uniform4fv(uniforms.u_tint, frame, TINT, MAX_PANES * 4);

      if (changed(EXTRA, MAX_PANES * 4))
        gl.uniform4fv(uniforms.u_extra, frame, EXTRA, MAX_PANES * 4);

      if (changed(FACE, MAX_PANES * 2)) gl.uniform2fv(uniforms.u_face, frame, FACE, MAX_PANES * 2);

      if (changed(OPTICS, 4)) gl.uniform4fv(uniforms.u_optics, frame, OPTICS, 4);

      if (changed(LOOK, 4)) gl.uniform4fv(uniforms.u_look, frame, LOOK, 4);

      if (changed(TIME)) gl.uniform1f(uniforms.u_time, frame[TIME]);

      gl.drawArrays(gl.TRIANGLES, 0, cellVertices);
      uniformsReady = true;
    } else uniformsReady = false;

    previous.set(frame);
    dirty = false;
    snapPresence = false;

    // The CSS material steps aside in the same frame the canvas takes over.
    for (const pane of drawn) {
      if (!pane.ghost && pane.element.getAttribute(ACTIVE) !== 'active')
        pane.element.setAttribute(ACTIVE, 'active');
    }

    live = true;
    setAttribute(RENDERER, 'webgl');

    if (raster.url === requestedUrl) setAttribute(BACKDROP, 'ready');
  };

  /*
   * Glass that appears in a live scene hands over its material at once and
   * grows in on the canvas, instead of flashing its CSS glass for a frame.
   * Registration and mutation callbacks both run before the next paint.
   */
  const claim = () => {
    if (!live || !canDraw()) return;

    let count = records.size;

    for (const element of registry.elements) {
      if (count >= MAX_PANES) break;

      if (records.has(element) || !eligible(element)) continue;

      if (
        getComputedStyle(element).visibility !== 'visible' ||
        element.getClientRects().length === 0
      )
        continue;

      records.set(element, createPane(element));
      resizeObserver.observe(element);
      element.setAttribute(ACTIVE, 'active');
      count += 1;
    }
  };

  const animationsRunning = () => {
    const checked = new Set<Element>();

    for (const pane of records.values()) {
      for (
        let node: Element | null = pane.element;
        node && !checked.has(node);
        node = node.parentElement
      ) {
        checked.add(node);

        if (node.getAnimations().some((animation) => animation.playState === 'running'))
          return true;

        if (node === root) break;
      }
    }

    return false;
  };

  // Frame times steer the resolution: a slow median steps down, a fast one
  // steps back up.
  const adaptScale = (delta: number) => {
    deltas.push(delta);

    if (deltas.length > 24) deltas.shift();

    if (deltas.length < 24) return;

    const median = [...deltas].sort((a, b) => a - b)[12];

    const next =
      median > 24
        ? Math.min(scaleIndex + 1, SCALES.length - 1)
        : median < 10
          ? Math.max(scaleIndex - 1, 0)
          : scaleIndex;

    if (next === scaleIndex) return;

    scaleIndex = next;
    deltas.length = 0;
    setAttribute(SCALE, String(SCALES[scaleIndex]));
  };

  const tick = (now: number) => {
    frameId = 0;

    if (!canDraw()) return;

    const dt = lastTick ? Math.min((now - lastTick) / 1000, 0.1) : 1 / 60;

    if (lastTick) adaptScale(now - lastTick);

    lastTick = now;

    const moving = sync(dt);

    if (flowing) flowTime += dt;

    const busy = moving || flowing || now < tailUntil || animationsRunning();

    if (busy) {
      render(false);
      frameId = requestAnimationFrame(tick);

      return;
    }

    lastTick = 0;
    render(true);
    setAttribute(STATE, 'idle');
  };

  function wake() {
    // A newly mounted offscreen scene needs no shaders. Visibility starts the same renderer
    // when it can actually paint, including after context restoration or transparency changes.
    if (!gpu && onscreen && !hidden && mode === 'on' && !destroyed && !lost && !failed) start();

    if (!canDraw()) return;

    tailUntil = performance.now() + TAIL_MS;

    if (hidden || !onscreen) {
      setAttribute(STATE, 'paused');

      return;
    }

    if (frameId) return;

    setAttribute(STATE, 'running');
    frameId = requestAnimationFrame(tick);
  }

  const evaluateMode = () => {
    const html = document.documentElement;
    const transparency = html.getAttribute('data-lg-reduce-transparency');

    const off =
      transparency === '1' ||
      (transparency !== '0' && transparencyQuery.matches) ||
      contrastQuery.matches ||
      forcedQuery.matches;

    reducedMotion = html.getAttribute('data-lg-reduce-motion') === '1' || motionQuery.matches;
    lowQuality = html.getAttribute('data-lg-quality') === 'low';

    if (off && mode === 'on') {
      mode = 'off';
      stop();
      deactivate();
      setAttribute(RENDERER, 'off');
      setAttribute(STATE, 'idle');
    } else if (!off && mode === 'off') {
      mode = 'on';
      setAttribute(RENDERER, 'css');
      snapPresence = true;
    }

    dirty = true;
    wake();
  };

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);

    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    return shader;
  };

  const build = (): Gpu | null => {
    const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    const vao = gl.createVertexArray();
    const cells = gl.createBuffer();
    const texture = gl.createTexture();

    const discard = () => {
      if (vertex) gl.deleteShader(vertex);

      if (fragment) gl.deleteShader(fragment);

      if (program) gl.deleteProgram(program);

      if (vao) gl.deleteVertexArray(vao);

      if (cells) gl.deleteBuffer(cells);

      if (texture) gl.deleteTexture(texture);
    };

    if (!vertex || !fragment || !program || !vao || !cells || !texture) {
      if (!gl.isContextLost()) {
        const failedShader = [vertex, fragment].find(
          (shader) => shader !== null && !gl.getShaderParameter(shader, gl.COMPILE_STATUS),
        );

        if (failedShader && !gl.isContextLost()) {
          warnOnce(
            'shader',
            `the glass shader failed to compile, so the scene keeps its CSS glass. ${gl.getShaderInfoLog(failedShader) ?? ''}`,
          );
        }
      }

      discard();

      return null;
    }

    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);

    // Link after submitting both compiles; successful linking establishes both shaders compiled.
    // Checking each compile first would wait for the GPU twice before submitting the link.
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      if (!gl.isContextLost()) {
        const failedShader = [vertex, fragment].find(
          (shader) => !gl.getShaderParameter(shader, gl.COMPILE_STATUS),
        );

        if (!gl.isContextLost()) {
          warnOnce(
            'shader',
            failedShader
              ? `the glass shader failed to compile, so the scene keeps its CSS glass. ${gl.getShaderInfoLog(failedShader) ?? ''}`
              : `the glass shader failed to link, so the scene keeps its CSS glass. ${gl.getProgramInfoLog(program) ?? ''}`,
          );
        }
      }

      discard();

      return null;
    }

    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    // Corners come from attribute 0, since Firefox emulates a missing
    // attribute 0 on every draw.
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, cells);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 12, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribIPointer(1, 1, gl.UNSIGNED_INT, 12, 8);
    gl.bindVertexArray(null);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    // SAFETY: the entries come from UNIFORMS, so every Uniforms key is present.
    const uniforms = Object.fromEntries(
      UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)]),
    ) as Uniforms;

    // SAFETY: MAX_TEXTURE_SIZE is a GLint parameter, which WebGL returns as a number.
    return {
      program,
      vao,
      cells,
      texture,
      uniforms,
      maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    };
  };

  const start = () => {
    gpu = build();
    cellsReady = false;
    uniformsReady = false;

    if (!gpu) {
      if (!gl.isContextLost()) {
        failed = true;
        setAttribute(RENDERER, 'css');
      }

      return;
    }

    uploaded = false;
    dirty = true;
  };

  const onContextLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    gpu = null;
    uploaded = false;
    stop();
    deactivate();
    setAttribute(RENDERER, 'css');
    setAttribute(STATE, 'idle');
    warnOnce(
      'context-lost',
      'the WebGL context was lost, so the scene shows its CSS glass until the browser restores it.',
    );
  };

  const onContextRestored = () => {
    lost = false;
    wake();
  };

  const onVisibility = () => {
    hidden = document.hidden;

    if (hidden) stop();

    wake();
  };

  const watchResolution = () => {
    resolutionQuery?.removeEventListener('change', onResolution);
    resolutionQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    resolutionQuery.addEventListener('change', onResolution);
  };

  function onResolution() {
    watchResolution();
    dirty = true;
    wake();
  }

  const onChange = () => {
    dirty = true;
    wake();
  };

  // Mutations the renderer causes itself never wake it.
  const rootObserver = new MutationObserver((mutations) => {
    const relevant = mutations.some(
      (mutation) =>
        mutation.target !== canvas &&
        mutation.target !== probe &&
        mutation.target !== backdrop &&
        !(mutation.type === 'attributes' && mutation.attributeName?.startsWith(ACTIVE)),
    );

    if (!relevant) return;

    checkBackdrop();
    claim();
    wake();
  });

  const documentObserver = new MutationObserver(() => {
    checkBackdrop();
    evaluateMode();
  });

  const headObserver = new MutationObserver(() => {
    checkBackdrop();
    wake();
  });

  const resizeObserver = new ResizeObserver(onChange);

  const intersectionObserver = new IntersectionObserver((entries) => {
    onscreen = entries[entries.length - 1]?.isIntersecting ?? true;

    if (!onscreen) stop();

    wake();
  });

  const unsubscribe = registry.subscribe(() => {
    claim();
    onChange();
  });

  const wakeEvents = ['focusin', 'focusout', 'transitionrun', 'animationstart'] as const;

  rootObserver.observe(root, {
    attributes: true,
    childList: true,
    subtree: true,
    characterData: true,
  });
  documentObserver.observe(document.documentElement, { attributes: true });
  headObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
  resizeObserver.observe(root);
  intersectionObserver.observe(root);
  wakeEvents.forEach((type) => root.addEventListener(type, onChange));
  window.addEventListener('resize', onChange);
  // Scrolling can change pane or viewport-backdrop coordinates, which pack detects. It does
  // not invalidate an unchanged local raster: the compositor can reuse it while it turns.
  window.addEventListener('scroll', wake, { capture: true, passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  document.fonts?.addEventListener('loadingdone', onChange);
  [motionQuery, transparencyQuery, contrastQuery, forcedQuery].forEach((query) =>
    query.addEventListener('change', evaluateMode),
  );
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  watchResolution();

  setAttribute(RENDERER, 'css');
  setAttribute(SCALE, String(SCALES[scaleIndex]));
  measureBox();
  checkBackdrop();
  evaluateMode();

  return {
    update(next) {
      settings = next;
      dirty = true;
      wake();
    },
    destroy() {
      destroyed = true;
      stop();
      rootObserver.disconnect();
      documentObserver.disconnect();
      headObserver.disconnect();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      unsubscribe();
      wakeEvents.forEach((type) => root.removeEventListener(type, onChange));
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', wake, { capture: true });
      document.removeEventListener('visibilitychange', onVisibility);
      document.fonts?.removeEventListener('loadingdone', onChange);
      [motionQuery, transparencyQuery, contrastQuery, forcedQuery].forEach((query) =>
        query.removeEventListener('change', evaluateMode),
      );
      resolutionQuery?.removeEventListener('change', onResolution);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      loadGeneration += 1;
      deactivate();
      probe?.remove();

      if (gpu && !gl.isContextLost()) {
        gl.deleteProgram(gpu.program);
        gl.deleteVertexArray(gpu.vao);
        gl.deleteBuffer(gpu.cells);
        gl.deleteTexture(gpu.texture);
      }

      gpu = null;
      // A remount in StrictMode reuses this canvas and its context, so the
      // context is released by shrinking it, never by losing it.
      canvas.width = 1;
      canvas.height = 1;
      setAttribute(RENDERER, 'css');
      [STATE, BACKDROP, SCALE].forEach((name) => root.removeAttribute(name));
    },
  };
}
