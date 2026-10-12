import type { Metadata } from 'next';
import { shareCard, shareMetadata } from '@/lib/share';
import Image from 'next/image';
import Link from 'next/link';
import { Fragment } from 'react';
import { notFound } from 'next/navigation';
import {
  getComponentDoc,
  glassThemeRoot,
  initializeShadcn,
  publicRegistryMapping,
} from '@/components/docs/component-docs-data';
import { CopyCodeBlock } from '@/components/docs/copy-code-block';
import { DocsShell } from '@/components/docs/docs-shell';
import { expoComponentsJson, expoTsconfigPaths } from '@/components/docs/expo-setup';
import { getGuide, guides } from '@/components/docs/guide-data';
import { nativeInstallCommand } from '@/lib/native-usage-source';
import nativeRegistry from '../../../../registry-native.json';

export function generateStaticParams() {
  return guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);

  if (!guide) return {};

  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guides/${slug}` },
    ...shareMetadata({
      card: shareCard(
        `guides/${slug}`,
        `The guide's demo on red ribbon artwork, beside its title: ${guide.title}.`,
      ),
      title: guide.title,
      description: guide.description,
      url: `/guides/${slug}`,
      type: 'article',
    }),
  };
}

function InstallationGuide() {
  return (
    <>
      <section className="docs-section">
        <h2>Start with the app you already have</h2>
        <p>
          Glassy UI copies source into a React 19+ and Tailwind CSS 4 app. You can inspect and edit
          every installed file. There is no Glassy UI runtime package and no account to create.
        </p>
        <p>
          If your app already has a shadcn <code>components.json</code>, keep it. Otherwise
          initialize shadcn first:
        </p>
        <CopyCodeBlock code={initializeShadcn} label="Initialize shadcn" language="shell" />
        <p>
          Merge this registry entry into <code>components.json</code>. Keep your existing aliases,
          style and other registries; this is an addition to that file, not a replacement.
        </p>
        <CopyCodeBlock code={publicRegistryMapping} label="Registry mapping" language="json" />
      </section>
      <section className="docs-section">
        <h2>Install one component</h2>
        <CopyCodeBlock
          code="pnpm dlx shadcn@4.14.1 add @glassyui/glass-button"
          label="Install Glass Button"
          language="shell"
        />
        <p>
          Set <code>data-lg-theme="light"</code> on a light app&rsquo;s root element, or{' '}
          <code>data-lg-theme="dark"</code> on a dark app&rsquo;s. Keep this attribute in sync with
          your app&rsquo;s theme switch.
        </p>
        <CopyCodeBlock code={glassThemeRoot} label="Root element in a light app" />
        <CopyCodeBlock
          code={
            'import { GlassButton } from "@/components/glassyui/glass-button";\n\nexport default function Page() {\n  return <GlassButton variant="prominent">Explore projects</GlassButton>;\n}'
          }
          label="Your first glass component"
        />
        <p>
          The registry resolves shared files and package dependencies. Its provider module imports
          the glass stylesheet automatically. A provider wrapper is optional for a simple button;
          add one when you want synchronized preferences across your app.
        </p>
      </section>
      <section className="docs-section">
        <h2>Reproduce a complete example</h2>
        <p>
          Open <Link href="/components/glass-scene">Glass Scene</Link>,{' '}
          <Link href="/components/glass-lens">Glass Lens</Link>, or{' '}
          <Link href="/components/glass-dock">Glass Dock</Link>. Their Usage sections contain the
          same source that renders the preview, including the artwork. Save that source in the named
          file, run its example install command, then import its exported component.
        </p>
        <p>
          A scene composition uses more than the scene renderer: its panels and buttons need
          installing too. The example command includes those dependencies. This is separate from the
          command for the primitive alone.
        </p>
      </section>
      <section className="docs-section">
        <h2>Make it yours</h2>
        <p>
          Use <code>className</code> for size, spacing and color. Component defaults sit in a CSS
          cascade layer, so Tailwind utilities can override them without <code>!</code>. Preserve
          the accessibility preference rules when editing the source.
        </p>
        <p>
          Glass needs a backdrop to be visible. CSS frost blurs what is behind a surface; the
          refractive scene uses the image you supply. A glass panel on a flat background will look
          quieter than the same panel over a detailed image.
        </p>
        <p>
          If the CLI cannot resolve <code>@glassyui</code>, check the mapping before changing
          component code. If an import cannot resolve, check the installed target path against your
          app aliases. The <Link href="/docs">installation reference</Link> explains the shared
          files and optional provider.
        </p>
      </section>
    </>
  );
}

const themeInstall = 'pnpm dlx shadcn@4.14.1 add https://glassyui.com/r/glassy-theme.json';

const dropinInstall =
  'pnpm dlx shadcn@4.14.1 add https://glassyui.com/r/glassy-ui-new-york.json --overwrite';

const themeTokens = `:root {
  --glassy-tint: 84%;    /* tinted buttons, badges and checked controls */
  --glassy-surface: 72%; /* cards, menus, popovers and dialogs */
}`;

const themeEscapeHatches = `<Input className="bg-none bg-amber-50" />       {/* your own field colour */}
<Input className="inset-shadow-none" />          {/* no recessed rim */}
<Card className="bg-white" />                    {/* your own card colour */}
<Button className="min-w-0">Save</Button>        {/* shadcn's own width */}`;

const themeScreenshots = [
  {
    src: '/guides/shadcn-theme/stock-plain-light-overview.webp',
    width: 2048,
    height: 1640,
    alt: 'Stock shadcn/ui buttons, badges, a card, alerts and form controls on a plain light page',
    caption: 'Stock shadcn/ui on a plain page.',
  },
  {
    src: '/guides/shadcn-theme/glassy-plain-light-overview.webp',
    width: 2048,
    height: 1640,
    alt: 'The same shadcn/ui components after installing the Glassy UI theme: tinted glass buttons, a frosted card with lit rims and recessed fields',
    caption: 'The same page after the install. No component file changed.',
  },
  {
    src: '/guides/shadcn-theme/glassy-plain-dark-overview.webp',
    width: 2048,
    height: 1640,
    alt: 'The themed components in dark mode on a plain dark page',
    caption: 'Dark mode reads the dark palette.',
  },
  {
    src: '/guides/shadcn-theme/glassy-wallpaper-dark-overview.webp',
    width: 2048,
    height: 1640,
    alt: 'The themed components over a red ribbon wallpaper, frosting the artwork behind them',
    caption: 'Over an image, the same surfaces frost what lies behind them.',
  },
  {
    src: '/guides/shadcn-theme/glassy-wallpaper-light-menu.webp',
    width: 1984,
    height: 736,
    alt: 'An open shadcn/ui dropdown menu as frosted glass over black and white stripes, which blur behind it',
    caption: 'An open menu frosts what lies behind it: the stripes blur under the glass.',
  },
];

function ShadcnThemeGuide() {
  return (
    <>
      <section className="docs-section">
        <h2>Install it</h2>
        <p>
          The Glassy UI theme restyles the stock shadcn/ui components your app already has. Run one
          command in a shadcn/ui app on Tailwind CSS 4:
        </p>
        <CopyCodeBlock code={themeInstall} label="Install the Glassy UI theme" language="shell" />
        <p>
          If your <code>components.json</code> already maps <code>@glassyui</code> (see{' '}
          <Link href="/guides/shadcn">the shadcn guide</Link>), the item is also{' '}
          <code>@glassyui/glassy-theme</code>. The command was tested with shadcn CLI 4.14.1 and
          4.21.0.
        </p>
        <p>
          Before it writes anything, the CLI warns that a theme overwrites existing CSS variables
          and components. This one changes neither, so answer yes. It writes CSS only: it adds{' '}
          <code>--glassy-*</code> tokens next to your palette, two easing curves to{' '}
          <code>@theme inline</code> and one <code>@layer glassy</code> block inside{' '}
          <code>@layer components</code>. Every tint comes from your own colours: a black{' '}
          <code>--primary</code> gives black glass, a blue one blue glass.
        </p>
      </section>
      <section className="docs-section">
        <h2>What it looks like</h2>
        {themeScreenshots.map((shot) => (
          <figure className="docs-figure" key={shot.src}>
            <Image
              alt={shot.alt}
              height={shot.height}
              src={shot.src}
              unoptimized
              width={shot.width}
            />
            <figcaption>{shot.caption}</figcaption>
          </figure>
        ))}
        <p>
          Buttons rest like thick slabs of glass just above the page: their edges catch the light,
          with a faint split into colour, and they cast a long, soft shadow. A pointer lowers one
          and a press sets it down, so its shadow draws in; nothing scales. Cards and alerts frost
          what lies behind them and light their rims. Inputs, textareas and select triggers become
          recessed wells. Switches and sliders get glass knobs that spring. The selected tab sits on
          a pill of glass that slides to the tab you pick.
        </p>
        <p>
          The glass takes your palette&rsquo;s colour. Coloured buttons are deep glass that casts a
          shadow in its own colour, and cards, alerts, menus and dialogs carry a little of your
          primary colour as light; a grey palette keeps the glass clear.
        </p>
        <p>
          In Chrome, Edge and other Chromium browsers, cards, alerts and outline, secondary and
          ghost buttons carry the lens of Glassy UI&rsquo;s own components: a lighter frost that
          bends the page along the rim, split into colour on cards and alerts. Coloured buttons hide
          the page behind their tint, so they frost it without the bend. Safari and Firefox cannot
          draw that bend, so they show the frost alone.
        </p>
      </section>
      <section className="docs-section">
        <h2>Which components change</h2>
        <p>
          Button, badge, card, alert, kbd, skeleton, avatar, input, textarea, select, dropdown menu,
          popover, tooltip, dialog, sheet, command, tabs, switch, slider, checkbox and radio group.
          They were tested in Chrome on two stock apps, new-york on Radix and base-nova on Base UI,
          and on new-york in shadcn&rsquo;s blue, violet, orange and yellow themes. WebKit and
          Firefox were checked to keep the frost and leave out the bend. Other styles use the same
          slots but are untested.
        </p>
        <p>
          Everything else keeps its stock look, including accordion, context menu, menubar,
          navigation menu, hover card, sidebar, drawer, toggle group, progress and toasts. Buttons
          that open a menu, dialog, popover or sheet turn to glass like the rest. The theme tells
          button variants apart by their <code>data-variant</code> attribute, or by their stock
          classes where a button has none, as on base-nova and in buttons copied before shadcn added
          it. A button whose variant classes you rewrote may keep its stock look.
        </p>
      </section>
      <section className="docs-section">
        <h2>Tune it</h2>
        <p>
          Lower the tint for clearer coloured glass, or raise the surface when cards sit over a busy
          image. Put the tokens in <code>:root</code> for light mode and <code>.dark</code> for dark
          mode:
        </p>
        <CopyCodeBlock code={themeTokens} label="Clearer buttons, denser cards" />
        <p>
          The other tokens set the blur (<code>--glassy-frost</code>;{' '}
          <code>--glassy-lens-frost</code> where the rims bend, in Chromium; and{' '}
          <code>--glassy-float-frost</code> for menus, popovers, selects, dialogs and sheets), the
          colour boost behind it (<code>--glassy-saturate</code>), the field fill (
          <code>--glassy-field</code>), rim light and shade (<code>--glassy-rim</code>,{' '}
          <code>--glassy-shade</code>), the sheen across buttons and tab tracks (
          <code>--glassy-sheen</code>) and across cards and alerts (<code>--glassy-pane-sheen</code>
          ), the shadow colour as an <code>r g b</code> triplet (<code>--glassy-shadow</code>), how
          far tinted buttons and badges push their colour away from their label, deeper under a
          light label and paler under a dark one (<code>--glassy-tint-depth</code>), how strongly
          button edges split into red and blue (<code>--glassy-rim-split</code>, 0 for none), and
          how far the selected tab&rsquo;s pill leans toward your text colour (
          <code>--glassy-pill-lift</code>).
        </p>
        <p>
          The bend at the rims has no token. To keep the frost and drop the bend, delete the{' '}
          <code>@supports (-webkit-app-region: drag)</code> block inside <code>@layer glassy</code>.
          Only Chromium matches that query.
        </p>
      </section>
      <section className="docs-section">
        <h2>Your classes still win</h2>
        <p>
          The theme sits below Tailwind&rsquo;s utilities, so a class you write on a component keeps
          winning, as it did before. Fields draw their fill as a background image and their rim as
          an inset shadow, so clear those first when you restyle one. In Chrome and Edge, buttons
          widen a little past their label so their round ends have room; <code>min-w-0</code> gives
          one shadcn&rsquo;s width back:
        </p>
        <CopyCodeBlock code={themeEscapeHatches} label="Restyle a themed component" />
      </section>
      <section className="docs-section">
        <h2>Accessibility</h2>
        <p>
          With Reduce Motion on, the themed components and accordions stop sliding, springing and
          fading, the stock open and close animations included; each one lands in its end state.
          With Reduce Transparency, Increase Contrast or a forced-colours mode on, the glass turns
          into solid fills in your palette with plain borders; forced colours use your system
          colours.
        </p>
        <p>
          On plain light and dark pages, in shadcn&rsquo;s neutral, blue, violet, orange and yellow
          themes, labels on glass buttons, badges, tabs, keys, cards, alerts and menus keep at least
          4.5:1 contrast, measured from the rendered pixels in Chrome. Disabled buttons, which WCAG
          exempts, are the exception. Where shadcn/ui&rsquo;s own colours already fall short, as
          base-nova&rsquo;s soft destructive badge does at 3.8:1 and the orange theme&rsquo;s
          buttons at 2.6:1, the theme keeps or raises their contrast. Over a photo or illustration,
          contrast depends on the image: raise <code>--glassy-tint</code> and{' '}
          <code>--glassy-surface</code> until your labels read clearly.
        </p>
      </section>
      <section className="docs-section">
        <h2>Remove or upgrade it</h2>
        <p>
          Delete the <code>@layer glassy</code> block, the <code>--glassy-*</code> lines in{' '}
          <code>:root</code> and <code>.dark</code>, and the <code>--ease-glassy-*</code> lines in{' '}
          <code>@theme inline</code>. To upgrade, remove them first, then run the install command
          again: the shadcn CLI adds and updates rules but never deletes old ones.
        </p>
      </section>
      <section className="docs-section">
        <h2>Get Glassy UI&rsquo;s components instead</h2>
        <p>
          The theme keeps shadcn/ui&rsquo;s look and draws one lens per size. To turn your
          components into Glassy UI&rsquo;s own, with its look, its sizes and, on buttons, cards,
          alerts, tabs and floats, the lens measured for each element&rsquo;s exact size and
          corners, install the drop-in set for your style instead of the theme:
        </p>
        <CopyCodeBlock
          code={dropinInstall}
          label="Install the drop-in components (new-york)"
          language="shell"
        />
        <p>
          On base-nova, which uses Base UI, install <code>glassy-ui-base-nova.json</code> instead.
          Each drop-in keeps shadcn/ui&rsquo;s exports, props and data attributes for your style, so
          your imports and call sites stay as they are, Server Components included. Glassy
          UI&rsquo;s blue becomes your palette&rsquo;s primary colour. The engine goes into{' '}
          <code>components/glassyui</code>; only Chromium draws the lens, and Safari and Firefox
          keep the frost. Tune the glass of menus, selects, popovers, dialogs and sheets with{' '}
          <code>--glassy-slab</code> (the fill), <code>--glassy-slab-frost</code> and, for dark
          mode, <code>--glassy-slab-brightness</code> and <code>--glassy-slab-rim-brightness</code>.
        </p>
        <p>
          Glassy UI&rsquo;s sizes come with its look, so layouts grow: fields are 52 px tall,
          buttons 44 px and the tabs list 48 px. The set replaces sixteen files in{' '}
          <code>components/ui</code>: button, card, alert, badge, input, textarea, select, checkbox,
          radio group, switch, slider, tabs, dropdown menu, popover, dialog and sheet.{' '}
          <code>--overwrite</code> replaces your edits in them too, so commit first. If you
          installed the theme, delete its <code>@layer glassy</code> block and its{' '}
          <code>--glassy-*</code> lines first. To go back, restore the files from git and delete{' '}
          <code>components/glassyui</code>.
        </p>
      </section>
      <section className="docs-section">
        <h2>What needs Glassy UI&rsquo;s components</h2>
        <p>
          Some effects need more than shadcn/ui&rsquo;s components, so they stay with{' '}
          <Link href="/components">Glassy UI&rsquo;s own components</Link>: refraction in Safari and
          Firefox over a backdrop you supply, a glow that lands where you press, a bubble you can
          drag between segments, and springs that keep their speed when you change direction
          mid-move.
        </p>
      </section>
    </>
  );
}

function AccessibilityGuide() {
  return (
    <>
      <section className="docs-section">
        <h2>Choose the effect that fits the job</h2>
        <p>
          CSS frost gives buttons, panels and overlays a translucent surface.{' '}
          <Link href="/components/glass-scene">Glass Scene</Link> adds refraction by drawing its
          supplied backdrop through one WebGL2 canvas. It does not capture and refract arbitrary DOM
          behind the page. <Link href="/components/glass-lens">Glass Lens</Link> magnifies a copy of
          its own content.
        </p>
        <p>
          Use an explicit backdrop for a scene and keep its content in ordinary HTML. The renderer
          takes no clicks or focus. When WebGL2 is unavailable, the scene reports that condition and
          its children retain their CSS glass.
        </p>
      </section>
      <section className="docs-section">
        <h2>Let people reduce the effect</h2>
        <p>
          Reduced transparency, increased contrast and forced colors turn off the scene canvas.
          Reduced motion stops its flowing distortion. Keep those controls intact when copying the
          source.
        </p>
        <p>
          Mount a <Link href="/components/glass-provider">Glass Provider</Link> to synchronize app
          preferences. A settings action can update both motion and transparency without replacing
          the actual controls:
        </p>
        <CopyCodeBlock
          code={
            '"use client";\n\nimport { GlassButton } from "@/components/glassyui/glass-button";\nimport { usePreferences } from "@/components/glassyui/glass-provider";\n\nexport function ReduceEffects() {\n  const { setPreferences } = usePreferences();\n  return (\n    <GlassButton onClick={() => setPreferences({ reduceMotion: true, reduceTransparency: true })}>\n      Reduce glass effects\n    </GlassButton>\n  );\n}'
          }
          label="A settings action inside GlassProvider"
        />
        <p>
          Use this inside a provider and alongside your existing settings. It is an example of
          updating preferences, not a complete settings screen.
        </p>
      </section>
      <section className="docs-section">
        <h2>Keep text and controls legible</h2>
        <p>
          Check your actual backdrop and text colors together. Scene surfaces adjust their face
          behind text, but that does not make every custom color, nested layer or new composition
          automatically accessible. Test the final result with the longest labels and the lightest
          and darkest parts of your chosen image.
        </p>
        <p>
          Preserve visible focus rings, labels, keyboard operation and Radix semantics. For
          icon-only dock links, give each destination a meaningful label. Do not communicate state
          through transparency alone.
        </p>
        <p>
          A lens renders its children twice. Use decorative, non-interactive content inside it and
          avoid duplicate IDs. Put real links and form controls outside the magnified content.
        </p>
      </section>
      <section className="docs-section">
        <h2>Spend rendering work where it is visible</h2>
        <p>
          Start with one scene or a small number of glass accents. A large animated backdrop or many
          transparent layers can cost more than a static card; there is no universal frame-rate
          promise across devices.
        </p>
        <p>
          Test the actual page in Chrome, Safari and Firefox and on the devices your audience uses.
          Check scrolling and input while the effects run, then repeat with reduced preferences. Use
          the library’s quality preferences for dense screens and reserve strong refraction for the
          surfaces that benefit from it.
        </p>
        <p>
          The <Link href="/components">component examples</Link> are useful starting points. Your
          final content and devices are the acceptance surface.
        </p>
      </section>
    </>
  );
}

function LaptopMockupGuide() {
  const laptop = getComponentDoc('glass-laptop');

  if (!laptop) throw new Error('The laptop mockup guide needs the glass-laptop component.');

  return (
    <>
      <section className="docs-section">
        <h2>A laptop drawn in CSS, not a photo</h2>
        <p>
          <Link href="/components/glass-laptop">Glass Laptop</Link> is a free, MIT-licensed React
          component. CSS 3D draws its notched screen, keyboard and trackpad, with no images or
          WebGL. Your screenshot or live React content fills the screen.
        </p>
        <p>
          Shut, the view looks down on the closed case. Open, the lid faces you. Changing its{' '}
          <code>open</code> prop swings the lid and moves the view between the two, and the screen
          lights once both have come to rest.
        </p>
      </section>
      <section className="docs-section">
        <h2>Install it</h2>
        <p>
          Add the <code>@glassyui</code> registry to <code>components.json</code> as the{' '}
          <Link href="/guides/shadcn">installation guide</Link> shows, then add the component. It
          brings its own stylesheet and needs only <code>clsx</code>.
        </p>
        <CopyCodeBlock code={laptop.install} label="Install Glass Laptop" language="shell" />
      </section>
      <section className="docs-section">
        <h2>Put a screenshot on the screen</h2>
        <p>
          The screen has a 3456 by 2234 aspect ratio. An image with that ratio fills it exactly. Any
          16:10 image works too: <code>object-cover</code> trims a sliver from its sides.
        </p>
        <CopyCodeBlock
          code={
            'import { GlassLaptop } from "@/components/glassyui/glass-laptop";\n\nexport function AppShowcase() {\n  return (\n    <GlassLaptop aria-label="The app\u2019s dashboard on a laptop" className="w-full max-w-5xl">\n      <img alt="" className="size-full object-cover" src="/dashboard.png" />\n    </GlassLaptop>\n  );\n}'
          }
          label="A screenshot on the screen"
        />
      </section>
      <section className="docs-section">
        <h2>Or put a live React screen on it</h2>
        <p>
          Children are laid out at <code>resolution</code> CSS pixels wide, 1728 by default, and
          scaled to fit. Pass a smaller width, such as 1496, to show larger text.
        </p>
        <p>
          The children render only while the screen is lit. Menus and dialogs they open in a portal
          appear on the page at full size, so mark a screen that is only for show <code>inert</code>
          .
        </p>
        <CopyCodeBlock
          code={
            '<GlassLaptop aria-label="The editor on a laptop" resolution={1496}>\n  <div className="size-full" inert>\n    <Editor />\n  </div>\n</GlassLaptop>'
          }
          label="A live screen"
        />
      </section>
      <section className="docs-section">
        <h2>Open the lid as the page loads</h2>
        <p>
          Start shut and open it on the next frame, so the closed case paints first and the lid
          swings up while the view moves in. Reduced motion skips the movement.
        </p>
        <CopyCodeBlock
          code={
            'const [open, setOpen] = useState(false);\n\nuseEffect(() => {\n  const frame = requestAnimationFrame(() => setOpen(true));\n\n  return () => cancelAnimationFrame(frame);\n}, []);\n\nreturn (\n  <GlassLaptop open={open} finish="silver">\n    <YourScreen />\n  </GlassLaptop>\n);'
          }
          label="Open on load"
        />
      </section>
      <section className="docs-section">
        <h2>Choose a finish and a look</h2>
        <p>
          <code>finish</code> is <code>black</code> or <code>silver</code>. A faint reflection
          crosses the glass by default; pass <code>glare={'{false}'}</code> for flat marketing
          captures. Give the laptop an <code>aria-label</code> that says what its screen shows.
        </p>
      </section>
      <section className="docs-section">
        <h2>Do I get a laptop mockup image or a React component?</h2>
        <p>
          Glass Laptop is a React component for websites. It does not export images. You can put an
          existing screenshot on its screen or render a live React view. The installation copies the
          source into your project, so you can change the frame and animation yourself.
        </p>
      </section>
    </>
  );
}

const expoScreen = `import { Image } from 'react-native';
import { GlassBackdrop } from '@/components/glassyui/glass-backdrop';
import { GlassButton } from '@/components/glassyui/glass-button';
import { GlassPanel } from '@/components/glassyui/glass-panel';
import { GlassProvider } from '@/components/glassyui/glass-provider';

const wallpaper = require('@/assets/wallpaper.jpg');

export default function Welcome() {
  return (
    <GlassProvider>
      <GlassBackdrop
        backdrop={<Image source={wallpaper} style={{ width: '100%', height: '100%' }} />}
        style={{ flex: 1, justifyContent: 'center', padding: 24 }}
      >
        <GlassPanel>
          <GlassButton variant="prominent" onPress={() => {}}>
            Continue
          </GlassButton>
        </GlassPanel>
      </GlassBackdrop>
    </GlassProvider>
  );
}`;

const expoSettings = `import { GlassSwitch } from '@/components/glassyui/glass-switch';
import { usePreferences } from '@/components/glassyui/glass-provider';

export function ReduceEffects() {
  const { preferences, setPreferences } = usePreferences();

  return (
    <GlassSwitch
      accessibilityLabel="Reduce glass effects"
      checked={preferences.reduceTransparency}
      onCheckedChange={(on) => setPreferences({ reduceMotion: on, reduceTransparency: on })}
    />
  );
}`;

function ExpoGuide() {
  return (
    <>
      <section className="docs-section">
        <h2>Glass controls and native interactions</h2>
        <p>
          The Expo registry has {nativeRegistry.items.length} items. Shared controls keep the web
          names and use React Native props; app-only components add system pickers and touch
          gestures. They install as source you own. Shared controls need Expo SDK 55 or later; the
          picker, swipe row and card stack target SDK 57.{' '}
          <Link href="/mobile">See them on a phone</Link>.
        </p>
        <p>
          iOS 26 and later draw the system&rsquo;s own glass, which bends what lies behind it.
          Earlier iOS versions and the web blur what lies behind and light the rim. Android 12 and
          later blur the <code>GlassBackdrop</code> the glass sits over; earlier Android versions
          show a translucent tint. With Reduce Transparency on, every platform draws opaque
          surfaces.
        </p>
      </section>
      <section className="docs-section">
        <h2>Add native interactions</h2>
        <p>
          <Link href="/components/glass-picker">Picker</Link> uses SwiftUI on iOS and Compose on
          Android. <Link href="/components/glass-swipe-row">Swipe Row</Link> and{' '}
          <Link href="/components/glass-card-stack">Card Stack</Link> follow touch gestures and
          settle with springs. Wrap the app in <code>GestureHandlerRootView</code>, above{' '}
          <code>GlassProvider</code>, for the gesture components.
        </p>
      </section>
      <section className="docs-section">
        <h2>Set up the registry</h2>
        <p>
          <code>shadcn init</code> does not set up Expo apps, so add a <code>components.json</code>{' '}
          at the root of your app. If you already have one, from NativeWind or React Native
          Reusables, keep it and add the <code>registries</code> entry.
        </p>
        <CopyCodeBlock code={expoComponentsJson} label="components.json" language="json" />
        <p>
          Match the <code>@/</code> import alias in <code>tsconfig.json</code>. Keep an existing
          mapping, or merge this one for files at the app root. Use <code>./src/*</code> instead
          when your components live in <code>src</code>.
        </p>
        <CopyCodeBlock code={expoTsconfigPaths} label="tsconfig.json paths" language="json" />
        <p>
          Keep <code>cssVariables</code> on. With it off, the CLI rewrites every string in the files
          it installs as if it were a list of Tailwind classes, which breaks colour values such as{' '}
          <code>rgba(255, 255, 255, 0.12)</code>.
        </p>
      </section>
      <section className="docs-section">
        <h2>Install the screen&rsquo;s components</h2>
        <CopyCodeBlock
          code={nativeInstallCommand(['glass-button', 'glass-panel'])}
          label="Install Glass Button and Glass Panel for Expo"
          language="shell"
        />
        <p>
          This command installs the screen&rsquo;s components and matches their packages to your
          Expo SDK.
        </p>
        <p>
          Expo Go already includes these packages; rebuild your development build after adding them.
          The files land in <code>components/glassyui</code>, or in{' '}
          <code>src/components/glassyui</code> when your app keeps its code in <code>src</code>.
          Adjust the imports below to match.
        </p>
      </section>
      <section className="docs-section">
        <h2>Put glass over something</h2>
        <p>
          Glass needs something to bend. <code>GlassBackdrop</code> lays its children over the{' '}
          <code>backdrop</code> you give it: a wallpaper, a photo or the screen&rsquo;s own content.
          iOS and the web blur whatever lies behind glass, but Android can only blur a view marked
          for it, so put the content behind your glass in a backdrop. Outside one, Android glass is
          a translucent tint.
        </p>
        <CopyCodeBlock code={expoScreen} label="A glass screen" />
        <p>
          A <code>require</code>d image takes its own pixel size unless you size it, so give a
          backdrop image a full width and height.
        </p>
      </section>
      <section className="docs-section">
        <h2>Follow the device&rsquo;s settings</h2>
        <p>
          <code>GlassProvider</code> follows the device&rsquo;s appearance, Reduce Motion and Reduce
          Transparency settings. Without a provider, each component reads them itself. Choices made
          with <code>setPreferences</code> last while the provider is mounted; save them in your
          app&rsquo;s storage if they should survive a restart.
        </p>
        <CopyCodeBlock code={expoSettings} label="A settings switch inside GlassProvider" />
      </section>
      <section className="docs-section">
        <h2>Components</h2>
        <p>
          These components share the web library&rsquo;s names and use React Native props. Each page
          opens on React Native with its install command, usage and API. Shared components also have
          a React design preview:
        </p>
        <p>
          {nativeRegistry.items.map((item, index) => (
            <Fragment key={item.name}>
              {index > 0 ? ', ' : null}
              <Link href={`/components/${item.name}?platform=react-native`}>
                {item.title.replace('Glass ', '')}
              </Link>
            </Fragment>
          ))}
          .
        </p>
      </section>
      <section className="docs-section">
        <h2>Where it differs from the web</h2>
        <p>
          On Android, dialogs, sheets, menus, selects and popovers open in a window of their own,
          which the blur cannot see into, so they show their denser overlay tint instead. Toasts
          appear in a <code>GlassToastViewport</code> you mount once near the root of your app,
          inside <code>GlassToastProvider</code>.
        </p>
        <p>
          Menus have no submenus. Checkbox and radio labels are plain text, which screen readers
          read as the control&rsquo;s name. Dock items show their label on a long press. A sheet
          does not scroll by itself, so put long content in a <code>ScrollView</code>.
        </p>
      </section>
      <section className="docs-section">
        <h2>What stays on the web</h2>
        <p>
          <Link href="/components/glass-scene">Glass Scene</Link> and{' '}
          <Link href="/components/glass-lens">Glass Lens</Link> draw their own refraction with WebGL
          and SVG filters, which React Native does not have; on iOS 26 and later the system glass
          bends its backdrop instead. Header, tooltip, keyboard keys, breadcrumb, pagination,
          command menu and laptop mockup are web patterns and have no Expo version.
        </p>
      </section>
    </>
  );
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);

  if (!guide) notFound();

  return (
    <DocsShell current={`/guides/${slug}`}>
      <article>
        <header className="docs-page-header">
          <p className="docs-eyebrow">Guide</p>
          <h1>{guide.title}</h1>
          <p>{guide.description}</p>
        </header>
        {slug === 'shadcn' ? (
          <InstallationGuide />
        ) : slug === 'shadcn-theme' ? (
          <ShadcnThemeGuide />
        ) : slug === 'laptop-mockup' ? (
          <LaptopMockupGuide />
        ) : slug === 'expo' ? (
          <ExpoGuide />
        ) : (
          <AccessibilityGuide />
        )}
      </article>
    </DocsShell>
  );
}
