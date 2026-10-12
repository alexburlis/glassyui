// The link previews: seamless loops that Messages plays inside a shared link, and the stills that
// every other preview shows. One engine draws two cuts. `home` holds a low macro along the real
// homepage dock while a pill of clear glass springs across its icons; `mobile` holds on the React
// Native Today screen while the pill springs between its segments. Choose a cut with CUT=home or
// CUT=mobile in Node, or ?cut= on the film page.
const requested =
  globalThis.process?.env?.CUT ??
  new URLSearchParams(globalThis.location?.search ?? '').get('cut') ??
  'home';

if (!['home', 'mobile'].includes(requested)) throw new Error(`Unknown cut: ${requested}`);

export const CUT = requested;

// Link previews are 1.91:1. The 4:2:0 packing needs a height divisible by 4, so the frame is two
// rows taller than the 1200 x 630 delivery, which crops the top two rows.
export const WIDTH = 1200;

export const HEIGHT = 632;

export const DELIVERY = { width: 1200, height: 630, top: 2 };

// 24 fps with a 180° shutter: the cadence and motion blur of a film camera, not a screen.
export const FPS = 24;

// Six seconds, then the take repeats exactly: frame 144 is frame 0.
export const FRAMES = 144;

export const DURATION = FRAMES / FPS;

export const SHUTTER = 0.5 / FPS;

// The frame the stills show, and the first frame Messages plays: the pill at rest over its
// first stop, bending what lies beneath it.
export const POSTER_FRAME = 0;

export const COPY = {
  home: { headline: 'Bends light.', second: 'In any browser.' },
  mobile: { headline: 'Bends light.', second: 'In your app.' },
}[CUT];
