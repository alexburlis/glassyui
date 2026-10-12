# Link previews

Two six-second loops and their stills for glassyui.com's share cards, rendered
by the Through glass film engine. Messages plays a page's `og:video` in place of
its image, starts it at once and loops it (Apple TN3156; LinkPresentation on
macOS 27 observed with an `AVQueuePlayer` looper). Every other preview shows the
still, which is each loop's first frame.

| Cut      | Shows                                                                                                                          | Copy                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| `home`   | A low macro along the real homepage dock; a pill of clear glass rests on Calendar and Maps, springs back to Photos and returns | Bends light. / In any browser. |
| `mobile` | The React Native Today screen, the desk soft behind it; the pill springs Day, Week, Month, then glides back to Day             | Bends light. / In your app.    |

[STORYBOARD.md](STORYBOARD.md) has the beats and the verification contract.

## Render

```sh
pnpm install --ignore-workspace
CUT=home node render.mjs
CUT=mobile node render.mjs
```

needs Google Chrome, FFmpeg and FFprobe, `vmaf` (Homebrew), and Python with
NumPy and Pillow. Each run writes `<cut>.mp4`, `<cut>.jpg`, a contact sheet and
`<cut>.qa.json` to `out/`, and fails on any missed check. Copy a verified JPEG
into `../public/share/` and its MP4 into `../public/share/loops/`.
`--ignore-workspace` keeps this folder's own pinned Playwright apart from the
site's.

Development modes: `CUT=home node render.mjs --stills 0,1.5,3` and `--preview`.
`node frame-check.mjs 0,1,2` prints where the pill, the dock or the phone and
the type land on screen for the current `CUT`, before anything renders.

## What changed from Through glass

- `timeline.mjs` and `motion.mjs` are new: a 1200 × 632 frame (the 4:2:0 packing
  needs a height divisible by 4; the delivery crops the top two rows to 1200 ×
  630), 144 frames at 24 fps, and every curve periodic. The camera drift is
  three harmonics of the loop, the key light turns once a loop, and a stop that
  has not begun this loop still settles from the last one, so frame 144 is
  frame 0.
- `optics.mjs` takes its frame size from `timeline.mjs` instead of 1920 × 1080.
- `film.mjs` drops the film's glass-fills-the-frame sample floor and sets type
  in `system-ui`, the macOS system font (SF Pro). Through glass's stack,
  `-apple-system, "SF Pro Display", sans-serif`, renders Helvetica in Chrome:
  Chrome ignores WebKit's `-apple-system`, and no font named "SF Pro Display" is
  installed.
- `render.mjs` and `check.py` are a short loop pipeline: H.264 only (CRF 16,
  `tune grain`, one key frame per loop), a 4:4:4 JPEG poster rendered at 160
  sub-frames, and checks for decoded frames, the seam, banding, determinism,
  size and fast start. There is no score: Messages plays previews silently.

## Sources

Copied into `assets/` on 6 October 2026 from the glassyui.com repository:

- `desk-light-4x.webp`: the homepage desk in its light appearance from the local
  development server at four times its 1200 × 750 CSS size, with reduced motion
  so the keynote stands aside, the analytics prompt hidden, taken once
  `.home-desk .desk-screen` dropped `data-settling`.
- `ios-light.webp`: `public/previews/mobile/ios-light.webp`, the Expo fixture's
  Today screen captured on iOS.
- `glassyui-logo-compact.svg`: `public/brand/glassyui-logo-compact.svg`, the cut
  DESIGN.md gives for 16 to 48 px; the lockup's mark is 44 px.

The type is SF Pro through the macOS system font, as the brand guide specifies
and the site renders it; the macOS licence allows its fonts to display content.
The glass pill and its path are editorial motion, not a component's behaviour.
Nothing here is uploaded or published.
