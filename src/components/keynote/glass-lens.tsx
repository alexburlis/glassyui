import { useLayoutEffect, useRef } from 'react';

// A capsule of thick glass drawn by a fragment shader over a picture of what lies under it. The
// rim bends that picture outward and splits its colours, the body frosts it a little, and a light
// up and to the left catches the edge. One draw per frame, in step with the composition.
const VERTEX = `#version 300 es
in vec2 corner;
out vec2 local;
uniform vec2 canvasSize;
void main() {
  local = corner * canvasSize;
  gl_Position = vec4(corner.x * 2.0 - 1.0, 1.0 - corner.y * 2.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 local;
out vec4 colour;
uniform sampler2D scene;
uniform vec2 sceneOrigin;
uniform vec2 sceneSize;
uniform vec2 canvasOrigin;
uniform vec2 centre;
uniform vec2 halfSize;
uniform float radius;
uniform float bevel;
uniform float bend;
uniform float zoom;
uniform float split;
uniform float frost;

float box(vec2 p) {
  vec2 q = abs(p) - halfSize + radius;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}

vec3 pick(vec2 point) {
  return texture(scene, clamp((point - sceneOrigin) / sceneSize, 0.0, 1.0)).rgb;
}

// Twelve taps on two rings: a soft frost with no visible pattern.
const vec2 TAPS[12] = vec2[12](
  vec2(1.0, 0.0), vec2(0.5, 0.866), vec2(-0.5, 0.866), vec2(-1.0, 0.0),
  vec2(-0.5, -0.866), vec2(0.5, -0.866),
  vec2(0.0, 0.5), vec2(0.433, -0.25), vec2(-0.433, -0.25),
  vec2(0.0, -0.5), vec2(0.433, 0.25), vec2(-0.433, 0.25)
);

void main() {
  vec2 world = canvasOrigin + local;
  vec2 p = world - centre;
  float d = box(p);
  vec2 e = vec2(0.5, 0.0);
  vec2 normal = normalize(vec2(box(p + e.xy) - box(p - e.xy), box(p + e.yx) - box(p - e.yx)) + 1e-6);

  // A soft contact shadow under the slab, just below it, outside it.
  float shadowDistance = box(p - vec2(0.0, halfSize.y * 0.1));
  float shadow = 0.26 * exp(-pow(max(shadowDistance, 0.0) / (halfSize.y * 0.3), 2.0));
  float inside = 1.0 - smoothstep(-0.7, 0.7, d);

  if (inside <= 0.0) {
    colour = vec4(0.0, 0.0, 0.0, shadow);
    return;
  }

  // How far in from the rim, 0 at the edge and 1 past the bevel.
  float depth = clamp(-d / bevel, 0.0, 1.0);
  float rim = pow(1.0 - depth, 2.4);
  vec2 offset = normal * bend * rim;
  vec2 magnified = centre + p / zoom;
  float blur = frost * (0.55 + 1.6 * rim);

  vec3 sum = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    vec2 tap = TAPS[i] * blur;
    sum.r += pick(magnified + offset * (1.0 - split) + tap).r;
    sum.g += pick(magnified + offset + tap).g;
    sum.b += pick(magnified + offset * (1.0 + split) + tap).b;
  }
  vec3 glass = sum / 12.0;

  // The body lifts what it shows a touch; the rim darkens just inside its edge.
  glass = mix(glass, vec3(1.0), 0.035);
  glass *= 1.0 - 0.18 * pow(1.0 - depth, 6.0) * (0.6 + 0.4 * normal.y);

  vec2 light = normalize(vec2(-0.55, -0.83));
  float facing = max(dot(normal, light), 0.0);
  float away = max(dot(normal, -light), 0.0);
  float edge = exp(-(-d) / 1.1);
  float sheen = pow(1.0 - depth, 5.0);
  glass += edge * (0.32 + 0.75 * pow(facing, 2.0) + 0.3 * pow(away, 3.0));
  glass += sheen * (0.10 * pow(facing, 1.5) + 0.04);

  vec4 slab = vec4(glass, 1.0) * inside;
  colour = slab + vec4(0.0, 0.0, 0.0, shadow) * (1.0 - inside);
}`;

export type LensScene = {
  /** The picture under the glass, at device resolution. */
  canvas: HTMLCanvasElement;
  /** Where the picture sits on the stage, in CSS pixels. */
  height: number;
  width: number;
  x: number;
  y: number;
};

type GlassLensProps = {
  centre: { x: number; y: number };
  height: number;
  scene: LensScene | null;
  visible: boolean;
  width: number;
};

type Uniforms = {
  floats: Record<string, number>;
  pairs: Record<string, readonly [number, number]>;
};

type Renderer = {
  draw: (uniforms: Uniforms) => void;
  upload: (scene: LensScene) => void;
  resize: (width: number, height: number, ratio: number) => void;
  destroy: () => void;
};

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);

  if (!shader) throw new Error('The keynote lens could not create a shader.');

  try {
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`The keynote lens shader did not compile: ${gl.getShaderInfoLog(shader)}`);
    }

    return shader;
  } catch (error) {
    gl.deleteShader(shader);
    throw error;
  }
}

function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true });

  if (!gl) throw new Error('The keynote lens needs WebGL2.');

  const program = gl.createProgram();

  if (!program) throw new Error('The keynote lens could not create a program.');

  const shaders: WebGLShader[] = [];
  let buffer: WebGLBuffer | null = null;
  let texture: WebGLTexture | null = null;

  const releaseShaders = () => {
    const attached = gl.getAttachedShaders(program);

    for (const shader of shaders) {
      if (attached?.includes(shader)) gl.detachShader(program, shader);

      gl.deleteShader(shader);
    }

    shaders.length = 0;
  };

  const release = () => {
    releaseShaders();
    gl.useProgram(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    if (texture) gl.deleteTexture(texture);

    if (buffer) gl.deleteBuffer(buffer);

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
      throw new Error(`The keynote lens program did not link: ${gl.getProgramInfoLog(program)}`);
    }

    releaseShaders();
    gl.useProgram(program);
    buffer = gl.createBuffer();

    if (!buffer) throw new Error('The keynote lens could not create a buffer.');

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);

    const corner = gl.getAttribLocation(program, 'corner');

    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
    texture = gl.createTexture();

    if (!texture) throw new Error('The keynote lens could not create a texture.');

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const locations = new Map<string, WebGLUniformLocation | null>();

    const location = (name: string) => {
      if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name));

      return locations.get(name) ?? null;
    };

    let ratio = 1;

    return {
      upload(scene) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene.canvas);
        gl.uniform2f(location('sceneOrigin'), scene.x, scene.y);
        gl.uniform2f(location('sceneSize'), scene.width, scene.height);
      },
      resize(width, height, nextRatio) {
        ratio = nextRatio;
        canvas.width = Math.max(1, Math.round(width * ratio));
        canvas.height = Math.max(1, Math.round(height * ratio));
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(location('canvasSize'), width, height);
      },
      draw({ floats, pairs }) {
        if (gl.isContextLost()) return;

        for (const [name, value] of Object.entries(floats)) gl.uniform1f(location(name), value);

        for (const [name, [x, y]] of Object.entries(pairs)) gl.uniform2f(location(name), x, y);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      // Deletes what it made but keeps the context: a canvas whose context was lost on purpose
      // never gets another, and React mounts effects twice in development.
      destroy: release,
    };
  } catch (error) {
    release();
    throw error;
  }
}

// Room around the slab for its shadow.
const MARGIN = 64;

/**
 * The opener's slab of glass. The canvas follows the slab with a transform, so it moves on the
 * compositor at sub-pixel precision, and draws once per composition frame.
 */
export function GlassLens({ centre, height, scene, visible, width }: GlassLensProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const canvasWidth = width + MARGIN * 2;
  const canvasHeight = height + MARGIN * 2;

  // Created before the effects below, which size it, give it the picture and draw.
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
    rendererRef.current?.resize(
      canvasWidth,
      canvasHeight,
      Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2),
    );
  }, [canvasHeight, canvasWidth]);

  useLayoutEffect(() => {
    if (scene) rendererRef.current?.upload(scene);
  }, [scene]);

  const left = centre.x - canvasWidth / 2;
  const top = centre.y - canvasHeight / 2;

  useLayoutEffect(() => {
    if (!visible || !scene) return;

    rendererRef.current?.draw({
      floats: {
        bend: height * 0.21,
        bevel: height * 0.3,
        frost: 1.1,
        radius: height / 2,
        split: 0.085,
        zoom: 1.12,
      },
      pairs: {
        canvasOrigin: [left, top],
        centre: [centre.x, centre.y],
        halfSize: [width / 2, height / 2],
      },
    });
  }, [centre.x, centre.y, height, left, scene, top, visible, width]);

  return (
    <canvas
      aria-hidden
      ref={canvasRef}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: canvasWidth,
        height: canvasHeight,
        transform: `translate3d(${left}px, ${top}px, 0)`,
        visibility: visible && scene ? 'visible' : 'hidden',
        pointerEvents: 'none',
      }}
    />
  );
}
