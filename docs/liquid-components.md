# Liquid components

The reusable source tree exports the components and their shared filters from
`src/components/liquid/index.ts` and uses `src/styles/liquid.css`. This tree is
kept separate from the installable registry source under `registry/glassyui`.

## Provider

`PreferencesProvider` synchronizes theme, quality, reduced-motion,
reduced-transparency and glass thickness preferences with document data
attributes. Components use static defaults when no provider is mounted.

The theme follows the system setting until the visitor chooses one. Pass
`defaultTheme="light"` (or `"dark"`) to decide what a first-time visitor sees
instead: the system setting then no longer matters, and nothing is saved on the
visitor's behalf. A choice made with `setPreferences` is stored and always wins.
Set the same theme in the `<html data-lg-theme>` attribute and in any script
that runs before paint, so the first frame matches.

`thickness` runs from 0.25 to 2, and regular glass is 1. It sets
`--lg-glass-thickness` on the root, which every lens and every `GlassScene`
default follows: a thicker slab has a wider, rounder rim that bends the page
further and splits more colour.

The registry version exports `GlassProvider` (and the `PreferencesProvider`
alias) and imports its delivered `liquid.css` file so registry installs activate
the shared styles through their component graph.

## Surface

`GlassSurface` is the low-level material primitive. It supports `preset`,
`interactive`, `lens`, `refraction`, `refractionBackground`,
`refractionBackgroundSpace`, and `refractionDisplacement` and `thickness`.
`interactive` brightens the surface a touch on hover; glass never follows where
the pointer is.

The material is a CSS frost: a backdrop blur and saturation with a lit rim and
top sheen. `lens` replaces it, where the browser can, with a slab of glass: one
SVG backdrop filter reads the page behind it through a rim that curves down to a
rounded edge, as thick glass does. The page lies flat and frosted across the
top, bends toward the edge, and splits into colour where the rim tilts. It is on
by default for the `control` and `showcase` presets and for dialogs, popovers,
sheets and menus. The lens is a Chromium-only progressive enhancement. WebKit
and Firefox cannot run an SVG filter as a backdrop, so they keep the CSS frost,
as do low quality, reduced transparency, surfaces with generated refraction, and
surfaces over 720,000 px².

The rim follows each corner's own radius, so a pill, a card and a sheet with one
round corner each get their own edge. Shape it with tokens on the element or any
ancestor:

| Token                  | Default                         | Effect                                                                                                                                      |
| ---------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `--lg-glass-thickness` | 1                               | Scales the whole slab: rim width, height and colour split. `thickness` sets it per surface, and the thickness preference sets it site wide. |
| `--lg-lens-depth`      | 1                               | How far the rim bends the page. `0` turns the lens off.                                                                                     |
| `--lg-lens-bevel`      | 0 (the corner radius, up to 36) | Width of the rim in pixels.                                                                                                                 |
| `--lg-lens-thickness`  | 0 (1.4 times the rim)           | Height of the slab in pixels.                                                                                                               |
| `--lg-lens-ior`        | 1.5                             | Refractive index. Window glass is 1.5.                                                                                                      |
| `--lg-lens-dispersion` | 0.16 (0 at medium quality)      | How far the colours split, from 0 to 1. Zero reads the light through one displacement, which is cheaper on the GPU.                         |
| `--lg-lens-blur`       | 6                               | Frost radius of the flat top, in pixels.                                                                                                    |
| `--lg-lens-saturation` | 1.5                             | Saturation of the page behind.                                                                                                              |

Change `thickness` or the preference, not the token, once a surface is mounted:
the lens measures its tokens when the surface resizes or a preference changes.

Dialogs, popovers, sheets and menus are slabs: the page shows through, dimmed by
`--lg-slab-brightness` (less at the rim, `--lg-slab-rim-brightness`) and tinted
by `--lg-slab-tint`, with only `--lg-slab-blur` pixels of frost. The Tinted
material holds a denser tint and a softer top.

Generated refraction is opt-in: the surface distorts the decorative
`refractionBackground` supplied to that surface. It does not sample or bend an
arbitrary page backdrop. The supplied layer must not contain semantic or
interactive content. Use `refractionBackgroundSpace="viewport"` when the surface
should move across a fixed scene; the filtered replica stays aligned to viewport
coordinates as the page or a nested container scrolls. Chromium moves the
replica on its compositor, so it keeps step with every frame of a scroll. WebKit
leaves content on its own compositing layer out of an SVG filter and Firefox
draws this filter in software, so both move the replica from script, a frame
behind the scroll.

Chromium, Firefox and WebKit run the same filter, and a release check confirms
that each one leaves the centre clear and bends the rim. The bend is capped so
the rim never mirrors the scene. Chromium and Firefox sample the bend without
smoothing, so the filter softens only the scene under the rim, by a 0.8 px blur,
to keep it from stair-stepping; the flat centre stays sharp.

## Panel

`GlassPanel` composes `GlassSurface` for panels, cards, and pills. It supports
`variant`, `elevation`, `preset`, `interactive`, `lens`, `thickness`, and the
surface refraction props.

## Button

`GlassButton` supports `variant` (`primary`, `prominent`, `soft` or `ghost`),
`size`, `preset`, `lens` and `asChild`, plus native button props. `prominent` is
blue glass for the main action: it tints whatever lies behind it, caps how
bright that can get so white text keeps 4.5:1 over any backdrop, and shows the
light it lets through along its rim. Every filled variant is a slab resting just
above the page: a pointer lowers it and a press sets it down, so its shadow
draws in under it. A pointer also swings a `prominent` slab's light 50° over to
the top left: the bright line along its rim moves round to the end facing the
light and the glow along its bottom to the far end, while the shadow stays under
the slab. The light eases back when the pointer leaves. Set
`--lg-prominent-tint` (a CSS filter list) or `--lg-prominent-fill` to change the
blue. The lens is on for every variant except `ghost`. `asChild` gives a single
child, such as a link, the button's material; a link cannot be disabled. The
button composes consumer event handlers with its press and focus state.

## Input

`GlassInput` accepts native input props plus optional `label` and `hint` text.
It generates associated IDs and preserves consumer `aria-describedby` values.

## Tabs

The Tabs exports wrap Radix Tabs. `GlassTabsList` uses a pill panel,
`GlassTabsTrigger` keeps Radix keyboard behavior, and `GlassTabsContent` uses a
card panel. A glass indicator moves each edge on its own spring, so it stretches
toward the next tab and settles; under reduced motion it jumps.

## Dialog

The Dialog exports wrap Radix Dialog. `GlassDialogContent` supplies the portal,
overlay, raised panel, named close control, Escape handling, and focus return.

## Popover

The Popover exports wrap Radix Popover and render anchored content in a raised
glass panel.

## Tooltip

The Tooltip exports wrap Radix Tooltip and render contextual help in a raised
glass panel. A tip settles in from the side it opens toward and fades out;
moving to the next trigger skips the entrance.

## Toast

The Toast exports wrap Radix Toast and include the provider, viewport, root,
title, description, close, and action. `GlassToastClose` is a round button that
draws its own ×, and `GlassToastAction` is a pill under the message, such as
Undo. A toast slides in from the side its swipe direction points to (the right
unless the provider's `swipeDirection` says otherwise) and back out when it
closes. Drag it that way to dismiss it: a short drag springs back and a fling
sends it away. A `GlassToastClose` with children is named by its text.

## Accordion

The Accordion exports wrap Radix Accordion. Triggers retain Radix disclosure
semantics and content uses a glass panel that opens and closes like a curtain,
in step with the chevron.

## Switch

`GlassSwitch` wraps Radix Switch in two sizes, `sm` and `md`. The thumb turns to
clear glass and stretches while it travels. Name it with a `<label htmlFor>` or
`aria-label`.

## Slider

`GlassSlider` wraps Radix Slider; pass two values for a range. Radix puts the
slider role on each thumb, so the slider's `aria-label` names a single thumb,
and `thumbLabels` names each thumb of a range in value order. A dragged thumb
stretches with its speed.

## Segmented control

`GlassSegmentedControl` and `GlassSegmentedControlItem` wrap Radix Radio Group
for a single choice among two to six options. CSS positions the glass indicator
from the checked item, so it is correct from the first server render. A change
stretches the indicator toward the new option on springs, and the indicator can
be dragged to an option.

## Badge

`GlassBadge` is a glass capsule with a `tone` (`neutral`, `blue`, `green`,
`orange`, `red` or `purple`) and an optional status `dot`. A release check holds
every tone's text to 4.5:1 contrast over black and white backdrops in both
themes.

## Dock

`GlassDock`, `GlassDockItem` and `GlassDockSeparator` build a row of icons on a
glass shelf. Items default to 48 px and keep their size on hover and keyboard
focus. Each item needs a `label`, which names it and shows on hover or keyboard
focus. `active` shows the running dot and `asChild` renders a link as the item.
A click or tap opens an item without taking keyboard focus; Tab still reaches
every item and draws its focus ring.

Use `--lg-dock-size`, `--lg-dock-gap` and `--lg-dock-pad` to adjust its density.
App artwork fills the item; a glyph can set its own width and height without
changing the hit area. Items paint no fill behind their content, so a bouncing
icon shows the shelf. A glyph dock can add its own hover fill.

## Sheet

The Sheet exports wrap Radix Dialog. `GlassSheetContent` slides in from `side`
(`bottom` by default) on a raised glass panel with a close button named by
`closeLabel`. A bottom sheet drags down to dismiss. A sheet opened from a menu
item has no trigger to return focus to, so pass `onCloseAutoFocus` to focus the
menu button instead.

## Menu

The Menu exports wrap Radix Dropdown Menu: items, checkbox and radio items,
labels, separators, shortcuts and submenus on a glass panel. Menus are non-modal
by default, like the WAI-ARIA menu button, so the page keeps its scroll; pass
`modal` to lock it.

## Checkbox and radio group

`GlassCheckbox` wraps Radix Checkbox and `GlassRadioGroup` with
`GlassRadioGroupItem` wraps Radix Radio Group. Pass `label` and `description`
and the text is linked to the control and clicking it toggles the box; without a
`label`, name the control with `aria-label`. A checkbox takes
`checked="indeterminate"` for a parent of several choices. The tick draws itself
in and back out and the radio dot springs in and shrinks straight out, so
clearing a choice is as smooth as making it.

## Textarea and select

`GlassTextarea` is the Input's recessed field for longer text with a `label` and
a `hint`; `autoResize` grows it with its text up to `maxRows` (8 by default),
then scrolls. The Select exports wrap Radix Select: `GlassSelectTrigger` is the
same recessed field, and `GlassSelectContent` is a slab of glass as wide as the
trigger with groups, labels and separators. Typing jumps to a matching option.

## Progress, spinner and skeleton

`GlassProgress` is a `progressbar` whose fill slides to `value` (of `max`, 100
by default) and sweeps when `value` is left out. `GlassSpinner` is a ring with a
fading tail that takes the surrounding text colour and reads out `label`.
`GlassSkeleton` is a quiet placeholder in three variants (`block`, `circle` and
`text`) that is hidden from assistive technology, so mark the loading region
with `aria-busy`. Reduced motion holds all three still.

## Alert

`GlassAlert` sets a short message in tinted glass with a `tone` (`info`,
`success`, `warning` or `danger`), an optional `title` and an `onDismiss` close
button. Warnings and errors use `role="alert"`; the other tones use
`role="status"`. Dismissing folds the alert to nothing inside its own wrapper,
then calls `onDismiss`: remove the alert there, with a stable `key`. Its padding
and margin fold with it; space from a parent's `gap` cannot, so space stacked
alerts with a margin on the alert. A release check holds every tone's text to
4.5:1 contrast over black and white backdrops in both themes.

## Avatar and Kbd

`GlassAvatar` shows a photo and falls back to the initials of `name` on a colour
chosen from the name, so one person always gets the same colour; every colour
keeps 4.5:1 contrast under the initials. A `status` adds a presence dot.
`GlassAvatarGroup` stacks avatars and shows `+N` past `max`. A dot or a
neighbour cuts the circle away with a mask instead of ringing it, so it works
over any backdrop. `GlassKbd` is a keycap and `GlassKbdGroup` sets a shortcut's
keys side by side.

## Command

`GlassCommand` and its parts wrap cmdk: a search field over a list that filters
as you type, with arrow-key navigation, groups and shortcuts.
`GlassCommandDialog` puts it in a glass dialog near the top of the page; wire ⌘K
or Ctrl+K to its `open` state yourself. The list resizes with its results.
Separators are decorative and hidden from assistive technology, because a
listbox may own only options and groups.

## Breadcrumb and pagination

`GlassBreadcrumb` is a `nav` around an ordered list of `GlassBreadcrumbItem`s.
Links take `asChild` for a router's link, `GlassBreadcrumbPage` marks the
current page, and `GlassBreadcrumbEllipsis` is a button that can open a menu of
folded steps. `GlassPagination` shows numbered pages with previous and next,
folding long runs into an ellipsis; `siblingCount` and `boundaryCount` set how
many pages show around the current page and at each end.

## Lens

`GlassLens` is a draggable magnifier over its children. They render a second
time inside the lens, so give them their own background and no `id`s. The lens
moves by pointer or arrow keys (Shift takes larger steps) and takes `size`,
`zoom`, `defaultPosition` and `label`. The zoomed copy bends into the rim
through an SVG filter that works in every engine; reduced motion and reduced
transparency keep a plain magnifier.

## Scene

`GlassScene` draws the `GlassSurface`, `GlassPanel`, `GlassButton` and
`GlassDrop` elements inside it as one body of thick bevelled glass floating over
its `backdrop` image, with WebGL2. Light refracts through the glass and the air
beneath it, so rims bend the backdrop and split it into a spectrum, turn into
mirrors past the critical angle and reflect the scene as Fresnel's equations
say; tinted glass absorbs more where it is thicker and casts a tinted shadow.
Pieces closer than their merge distance melt together, and a fixed light above
the top left catches the rims. `flow` lets glass that sets `--lg-scene-flow`
ripple, and `optics` tunes `ior`, `thickness`, `bevel`, `dispersion`, `frost`,
`merge` and `specular`. Serve the backdrop from the same origin or with CORS.

`GlassDrop` is a plain piece of glass: size, round and place it with CSS, and
set `merge` to override the scene's merge distance. Outside a scene it shows as
frosted CSS glass.

`data-lg-scene-renderer` on the scene reports what draws the glass: `webgl` once
the canvas has drawn; `css` without WebGL2, after a lost context or with an
unreadable backdrop, with one console warning; and `off` under reduced
transparency, increased contrast or forced colors. Until the canvas draws, and
whenever it is not `webgl`, every piece keeps its CSS glass. The canvas redraws
only while something moves and pauses offscreen and in hidden tabs; reduced
motion holds the flow still.

Each piece hands the canvas its material through `--lg-scene-tint`,
`--lg-scene-frost`, `--lg-scene-merge` and `--lg-scene-ink`. The face dims or
lifts just enough to keep 4.5:1 contrast with `--lg-scene-ink`, the muted text
on surfaces and the label on buttons; set it to `transparent` on glass without
text. Ghost buttons, glass nested in other glass and surfaces with a generated
refraction keep their CSS glass. Glass nested in scene glass drops its shadow
and tints away from the pane's text, so its labels keep that contrast.

## Laptop

`GlassLaptop` draws a laptop mockup in CSS 3D, with geometry expressed in
millimetre units, no images or WebGL, and its children on the screen. It imports
its own scoped `styles/laptop.css`. The children are laid out at `resolution`
CSS pixels wide (1728 by default) and scaled to fit, with the notch over them.
`finish` is `black` or `silver`, and `glare` toggles a faint reflection.

Changing `open` swings the lid and moves the view: open, the machine faces you;
shut, the closed case is seen from above. The screen goes dark before the lid
closes and lights once the lid and the view have come to rest, and the children
render only while it is lit, so they are never laid out on a moving screen.
Anything the children open in a portal, such as a menu, appears on the page at
full size, so mark a screen that is only for show `inert`. Reduced motion skips
the movement and reduced transparency removes the reflection.

## Customizing

Every default lives in `liquid.css` inside the `components` cascade layer, below
Tailwind's `utilities` layer. A `className` such as `rounded-xl`, `p-8` or
`bg-sky-500/20` overrides the library default without `!` or `tailwind-merge`,
whatever order the stylesheets load in. Unlayered CSS outranks both layers. This
requires Tailwind CSS 4: Tailwind 3 emits an unlayered preflight that overrides
every layered library rule.

Each part carries an `lg-*` class for CSS that a `className` cannot reach:

- `lg-glass-surface`, with `lg-panel--panel`, `lg-panel--card`, `lg-panel--pill`
  and `lg-panel--raised` on panels
- `lg-button`, with `lg-button--primary`, `lg-button--prominent`,
  `lg-button--soft`, `lg-button--ghost` and `lg-button--sm`, `lg-button--md`,
  `lg-button--lg`
- `lg-input`
- `lg-tabs-list`, `lg-tabs-trigger`, `lg-tabs-indicator`, `lg-tabs-content`
- `lg-accordion-trigger`, `lg-accordion-content`
- `lg-dialog-overlay`, `lg-dialog-content`
- `lg-popover-content`, `lg-tooltip-content`
- `lg-toast-viewport`, `lg-toast`, `lg-toast-title`, `lg-toast-description`,
  `lg-toast-close`, `lg-toast-action`, and `lg-toast-root` on the glass panel
  inside `GlassToast`
- `lg-switch`, `lg-switch-thumb`
- `lg-slider`, `lg-slider-track`, `lg-slider-range`, `lg-slider-thumb`
- `lg-segmented`, `lg-segmented-item`, `lg-segmented-indicator`
- `lg-badge`, `lg-badge-dot`
- `lg-dock`, `lg-dock-shelf`, `lg-dock-item`, `lg-dock-label`, `lg-dock-dot`,
  `lg-dock-separator`
- `lg-sheet-content`, `lg-sheet-handle`, over the shared `lg-dialog-overlay`
- `lg-menu-content`, `lg-menu-item`, `lg-menu-item--inset`, `lg-menu-label`,
  `lg-menu-separator`, `lg-menu-shortcut`, `lg-menu-indicator`,
  `lg-menu-chevron`
- `lg-lens-stage`, `lg-lens-scene`, `lg-lens`, `lg-lens-view`
- `lg-scene`, `lg-scene-backdrop`, `lg-scene-canvas`, `lg-scene-drop`

Tokens take arbitrary properties. `[--lg-button-fill:rgb(14_165_233/0.4)]` tints
a button and `[--lg-button-fill-hover:…]` sets its hover fill; pair a strong
tint with a readable text color.

Reduce Transparency, increased contrast, forced colors and reduced motion are
`!important` guards, so no `className` can bring transparency back for a user
who turned it off. Restyle those states through `--lg-opaque-surface`,
`--lg-control-surface` and `--lg-control-surface-hover`.

Glass frosts what is painted behind it. In Chromium, `opacity` below 1, a
`filter`, a `mask` or a `mix-blend-mode` on a glass component or any ancestor
isolates that backdrop, and the glass renders flat. Animate `transform` instead.
Dialog, sheet, menu, popover and tooltip content frost on their own element, so
fading that element is safe. Each visible surface costs a backdrop blur, so
prefer a few large surfaces to many nested ones, and use the provider's `low`
quality preference on weak devices.

## Installable names

Configure the local namespace once as described in
[`registry-installation.md`](registry-installation.md), then install a matching
registry item with the pinned CLI:

```bash
pnpm dlx shadcn@4.14.1 add @glassyui/glass-button
```
