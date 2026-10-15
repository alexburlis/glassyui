# Contributing

Glassy UI is a source-copy component library distributed through a
shadcn-compatible registry.

## Local checks

### Static checks

Run the full local gate before proposing changes:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm registry:check-generated
pnpm check:registry
pnpm check:dead-code
pnpm test:braces-security
pnpm test:analytics-consent
pnpm test:error-reports
pnpm test:error-startup
pnpm test:build-upload
pnpm lint
pnpm build
```

`check:dead-code` checks the native install closures, then runs Knip across the
app, registries, examples, consumer fixtures, scripts and lint plugin. `knip.ts`
preserves the documented source-copy exports and generated upstream
declarations. Support scripts remain reachable through their callers. The
retained `link-previews/` JavaScript uses the same root lint rules and
formatter.

The production build type-checks the root tsconfig. Native sources, stock
fixtures and drop-ins use the clean consumer checks below. CI selects them
automatically when their source, fixtures, generators or shared inputs change.
CI checks both stock shadcn styles; retain the full palette checks for styling
semantics and release work.

Every CI run checks formatting, generated registries, lint, security, privacy,
builds and types. It also checks the clean three-browser web consumer, served
routes, agent HTTP, launch assets, platform choice, public Pro links,
intercepted consent and development interactions. Relevant PR changes also run
the full release UI/accessibility, refraction and material matrix.
Documentation-only PRs skip that separate matrix. Common toolchain/CI inputs and
unclassified files select all owners; deleted and renamed paths still select
their owners. `node scripts/check-ci-routing.mjs` exercises those decisions
through real Git history and rejects failed gate inputs.

`release-gate` is the single required result: all selected owners must pass.
Newer commits cancel older runs of the same PR. Manual dispatch runs all owners.
Protected `main` accepts a verified PR or an exact locally verified maintenance
candidate; its push workflow reruns the final-source checks without repeating
pre-merge consumer matrices. Coolify deploys after that verified change reaches
`main`. Hosted CI remains separate evidence from local verification.

GlassCommand guards scrolling on its own result and heading nodes while the menu
does not own focus. The guard ships with the registry component; no cmdk patch
is required. The clean consumer smoke proves mount scroll, keyboard navigation
and ref cleanup against ordinary cmdk in all three browsers. `check:site-motion`
also covers the docs page's lazy command demo.

### Development checks

CI runs the relevant native registry, Expo, theme, lens, generator, fixture,
drop-in and engine checks for affected PRs. Run each locally with a separate
artifact directory and inspect its report when developing the corresponding
source.

- **shadcn theme:** after changing `registry/glassyui/themes/glassy-theme.css`
  or its lens in `scripts/shadcn-theme-lens.mjs`, the generator
  `scripts/build-shadcn-theme.mjs` or stock fixtures, run `pnpm theme:build`,
  then `pnpm check:shadcn-theme [artifact-directory] --fixture new-york` and
  again with `--fixture base-nova`. Use the full palette set (omit `--fixture`)
  for styling semantics or generator logic changes. The check installs the theme
  into clean copies of the stock fixtures and checks it in Chrome, including
  that its lens matches Glassy UI's own. It also checks that WebKit and Firefox
  keep the frost without the bend.
- **shadcn drop-ins:** after changing `registry/glassyui-shadcn/` (the drop-ins
  and `glassy-ui.css`, which draws Glassy UI's look) or
  `registry/glassyui/glassy-engine.tsx`, run `pnpm theme:build`, then
  `pnpm check:shadcn-dropins [artifact-directory] --fixture new-york` and again
  with `--fixture base-nova`. Use all palettes for styling semantics or
  generator logic changes. The check installs each style's set into the same
  stock apps and checks that the drop-ins keep shadcn/ui's API and markup, use
  Glassy UI's look and sizes, preserve rendered contrast, and run Glassy UI's
  measured lens in Chrome.
- **Platform choice:**
  `pnpm check:platform-switch <base-url> [artifact-directory]` checks the
  platform choice across component pages.
- **Components and preferences:**
  `pnpm exec node scripts/smoke-liquid-interactions.mjs <diagnostics-url> [artifact-directory]`
  checks component interactions and the actual preference controls against a
  development server's `/diagnostics` route.
- **Benchmark:** `pnpm benchmark http://127.0.0.1:3000/diagnostics` requires an
  explicit development-only loopback URL.

The platform and interaction checks' default evidence directories are
`.artifacts/platform-switch` and `.artifacts/liquid-interactions`. Each run
saves screenshots, a manifest with the result and file hashes, and a Playwright
trace; failed runs also retain the trace and a failed manifest. Inspect the
trace with:

```bash
pnpm exec playwright show-trace <artifact-directory>/trace.zip
```

CI keeps this evidence for failed runs only. The clean web consumer uses the
pinned CLI's default Base Nova style so its installation transforms are covered
alongside the library's Radix components.

### Production checks

The production route, clean-install, documentation, and release UI smokes also
require a locally running production build. See the
[release verification guide](docs/launch-readiness.md#running-server-gate) for
the server setup and smoke commands.

- **Refraction:**
  `pnpm check:refraction-visuals <base-url> <artifact-directory>` produces
  fixed-viewport active/plain refraction comparisons, a frame-by-frame scroll
  audit that fails if a viewport scene trails its wallpaper in Chromium, and a
  hash manifest. Add `--magnifier` after the artifact directory to check the
  magnifier's colour separation, pointer and keyboard movement, and preferences
  in Chrome, WebKit and Firefox at desktop and mobile widths.
- **Glass material:**
  `pnpm check:glass-material <base-url> <artifact-directory>` proves every
  frosted component blurs a striped backdrop in Chromium and keeps the CSS frost
  in WebKit and Firefox.
- **Site motion:** `pnpm check:site-motion <base-url> <artifact-directory>`
  proves the home page entrance runs, lands and stays still under reduced
  motion, that scroll reveals never hide content, that menus grow from their
  trigger, that the Pro card's art drifts only when motion is allowed and that
  the theme switch keeps working in Chromium, WebKit and Firefox.
- **Keynote:** `pnpm check:keynote <base-url> <artifact-directory>` proves, in
  the same three engines, that the home page's opener plays on its own with a
  poster drawn by a worker, lands the hero exactly in place, plays on through a
  wheel turn or a click without scrolling the page and makes way for Escape;
  that Skip intro works before hydration on desktop and touch screens and
  through keyboard activation; that the turn keeps the desktop and phone live;
  and that the keynote stands still under reduced motion, without JavaScript and
  for an address on the page. It leaves the opener's key frames and a video of
  the whole keynote. Add `turn-live` after the artifact directory to check
  edits, dragging and control identity through reversal at desktop/mobile
  widths, with screenshots and a video of the live turn.
- **Text selection:**
  `pnpm check:text-selection <base-url> <artifact-directory>` proves, in the
  same three engines, that double and triple clicks on control labels select
  nothing while descriptions, badges, alerts and field values stay selectable.
- **Home scroll:**
  `node scripts/check-home-scroll.mjs <base-url> <artifact-directory>` checks
  that wheel scrolling keeps the turn within two composition frames at desktop
  and phone widths, then confirms the settled phone does not redraw while
  feature text moves or while it is offscreen. It saves screenshots, Playwright
  traces and a report with artifact hashes.
- **Phone Duo:**
  `node scripts/check-phone-duo.mjs <base-url> [artifact-directory]` checks
  seven poses in both finishes at desktop and phone widths, hinge keyboard and
  drag controls, folding frames, settled pixels, theme changes and reduced
  motion. It saves pose screenshots, Playwright traces and a hashed manifest.

### Formatting

Use sentence case for headings. The repository formatter wraps Markdown prose at
80 columns and normalizes tables, lists and code blocks.

```bash
pnpm exec oxfmt <changed-files>
pnpm format:check <changed-files>
```

## Component scope

Reusable components live in `src/components/liquid` and registry-ready copies
live in `registry/glassyui`.

Do not import docs-only code into registry files:

- `src/app/*`
- `src/components/site/*` and `src/components/docs/*`
- `src/components/debug-panel.tsx`
- `src/components/performance-overlay.tsx`

## Expo components

React Native versions of the components live in `registry/glassyui-native` and
are catalogued in `registry-native.json`. They share the web component names and
use React Native props, take colours from `useGlassTheme()` and glass only from
`GlassSurface`, and never animate the opacity of a view that contains glass. iOS
drops the effect at low opacity; move glass with translate or scale instead.

For changes to native source, `registry-native.json` or the Expo fixture, run
`pnpm smoke:expo-consumer <base-url> [artifact-directory]`; it installs all
native items, type-checks source and usage, and bundles iOS, Android and web.
Bundles establish compile/install compatibility; native glass and haptics need
the actual device checks.

For a new or changed Expo component:

1. Edit the source under `registry/glassyui-native` and its item in
   `registry-native.json`, declaring every package it imports.
2. Rebuild the payloads with
   `pnpm exec shadcn build registry-native.json --output public/r/native` and
   run `pnpm check:native-registry`.
3. Copy the source into `fixtures/expo-consumer/components/glassyui`, show the
   component in `fixtures/expo-consumer/showcase`, write its usage example in
   `fixtures/expo-consumer/usage/<name>.tsx` (its component page shows that
   file), and run `npx tsc --noEmit` there.
4. Check it in the fixture on iOS 26 or later, an earlier iOS, Android and the
   web, in both themes and with Reduce Transparency on.
5. Against a running production build, run `pnpm smoke:expo-consumer <base-url>`
   and `pnpm check:platform-switch <base-url>`.
6. With Metro running from this fixture (`npx expo start`), run
   `node scripts/check-expo-web.mjs http://127.0.0.1:8081 [artifact-directory]`
   to check the phone-sized gallery, its glass and overlays, theme change,
   Reduce Transparency and browser errors. It saves screenshots and a hashed
   manifest.

## Adding registry components

For every new registry component:

1. Add source under `registry/glassyui`.
2. Add the item to `registry.json`.
3. Extend the official install/consumer smoke for a new primary workflow or
   release contract.
4. Update `docs/registry-components.md`.
5. Rebuild `public/r` with `pnpm registry:build`.
6. Run the complete local checks above.
