import { useLayoutEffect, useRef } from 'react';
import type { PhoneBody } from './phone';

// A reflection of a fixed studio, viewed through the turning cover glass. Each pixel reflects
// its own ray to the eye: the light follows the surface's pose rather than a timed wipe.
const VERTEX = `#version 300 es
in vec2 corner;
out vec2 uv;
void main() {
  uv = corner;
  gl_Position = vec4(corner.x * 2.0 - 1.0, 1.0 - corner.y * 2.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 colour;
uniform vec2 size;
uniform vec3 eye;
uniform vec3 pose;
uniform float scale;
uniform float depth;
uniform float side;
uniform float strength;

// CSS applies yaw, roll, then pitch to both the plane and its normal.
vec3 turn(vec3 p) {
  vec2 yaw = vec2(cos(pose.y), sin(pose.y));
  vec2 roll = vec2(cos(pose.z), sin(pose.z));
  vec2 pitch = vec2(cos(pose.x), sin(pose.x));
  p.xz = vec2(p.x * yaw.x + p.z * yaw.y, -p.x * yaw.y + p.z * yaw.x);
  p.xy = vec2(p.x * roll.x - p.y * roll.y, p.x * roll.y + p.y * roll.x);
  p.yz = vec2(p.y * pitch.x - p.z * pitch.y, p.y * pitch.y + p.z * pitch.x);
  return p;
}

// A tall diffusion panel. Angular falloff rounds its shoulders without blurring the screen.
float softbox(vec3 ray, vec3 toward, vec3 up, vec2 spread) {
  toward = normalize(toward);
  vec3 across = normalize(cross(up, toward));
  vec3 vertical = cross(toward, across);
  float facing = dot(ray, toward);
  vec2 p = vec2(dot(ray, across), dot(ray, vertical)) / max(facing, 0.001);
  p /= spread;
  return exp(-0.5 * dot(p, p)) * smoothstep(0.0, 0.25, facing);
}

void main() {
  // The phone faces the opposite side of the slab, so its horizontal axis reverses as well.
  vec3 point = vec3((uv - 0.5) * size * vec2(side, 1.0), depth * side * 0.5);
  vec3 normal = turn(vec3(0.0, 0.0, side));
  vec3 view = normalize(eye - turn(point * scale));
  float facing = max(dot(normal, view), 0.0);

  if (facing <= 0.0 || strength <= 0.0) {
    colour = vec4(0.0);
    return;
  }

  vec3 ray = reflect(-view, normal);
  float key = softbox(ray, vec3(0.22, -0.32, 0.92), vec3(0.28, -0.96, 0.0), vec2(0.23, 0.85));
  float fill = softbox(ray, vec3(-0.5, -0.45, 0.74), vec3(-0.2, -0.98, 0.0), vec2(0.48, 0.65));
  float ceiling = pow(max(-ray.y, 0.0), 2.0);
  vec3 studio = vec3(0.035, 0.04, 0.05)
    + key * vec3(1.65, 1.58, 1.48)
    + fill * vec3(0.48, 0.54, 0.65)
    + ceiling * vec3(0.18, 0.2, 0.24);

  // Coated glass reflects very little head-on. Fresnel raises the reflection at grazing angles;
  // a gentle exposure shoulder holds the highlights instead of washing out the picture.
  float fresnel = 0.055 + 0.945 * pow(1.0 - facing, 5.0);
  float alpha = strength * (0.055 + 0.16 * (1.0 - exp(-(fresnel - 0.055) / 0.16)));
  vec3 light = 1.0 - exp(-studio);

  // Sub-pixel dithering prevents contours in the quiet falloff. It is fixed, never animated.
  float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  colour = vec4(clamp(light * alpha + noise * alpha / 16.0, 0.0, alpha), alpha);
}`;

type Face = 'desk' | 'phone';

type ScreenReflectionProps = {
  body: PhoneBody;
  face: Face;
  inset?: number;
  strength?: number;
};

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);

  if (!shader) throw new Error('The screen reflection could not create a shader.');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);

    gl.deleteShader(shader);
    throw new Error(`The screen reflection shader did not compile: ${message}`);
  }

  return shader;
}

function createRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true });

  if (!gl) throw new Error('The screen reflection needs WebGL2.');

  const program = gl.createProgram();
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`The screen reflection program did not link: ${gl.getProgramInfoLog(program)}`);
  }

  gl.useProgram(program);

  const buffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);

  const corner = gl.getAttribLocation(program, 'corner');

  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
  gl.viewport(0, 0, canvas.width, canvas.height);

  const uniforms = {
    depth: gl.getUniformLocation(program, 'depth'),
    eye: gl.getUniformLocation(program, 'eye'),
    pose: gl.getUniformLocation(program, 'pose'),
    scale: gl.getUniformLocation(program, 'scale'),
    side: gl.getUniformLocation(program, 'side'),
    size: gl.getUniformLocation(program, 'size'),
    strength: gl.getUniformLocation(program, 'strength'),
  };

  return {
    draw(body: PhoneBody, face: Face, inset: number, strength: number) {
      const radians = Math.PI / 180;

      gl.uniform2f(uniforms.size, body.width - inset * 2, body.height - inset * 2);
      gl.uniform3f(uniforms.eye, ...body.eye);
      gl.uniform3f(
        uniforms.pose,
        body.pose.x * radians,
        body.pose.y * radians,
        body.pose.z * radians,
      );
      gl.uniform1f(uniforms.depth, body.depth);
      gl.uniform1f(uniforms.scale, body.scale);
      gl.uniform1f(uniforms.side, face === 'desk' ? 1 : -1);
      gl.uniform1f(uniforms.strength, strength);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}

/** The same studio on either side of the turning slab, without a blur or a moving stripe. */
export function ScreenReflection({ body, face, inset = 0, strength = 1 }: ScreenReflectionProps) {
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
    rendererRef.current?.draw(body, face, inset, strength);
  }, [body, face, inset, strength]);

  return (
    <canvas
      aria-hidden
      height={256}
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset,
        width: body.width - inset * 2,
        height: body.height - inset * 2,
        borderRadius: Math.max(body.radius - inset, 0),
        pointerEvents: 'none',
      }}
      width={256}
    />
  );
}
