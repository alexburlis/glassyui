import registry from '../../../registry.json';

type ComponentStatus = 'ready' | 'experimental' | 'planned';

type ComponentCategory =
  | 'Core'
  | 'Surfaces'
  | 'Controls'
  | 'Overlays'
  | 'Navigation'
  | 'Feedback'
  | 'Effects'
  | 'Mockups';

export type ComponentDoc = {
  api: Array<{ name: string; description: string }>;
  category: ComponentCategory;
  dependencies: string[];
  description: string;
  directFiles: string[];
  /** `live` shows the example running above its code. */
  examples: Array<{ code: string; live?: 'fixed-wallpaper'; title: string }>;
  /** A guide that walks through the component, linked from its page. */
  guide?: string;
  id: string;
  install: string;
  /** Shown with a "New" badge until the next release. */
  isNew?: boolean;
  installedDependencies: string[];
  installedFiles: string[];
  localFiles: string[];
  name: string;
  notes?: Array<{ body: string; title: string }>;
  pageToc: Array<{ href: string; title: string }>;
  registryDependencies: string[];
  registryItem: string;
  route?: string;
  /** The page title in search results, when the name alone says too little. */
  searchTitle?: string;
  status: ComponentStatus;
  usage?: string;
};

type ComponentDocContent = Omit<
  ComponentDoc,
  | 'dependencies'
  | 'directFiles'
  | 'install'
  | 'installedDependencies'
  | 'installedFiles'
  | 'localFiles'
  | 'registryDependencies'
  | 'registryItem'
>;

type RegistryItem = {
  dependencies?: string[];
  files: Array<{
    path: string;
    target: string;
    type: string;
  }>;
  name: string;
  registryDependencies?: string[];
};

const standardToc = [
  { href: '#preview', title: 'Preview' },
  { href: '#installation', title: 'Installation' },
  { href: '#usage', title: 'Usage' },
  { href: '#examples', title: 'Examples' },
  { href: '#api', title: 'API' },
  { href: '#notes', title: 'Notes' },
];

// SAFETY: check-registry requires every item's name and files, and each file's path, target and type.
const registryItems = registry.items as RegistryItem[];

const registryItemsByName = new Map(registryItems.map((item) => [item.name, item]));

const registryNamespace = '@glassyui/';

function getRegistryItem(name: string) {
  const item = registryItemsByName.get(name);

  if (!item) {
    throw new Error(`Missing registry item for component docs: ${name}`);
  }

  return item;
}

function getRegistryDependencyName(dependency: string) {
  if (!dependency.startsWith(registryNamespace)) {
    throw new Error(`Registry dependency must use the @glassyui namespace: ${dependency}`);
  }

  return dependency.slice(registryNamespace.length);
}

function getRegistryClosure(name: string) {
  const items: RegistryItem[] = [];
  const visited = new Set<string>();

  function visit(itemName: string) {
    if (visited.has(itemName)) return;

    const item = getRegistryItem(itemName);
    visited.add(itemName);
    items.push(item);

    for (const dependency of item.registryDependencies ?? []) {
      visit(getRegistryDependencyName(dependency));
    }
  }

  visit(name);

  return items;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

const componentDocContent: ComponentDocContent[] = [
  {
    id: 'glass-provider',
    name: 'Glass Provider',
    category: 'Core',
    status: 'ready',
    route: '/components/glass-provider',
    description: 'Sets the theme and the accessibility preferences every glass component follows.',
    usage: `import { GlassProvider } from "@/components/glassyui/glass-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <GlassProvider>{children}</GlassProvider>;
}`,
    examples: [
      {
        title: 'Choose the default theme',
        code: `<GlassProvider defaultTheme="light">{children}</GlassProvider>`,
      },
      {
        title: 'Legacy SVG filters',
        code: `<GlassProvider>
  <LiquidFilters />
  {children}
</GlassProvider>`,
      },
    ],
    api: [
      {
        name: 'GlassProvider',
        description:
          'Applies document-level preferences and data attributes. `defaultTheme` ("light" or "dark") is the theme a visitor sees until they choose one, whatever their system prefers; without it the provider follows the system. A choice made with `usePreferences` is saved and always wins.',
      },
      { name: 'PreferencesProvider', description: 'Compatibility alias for GlassProvider.' },
      {
        name: 'useOptionalPreferences',
        description:
          'Reads provider preferences when mounted and otherwise returns the static default preferences.',
      },
      {
        name: 'usePreferences',
        description:
          'Reads and updates persisted Glassy UI preferences: theme, mode, quality, reduceMotion, reduceTransparency and thickness (0.25 to 2, regular glass is 1). Requires GlassProvider.',
      },
      {
        name: 'LiquidFilters',
        description: 'Defines legacy shared SVG filters for CSS paths that still reference them.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-surface',
    name: 'Glass Surface',
    category: 'Surfaces',
    status: 'ready',
    route: '/components/glass-surface',
    description:
      'The glass material on its own: frost, rim light and refraction for your own components.',
    usage: `import { GlassSurface } from "@/components/glassyui/glass-surface";

export function SurfaceDemo() {
  return (
    <GlassSurface
      preset="prominent"
      refraction="soft"
      refractionBackground={<div className="absolute inset-0 bg-[linear-gradient(135deg,#f5f5f7_58%,#ff754c_63%,#f04a28_70%,#e5e5e7_75%)]" />}
      refractionBackgroundSpace="viewport"
      className="p-6"
    >
      Refractive surface
    </GlassSurface>
  );
}`,
    examples: [
      {
        title: 'Glass over a fixed wallpaper',
        live: 'fixed-wallpaper',
        code: `<div className="fixed inset-0 -z-10 bg-[url(/wallpaper.jpg)] bg-cover" />
<GlassSurface
  preset="showcase"
  refraction="strong"
  refractionBackground={<div className="absolute inset-0 bg-[url(/wallpaper.jpg)] bg-cover" />}
  refractionBackgroundSpace="viewport"
  className="p-10"
>
  Bends light
</GlassSurface>`,
      },
      {
        title: 'Static surface',
        code: `<GlassSurface interactive={false} preset="subtle">
  Static glass
</GlassSurface>`,
      },
    ],
    api: [
      { name: 'GlassSurface', description: 'Forward-ref surface component rendered as a div.' },
      {
        name: 'GlassSurfaceProps',
        description: 'Native div props plus Glassy UI material and refraction options.',
      },
      { name: 'SurfacePreset', description: 'Exported material preset type.' },
      { name: 'SurfaceRefraction', description: 'Exported none, soft, or strong refraction type.' },
      {
        name: 'preset',
        description: 'Material strength: subtle, standard, prominent, control, or showcase.',
      },
      {
        name: 'lens',
        description:
          'Chromium lens: the rim is a slab of glass that bends and splits the page behind it. On by default for the control and showcase presets, and for dialogs, popovers, sheets and menus.',
      },
      {
        name: 'thickness',
        description:
          'Glass thickness as a multiple of regular (1). Thicker glass widens the rim, bends the backdrop further and splits more colour. Defaults to the thickness preference. Works with a supplied backdrop in every browser, or with the Chromium lens over live content.',
      },
      {
        name: 'refraction',
        description:
          'Material level: none, soft, or strong. Generated refraction requires refractionBackground.',
      },
      {
        name: 'refractionBackground',
        description:
          'Decorative visual layer bent inside the surface; do not pass semantic or interactive content.',
      },
      {
        name: 'refractionBackgroundSpace',
        description:
          'Coordinate space for the supplied layer: local (default) or viewport. Viewport keeps the scene fixed while the surface scrolls.',
      },
      {
        name: 'refractionDisplacement',
        description:
          'Bend strength for supplied-background refraction, 72 for soft and 112 for strong by default. The rim bend is capped so it never mirrors the scene.',
      },
      {
        name: 'interactive',
        description: 'Brightens the surface a touch on hover. Defaults to false.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-panel',
    name: 'Glass Panel',
    category: 'Surfaces',
    status: 'ready',
    route: '/components/glass-panel',
    description: 'Glass cards, panels and pills for anything that floats above your content.',
    usage: `import { GlassPanel } from "@/components/glassyui/glass-panel";

export function PanelDemo() {
  return (
    <GlassPanel variant="card" elevation="raised">
      Panel content
    </GlassPanel>
  );
}`,
    examples: [
      {
        title: 'Pill panel',
        code: `<GlassPanel variant="pill" preset="control">
  Syncing
</GlassPanel>`,
      },
    ],
    api: [
      { name: 'GlassPanel', description: 'Forward-ref composed surface rendered as a div.' },
      { name: 'GlassPanelProps', description: 'Native div props plus panel composition options.' },
      { name: 'variant', description: 'Shape and spacing: panel, card, or pill.' },
      { name: 'elevation', description: 'Shadow and border level: base or raised.' },
      { name: 'preset', description: 'Material preset forwarded to GlassSurface.' },
      { name: 'lens', description: 'Chromium lens forwarded to GlassSurface.' },
      { name: 'thickness', description: 'Glass thickness forwarded to GlassSurface.' },
      {
        name: 'interactive',
        description: 'Brightens the panel a touch on hover. Defaults to false.',
      },
      { name: 'refraction', description: 'Material refraction level forwarded to GlassSurface.' },
      {
        name: 'refractionBackground',
        description: 'Decorative supplied background forwarded to GlassSurface.',
      },
      {
        name: 'refractionBackgroundSpace',
        description: 'Local or viewport scene alignment forwarded to GlassSurface.',
      },
      { name: 'refractionDisplacement', description: 'Bend strength forwarded to GlassSurface.' },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-header',
    name: 'Glass Header',
    category: 'Navigation',
    status: 'ready',
    isNew: true,
    route: '/components/glass-header',
    description: 'A floating glass capsule with a brand, navigation links and actions.',
    usage: `import { GlassHeader } from "@/components/glassyui/glass-header";
import { GlassButton } from "@/components/glassyui/glass-button";

export function Header() {
  return (
    <GlassHeader
      brand={<a href="/">Acme</a>}
      actions={
        <GlassButton asChild size="sm" variant="prominent">
          <a href="/start">Get started</a>
        </GlassButton>
      }
    >
      <a href="/features">Features</a>
      <a href="/pricing">Pricing</a>
      <a href="/docs">Docs</a>
    </GlassHeader>
  );
}`,
    examples: [
      {
        title: 'Inside a layout',
        code: `<GlassHeader brand={<a href="/">Acme</a>} position="static">
  <a href="/features">Features</a>
  <a href="/pricing" aria-current="page">Pricing</a>
</GlassHeader>`,
      },
    ],
    api: [
      { name: 'GlassHeader', description: 'A semantic header with a ref to its header element.' },
      {
        name: 'GlassHeaderProps',
        description: 'Native header attributes plus brand, actions, placement and condensing.',
      },
      { name: 'brand', description: 'A logo or wordmark, usually linked to the home page.' },
      {
        name: 'children',
        description: 'Navigation links. The same links appear in the mobile menu.',
      },
      { name: 'actions', description: 'Buttons or links on the right, visible at every width.' },
      {
        name: 'position',
        description:
          '"fixed" (default) floats 14px from the top; "static" stays in the surrounding layout.',
      },
      {
        name: 'condenseOnScroll',
        description:
          'Opens a fixed header out across the top of the page without glass and condenses it into the capsule once the page scrolls.',
      },
      {
        name: 'navigationLabel',
        description: 'Accessible name for the navigation, "Primary" by default.',
      },
    ],
    notes: [
      {
        title: 'Condense on scroll',
        body: 'With condenseOnScroll, the header spans up to 1200px at the top of the page with no glass behind its links. Once the page scrolls 8px, its glass forms and it springs into the 920px capsule; back at the top it opens again. Reduced motion switches shape without moving.',
      },
      {
        title: 'The action button',
        body: 'Actions can be any buttons or links. The usage example uses Glass Button; install it with `pnpm dlx shadcn@4.14.1 add @glassyui/glass-button`.',
      },
      {
        title: 'Make room for the header',
        body: 'The fixed capsule is 56px tall and up to 920px wide. Leave at least 84px above your page content.',
      },
      {
        title: 'A menu when space is tight',
        body: 'Below 780px of available width, the links move into a Menu disclosure. Escape closes the menu and returns focus; choosing a link also closes it. Supply links as children, with unique navigationLabel values when a page contains multiple headers.',
      },
      {
        title: 'Shared glass preferences',
        body: 'The header follows GlassProvider theme, thickness and reduced transparency preferences. Its glass uses the existing surface renderer.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-button',
    name: 'Glass Button',
    category: 'Controls',
    status: 'ready',
    route: '/components/glass-button',
    description:
      'A slab of glass resting just above the page that sets down when pressed and lights up where you press.',
    usage: `import { GlassButton } from "@/components/glassyui/glass-button";

export function ButtonDemo() {
  return <GlassButton>Save changes</GlassButton>;
}`,
    examples: [
      {
        title: 'Variants',
        code: `<div className="flex gap-3">
  <GlassButton variant="prominent">Prominent</GlassButton>
  <GlassButton variant="primary">Primary</GlassButton>
  <GlassButton variant="soft">Soft</GlassButton>
  <GlassButton variant="ghost">Ghost</GlassButton>
</div>`,
      },
      {
        title: 'As a link',
        code: `<GlassButton asChild variant="prominent">
  <a href="/pricing">See pricing</a>
</GlassButton>`,
      },
    ],
    api: [
      {
        name: 'GlassButton',
        description: 'Forward-ref HTML button with owned glass interaction state.',
      },
      {
        name: 'ButtonProps',
        description: 'HTML button props plus Glassy UI material options.',
      },
      {
        name: 'ButtonVariant',
        description: 'Exported primary, prominent, soft, or ghost visual-intent type.',
      },
      { name: 'ButtonSize', description: 'Exported sm, md, or lg size type.' },
      {
        name: 'variant',
        description:
          'Visual intent: primary (clear glass, the default), prominent (blue glass for the main action: it tints whatever lies behind it and keeps white text at 4.5:1), soft, or ghost.',
      },
      {
        name: 'asChild',
        description:
          'Renders the single child element, such as a link, with the button material. Links cannot be disabled.',
      },
      { name: 'size', description: 'Control size: sm, md, or lg.' },
      { name: 'preset', description: 'Material preset applied to the button surface.' },
      {
        name: 'lens',
        description:
          'Chromium lens: the rim bends and splits the page behind it. On by default for every variant except ghost.',
      },
    ],
    notes: [
      {
        title: 'Motion',
        body: 'The glass rests just above the page, lit from above. A pointer lowers it and a press sets it down, so its shadow draws in under it, and light spreads from the point you press. A pointer also swings the light along the rim of a prominent button over to the top left. Reduced motion moves it at once and drops the light.',
      },
      {
        title: 'Glass Scene',
        body: 'Inside a Glass Scene the canvas draws the button as real glass that bends the backdrop.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-input',
    name: 'Glass Input',
    category: 'Controls',
    status: 'ready',
    route: '/components/glass-input',
    description: 'A recessed glass text field with a label and an optional hint.',
    usage: `import { GlassInput } from "@/components/glassyui/glass-input";

export function InputDemo() {
  return <GlassInput label="Project" placeholder="Glassy UI" hint="Visible over glass." />;
}`,
    examples: [
      {
        title: 'Email input',
        code: `<GlassInput
  type="email"
  label="Email"
  placeholder="alex@example.com"
  hint="Used for registry updates."
/>`,
      },
    ],
    api: [
      { name: 'GlassInput', description: 'Forward-ref native input with optional label and hint.' },
      { name: 'GlassInputProps', description: 'Native input props plus label and hint options.' },
      { name: 'label', description: 'Optional visible label rendered above the input.' },
      { name: 'hint', description: 'Optional helper text rendered below the input.' },
      { name: 'type', description: 'Native input type. Defaults to text.' },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-checkbox',
    name: 'Glass Checkbox',
    category: 'Controls',
    isNew: true,
    status: 'ready',
    route: '/components/glass-checkbox',
    description:
      'A glass checkbox whose mark draws itself in and out, with an indeterminate state.',
    usage: `import { GlassCheckbox } from "@/components/glassyui/glass-checkbox";

export function CheckboxDemo() {
  return <GlassCheckbox defaultChecked label="Email me updates" description="One a month, at most." />;
}`,
    examples: [
      {
        title: 'A parent of several choices',
        code: `<GlassCheckbox
  checked={all ? true : none ? false : "indeterminate"}
  label="All channels"
  onCheckedChange={(checked) => setChannels(checked === true ? CHANNELS : [])}
/>`,
      },
      {
        title: 'Without a visible label',
        code: `<GlassCheckbox aria-label="Select row" size="sm" />`,
      },
    ],
    api: [
      {
        name: 'GlassCheckbox',
        description: 'Forward-ref Radix checkbox with an optional label and description.',
      },
      {
        name: 'GlassCheckboxProps',
        description: 'Radix checkbox props plus label, description and size.',
      },
      { name: 'label', description: 'Text beside the box. Clicking it toggles the box.' },
      {
        name: 'description',
        description: 'A muted line under the label, linked with aria-describedby.',
      },
      { name: 'size', description: 'md (default) or sm.' },
      {
        name: 'checked',
        description: 'true, false or "indeterminate". Also defaultChecked and onCheckedChange.',
      },
    ],
    notes: [
      {
        title: 'Motion',
        body: 'The tick is a stroke that draws itself and the fill fades, in both directions, so clearing a box moves as smoothly as ticking it. Reduced motion shows the end state at once.',
      },
      {
        title: 'Accessibility',
        body: 'Space toggles. Without a label, name the box with aria-label. Forced colours use the system highlight.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-radio-group',
    name: 'Glass Radio Group',
    category: 'Controls',
    isNew: true,
    status: 'ready',
    route: '/components/glass-radio-group',
    description: 'Options where exactly one is chosen, with a dot that pops in and shrinks away.',
    usage: `import { GlassRadioGroup, GlassRadioGroupItem } from "@/components/glassyui/glass-radio-group";

export function PlanDemo() {
  return (
    <GlassRadioGroup aria-label="Plan" defaultValue="pro">
      <GlassRadioGroupItem value="starter" label="Starter" />
      <GlassRadioGroupItem value="pro" label="Pro" description="For teams shipping weekly." />
    </GlassRadioGroup>
  );
}`,
    examples: [
      {
        title: 'Controlled',
        code: `<GlassRadioGroup aria-label="Plan" value={plan} onValueChange={setPlan}>
  {PLANS.map((item) => (
    <GlassRadioGroupItem key={item.value} value={item.value} label={item.label} />
  ))}
</GlassRadioGroup>`,
      },
    ],
    api: [
      {
        name: 'GlassRadioGroup',
        description: 'Radix radio group. The arrow keys move the choice.',
      },
      {
        name: 'GlassRadioGroupItem',
        description: 'One option, with an optional label and description.',
      },
      { name: 'value / onValueChange', description: 'Controlled choice. Also defaultValue.' },
      { name: 'label', description: 'Text beside the button. Clicking it chooses the option.' },
      { name: 'description', description: 'A muted line under the label.' },
    ],
    notes: [
      {
        title: 'Accessibility',
        body: 'Name the group with aria-label or aria-labelledby. Tab enters the group and the arrow keys move within it.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-textarea',
    name: 'Glass Textarea',
    category: 'Controls',
    isNew: true,
    status: 'ready',
    route: '/components/glass-textarea',
    description: 'A recessed glass field for longer text that can grow as you type.',
    usage: `import { GlassTextarea } from "@/components/glassyui/glass-textarea";

export function MessageDemo() {
  return <GlassTextarea autoResize label="Message" hint="Grows as you type." placeholder="Say hello…" />;
}`,
    examples: [
      {
        title: 'Limit the growth',
        code: `<GlassTextarea autoResize maxRows={5} label="Notes" />`,
      },
      {
        title: 'Fixed height with a resize handle',
        code: `<GlassTextarea rows={6} label="Bio" />`,
      },
    ],
    api: [
      { name: 'GlassTextarea', description: 'Forward-ref native textarea styled like GlassInput.' },
      {
        name: 'GlassTextareaProps',
        description: 'Native textarea props plus label, hint, autoResize and maxRows.',
      },
      { name: 'label', description: 'Optional visible label rendered above the field.' },
      { name: 'hint', description: 'Optional helper text rendered below the field.' },
      { name: 'autoResize', description: 'Grows with its text, up to maxRows, then scrolls.' },
      {
        name: 'maxRows',
        description: 'The most rows an auto-resizing textarea grows to. Defaults to 8.',
      },
    ],
    notes: [
      {
        title: 'Rewrapping',
        body: 'An auto-resizing field fits again when its width changes and the text rewraps.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-select',
    name: 'Glass Select',
    category: 'Controls',
    isNew: true,
    status: 'ready',
    route: '/components/glass-select',
    description: 'A recessed trigger that opens a slab of glass to choose from.',
    usage: `import {
  GlassSelect,
  GlassSelectContent,
  GlassSelectItem,
  GlassSelectTrigger,
  GlassSelectValue,
} from "@/components/glassyui/glass-select";

export function FrameworkDemo() {
  return (
    <GlassSelect>
      <GlassSelectTrigger aria-label="Framework">
        <GlassSelectValue placeholder="Choose a framework" />
      </GlassSelectTrigger>
      <GlassSelectContent>
        <GlassSelectItem value="next">Next.js</GlassSelectItem>
        <GlassSelectItem value="remix">Remix</GlassSelectItem>
      </GlassSelectContent>
    </GlassSelect>
  );
}`,
    examples: [
      {
        title: 'Groups and separators',
        code: `<GlassSelectContent>
  <GlassSelectGroup>
    <GlassSelectLabel>React</GlassSelectLabel>
    <GlassSelectItem value="next">Next.js</GlassSelectItem>
  </GlassSelectGroup>
  <GlassSelectSeparator />
  <GlassSelectGroup>
    <GlassSelectLabel>Other</GlassSelectLabel>
    <GlassSelectItem value="astro">Astro</GlassSelectItem>
  </GlassSelectGroup>
</GlassSelectContent>`,
      },
    ],
    api: [
      {
        name: 'GlassSelect',
        description: 'Radix select root. value, onValueChange, defaultValue, disabled and name.',
      },
      {
        name: 'GlassSelectTrigger',
        description: 'The closed field. Name it with aria-label or a label element.',
      },
      { name: 'GlassSelectValue', description: 'Shows the chosen item, or the placeholder.' },
      {
        name: 'GlassSelectContent',
        description: 'The open list, as wide as the trigger. Edge lens on Chromium.',
      },
      {
        name: 'GlassSelectItem',
        description: 'One option. value is required and cannot be empty.',
      },
      {
        name: 'GlassSelectGroup / GlassSelectLabel / GlassSelectSeparator',
        description: 'Group options under a heading.',
      },
    ],
    notes: [
      {
        title: 'Keyboard',
        body: 'Arrow keys move, typing jumps to a matching item, Enter or Space chooses and Escape closes.',
      },
      {
        title: 'Forms',
        body: 'With a name, the select submits its value in a native form and takes part in form resets.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-tabs',
    name: 'Glass Tabs',
    category: 'Navigation',
    status: 'ready',
    route: '/components/glass-tabs',
    description: 'Tabs whose glass bubble stretches like a drop on its way to the selected tab.',
    usage: `import { GlassTabs, GlassTabsContent, GlassTabsList, GlassTabsTrigger } from "@/components/glassyui/glass-tabs";

export function TabsDemo() {
  return (
    <GlassTabs defaultValue="preview">
      <GlassTabsList>
        <GlassTabsTrigger value="preview">Preview</GlassTabsTrigger>
        <GlassTabsTrigger value="code">Code</GlassTabsTrigger>
      </GlassTabsList>
      <GlassTabsContent value="preview">Glass preview</GlassTabsContent>
      <GlassTabsContent value="code">Copy-ready code</GlassTabsContent>
    </GlassTabs>
  );
}`,
    examples: [{ title: 'Default tab', code: `<GlassTabs defaultValue="preview">...</GlassTabs>` }],
    api: [
      { name: 'GlassTabs', description: 'Radix Tabs root.' },
      { name: 'GlassTabsList', description: 'Glass pill list for triggers.' },
      {
        name: 'GlassTabsTrigger',
        description: 'Semantic Radix trigger with active glass styling.',
      },
      { name: 'GlassTabsContent', description: 'Panel-backed tab content.' },
    ],
    notes: [
      {
        title: 'Motion',
        body: 'One glass bubble serves the whole list. It lifts, stretches toward the new tab and settles with a small bounce. Until scripts run, the active tab draws its own bubble. Reduced motion moves it straight there.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-dialog',
    name: 'Glass Dialog',
    category: 'Overlays',
    status: 'ready',
    route: '/components/glass-dialog',
    description: 'A modal on raised glass that holds focus until it closes.',
    usage: `import { GlassDialog, GlassDialogContent, GlassDialogTitle, GlassDialogTrigger } from "@/components/glassyui/glass-dialog";

export function DialogDemo() {
  return (
    <GlassDialog>
      <GlassDialogTrigger>Open</GlassDialogTrigger>
      <GlassDialogContent>
        <GlassDialogTitle>Glass dialog</GlassDialogTitle>
      </GlassDialogContent>
    </GlassDialog>
  );
}`,
    examples: [
      { title: 'Modal content', code: `<GlassDialogContent>Modal content</GlassDialogContent>` },
    ],
    api: [
      { name: 'GlassDialog', description: 'Radix Dialog root.' },
      { name: 'GlassDialogTrigger', description: 'Radix trigger primitive.' },
      { name: 'GlassDialogPortal', description: 'Radix portal primitive.' },
      { name: 'GlassDialogOverlay', description: 'Styled modal overlay.' },
      {
        name: 'GlassDialogContent',
        description: 'Portal, overlay, named close button, and glass panel content.',
      },
      {
        name: 'GlassDialogContentProps',
        description: 'Radix content props plus an optional closeLabel and thickness.',
      },
      { name: 'GlassDialogTitle', description: 'Radix accessible dialog title.' },
      { name: 'GlassDialogDescription', description: 'Radix accessible dialog description.' },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-popover',
    name: 'Glass Popover',
    category: 'Overlays',
    status: 'ready',
    route: '/components/glass-popover',
    description: 'Floating glass content anchored to the control that opens it.',
    usage: `import { GlassPopover, GlassPopoverContent, GlassPopoverTrigger } from "@/components/glassyui/glass-popover";

export function PopoverDemo() {
  return (
    <GlassPopover>
      <GlassPopoverTrigger>Open</GlassPopoverTrigger>
      <GlassPopoverContent>Glass popover</GlassPopoverContent>
    </GlassPopover>
  );
}`,
    examples: [
      {
        title: 'Side offset',
        code: `<GlassPopoverContent sideOffset={16}>Content</GlassPopoverContent>`,
      },
    ],
    api: [
      { name: 'GlassPopover', description: 'Radix Popover root.' },
      { name: 'GlassPopoverTrigger', description: 'Radix trigger primitive.' },
      { name: 'GlassPopoverAnchor', description: 'Radix anchor primitive for custom positioning.' },
      { name: 'GlassPopoverContent', description: 'Portal-backed glass content.' },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-tooltip',
    name: 'Glass Tooltip',
    category: 'Feedback',
    status: 'ready',
    route: '/components/glass-tooltip',
    description: 'A small glass label that appears on hover and keyboard focus.',
    usage: `import { GlassTooltip, GlassTooltipContent, GlassTooltipProvider, GlassTooltipTrigger } from "@/components/glassyui/glass-tooltip";

export function TooltipDemo() {
  return (
    <GlassTooltipProvider>
      <GlassTooltip>
        <GlassTooltipTrigger>Hover</GlassTooltipTrigger>
        <GlassTooltipContent>Tooltip content</GlassTooltipContent>
      </GlassTooltip>
    </GlassTooltipProvider>
  );
}`,
    examples: [{ title: 'Short hint', code: `<GlassTooltipContent>Copied</GlassTooltipContent>` }],
    api: [
      { name: 'GlassTooltipProvider', description: 'Radix Tooltip provider.' },
      { name: 'GlassTooltip', description: 'Radix Tooltip root.' },
      { name: 'GlassTooltipTrigger', description: 'Radix trigger primitive.' },
      { name: 'GlassTooltipContent', description: 'Glass panel tooltip content with arrow.' },
    ],
    notes: [
      {
        title: 'Motion',
        body: 'A tip settles in from the side it opens toward and fades out again. Moving to the next trigger skips the entrance, so the tip follows you. Reduced motion shows and hides it at once.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-toast',
    name: 'Glass Toast',
    category: 'Feedback',
    status: 'ready',
    route: '/components/glass-toast',
    description: 'A glass notification for brief updates, announced to screen readers.',
    usage: `import { GlassToast, GlassToastDescription, GlassToastProvider, GlassToastTitle, GlassToastViewport } from "@/components/glassyui/glass-toast";

export function ToastDemo() {
  return (
    <GlassToastProvider>
      <GlassToast open>
        <GlassToastTitle>Saved</GlassToastTitle>
        <GlassToastDescription>Your changes are stored.</GlassToastDescription>
      </GlassToast>
      <GlassToastViewport />
    </GlassToastProvider>
  );
}`,
    examples: [
      {
        title: 'A dismiss button',
        code: `<GlassToast>
  <GlassToastTitle>Saved</GlassToastTitle>
  <GlassToastDescription>Your changes are stored.</GlassToastDescription>
  <GlassToastClose />
</GlassToast>`,
      },
      {
        title: 'An action',
        code: `<GlassToast>
  <GlassToastTitle>Message deleted</GlassToastTitle>
  <GlassToastAction altText="Undo the delete" onClick={undo}>
    Undo
  </GlassToastAction>
</GlassToast>`,
      },
    ],
    api: [
      { name: 'GlassToastProvider', description: 'Radix Toast provider.' },
      { name: 'GlassToast', description: 'Glass panel toast root.' },
      { name: 'GlassToastViewport', description: 'Fixed viewport for toast placement.' },
      { name: 'GlassToastTitle', description: 'Styled Radix toast title.' },
      { name: 'GlassToastDescription', description: 'Styled Radix toast description.' },
      {
        name: 'GlassToastClose',
        description:
          'A round dismiss button that draws its own ×. Named "Dismiss" unless you pass aria-label.',
      },
      {
        name: 'GlassToastAction',
        description:
          'A pill under the message, such as Undo. altText says how to do it without the button.',
      },
    ],
    notes: [
      {
        title: 'Motion',
        body: "A toast slides in from the side its swipe direction points to (the right unless the provider's swipeDirection says otherwise) and back out when it closes. Drag it that way to dismiss it: a short drag springs back and a fling sends it away. Reduced motion shows and hides it at once.",
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-accordion',
    name: 'Glass Accordion',
    category: 'Navigation',
    status: 'ready',
    route: '/components/glass-accordion',
    description: 'Sections that expand and collapse on glass, one at a time or several.',
    usage: `import { GlassAccordion, GlassAccordionContent, GlassAccordionItem, GlassAccordionTrigger } from "@/components/glassyui/glass-accordion";

export function AccordionDemo() {
  return (
    <GlassAccordion type="single" collapsible>
      <GlassAccordionItem value="item-1">
        <GlassAccordionTrigger>Can I customize it?</GlassAccordionTrigger>
        <GlassAccordionContent>Yes. It is source-copy code.</GlassAccordionContent>
      </GlassAccordionItem>
    </GlassAccordion>
  );
}`,
    examples: [
      {
        title: 'Single item',
        code: `<GlassAccordion type="single" collapsible>...</GlassAccordion>`,
      },
    ],
    api: [
      { name: 'GlassAccordion', description: 'Radix Accordion root.' },
      { name: 'GlassAccordionItem', description: 'Radix Accordion item.' },
      { name: 'GlassAccordionTrigger', description: 'Glass trigger inside a Radix header.' },
      { name: 'GlassAccordionContent', description: 'Panel-backed collapsible content.' },
    ],
    notes: [
      {
        title: 'Motion',
        body: 'The card opens and closes like a curtain, and the chevron turns with it. Reduced motion opens and closes it at once.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-switch',
    name: 'Glass Switch',
    category: 'Controls',
    status: 'ready',
    route: '/components/glass-switch',
    description: 'An on/off switch whose knob turns to glass and stretches as it slides.',
    usage: `import { GlassSwitch } from "@/components/glassyui/glass-switch";

export function SwitchDemo() {
  return <GlassSwitch aria-label="Notifications" defaultChecked />;
}`,
    examples: [
      {
        title: 'With a visible label',
        code: `<label className="flex items-center justify-between gap-4 select-none">
  Autosave
  <GlassSwitch />
</label>`,
      },
      { title: 'Small', code: `<GlassSwitch aria-label="Mute" size="sm" />` },
    ],
    api: [
      { name: 'GlassSwitch', description: 'Forward-ref Radix Switch root with a glass thumb.' },
      { name: 'GlassSwitchProps', description: 'Radix Switch root props plus size.' },
      { name: 'size', description: 'Track size: sm or md. Defaults to md.' },
      { name: 'checked / defaultChecked', description: 'Controlled or uncontrolled on state.' },
      { name: 'onCheckedChange', description: 'Called with the next checked value.' },
    ],
    notes: [
      {
        title: 'Accessibility',
        body: 'Renders a button with role switch. Name it with aria-label or wrap it in a visible label.',
      },
      {
        title: 'Motion',
        body: 'The knob turns to clear glass while pressed and stretches like a drop as it slides. Reduced motion keeps the colour change and drops the travel.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-slider',
    name: 'Glass Slider',
    category: 'Controls',
    status: 'ready',
    route: '/components/glass-slider',
    description: 'A slider whose glass thumb stretches with your drag, for one value or a range.',
    usage: `import { GlassSlider } from "@/components/glassyui/glass-slider";

export function SliderDemo() {
  return <GlassSlider aria-label="Volume" defaultValue={[60]} max={100} step={1} />;
}`,
    examples: [
      {
        title: 'Range',
        code: `<GlassSlider
  aria-label="Price"
  defaultValue={[20, 80]}
  thumbLabels={["Minimum price", "Maximum price"]}
/>`,
      },
    ],
    api: [
      {
        name: 'GlassSlider',
        description: 'Forward-ref Radix Slider root with a track, range, and one thumb per value.',
      },
      { name: 'GlassSliderProps', description: 'Radix Slider root props plus thumbLabels.' },
      {
        name: 'thumbLabels',
        description:
          'Accessible names for the thumbs in value order. A single thumb uses the slider aria-label.',
      },
      {
        name: 'value / defaultValue',
        description: 'Controlled or uncontrolled values; the array length sets the thumb count.',
      },
      {
        name: 'onValueChange / onValueCommit',
        description: 'Called while dragging and when a drag ends.',
      },
    ],
    notes: [
      {
        title: 'Accessibility',
        body: 'Each thumb is a separate slider. Range thumbs default to minimum and maximum names built from the slider label.',
      },
      {
        title: 'Motion',
        body: 'The thumb swells into clear glass while dragged and stretches along the track with your speed. Reduced motion keeps its shape.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-segmented-control',
    name: 'Glass Segmented Control',
    category: 'Controls',
    status: 'ready',
    route: '/components/glass-segmented-control',
    description:
      'A single-choice control whose glass bubble stretches between options and can be dragged.',
    usage: `import { GlassSegmentedControl, GlassSegmentedControlItem } from "@/components/glassyui/glass-segmented-control";

export function SegmentedDemo() {
  return (
    <GlassSegmentedControl aria-label="View" defaultValue="week">
      <GlassSegmentedControlItem value="day">Day</GlassSegmentedControlItem>
      <GlassSegmentedControlItem value="week">Week</GlassSegmentedControlItem>
      <GlassSegmentedControlItem value="month">Month</GlassSegmentedControlItem>
    </GlassSegmentedControl>
  );
}`,
    examples: [
      {
        title: 'Controlled',
        code: `const [view, setView] = useState("list");

<GlassSegmentedControl aria-label="Layout" value={view} onValueChange={setView}>
  <GlassSegmentedControlItem value="list">List</GlassSegmentedControlItem>
  <GlassSegmentedControlItem value="grid">Grid</GlassSegmentedControlItem>
</GlassSegmentedControl>`,
      },
    ],
    api: [
      {
        name: 'GlassSegmentedControl',
        description: 'Radix RadioGroup root on a glass pill with the liquid bubble.',
      },
      { name: 'GlassSegmentedControlItem', description: 'Radix RadioGroup item; one per option.' },
      { name: 'GlassSegmentedControlProps', description: 'Radix RadioGroup root props.' },
      { name: 'value / defaultValue', description: 'Controlled or uncontrolled selected option.' },
    ],
    notes: [
      {
        title: 'Layout',
        body: 'Options share the width equally. CSS positions the bubble from the checked item, so it is right from the first server render.',
      },
      {
        title: 'Motion',
        body: 'The bubble lifts and stretches toward the new option while the labels stay fixed. Drag it to another option to choose that one. Reduced motion moves it straight there.',
      },
      {
        title: 'Keyboard',
        body: 'Arrow keys move the selection, as in any radio group. Name the group with aria-label.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-badge',
    name: 'Glass Badge',
    category: 'Feedback',
    status: 'ready',
    route: '/components/glass-badge',
    description: 'A small tinted glass label for status, counts and categories.',
    usage: `import { GlassBadge } from "@/components/glassyui/glass-badge";

export function BadgeDemo() {
  return <GlassBadge tone="green" dot>Live</GlassBadge>;
}`,
    examples: [
      {
        title: 'Tones',
        code: `<GlassBadge>Draft</GlassBadge>
<GlassBadge tone="blue">New</GlassBadge>
<GlassBadge tone="orange">Beta</GlassBadge>
<GlassBadge tone="red">3 failed</GlassBadge>
<GlassBadge tone="blue">Pro</GlassBadge>`,
      },
    ],
    api: [
      { name: 'GlassBadge', description: 'Forward-ref span with a tinted glass fill.' },
      { name: 'GlassBadgeProps', description: 'Native span props plus dot and tone.' },
      { name: 'GlassBadgeTone', description: 'neutral, blue, green, orange, red, or purple.' },
      { name: 'dot', description: 'Adds a leading status dot in the tone colour.' },
    ],
    notes: [
      {
        title: 'Rendering',
        body: 'A plain span with no client JavaScript, so it works in server components.',
      },
      { title: 'Contrast', body: 'Tone text colours are tuned for 4.5:1 contrast on both themes.' },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-progress',
    name: 'Glass Progress',
    category: 'Feedback',
    isNew: true,
    status: 'ready',
    route: '/components/glass-progress',
    description:
      'A glass track with a fill that slides to its value, or sweeps when the length is unknown.',
    usage: `import { GlassProgress } from "@/components/glassyui/glass-progress";

export function UploadDemo() {
  return <GlassProgress label="Uploading" showValue value={62} />;
}`,
    examples: [
      {
        title: 'Unknown length',
        code: `<GlassProgress aria-label="Working" value={null} />`,
      },
      {
        title: 'Sizes',
        code: `<GlassProgress size="sm" value={30} aria-label="Small" />
<GlassProgress size="lg" value={70} aria-label="Large" />`,
      },
    ],
    api: [
      { name: 'GlassProgress', description: 'A progressbar with a glass track and fill.' },
      {
        name: 'value',
        description: 'How far along. Leave it out, or pass null, when the length is unknown.',
      },
      { name: 'max', description: 'The value that means done. Defaults to 100.' },
      { name: 'label', description: 'Text above the bar. It also names the bar.' },
      { name: 'showValue', description: 'Shows the percentage beside the label.' },
      { name: 'size', description: 'sm, md (default) or lg.' },
    ],
    notes: [
      {
        title: 'Motion',
        body: 'The fill slides with a soft ease. A bar of unknown length sweeps at 30 frames a second, which spares the GPU. Reduced motion jumps to the value and holds a short fill in the middle instead of sweeping.',
      },
      {
        title: 'Accessibility',
        body: 'The track is a progressbar with aria-valuenow, or none when the length is unknown. Give it a label or aria-label.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-spinner',
    name: 'Glass Spinner',
    category: 'Feedback',
    isNew: true,
    status: 'ready',
    route: '/components/glass-spinner',
    description: 'A ring with a fading tail, for waiting on something short.',
    usage: `import { GlassSpinner } from "@/components/glassyui/glass-spinner";

export function SavingDemo() {
  return <GlassSpinner label="Saving" />;
}`,
    examples: [
      {
        title: 'Inside a button',
        code: `<GlassButton disabled>
  <GlassSpinner size="sm" label="Saving" />
  Saving…
</GlassButton>`,
      },
    ],
    api: [
      { name: 'GlassSpinner', description: 'A status element with a rotating ring.' },
      { name: 'label', description: 'Read out by screen readers. Defaults to Loading.' },
      { name: 'size', description: 'sm, md (default) or lg.' },
    ],
    notes: [
      {
        title: 'Colour',
        body: 'The ring takes its colour from the surrounding text, so it suits any button or surface.',
      },
      {
        title: 'Reduced motion',
        body: 'The ring stops turning. Its label still tells assistive technology that work is under way.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-skeleton',
    name: 'Glass Skeleton',
    category: 'Feedback',
    isNew: true,
    status: 'ready',
    route: '/components/glass-skeleton',
    description: 'A quiet glass placeholder with a slow sheen, shaped like what will replace it.',
    usage: `import { GlassSkeleton } from "@/components/glassyui/glass-skeleton";

export function LoadingProfile() {
  return (
    <div aria-busy="true">
      <GlassSkeleton variant="circle" />
      <GlassSkeleton variant="text" lines={2} />
    </div>
  );
}`,
    examples: [
      {
        title: 'Size a block with CSS',
        code: `<GlassSkeleton style={{ height: 120, borderRadius: 20 }} />`,
      },
    ],
    api: [
      {
        name: 'GlassSkeleton',
        description: 'A placeholder block. It is hidden from assistive technology.',
      },
      {
        name: 'variant',
        description:
          'block (default, sized with CSS), circle (square and round) or text (a stack of lines).',
      },
      {
        name: 'lines',
        description: 'How many lines a text skeleton draws. The last is shorter. Defaults to 3.',
      },
    ],
    notes: [
      {
        title: 'Accessibility',
        body: 'Skeletons are aria-hidden. Set aria-busy on the region that is loading so assistive technology knows to wait.',
      },
      {
        title: 'Motion',
        body: 'The sheen is a single transform per skeleton, stepped at 30 frames a second to spare the GPU. Reduced motion leaves the placeholders still.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-alert',
    name: 'Glass Alert',
    category: 'Feedback',
    isNew: true,
    status: 'ready',
    route: '/components/glass-alert',
    description: 'A short message set in tinted glass, with four tones and an optional dismiss.',
    usage: `import { GlassAlert } from "@/components/glassyui/glass-alert";

export function TrialAlert() {
  return <GlassAlert title="Heads up">Your trial ends in three days.</GlassAlert>;
}`,
    examples: [
      {
        title: 'Tones',
        code: `<GlassAlert tone="success" title="Saved">Every change is in.</GlassAlert>
<GlassAlert tone="warning" title="Almost full">92% of your storage is used.</GlassAlert>
<GlassAlert tone="danger" title="Payment failed">Update your card.</GlassAlert>`,
      },
      {
        title: 'Dismissible',
        code: `<GlassAlert title="New version" onDismiss={() => setShown(false)}>
  Reload to get it.
</GlassAlert>`,
      },
    ],
    api: [
      {
        name: 'GlassAlert',
        description: 'Forward-ref div with a tone icon, title and description.',
      },
      { name: 'tone', description: 'info (default), success, warning or danger.' },
      { name: 'title', description: 'A short bold line above the message.' },
      { name: 'icon', description: 'Replaces the tone icon. Pass false for none.' },
      {
        name: 'onDismiss',
        description:
          'Shows a close button. The alert folds away, then this runs: remove the alert there, and give each alert a stable key so a later one never inherits the fold.',
      },
      { name: 'dismissLabel', description: 'Names the close button. Defaults to Dismiss.' },
    ],
    notes: [
      {
        title: 'Announcements',
        body: 'Warnings and errors use role="alert" and interrupt screen readers. Info and success use role="status" and wait. Override with role.',
      },
      {
        title: 'Contrast',
        body: 'Every tone keeps 4.5:1 text contrast over a pure black or pure white backdrop in both themes.',
      },
      {
        title: 'Motion',
        body: "Dismissing folds the alert to nothing, so what sits below it slides up instead of jumping. Its own padding and margin fold with it; space that comes from a parent's gap cannot, so put the space between stacked alerts in a margin on the alert. Reduced motion removes it at once.",
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-avatar',
    name: 'Glass Avatar',
    category: 'Surfaces',
    isNew: true,
    status: 'ready',
    route: '/components/glass-avatar',
    description:
      'A round photo that falls back to coloured initials, with a presence dot and stacked groups.',
    usage: `import { GlassAvatar } from "@/components/glassyui/glass-avatar";

export function PersonDemo() {
  return <GlassAvatar name="Ada Lovelace" src="/ada.jpg" status="online" />;
}`,
    examples: [
      {
        title: 'A stacked group',
        code: `<GlassAvatarGroup max={4} aria-label="Team">
  {people.map((person) => (
    <GlassAvatar key={person} name={person} />
  ))}
</GlassAvatarGroup>`,
      },
    ],
    api: [
      {
        name: 'GlassAvatar',
        description: 'A Radix avatar with glass rim, coloured initials and a status dot.',
      },
      {
        name: 'name',
        description:
          'Names the person. Its initials fill in for a missing image and pick a stable colour.',
      },
      { name: 'src / alt', description: 'The photo and its description. alt defaults to name.' },
      { name: 'fallback', description: 'Replaces the initials.' },
      { name: 'size', description: 'xs, sm, md (default), lg or xl.' },
      {
        name: 'status',
        description: 'online, away, busy or offline: a presence dot on the corner.',
      },
      {
        name: 'GlassAvatarGroup',
        description:
          'Stacks avatars edge to edge. max shows a +N for the rest; size sizes all of them.',
      },
    ],
    notes: [
      {
        title: 'Cut, not ringed',
        body: 'A status dot or an overlapping neighbour cuts the circle away with a mask instead of drawing a ring in a background colour, so it works over any glass or wallpaper.',
      },
      {
        title: 'Accessibility',
        body: 'The avatar is one image named by alt or name, plus its status. Initials are hidden from assistive technology.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-kbd',
    name: 'Glass Kbd',
    category: 'Surfaces',
    isNew: true,
    status: 'ready',
    route: '/components/glass-kbd',
    description: 'A keycap with a lit top edge, for shortcuts in menus, hints and docs.',
    usage: `import { GlassKbd, GlassKbdGroup } from "@/components/glassyui/glass-kbd";

export function SearchHint() {
  return (
    <GlassKbdGroup>
      <GlassKbd>⌘</GlassKbd>
      <GlassKbd>K</GlassKbd>
    </GlassKbdGroup>
  );
}`,
    examples: [
      {
        title: 'A single key',
        code: `<GlassKbd>esc</GlassKbd>`,
      },
    ],
    api: [
      {
        name: 'GlassKbd',
        description: 'A kbd element styled as a keycap. One key or symbol in each.',
      },
      { name: 'GlassKbdGroup', description: 'Sets a shortcut’s keys side by side.' },
    ],
    notes: [
      {
        title: 'Rendering',
        body: 'Plain elements with no client JavaScript, so they work in server components.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-dock',
    name: 'Glass Dock',
    category: 'Navigation',
    status: 'ready',
    route: '/components/glass-dock',
    description: 'A row of app icons on a glass shelf that name themselves on hover.',
    examples: [
      {
        title: 'Render the copied example',
        code: `import { DockExample } from "./dock-example";

export default function Page() {
  return <DockExample />;
}`,
      },
    ],
    api: [
      { name: 'GlassDock', description: 'Glass shelf under a row of items.' },
      {
        name: 'GlassDockItem',
        description: 'Icon button with a hover label and a running indicator.',
      },
      {
        name: 'label',
        description: 'Required accessible name, also shown above the icon on hover.',
      },
      { name: 'active', description: 'Shows the running dot under the icon.' },
      { name: 'asChild', description: 'Renders the single child, such as a link, as the item.' },
      { name: 'GlassDockSeparator', description: 'Vertical divider between item groups.' },
    ],
    notes: [
      {
        title: 'Input',
        body: 'Icons keep their size wherever the pointer is. Hover or keyboard focus shows the label. A click or tap opens an item without taking keyboard focus, so only Tab draws the focus ring.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-breadcrumb',
    name: 'Glass Breadcrumb',
    category: 'Navigation',
    isNew: true,
    status: 'ready',
    route: '/components/glass-breadcrumb',
    description:
      'The trail to the current page, with links that lift on hover and folded steps in a menu.',
    usage: `import {
  GlassBreadcrumb,
  GlassBreadcrumbItem,
  GlassBreadcrumbLink,
  GlassBreadcrumbPage,
} from "@/components/glassyui/glass-breadcrumb";

export function Trail() {
  return (
    <GlassBreadcrumb>
      <GlassBreadcrumbItem>
        <GlassBreadcrumbLink href="/">Home</GlassBreadcrumbLink>
      </GlassBreadcrumbItem>
      <GlassBreadcrumbItem>
        <GlassBreadcrumbPage>Components</GlassBreadcrumbPage>
      </GlassBreadcrumbItem>
    </GlassBreadcrumb>
  );
}`,
    examples: [
      {
        title: 'With a router link',
        code: `<GlassBreadcrumbLink asChild>
  <Link href="/docs">Docs</Link>
</GlassBreadcrumbLink>`,
      },
      {
        title: 'Fold steps into a menu',
        code: `<GlassBreadcrumbItem>
  <GlassMenu>
    <GlassMenuTrigger asChild>
      <GlassBreadcrumbEllipsis />
    </GlassMenuTrigger>
    <GlassMenuContent align="start">
      <GlassMenuItem>Docs</GlassMenuItem>
    </GlassMenuContent>
  </GlassMenu>
</GlassBreadcrumbItem>`,
      },
    ],
    api: [
      {
        name: 'GlassBreadcrumb',
        description: 'A nav landmark labelled Breadcrumb, holding an ordered list.',
      },
      {
        name: 'GlassBreadcrumbItem',
        description: 'One step. It draws the chevron after itself, except on the last.',
      },
      {
        name: 'GlassBreadcrumbLink',
        description: 'A link step. asChild renders your own link, such as a router’s.',
      },
      {
        name: 'GlassBreadcrumbPage',
        description: 'The current page, as text with aria-current="page".',
      },
      {
        name: 'GlassBreadcrumbEllipsis',
        description: 'A button that stands in for folded steps, so it can open a menu of them.',
      },
    ],
    notes: [
      {
        title: 'Rendering',
        body: 'Plain elements with no client JavaScript, so it works in server components.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-pagination',
    name: 'Glass Pagination',
    category: 'Navigation',
    isNew: true,
    status: 'ready',
    route: '/components/glass-pagination',
    description: 'Numbered pages with previous and next, folding long runs into an ellipsis.',
    usage: `import { GlassPagination } from "@/components/glassyui/glass-pagination";

export function Pages() {
  const [page, setPage] = useState(1);

  return <GlassPagination page={page} pageCount={12} onPageChange={setPage} />;
}`,
    examples: [
      {
        title: 'Show more neighbours',
        code: `<GlassPagination page={page} pageCount={40} siblingCount={2} onPageChange={setPage} />`,
      },
    ],
    api: [
      {
        name: 'GlassPagination',
        description: 'A nav landmark labelled Pagination, with a button for each page.',
      },
      { name: 'page', description: 'The current page, counting from 1.' },
      { name: 'pageCount', description: 'How many pages there are.' },
      { name: 'onPageChange', description: 'Called with the page to show.' },
      {
        name: 'siblingCount / boundaryCount',
        description:
          'Pages shown either side of the current one, and at each end. Both default to 1.',
      },
      {
        name: 'previousLabel / nextLabel',
        description: 'Name the step buttons. Default to Previous page and Next page.',
      },
    ],
    notes: [
      {
        title: 'Accessibility',
        body: 'Each page button is named Page N and the current one carries aria-current="page". The step buttons disable at the ends.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-sheet',
    name: 'Glass Sheet',
    category: 'Overlays',
    status: 'ready',
    route: '/components/glass-sheet',
    description: 'A glass panel that slides in from an edge. Bottom sheets drag down to dismiss.',
    usage: `import { GlassSheet, GlassSheetContent, GlassSheetDescription, GlassSheetTitle, GlassSheetTrigger } from "@/components/glassyui/glass-sheet";

export function SheetDemo() {
  return (
    <GlassSheet>
      <GlassSheetTrigger>Share</GlassSheetTrigger>
      <GlassSheetContent>
        <GlassSheetTitle>Share photo</GlassSheetTitle>
        <GlassSheetDescription>Send it to a nearby device.</GlassSheetDescription>
      </GlassSheetContent>
    </GlassSheet>
  );
}`,
    examples: [
      {
        title: 'Side sheet',
        code: `<GlassSheetContent side="right">Inspector</GlassSheetContent>`,
      },
      {
        title: 'Opened from a menu',
        code: `const menuRef = useRef<HTMLButtonElement>(null);

<GlassMenu>
  <GlassMenuTrigger ref={menuRef}>File</GlassMenuTrigger>
  <GlassMenuContent>
    <GlassMenuItem onSelect={() => setOpen(true)}>Share…</GlassMenuItem>
  </GlassMenuContent>
</GlassMenu>
<GlassSheet open={open} onOpenChange={setOpen}>
  <GlassSheetContent
    onCloseAutoFocus={(event) => {
      event.preventDefault();
      menuRef.current?.focus();
    }}
  >
    <GlassSheetTitle>Share photo</GlassSheetTitle>
  </GlassSheetContent>
</GlassSheet>`,
      },
    ],
    api: [
      { name: 'GlassSheet', description: 'Radix Dialog root.' },
      {
        name: 'GlassSheetTrigger / GlassSheetClose',
        description: 'Radix trigger and close primitives.',
      },
      {
        name: 'GlassSheetContent',
        description: 'Portal, overlay, glass panel, drag handle, and named close button.',
      },
      {
        name: 'side',
        description: 'Edge to slide from: top, right, bottom, or left. Defaults to bottom.',
      },
      {
        name: 'closeLabel',
        description: 'Accessible name of the close button. Defaults to Close sheet.',
      },
      {
        name: 'thickness',
        description:
          'How thick the glass is, as a multiple of regular. Defaults to the thickness preference.',
      },
      {
        name: 'GlassSheetTitle / GlassSheetDescription',
        description: 'Radix accessible title and description.',
      },
    ],
    notes: [
      {
        title: 'Gestures',
        body: 'Drag the bottom handle down past a quarter of the sheet, or fling it, to dismiss. Short drags spring back.',
      },
      {
        title: 'Accessibility',
        body: 'Radix traps focus, closes on Escape, and returns focus to the trigger. A sheet opened from a menu has no trigger, so send focus back to the menu button with onCloseAutoFocus. Always render a title.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-menu',
    name: 'Glass Menu',
    category: 'Overlays',
    status: 'ready',
    route: '/components/glass-menu',
    description: 'A dropdown menu on glass with shortcuts, checkbox and radio items, and submenus.',
    usage: `import { GlassMenu, GlassMenuContent, GlassMenuItem, GlassMenuShortcut, GlassMenuTrigger } from "@/components/glassyui/glass-menu";

export function MenuDemo() {
  return (
    <GlassMenu>
      <GlassMenuTrigger>Edit</GlassMenuTrigger>
      <GlassMenuContent>
        <GlassMenuItem>
          Undo <GlassMenuShortcut>⌘Z</GlassMenuShortcut>
        </GlassMenuItem>
        <GlassMenuItem tone="destructive">Delete</GlassMenuItem>
      </GlassMenuContent>
    </GlassMenu>
  );
}`,
    examples: [
      {
        title: 'Options and submenus',
        code: `<GlassMenuContent>
  <GlassMenuLabel>View</GlassMenuLabel>
  <GlassMenuCheckboxItem checked={showGrid} onCheckedChange={setShowGrid}>
    Show grid
  </GlassMenuCheckboxItem>
  <GlassMenuSeparator />
  <GlassMenuSub>
    <GlassMenuSubTrigger>Sort by</GlassMenuSubTrigger>
    <GlassMenuSubContent>
      <GlassMenuRadioGroup value={sort} onValueChange={setSort}>
        <GlassMenuRadioItem value="name">Name</GlassMenuRadioItem>
        <GlassMenuRadioItem value="date">Date</GlassMenuRadioItem>
      </GlassMenuRadioGroup>
    </GlassMenuSubContent>
  </GlassMenuSub>
</GlassMenuContent>`,
      },
    ],
    api: [
      {
        name: 'GlassMenu',
        description:
          'Radix DropdownMenu root. Non-modal by default, so the page keeps its scroll; pass modal to lock it.',
      },
      { name: 'GlassMenuTrigger', description: 'Radix trigger primitive.' },
      {
        name: 'GlassMenuContent',
        description: 'Portal-backed glass panel. sideOffset defaults to 8.',
      },
      {
        name: 'GlassMenuItem',
        description: 'Menu item with inset and tone (default or destructive) options.',
      },
      {
        name: 'GlassMenuCheckboxItem / GlassMenuRadioItem',
        description: 'Stateful items with a check or dot indicator.',
      },
      { name: 'GlassMenuGroup / GlassMenuRadioGroup', description: 'Radix grouping primitives.' },
      {
        name: 'GlassMenuLabel / GlassMenuSeparator',
        description: 'Section label and hairline divider.',
      },
      { name: 'GlassMenuShortcut', description: 'Right-aligned keyboard shortcut hint.' },
      {
        name: 'GlassMenuSub / GlassMenuSubTrigger / GlassMenuSubContent',
        description: 'Nested submenu with a chevron trigger.',
      },
    ],
    notes: [
      {
        title: 'Keyboard',
        body: 'Radix handles arrow keys, typeahead, Escape, and submenu opening with the right arrow key.',
      },
      {
        title: 'Right to left',
        body: 'Indents, shortcuts, and the submenu chevron use logical properties and flip in right-to-left layouts.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-command',
    name: 'Glass Command',
    category: 'Overlays',
    isNew: true,
    status: 'ready',
    route: '/components/glass-command',
    description:
      'A searchable command list that filters as you type, alone or in a launcher dialog.',
    usage: `import {
  GlassCommand,
  GlassCommandDialog,
  GlassCommandEmpty,
  GlassCommandGroup,
  GlassCommandInput,
  GlassCommandItem,
  GlassCommandList,
} from "@/components/glassyui/glass-command";

export function Launcher({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <GlassCommandDialog open={open} onOpenChange={onOpenChange}>
      <GlassCommand label="Commands">
        <GlassCommandInput placeholder="Type a command or search…" />
        <GlassCommandList>
          <GlassCommandEmpty>No results found.</GlassCommandEmpty>
          <GlassCommandGroup heading="Suggestions">
            <GlassCommandItem onSelect={() => onOpenChange(false)}>New file</GlassCommandItem>
          </GlassCommandGroup>
        </GlassCommandList>
      </GlassCommand>
    </GlassCommandDialog>
  );
}`,
    examples: [
      {
        title: 'Open with ⌘K',
        code: `useEffect(() => {
  const onKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      setOpen((current) => !current);
    }
  };

  document.addEventListener("keydown", onKeyDown);

  return () => document.removeEventListener("keydown", onKeyDown);
}, []);`,
      },
      {
        title: 'Shortcuts and keywords',
        code: `<GlassCommandItem keywords={["dark", "light"]} onSelect={toggleTheme}>
  Switch theme
  <GlassCommandShortcut>
    <GlassKbdGroup><GlassKbd>⌘</GlassKbd><GlassKbd>T</GlassKbd></GlassKbdGroup>
  </GlassCommandShortcut>
</GlassCommandItem>`,
      },
    ],
    api: [
      {
        name: 'GlassCommand',
        description: 'The searchable list, on cmdk. filter, shouldFilter, loop and value apply.',
      },
      {
        name: 'GlassCommandDialog',
        description:
          'A glass dialog near the top of the page that holds a command list. open, onOpenChange and title.',
      },
      { name: 'GlassCommandInput', description: 'The search field, with a magnifier.' },
      { name: 'GlassCommandList', description: 'The scrolling results. It resizes with them.' },
      { name: 'GlassCommandGroup', description: 'A heading and its items. Pass heading.' },
      {
        name: 'GlassCommandItem',
        description: 'One command. onSelect runs on Enter or click; keywords widen the search.',
      },
      {
        name: 'GlassCommandEmpty / GlassCommandSeparator / GlassCommandShortcut',
        description: 'The no-results message, a divider, and a right-aligned shortcut hint.',
      },
    ],
    notes: [
      {
        title: 'Keyboard',
        body: 'Arrow keys move the highlight, Enter runs the item and Escape closes the dialog. Focus stays in the search field, and returns to whatever opened the dialog when it closes.',
      },
      {
        title: 'Composition',
        body: 'GlassCommand is a bare list. Put it in a GlassPanel, a GlassPopover or GlassCommandDialog.',
      },
      {
        title: 'On this site',
        body: 'The search in the header is a GlassCommandDialog. Press ⌘K (Ctrl K elsewhere) to open it.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-lens',
    name: 'Glass Lens',
    category: 'Effects',
    status: 'ready',
    route: '/components/glass-lens',
    description: 'A draggable magnifier whose glass rim bends the content beneath it.',
    examples: [
      {
        title: 'Render the copied example',
        code: `import { LensExample } from "./lens-example";

export default function Page() {
  return <LensExample />;
}`,
      },
    ],
    api: [
      {
        name: 'GlassLens',
        description: 'Stage that renders its children plus a draggable magnifier over them.',
      },
      {
        name: 'children',
        description:
          'Content to magnify. It renders twice, so give it its own background and avoid ids.',
      },
      { name: 'size', description: 'Lens diameter in pixels. Defaults to 160.' },
      { name: 'zoom', description: 'Magnification inside the lens. Defaults to 1.6.' },
      {
        name: 'defaultPosition',
        description: 'Starting centre as fractions of the stage. Defaults to the middle.',
      },
      { name: 'label', description: 'Accessible name of the lens. Defaults to Magnifier.' },
    ],
    notes: [
      {
        title: 'Browsers',
        body: 'The rim bends through an SVG filter on the magnified copy, which every current engine draws. Reduced motion and reduced transparency keep a plain magnifier.',
      },
      {
        title: 'Keyboard',
        body: 'The lens is focusable. Arrow keys move it 10 pixels, or 50 with Shift.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-scene',
    name: 'Glass Scene',
    category: 'Effects',
    status: 'ready',
    route: '/components/glass-scene',
    description:
      'Draws the glass inside it as real bevelled glass that bends its backdrop and melts together.',
    examples: [
      {
        title: 'Render the copied example',
        code: `import { SceneExample } from "./scene-example";

export default function Page() {
  return <SceneExample />;
}`,
      },
    ],
    api: [
      {
        name: 'GlassScene',
        description:
          'Stage that paints its backdrop and draws the glass inside it on one WebGL2 canvas.',
      },
      {
        name: 'backdrop',
        description:
          'The image the glass refracts: a URL, or a CSS url() or var() value. Serve it from your origin or with CORS.',
      },
      {
        name: 'backdropSpace',
        description:
          "'local' (default) paints the backdrop across the scene. 'viewport' pins it to the viewport, so scrolling carries the glass across a still image.",
      },
      {
        name: 'flow',
        description:
          'Lets drops ripple like liquid. Reduced motion holds them still. Defaults to false.',
      },
      {
        name: 'optics',
        description:
          'ior (1.5), thickness (40), bevel (28), dispersion (0.15), frost (1), merge (12) and specular (1). Lengths are CSS pixels.',
      },
      {
        name: 'GlassDrop',
        description: 'A plain drop of glass. Size, round and place it with CSS.',
      },
      {
        name: 'merge',
        description:
          'GlassDrop only: this drop’s merge distance in pixels. Defaults to the scene’s.',
      },
    ],
    notes: [
      {
        title: 'What joins the scene',
        body: 'GlassSurface, GlassPanel, GlassButton and GlassDrop inside a scene hand their glass to it. Ghost buttons, glass nested in other glass and surfaces with a generated refraction keep their own. Nested glass drops its shadow and tints away from the pane’s text, so its labels stay legible.',
      },
      {
        title: 'Legible text',
        body: 'Text on scene glass keeps 4.5:1 over any backdrop: where the backdrop is too bright or too dark, the face dims or lifts just enough and the rim keeps its light. Each piece protects the colour in --lg-scene-ink, the muted text on surfaces and the label on buttons. Set it to transparent on glass without text.',
      },
      {
        title: 'Optics',
        body: 'Each piece is a thick slab floating just above the backdrop. Light bends through its top, its body and the air beneath, so steeper rims and a higher ior bend more, and dispersion splits the bent light into a spectrum. Past the critical angle a rim mirrors the scene instead, and tinted glass absorbs more where it is thicker and casts a tinted shadow.',
      },
      {
        title: 'Browsers',
        body: 'The scene needs WebGL2, which every current browser has. Without it the scene logs one warning and every piece keeps its CSS glass.',
      },
      {
        title: 'Accessibility',
        body: 'Reduced transparency, increased contrast and forced colours switch the canvas off and return the CSS glass. Reduced motion holds the flow still. The canvas never takes clicks or focus.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-laptop',
    name: 'Glass Laptop',
    category: 'Mockups',
    status: 'ready',
    route: '/components/glass-laptop',
    searchTitle: 'Glass Laptop: a CSS 3D React laptop mockup',
    guide: '/guides/laptop-mockup',
    description: 'A CSS 3D laptop mockup whose lid opens onto your screenshot or React screen.',
    usage: `import { GlassLaptop } from "@/components/glassyui/glass-laptop";

export function Showcase() {
  return (
    <GlassLaptop
      aria-label="The app on a laptop"
      className="w-full max-w-5xl"
    >
      <img alt="" className="size-full object-cover" src="/app.png" />
    </GlassLaptop>
  );
}`,
    examples: [
      {
        title: 'Open the lid when the page loads',
        code: `const [open, setOpen] = useState(false);

useEffect(() => {
  const frame = requestAnimationFrame(() => setOpen(true));

  return () => cancelAnimationFrame(frame);
}, []);

return (
  <GlassLaptop open={open} finish="silver">
    <YourScreen />
  </GlassLaptop>
);`,
      },
    ],
    api: [
      {
        name: 'GlassLaptop',
        description: 'Forward-ref figure drawing the laptop. Its children fill the screen.',
      },
      {
        name: 'children',
        description:
          'Screen content, laid out at the resolution below and scaled to fit. It renders only while the screen is lit.',
      },
      {
        name: 'open',
        description:
          'Whether the lid is up. Changing it opens or closes the lid. Defaults to true.',
      },
      { name: 'finish', description: 'black or silver. Defaults to black.' },
      {
        name: 'resolution',
        description:
          'Width in CSS pixels the screen lays its content out at before scaling to fit. Defaults to 1728.',
      },
      { name: 'glare', description: 'A faint reflection across the glass. Defaults to true.' },
    ],
    notes: [
      {
        title: 'Rendering',
        body: 'The laptop mockup has a notched screen, keyboard and trackpad. It uses CSS 3D with no images or WebGL. Open, the lid faces you; shut, the view rises to show the closed case from above, and it moves back down as the lid opens.',
      },
      {
        title: 'Screen',
        body: 'The screen lights once the lid and the view have come to rest, and goes dark before the lid closes. Menus and dialogs that the content opens in a portal appear on the page at full size, so a screen meant to be looked at can be marked inert.',
      },
      {
        title: 'Accessibility',
        body: 'Reduced motion opens and closes the lid at once, and reduced transparency takes the reflection off the glass. Give the figure an aria-label that says what the screen shows.',
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-phone-duo',
    name: 'Glass Phone Duo',
    category: 'Mockups',
    isNew: true,
    status: 'ready',
    route: '/components/glass-phone-duo',
    description:
      'A folding glass phone with flat screen content, an outer display, and a smooth titanium frame.',
    usage: `import { GlassPhoneDuo } from "@/components/glassyui/glass-phone-duo";

export function Showcase() {
  return (
    <GlassPhoneDuo
      className="w-full max-w-2xl"
      screenSrc="/app-landscape.png"
      screenAlt="The app on the unfolded display"
      coverSrc="/app-portrait.png"
      coverAlt="The app on the cover display"
    />
  );
}`,
    examples: [
      {
        title: 'Open and close',
        code: `const [open, setOpen] = useState(true);

return (
  <>
    <GlassPhoneDuo
      open={open}
      finish="star-white"
      screenSrc="/app-landscape.png"
      coverSrc="/app-portrait.png"
    />
    <button type="button" onClick={() => setOpen(!open)}>
      {open ? 'Close phone' : 'Open phone'}
    </button>
  </>
);`,
      },
      {
        title: 'Pose the hinge',
        code: `<GlassPhoneDuo
  angle={120}
  view="back"
  finish="night-sky"
  screenSrc="/app-landscape.png"
  coverSrc="/app-portrait.png"
/>`,
      },
      {
        title: 'Stand poses',
        code: `<GlassPhoneDuo
  pose="laptop"
  angle={90}
  finish="star-white"
  screenSrc="/app-landscape.png"
  coverSrc="/app-portrait.png"
/>

<GlassPhoneDuo
  pose="tent"
  angle={60}
  screenSrc="/app-landscape.png"
  coverSrc="/app-portrait.png"
/>`,
      },
    ],
    api: [
      { name: 'GlassPhoneDuo', description: 'Forward-ref figure containing the WebGL 2 device.' },
      {
        name: 'screenSrc',
        description:
          'One landscape screenshot for the entire inner OLED. Required; use a 2670:1878 aspect ratio.',
      },
      {
        name: 'coverSrc',
        description:
          'Portrait screenshot for the outer display. Required; use a 1398:2034 aspect ratio.',
      },
      {
        name: 'screenAlt / coverAlt',
        description:
          'Accessible descriptions of the screenshots. Only the displayed side is announced.',
      },
      { name: 'open', description: 'Animates the hinge open or closed. Defaults to true.' },
      {
        name: 'angle',
        description:
          'Hinge angle from 0 (closed) to 180 (flat). Overrides open with a short, interruptible settle for smooth scrubbing. Reduced motion applies the angle immediately.',
      },
      { name: 'finish', description: 'night-sky or star-white. Defaults to night-sky.' },
      {
        name: 'view',
        description:
          'front or back. Turning over exposes the horizontal rear cameras. Defaults to front.',
      },
      {
        name: 'pose',
        description:
          'upright (default), book, tent, laptop or side. Sets the orientation; angle still controls the hinge. Try book at 120°, tent at 60°, laptop at 90° or side at 180°.',
      },
      { name: 'glare', description: 'A faint reflection across the displays. Defaults to true.' },
    ],
    notes: [
      {
        title: 'Screen captures',
        body: 'In the upright pose, the screenshot stays on a flat plane while the glass lifts, blurs, and dims above it, like the website intro. The other poses attach content to the displays. Tent and laptop rotate the captures to keep the UI upright: the landscape capture serves the outer display, and the portrait capture spans the inner leaves. Use same-origin or CORS-enabled images. The mockup requires WebGL 2.',
      },
      {
        title: 'Geometry',
        body: 'The model uses a 164.6 × 117.8 × 5.2 mm unfolded body. The camera housing, layered lens rings, concealed inner camera, hinge, antenna breaks, buttons and USB-C recess are approximated from the reference product images.',
      },
      {
        title: 'Accessibility',
        body: 'System and site reduced motion put the hinge and view directly at their destination. Reduced transparency removes reflections. The two displays share one accessible description.',
      },
    ],
    pageToc: standardToc,
  },
];

export const componentDocs: ComponentDoc[] = componentDocContent.map((content) => {
  const item = getRegistryItem(content.id);
  const closure = getRegistryClosure(item.name);

  return {
    ...content,
    dependencies: [...(item.dependencies ?? [])],
    directFiles: item.files.map((file) => file.target),
    install: `pnpm dlx shadcn@4.14.1 add @glassyui/${item.name}`,
    installedDependencies: unique(closure.flatMap((closureItem) => closureItem.dependencies ?? [])),
    installedFiles: unique(
      closure.flatMap((closureItem) => closureItem.files.map((file) => file.target)),
    ),
    localFiles: item.files.map((file) => file.path),
    registryDependencies: [...(item.registryDependencies ?? [])],
    registryItem: item.name,
  };
});

export const initializeShadcn = 'pnpm dlx shadcn@4.14.1 init';

export const glassThemeRoot = `<html lang="en" data-lg-theme="light">
  <body>{children}</body>
</html>`;

export const publicRegistryMapping = `{
  "registries": {
    "@glassyui": "https://glassyui.com/r/{name}.json"
  }
}`;

export const componentCategories: ComponentCategory[] = [
  'Core',
  'Surfaces',
  'Controls',
  'Overlays',
  'Navigation',
  'Feedback',
  'Effects',
  'Mockups',
];

export function getComponentDoc(slug: string) {
  return componentDocs.find((component) => component.id === slug);
}

export function getAdjacentComponents(slug: string) {
  const index = componentDocs.findIndex((component) => component.id === slug);

  return {
    next: index >= 0 ? componentDocs[index + 1] : undefined,
    previous: index > 0 ? componentDocs[index - 1] : undefined,
  };
}
