import { useLayoutEffect, useRef } from 'react';
import { PHONE_ASPECT } from './phone';
import type { PhoneBody } from './phone';

// The phone the desk turns into, as a solid: an aluminium unibody whose sides round into the back,
// a camera plateau standing proud of the back with three raised lenses, the flash, microphone and
// LiDAR scanner, a frosted glass panel below it, and the keys and Camera Control on its sides. It
// has no logo. Every part is the same rounded solid, built once and shaped by uniforms, so the body
// can stretch from the desk's landscape slab into the phone while it turns. WebGL draws it with the
// composition's own CSS camera, under the live screens: the desk shows through its back until the
// back spreads across it, and the phone's screen lies over its front.

/**
 * How far the body's front and back edges round over, as shares of its depth. The front rounds as
 * far as the rim the screen leaves, and the back rounds deeply into the sides, as a unibody does.
 */
const FRONT_ROUND = 0.1;

export const BACK_ROUND = 0.5;

// Steps around each corner of a solid's outline, and around its front and back edges.
const ARC_STEPS = 14;

const FRONT_STEPS = 5;

const BACK_STEPS = 9;

const VERTEX = `#version 300 es
in vec2 plan;
in vec2 corner;
in vec2 profile;
uniform vec2 extent;
uniform float radius;
uniform float depth;
uniform float frontRound;
uniform float backRound;
uniform vec3 centre;
uniform mat3 basis;
uniform float lift;
uniform vec3 pose;
uniform vec3 place;
uniform vec2 stage;
uniform float perspective;
out vec3 vNormal;
out vec3 vStage;
out vec3 vSlab;
out vec3 vLocal;
out float vSegment;

// CSS applies yaw, roll, then pitch to both the slab's points and its normals.
vec3 turn(vec3 p) {
  vec2 yaw = vec2(cos(pose.y), sin(pose.y));
  vec2 roll = vec2(cos(pose.z), sin(pose.z));
  vec2 pitch = vec2(cos(pose.x), sin(pose.x));
  p.xz = vec2(p.x * yaw.x + p.z * yaw.y, -p.x * yaw.y + p.z * yaw.x);
  p.xy = vec2(p.x * roll.x - p.y * roll.y, p.x * roll.y + p.y * roll.x);
  p.yz = vec2(p.y * pitch.x - p.z * pitch.y, p.y * pitch.y + p.z * pitch.x);
  return p;
}

void main() {
  // The side's profile, from the front face around the front edge, down the flat of the side and
  // around the back edge to the back face: how far inside the outline it is, how deep, and which
  // way it faces across the outline and through the solid.
  float segment = profile.x;
  float a = profile.y * 1.5707963;
  float halfDepth = depth * 0.5;
  float inset;
  float z;
  vec2 facing;

  if (segment < 0.5) {
    inset = frontRound * (sin(a) - 1.0);
    z = -halfDepth + frontRound * (1.0 - cos(a));
    facing = vec2(sin(a), -cos(a));
  } else if (segment < 2.5) {
    inset = backRound * (cos(a) - 1.0);
    z = halfDepth - backRound * (1.0 - sin(a));
    facing = vec2(cos(a), sin(a));
  } else if (segment < 3.5) {
    inset = -frontRound;
    z = -halfDepth;
    facing = vec2(0.0, -1.0);
  } else {
    inset = -backRound;
    z = halfDepth;
    facing = vec2(0.0, 1.0);
  }

  vec3 local = vec3(corner * (extent - radius) + plan * max(radius + inset, 0.0), z);
  vec3 normal = normalize(vec3(plan * facing.x, facing.y));
  vec3 slab = centre + basis * local;
  vec3 point = place + turn(slab * lift);

  vNormal = turn(basis * normal);
  vStage = point;
  vSlab = slab;
  vLocal = local;
  vSegment = segment;

  // The stage's CSS perspective, seen from its centre; depth runs toward the eye.
  float w = (perspective - point.z) / perspective;
  gl_Position = vec4(
    (point.x - stage.x * 0.5) * 2.0 / stage.x,
    (stage.y * 0.5 - point.y) * 2.0 / stage.y,
    -point.z / 4000.0 * w,
    w
  );
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vStage;
in vec3 vSlab;
in vec3 vLocal;
in float vSegment;
out vec4 colour;
uniform vec3 eye;
uniform float material;
uniform float silver;
uniform float glassEdge;
uniform vec3 edgeColour;
uniform float sweep;
uniform float fade;
uniform vec2 phone;
uniform float unit;
uniform float bodyDepth;
uniform vec2 extent;

float softbox(vec3 ray, vec3 toward, vec3 up, vec2 spread) {
  toward = normalize(toward);
  vec3 across = normalize(cross(up, toward));
  vec3 vertical = cross(toward, across);
  float facing = dot(ray, toward);
  vec2 p = vec2(dot(ray, across), dot(ray, vertical)) / max(facing, 0.001);
  p /= spread;
  return exp(-0.5 * dot(p, p)) * smoothstep(0.0, 0.25, facing);
}

// The screen reflection's studio, with a strip light behind the phone that a surface turning
// edge-on catches as a sheen. A rougher surface sees every light larger and softer.
vec3 studio(vec3 ray, float rough) {
  float widen = 1.0 + rough * 1.2;
  float key = softbox(ray, vec3(0.22, -0.32, 0.92), vec3(0.28, -0.96, 0.0), vec2(0.23, 0.85) * widen);
  float fill = softbox(ray, vec3(-0.5, -0.45, 0.74), vec3(-0.2, -0.98, 0.0), vec2(0.48, 0.65) * widen);
  float rim = softbox(ray, vec3(0.62, -0.18, -0.76), vec3(0.0, -1.0, 0.0), vec2(0.18, 0.9) * widen);
  float ceiling = pow(max(-ray.y, 0.0), 2.0);
  return vec3(0.012, 0.013, 0.016)
    + key * vec3(1.55, 1.5, 1.42)
    + fill * vec3(0.46, 0.52, 0.62)
    + rim * vec3(0.95, 0.96, 1.0)
    + ceiling * vec3(0.1, 0.11, 0.13);
}

// A surface of this colour with this normal, seen from the eye: light from above and in front, and
// the studio it mirrors, which grows toward grazing angles.
vec3 shade(vec3 base, vec3 normal, float rough, float gloss) {
  vec3 view = normalize(eye - vStage);
  float facing = clamp(dot(normal, view), 0.0, 1.0);
  float diffuse = 0.42 + 0.58 * clamp(dot(normal, normalize(vec3(0.12, -0.6, 0.79))) * 0.5 + 0.5, 0.0, 1.0);
  float fresnel = 0.04 + 0.96 * pow(1.0 - facing, 5.0);
  vec3 mirrored = 1.0 - exp(-studio(reflect(-view, normal), rough) * gloss * (0.25 + 0.75 * fresnel));
  return base * diffuse + mirrored * (1.0 - base * 0.6);
}

// The distance from a rounded rectangle; negative inside.
float box(vec2 p, vec2 centre, vec2 size, float radius) {
  vec2 q = abs(p - centre) - size + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

// How much of this pixel lies inside an edge at signed distance d.
float inside(float d) {
  return clamp(0.5 - d / max(length(fwidth(vLocal.xy)) * 0.75, 0.001), 0.0, 1.0);
}

// Highlights roll off toward white instead of clipping to it.
vec3 soft(vec3 c) {
  vec3 over = max(c - 0.78, 0.0);
  return min(c, 0.78) + over / (1.0 + over * 4.5);
}

void main() {
  // Every part is convex, so a surface facing away from the eye is hidden behind the rest; it is
  // dropped, as the desk's own face is the one seen while the slab is still the desk.
  vec3 normal = normalize(vNormal);

  if (dot(normal, eye - vStage) < 0.0) discard;

  // Black or silver anodised aluminium; the black shows less of the studio, so it reads as black.
  vec3 metal = mix(vec3(0.05, 0.05, 0.055), vec3(0.85, 0.855, 0.865), silver);
  float gloss = mix(0.62, 1.0, silver);
  vec3 c;
  float alpha = 1.0;

  // The back spreads across the face from the edge turning away, with a soft front.
  float reach = 1.0 - (vSlab.x / phone.x + 0.5);
  float front = sweep * 1.5 - 0.25;
  float spread = 1.0 - smoothstep(front - 0.25, front + 0.25, reach);

  if (material < 0.5) {
    if (vSegment > 3.5) {
      // The back: the unibody around a frosted glass panel, below the camera plateau.
      float m = 0.07 * unit;
      float plateauBottom = -phone.y * 0.5 + m + 0.53 * unit;
      vec2 panelMin = vec2(-phone.x * 0.5 + 0.085 * unit, plateauBottom + 0.06 * unit);
      vec2 panelMax = vec2(phone.x * 0.5 - 0.085 * unit, phone.y * 0.5 - 0.085 * unit);
      float onPanel = box(vSlab.xy, (panelMin + panelMax) * 0.5, (panelMax - panelMin) * 0.5, 0.12 * unit);
      vec3 panel = mix(vec3(0.075, 0.075, 0.08), vec3(0.815, 0.82, 0.83), silver);
      c = shade(metal, normal, 0.45, 0.9 * gloss);
      c = mix(c, shade(panel, normal, 0.6, 0.85 * gloss), inside(onPanel));
      c *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 1.2, abs(onPanel)));
      alpha = spread;
    } else if (vSegment > 2.5) {
      // The front, under the screen: black glass.
      c = shade(vec3(0.008, 0.008, 0.01), normal, 0.05, 1.0);
    } else {
      // The band. While the slab is still the desk its edge is the screen's glass edge.
      vec3 band = shade(metal, normal, 0.3, gloss);
      band = mix(band, shade(edgeColour, normal, 0.15, 0.8), glassEdge);

      // Antenna lines cross the sides near the corners.
      float line = min(abs(vSlab.y + phone.y * 0.39), abs(vSlab.y - phone.y * 0.39));
      band *= 1.0 - 0.3 * (1.0 - smoothstep(0.35, 0.9, line)) * (1.0 - glassEdge);

      // Under the bottom edge: the USB-C port between the speaker and microphone holes.
      if (vSlab.y > phone.y * 0.5 - bodyDepth) {
        float mid = vLocal.z + bodyDepth * 0.125;
        float port = box(vec2(vSlab.x, mid), vec2(0.0), vec2(0.06 * phone.x, 0.12 * bodyDepth), 0.12 * bodyDepth);
        band = mix(band, vec3(0.01), inside(port) * (1.0 - glassEdge));

        for (int i = 0; i < 6; i++) {
          float x = 0.14 * phone.x + float(i) * 0.036 * phone.x;
          float hole = min(length(vec2(vSlab.x - x, mid)), length(vec2(vSlab.x + x, mid))) - 0.06 * bodyDepth;
          band = mix(band, vec3(0.02), inside(hole) * (1.0 - glassEdge));
        }
      }

      c = band;
    }
  } else if (material < 1.5) {
    // The camera plateau: the same aluminium, with the flash, microphone and LiDAR on its top.
    c = shade(metal * 1.12, normal, 0.4, 0.95 * gloss);

    if (vSegment > 3.5) {
      float plateauH = extent.y * 2.0;
      vec2 flash = vec2(extent.x - 0.29 * plateauH, -extent.y + 0.27 * plateauH);
      vec2 mic = vec2(extent.x - 0.285 * plateauH, -extent.y + 0.52 * plateauH);
      vec2 lidar = vec2(extent.x - 0.285 * plateauH, -extent.y + 0.765 * plateauH);
      float flashR = 0.08 * plateauH;
      float fromFlash = length(vLocal.xy - flash);
      vec3 flashColour = shade(vec3(0.9, 0.88, 0.8), normal, 0.3, 0.6);
      flashColour *= 1.0 - 0.25 * smoothstep(flashR * 0.55, flashR, fromFlash);
      c = mix(c, flashColour, inside(fromFlash - flashR));
      c = mix(c, vec3(0.02), 0.9 * inside(length(vLocal.xy - mic) - 0.018 * plateauH));
      c = mix(c, shade(vec3(0.02, 0.02, 0.025), normal, 0.08, 1.2), inside(length(vLocal.xy - lidar) - 0.085 * plateauH));
    }

    alpha = spread;
  } else if (material < 2.5) {
    // A lens: a polished ring around dark coated glass with the lens element inside it.
    vec3 ringMetal = mix(vec3(0.065, 0.065, 0.07), vec3(0.9, 0.9, 0.91), silver);
    c = shade(ringMetal, normal, 0.18, gloss);

    if (vSegment > 3.5) {
      float r = length(vLocal.xy);
      float glassR = extent.x * 0.76;
      vec3 coat = vec3(0.012, 0.014, 0.022) + vec3(0.05, 0.06, 0.12) * 0.6 * (1.0 - smoothstep(0.0, glassR, r));
      vec3 glass = shade(coat, normal, 0.04, 1.4);
      glass *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 1.5, abs(r - glassR * 0.62)));
      vec2 catchlight = vLocal.xy + vec2(0.35, 0.4) * glassR;
      glass += vec3(0.32) * exp(-dot(catchlight, catchlight) / pow(glassR * 0.16, 2.0));
      c = mix(c, glass, inside(r - glassR));
    }

    alpha = spread;
  } else if (material < 3.5) {
    // A key, a touch more polished than the band.
    c = shade(metal, normal, 0.25, gloss);
  } else {
    // The Camera Control: sapphire in a thin ring of the band's metal.
    float edge = box(vLocal.xy, vec2(0.0), extent * 0.86, min(extent.x, extent.y) * 0.86);
    c = mix(shade(metal, normal, 0.25, gloss), shade(vec3(0.02, 0.02, 0.025), normal, 0.06, 1.3), inside(edge));
  }

  alpha *= fade;

  // Sub-pixel dithering keeps the long, quiet gradients free of bands. It never animates.
  float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  c = clamp(soft(c) + noise / 255.0, 0.0, 1.0);
  colour = vec4(c * alpha, alpha);
}`;

type Part = { count: number; first: number };

/** One rounded solid, shaped by uniforms: its back face, its sides and its front face. */
function template() {
  const values: number[] = [];
  const contour: Array<{ corner: [number, number]; plan: [number, number] }> = [];

  // The outline runs once around: each corner's quarter turn, joined by the straight sides.
  const corners: Array<[number, number, number]> = [
    [1, 1, 0],
    [-1, 1, Math.PI / 2],
    [-1, -1, Math.PI],
    [1, -1, Math.PI * 1.5],
  ];

  for (const [sx, sy, start] of corners) {
    for (let step = 0; step <= ARC_STEPS; step += 1) {
      const angle = start + (step / ARC_STEPS) * (Math.PI / 2);

      contour.push({ corner: [sx, sy], plan: [Math.cos(angle), Math.sin(angle)] });
    }
  }

  const vertex = (index: number, segment: number, t: number) => {
    const { corner, plan } = contour[index % contour.length];

    values.push(plan[0], plan[1], corner[0], corner[1], segment, t);
  };

  const centre = (segment: number) => values.push(0, 0, 0, 0, segment, 0);

  const cap = (segment: number) => {
    const first = values.length / 6;

    for (let index = 0; index < contour.length; index += 1) {
      centre(segment);
      vertex(index, segment, 1);
      vertex(index + 1, segment, 1);
    }

    return { count: values.length / 6 - first, first };
  };

  const back = cap(4);

  // Rings down the side: around the front edge, then around the back edge; the flat of the side
  // joins the last of one to the first of the other.
  const rings: Array<[number, number]> = [];

  for (let step = 0; step <= FRONT_STEPS; step += 1) rings.push([0, step / FRONT_STEPS]);

  for (let step = 0; step <= BACK_STEPS; step += 1) rings.push([2, step / BACK_STEPS]);

  const sideFirst = values.length / 6;

  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    const [s0, t0] = rings[ring];
    const [s1, t1] = rings[ring + 1];

    for (let index = 0; index < contour.length; index += 1) {
      vertex(index, s0, t0);
      vertex(index, s1, t1);
      vertex(index + 1, s0, t0);
      vertex(index + 1, s0, t0);
      vertex(index, s1, t1);
      vertex(index + 1, s1, t1);
    }
  }

  const sides = { count: values.length / 6 - sideFirst, first: sideFirst };
  const front = cap(3);

  // The back, sides and front are consecutive triangles with the same uniforms. Keep their
  // vertex order while submitting each solid as one span instead of separate surfaces.
  return {
    full: { count: back.count + sides.count + front.count, first: back.first },
    shell: { count: back.count + sides.count, first: back.first },
    values: new Float32Array(values),
  };
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);

  if (!shader) throw new Error('The phone model could not create a shader.');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);

    gl.deleteShader(shader);
    throw new Error(`The phone model shader did not compile: ${message}`);
  }

  return shader;
}

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

// Seen from in front the phone's left side is the slab's right: a part on either side turns its
// own z, the way it stands out, toward that side, and runs its own x through the band.
const LEFT_SIDE = [0, 0, 1, 0, 1, 0, 1, 0, 0];

const RIGHT_SIDE = [0, 0, -1, 0, 1, 0, -1, 0, 0];

// Along the sides, as shares of the body's height: the Action button and volume keys on the left,
// the side button and the Camera Control on the right.
const KEYS = [
  { from: 0.205, side: LEFT_SIDE, to: 0.258 },
  { from: 0.298, side: LEFT_SIDE, to: 0.375 },
  { from: 0.398, side: LEFT_SIDE, to: 0.475 },
  { from: 0.3, side: RIGHT_SIDE, to: 0.445 },
];

const CAMERA_CONTROL = { from: 0.585, to: 0.69 };

type Solid = {
  basis?: number[];
  centre: [number, number, number];
  depth: number;
  extent: [number, number];
  frontRound: number;
  backRound: number;
  material: number;
  part: Part;
  radius: number;
};

type PhoneModelState = {
  body: PhoneBody;
  /** How far the desk has become the phone's back, 0 to 1. */
  back: number;
  /** The desk's glass edge colour in this appearance, as 0 to 1 channels. */
  edge: [number, number, number];
  /** How far the keys and Camera Control have come in, 0 to 1. */
  keys: number;
  /** The stage's size and CSS perspective, in pixels. */
  stage: { height: number; perspective: number; width: number };
};

function createRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true });

  if (!gl) throw new Error('The phone model needs WebGL2.');

  const program = gl.createProgram();
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`The phone model program did not link: ${gl.getProgramInfoLog(program)}`);
  }

  gl.useProgram(program);

  const mesh = template();
  const buffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.values, gl.STATIC_DRAW);

  const attribute = (name: string, size: number, offset: number) => {
    const location = gl.getAttribLocation(program, name);

    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 24, offset);
  };

  attribute('plan', 2, 0);
  attribute('corner', 2, 8);
  attribute('profile', 2, 16);

  const names = [
    'backRound',
    'basis',
    'bodyDepth',
    'centre',
    'depth',
    'edgeColour',
    'extent',
    'eye',
    'fade',
    'frontRound',
    'glassEdge',
    'lift',
    'material',
    'perspective',
    'phone',
    'place',
    'pose',
    'radius',
    'silver',
    'stage',
    'sweep',
    'unit',
  ] as const;

  // SAFETY: the entries come from names one for one, so the record has exactly those keys.
  const uniforms = Object.fromEntries(
    names.map((name) => [name, gl.getUniformLocation(program, name)]),
  ) as Record<(typeof names)[number], WebGLUniformLocation | null>;

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const solid = (piece: Solid, fade: number) => {
    gl.uniform2f(uniforms.extent, piece.extent[0], piece.extent[1]);
    gl.uniform1f(uniforms.radius, piece.radius);
    gl.uniform1f(uniforms.depth, piece.depth);
    gl.uniform1f(uniforms.frontRound, piece.frontRound);
    gl.uniform1f(uniforms.backRound, piece.backRound);
    gl.uniform3f(uniforms.centre, ...piece.centre);
    gl.uniformMatrix3fv(uniforms.basis, false, piece.basis ?? IDENTITY);
    gl.uniform1f(uniforms.material, piece.material);
    gl.uniform1f(uniforms.fade, fade);

    gl.drawArrays(gl.TRIANGLES, piece.part.first, piece.part.count);
  };

  return {
    draw({ back, body, edge, keys, stage }: PhoneModelState) {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(stage.width * ratio);
      const height = Math.round(stage.height * ratio);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clearDepth(1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const radians = Math.PI / 180;
      const { depth, height: tall, radius, width: wide } = body;
      const unit = Math.min(wide, tall * PHONE_ASPECT);

      // The slab's centre in the stage, from the eye the body carries.
      const place: [number, number, number] = [
        stage.width / 2 - body.eye[0],
        stage.height / 2 - body.eye[1],
        stage.perspective - body.eye[2],
      ];

      gl.uniform3f(uniforms.place, ...place);
      gl.uniform3f(uniforms.eye, stage.width / 2, stage.height / 2, stage.perspective);
      gl.uniform2f(uniforms.stage, stage.width, stage.height);
      gl.uniform1f(uniforms.perspective, stage.perspective);
      gl.uniform3f(
        uniforms.pose,
        body.pose.x * radians,
        body.pose.y * radians,
        body.pose.z * radians,
      );
      gl.uniform1f(uniforms.lift, body.scale);
      gl.uniform1f(uniforms.silver, body.titanium === 'light' ? 1 : 0);
      gl.uniform1f(uniforms.glassEdge, body.glass);
      gl.uniform3f(uniforms.edgeColour, ...edge);
      gl.uniform1f(uniforms.sweep, back);
      gl.uniform2f(uniforms.phone, wide, tall);
      gl.uniform1f(uniforms.unit, unit);
      gl.uniform1f(uniforms.bodyDepth, depth);

      // The back first: it writes depth even where the desk still shows through it, so nothing
      // behind the slab is drawn over the desk.
      const frontRound = depth * FRONT_ROUND;
      const backRound = depth * BACK_ROUND;

      solid(
        {
          backRound,
          centre: [0, 0, 0],
          depth,
          extent: [wide / 2, tall / 2],
          frontRound,
          material: 0,
          part: mesh.full,
          radius,
        },
        1,
      );

      if (back > 0) {
        // The plateau and lenses rise out of the back as it arrives.
        const rise = back;
        const margin = 0.07 * unit;
        const plateauH = 0.53 * unit;
        const plateauDepth = 0.024 * unit * rise;
        const plateauTop = depth / 2 + plateauDepth;
        const plateauCentreY = -tall / 2 + margin + plateauH / 2;

        solid(
          {
            backRound: plateauDepth * 0.45,
            centre: [0, plateauCentreY, depth / 2 + plateauDepth / 2 - 0.5],
            depth: plateauDepth + 1,
            extent: [wide / 2 - margin, plateauH / 2],
            frontRound: 0,
            material: 1,
            part: mesh.shell,
            radius: 0.14 * unit,
          },
          1,
        );

        const lensDepth = 0.02 * unit * rise;
        const ring = 0.205 * plateauH;
        const left = -wide / 2 + margin;
        const top = -tall / 2 + margin;

        for (const [x, y] of [
          [0.25, 0.31],
          [0.25, 0.78],
          [0.69, 0.545],
        ]) {
          solid(
            {
              backRound: lensDepth * 0.5,
              centre: [left + x * plateauH, top + y * plateauH, plateauTop + lensDepth / 2 - 0.5],
              depth: lensDepth + 1,
              extent: [ring, ring],
              frontRound: 0,
              material: 2,
              part: mesh.shell,
              radius: ring,
            },
            1,
          );
        }
      }

      if (keys > 0) {
        // The keys stand out of the flat of the band; the Camera Control sits nearly flush.
        const flatMiddle = (frontRound - backRound) / 2;
        const across = depth * 0.18;

        const key = (from: number, to: number, side: number[], stand: number, material: number) => {
          const outward = side === LEFT_SIDE ? 1 : -1;

          solid(
            {
              backRound: stand * 0.5,
              basis: side,
              centre: [
                outward * (wide / 2 + stand / 2 - 0.5),
                ((from + to) / 2 - 0.5) * tall,
                flatMiddle,
              ],
              depth: stand + 1,
              extent: [across, ((to - from) * tall) / 2],
              frontRound: 0,
              material,
              part: mesh.shell,
              radius: across,
            },
            keys,
          );
        };

        for (const { from, side, to } of KEYS) key(from, to, side, 0.011 * unit * keys, 3);

        key(CAMERA_CONTROL.from, CAMERA_CONTROL.to, RIGHT_SIDE, 0.004 * unit * keys, 4);
      }
    },
    destroy() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}

type PhoneModelProps = PhoneModelState & { visible: boolean };

/** The phone's solid body over the stage, redrawn when its geometry or material changes. */
export function PhoneModel({ back, body, edge, keys, stage, visible }: PhoneModelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<typeof createRenderer> | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const renderer = createRenderer(canvas);

    rendererRef.current = renderer;

    return () => {
      rendererRef.current = null;
      renderer.destroy();
    };
  }, []);

  useLayoutEffect(() => {
    if (visible) rendererRef.current?.draw({ back, body, edge, keys, stage });
  }, [back, body, edge, keys, stage, visible]);

  return (
    <canvas
      aria-hidden
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'block',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        visibility: visible ? undefined : 'hidden',
      }}
    />
  );
}
