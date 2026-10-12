import { FPS, OPENER, STAGE_COLORS } from './frames';
import { RIBBON_BAND, RIBBON_FOLD, VERMILION } from './ribbon';

// The worker that brings the mark into focus on the poster's canvas, as if through thick glass:
// it starts soft, a touch large and split into its colours at the edges, a glint crosses it, and
// it settles into the exact mark. It keeps the composition's timing, counted from the first frame
// the page shows, and draws off the main thread, so the page hydrating meanwhile never holds a
// frame back. A browser that cannot draw WebGL in a worker is told so, and gets the page.
const WORKER = `
const curve = (t, a, b) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
const slope = (t, a, b) => 3 * a * (1 - t) * (1 - t) + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
// cubic-bezier(0.5, 0, 0.15, 1): a gentle start, the focus pulled through the middle, a long
// settle. Time for x by Newton's method, then y.
const ease = (x) => {
  let t = x;
  for (let step = 0; step < 8; step += 1) t -= (curve(t, 0.5, 0.15) - x) / slope(t, 0.5, 0.15);
  return curve(Math.min(Math.max(t, 0), 1), 0, 1);
};
const VERTEX = \`#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}\`;
const FRAGMENT = \`#version 300 es
precision highp float;
uniform sampler2D mark;
uniform vec2 size;
uniform float focus;
out vec4 colour;

vec4 soft(vec2 uv, float radius) {
  float level = log2(max(radius / 2.0, 1.0));
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 16; i++) {
    float r = sqrt((float(i) + 0.5) / 16.0) * radius;
    float a = float(i) * 2.39996323;
    sum += textureLod(mark, uv + vec2(cos(a), sin(a)) * r / size, level);
  }
  return sum / 16.0;
}

void main() {
  vec2 uv = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y) / size;
  float unfocused = 1.0 - focus;
  vec2 centred = (uv - 0.5) / (1.0 + 0.08 * unfocused) + 0.5;
  float radius = size.x * 0.11 * pow(unfocused, 1.2);
  vec2 spread = (centred - 0.5) * 0.06 * unfocused;
  vec4 red = soft(centred + spread, radius);
  vec4 green = soft(centred, radius);
  vec4 blue = soft(centred - spread, radius);
  vec4 c = vec4(red.r, green.g, blue.b, max(max(red.a, green.a), blue.a));
  float glint = exp(-pow(uv.x + uv.y - (2.6 * focus - 0.3), 2.0) / 0.02);
  c.rgb += vec3(0.5) * glint * c.a * (1.0 - smoothstep(0.85, 1.0, focus));
  colour = min(c, vec4(c.a)) * smoothstep(0.0, 0.5, focus);
}\`;
self.onmessage = ({ data }) => {
  const { band, canvas, colour, delay, duration, fold, ink } = data;
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true });
  if (!gl) {
    self.postMessage('unsupported');
    return;
  }
  const art = new OffscreenCanvas(canvas.width, canvas.height);
  const paint = art.getContext('2d');
  paint.scale(canvas.width / 64, canvas.height / 64);
  paint.fillStyle = ink;
  paint.fill(new Path2D(band));
  paint.fillStyle = colour;
  paint.fill(new Path2D(fold));
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('The poster shader did not link: ' + gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.uniform2f(gl.getUniformLocation(program, 'size'), canvas.width, canvas.height);
  const focus = gl.getUniformLocation(program, 'focus');
  gl.viewport(0, 0, canvas.width, canvas.height);
  let start = 0;
  const draw = (now) => {
    start ||= now;
    const progress = Math.min(Math.max((now - start - delay) / duration, 0), 1);
    gl.uniform1f(focus, ease(progress));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (progress < 1) self.requestAnimationFrame(draw);
    else self.postMessage('down');
  };
  self.requestAnimationFrame(draw);
};`;

const frameLength = 1000 / FPS;

// Runs as the poster is parsed, before the page hydrates: hands the canvas to the worker at the
// size the stylesheet gives it, and marks it data-down once the mark is in focus. The canvas
// shows what its worker last drew only while the worker lives, so the worker stays until the
// opener lands.
const POSTER = `(function(){
var root = document.documentElement;
var canvas = document.currentScript.previousElementSibling;
if (!root.hasAttribute('data-keynote-intro')) return;
var size = Math.min(Math.max(0.22 * Math.min(root.clientWidth, root.clientHeight), 120), 200);
var ratio = Math.min(window.devicePixelRatio || 1, 3);
var offscreen = canvas.transferControlToOffscreen();
offscreen.width = Math.round(size * ratio);
offscreen.height = Math.round(size * ratio);
var worker = new Worker(URL.createObjectURL(new Blob([${JSON.stringify(WORKER)}], { type: 'text/javascript' })));
var down = function () { canvas.setAttribute('data-down', ''); };
worker.onmessage = function (event) {
  if (event.data === 'unsupported') root.removeAttribute('data-keynote-intro');
  else down();
};
var landing = new MutationObserver(function () {
  if (root.hasAttribute('data-keynote-intro')) return;
  landing.disconnect();
  worker.terminate();
});
landing.observe(root, { attributeFilter: ['data-keynote-intro'], attributes: true });
worker.onerror = function (event) {
  console.error('The keynote poster could not bring the mark into focus: ' + event.message);
  down();
};
worker.postMessage({
  band: ${JSON.stringify(RIBBON_BAND)},
  canvas: offscreen,
  colour: ${JSON.stringify(VERMILION)},
  delay: ${OPENER.ribbon[0] * frameLength},
  duration: ${(OPENER.ribbon[1] - OPENER.ribbon[0]) * frameLength},
  fold: ${JSON.stringify(RIBBON_FOLD)},
  ink: root.getAttribute('data-lg-theme') === 'light' ? ${JSON.stringify(STAGE_COLORS.light.mark)} : ${JSON.stringify(STAGE_COLORS.dark.mark)}
}, [offscreen]);
})();`;

/**
 * The mark the poster brings into focus while the page loads, on a canvas a worker draws. Its
 * last frame is the whole mark, the frame the player takes over with.
 */
export function PosterRibbon() {
  return (
    <>
      {/* The script below sizes the canvas before the page hydrates; React keeps that size. */}
      <canvas aria-hidden className="keynote-poster-ribbon" suppressHydrationWarning />
      <script dangerouslySetInnerHTML={{ __html: POSTER }} />
    </>
  );
}
