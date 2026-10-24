# Component installation design

Install from each component. The home hero sends people to the components; each
component page shows the real thing first, then how to install it, with the
command or the files for the reader's platform and package manager.

The interactive artifact is
[`component-installation.html`](component-installation.html). Open it in a
browser: it runs offline, uses Glass Button's real data and demonstrates the
layout and local interaction states. CSS stands in for glass there, so it shows
layout and states, not the production material. Persistence and asynchronous
source loading below are implementation requirements rather than capabilities of
the standalone mock.

## Decision summary

| Area            | Decision                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------- |
| Home hero       | Browse components, then a secondary Star on GitHub button with a star icon. No install chip.  |
| Component page  | Header, Preview, Installation, Usage, Examples, API, Notes. Nothing to install above Preview. |
| Install method  | CLI or Manual, as tabs at the top of Installation. CLI is the default.                        |
| Package manager | npm, pnpm, yarn or bun in each command's header. npm by default, shared, remembered.          |
| Platform        | The existing React and React Native switch in the page header, unchanged.                     |
| Command         | `shadcn@4.14.1` with the item's `@glassyui` name, resolved by the shadcn registry directory.  |
| Expo            | The add command is followed by `npx expo install --fix` in every package-manager choice.      |
| Manual          | Packages, then every file in the closure, grouped by the item that ships it.                  |

## Scope

In scope:

- The home hero's actions.
- The component page header and its Installation section, for components with
  and without a React Native version, and for Expo-only component pages.
- Package-manager choice for every install command on component pages, including
  Usage's example install commands.

Out of scope:

- The keynote, the desk, the hero's announcement, title and lead.
- Usage, Examples, API and Notes content.
- A global installer, an npm package or a new CLI. Installation belongs to each
  component.
- The payload generator. This design depends on it (see the prerequisite) but
  does not specify it.
- Other pages that still show install commands; see
  [Integration decisions](#integration-decisions).

## Prerequisite: self-contained payloads

**The URL commands below are proposed behaviour.** They work only after the
publication change the execution plan owns:

- `registry.json` and `registry-native.json` keep their namespaced authoring
  graphs (`@glassyui/glass-provider`, `@glassyui-native/glass-surface`).
- Every published item at `https://glassyui.com/r/<item>.json` and
  `https://glassyui.com/r/native/<item>.json` becomes self-contained: its
  `files` hold the item's whole transitive closure, de-duplicated by target; its
  `dependencies` hold the union of the closure's packages; it carries no
  internal `registryDependencies`.

Today `public/r/glass-button.json` lists `@glassyui/glass-provider` and only its
own six files. Without a `registries` mapping the pinned CLI stops with
`Unknown registry "@glassyui"` (proven by inspection of the `shadcn@4.14.1`
source in `node_modules`; not reproduced in this pass). Do not ship the URL
commands before the self-contained payloads, or every copied command fails.

The execution plan records the parity evidence: a bounded web install of the
self-contained Glass Button payload matched the namespaced baseline, with the
same ten files and identical bytes, and a native dry run resolved eight files
plus `expo-blur` and `expo-glass-effect`. A namespaced install through an
existing mapping keeps working, because the mapping resolves to the same
self-contained URL.

## Home hero

Order inside `.home-hero`, top to bottom:

1. Announcement link, unchanged: "New · Glassy UI for React Native apps ›",
   shortened to "Now for React Native" at 560 px and below.
2. Title, unchanged: "Glass without effort."
3. Lead, unchanged: "Glassy UI brings {componentDocs.length} free React glass
   components to your app, with React Native versions for iOS and Android.
   Install with shadcn. Own the code."
4. `.home-actions` holds the prominent `GlassButton` link "Browse components" to
   `/components`, followed on its right by the neutral `GlassButton` link "Star
   on GitHub" to the existing public repository, both size `lg`. The GitHub link
   is `GithubStarButton`, led by one outline star: an 18 px glyph drawn at the
   label's stroke weight, with no GitHub mark, count or remote request. The
   star's side takes 20 px padding to the label side's 24 px. At 440 px and
   below the two actions stack, Browse components on top, at the wider one's
   width.
5. `KeynoteReplay`, unchanged.

Remove the "Get started ›" link and the `CopyChip` with `INSTALL_COMMAND` from
the hero. Keep `.home-actions` (its margin and centring) so the button keeps its
place.

Replay intro is absolutely positioned in the hero's bottom padding,
`clamp(40px, 5vh, 56px)`, under the last line, so it now sits under the button
without a style change. It still shows only while `html[data-keynote]` is set
and the intro is not playing; reduced motion still hides it with the keynote.

Removing the chip shortens the hero by the chip and its 28 px margin. The opener
measures the real page, but its landing must be proved again with
`pnpm check:keynote`.

## Component page

Order:

1. **Header**: eyebrow (category and New tag), name, description, the platform
   switch (components with a React Native version only), then the platform's
   links. React: View source on GitHub, Registry JSON, and Read the guide when
   the component has one. React Native: View source on GitHub, Registry JSON,
   Read the Expo guide. The header's `CopyChip` is removed on both platforms.
2. **Preview**, unchanged, including its React Native note.
3. **Installation**, specified below.
4. **Usage**, unchanged except that example install commands follow the
   package-manager choice.
5. **Examples**, **API** and **Notes**, unchanged and in place.

The platform switch stays in the header because it sets four sections: Preview's
note, Installation, Usage and API's note. Its storage, its `?platform=` link and
its server default stay as they are.

### Installation anatomy

```
Installation                                   h2
For React apps with Tailwind CSS 4.            platform line
[ CLI | Manual ]                               method tabs
┌─────────────────────────────────────────────┐
│ npm  pnpm  yarn  bun                  Copy  │ command header
├─────────────────────────────────────────────┤
│ $ npx shadcn@4.14.1 add https://glassyui.c… │ command
└─────────────────────────────────────────────┘
Adds 10 files to components/glassyui and installs
@radix-ui/react-slot and clsx.                 closure summary
```

| Part           | Detail                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------ |
| Platform line  | 15 px, `--site-text-2`, 10 px under the h2. One sentence per platform (see copy).          |
| Method tabs    | `GlassTabs` with triggers CLI and Manual, `width: min(100%, 220px)`, 16 px under the line. |
| Panels         | 20 px under the tabs. CLI is selected on load.                                             |
| Command block  | The existing code block: 1 px hairline, 16 px radius, `--site-tile`, 44 px header.         |
| Command header | Package-manager radios on the left, Copy on the right. No visible label.                   |
| Command text   | 13 px mono, `$ ` prompt in `--site-text-3`, wrapped lines indented under the command.      |
| Summary        | 14 px, `--site-text-2`, 12 px under the block.                                             |

The method choice is local to the page view: CLI on every load, not remembered,
and kept when the platform changes.

### Copy

React:

| Place         | Copy                                                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform line | For React apps with Tailwind CSS 4.                                                                                                                 |
| CLI summary   | Adds {fileCount} files to components/glassyui and installs {packages}.                                                                              |
| Manual step 1 | Install the packages                                                                                                                                |
| Manual step 2 | Add the files to components/glassyui                                                                                                                |
| Step 2 helper | Keep the lib and styles folders, since the files import each other by relative path. If your `@/` alias points at src, use src/components/glassyui. |
| CSS file note | Imported by glass-provider.tsx (beside `styles/liquid.css`)                                                                                         |

React Native:

| Place           | Copy                                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform line   | For Expo SDK {floor} or later.                                                                                                                        |
| Before command  | Add a `components.json` to your app first, as the Expo guide shows.                                                                                   |
| CLI summary     | Adds {fileCount} files to components/glassyui, then matches {packages} to your Expo SDK. Rebuild your development build after adding native packages. |
| Packages header | Expo picks the versions for your SDK                                                                                                                  |
| Step 2 helper   | Keep the lib folder, since the files import each other by relative path. If your `@/` alias points at src, use src/components/glassyui.               |
| After the files | Then rebuild your development build.                                                                                                                  |

`{packages}` joins names with commas and a final "and". A closure without
packages drops the package clause and, on React Native, both rebuild sentences:
"Adds 4 files to components/glassyui." `{floor}` is 55 for the shared controls
and 57 for the Expo-only items (picker, swipe row, card stack), as the Expo
guide says. The "Shared with other components" label marks every group other
than the page's own item. The Expo guide's "Expo Go already includes these
packages" holds for Glass Button's packages, not for every closure, so the
section does not repeat it.

Each sentence earns its place: the platform lines name the supported setup, the
Expo line prevents running the CLI in an app without `components.json`, and the
rebuild line prevents a missing-native-module crash. Add nothing else.

## Commands

One builder produces every install command. Inputs: platform, package manager
and item names. Constants: `https://glassyui.com` from `SITE_URL` and the
`shadcn@4.14.1` pin.

| Manager | Runner       | Add packages  |
| ------- | ------------ | ------------- |
| npm     | `npx`        | `npm install` |
| pnpm    | `pnpm dlx`   | `pnpm add`    |
| yarn    | `yarn dlx`   | `yarn add`    |
| bun     | `bunx --bun` | `bun add`     |

The runners repeat the Getting Started page's existing advice ("swap `pnpm dlx`
for `npx`, `yarn dlx` or `bunx --bun`"). The pinned CLI's own runner helper maps
pnpm to `pnpm dlx`, bun to `bunx` and everything else to `npx`; the site's
existing choice is kept for consistency.

Formulas:

- React: `{runner} shadcn@4.14.1 add @glassyui/{item}`
- React Native:
  `{runner} shadcn@4.14.1 add @glassyui-native/{item} && npx expo install --fix`
- Several items: one name per item, separated by spaces, in the order the usage
  example imports them. The native form ends with one
  `&& npx expo install --fix`.
- React packages: `{add} {packages}`, in closure order.
- React Native packages: `npx expo install {packages}`, the same in every tab.

`npx expo install` runs the app's own Expo CLI, which resolves each package to
the version its SDK expects; no version is written on the page. `--fix` follows
the add command because the pinned CLI installs Expo packages after `--`, which
skips that matching. `&&` runs it only after a successful add.

Glass Button, every state:

| State         | Text                                                                                   |
| ------------- | -------------------------------------------------------------------------------------- |
| React, npm    | `npx shadcn@4.14.1 add @glassyui/glass-button`                                         |
| React, pnpm   | `pnpm dlx shadcn@4.14.1 add @glassyui/glass-button`                                    |
| React, yarn   | `yarn dlx shadcn@4.14.1 add @glassyui/glass-button`                                    |
| React, bun    | `bunx --bun shadcn@4.14.1 add @glassyui/glass-button`                                  |
| Native, npm   | `npx shadcn@4.14.1 add @glassyui-native/glass-button && npx expo install --fix`        |
| Native, pnpm  | `pnpm dlx shadcn@4.14.1 add @glassyui-native/glass-button && npx expo install --fix`   |
| Native, yarn  | `yarn dlx shadcn@4.14.1 add @glassyui-native/glass-button && npx expo install --fix`   |
| Native, bun   | `bunx --bun shadcn@4.14.1 add @glassyui-native/glass-button && npx expo install --fix` |
| Manual React  | `npm install @radix-ui/react-slot clsx` (and `pnpm add`, `yarn add`, `bun add`)        |
| Manual native | `npx expo install expo-blur expo-glass-effect`                                         |

The web CLI needs no separate init step in the common case: with no
`components.json`, the pinned CLI asks to create one before adding (proven by
inspection of its source; the execution plan's install smoke should confirm it).
Expo apps still need the hand-written `components.json` from the Expo guide,
because `shadcn init` does not set up Expo. Never say the CLI sets up Expo.

### Wrapping

A command wraps only at spaces and after each `/` of its URL. Render URL
segments and other words as unbreakable runs and put a `<wbr>` after each slash,
so `--fix`, `shadcn@4.14.1` and `glass-button.json` never split. The prompt
hangs: wrapped lines start under the command, not under `$`. Copying uses the
builder's string, never the rendered text, so the `<wbr>` elements and the
prompt never reach the clipboard.

## Package-manager preference

- One choice, `npm | pnpm | yarn | bun`, shared by every command block on the
  page and across pages. Changing it in any block changes all of them.
- Default `npm`, since `npx` works wherever Node is installed.
- Stored in `localStorage` under `glassy-ui-docs-package-manager`, following the
  platform switch's pattern: the server renders npm, the browser then shows the
  remembered choice through `useSyncExternalStore`. A storage error logs a
  warning, as the platform switch does, and the choice still holds for the page
  view.
- No URL parameter. No detection.
- Blocks whose text does not depend on it, Expo's package command and code
  samples, show no radios.
- The Markdown version of a page uses the npm command.

Follow the existing platform switch's small stored-choice pattern. Expose its
existing platform read hook for the installation panel. Add only the shared
manager state this feature needs; do not introduce a state library or refactor
the platform's URL-override behavior into a generalized preference framework.

## Platform isolation

Each platform's content sits in a `PlatformPane`; the inactive pane is `hidden`.
It leaves the layout, the accessibility tree, find-in-page and the copy path. A
Copy button can copy only what its visible block shows. Changing the platform
keeps the method tab and the package manager. It resets copy feedback and the
active file to the new platform's main file, and aborts or invalidates any
pending source request for the previous platform. Expo-only pages
(`NativeComponentDoc`) use the same Installation section with the React Native
content only and no switch.

## Manual

### What it lists

- **Packages**: the closure's packages, in closure order. React shows the
  package-manager radios; Expo shows `npx expo install …`.
- **Files**: every target in the closure under `components/glassyui/`, grouped
  by the authoring item that ships it, in closure order: the page's own item
  first, then its dependencies, each with its registry title. Paths are shown
  relative to `components/glassyui/`.

Glass Button, React (10 files; `@radix-ui/react-slot`, `clsx`):

| Group                                         | Files                                                                                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Glass Button                                  | `glass-button.tsx`, `lib/merge-refs.ts`, `lib/refraction-map.ts`, `lib/slab-optics.ts`, `lib/use-refraction-filter.tsx`, `lib/scene-context.ts` |
| Glass Provider · Shared with other components | `glass-provider.tsx`, `liquid-filters.tsx`, `lib/preferences.ts`, `styles/liquid.css`                                                           |

Glass Button, React Native (8 files; `expo-blur`, `expo-glass-effect`):

| Group                                         | Files                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Glass Button                                  | `glass-button.tsx`                                                                           |
| Glass Provider · Shared with other components | `glass-provider.tsx`, `lib/preferences.ts`, `lib/tokens.ts`, `lib/use-controllable-state.ts` |
| Glass Surface · Shared with other components  | `glass-surface.tsx`, `glass-backdrop.tsx`, `lib/material.ts`                                 |

Glass Provider is in the closure of 34 of the 37 web components; every native
item includes the native provider and 19 include Glass Surface.

### Styles, provider and aliases

- The files import each other by relative path, so the folder layout is the
  contract: `components/glassyui/`, `lib/` and, on the web, `styles/`.
- `glass-provider.tsx` imports `./styles/liquid.css`, so no global stylesheet
  import is needed; the note beside `styles/liquid.css` says so. Wrapping the
  app in `GlassProvider` stays optional, as the Getting Started page explains.
- Usage imports `@/components/glassyui/<item>`. The step 2 helper tells readers
  whose `@/` alias points at `src` to use `src/components/glassyui`.

### Where the file text comes from

The text comes from the page's own published payload, `/r/<item>.json` or
`/r/native/<item>.json`: after the publication change it holds every file in the
closure as input to the CLI. Shadcn can format source and adapt imports while
installing, so raw payload text is not promised to match installed bytes. Fetch
it from the same origin the first time Manual opens on that platform, cache it
for the page view, and match files by `target`. Do not server-render file text
into the page: the Glass Button closure alone is about 250 KB, mostly
`liquid.css`, and it would ride along on every component page whether or not
anyone opens Manual.

The file list itself (paths and groups) reaches the client as props built from
the authoring graph, so it shows as soon as Manual opens, before the fetch
finishes. Without JavaScript the tabs do not switch, but the CLI command still
shows.

### File states

| State   | What shows                                                                                                  |
| ------- | ----------------------------------------------------------------------------------------------------------- |
| Closed  | Row: chevron, path, optional note, Copy. All rows closed except the page's own main file.                   |
| Open    | The file below its row in a code viewer: `max-height: 360px`, scrolls both ways, focusable, `--site-bg`.    |
| Loading | Copy buttons disabled; an open viewer says "Loading the files…".                                            |
| Failed  | Copy buttons disabled; "Couldn't load the files." with Try again and a link to the payload JSON.            |
| Missing | A target absent from the payload: "This file isn't in the published payload." This is a publication defect. |

`.ts` and `.tsx` files use the existing TSX colouring; CSS shows plain, with no
new grammar.

## Copy feedback

Extend `CopyCodeBlock` rather than adding another copy component:

- Labels stay as they are: Copy, Copying…, Copy again, Try again.
- The copied text is exactly what the block shows, without the prompt.
- When the shown text changes (package manager or platform), the button returns
  to Copy and any failure message clears.
- Success: a small spring pop on the button (none under reduced motion) and the
  live region says "Copied the {manager} install command to the clipboard."
- Failure, when the clipboard API is missing or refuses: select the shown text,
  show "Couldn't copy. The command is selected, so you can copy it yourself."
  between the header and the code, and announce it. File rows say "The file is
  selected". Do not fall back to `document.execCommand`.

## Keyboard and screen readers

| Control         | Semantics                                                                             | Keys                                     |
| --------------- | ------------------------------------------------------------------------------------- | ---------------------------------------- |
| Platform switch | Existing radio group "Platform"                                                       | Tab in, arrows change                    |
| Method tabs     | `tablist` "Installation method", tabs CLI and Manual, panels labelled by their tab    | Arrows, Home, End; automatic activation  |
| Package manager | Radio group "Package manager", one per command block, all bound to the shared choice  | Tab in at the checked one, arrows change |
| Copy            | `button` named by its visible label, `aria-describedby` the command or file it copies | Enter, Space                             |
| File row        | `button` with `aria-expanded` and `aria-controls`, named by the path                  | Enter, Space                             |
| File code       | `region` "{path} source" around a focusable `pre`                                     | Tab to it, arrows scroll                 |
| Results         | Polite status region per block                                                        | —                                        |

The prompt is `aria-hidden` and unselectable. The method panels use `GlassTabs`,
which unmounts the inactive panel. Focus never moves on its own: choosing a
package manager or platform leaves focus where it was. Focus rings use
`--lg-focus-ring`, and the header's 84 px scroll margin keeps focused controls
clear of the fixed header.

## Responsive behaviour

| Width            | Behaviour                                                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1024 px and up   | Existing three-column docs layout; the main column is about 684 px at 1280. The React command fits on one line; the native command wraps after a URL slash or at a space.                               |
| 860–1023 px      | Existing layout without the table of contents.                                                                                                                                                          |
| 859 px and below | One column with 16 px gutters and the Browse docs disclosure.                                                                                                                                           |
| 390 px           | 358 px of content. Header radios (44 px minimum each) and Copy fit in one row. Commands wrap; nothing scrolls sideways except code files inside their viewer. Tabs and switch keep their capped widths. |

At every width the page never scrolls sideways (`scrollWidth <= innerWidth`).
Targets are at least 30 px tall and 44 px wide in command headers, and file rows
are 44 px tall.

## Motion, transparency and contrast

- **Reduced motion** (system or `data-lg-reduce-motion='1'`): tab and switch
  pills jump, the copy pop and chevron turns are dropped, panels swap at once.
  End states are unchanged.
- **Reduced transparency** (system or `data-lg-reduce-transparency='1'`):
  `GlassTabs` and `GlassSegmentedControl` draw their opaque fallbacks. The
  section adds no translucent surface of its own; code blocks are already opaque
  tiles.
- **Forced colours**: the selected package manager, tab and platform show a
  system `Highlight` outline, not only a fill.
- Selection never relies on colour alone: the chosen option also has a fill and
  semibold text.

## Data mapping

| Shown                          | Source                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Name, category, description    | `componentDocContent` in `src/components/docs/component-docs-data.ts`                                                          |
| Hero component count           | `componentDocs.length` (37)                                                                                                    |
| React closure, files, packages | `getRegistryClosure` over `registry.json`, exposed as `installedFiles` and `installedDependencies`, plus the per-item grouping |
| Native closure                 | The same resolver over `registry-native.json` (new; `getNativeUsage` lists imports, not the closure)                           |
| File text                      | The page's own payload in `public/r/` or `public/r/native/`, fetched in Manual                                                 |
| Command URLs                   | `SITE_URL` + `/r/` or `/r/native/` + item name                                                                                 |
| CLI pin                        | `shadcn@4.14.1`, one constant matching `package.json`                                                                          |
| Runners                        | The table above, one constant                                                                                                  |
| Expo SDK floor                 | 55 for shared controls, 57 for Expo-only items; constants shared with the Expo guide and the Expo-only pages' eyebrow          |
| Usage                          | Docs `usage`, launch example source, or the Expo fixture's usage file, as today                                                |

Generate everything from these sources. No install text is written by hand in
page code. The command builder replaces the hand-built strings in
`component-docs-data.ts` (`install`), `launch-example-source.ts` and
`native-usage-source.ts` (`nativeInstallCommand`), and the Markdown output uses
it with npm. File groups and the publication transform use the same authoring
graph. Generated-payload checks and clean-consumer proofs verify their
agreement; sharing a resolver alone does not establish correctness.

## Acceptance criteria

1. At 1280 and 390 px in both themes, `.home-hero .home-actions` holds exactly
   two elements: the prominent Browse components link and secondary Star on
   GitHub button, led by an outline star, to its right (below it at 390 px, at
   the same width). The hero has no `.copy-chip` and no Get started link. The
   announcement, title, lead and Replay intro are unchanged, and
   `pnpm check:keynote` passes.
2. Component pages show Header, Preview, Installation, Usage, Examples, API,
   Notes, with no install command above Preview on either platform.
3. Installation shows CLI selected on load. Arrow keys, Home and End move
   between CLI and Manual and show the matching panel.
4. On Glass Button with no stored choice, the React command reads
   `npx shadcn@4.14.1 add @glassyui/glass-button`. Each package manager produces
   its row of the command table. After Copy, the clipboard holds exactly the
   shown text.
5. On React Native, all four package-manager choices end with
   `&& npx expo install --fix`, and Copy copies the whole line.
6. A choice made in one block shows in every block on the page, survives a
   reload and carries to the next component page.
7. While React Native is active, no React command, file or usage is visible,
   focusable or in the accessibility tree, and the reverse.
8. Manual on React lists the 10 targets in two groups and
   `npm install @radix-ui/react-slot clsx`. On React Native it lists 8 targets
   in three groups and `npx expo install expo-blur expo-glass-effect` with no
   radios.
9. Every Manual file's text hashes equal to the same target's `content` in the
   published payload.
10. With the clipboard refused, Copy shows Try again, the shown text is
    selected, the visible message appears and the live region announces it.
11. At 390 px no state scrolls the page sideways, every command is fully visible
    without sideways scrolling, and `--fix` is never split.
12. Under reduced motion nothing slides or pops; under reduced transparency the
    tabs and switch are opaque.
13. The URL commands ship only together with, or after, the self-contained
    payloads, and the install smoke installs Glass Button from its URL with no
    `registries` mapping.
14. `pnpm lint`, `pnpm build`, `pnpm format:check` on the changed files and an
    updated `pnpm check:platform-switch` pass.

## Integration decisions

These choices are settled for this design. The execution plan owns their source
changes and verification; they are not pending user questions.

1. **Default package manager:** npm. Keep the repository's own pnpm tooling; the
   consumer-facing default is a separate choice.
2. **Yarn runner:** modern Yarn's `yarn dlx`. Yarn Classic is outside that
   recipe's compatibility. Explain this once in setup documentation, without
   adding a warning beside every command.
3. **Installation inventory:** replace the old disclosure with the CLI summary
   and the grouped Manual files from the same source graph.
4. **Manual text:** load the same-origin complete payload on first Manual
   selection. Expose loading, failure, retry and missing-target states.
5. **Examples:** retain them between Usage and API; keep Notes last.
6. **Expo runner:** keep `npx expo install` and `--fix` as specified. Expo
   documents npm, pnpm, Yarn and bun support, with the project's lockfile
   selecting the default package manager. The native consumer smoke still proves
   SDK matching and bundles for the actual fixture. Source:
   [Expo CLI package-manager contract](https://docs.expo.dev/more/expo-cli/#install-package-managers).
7. **Other command surfaces:** replace the lower homepage code walkthrough with
   the three concise discovery steps in the execution plan. Remove the `/mobile`
   hero's arbitrary component chip while preserving its existing Expo setup and
   browsing links. Keep its explicitly labelled Glass Button comparison
   examples, deriving their commands from the shared helper. Getting Started,
   Expo setup, search, the docs share card and Markdown move to the same primary
   URL path; existing namespace mapping remains optional.
8. **Existing checks:** update the named removed-element selectors in
   `check-keynote.mjs`, `check-site-motion.mjs` and `check-platform-switch.mjs`,
   keeping their behavioral assertions.
9. **Multiple items:** require a no-mapping multi-item clean install to prove
   identical shared files do not trigger duplicate writes or overwrite prompts.
   The existing Scene, Lens and Dock consumer examples remain the broader proof.
10. **Payload description:** correct the stale button description in the source
    registry to the existing documentation's description, then regenerate its
    payload and catalogue. This is installation metadata, not a component
    behavior change.

## The artifact

- `component-installation.html` is vanilla HTML, CSS and JavaScript with no
  dependencies and no network requests. A scratch script embedded the data from
  `registry.json`, `registry-native.json`, the Glass Button and Glass Provider
  payloads in `public/r` and `public/r/native`, `component-docs-data.ts`, the
  Expo fixture's usage file and the compact mark in `public/brand`.
- To keep the file small it embeds the first 24 lines of each file, labelled as
  an excerpt; copying a file there copies the excerpt and says so. The page
  shows and copies whole files.
- The bar's Refuse clipboard switch drives the failure state, and the Width,
  Theme, Reduce motion and Reduce transparency switches show the other states.
  Links that would leave the artifact say where they go instead.
- Checked in headless Chrome at 1440 × 900 and in a real 390 × 844 window: every
  state above, keyboard operation, copying, refusal, isolation, wrapping,
  overflow, no network requests and no page errors.
