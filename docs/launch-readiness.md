# Release verification

This document describes the deterministic release boundary. Passing these checks
does not prove a deployment, external namespace registration, hosted CI run,
tag, or announcement.

## Local truth surfaces

- `registry.json` is the editable web catalog of components.
- `registry-native.json` is the editable React Native catalog, with generated
  payloads in `public/r/native`.
- `registry/glassyui/*` owns the editable registry source.
- `public/r/registry.json` and `public/r/<name>.json` are generated static
  payloads served by the local Next.js app.
- `src/components/liquid/*` is the separate reusable source tree used by this
  docs app.
- `/components` and `/components/<name>` document the components.
- `package.json` pins `shadcn@4.14.1` for registry generation and install
  verification.

The supported local consumer flow is:

```json
{
  "registries": {
    "@glassyui": "http://127.0.0.1:3000/r/{name}.json"
  }
}
```

```bash
pnpm dlx shadcn@4.14.1 add @glassyui/glass-button
```

The install command requires this site to be running at the configured local
URL. The registry's namespaced dependencies pull in shared source and the
provider-owned stylesheet transitively.

## Static gate

The essential static checks protect three launch contracts:

| Check                                                                 | Failure it prevents                                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `pnpm build`                                                          | A site that cannot compile, type-check or serve its production routes.                                  |
| `registry:check-generated`, `check:registry`, `check:native-registry` | Published component payloads that drift from source, omit dependencies or cannot resolve their imports. |
| The existing consent and error-report checks below                    | Collection without permission or private data entering SDK payloads when reporting is configured.       |

Keep the existing lint gate for code hygiene. Additional cosmetic assertions,
unit coverage targets and synthetic frame deadlines are not launch blockers.
Static checks complement the real installed-consumer and browser flows; they do
not replace those flows. Physical devices establish native glass and haptic
claims separately from Expo bundle compatibility.

This repository launches the free library and docs. The Pro preorder app, terms,
checkout and commercial device/payment checks belong to the separate private
`glassyui-pro` repository. Payment verification does not block publication of
the free MIT source. Public Pro links and advertising remain here; keep
`src/lib/pro-teaser.ts` in sync with the private offer when it changes.

Run these checks against the current working tree:

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

## Running-server gate

This is the complete browser/served gate. CI retains the web install and served
checks on every run, and selects the full visual matrix for relevant PR changes
or a manual release dispatch. Native and both stock shadcn styles run in their
own jobs when their inputs change. Other affected behavior owners are mapped in
[CONTRIBUTING.md](../CONTRIBUTING.md). They are maintainer checks for affected
changes. Performance measurement is a separate explicit task; no benchmark is
part of default CI.

Use real Chrome plus Playwright Chromium, Firefox and WebKit:

```bash
pnpm exec playwright install chrome chromium firefox webkit
```

Local builds and servers work without provider credentials. Keep
`SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_RELEASE` and
`POSTHOG_PROJECT_TOKEN` unset when verifying a credential-free build. Set
`SOURCE_COMMIT` to the exact candidate SHA to verify `X-GlassyUI-Release`. Stop
each owned server after its checks, including when startup or a check fails.

Serve the production build locally with the same standalone server the
production image runs, then point the route, install, docs, and UI smokes at
that exact server:

Start the server in one terminal:

```bash
mkdir -p .next/standalone/public .next/standalone/.next/static
cp -R public/. .next/standalone/public/
cp -R .next/static/. .next/standalone/.next/static/
HOSTNAME=127.0.0.1 PORT=3100 node .next/standalone/server.js
```

Leave that terminal running. Run the checks in a second terminal:

```bash
pnpm smoke:registry-routes http://127.0.0.1:3100
pnpm smoke:registry-install http://127.0.0.1:3100
node scripts/smoke-launch.mjs http://127.0.0.1:3100 .artifacts/prelaunch/launch
GLASSYUI_BASE_URL=http://127.0.0.1:3100 pnpm smoke:docs-routes
pnpm check:agent-discovery http://127.0.0.1:3100 .artifacts/agent-discovery
pnpm smoke:release-ui http://127.0.0.1:3100 .artifacts/release-ui
pnpm check:refraction-visuals http://127.0.0.1:3100 .artifacts/refraction-visuals
pnpm check:glass-material http://127.0.0.1:3100 .artifacts/glass-material
node scripts/smoke-pro-links.mjs http://127.0.0.1:3100 .artifacts/pro-links
pnpm check:analytics-consent http://127.0.0.1:3100 .artifacts/analytics-consent
```

Passing a structure-only registry check is not install or UI proof. The clean
consumer install, production build, real component interactions, theme modes,
reduced-transparency modes, accessibility checks, 320/390px containment, and
edge-focused refraction pixel differences must be verified by their owning
gates. The refraction check records fixed browser and viewport settings,
active/plain image hashes, soft/strong comparisons, displacement differences,
reduced-motion/transparency fallbacks, how far the GlassSurface docs'
fixed-wallpaper example's centre and rim differ from the unfiltered wallpaper,
and how closely the home page's WebGL pane follows the wallpaper behind it, in
Chromium, Firefox and WebKit in its manifest.

The clean installed-consumer gate also reproduces providerless system Reduce
Transparency in Chrome and command-menu focus scrolling in all three browsers.
The native platform check reads the actual copied installation recipe at desktop
and mobile widths. The public Pro-links smoke checks redirects, legal links and
the gallery teaser. It does not serve or verify the private preorder app.

The consent browser gate intercepts analytics transport locally; it needs no
provider credentials. The three isolated checks above protect server consent
decisions, actual SDK payload privacy and withdrawal during SDK startup. Keep
those contracts alongside the browser interactions.

`pnpm check:error-reports <base-url> <artifact-directory>` is a separate browser
gate for a fixture build with a synthetic loopback Sentry DSN and a
`glassyui@<40-hex-commit>` release. A normal build without a DSN deliberately
does not initialize collection, so it cannot prove the positive collection case.
Use the harness's intercepted transport; do not add provider credentials to CI.

The UI smoke also asserts what a first-time visitor, a crawler and a language
model meet: the site opens light whatever the system prefers (server markup,
first paint and hydration, in Chromium, Firefox and WebKit, with a saved choice
winning), every GitHub link goes to the one repository, the footer and the docs
rail offer a prefilled issue form, the structured data parses, and `/llms.txt`
lists every component with a link that answers. The links point at a repository
that must be public for visitors to open them.

### Accessibility review boundary

The UI smoke fails on every serious or critical axe violation and on any
moderate violation that has not been explicitly classified. The two reviewed
moderate cases are Deque's `region` best-practice warnings for content that
Radix portals append to `document.body`: the transient tooltip text, and the
open menu, which axe does not exempt the way it exempts portaled dialogs. The
tooltip's keyboard behavior, accessible description ownership and visible
portal, and the menu's focus entry, dismissal and focus return, are asserted
independently. Adding a landmark to either would misrepresent its semantics, so
those exact portal warnings are recorded as reviewed and non-blocking; any
different moderate finding fails the gate.

## Development diagnostics gate

The diagnostics route is development-only. Start a loopback development server
on a separate port, then run its interaction smoke:

```bash
pnpm exec next dev -H 127.0.0.1 -p 3101
pnpm exec node scripts/smoke-liquid-interactions.mjs http://127.0.0.1:3101/diagnostics
```

## Registry catalogs

See [`registry.json`](../registry.json) for web items and
[`registry-native.json`](../registry-native.json) for React Native items. Each
item declares its source files, install targets and dependencies. Complete site
templates are offered through Glassy UI Pro.
