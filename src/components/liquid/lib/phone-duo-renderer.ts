// Model millimetres: unfolded body 164.6 × 117.8 × 5.2, closed depth 11.3.
// The 0.45 hinge pivot leaves 0.9 between the two OLED faces. Small parts,
// corner radii and edge profiles are estimated from the references, not CAD.
type Vec3 = [number, number, number];

type Matrix = Float32Array;

type Group = 'base' | 'wing' | 'flat';

type Part = { first: number; count: number; group: Group; material: number };

type Point = { x: number; y: number; nx: number; ny: number };

type Vertex = { p: Vec3; n: Vec3; uv: [number, number] };

type Pose = {
  fold: number;
  turn: number;
  pitch: number;
  roll: number;
  orbit: number;
  azimuth: number;
  balance: number;
  zoom: number;
  attached: boolean;
  white: boolean;
  glare: boolean;
};

const stageWidth = 220;

const stageHeight = 178;

const distance = 700;

const halfHeight = 58.9;

const bevelSteps = 12;

const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function multiply(a: Matrix, b: Matrix) {
  const result = new Float32Array(16);

  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) result[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
    }
  }

  return result;
}

function translation(x: number, y: number, z: number) {
  const result = identity();
  result[12] = x;
  result[13] = y;
  result[14] = z;

  return result;
}

function rotation(angle: number, axis: 'x' | 'y' | 'z') {
  const result = identity();
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  if (axis === 'y') {
    result[0] = c;
    result[2] = -s;
    result[8] = s;
    result[10] = c;
  } else if (axis === 'x') {
    result[5] = c;
    result[6] = s;
    result[9] = -s;
    result[10] = c;
  } else {
    result[0] = c;
    result[1] = s;
    result[4] = -s;
    result[5] = c;
  }

  return result;
}

function scaling(scale: number) {
  const result = identity();
  result[0] = result[5] = result[10] = scale;

  return result;
}

function transform(m: Matrix, [x, y, z]: Vec3, direction = false): Vec3 {
  return [
    m[0] * x + m[4] * y + m[8] * z + (direction ? 0 : m[12]),
    m[1] * x + m[5] * y + m[9] * z + (direction ? 0 : m[13]),
    m[2] * x + m[6] * y + m[10] * z + (direction ? 0 : m[14]),
  ];
}

function hinge(angle: number) {
  return multiply(
    translation(0, 0, 0.45),
    multiply(rotation(angle, 'y'), translation(0, 0, -0.45)),
  );
}

// Inverse projective mapping of a fixed screenshot plane. A fragment uses its
// viewport position, not the rotating leaf's UV: text and rows cannot bend at
// the hinge. This is the same sampling principle as the website intro.
function planeMapping(m: Matrix, x: number, y: number, width: number, height: number, z: number) {
  const origin = transform(m, [x, y, z]);
  const horizontal = transform(m, [width, 0, 0], true);
  const vertical = transform(m, [0, height, 0], true);
  const a = horizontal[0] / (stageWidth / 2);
  const b = vertical[0] / (stageWidth / 2);
  const c = origin[0] / (stageWidth / 2);
  const d = -horizontal[1] / (stageHeight / 2);
  const e = -vertical[1] / (stageHeight / 2);
  const f = -origin[1] / (stageHeight / 2);
  const g = -horizontal[2] / distance;
  const h = -vertical[2] / distance;
  const i = 1 - origin[2] / distance;
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  const divisor = Math.abs(determinant) < 1e-8 ? (determinant < 0 ? -1e-8 : 1e-8) : determinant;

  return new Float32Array([
    (e * i - f * h) / divisor,
    (f * g - d * i) / divisor,
    (d * h - e * g) / divisor,
    (c * h - b * i) / divisor,
    (a * i - c * g) / divisor,
    (b * g - a * h) / divisor,
    (b * f - c * e) / divisor,
    (c * d - a * f) / divisor,
    (a * e - b * d) / divisor,
  ]);
}

class Geometry {
  values: number[] = [];
  parts: Part[] = [];

  triangle(a: Vertex, b: Vertex, c: Vertex) {
    const u = b.p.map((value, index) => value - a.p[index]);
    const v = c.p.map((value, index) => value - a.p[index]);

    const facing =
      (u[1] * v[2] - u[2] * v[1]) * a.n[0] +
      (u[2] * v[0] - u[0] * v[2]) * a.n[1] +
      (u[0] * v[1] - u[1] * v[0]) * a.n[2];

    for (const vertex of facing >= 0 ? [a, b, c] : [a, c, b]) {
      this.values.push(...vertex.p, ...vertex.n, ...vertex.uv);
    }
  }

  part(group: Group, material: number, build: () => void) {
    const first = this.values.length / 8;
    build();
    this.parts.push({ first, count: this.values.length / 8 - first, group, material });
  }

  contour(x: number, y: number, width: number, height: number, radii: number[], inset = 0) {
    const points: Point[] = [];
    radii.forEach((radius, corner) => {
      const cx = x + (corner === 0 || corner === 3 ? radius : width - radius);
      const cy = y + (corner < 2 ? radius : height - radius);

      for (let step = 0; step <= 40; step++) {
        const angle = Math.PI + ((corner + step / 40) * Math.PI) / 2;
        const nx = Math.cos(angle);
        const ny = Math.sin(angle);
        points.push({
          x: cx + Math.max(0, radius - inset) * nx,
          y: cy + Math.max(0, radius - inset) * ny,
          nx,
          ny,
        });
      }
    });

    return points;
  }

  face(
    x: number,
    y: number,
    width: number,
    height: number,
    z: number,
    radii: number[],
    back = false,
    m = identity(),
  ) {
    const points = this.contour(x, y, width, height, radii);

    const vertex = (px: number, py: number): Vertex => ({
      p: transform(m, [px, py, z]),
      n: transform(m, [0, 0, back ? -1 : 1], true),
      uv: [(px - x) / width, (py - y) / height],
    });

    const center = vertex(x + width / 2, y + height / 2);
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length];
      this.triangle(center, vertex(point.x, point.y), vertex(next.x, next.y));
    });
  }

  solid(
    x: number,
    y: number,
    width: number,
    height: number,
    front: number,
    depth: number,
    radii: number[],
    bevel = 0.3,
    m = identity(),
  ) {
    const rings: { points: Point[]; z: number; normalZ: number; normalXY: number }[] = [];

    for (let side = 0; side < 2; side++) {
      for (let step = 0; step <= bevelSteps; step++) {
        const angle = ((side === 0 ? step / bevelSteps : 1 - step / bevelSteps) * Math.PI) / 2;

        rings.push({
          points: this.contour(x, y, width, height, radii, bevel * (1 - Math.sin(angle))),
          z:
            side === 0
              ? front - bevel * (1 - Math.cos(angle))
              : front - depth + bevel * (1 - Math.cos(angle)),
          normalZ: Math.cos(angle) * (side === 0 ? 1 : -1),
          normalXY: Math.sin(angle),
        });
      }
    }

    for (let ring = 0; ring < rings.length - 1; ring++) {
      const first = rings[ring];
      const second = rings[ring + 1];

      const vertex = (r: typeof first, index: number): Vertex => {
        const p = r.points[index];

        return {
          p: transform(m, [p.x, p.y, r.z]),
          n: transform(m, [p.nx * r.normalXY, p.ny * r.normalXY, r.normalZ], true),
          uv: [(p.x - x) / width, (p.y - y) / height],
        };
      };

      first.points.forEach((_, index) => {
        const next = (index + 1) % first.points.length;
        const a = vertex(first, index);
        const b = vertex(first, next);
        const c = vertex(second, index);
        const d = vertex(second, next);
        this.triangle(a, c, b);
        this.triangle(b, c, d);
      });
    }

    const cap = (ring: (typeof rings)[number], back: boolean) => {
      const center: Vertex = {
        p: transform(m, [x + width / 2, y + height / 2, ring.z]),
        n: transform(m, [0, 0, back ? -1 : 1], true),
        uv: [0.5, 0.5],
      };

      ring.points.forEach((p, index) => {
        const q = ring.points[(index + 1) % ring.points.length];

        const vertex = (point: Point): Vertex => ({
          p: transform(m, [point.x, point.y, ring.z]),
          n: center.n,
          uv: [(point.x - x) / width, (point.y - y) / height],
        });

        this.triangle(center, vertex(p), vertex(q));
      });
    };

    cap(rings[0], false);
    cap(rings[rings.length - 1], true);
  }

  // A polymer break wraps the same curved cross-section as its metal rail.
  railBand(x: number, width: number, depth: number, bevel: number, m: Matrix) {
    const profile: { y: number; z: number; ny: number; nz: number }[] = [];

    for (const side of [1, -1]) {
      for (let step = 0; step <= bevelSteps; step++) {
        const angle = ((side === 1 ? 1 - step / bevelSteps : step / bevelSteps) * Math.PI) / 2;

        profile.push({
          y: side * (depth / 2 - bevel + bevel * Math.sin(angle)),
          z: -bevel * (1 - Math.cos(angle)),
          ny: side * Math.sin(angle),
          nz: Math.cos(angle),
        });
      }
    }

    const vertex = (point: (typeof profile)[number], px: number): Vertex => ({
      p: transform(m, [px, point.y + point.ny * 0.015, point.z + point.nz * 0.015]),
      n: transform(m, [0, point.ny, point.nz], true),
      uv: [(px - x) / width, (point.y + depth / 2) / depth],
    });

    for (let step = 0; step < profile.length - 1; step++) {
      const a = vertex(profile[step], x);
      const b = vertex(profile[step], x + width);
      const c = vertex(profile[step + 1], x);
      const d = vertex(profile[step + 1], x + width);
      this.triangle(a, c, b);
      this.triangle(b, c, d);
    }
  }
}

function deviceGeometry() {
  const geometry = new Geometry();
  const frameBevel = 1.15;
  const baseCorners = [1.3, 11.6, 11.6, 1.3];
  const wingCorners = [11.6, 1.3, 1.3, 11.6];
  const back = rotation(Math.PI, 'y');
  const circle = (radius: number) => [radius, radius, radius, radius];

  for (const group of ['base', 'wing'] as const) {
    const x = group === 'base' ? 0 : -82.3;
    const corners = group === 'base' ? baseCorners : wingCorners;
    geometry.part(group, 0, () =>
      geometry.solid(x, -halfHeight, 82.3, 117.8, 0, 5.2, corners, frameBevel),
    );
    geometry.part(group, 2, () =>
      geometry.face(
        x + (group === 'base' ? 0 : frameBevel),
        -halfHeight + frameBevel,
        82.3 - frameBevel,
        117.8 - frameBevel * 2,
        0.015,
        corners.map((r) => Math.max(0, r - frameBevel)),
      ),
    );
    geometry.part(group, group === 'wing' ? 2 : 1, () =>
      geometry.face(
        x + frameBevel,
        -halfHeight + frameBevel,
        82.3 - frameBevel * 2,
        117.8 - frameBevel * 2,
        -5.215,
        corners.map((r) => Math.max(0.15, r - frameBevel)),
        true,
      ),
    );
  }

  geometry.part('wing', 3, () =>
    geometry.face(-78.75, -55.395, 78.75, 110.79, 0.06, [8.6, 0, 0, 8.6]),
  );
  geometry.part('base', 3, () => geometry.face(0, -55.395, 78.75, 110.79, 0.06, [0, 8.6, 8.6, 0]));
  // A single primitive spans the OLED when flat, eliminating even a raster seam.
  geometry.part('flat', 3, () => geometry.face(-78.75, -55.395, 157.5, 110.79, 0.06, circle(8.6)));
  geometry.part('wing', 5, () =>
    geometry.face(-80.3, -56.095, 77.1, 112.19, -5.24, [9, 0.9, 0.9, 9], true),
  );
  geometry.part('wing', 2, () => geometry.face(-74.4, -50.4, 6.2, 6.2, -5.26, circle(3.1), true));
  geometry.part('wing', 4, () =>
    geometry.face(-72.75, -48.75, 2.9, 2.9, -5.28, circle(1.45), true),
  );

  // Only the top and bottom bezel contain hinge knuckles; the OLED has no bar.
  geometry.part('base', 0, () => {
    for (const y of [-58.8, 57.1])
      geometry.solid(-1.4, y, 2.8, 1.7, -0.12, 5.65, circle(0.65), 0.2);
  });
  geometry.part('base', 2, () => {
    for (const y of [-58.4, 57.35]) geometry.face(-0.13, y, 0.26, 0.8, -0.1, circle(0.13));
  });

  // Rear camera plateau, polished rings, protective glass, and recessed optics.
  geometry.part('base', 0, () =>
    geometry.solid(-77.2, -54.1, 56.2, 24.1, 8.2, 3, circle(12.05), 1.05, back),
  );
  geometry.part('base', 1, () =>
    geometry.face(-76.15, -53.05, 54.1, 22, 8.215, circle(11), false, back),
  );

  for (const x of [-75.75, -57.95]) {
    geometry.part('base', 0, () =>
      geometry.solid(x, -50.25, 16.4, 16.4, 9.6, 1.4, circle(8.2), 0.28, back),
    );
    geometry.part('base', 8, () =>
      geometry.face(x + 0.4, -49.85, 15.6, 15.6, 9.615, circle(7.8), false, back),
    );
    geometry.part('base', 4, () =>
      geometry.face(x + 1.35, -48.9, 13.7, 13.7, 9.63, circle(6.85), false, back),
    );
  }

  geometry.part('base', 2, () =>
    geometry.face(-33.4, -46.7, 2.9, 1.45, 8.23, circle(0.725), false, back),
  );
  geometry.part('base', 0, () =>
    geometry.face(-34.05, -39.95, 4.25, 4.25, 8.23, circle(2.125), false, back),
  );
  geometry.part('base', 6, () =>
    geometry.face(-33.75, -39.65, 3.65, 3.65, 8.245, circle(1.825), false, back),
  );
  geometry.part('base', 7, () =>
    geometry.face(-48.9, -6, 15.5, 18.8, 5.24, circle(0), false, back),
  );

  // Side controls sit on the actual titanium wall, rather than floating above it.
  const right = multiply(translation(82.4, 0, -2.6), rotation(Math.PI / 2, 'y'));
  geometry.part('base', 0, () => {
    geometry.solid(-1.4, -23, 2.8, 17, 0.05, 0.35, circle(1.4), 0.12, right);
    geometry.solid(-1.4, 21, 2.8, 14, 0.05, 0.35, circle(1.4), 0.12, right);
  });
  geometry.part('base', 2, () =>
    geometry.face(-0.95, 22, 1.9, 12, 0.06, circle(0.8), false, right),
  );
  const top = multiply(translation(0, -59.05, -2.6), rotation(Math.PI / 2, 'x'));
  geometry.part('base', 0, () => {
    for (const x of [39, 52]) geometry.solid(x, -1.4, 10.5, 2.8, 0.1, 0.4, circle(1.4), 0.13, top);
  });
  const topRail = multiply(translation(0, -58.9, -2.6), rotation(Math.PI / 2, 'x'));
  geometry.part('base', 10, () => {
    for (const x of [17, 68]) geometry.railBand(x, 0.65, 5.2, frameBevel, topRail);
  });
  const bottom = multiply(translation(0, 58.95, -2.6), rotation(-Math.PI / 2, 'x'));
  geometry.part('base', 0, () =>
    geometry.solid(35.55, -1.35, 11, 2.7, 0.025, 0.08, circle(1.35), 0.035, bottom),
  );
  geometry.part('base', 2, () => {
    geometry.face(35.9, -1.05, 10.3, 2.1, 0.04, circle(1.05), false, bottom);

    for (const x of [15, 18, 21, 24, 60, 63, 66, 69])
      geometry.face(x, -0.55, 1.1, 1.1, 0.02, circle(0.55), false, bottom);
  });
  geometry.part('base', 0, () =>
    geometry.face(37, -0.22, 8.1, 0.44, 0.055, circle(0.22), false, bottom),
  );
  geometry.part('base', 6, () => {
    for (let x = 37.6; x <= 44.5; x += 0.55)
      geometry.face(x, -0.17, 0.22, 0.12, 0.06, circle(0.025), false, bottom);
  });
  const wingTop = multiply(translation(0, -58.95, -2.6), rotation(Math.PI / 2, 'x'));
  geometry.part('wing', 8, () => {
    for (let x = -49; x <= -34; x += 2.5)
      geometry.face(x - 0.13, -0.58, 1.41, 1.16, 0.02, circle(0.58), false, wingTop);
  });
  geometry.part('wing', 2, () => {
    for (let x = -49; x <= -34; x += 2.5)
      geometry.face(x, -0.45, 1.15, 0.9, 0.035, circle(0.45), false, wingTop);
  });
  geometry.part('wing', 10, () => {
    for (const x of [-68, -17]) geometry.railBand(x, 0.65, 5.2, frameBevel, topRail);
  });

  // Flush antenna breaks stay on the side wall, clear of the display.
  for (const [group, x] of [
    ['base', 82.3],
    ['wing', -82.3],
  ] as const) {
    const wall = multiply(
      translation(x, 0, -2.6),
      multiply(rotation(x > 0 ? Math.PI / 2 : -Math.PI / 2, 'y'), rotation(Math.PI / 2, 'z')),
    );

    geometry.part(group, 10, () => {
      for (const y of [-42, 42]) geometry.railBand(y, 0.42, 5.2, frameBevel, wall);
    });
  }

  // The inner camera sits beneath the OLED; draw its faint coating last so
  // transparency blends over the actual screen instead of the black bezel.
  geometry.part('base', 9, () => geometry.face(31.65, -50.2, 3.3, 3.3, 0.08, circle(1.65)));

  return geometry;
}

const vertexSource = `#version 300 es
precision highp float;
in vec3 aPosition;
in vec3 aNormal;
in vec2 aUv;
uniform mat4 uModel;
out vec3 vNormal;
out vec3 vPosition;
out vec3 vLocal;
out vec2 vUv;
void main() {
  vec3 p = (uModel * vec4(aPosition, 1.)).xyz;
  vPosition = p;
  vLocal = aPosition;
  vNormal = mat3(uModel) * aNormal;
  vUv = aUv;
  gl_Position = vec4(p.x / 110., -p.y / 89., -p.z / 350., (700. - p.z) / 700.);
}`;

const fragmentSource = `#version 300 es
precision highp float;
uniform int uMaterial;
uniform float uWhite;
uniform float uGlare;
uniform float uLift;
uniform float uBaseShade;
uniform float uAttached;
uniform float uLandscape;
uniform vec2 uInnerRegion;
uniform vec2 uViewport;
uniform mat3 uPlane;
uniform sampler2D uInner;
uniform sampler2D uCover;
uniform sampler2D uLogo;
in vec3 vNormal;
in vec3 vPosition;
in vec3 vLocal;
in vec2 vUv;
out vec4 color;
void main() {
  vec3 normal = normalize(vNormal);
  vec3 eye = normalize(vec3(0., 0., 700.) - vPosition);
  float diffuse = max(0., dot(normal, normalize(vec3(-.4, -.6, 1.))));
  float rim = pow(1. - abs(dot(normal, eye)), 2.);
  if (uMaterial == 3 || uMaterial == 5) {
    vec2 uv;
    vec2 gradientX;
    vec2 gradientY;
    bool coverTexture = uMaterial == 5;
    if (uAttached > .5) {
      uv = coverTexture ? vec2(1. - vUv.x, vUv.y) : vec2(vUv.x * uInnerRegion.x + uInnerRegion.y, vUv.y);
      // Rotated stand poses use the landscape capture on the cover and the
      // portrait capture across the two inner leaves, keeping their UI upright.
      if (uLandscape > .5) {
        uv = vec2(1. - uv.y, uv.x);
        coverTexture = !coverTexture;
      }
      gradientX = dFdx(uv);
      gradientY = dFdy(uv);
    } else {
      vec2 ndc = gl_FragCoord.xy / uViewport * 2. - 1.;
      vec3 mapped = uPlane * vec3(ndc, 1.);
      uv = mapped.xy / mapped.z;
      // Explicit gradients keep the flat screenshot's mip level continuous
      // across the narrow triangles that join the OLED around its pivot.
      vec3 nextX = uPlane * vec3(ndc + vec2(2. / uViewport.x, 0.), 1.);
      vec3 nextY = uPlane * vec3(ndc + vec2(0., 2. / uViewport.y), 1.);
      gradientX = nextX.xy / nextX.z - uv;
      gradientY = nextY.xy / nextY.z - uv;
    }
    // Both faces have their free edge at u=0 and their hinge at u=1.
    float across = 1. - vUv.x;
    // Comparable physical defocus on the two differently sized source images.
    float radius = uLift * pow(across, 1.35) * (coverTexture ? .092 : .046);
    vec3 sampleColor;
    if (radius > .0001) {
      sampleColor = vec3(0.);
      vec2 texel = 1. / vec2(coverTexture ? textureSize(uCover, 0) : textureSize(uInner, 0));
      float lod = max(0., log2(max(radius / max(texel.x, texel.y) / 3., 1.)));
      for (int j = 0; j < 28; j++) {
        float angle = float(j) * 2.39996323;
        float reach = sqrt((float(j) + .5) / 28.) * radius;
        vec2 offset = vec2(cos(angle), sin(angle) * texel.y / texel.x) * reach;
        sampleColor += coverTexture ? textureLod(uCover, uv + offset, lod).rgb : textureLod(uInner, uv + offset, lod).rgb;
      }
      sampleColor /= 28.;
    } else {
      sampleColor = coverTexture ? textureGrad(uCover, uv, gradientX, gradientY).rgb : textureGrad(uInner, uv, gradientX, gradientY).rgb;
    }
    // The intro's frosting, dimming and travelling sheen; the source stays flat.
    float dim = uLift * pow(clamp((across - .3) / .7, 0., 1.), 1.35);
    sampleColor *= (1. - .85 * dim) * (1. - uBaseShade);
    float sheen = exp(-pow(abs((across - 1. + uLift) / .22), 2.)) * uLift * (1. - uLift) * .4;
    sheen *= smoothstep(0., .08, across);
    float edge = uMaterial == 5 ? pow(abs(normal.x), 1.8) * .035 : 0.;
    sampleColor += (sheen + edge) * uGlare;
    color = vec4(sampleColor, 1.);
    return;
  }
  if (uMaterial == 7) {
    float ink = texture(uLogo, vUv).a;
    if (ink < .01) discard;
    color = vec4(mix(vec3(.27, .31, .37), vec3(.82, .83, .83), uWhite) * (.92 + diffuse * .08) * ink, ink);
    return;
  }
  if (uMaterial == 9) {
    float alpha = .035 + rim * .05;
    color = vec4(vec3(.88) * alpha, alpha);
    return;
  }
  vec3 metal = mix(vec3(.48, .59, .74), vec3(.94, .94, .91), uWhite);
  vec3 surface;
  if (uMaterial == 0) {
    // Polished rails reflect a fixed studio: broad white softboxes with dark
    // gaps. The reflection moves with the curved surface, not a painted stripe.
    vec3 reflected = reflect(-eye, normal);
    float facing = smoothstep(-.3, .1, reflected.z);
    float ceiling = exp(-pow(abs((reflected.y + .42) / .3), 4.)) * facing;
    float strip = exp(-pow(abs((reflected.x + .48) / .22), 4.)) * facing;
    float fill = exp(-pow(abs((reflected.x - .55) / .32), 4.)) * .55;
    float front = (1. - smoothstep(.04, .15, abs(reflected.y + .025))) * facing;
    float studio = max(max(ceiling, strip), max(fill, front));
    float polished = pow(max(0., dot(reflect(-normalize(vec3(-.35, -.7, 1.)), normal), eye)), 96.);
    surface = metal * (.028 + studio * .97) + vec3(.3) * polished + rim * .015;
  } else if (uMaterial == 1) {
    surface = mix(vec3(.15, .20, .27), vec3(.98, .98, .966), uWhite) * (.92 + diffuse * .08);
    surface += pow(max(0., dot(reflect(-normalize(vec3(-.4, -.6, 1.)), normal), eye)), 10.) * .025;
    surface *= 1. - (vLocal.y + 59.) / 118. * .06;
    if (vLocal.z > -5.3) {
      vec2 delta = vec2(max(abs(vLocal.x - 49.1) - 16.05, 0.), vLocal.y + 42.05);
      float shadow = exp(-max(length(delta) - 12.05, 0.) / 1.8) * .13;
      surface *= 1. - shadow;
    }
  } else if (uMaterial == 4) {
    vec2 p = (vUv - .5) * 2.;
    float r = length(p);
    float iris = exp(-pow(abs((r - .3) / .055), 2.));
    float pupil = 1. - smoothstep(.13, .21, r);
    float highlight = exp(-dot(p - vec2(-.32, -.4), p - vec2(-.32, -.4)) * 95.);
    float coating = exp(-pow(abs((r - .46) / .075), 2.));
    float arc = .5 + .5 * sin(atan(p.y, p.x) * 2. + 1.1);
    surface = vec3(.015, .022, .031) + vec3(.035, .055, .095) * iris;
    surface *= 1. - pupil * .75;
    surface += mix(vec3(.06, .02, .11), vec3(.02, .075, .11), arc) * coating;
    surface += vec3(.29, .34, .41) * highlight;
    surface += vec3(.014, .02, .028) * exp(-pow(abs((r - .8) / .025), 2.));
    surface += rim * .025;
  } else if (uMaterial == 6) {
    vec2 cell = fract(vUv * 2.) - .5;
    float emitter = exp(-dot(cell, cell) * 9.);
    surface = mix(vec3(.65, .65, .6), vec3(.96, .94, .84), emitter);
  } else if (uMaterial == 8) {
    float r = length((vUv - .5) * 2.);
    float groove = .5 + .5 * cos(r * 130.);
    surface = vec3(.045, .049, .052) + diffuse * .035 + groove * .008;
    surface += vec3(.18) * exp(-pow(abs((r - .965) / .018), 2.));
  } else if (uMaterial == 10) {
    surface = mix(vec3(.33, .36, .4), vec3(.76, .76, .73), uWhite) * (.7 + diffuse * .3);
  } else {
    surface = vec3(.014, .017, .021) + diffuse * .008 + rim * .012;
  }
  color = vec4(surface, 1.);
}`;

export function createPhoneDuoRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
  });

  if (!gl) throw new Error('WebGL 2 unavailable');

  function shader(type: number, source: string) {
    const result = gl!.createShader(type)!;
    gl!.shaderSource(result, source);
    gl!.compileShader(result);

    if (!gl!.getShaderParameter(result, gl!.COMPILE_STATUS)) {
      const message = gl!.getShaderInfoLog(result);
      gl!.deleteShader(result);
      throw new Error(message ?? 'Phone shader failed');
    }

    return result;
  }

  const vertex = shader(gl.VERTEX_SHADER, vertexSource);
  const fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram()!;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error('Phone shader linking failed');

  const names = [
    'uModel',
    'uMaterial',
    'uWhite',
    'uGlare',
    'uLift',
    'uBaseShade',
    'uAttached',
    'uLandscape',
    'uInnerRegion',
    'uViewport',
    'uPlane',
    'uInner',
    'uCover',
    'uLogo',
  ] as const;

  // SAFETY: Every key comes from the literal uniform names declared in these shaders.
  const uniforms = Object.fromEntries(
    names.map((name) => [name, gl.getUniformLocation(program, name)]),
  ) as Record<(typeof names)[number], WebGLUniformLocation>;

  const geometry = deviceGeometry();
  const buffer = gl.createBuffer()!;
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.values), gl.STATIC_DRAW);

  for (const [name, size, offset] of [
    ['aPosition', 3, 0],
    ['aNormal', 3, 12],
    ['aUv', 2, 24],
  ] as const) {
    const attribute = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 32, offset);
  }

  // A continuous OLED joins the leaves around the pivot. Its samples still
  // come from the flat plane; there is no seam texture or screen hinge overlay.
  const joinBuffer = gl.createBuffer()!;
  const joinVao = gl.createVertexArray()!;
  const join = new Float32Array(12 * 6 * 8);
  gl.bindVertexArray(joinVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, joinBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, join.byteLength, gl.DYNAMIC_DRAW);

  for (const [name, size, offset] of [
    ['aPosition', 3, 0],
    ['aNormal', 3, 12],
    ['aUv', 2, 24],
  ] as const) {
    const attribute = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 32, offset);
  }

  const textures = Array.from({ length: 3 }, () => gl.createTexture()!);
  textures.forEach((texture, index) => {
    gl.activeTexture(gl.TEXTURE0 + index);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255]),
    );
    gl.generateMipmap(gl.TEXTURE_2D);
  });
  const logo = document.createElement('canvas');
  logo.width = 256;
  logo.height = 312;
  const ink = logo.getContext('2d')!;
  ink.scale(256 / 14, 312 / 17);
  ink.translate(0, -12);
  ink.fillStyle = '#fff';
  ink.fill(
    new Path2D(
      'm13.0729 17.6825a3.61 3.61 0 0 0-1.7248 3.0365 3.5132 3.5132 0 0 0 2.1379 3.2223 8.394 8.394 0 0 1-1.0948 2.2618c-.6816.9812-1.3943 1.9623-2.4787 1.9623s-1.3633-.63-2.613-.63c-1.2187 0-1.6525.6507-2.644.6507s-1.6834-.9089-2.4787-2.0243a9.7842 9.7842 0 0 1-1.6628-5.2776c0-3.0984 2.014-4.7405 3.9969-4.7405 1.0535 0 1.9314.6919 2.5924.6919.63 0 1.6112-.7333 2.8092-.7333a3.7579 3.7579 0 0 1 3.1604 1.5802zm-3.7284-2.8918a3.5615 3.5615 0 0 0 .8469-2.22 1.5353 1.5353 0 0 0-.031-.32 3.5686 3.5686 0 0 0-2.3445 1.2084 3.4629 3.4629 0 0 0-.8779 2.1585 1.419 1.419 0 0 0 .031.2892 1.19 1.19 0 0 0 .2169.0207 3.0935 3.0935 0 0 0 2.1586-1.1368z',
    ),
  );
  gl.bindTexture(gl.TEXTURE_2D, textures[2]);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, logo);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.CULL_FACE);
  // Projection has a downward Y axis to share the screenshot's coordinates.
  gl.frontFace(gl.CW);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  return {
    setImage(index: number, image: HTMLImageElement) {
      gl.activeTexture(gl.TEXTURE0 + index);
      gl.bindTexture(gl.TEXTURE_2D, textures[index]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.generateMipmap(gl.TEXTURE_2D);
    },
    draw({ fold, turn, pitch, roll, orbit, azimuth, balance, zoom, attached, white, glare }: Pose) {
      // Resolve the thin frame at twice the display density before compositing.
      const ratio = Math.min(4, Math.max(2, window.devicePixelRatio * 2));
      const width = Math.min(4096, Math.round(canvas.clientWidth * ratio));
      const height = Math.min(4096, Math.round(canvas.clientHeight * ratio));

      if (!width || !height) return;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const closing = Math.max(0, Math.min(1, 1 - fold)) ** 1.25;
      const angle = closing * Math.PI;

      const orientation = multiply(
        rotation((azimuth * Math.PI) / 180, 'y'),
        multiply(
          rotation((pitch * Math.PI) / 180, 'x'),
          multiply(
            rotation((roll * Math.PI) / 180, 'z'),
            rotation(((turn + orbit) * Math.PI) / 180 - (balance * angle) / 2, 'y'),
          ),
        ),
      );

      // Centre the actual folded body, including its depth. A linear offset
      // cannot centre both the upright phone and its horizontal stand poses.
      const bounds: Vec3[] = [];

      for (const group of ['base', 'wing']) {
        const model = group === 'base' ? orientation : multiply(orientation, hinge(angle));

        for (const x of group === 'base' ? [0, 82.3] : [-82.3, 0])
          for (const y of [-halfHeight, halfHeight])
            for (const z of [0, -5.2]) bounds.push(transform(model, [x, y, z]));
      }

      const centre = (axis: number) =>
        (Math.min(...bounds.map((p) => p[axis])) + Math.max(...bounds.map((p) => p[axis]))) / 2;

      const root = multiply(
        translation(-centre(0) * zoom, -centre(1) * zoom, 0),
        multiply(scaling(zoom), orientation),
      );

      const wing = multiply(root, hinge(angle));
      const innerPlane = planeMapping(root, -78.75, -55.395, 157.5, 110.79, 0.06);

      const coverReference = multiply(
        root,
        hinge(Math.cos(((turn + orbit) * Math.PI) / 180) >= 0 ? Math.PI : 0),
      );

      // The cover faces backwards while unfolded and forwards when closed.
      const coverPlane = planeMapping(coverReference, -3.2, -56.095, -77.1, 112.19, -5.24);
      const flat = closing < 0.000001;
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      textures.forEach((texture, index) => {
        gl.activeTexture(gl.TEXTURE0 + index);
        gl.bindTexture(gl.TEXTURE_2D, texture);
      });
      gl.uniform1i(uniforms.uInner, 0);
      gl.uniform1i(uniforms.uCover, 1);
      gl.uniform1i(uniforms.uLogo, 2);
      gl.uniform1f(uniforms.uWhite, Number(white));
      gl.uniform1f(uniforms.uGlare, Number(glare));
      gl.uniform1f(uniforms.uAttached, Number(attached));
      gl.uniform1f(uniforms.uBaseShade, attached ? 0 : Math.sin(angle) * 0.3);
      gl.uniform1f(uniforms.uLandscape, Number(Math.abs(roll) > 45));
      gl.uniform2f(uniforms.uViewport, width, height);

      for (const part of geometry.parts) {
        if (part.group === 'flat' ? !flat : flat && part.material === 3) continue;
        gl.uniformMatrix4fv(uniforms.uModel, false, part.group === 'wing' ? wing : root);
        gl.uniform1i(uniforms.uMaterial, part.material);
        gl.uniform1f(uniforms.uLift, part.group === 'wing' && !attached ? Math.sin(angle) : 0);
        gl.uniform2f(
          uniforms.uInnerRegion,
          part.group === 'flat' ? 1 : 0.5,
          part.group === 'base' ? 0.5 : 0,
        );
        gl.uniformMatrix3fv(uniforms.uPlane, false, part.material === 5 ? coverPlane : innerPlane);
        gl.drawArrays(gl.TRIANGLES, part.first, part.count);
      }

      if (!flat && closing < 1) {
        let offset = 0;

        const vertex = (a: number, y: number) => {
          join.set(
            [
              -0.39 * Math.sin(a),
              y,
              0.45 - 0.39 * Math.cos(a),
              Math.sin(a),
              0,
              Math.cos(a),
              0.5,
              (y + 55.395) / 110.79,
            ],
            offset,
          );
          offset += 8;
        };

        for (let step = 0; step < 12; step++) {
          // Overlap the adjacent glass by a fraction of a pixel, so separate
          // transforms cannot leave an antialiasing crack at their shared edge.
          const reach = Math.min(Math.PI, angle + 0.2) + 0.2;
          const a = -0.2 + (reach * step) / 12;
          const b = -0.2 + (reach * (step + 1)) / 12;
          vertex(a, -55.395);
          vertex(a, 55.395);
          vertex(b, -55.395);
          vertex(a, 55.395);
          vertex(b, 55.395);
          vertex(b, -55.395);
        }

        gl.bindVertexArray(joinVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, joinBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, join);
        gl.uniformMatrix4fv(uniforms.uModel, false, root);
        gl.uniform1i(uniforms.uMaterial, 3);
        gl.uniform1f(uniforms.uLift, 0);
        gl.uniform2f(uniforms.uInnerRegion, 1, 0);
        gl.uniformMatrix3fv(uniforms.uPlane, false, innerPlane);
        gl.drawArrays(gl.TRIANGLES, 0, 12 * 6);
      }
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(joinBuffer);
      gl.deleteVertexArray(joinVao);
      textures.forEach((texture) => gl.deleteTexture(texture));
      gl.deleteProgram(program);
    },
  };
}
