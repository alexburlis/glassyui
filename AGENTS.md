# Repository guidelines

## Project structure & module organization

- `src/app` — Next.js 16 App Router entry (`layout.tsx`, `page.tsx`, global
  styles).
- `src/components/liquid` — copy-ready UI primitives (Button, Dialog, Tabs,
  etc.) that share `src/styles/liquid.css`.
- `src/components` — docs-only shells (gallery, header, debug/performance
  overlays, preference controls).
- `src/lib/liquid` — shared helpers (preference persistence, theming hooks).
- `src/styles/liquid.css` — token layer for glass effects; keep edits
  documented.
- `public` — static assets; prefer optimized SVG/PNG.
- Keep promotional film projects, renders and production evidence outside this
  repository. The one film here is `link-previews/`, which renders the share
  cards' loops.
- `registry/glassyui-native` — the React Native (Expo) components, catalogued in
  `registry-native.json` and published to `public/r/native` (the
  `@glassyui-native` namespace). They keep the web names and use React Native props, draw iOS 26+
  glass with `expo-glass-effect`, blur elsewhere with `expo-blur`, and import
  only each other, React, React Native and their declared packages.
- `registry/glassyui/themes/glassy-theme.css` — the source of the
  `glassy-theme` registry item, a CSS-only shadcn theme that turns stock
  shadcn/ui components into glass. `scripts/build-shadcn-theme.mjs` writes it
  into `registry.json` (its `:root`/`.dark` tokens become cssVars and its one
  `@layer components { @layer glassy }` block the item's css); never edit the
  item in `registry.json` by hand. Its rim lens is Glassy UI's own lens
  profile, written into `glassy-lens.svg` beside it from
  `scripts/shadcn-theme-lens.mjs` and inlined as data: URLs by the same build;
  only Chromium draws it, so the lens rules sit in a block that only Chromium
  matches. The `/guides/shadcn-theme` guide documents it and shows images from
  `public/guides/shadcn-theme`.
- `registry/glassyui-shadcn` — the drop-in sets `glassy-ui-new-york` and
  `glassy-ui-base-nova`: Glassy UI's components with shadcn/ui's API. Each
  drop-in is shadcn/ui's stock file for its style with the same exports, props,
  `data-slot` markup and directive, but with Glassy UI's sizes in its classes.
  The button, card, alert, tabs list and floats run Glassy UI's engine on their
  glass (`registry/glassyui/glassy-engine.tsx`: the components' lens measured
  for that element, and registration with a `GlassScene`), through a client
  host where the stock file is a Server Component. `glassy-ui.css` draws Glassy
  UI's look from the components' resolved styles, with the palette's
  `--primary` for Glassy UI's blue; the sets carry it instead of the theme's
  rules, and only the theme's easing curves. `scripts/build-shadcn-theme.mjs` writes both items. The
  drop-ins keep shadcn/ui's own formatting, so they differ from the stock files
  only where the look or the engine needs it, and `.oxfmtrc.json` skips them;
  the button roots and `glassy-ui.css` follow the repository's.
- `fixtures/shadcn-theme-consumer` — two stock shadcn/ui apps created with the
  CLI, `new-york` on Radix and `base-nova` on Base UI, with their own lockfiles.
  Only `app/page.tsx`, `app/harness.css`, `app/layout.tsx` and `public/` are
  test harness; re-add the components with the CLI rather than editing them.
- `fixtures/expo-consumer` — an Expo SDK 57 app that renders every native
  component in `showcase/`. `usage/` holds one React Native example per item;
  component pages show that file under their React Native switch, so it must
  type-check and run. `showcase/today.tsx` is the app screen behind the
  screenshots in `public/previews/mobile`, which the `/mobile` page and the home
  page's still phone show; the keynote's turn lands on a live copy of it. Run
  `npm install` there, copy `registry/glassyui-native` into its
  `components/glassyui`, then `npx expo start`. Its `ios/`, `node_modules/` and
  `components/glassyui/` are generated and ignored.
- `src/components/keynote` — the home page's keynote: two Remotion compositions
  drawn by `@remotion/player`, with the frame ranges they share in `frames.ts`
  and their curves in `timeline.ts`. The opener (`opener.tsx`, run by
  `keynote-opener.tsx`) plays as the page loads on a visitor's first visit,
  which local storage remembers as playback starts (`glassy-ui-intro`), and
  lands in about five seconds; scrolling waits for it and Tab or Escape hurries
  it. A first click or tap says how to skip it and a second skips it; Replay
  intro, under the hero's install command, plays it again from its first frame.
  Its poster brings the mark into focus through glass, drawn by a worker on a
  canvas handed to it (`poster-ribbon.tsx`), so it stays smooth while the page
  hydrates; both players start muted to avoid blocking playback on an
  AudioContext; its slab of glass (`glass-lens.tsx`) is a WebGL shader. The fold
  uses the library's `GlassPhoneDuo` component, with the title slide as its inner
  screenshot and the existing cover preview on its outer display. The timeline
  drives its hinge and turn directly, then scales and moves the component away.
  The turn (`turn.tsx`, run by `keynote-turn.tsx`) is scrubbed by scroll and
  lands on a phone, black on the light page and silver on the dark one. Its
  body is a solid WebGL model (`phone-model.tsx`): a unibody whose back rounds
  into its sides, a raised camera plateau with three raised lenses, the flash
  and LiDAR, a frosted glass panel and the keys, with no logo. Every part is
  one rounded solid shaped by uniforms, so the body stretches from the desk's
  slab into the phone as it turns, drawn with the stage's own CSS camera under
  the live screens; near edge-on the back spreads across the desk from its
  receding edge. The phone's front (`phone.tsx`) and screen
  (`phone-screen.tsx`, laid out at 402 by 874 points in
  `src/styles/keynote-phone.css`) are the Today screen built from the web
  components. Both screens stay mounted and take input while their face is
  visible, preserving edits through reversal. The page under the
  stage stays real: `src/styles/keynote.css` shows the opener only while
  `html[data-keynote-intro]` is set and pins the turn only while
  `html[data-keynote]` is set; both need JavaScript and motion allowed, and an
  address on the page skips the opener. `public/keynote` holds the phone's
  wallpapers, taken from the Expo fixture's. The turn projects the live desk.
  Remotion's free licence covers this project's size; keep `remotion` and
  `@remotion/player` on the same exact version.

## Build, test, and development commands

- `pnpm install` — install dependencies (pnpm 10.x pinned in `package.json`).
- `pnpm dev` — run the docs site at http://localhost:3000.
- `pnpm build` / `pnpm start` — production build and serve; use before shipping
  demos.
- `pnpm lint` — Oxlint anti-slop rules and ESLint with Next.js Core Web Vitals
  rules; required pre-PR.
- `pnpm format:check <changed-files>` — verify changed files with the pinned
  local Oxfmt.
- `pnpm check:native-registry` — verify the Expo catalogue: every import inside
  an item's install closure, declared packages, and `public/r/native` equal to a
  fresh build. Rebuild only the Expo payloads with
  `node scripts/build-install-registry.mjs registry-native.json --output public/r/native`.
- `pnpm theme:build` — rebuild the `glassy-theme` item and the two drop-in sets
  from their sources, then the registry payloads. `node scripts/build-shadcn-theme.mjs --check`
  fails when `registry.json` is stale; `pnpm check:registry` runs the same
  comparison.
- `pnpm check:shadcn-theme [artifact-directory] [--fixture <name>]` — install
  the theme into clean copies of both stock fixtures, and of new-york in each
  colour theme in `fixtures/shadcn-theme-consumer/palettes.json` (fixtures
  `new-york-blue` and so on), with the pinned shadcn CLI and a fixture's own
  newer CLI, then prove it in Chrome: each
  CLI writes exactly the item, the same bytes and nothing but
  `app/globals.css`; every covered slot shows its glass, decoration sits on its
  host, labels reach their WCAG contrast minimum or keep the stock contrast
  where shadcn/ui falls short, the tabs pill springs, menus keep their frost
  while they fade, cards and buttons frost evenly to their rims and bend the
  page there (cards also split it into colour), matching Glassy UI's own lens
  built from the component library's code, and the preference fallbacks and
  className overrides hold; then check that WebKit and Firefox, which draw no
  lens, get none of it and keep the frost (install them with
  `pnpm exec playwright install webkit firefox`).
  Saves before-and-after screenshots, a report and traces (default:
  `.artifacts/shadcn-theme`); `--guide-images public/guides/shadcn-theme`
  refreshes the guide's images.
- `pnpm check:shadcn-dropins [artifact-directory] [--fixture <name>]` — the same
  proof for the drop-in sets, on the same six apps: install each app's set with
  `--overwrite`, hold every CLI to the set's files, type-check a file that uses
  every stock export with the stock props, build a Server Component route that
  renders the drop-ins, run every theme assertion, and check that the drop-ins
  keep the stock data attributes, element count, page size and directives and
  run the measured lens in Chrome, which follows the page into dark mode
  (default: `.artifacts/shadcn-dropins`).
- `pnpm check:platform-switch http://127.0.0.1:3000 [artifact-directory]` —
  prove in Chromium that a component page's React and React Native switch swaps
  the install and usage and keeps the choice on the next page; save screenshots,
  a hashed result manifest and a Playwright trace (default:
  `.artifacts/platform-switch`).
- `pnpm exec node scripts/smoke-liquid-interactions.mjs http://127.0.0.1:3000/diagnostics [artifact-directory]`
  — check the component interactions and actual preference controls, saving the
  same evidence (default: `.artifacts/liquid-interactions`).
- `pnpm smoke:expo-consumer http://127.0.0.1:3100` — install every Expo item
  from a running server into a clean copy of the Expo fixture, then type-check
  and bundle it for iOS, Android and the web.
- `pnpm benchmark http://127.0.0.1:3000/diagnostics` — benchmark an explicit
  loopback development diagnostics route.
- `pnpm check:keynote http://127.0.0.1:3000 [artifact-directory]` — prove in
  Chromium, WebKit and Firefox that the opener plays on its own and through
  stray input, steps aside for Escape, lands the hero in place, and that the
  turn turns the live desk into the phone, whose visible screen takes clicks
  during the turn; both stand still under reduced motion. Leaves the opener's
  key frames and a video of the whole keynote.
- `pnpm check:keynote http://127.0.0.1:3000 [artifact-directory] turn-live` —
  focus on live edits, projected bubble dragging, screen identity and reversal
  at desktop and mobile widths in all three engines, plus reduced motion.

## Coding style & naming conventions

- Language: TypeScript + React; prefer server components in `app/` and client
  components marked with `'use client'` when needed.
- Formatting: Oxfmt (`.oxfmtrc.json`) with semicolons, single quotes, trailing
  commas and 2-space indentation. Format changed files with
  `pnpm exec oxfmt <changed-files>`; preserve unrelated formatting.
- Linting: `eslint.config.mjs` extends Next.js core-web-vitals and TypeScript
  presets; keep imports ordered by usage.
- Naming: PascalCase for components, camelCase for hooks/utils, kebab-case for
  file names unless React component export (e.g., `button.tsx`).

- Copy: call the library, its look and its templates "Glassy UI". For the iOS 26
  material write "the system's own glass". Preserve literal API names.

## Testing guidelines

- CI uses Git history to select expensive visual and consumer owners. Keep
  `scripts/ci-scope.mjs` conservative when adding a new shared input. The
  always-running `release-gate` must reject failed, cancelled or unexpectedly
  skipped owners. `main` requires this result, including for administrators;
  ordinary changes land through verified PRs. Maintenance may report the same
  status only after its exact candidate passes local gates and is published to
  its existing source branch. See `CONTRIBUTING.md` for coverage and release runs.
- Select the affected generated-registry, registry-install, served-route,
  native-platform, browser, lint or build checks from `CONTRIBUTING.md`; use the
  full set for broad package/release changes.
- Unit tests must independently protect a P0 security, money, consent/data-loss,
  primary install workflow or release/platform contract. Browser suites own
  component interactions and preferences; do not duplicate source/HTML
  inventories or cosmetic assertions.
- For visual or interaction changes, run `pnpm dev`, then verify component
  interactions and preference toggles across desktop and mobile sizes.
- For performance-sensitive changes, use the development-only diagnostics route
  and capture `[Glassy Benchmark]` output for PR notes.

## Commit & pull request guidelines

- Commits follow the existing style: concise, action-led sentence case summaries
  (e.g., "Refactor visibility management in GlobalLightSource").
- Squash small WIP commits; keep one coherent commit per logical change when
  possible.
- PRs should include: purpose summary, linked issue (if any), notable UI changes
  (screenshots or short clip), testing/benchmark notes, and any new copy-ready
  components listed.
- Ensure `pnpm lint` and (when touched) `pnpm benchmark` pass before requesting
  review.

## Debugging & developer tools

- The development-only `/diagnostics` route mounts the DebugPanel and
  PerformanceOverlay for rim/blur tuning and FPS inspection.
- Material studies, shader samples, the glass comparison and the standalone
  laptop mockup live outside this launch repository in
  a separate experiments project.
  Keep new studies and experimental shader controls there. The public component
  docs retain their normal laptop showcase and glass examples.
- Use `src/components/liquid/provider.tsx` and `src/lib/liquid/preferences.ts`
  for persisted toggles instead of reimplementing storage logic.
- Glassy UI Pro is a separate private application repository. This site owns
  only external Pro links and the public teaser in `src/lib/pro-teaser.ts`.
  Keep its visible prices and template names in sync with the private offer.
  `src/lib/site-links.ts` owns the public Pro origin. `/pro` addresses redirect
  there on every host; never add Pro routes or paid source to this repository.
- The development-only `/share-studio` route draws each page's link-preview card
  at 1200 × 630 from the live components (`src/components/share`);
  `node scripts/capture-share-cards.mjs <loopback-url> [card ...]` photographs
  them into `public/share`, which `src/lib/share.ts` puts in each page's Open
  Graph and X tags. The home and React Native cards and the loops Messages plays
  are rendered by `link-previews/`, a film engine with its own `package.json`;
  `public/share/README.md`
  says how to make each card again. A new web component or guide fails the
  build until its card is captured: run the script with `--missing`.
- `node scripts/smoke-pro-links.mjs <base-url> <artifact-directory>` checks
  external Pro redirects, the public gallery teaser and legal/footer links.
  The separate private app owns preorder, checkout, terms and Pro smoke checks.
- `pnpm check:analytics-consent <free-base-url> <artifact-directory>` checks
  free-site consent. Add a separate loopback Pro base URL as the third argument
  for shared-cookie and checkout proof across the actual two applications.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
