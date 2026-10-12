# Registry components

The local registry exposes 36 source-copy component items. Install any item
after configuring the local `@glassyui` namespace:

```bash
pnpm dlx shadcn@4.14.1 add @glassyui/<item-name>
```

The file lists below are each item's direct files from `registry.json`.
Namespaced registry dependencies are installed transitively. `liquid-filters`
and the shared CSS ship through `glass-provider`; neither is a standalone
component item.

## Foundation

### `glass-provider`

Files:

- `registry/glassyui/glass-provider.tsx`
- `registry/glassyui/liquid-filters.tsx`
- `registry/glassyui/lib/preferences.ts`
- `registry/glassyui/styles/liquid.css`

Package dependencies: none.

Registry dependencies: none.

Purpose: app-level material preferences, reduced-motion/transparency attributes,
legacy shared SVG filter definitions, and automatic shared CSS activation for
registry installs.

### `glass-surface`

Files:

- `registry/glassyui/glass-surface.tsx`
- `registry/glassyui/lib/merge-refs.ts`
- `registry/glassyui/lib/refraction-map.ts`
- `registry/glassyui/lib/slab-optics.ts`
- `registry/glassyui/lib/use-refraction-filter.tsx`
- `registry/glassyui/lib/scene-context.ts`

Package dependencies: `clsx`.

Registry dependencies: `@glassyui/glass-provider`.

Purpose: low-level glass surface with a hover state, a Chromium edge lens, and
opt-in refraction of a supplied decorative background layer. The layer can use
local surface coordinates or stay aligned to viewport coordinates while the
surface scrolls. Inside a `GlassScene` the scene draws it.

### `glass-panel`

Files:

- `registry/glassyui/glass-panel.tsx`

Package dependencies: `clsx`.

Registry dependencies: `@glassyui/glass-surface`.

Purpose: composed panel/card/pill surface for app layouts.

## Controls

### `glass-button`

Files:

- `registry/glassyui/glass-button.tsx`
- `registry/glassyui/lib/merge-refs.ts`
- `registry/glassyui/lib/refraction-map.ts`
- `registry/glassyui/lib/slab-optics.ts`
- `registry/glassyui/lib/use-refraction-filter.tsx`
- `registry/glassyui/lib/scene-context.ts`

Package dependencies: `@radix-ui/react-slot`, `clsx`.

Registry dependencies: `@glassyui/glass-provider`.

Purpose: practical action primitive with press state, keyboard state, local
light, glass layers, the Chromium edge lens, four variants, and `asChild` for
links. Inside a `GlassScene` the scene draws it.

### `glass-input`

Files:

- `registry/glassyui/glass-input.tsx`

Package dependencies: `clsx`.

Registry dependencies: `@glassyui/glass-provider`.

Purpose: text input with label and hint affordances.

### `glass-tabs`

Files:

- `registry/glassyui/glass-tabs.tsx`
- `registry/glassyui/lib/liquid-motion.ts`

Package dependencies: `@radix-ui/react-tabs`, `clsx`.

Registry dependencies: `@glassyui/glass-panel`.

Purpose: tabbed navigation and content panels, with a glass indicator that
stretches toward the next tab.

### `glass-switch`

Files:

- `registry/glassyui/glass-switch.tsx`
- `registry/glassyui/lib/merge-refs.ts`
- `registry/glassyui/lib/liquid-motion.ts`

Package dependencies: `@radix-ui/react-switch`, `clsx`.

Registry dependencies: `@glassyui/glass-provider`.

Purpose: on/off switch whose thumb turns to clear glass and stretches while it
travels.

### `glass-slider`

Files:

- `registry/glassyui/glass-slider.tsx`
- `registry/glassyui/lib/merge-refs.ts`
- `registry/glassyui/lib/liquid-motion.ts`

Package dependencies: `@radix-ui/react-slider`, `clsx`.

Registry dependencies: `@glassyui/glass-provider`.

Purpose: single-value or range slider with glass thumbs that stretch with drag
speed, and per-thumb names.

### `glass-segmented-control`

Files:

- `registry/glassyui/glass-segmented-control.tsx`
- `registry/glassyui/lib/merge-refs.ts`
- `registry/glassyui/lib/liquid-motion.ts`

Package dependencies: `@radix-ui/react-radio-group`, `clsx`.

Registry dependencies: `@glassyui/glass-provider`, `@glassyui/glass-panel`.

Purpose: single choice among two to six options, with a CSS-positioned glass
indicator that is correct from the first server render, stretches toward the
next option and can be dragged.

### `glass-checkbox`

Files:

- `registry/glassyui/glass-checkbox.tsx`

Package dependencies: `@radix-ui/react-checkbox`, `clsx`.

Registry dependencies: `@glassyui/glass-provider`.

Purpose: checkbox whose mark draws itself in and out, with an indeterminate
state, an optional label and a description.

### `glass-radio-group`

Files:

- `registry/glassyui/glass-radio-group.tsx`

Package dependencies: `@radix-ui/react-radio-group`, `clsx`.

Registry dependencies: `@glassyui/glass-provider`.

Purpose: options where exactly one is chosen; the dot springs in and shrinks
straight out.

### `glass-textarea`

Files:

- `registry/glassyui/glass-textarea.tsx`
- `registry/glassyui/lib/merge-refs.ts`

Package dependencies: `clsx`.

Registry dependencies: `@glassyui/glass-provider`.

Purpose: recessed glass field for longer text, with a label, a hint and an
`autoResize` mode that grows up to `maxRows`.

### `glass-select`

Files:

- `registry/glassyui/glass-select.tsx`

Package dependencies: `@radix-ui/react-select`, `clsx`.

Registry dependencies: `@glassyui/glass-panel`.

Purpose: recessed trigger that opens a slab of glass, with groups, labels and
separators.

## Overlays

### `glass-dialog`

Files:

- `registry/glassyui/glass-dialog.tsx`

Package dependencies: `@radix-ui/react-dialog`, `clsx`.

Registry dependencies: `@glassyui/glass-panel`.

Purpose: modal dialog content using raised glass panels.

### `glass-popover`

Files:

- `registry/glassyui/glass-popover.tsx`

Package dependencies: `@radix-ui/react-popover`, `clsx`.

Registry dependencies: `@glassyui/glass-panel`.

Purpose: anchored floating content.

### `glass-tooltip`

Files:

- `registry/glassyui/glass-tooltip.tsx`

Package dependencies: `@radix-ui/react-tooltip`, `clsx`.

Registry dependencies: `@glassyui/glass-panel`.

Purpose: compact contextual help.

### `glass-sheet`

Files:

- `registry/glassyui/glass-sheet.tsx`

Package dependencies: `@radix-ui/react-dialog`, `clsx`.

Registry dependencies: `@glassyui/glass-panel`.

Purpose: modal glass panel that slides in from an edge; bottom sheets drag down
to dismiss.

### `glass-menu`

Files:

- `registry/glassyui/glass-menu.tsx`

Package dependencies: `@radix-ui/react-dropdown-menu`, `clsx`.

Registry dependencies: `@glassyui/glass-panel`.

Purpose: dropdown menu, non-modal by default, with shortcuts, checkbox and radio
items, and submenus.

### `glass-command`

Files:

- `registry/glassyui/glass-command.tsx`

Package dependencies: `@radix-ui/react-dialog`, `clsx`, `cmdk`.

Registry dependencies: `@glassyui/glass-panel`.

Purpose: searchable command list that filters as you type, alone or in a
launcher dialog near the top of the page.

## Feedback and disclosure

### `glass-toast`

Files:

- `registry/glassyui/glass-toast.tsx`

Package dependencies: `@radix-ui/react-toast`, `clsx`.

Registry dependencies: `@glassyui/glass-panel`.

Purpose: transient notification surface with a dismiss button, an action pill
and swipe to dismiss.

### `glass-accordion`

Files:

- `registry/glassyui/glass-accordion.tsx`

Package dependencies: `@radix-ui/react-accordion`, `clsx`.

Registry dependencies: `@glassyui/glass-panel`.

Purpose: collapsible content sections.

### `glass-badge`

Files:

- `registry/glassyui/glass-badge.tsx`

Package dependencies: `clsx`.

Registry dependencies: `@glassyui/glass-provider`.

Purpose: tinted glass label for status, counts and categories, with text held to
4.5:1 contrast in every tone.

### `glass-progress`

Files:

- `registry/glassyui/glass-progress.tsx`

Package dependencies: `clsx`.

Registry dependencies: `@glassyui/glass-provider`.

Purpose: glass track with a fill that slides to its value, or holds a short fill
when the length is unknown.

### `glass-spinner`

Files:

- `registry/glassyui/glass-spinner.tsx`

Package dependencies: `clsx`.

Registry dependencies: `@glassyui/glass-provider`.

Purpose: ring with a fading tail for short waits; it takes the surrounding text
colour.

### `glass-skeleton`

Files:

- `registry/glassyui/glass-skeleton.tsx`

Package dependencies: `clsx`.

Registry dependencies: `@glassyui/glass-provider`.

Purpose: quiet glass placeholder with a slow sheen, as a block, a circle or a
stack of text lines.

### `glass-alert`

Files:

- `registry/glassyui/glass-alert.tsx`

Package dependencies: `clsx`.

Registry dependencies: `@glassyui/glass-provider`.

Purpose: short message in tinted glass with four tones and an optional dismiss,
with text held to 4.5:1 contrast in every tone.

## Navigation and effects

### `glass-header`

Files:

- `registry/glassyui/glass-header.tsx`
- `registry/glassyui/lib/merge-refs.ts`
- `registry/glassyui/lib/liquid-motion.ts`
- `registry/glassyui/styles/header.css`

Package dependencies: `clsx`.

Registry dependencies: `@glassyui/glass-surface`.

Purpose: a floating glass capsule with a brand, navigation links and actions.
The header is 56px tall and up to 920px wide, inset 14px from the top. Links
move into a keyboard-accessible Menu disclosure when the capsule is narrower
than 780px. Escape returns focus to Menu, and choosing a link closes the
disclosure. The capsule is lightly frosted glass that bends the page at its rim;
the `--lg-header-*` tokens tint and dim it so links keep 4.5:1 over any
backdrop. `position="static"` embeds the header in a layout or preview. Both
placements follow the shared theme, glass mode, thickness and reduced
transparency preferences. `condenseOnScroll` opens a fixed header out across the
top of the page without glass, up to 1200px wide, and springs it into the
capsule once the page scrolls 8px; back at the top it opens again. The glass
forms and thins on its own layers, the lens waits until the capsule settles, and
reduced motion switches shape without moving. Before hydration the scroll
position alone picks the shape where the browser has scroll-driven animations.

### `glass-dock`

Files:

- `registry/glassyui/glass-dock.tsx`

Package dependencies: `@radix-ui/react-slot`, `clsx`.

Registry dependencies: `@glassyui/glass-surface`.

Purpose: row of app icons on a glass shelf that name themselves on hover.

### `glass-avatar`

Files:

- `registry/glassyui/glass-avatar.tsx`

Package dependencies: `@radix-ui/react-avatar`, `clsx`.

Registry dependencies: `@glassyui/glass-provider`.

Purpose: round photo that falls back to coloured initials, with a presence dot
and stacked groups; initials keep 4.5:1 contrast on every colour.

### `glass-kbd`

Files:

- `registry/glassyui/glass-kbd.tsx`

Package dependencies: `clsx`.

Registry dependencies: `@glassyui/glass-provider`.

Purpose: keycap for shortcuts in menus, hints and docs.

### `glass-breadcrumb`

Files:

- `registry/glassyui/glass-breadcrumb.tsx`

Package dependencies: `@radix-ui/react-slot`, `clsx`.

Registry dependencies: `@glassyui/glass-provider`.

Purpose: the trail to the current page, with router-friendly links and an
ellipsis button that can open a menu of folded steps.

### `glass-pagination`

Files:

- `registry/glassyui/glass-pagination.tsx`

Package dependencies: `clsx`.

Registry dependencies: `@glassyui/glass-provider`.

Purpose: numbered pages with previous and next, folding long runs into an
ellipsis.

### `glass-lens`

Files:

- `registry/glassyui/glass-lens.tsx`

Package dependencies: `clsx`.

Registry dependencies: `@glassyui/glass-surface`.

Purpose: draggable, keyboard-movable magnifier whose rim bends the content
beneath it in every engine.

### `glass-scene`

Files:

- `registry/glassyui/glass-scene.tsx`
- `registry/glassyui/lib/merge-refs.ts`
- `registry/glassyui/lib/scene-context.ts`
- `registry/glassyui/lib/scene-renderer.ts`
- `registry/glassyui/lib/liquid-motion.ts`
- `registry/glassyui/lib/slab-optics.ts`

Package dependencies: `clsx`.

Registry dependencies: `@glassyui/glass-provider`.

Purpose: draws the surfaces, panels, buttons and drops inside it as thick
bevelled glass that bends and splits a backdrop image and melts together, with
WebGL2. Without it, and under reduced transparency or increased contrast, every
piece keeps its CSS glass.

## Mockups

### `glass-laptop`

Files:

- `registry/glassyui/glass-laptop.tsx`
- `registry/glassyui/styles/laptop.css`

Package dependencies: `clsx`.

Registry dependencies: none.

Purpose: a laptop mockup in CSS 3D, with geometry expressed in millimetre units
and no images or WebGL, whose screen shows its children. The children are laid
out at a chosen resolution (1728 by default) and scaled to fit. Changing `open`
swings the lid and moves the view between the open machine facing you and the
closed case seen from above; the screen lights only once both have come to rest.
Reduced motion skips the movement and reduced transparency removes the
reflection.

### `glass-phone-duo`

Files:

- `registry/glassyui/glass-phone-duo.tsx`
- `registry/glassyui/lib/phone-duo-renderer.ts`
- `registry/glassyui/styles/phone-duo.css`

Package dependencies: `clsx`.

Registry dependencies: none.

Purpose: a dimensioned folding glass phone with one continuous inner OLED and an
outer display. `screenSrc` supplies a landscape screenshot (2670:1878),
`coverSrc` a portrait screenshot (1398:2034). `open` animates the hinge; `angle`
poses it directly from 0 to 180 degrees. `view="back"` reveals the horizontal
rear camera housing. The case comes in `night-sky` or `star-white`.

Body dimensions follow
[Apple’s specifications](https://www.apple.com/iphone-duo/specs/): 164.6 × 117.8
× 5.2 mm open and 84.1 × 117.8 × 11.3 mm closed. Display rectangles are inferred
from the specified diagonals and pixel ratios. Corner radii and small hardware
details are approximated from its official renders.

Screen content stays on a flat plane while the pane lifts, blurs and dims,
matching the website intro. Only the top and bottom bezel contain hinge joints;
the screen has no crease. The smooth frame uses multisample antialiasing and
supersampling, with space around every pose.

Both displays share one accessible description. Reduced motion skips folding and
view rotation; reduced transparency removes screen reflections. WebGL 2 is
required. Supply same-origin or CORS-enabled images. The registry contains its
renderer, with no graphics package, device images or demo captures.

## Expo-only interactions

These SDK 57 components ship from `registry/glassyui-native` through
`@glassyui-native`, with usage examples in `fixtures/expo-consumer/usage`:

- `glass-picker`: a labelled SwiftUI picker on iOS, Compose dropdown on Android
  and browser select on the web, set on a GlassSurface. It declares `@expo/ui`
  and ships the platform-specific picker implementations.
- `glass-swipe-row`: swipe to reveal explicit actions, with a labelled action
  button for keyboard access. It declares Gesture Handler, Reanimated, Worklets
  and Haptics, plus the shared selection-haptic helper.
- `glass-card-stack`: direct horizontal drag and velocity-aware spring settling,
  with controlled selection and Previous/Next buttons. It declares the same
  gesture packages and installs GlassButton too.

Gesture components need `GestureHandlerRootView`. Every component follows the
glass provider's appearance, Reduce Motion and Reduce Transparency preferences.

## Deferred

These are outside v0.1 and do not belong to the current registry:

- data table, calendar, combobox, menu bar, navigation menu
- the site's desk and window demos and the development diagnostics tools
