# Registry installation

Glassy UI is a shadcn-compatible source registry with 37 components. It installs
component source into a consumer app; it is not a Glassy UI runtime package.

## Hosted registry

Initialize shadcn in a React 19+ and Tailwind CSS 4 consumer if it does not
already have a `components.json`:

```bash
pnpm dlx shadcn@4.14.1 init
```

Glassy UI is listed in the
[shadcn registry directory](https://ui.shadcn.com/docs/directory), which maps
`@glassyui` to `https://glassyui.com/r/{name}.json` and `@glassyui-native` to
`https://glassyui.com/r/native/{name}.json`. The CLI resolves both with no
`registries` mapping, and saves the mapping into `components.json` on the first
install. A mapping already in `components.json` takes precedence over the
directory.

Add the component you need:

```bash
pnpm dlx shadcn@4.14.1 add @glassyui/glass-button
```

Keep `tailwind.cssVariables` set to `true`, as `shadcn init` does by default.
With it off, the CLI maps every string literal in installed files through its
Tailwind colour mapping, which drops repeated space-separated tokens: an SVG
`viewBox="0 0 20 20"` becomes `"0 20"`.

The shadcn CLI follows `@glassyui/*` registry dependencies and installs the
required package dependencies. The transitive `glass-provider` module imports
the shared `liquid.css`, so a registry install does not require a separate
stylesheet copy or a provider wrapper just to render.

Set `data-lg-theme="light"` on the app's root element for a light background, or
`data-lg-theme="dark"` for a dark background. Update the attribute when the app
changes theme so glass labels use the matching colours.

Wrap an app area in `GlassProvider` only when it needs synchronized theme,
quality, motion, or transparency preferences; match `defaultTheme` to the app's
initial theme. Mount `LiquidFilters` only for legacy CSS that explicitly
references `url(#lg-liquid-refraction)`; supplied-background refraction creates
its own per-surface SVG filter.

The installed `liquid.css` keeps its defaults in the `components` cascade layer,
so a `className` on any Glassy UI component overrides them. Tailwind 3 is not
supported: its unlayered preflight would override the library. See
[Customizing](liquid-components.md#customizing).

## Local registry development

The editable catalog is `registry.json`, source files live under
`registry/glassyui`, and generated install payloads live under `public/r`. Start
the docs app before installing unpublished local changes:

```bash
pnpm exec next dev -H 127.0.0.1 -p 3000
```

Temporarily map `@glassyui` in `components.json` to
`http://127.0.0.1:3000/r/{name}.json`, using the actual loopback port of the
local server; the mapping overrides the directory.

## Local verification

Run the static registry checks without a server:

```bash
pnpm check:registry
pnpm registry:check-generated
pnpm check:native-registry
```

To verify the generated routes and a clean consumer install, build and serve the
site locally on port 3100, then run:

```bash
pnpm smoke:registry-routes http://127.0.0.1:3100
pnpm smoke:registry-install http://127.0.0.1:3100
```

The install smoke uses the repository's pinned `shadcn@4.14.1`. It reads the
actual Scene, Lens and Dock Usage snippets from the running documentation pages
and writes them into a fresh temporary consumer. It then installs
`@glassyui/glass-dialog` alone and checks the exact packages and files that
adds, installs the remaining library, and builds/renders those examples.
Screenshots and a JSON report are retained under
`.artifacts/prelaunch/registry-install` (or the optional third command
argument). Chromium, Firefox and WebKit retain the existing consumer-override,
preference-guard and dialog/menu/sheet checks.

## Registry items

- `glass-provider`
- `glass-surface`
- `glass-button`
- `glass-panel`
- `glass-header`
- `glass-input`
- `glass-tabs`
- `glass-dialog`
- `glass-popover`
- `glass-tooltip`
- `glass-toast`
- `glass-accordion`
- `glass-switch`
- `glass-slider`
- `glass-segmented-control`
- `glass-badge`
- `glass-dock`
- `glass-sheet`
- `glass-menu`
- `glass-lens`
- `glass-scene`
- `glass-logo-reveal`
- `glass-laptop`
- `glass-phone-duo`
- `glass-checkbox`
- `glass-radio-group`
- `glass-textarea`
- `glass-select`
- `glass-progress`
- `glass-spinner`
- `glass-skeleton`
- `glass-alert`
- `glass-avatar`
- `glass-kbd`
- `glass-scroll-area`
- `glass-command`
- `glass-breadcrumb`
- `glass-pagination`

Package and registry dependencies are declared per item in `registry.json`;
install only the items the consumer uses.

## Theme for stock shadcn/ui

`glassy-theme` is a `registry:theme` item with no files or dependencies. It
restyles the stock shadcn/ui components an app already has:

```bash
pnpm dlx shadcn@4.14.1 add @glassyui/glassy-theme
```

The CLI writes its `--glassy-*` tokens into `:root` and `.dark`, its easing
curves into `@theme inline`, and its rules into one
`@layer components { @layer glassy { … } }` block of the app's Tailwind CSS
file. The CLI never deletes rules, so upgrading means deleting that block and
those tokens before installing again.

Its source is `registry/glassyui/themes/glassy-theme.css`, with the rim lens in
`glassy-lens.svg` beside it. The build writes that lens from Glassy UI's own
lens profile (`scripts/shadcn-theme-lens.mjs`) and inlines each filter as a
data: URL, so the item stays CSS only. Rebuild the item with `pnpm theme:build`,
and prove it with `pnpm check:shadcn-theme`, which installs it into the stock
fixtures in `fixtures/shadcn-theme-consumer`.

## Drop-in components for stock shadcn/ui

`glassy-ui-new-york` (Radix) and `glassy-ui-base-nova` (Base UI) write Glassy UI
versions of sixteen shadcn/ui components over the app's own files: button, card,
alert, badge, input, textarea, select, checkbox, radio group, switch, slider,
tabs, dropdown menu, popover, dialog and sheet.

```bash
pnpm dlx shadcn@4.14.1 add @glassyui/glassy-ui-new-york --overwrite
```

Each drop-in is shadcn/ui's stock file for that style, with the same exports,
props, data attributes and directive, so imports stay as they are, and with
Glassy UI's sizes in its classes. The button, card, alert, tabs list and floats
run Glassy UI's engine from `components/glassyui/` on their glass: in Chromium,
the components' lens measured for that element. The sets' CSS draws Glassy UI's
look, with the palette's `--primary` in place of Glassy UI's blue, and replaces
the CSS-only theme: remove the theme's `@layer glassy` block and `--glassy-*`
tokens before installing a set. `--overwrite` replaces the app's copies of those
files, edits included, so commit first. The New York item declares `radix-ui`,
which the CLI adds for apps that still use individual Radix packages. Neither
item needs a `registries` mapping or declares registry dependencies. Their
sources are in `registry/glassyui-shadcn`; `pnpm theme:build` writes them and
`pnpm check:shadcn-dropins` proves them on the same fixtures.

## Expo registry

`registry-native.json` publishes React Native versions of the components to
`public/r/native` under the `@glassyui-native` namespace. `shadcn init` does not
set up Expo apps, so an Expo consumer writes its own `components.json`; see
[`fixtures/expo-consumer/components.json`](../fixtures/expo-consumer/components.json)
for a minimal one. The directory resolves the hosted payloads; map the namespace
only to test loopback payloads.

Match the `@/` imports in `tsconfig.json`: retain an existing mapping or set
`"paths": { "@/*": ["./*"] }` under `compilerOptions` for an app-root install.
Use `./src/*` for a `src` install.

```bash
npx shadcn@4.14.1 add @glassyui-native/glass-button
npx expo install --fix
```

Keep `tailwind.cssVariables` set to `true` here too; with it off, the CLI turns
colour strings such as `rgba(255, 255, 255, 0.12)` into `rgba(255, 255, 0.12)`.

The pinned CLI detects Expo and installs packages through `npx expo install`,
but it passes them after `--`, which skips Expo's SDK version matching; `--fix`
aligns them. Files land in `components/glassyui`, or `src/components/glassyui`
in apps that keep their code in `src`.

Verify the Expo catalogue with `pnpm check:native-registry`. Against a running
production build, `pnpm smoke:expo-consumer http://127.0.0.1:3100` installs
every item into a clean copy of the Expo fixture, then type-checks and bundles
it for iOS, Android and the web.

The SDK 57 app-only items are `glass-picker`, `glass-swipe-row` and
`glass-card-stack`. The picker uses SwiftUI on iOS, Compose on Android and a
labelled select on the web. Gesture items declare Gesture Handler, Reanimated,
Worklets and Haptics. Wrap the app in `GestureHandlerRootView` above
`GlassProvider`; wrap a native Modal's contents too. Rebuild a development build
after adding native packages. Every item has its own component page and a
running, type-checked usage example in the Expo fixture.

Run `pnpm check:native-interactions <expo-web-url> <artifact-directory>` to
exercise picker selection, swipe actions, card gestures, navigation bounds and
preferences in Chrome. The script saves screenshots, a trace and a hashed
result. Browser checks establish Expo web behavior; native materials and haptics
require native runtime checks.
