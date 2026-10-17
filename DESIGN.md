# Glassy UI design

Glassy UI is a polished glass component library for React. This guide covers the
brand mark and the visual system around it. Read it before changing anything
people see.

## Principles

- **Polished, never a toy.** Abstract, crafted forms. No mascots, novelty
  objects or illustrations standing in for a logo.
- **Glass bends; it doesn't frost.** Glassy UI surfaces refract what sits behind
  them and catch light at their rims. Show that, not a blur.
- **Glass needs something to bend.** Pages sit on charcoal, not black, and glass
  sits over wallpaper or content.
- **Generic parts, our own twists.** Use original icons, symbols and generic
  content in components, demos and examples. Its controls are generic, with
  twists of our own: a prominent button of blue tinted glass, buttons that rest
  as slabs instead of swelling, and original Vermilion ribbon artwork.
- **Mockups show the library in use.** The homepage desk and the laptop mockup
  use a menu bar, settings toggles and a dock of app icons. The phone the desk
  turns into uses a 6.3-inch screen's proportions and shows a live Today screen
  built from the same components as the desktop.
- **Restraint.** Black and white for the logo with one small Vermilion accent,
  blue for actions, neutral glass; generous space; sentence case.

## Logo

<img src="public/brand/glassyui-logo.svg" width="160" alt="The Glassy UI ribbon">

The ribbon is a slim band laid on a squircle and given one full twist. It turns
edge-on at the top-left and bottom-right corners. Both faces are solid black,
with an open centre and no gradients, highlights or shadows. A short Vermilion
underside appears at the lower-right fold, with a crisp cut where it meets the
black band. On dark surfaces, the ribbon reverses to white and keeps the same
red accent.

### Versions

| Version  | File                                     | Use                                                          |
| -------- | ---------------------------------------- | ------------------------------------------------------------ |
| Detail   | `public/brand/glassyui-logo.svg`         | Black with a red accent, 64 px and up: docs and exports      |
| Compact  | `public/brand/glassyui-logo-compact.svg` | Black with a red accent, 16 to 48 px: headers and menus      |
| Reverse  | `public/brand/glassyui-logo-white.svg`   | White with a red accent for dark surfaces                    |
| App icon | `public/brand/glassyui-app-icon.svg`     | Accented black ribbon on a white tile; full bleed, unrounded |
| Glyph    | `public/brand/glassyui-glyph.svg`        | Compact cut in `currentColor`, both faces solid              |

The two cuts are optical sizes. The compact cut is slightly thicker so the
ribbon stays legible at 16 px. Platforms that round icons themselves get the app
icon. The SVG favicon follows the browser appearance: black in light mode and
white in dark mode, with the same red accent.

### Lockup

The mark sits to the left of **Glassy UI** set in SF Pro Display Semibold (600)
with 0.012em tracking, centred on the text.

| Place         | Mark  | Wordmark                     | Gap   |
| ------------- | ----- | ---------------------------- | ----- |
| Site header   | 24 px | 19 px                        | 8 px  |
| Footer        | 22 px | 15 px                        | 8 px  |
| Desk menu bar | 16 px | Bold, at the menu bar's size | 7 px  |
| Share image   | 44 px | 30 px                        | 14 px |

Write the name as **Glassy UI**: two words, capital G, U and I.

### Clear space and size

- Keep at least a third of the mark's height clear on every side. The header's 8
  px beside a 24 px mark is the minimum.
- The mark's smallest size is 16 px, in the compact cut.

### Backgrounds

- Use black on white or ivory (`#faf9f7`), and white on charcoal (`#1c1c1e`) or
  black.
- On photos, wallpapers or saturated artwork, use the app icon, or the glyph in
  white or black.
- Nothing goes behind the bare mark: no tiles, badges or glows. The app icon is
  the only container.

### Don'ts

- Keep the ribbon black or white, with only the constructed Vermilion fold
  (`#f04a28`).
- Don't stretch, rotate or mirror it. Mirroring reverses the twist.
- Don't add outlines, gradients, highlights, shadows or glows.
- Don't use the detail cut below 64 px.
- Don't redraw it by hand. Change the construction instead (see Files and
  tools).

### Construction

On a 64-unit canvas centred at (32, 32):

- The band follows a superellipse with exponent 4.4 and radius 22.3, and is 9
  units wide.
- It turns once over ±0.64 radians of the loop around each of the top-left and
  bottom-right corners. Its projected width is the full width times the cosine
  of how far it has turned.
- The back face is the front face turned 180°, with each outline fitted as cubic
  curves to within 0.03 units. Both faces use the same opaque fill.
- The compact cut uses radius 22, width 10.4 and ±0.58 radians.
- The accent follows the full band for 0.62 radians after the lower-right pinch.
  It uses the ribbon's own edges and ends in a clean cut across the band.
- The app icon centres the detail cut at 72% scale on a plain white tile.

## Interface colour

The palette uses neutral surfaces with restrained Vermilion accents. This guide
defines the current colours and artwork. Keep the production layout and glass
renderer.

The site's tokens live in `src/app/globals.css`; the library owns every `--lg-*`
token in `src/styles/liquid.css`.

| Token           | Dark      | Light     | Use                          |
| --------------- | --------- | --------- | ---------------------------- |
| `--site-bg`     | `#1c1c1e` | `#faf9f7` | Page                         |
| `--site-tile`   | `#2c2c2e` | `#ffffff` | Cards and tiles              |
| `--site-text`   | `#f5f5f7` | `#222224` | Primary text                 |
| `--site-text-2` | `#b8b8be` | `#66666a` | Secondary text               |
| `--site-text-3` | `#a8a8af` | `#66666a` | Tertiary text, headline echo |
| `--site-link`   | `#78b7ff` | `#005ec6` | Links                        |

| Library token         | Dark      | Light     | Use                                          |
| --------------------- | --------- | --------- | -------------------------------------------- |
| `--lg-prominent-fill` | `#0067d9` | `#0067d9` | Prominent buttons where glass can't be drawn |
| `--lg-accent`         | `#0067d9` | `#0067d9` | Selection and active controls                |
| `--lg-switch-on`      | `#0067d9` | `#0067d9` | A switch that is on                          |
| `--lg-focus-ring`     | `#b8b8be` | `#66666a` | Neutral keyboard focus                       |
| `--lg-invalid`        | `#ff7a8e` | `#c4153f` | Errors                                       |

- Blue actions use `#0067d9` for white-label legibility. Links adjust for each
  appearance; keyboard focus uses neutral silver or graphite. The artwork's
  red-orange never signals selection, success or errors.
- Dark mode is charcoal, not black: a black page leaves glass nothing to bend
  and flattens every card.
- Alerts, badges and presence dots share one palette of our own. Their text
  keeps 4.5:1 over a white or black backdrop in both themes.

| Tone   | Dark      | Light     | Use                              |
| ------ | --------- | --------- | -------------------------------- |
| Jade   | `#33d69f` | `#14a874` | Success, online, the green badge |
| Gold   | `#ffbd38` | `#e8960c` | Warning, away, the orange badge  |
| Rose   | `#ff5c7a` | `#e8345a` | Danger, busy, the red badge      |
| Violet | `#9b80ff` | `#6a4cf0` | The purple badge                 |
| Gray   | `#8e8e93` | `#8e8e93` | Neutral badges, offline          |

- Pages and cards use ivory, silver and graphite. Glass stays neutral and takes
  small accents from the artwork behind it; broad surfaces never become
  burgundy.
- The Pro card beside the components gallery is the one card in Vermilion, in
  both themes, so it reads as the way into Pro rather than another component.
  Its copy and its link are white, and the red deepens down the card so the copy
  keeps 5:1.
- Purple remains an opt-in badge API for consumers; site branding and default
  examples use no purple.
- The dimmest text keeps 4.5:1 contrast on both the page and its tiles.

## Typography

- SF Pro Display for headlines and the wordmark, SF Pro Text for body copy and
  SF Mono for code, each through the system font stack in `globals.css`.
- Headlines are Semibold with tight tracking (−0.015em) and line height 1.05. A
  second line steps back to the tertiary colour, as in "Bends light. _In any
  browser._"
- Everything is sentence case.

## Material

- Components are glass: they refract their backdrop through generated
  displacement maps and light their rims. The library owns the material; the
  site styles around it and never restyles a bare `.lg-*` class.
- The round magnifier shares the material's RGB dispersion pass and reads
  `--lg-lens-dispersion` and `--lg-glass-thickness`. Its centre stays clear;
  colours separate along the curved rim.
- Text over wallpaper uses the neutral `--site-legible-tint` and opaque ink, so
  the artwork remains visible without washing out the copy.
- Shapes are capsules for buttons and controls, and rounded rectangles for tiles
  and icons. The logo alone uses a true superellipse.
- Buttons are slabs resting just above the page. A pointer lowers one and a
  press sets it down, its shadow drawing in; they never swell. Under a pointer
  the prominent button's light also swings 50° over to the top left: the bright
  line along its rim moves round to the end facing the light and the glow along
  its bottom to the far end. The shadow stays under the slab. Nothing new lights
  up; the rim light it already has moves.
- The dock is a quiet glass shelf with space around its icons. Full app artwork
  fills an item; navigation glyphs stay small inside the same generous target.
  Hover and keyboard focus never resize the dock or its neighbours. Nothing is
  painted behind app artwork, so a launch bounce shows the shelf, and a click or
  tap never leaves a focus ring.
- The prominent button is blue glass, not paint. `--lg-prominent-tint` recolours
  whatever lies behind it and caps how bright that can get, so its white label
  keeps 4.5:1 over any backdrop. Under reduced transparency, increased contrast
  or forced colours it falls back to `--lg-prominent-fill`.
- The default backdrop is Vermilion, with narrow sculpted red-orange ribbons
  over a mostly neutral canvas in `public/wallpapers`. Light uses silver and
  white; dark uses charcoal and graphite. The desk's own Vermilion turns a broad
  ribbon over once, as the logo's band turns, and runs an apricot band low
  across the dock. Both pass beneath the player, the control centre and the
  dock, so every pane of glass on the desk has an edge to bend. The desk keeps
  Tide, Ember and Lagoon as alternate wallpapers. The lab, lens previews and
  share cards follow the Vermilion default.

- Component cards don't repeat the wallpaper. Each stage holds one sculpted form
  on its canvas: the ribbon from one of six directions, or a drop in a corner,
  in Vermilion, Apricot, Graphite or Silver
  (`src/components/site/card-backdrop.tsx`). Cards take the next form and
  material in turn, so neighbours never match and one card in four is Vermilion;
  the Pro card stays the one red card. Forms run pale in light mode and deep in
  dark mode, keeping 3:1 against the demos' ink. Graphite keeps the logo's
  Vermilion edge.

## Motion

Motion explains a change and then gets out of the way. Nothing loops except
progress, spinners, skeletons and the Pro card's art.

- **A keynote at the top of the home page.** With motion allowed the page opens
  like a keynote as it loads, in about five seconds: on a stage matching the
  page's appearance the mark comes into focus through glass and rises to make
  way for "Bends light. In any browser.", each line coming into focus once the
  ribbon has cleared it; after a beat a slab of glass bends the first line as it
  passes, splitting colours at its rim and frosting a little; the slide shrinks
  into the library's `GlassPhoneDuo` component over the page. Its lifted half
  frosts the flat title, closes and turns away as the header slides in. The
  analytics prompt waits until the opener has made way. Scrolling waits until
  the page has landed. Skip intro and the stage show a confirmation on the first
  click or tap; the second fades the current frame, or hurries an ongoing fold.
  Tab or Escape skips without confirmation. The intro is remembered when it
  starts, so reloading does not repeat it; Replay intro plays it again on
  request. An address on the page skips the opener. Further down, scrolled by
  the visitor, the desk lifts, turns over once and lands as the phone, and six
  features come into focus from either side. Remotion compositions in
  `src/components/keynote` draw the stage; the hero, desk and header stay the
  real page and land exactly in place.
- **Smooth while loading.** Anything that moves before the page has hydrated
  runs off the main thread, so hydration never holds a frame back: the opener's
  ribbon is drawn by a worker.
- **Once, on arrival.** Without JavaScript the home page settles in top to
  bottom in about a second and a half: the headline paints at once, the desk
  rises behind it, then its widgets and dock land. Widgets shown again later
  appear at once.
- **Into place, never into view.** Sections rise into place as they scroll in,
  where the browser has scroll-driven animations. A reveal only moves; it never
  hides content.
- **From where it came.** Menus, selects, popovers and tooltips grow out of
  their trigger and drift the last few pixels away from it. Dialogs rise
  slightly as they appear.
- **Answers, not decoration.** Buttons set down under a press, a link's arrow
  leans the way it goes, copying confirms with a small pop, and the theme switch
  changes the whole page at once, including its first use. A Light and Dark
  control changes the theme immediately while its bubble moves on the live page.
- **One quiet loop.** The Pro card beside the components gallery shows a Pro
  site in a glass window over a pale turning ribbon. The ribbon sways a few
  pixels over 16 seconds and the window floats over 7, so the card feels alive
  without calling for attention. Pointing at the card raises the window.
- **Glass keeps its backdrop.** Never fade, filter, mask or clip anything glass
  looks through: the glass would lose the page it bends until the animation
  ended. The keynote keeps the desktop and phone mounted throughout the turn.
  Local glass scenes draw in their own layout coordinates, then the browser
  projects the completed screen. The turn keeps the desktop layout at its
  original size inside the changing face, so edits and glass stay together. Each
  screen takes input while its face is visible.
- **One curve.** Arrivals ease out on `--lg-ease-out`, physical responses use
  `--lg-spring`, and exits ease in and run shorter than arrivals.
- **Reduced motion.** The system setting and the site's preference both keep
  every end state and drop the movement. The keynote then never starts: the page
  is the ordinary one, and the phone and its features stand still below the
  desk.

## Link previews

A shared link shows the product, not a template. Every page has its own 1200 ×
630 card in `public/share`, set in the film stills' grid: the 44 px lockup at
the top left, the page's name on clean ivory under it, and the product on the
right, bleeding off the edge.

- **The home and React Native cards are film.** They are stills from the loops
  `link-previews/` renders: one pill of clear glass over the real dock, or
  springing between the real Today screen's segments, in a bright ivory studio.
  Messages plays the six-second loop in place of the still. The loop repeats
  exactly and starts on the still's frame, so neither the seam nor the hand-over
  shows.
- **Every other card is the live component.** The share studio photographs each
  demo on the docs' wallpaper stage, magnified, with overlays open.
- **Pro is the one card in Vermilion**, with the Pro card's own art and white
  copy beside the white glyph.
- **Type:** "Bends light." over a second line in the tertiary colour, or the
  page's name; Semibold, −0.015em. Leave the site's name out of `og:title`;
  `og:site_name` carries it.
- **Nothing that goes stale.** A card is a photograph: no counts, prices or
  dates in the artwork.

## Voice

- Short, concrete and calm: "Glass without effort." and "Accessible React
  components that bend what sits behind them. Install with shadcn. Own the
  code."
- Say what a thing does, not how good it is. No hype, no exclamation marks.
- Keep component names, identifiers, URLs, examples and share artwork
  independent of third-party product names. Describe mockups as generic laptops
  or phones. Name platforms and packages when they explain compatibility or
  installation.

## Files and tools

- `public/brand` holds every logo file; its `README.md` lists them.
- `pnpm brand:build` draws the five logo SVGs and the adaptive SVG favicon from
  the construction in `scripts/build-brand-mark.mjs`.
- `pnpm brand:export` renders the PNGs and the ICO from those SVGs and copies
  the ICO and touch icon into `src/app`.
- `pnpm wallpaper:build` draws the desk's Vermilion wallpapers,
  `vermilion-desk-light.svg` and `vermilion-desk-dark.svg`, from the ribbons in
  `scripts/build-desk-wallpaper.mjs`, together with the `duo-light` and
  `duo-dark` variants. The Duo uses deeper silver in light mode and brighter
  graphite in dark mode; its controls keep the site's theme. Capture its two
  displays in both themes with `scripts/capture-phone-duo-screens.mjs`. Move a
  ribbon in the generator rather than editing the SVGs.
- `BrandMark` in `src/components/site/app-icons.tsx` mirrors the compact cut.
  Update it whenever the compact cut changes.
- `public/share/README.md` lists every link-preview card and how to make it
  again: `scripts/capture-share-cards.mjs` for the studio cards,
  `link-previews/` for the loops.
