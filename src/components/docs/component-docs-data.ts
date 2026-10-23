import registry from '../../../registry.json';
import { installCommand } from '@/lib/install-command';

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

/** One prop in a component's API table. `default` is shown as written; '—' means none. */
export type ComponentProp = {
  name: string;
  type: string;
  default: string;
  description: string;
  required?: boolean;
};

/** One exported part of a component, with the props Glassy UI adds or changes. */
export type ComponentApiPart = {
  name: string;
  description?: string;
  /** What else the part accepts, such as "HTML button attributes". */
  extends?: string;
  props: ComponentProp[];
};

export type ComponentDoc = {
  /** A line that tells a developer what to do to keep the component accessible. */
  accessibility?: string;
  api: ComponentApiPart[];
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
  pageToc: Array<{ href: string; title: string }>;
  registryDependencies: string[];
  registryItem: string;
  /** A hard requirement, such as WebGL2, shown under the description. */
  requires?: string;
  route?: string;
  /** The page title in search results, when the name alone says too little. */
  searchTitle?: string;
  status: ComponentStatus;
  /** Exported types a developer imports alongside the component. */
  types?: string[];
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
  { href: '#api', title: 'API reference' },
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
    description:
      'Sets the theme and accessibility preferences that every Glassy UI component follows.',
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
          'Holds the preferences and writes them to data-lg-* attributes on the html element.',
        props: [
          {
            name: 'children',
            type: 'ReactNode',
            default: '—',
            description: 'The app, or the part of it that uses glass components.',
            required: true,
          },
          {
            name: 'defaultTheme',
            type: "'light' | 'dark'",
            default: 'system setting',
            description:
              'Theme a visitor sees until they choose one; without it the provider follows prefers-color-scheme. A saved choice always wins.',
          },
        ],
      },
      {
        name: 'usePreferences',
        description:
          'Hook that returns { preferences, setPreferences }. Throws outside GlassProvider.',
        props: [
          {
            name: 'preferences.theme',
            type: "'light' | 'dark'",
            default: 'defaultTheme, else system',
            description: 'Active colour theme.',
          },
          {
            name: 'preferences.mode',
            type: "'clear' | 'tinted'",
            default: "'clear'",
            description: 'Glass appearance mode.',
          },
          {
            name: 'preferences.quality',
            type: "'low' | 'medium' | 'high'",
            default: 'detected',
            description:
              'Rendering quality: low with reduced transparency or 4 GB of device memory or less, medium on touch or with reduced motion, otherwise high.',
          },
          {
            name: 'preferences.reduceMotion',
            type: 'boolean',
            default: 'prefers-reduced-motion',
            description: 'Stops glass motion.',
          },
          {
            name: 'preferences.reduceTransparency',
            type: 'boolean',
            default: 'prefers-reduced-transparency',
            description: 'Makes glass opaque and turns off the lens and refraction.',
          },
          {
            name: 'preferences.thickness',
            type: 'number',
            default: '1',
            description: 'Glass thickness as a multiple of regular; applied between 0.25 and 2.',
          },
          {
            name: 'setPreferences',
            type: '(prefs: Partial<GlassyUiPreferences>) => void',
            default: '—',
            description:
              'Merges and applies the given preferences, and saves them to localStorage under glassy-ui-preferences.',
          },
        ],
      },
      {
        name: 'useOptionalPreferences',
        description:
          'Same shape as usePreferences, but safe outside GlassProvider: it then returns the defaults, follows the system reduced-transparency setting, and setPreferences does nothing.',
        props: [],
      },
      {
        name: 'PreferencesProvider',
        description: 'Alias of GlassProvider, kept for compatibility.',
        extends: 'GlassProvider props',
        props: [],
      },
      {
        name: 'LiquidFilters',
        description:
          'Hidden SVG filter definitions (#lg-liquid-refraction and others) for your own CSS. No Glassy UI component needs it. Import it from liquid-filters.',
        props: [],
      },
    ],
    types: ['GlassyUiPreferences', 'GlassyUiTheme', 'GlassyUiMode', 'GlassyUiQuality'],
    pageToc: standardToc,
  },
  {
    id: 'glass-surface',
    name: 'Glass Surface',
    category: 'Surfaces',
    status: 'ready',
    route: '/components/glass-surface',
    description: 'The glass material as a plain div, for building your own glass components.',
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
      {
        name: 'GlassSurface',
        extends: 'HTML div attributes',
        props: [
          {
            name: 'preset',
            type: "'subtle' | 'standard' | 'prominent' | 'control' | 'showcase'",
            default: "'standard'",
            description:
              'Material strength. control and showcase also turn the lens on by default.',
          },
          {
            name: 'lens',
            type: 'boolean',
            default: 'true for control and showcase',
            description:
              'Chromium-only rim lens that bends and splits the page behind it. Off with reduced transparency, while generated refraction runs, or above 720,000 px² of area.',
          },
          {
            name: 'thickness',
            type: 'number',
            default: 'thickness preference',
            description:
              'Glass thickness as a multiple of regular (1); thicker glass widens the rim and bends further.',
          },
          {
            name: 'refraction',
            type: "'none' | 'soft' | 'strong'",
            default: "'strong' for showcase, else 'none'",
            description:
              'Generated refraction of refractionBackground. Needs refractionBackground and is off under reduced motion or reduced transparency.',
          },
          {
            name: 'refractionBackground',
            type: 'ReactNode',
            default: '—',
            description:
              'Decorative layer bent inside the surface; not for interactive or semantic content. Needs a uniform border radius.',
          },
          {
            name: 'refractionBackgroundSpace',
            type: "'local' | 'viewport'",
            default: "'local'",
            description:
              'Aligns refractionBackground to the surface or to the viewport; use viewport for a fixed wallpaper.',
          },
          {
            name: 'refractionDisplacement',
            type: 'number',
            default: '72 soft, 112 strong',
            description: 'Bend strength of generated refraction.',
          },
          {
            name: 'interactive',
            type: 'boolean',
            default: 'false',
            description: 'Brightens the surface slightly on hover.',
          },
        ],
      },
    ],
    types: ['GlassSurfaceProps', 'SurfacePreset', 'SurfaceRefraction', 'RefractionBackgroundSpace'],
    pageToc: standardToc,
  },
  {
    id: 'glass-panel',
    name: 'Glass Panel',
    category: 'Surfaces',
    status: 'ready',
    route: '/components/glass-panel',
    description: 'A glass container in a panel, card or pill shape.',
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
      {
        name: 'GlassPanel',
        description: 'A GlassSurface with shape, spacing and elevation.',
        extends: 'HTML div attributes',
        props: [
          {
            name: 'variant',
            type: "'panel' | 'card' | 'pill'",
            default: "'panel'",
            description: 'Shape and spacing.',
          },
          {
            name: 'elevation',
            type: "'base' | 'raised'",
            default: "'base'",
            description: 'Shadow and border level.',
          },
          {
            name: 'preset',
            type: "'subtle' | 'standard' | 'prominent' | 'control' | 'showcase'",
            default: "'control' for pill, else 'standard'",
            description: 'Material strength, as on GlassSurface.',
          },
          {
            name: 'lens',
            type: 'boolean',
            default: 'true for control and showcase',
            description: 'Chromium-only rim lens, as on GlassSurface; pills get it by default.',
          },
          {
            name: 'thickness',
            type: 'number',
            default: 'thickness preference',
            description: 'Glass thickness as a multiple of regular (1).',
          },
          {
            name: 'refraction',
            type: "'none' | 'soft' | 'strong'",
            default: "'strong' for showcase, else 'none'",
            description: 'Generated refraction; needs refractionBackground.',
          },
          {
            name: 'refractionBackground',
            type: 'ReactNode',
            default: '—',
            description: 'Decorative layer bent inside the panel.',
          },
          {
            name: 'refractionBackgroundSpace',
            type: "'local' | 'viewport'",
            default: "'local'",
            description: 'Aligns refractionBackground to the panel or to the viewport.',
          },
          {
            name: 'refractionDisplacement',
            type: 'number',
            default: '72 soft, 112 strong',
            description: 'Bend strength of generated refraction.',
          },
          {
            name: 'interactive',
            type: 'boolean',
            default: 'false',
            description: 'Brightens the panel slightly on hover.',
          },
        ],
      },
    ],
    types: ['GlassPanelProps'],
    pageToc: standardToc,
  },
  {
    id: 'glass-header',
    name: 'Glass Header',
    category: 'Navigation',
    status: 'ready',
    isNew: true,
    route: '/components/glass-header',
    description:
      'A floating glass header with a brand, navigation links, actions and a compact menu.',
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
      {
        name: 'GlassHeader',
        description: 'A header element with a nav for its links.',
        extends: 'HTML header attributes',
        props: [
          {
            name: 'brand',
            type: 'ReactNode',
            default: '—',
            description: 'Logo or wordmark, usually linked to the home page.',
            required: true,
          },
          {
            name: 'children',
            type: 'ReactNode',
            default: '—',
            description:
              'Navigation links. They render twice, in the inline nav and in the Menu used below 780px of header width, so avoid ids inside them.',
          },
          {
            name: 'actions',
            type: 'ReactNode',
            default: '—',
            description: 'Buttons or links at the end, shown at every width.',
          },
          {
            name: 'position',
            type: "'fixed' | 'static'",
            default: "'fixed'",
            description:
              'fixed floats 14px from the top (8px on narrow screens) and needs about 84px of room above your content; static stays in the layout.',
          },
          {
            name: 'condenseOnScroll',
            type: 'boolean',
            default: 'false',
            description:
              'Starts as a full-width bar without glass and condenses into the capsule after 8px of scroll. Fixed headers only.',
          },
          {
            name: 'navigationLabel',
            type: 'string',
            default: "'Primary'",
            description: 'Accessible name for both navs.',
          },
        ],
      },
    ],
    types: ['GlassHeaderProps'],
    accessibility: 'Give each header a unique navigationLabel when a page has more than one.',
    pageToc: standardToc,
  },
  {
    id: 'glass-button',
    name: 'Glass Button',
    category: 'Controls',
    status: 'ready',
    route: '/components/glass-button',
    description: 'A glass button with four variants, three sizes and an asChild mode for links.',
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
        extends: 'HTML button attributes',
        props: [
          {
            name: 'variant',
            type: "'primary' | 'prominent' | 'soft' | 'ghost'",
            default: "'primary'",
            description:
              'Visual style. prominent is blue glass for the main action; ghost has no glass.',
          },
          {
            name: 'size',
            type: "'sm' | 'md' | 'lg'",
            default: "'md'",
            description: 'Control size.',
          },
          {
            name: 'asChild',
            type: 'boolean',
            default: 'false',
            description:
              "Renders the single child, such as a link, with the button's material. disabled has no effect then.",
          },
          {
            name: 'type',
            type: "'button' | 'submit' | 'reset'",
            default: "'button'",
            description: "Native button type. Set 'submit' to submit a form.",
          },
          {
            name: 'preset',
            type: "'control' | 'showcase'",
            default: "'control'",
            description: 'Material preset; showcase allows a stronger backdrop blur.',
          },
          {
            name: 'lens',
            type: 'boolean',
            default: 'true except ghost',
            description:
              'Chromium-only rim lens that bends the page behind it. Off while disabled or with reduced transparency.',
          },
        ],
      },
    ],
    types: ['ButtonProps', 'ButtonVariant', 'ButtonSize'],
    pageToc: standardToc,
  },
  {
    id: 'glass-input',
    name: 'Glass Input',
    category: 'Controls',
    status: 'ready',
    route: '/components/glass-input',
    description: 'A recessed glass text field with an optional label and hint.',
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
      {
        name: 'GlassInput',
        description:
          'An input in a wrapper with its label and hint. className and ref go to the input.',
        extends: 'HTML input attributes',
        props: [
          {
            name: 'label',
            type: 'string',
            default: '—',
            description: 'Visible label above the field, linked with htmlFor.',
          },
          {
            name: 'hint',
            type: 'string',
            default: '—',
            description: 'Helper text below the field, linked with aria-describedby.',
          },
          {
            name: 'type',
            type: 'string',
            default: "'text'",
            description: 'Native input type.',
          },
        ],
      },
    ],
    types: ['GlassInputProps'],
    accessibility: 'Without a label, name the field with aria-label.',
    pageToc: standardToc,
  },
  {
    id: 'glass-checkbox',
    name: 'Glass Checkbox',
    category: 'Controls',
    isNew: true,
    status: 'ready',
    route: '/components/glass-checkbox',
    description: 'A glass checkbox with an optional label, description and indeterminate state.',
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
        description: 'With a label, className goes to the wrapper; without one, to the box.',
        extends: 'Radix Checkbox.Root props, except children',
        props: [
          {
            name: 'checked / defaultChecked',
            type: "boolean | 'indeterminate'",
            default: '—',
            description:
              "Checked state; 'indeterminate' shows a dash for a parent of several choices.",
          },
          {
            name: 'onCheckedChange',
            type: "(checked: boolean | 'indeterminate') => void",
            default: '—',
            description: 'Called when the user toggles the box.',
          },
          {
            name: 'label',
            type: 'ReactNode',
            default: '—',
            description: 'Text beside the box; clicking it toggles the box.',
          },
          {
            name: 'description',
            type: 'ReactNode',
            default: '—',
            description:
              'Muted line under the label, linked with aria-describedby. Shown only with a label.',
          },
          {
            name: 'size',
            type: "'sm' | 'md'",
            default: "'md'",
            description: 'Box size: 16px or 20px.',
          },
        ],
      },
    ],
    types: ['GlassCheckboxProps', 'GlassCheckboxSize'],
    accessibility: 'Without a label, name the box with aria-label.',
    pageToc: standardToc,
  },
  {
    id: 'glass-radio-group',
    name: 'Glass Radio Group',
    category: 'Controls',
    isNew: true,
    status: 'ready',
    route: '/components/glass-radio-group',
    description: 'A group of glass radio buttons where exactly one option is chosen.',
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
        extends: 'Radix RadioGroup.Root props',
        props: [
          {
            name: 'value / defaultValue',
            type: 'string',
            default: '—',
            description: "The chosen option's value.",
          },
          {
            name: 'onValueChange',
            type: '(value: string) => void',
            default: '—',
            description: 'Called when the user chooses an option.',
          },
        ],
      },
      {
        name: 'GlassRadioGroupItem',
        description:
          'One option. With a label, className goes to the wrapper; without one, to the button.',
        extends: 'Radix RadioGroup.Item props, except children',
        props: [
          {
            name: 'value',
            type: 'string',
            default: '—',
            description: 'The value this option sets.',
            required: true,
          },
          {
            name: 'label',
            type: 'ReactNode',
            default: '—',
            description: 'Text beside the button; clicking it chooses the option.',
          },
          {
            name: 'description',
            type: 'ReactNode',
            default: '—',
            description:
              'Muted line under the label, linked with aria-describedby. Shown only with a label.',
          },
        ],
      },
    ],
    types: ['GlassRadioGroupProps', 'GlassRadioGroupItemProps'],
    accessibility:
      'Name the group with aria-label or aria-labelledby, and name any item without a label with aria-label.',
    pageToc: standardToc,
  },
  {
    id: 'glass-textarea',
    name: 'Glass Textarea',
    category: 'Controls',
    isNew: true,
    status: 'ready',
    route: '/components/glass-textarea',
    description: 'A recessed glass text area that can grow with its text.',
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
      {
        name: 'GlassTextarea',
        description:
          'A textarea in a wrapper with its label and hint. className and ref go to the textarea.',
        extends: 'HTML textarea attributes',
        props: [
          {
            name: 'label',
            type: 'string',
            default: '—',
            description: 'Visible label above the field, linked with htmlFor.',
          },
          {
            name: 'hint',
            type: 'string',
            default: '—',
            description: 'Helper text below the field, linked with aria-describedby.',
          },
          {
            name: 'rows',
            type: 'number',
            default: '3',
            description:
              'Starting height in rows. Without autoResize the field has a vertical resize handle.',
          },
          {
            name: 'autoResize',
            type: 'boolean',
            default: 'false',
            description:
              'Grows with its text, refitting when the width changes, then scrolls past maxRows.',
          },
          {
            name: 'maxRows',
            type: 'number',
            default: '8',
            description: 'The most rows an auto-resizing field grows to.',
          },
        ],
      },
    ],
    types: ['GlassTextareaProps'],
    accessibility: 'Without a label, name the field with aria-label.',
    pageToc: standardToc,
  },
  {
    id: 'glass-select',
    name: 'Glass Select',
    category: 'Controls',
    isNew: true,
    status: 'ready',
    route: '/components/glass-select',
    description: 'A select field whose options open on a raised glass panel.',
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
        extends: 'Radix Select.Root props',
        props: [
          {
            name: 'value / defaultValue',
            type: 'string',
            default: '—',
            description: 'Controlled or uncontrolled selected value.',
          },
          {
            name: 'onValueChange',
            type: '(value: string) => void',
            default: '—',
            description: 'Called with the value of the chosen item.',
          },
          {
            name: 'open / onOpenChange',
            type: 'boolean / (open: boolean) => void',
            default: '—',
            description: 'Controls whether the list is open.',
          },
          {
            name: 'name',
            type: 'string',
            default: '—',
            description:
              'Submits the value with a native form, and a form reset restores the initial value.',
          },
          {
            name: 'disabled',
            type: 'boolean',
            default: 'false',
            description: 'Stops the select from opening.',
          },
        ],
      },
      {
        name: 'GlassSelectTrigger',
        description: 'The closed field, with a chevron.',
        extends: 'Radix Select.Trigger props',
        props: [],
      },
      {
        name: 'GlassSelectValue',
        description: "Shows the chosen item's text inside the trigger.",
        extends: 'Radix Select.Value props',
        props: [
          {
            name: 'placeholder',
            type: 'ReactNode',
            default: '—',
            description: 'Shown while no value is chosen.',
          },
        ],
      },
      {
        name: 'GlassSelectContent',
        description: 'The open list on a glass panel, at least as wide as the trigger.',
        extends: 'Radix Select.Content props',
        props: [
          {
            name: 'position',
            type: "'popper' | 'item-aligned'",
            default: "'popper'",
            description:
              'popper places the list below the trigger; item-aligned lays it over the trigger at the chosen item.',
          },
          {
            name: 'sideOffset',
            type: 'number',
            default: '8',
            description: 'Gap between the trigger and the list, in pixels.',
          },
          {
            name: 'className',
            type: 'string',
            default: '—',
            description: 'Applies to the glass panel.',
          },
        ],
      },
      {
        name: 'GlassSelectItem',
        description: 'One option, with a check mark when chosen.',
        extends: 'Radix Select.Item props',
        props: [
          {
            name: 'value',
            type: 'string',
            default: '—',
            description:
              "The option's value. Cannot be an empty string; an empty value shows the placeholder.",
            required: true,
          },
          {
            name: 'disabled',
            type: 'boolean',
            default: 'false',
            description: 'Makes the option unselectable.',
          },
        ],
      },
      {
        name: 'GlassSelectGroup / GlassSelectLabel / GlassSelectSeparator',
        description: 'Group options under a heading and divide groups with a line.',
        extends: 'Radix Select.Group, Select.Label and Select.Separator props',
        props: [],
      },
    ],
    types: ['GlassSelectTriggerProps', 'GlassSelectContentProps', 'GlassSelectItemProps'],
    accessibility:
      'Name the trigger with aria-label or a label element; it shows only the chosen value.',
    pageToc: standardToc,
  },
  {
    id: 'glass-tabs',
    name: 'Glass Tabs',
    category: 'Navigation',
    status: 'ready',
    route: '/components/glass-tabs',
    description: 'Tabs on a glass pill, with one indicator that moves to the selected tab.',
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
      {
        name: 'GlassTabs',
        extends: 'Radix Tabs.Root props',
        props: [
          {
            name: 'value / defaultValue',
            type: 'string',
            default: '—',
            description: "Controlled or uncontrolled selected tab, matching a trigger's value.",
          },
          {
            name: 'onValueChange',
            type: '(value: string) => void',
            default: '—',
            description: "Called with the newly selected tab's value.",
          },
          {
            name: 'orientation',
            type: "'horizontal' | 'vertical'",
            default: "'horizontal'",
            description: 'Sets which arrow keys move between triggers.',
          },
        ],
      },
      {
        name: 'GlassTabsList',
        description: 'The glass pill that holds the triggers and the moving indicator.',
        extends: 'Radix Tabs.List props',
        props: [
          {
            name: 'className',
            type: 'string',
            default: '—',
            description: 'Applies to the glass pill.',
          },
        ],
      },
      {
        name: 'GlassTabsTrigger',
        extends: 'Radix Tabs.Trigger props',
        props: [
          {
            name: 'value',
            type: 'string',
            default: '—',
            description: 'Ties the trigger to the GlassTabsContent with the same value.',
            required: true,
          },
        ],
      },
      {
        name: 'GlassTabsContent',
        description: "The tab's panel, on a glass card.",
        extends: 'Radix Tabs.Content props',
        props: [
          {
            name: 'value',
            type: 'string',
            default: '—',
            description: 'Shown when the trigger with the same value is selected.',
            required: true,
          },
          {
            name: 'className',
            type: 'string',
            default: '—',
            description: 'Applies to the glass card.',
          },
        ],
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
    description: 'A modal glass dialog with an overlay, a focus trap and a close button.',
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
      {
        name: 'GlassDialog',
        extends: 'Radix Dialog.Root props',
        props: [
          {
            name: 'open / defaultOpen',
            type: 'boolean',
            default: 'false',
            description: 'Controlled or uncontrolled open state.',
          },
          {
            name: 'onOpenChange',
            type: '(open: boolean) => void',
            default: '—',
            description: 'Called when the dialog opens or closes.',
          },
          {
            name: 'modal',
            type: 'boolean',
            default: 'true',
            description: 'Traps focus and makes the page behind inert.',
          },
        ],
      },
      {
        name: 'GlassDialogTrigger',
        description: 'Opens the dialog.',
        extends: 'Radix Dialog.Trigger props',
        props: [
          {
            name: 'asChild',
            type: 'boolean',
            default: 'false',
            description: 'Renders your own element, such as a GlassButton, as the trigger.',
          },
        ],
      },
      {
        name: 'GlassDialogContent',
        description: 'Renders the portal, overlay, glass panel and a close button in the corner.',
        extends: 'Radix Dialog.Content props',
        props: [
          {
            name: 'closeLabel',
            type: 'string',
            default: "'Close dialog'",
            description: 'Accessible name of the built-in close button.',
          },
          {
            name: 'thickness',
            type: 'number',
            default: 'thickness preference',
            description:
              'Glass thickness as a multiple of regular (1); thicker glass bends the backdrop further at the rim.',
          },
          {
            name: 'className',
            type: 'string',
            default: '—',
            description: 'Applies to the glass panel.',
          },
        ],
      },
      {
        name: 'GlassDialogTitle',
        description: "The dialog's heading and accessible name.",
        extends: 'Radix Dialog.Title props',
        props: [],
      },
      {
        name: 'GlassDialogDescription',
        description: 'Supporting text, linked to the dialog with aria-describedby.',
        extends: 'Radix Dialog.Description props',
        props: [],
      },
      {
        name: 'GlassDialogPortal / GlassDialogOverlay',
        description:
          'The portal and the dimmed overlay. GlassDialogContent already renders both; use them only to build your own content.',
        extends: 'Radix Dialog.Portal and Dialog.Overlay props',
        props: [],
      },
    ],
    types: ['GlassDialogContentProps'],
    accessibility:
      'Put a GlassDialogTitle in every dialog; the dialog takes its accessible name from it.',
    pageToc: standardToc,
  },
  {
    id: 'glass-popover',
    name: 'Glass Popover',
    category: 'Overlays',
    status: 'ready',
    route: '/components/glass-popover',
    description: 'A glass popover anchored to the control that opens it.',
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
      {
        name: 'GlassPopover',
        extends: 'Radix Popover.Root props',
        props: [
          {
            name: 'open / defaultOpen',
            type: 'boolean',
            default: 'false',
            description: 'Controlled or uncontrolled open state.',
          },
          {
            name: 'onOpenChange',
            type: '(open: boolean) => void',
            default: '—',
            description: 'Called when the popover opens or closes.',
          },
        ],
      },
      {
        name: 'GlassPopoverTrigger',
        description: 'Toggles the popover.',
        extends: 'Radix Popover.Trigger props',
        props: [
          {
            name: 'asChild',
            type: 'boolean',
            default: 'false',
            description: 'Renders your own element, such as a GlassButton, as the trigger.',
          },
        ],
      },
      {
        name: 'GlassPopoverAnchor',
        description: 'Positions the popover against an element other than the trigger.',
        extends: 'Radix Popover.Anchor props',
        props: [],
      },
      {
        name: 'GlassPopoverContent',
        description: 'The floating glass panel, rendered in a portal.',
        extends: 'Radix Popover.Content props',
        props: [
          {
            name: 'sideOffset',
            type: 'number',
            default: '12',
            description: 'Gap between the trigger and the panel, in pixels.',
          },
          {
            name: 'side / align',
            type: "'top' | 'right' | 'bottom' | 'left' / 'start' | 'center' | 'end'",
            default: "'bottom' / 'center'",
            description: 'Preferred placement; it flips to stay on screen.',
          },
          {
            name: 'thickness',
            type: 'number',
            default: 'thickness preference',
            description:
              'Glass thickness as a multiple of regular (1); thicker glass bends the backdrop further at the rim.',
          },
          {
            name: 'className',
            type: 'string',
            default: '—',
            description: 'Applies to the glass panel.',
          },
        ],
      },
    ],
    types: ['GlassPopoverContentProps'],
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
      {
        name: 'GlassTooltipProvider',
        description: 'Shares open delays between tooltips. Wrap your app or a section in one.',
        extends: 'Radix Tooltip.Provider props',
        props: [
          {
            name: 'delayDuration',
            type: 'number',
            default: '700',
            description: 'Milliseconds of hover before a tooltip opens.',
          },
        ],
      },
      {
        name: 'GlassTooltip',
        extends: 'Radix Tooltip.Root props',
        props: [
          {
            name: 'open / defaultOpen',
            type: 'boolean',
            default: 'false',
            description: 'Controlled or uncontrolled open state.',
          },
          {
            name: 'onOpenChange',
            type: '(open: boolean) => void',
            default: '—',
            description: 'Called when the tooltip opens or closes.',
          },
        ],
      },
      {
        name: 'GlassTooltipTrigger',
        description: 'The element the tooltip describes.',
        extends: 'Radix Tooltip.Trigger props',
        props: [
          {
            name: 'asChild',
            type: 'boolean',
            default: 'false',
            description: 'Renders your own focusable element as the trigger.',
          },
        ],
      },
      {
        name: 'GlassTooltipContent',
        description: 'The glass label, rendered in a portal.',
        extends: 'Radix Tooltip.Content props',
        props: [
          {
            name: 'sideOffset',
            type: 'number',
            default: '6',
            description: 'Gap between the trigger and the label, in pixels.',
          },
          {
            name: 'side',
            type: "'top' | 'right' | 'bottom' | 'left'",
            default: "'top'",
            description: 'Preferred side; it flips to stay on screen.',
          },
          {
            name: 'className',
            type: 'string',
            default: '—',
            description: 'Applies to the glass panel.',
          },
        ],
      },
    ],
    requires: 'a GlassTooltipProvider around every GlassTooltip.',
    pageToc: standardToc,
  },
  {
    id: 'glass-toast',
    name: 'Glass Toast',
    category: 'Feedback',
    status: 'ready',
    route: '/components/glass-toast',
    description: 'A glass notification for brief updates that screen readers announce.',
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
      {
        name: 'GlassToastProvider',
        description:
          'Holds the toasts and their shared settings. Wrap your toasts and the viewport in it.',
        extends: 'Radix Toast.Provider props',
        props: [
          {
            name: 'duration',
            type: 'number',
            default: '5000',
            description: 'Milliseconds before a toast closes on its own.',
          },
          {
            name: 'swipeDirection',
            type: "'right' | 'left' | 'up' | 'down'",
            default: "'right'",
            description:
              'The way a swipe dismisses a toast; toasts also slide in from and out to this side.',
          },
          {
            name: 'label',
            type: 'string',
            default: "'Notification'",
            description: 'Prefix screen readers announce before each toast.',
          },
        ],
      },
      {
        name: 'GlassToast',
        description: 'One toast on a glass card.',
        extends: 'Radix Toast.Root props',
        props: [
          {
            name: 'open / defaultOpen',
            type: 'boolean',
            default: 'true',
            description:
              'Controlled or uncontrolled open state; an uncontrolled toast shows when it mounts.',
          },
          {
            name: 'onOpenChange',
            type: '(open: boolean) => void',
            default: '—',
            description: 'Called when the toast opens, times out or is dismissed.',
          },
          {
            name: 'duration',
            type: 'number',
            default: 'provider duration',
            description: "Overrides the provider's duration for this toast.",
          },
          {
            name: 'className',
            type: 'string',
            default: '—',
            description: 'Applies to the outer list item, not the glass card inside it.',
          },
        ],
      },
      {
        name: 'GlassToastTitle / GlassToastDescription',
        description: 'The heading and the message text.',
        extends: 'Radix Toast.Title and Toast.Description props',
        props: [],
      },
      {
        name: 'GlassToastAction',
        description: 'A pill button under the message, such as Undo.',
        extends: 'Radix Toast.Action props',
        props: [
          {
            name: 'altText',
            type: 'string',
            default: '—',
            description: 'Tells screen reader users how to do the action without the button.',
            required: true,
          },
        ],
      },
      {
        name: 'GlassToastClose',
        description: 'A round dismiss button that draws its own ×.',
        extends: 'Radix Toast.Close props',
        props: [
          {
            name: 'aria-label',
            type: 'string',
            default: "'Dismiss'",
            description:
              "The button's name. The default applies only without children; with children, their text names it.",
          },
          {
            name: 'children',
            type: 'ReactNode',
            default: '× icon',
            description: 'Replaces the × icon.',
          },
        ],
      },
      {
        name: 'GlassToastViewport',
        description:
          'The fixed list at the top right where toasts appear, portalled to document.body after hydration.',
        extends: 'Radix Toast.Viewport props',
        props: [
          {
            name: 'hotkey',
            type: 'string[]',
            default: "['F8']",
            description: 'Keys that move focus to the viewport.',
          },
        ],
      },
    ],
    requires: 'a GlassToastProvider around your toasts and one GlassToastViewport.',
    pageToc: standardToc,
  },
  {
    id: 'glass-accordion',
    name: 'Glass Accordion',
    category: 'Navigation',
    status: 'ready',
    route: '/components/glass-accordion',
    description: 'Collapsible glass sections that open one at a time or several at once.',
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
      {
        name: 'GlassAccordion',
        extends: 'Radix Accordion.Root props',
        props: [
          {
            name: 'type',
            type: "'single' | 'multiple'",
            default: '—',
            description: 'Whether one item or several can be open at once.',
            required: true,
          },
          {
            name: 'value / defaultValue',
            type: 'string (single) | string[] (multiple)',
            default: '—',
            description: 'Controlled or uncontrolled open item or items.',
          },
          {
            name: 'onValueChange',
            type: '(value: string) => void | (value: string[]) => void',
            default: '—',
            description: 'Called with the open item or items.',
          },
          {
            name: 'collapsible',
            type: 'boolean',
            default: 'false',
            description: 'With type single, lets the open item close again.',
          },
        ],
      },
      {
        name: 'GlassAccordionItem',
        extends: 'Radix Accordion.Item props',
        props: [
          {
            name: 'value',
            type: 'string',
            default: '—',
            description: 'Identifies the item in value and defaultValue.',
            required: true,
          },
        ],
      },
      {
        name: 'GlassAccordionTrigger',
        description: 'A glass button with a chevron, wrapped in an h3.',
        extends: 'Radix Accordion.Trigger props',
        props: [],
      },
      {
        name: 'GlassAccordionContent',
        description: "The item's panel on a glass card.",
        extends: 'Radix Accordion.Content props',
        props: [
          {
            name: 'className',
            type: 'string',
            default: '—',
            description: 'Applies to the glass card.',
          },
        ],
      },
    ],
    accessibility:
      'Each trigger sits inside an h3 that you cannot change, so place the accordion where an h3 fits the page outline.',
    pageToc: standardToc,
  },
  {
    id: 'glass-switch',
    name: 'Glass Switch',
    category: 'Controls',
    status: 'ready',
    route: '/components/glass-switch',
    description: 'A glass on/off switch in two sizes.',
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
      {
        name: 'GlassSwitch',
        description: 'A button with role switch and a glass knob.',
        extends: 'Radix Switch.Root props',
        props: [
          {
            name: 'size',
            type: "'sm' | 'md'",
            default: "'md'",
            description: 'Track size.',
          },
          {
            name: 'checked / defaultChecked',
            type: 'boolean',
            default: 'false',
            description: 'Controlled or uncontrolled on state.',
          },
          {
            name: 'onCheckedChange',
            type: '(checked: boolean) => void',
            default: '—',
            description: 'Called with the next checked value.',
          },
          {
            name: 'disabled',
            type: 'boolean',
            default: 'false',
            description: 'Stops the switch from toggling.',
          },
          {
            name: 'name / value',
            type: 'string',
            default: "— / 'on'",
            description: 'Submits the switch with a native form when checked.',
          },
        ],
      },
    ],
    types: ['GlassSwitchProps'],
    accessibility: 'Name the switch with aria-label or wrap it in a visible label element.',
    pageToc: standardToc,
  },
  {
    id: 'glass-slider',
    name: 'Glass Slider',
    category: 'Controls',
    status: 'ready',
    route: '/components/glass-slider',
    description: 'A glass slider for one value or a range, with one named thumb per value.',
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
        description: 'Renders the track, the filled range and one thumb per value.',
        extends: 'Radix Slider.Root props',
        props: [
          {
            name: 'value / defaultValue',
            type: 'number[]',
            default: '[min]',
            description:
              'Controlled or uncontrolled values; the array length sets the number of thumbs.',
          },
          {
            name: 'onValueChange',
            type: '(value: number[]) => void',
            default: '—',
            description: 'Called on every change while dragging or stepping.',
          },
          {
            name: 'onValueCommit',
            type: '(value: number[]) => void',
            default: '—',
            description: 'Called when a drag ends or a key changes the value.',
          },
          {
            name: 'min / max / step',
            type: 'number',
            default: '0 / 100 / 1',
            description: 'Range and increment of the values.',
          },
          {
            name: 'aria-label',
            type: 'string',
            default: '—',
            description:
              "Moved to the thumbs: a single thumb takes it as is; range thumbs get it with ', minimum', ', maximum' or ', 2 of 3' added.",
          },
          {
            name: 'thumbLabels',
            type: 'string[]',
            default: '—',
            description:
              'Names each thumb in value order, replacing the names built from aria-label.',
          },
        ],
      },
    ],
    types: ['GlassSliderProps'],
    accessibility:
      'Each thumb is its own slider; name range sliders with aria-label or thumbLabels, because aria-labelledby is copied to every thumb and gives them all the same name.',
    pageToc: standardToc,
  },
  {
    id: 'glass-segmented-control',
    name: 'Glass Segmented Control',
    category: 'Controls',
    status: 'ready',
    route: '/components/glass-segmented-control',
    description:
      'A single-choice glass control for two to six options, with a draggable selection.',
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
        description: 'A Radix RadioGroup root rendered as a glass pill.',
        extends: 'Radix RadioGroup.Root props',
        props: [
          {
            name: 'value / defaultValue',
            type: 'string',
            default: '—',
            description: 'The selected option, controlled or uncontrolled.',
          },
          {
            name: 'onValueChange',
            type: '(value: string) => void',
            default: '—',
            description: 'Called with the value of the newly selected option.',
          },
          {
            name: 'children',
            type: 'ReactNode',
            default: '—',
            description:
              'Two to six GlassSegmentedControlItem elements placed directly inside the control, which CSS counts to place the selection before scripts run.',
          },
        ],
      },
      {
        name: 'GlassSegmentedControlItem',
        description: 'One option; options share the width equally.',
        extends: 'Radix RadioGroup.Item props',
        props: [
          {
            name: 'value',
            type: 'string',
            default: '—',
            description: 'The value this option selects.',
            required: true,
          },
        ],
      },
    ],
    types: ['GlassSegmentedControlProps'],
    accessibility:
      'Name the group with aria-label or aria-labelledby; arrow keys move the selection, as in any radio group.',
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
      {
        name: 'GlassBadge',
        description: 'A span with no client JavaScript, so it works in Server Components.',
        extends: 'HTML span attributes',
        props: [
          {
            name: 'tone',
            type: "'neutral' | 'blue' | 'green' | 'orange' | 'red' | 'purple'",
            default: "'neutral'",
            description: 'Tint and text colour.',
          },
          {
            name: 'dot',
            type: 'boolean',
            default: 'false',
            description: 'Adds a leading dot in the tone colour.',
          },
        ],
      },
    ],
    types: ['GlassBadgeProps', 'GlassBadgeTone'],
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
      'A glass progress bar for known values, with a sweeping state for unknown lengths.',
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
      {
        name: 'GlassProgress',
        description: 'A progressbar track with an optional label row above it.',
        extends: 'HTML div attributes, except children',
        props: [
          {
            name: 'value',
            type: 'number | null',
            default: '—',
            description:
              'Progress toward max, clamped to 0–max; omit it or pass null when the length is unknown.',
          },
          {
            name: 'max',
            type: 'number',
            default: '100',
            description: 'The value that means complete.',
          },
          {
            name: 'label',
            type: 'ReactNode',
            default: '—',
            description: 'Text above the bar that also names it.',
          },
          {
            name: 'showValue',
            type: 'boolean',
            default: 'false',
            description: 'Shows the rounded percentage beside the label while the value is known.',
          },
          {
            name: 'size',
            type: "'sm' | 'md' | 'lg'",
            default: "'md'",
            description: 'Track height: 0.25rem, 0.5rem or 0.75rem.',
          },
          {
            name: 'aria-label / aria-labelledby',
            type: 'string',
            default: '—',
            description:
              'Names the bar when there is no visible label; applied to the progressbar track, not the outer div.',
          },
        ],
      },
    ],
    types: ['GlassProgressProps', 'GlassProgressSize'],
    accessibility:
      'Give the bar a label, aria-label or aria-labelledby; an unknown length leaves out aria-valuenow.',
    pageToc: standardToc,
  },
  {
    id: 'glass-spinner',
    name: 'Glass Spinner',
    category: 'Feedback',
    isNew: true,
    status: 'ready',
    route: '/components/glass-spinner',
    description: 'A small spinning ring that tells screen readers something is loading.',
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
      {
        name: 'GlassSpinner',
        description:
          "A span with role status; the ring is drawn in the theme's foreground colour, so set color to change it.",
        extends: 'HTML span attributes, except children',
        props: [
          {
            name: 'label',
            type: 'string',
            default: "'Loading'",
            description: 'Visually hidden text that screen readers announce.',
          },
          {
            name: 'size',
            type: "'sm' | 'md' | 'lg'",
            default: "'md'",
            description: 'Diameter: 1rem, 1.5rem or 2.25rem.',
          },
          {
            name: 'role',
            type: 'string',
            default: "'status'",
            description:
              'Live-region role; override it when the spinner sits inside another live region.',
          },
        ],
      },
    ],
    types: ['GlassSpinnerProps', 'GlassSpinnerSize'],
    pageToc: standardToc,
  },
  {
    id: 'glass-skeleton',
    name: 'Glass Skeleton',
    category: 'Feedback',
    isNew: true,
    status: 'ready',
    route: '/components/glass-skeleton',
    description:
      'A glass placeholder block, circle or set of text lines shown while content loads.',
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
        description: 'A div hidden from assistive technology with aria-hidden.',
        extends: 'HTML div attributes, except children',
        props: [
          {
            name: 'variant',
            type: "'block' | 'circle' | 'text'",
            default: "'block'",
            description:
              'block is sized with CSS, circle is a 2.5rem circle you can resize with width, and text is a stack of lines.',
          },
          {
            name: 'lines',
            type: 'number',
            default: '3',
            description:
              'Line count for the text variant, at least 1; the last of several lines is shorter.',
          },
        ],
      },
    ],
    types: ['GlassSkeletonProps', 'GlassSkeletonVariant'],
    accessibility: 'Skeletons are aria-hidden, so set aria-busy on the region that is loading.',
    pageToc: standardToc,
  },
  {
    id: 'glass-alert',
    name: 'Glass Alert',
    category: 'Feedback',
    isNew: true,
    status: 'ready',
    route: '/components/glass-alert',
    description: 'A tinted glass message with four tones, an icon and an optional dismiss button.',
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
        description:
          'className, ref and other props reach the inner alert. Space stacked dismissible alerts with margin, not a parent gap, so the space folds away with them.',
        extends: 'HTML div attributes, with title replaced',
        props: [
          {
            name: 'tone',
            type: "'info' | 'success' | 'warning' | 'danger'",
            default: "'info'",
            description: 'Colour, icon and announcement role.',
          },
          {
            name: 'title',
            type: 'ReactNode',
            default: '—',
            description: 'A bold line above the message.',
          },
          {
            name: 'icon',
            type: 'ReactNode | false',
            default: 'tone icon',
            description: "Replaces the tone's decorative icon; false shows none.",
          },
          {
            name: 'onDismiss',
            type: '() => void',
            default: '—',
            description:
              'Shows a close button and runs after the alert folds away; remove the alert here and give each alert a stable key.',
          },
          {
            name: 'dismissLabel',
            type: 'string',
            default: "'Dismiss'",
            description: 'Accessible name of the close button.',
          },
          {
            name: 'role',
            type: 'string',
            default: "'alert' for warning and danger, else 'status'",
            description: 'Overrides the announcement role.',
          },
        ],
      },
    ],
    types: ['GlassAlertProps', 'GlassAlertTone'],
    accessibility:
      'warning and danger use role alert and interrupt screen readers, while info and success use role status; pass role to change that.',
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
      'A round photo that falls back to initials, with a presence dot and stacked groups.',
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
        description:
          'A span with role img, named by alt or name plus its status; the photo uses Radix Avatar inside it.',
        extends: 'HTML span attributes, except children',
        props: [
          {
            name: 'name',
            type: 'string',
            default: '—',
            description: "The person's name; supplies the initials and a stable initials colour.",
          },
          {
            name: 'src',
            type: 'string',
            default: '—',
            description: 'Image URL; the initials show until it loads, or if it fails.',
          },
          {
            name: 'alt',
            type: 'string',
            default: 'name',
            description: 'Accessible name of the avatar.',
          },
          {
            name: 'fallback',
            type: 'ReactNode',
            default: 'initials of name',
            description: 'Replaces the initials.',
          },
          {
            name: 'size',
            type: "'xs' | 'sm' | 'md' | 'lg' | 'xl'",
            default: "'md'",
            description: 'Diameter; ignored inside a GlassAvatarGroup, which sizes its avatars.',
          },
          {
            name: 'status',
            type: "'online' | 'away' | 'busy' | 'offline'",
            default: '—',
            description: 'A presence dot on the corner, also added to the accessible name.',
          },
        ],
      },
      {
        name: 'GlassAvatarGroup',
        description: 'A div with role group that overlaps its avatars.',
        extends: 'HTML div attributes',
        props: [
          {
            name: 'children',
            type: 'ReactNode',
            default: '—',
            description: 'GlassAvatar elements, placed directly inside the group.',
          },
          {
            name: 'max',
            type: 'number',
            default: '—',
            description: 'Shows this many avatars, then a +N avatar for the rest.',
          },
          {
            name: 'size',
            type: "'xs' | 'sm' | 'md' | 'lg' | 'xl'",
            default: "'md'",
            description: "Sizes every avatar in the group, overriding each avatar's own size.",
          },
        ],
      },
    ],
    types: ['GlassAvatarProps', 'GlassAvatarSize', 'GlassAvatarStatus', 'GlassAvatarGroupProps'],
    accessibility:
      'Name each GlassAvatarGroup with aria-label; the avatar announces its name and status.',
    pageToc: standardToc,
  },
  {
    id: 'glass-kbd',
    name: 'Glass Kbd',
    category: 'Surfaces',
    isNew: true,
    status: 'ready',
    route: '/components/glass-kbd',
    description: 'A keycap for showing keyboard shortcuts in menus, hints and docs.',
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
        description: 'A kbd element for one key or symbol, with no client JavaScript.',
        extends: 'HTML element attributes',
        props: [],
      },
      {
        name: 'GlassKbdGroup',
        description: "A span that sets a shortcut's keys side by side.",
        extends: 'HTML span attributes',
        props: [],
      },
    ],
    pageToc: standardToc,
  },
  {
    id: 'glass-scroll-area',
    name: 'Glass Scroll Area',
    category: 'Surfaces',
    isNew: true,
    status: 'ready',
    route: '/components/glass-scroll-area',
    description:
      'A scroll container with a thin glass scrollbar that shows on hover and while scrolling.',
    accessibility:
      'When the content holds no links or controls, pass tabIndex={0}, role="region" and an aria-label in viewportProps so keyboard users can scroll it.',
    usage: `import { GlassScrollArea } from "@/components/glassyui/glass-scroll-area";

export function ReleaseNotes({ notes }: { notes: string[] }) {
  return (
    <GlassScrollArea
      className="h-64"
      viewportProps={{ "aria-label": "Release notes", role: "region", tabIndex: 0 }}
    >
      <ul className="space-y-3 p-4">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </GlassScrollArea>
  );
}`,
    examples: [
      {
        title: 'Grow to a maximum height',
        code: `<GlassScrollArea className="max-h-80">{children}</GlassScrollArea>`,
      },
      {
        title: 'Scroll sideways',
        code: `<GlassScrollArea scrollbars="horizontal">
  <div className="flex w-max gap-3">{cards}</div>
</GlassScrollArea>`,
      },
      {
        title: 'Show the scrollbar whenever the content overflows',
        code: `<GlassScrollArea type="auto" className="h-64">{children}</GlassScrollArea>`,
      },
    ],
    api: [
      {
        name: 'GlassScrollArea',
        description:
          "A div whose viewport scrolls natively, with glass scrollbars in place of the system's.",
        extends: 'HTML div attributes',
        props: [
          {
            name: 'scrollbars',
            type: "'vertical' | 'horizontal' | 'both'",
            default: "'vertical'",
            description: 'Which scrollbars to draw.',
          },
          {
            name: 'type',
            type: "'hover' | 'scroll' | 'auto' | 'always'",
            default: "'hover'",
            description:
              'When a scrollbar shows: on hover and while scrolling, only while scrolling, whenever the content overflows, or always.',
          },
          {
            name: 'scrollHideDelay',
            type: 'number',
            default: '600',
            description:
              'Milliseconds a scrollbar stays after the pointer leaves or scrolling stops.',
          },
          {
            name: 'viewportProps',
            type: 'ScrollAreaViewportProps',
            default: '—',
            description: 'Props for the element that scrolls, such as a ref, role or aria-label.',
          },
        ],
      },
    ],
    types: ['GlassScrollAreaProps'],
    pageToc: standardToc,
  },
  {
    id: 'glass-dock',
    name: 'Glass Dock',
    category: 'Navigation',
    status: 'ready',
    route: '/components/glass-dock',
    description: 'A row of app icons on a glass shelf, with labels on hover and focus.',
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
      {
        name: 'GlassDock',
        description: 'The row; a glass shelf is drawn behind its items.',
        extends: 'HTML div attributes',
        props: [],
      },
      {
        name: 'GlassDockItem',
        description: 'An icon button with a hover label and a running dot.',
        extends: 'HTML button attributes',
        props: [
          {
            name: 'label',
            type: 'string',
            default: '—',
            description:
              'Accessible name and the label shown above the icon on hover or keyboard focus.',
            required: true,
          },
          {
            name: 'children',
            type: 'ReactNode',
            default: '—',
            description: 'The icon; it fills the item unless you size it.',
          },
          {
            name: 'active',
            type: 'boolean',
            default: 'false',
            description: 'Shows the running dot under the icon.',
          },
          {
            name: 'asChild',
            type: 'boolean',
            default: 'false',
            description: 'Renders the single child, such as a link, as the item.',
          },
          {
            name: 'type',
            type: "'button' | 'submit' | 'reset'",
            default: "'button'",
            description: 'Native button type; not set when asChild is true.',
          },
        ],
      },
      {
        name: 'GlassDockSeparator',
        description: 'A vertical separator between groups of items.',
        extends: 'HTML div attributes',
        props: [],
      },
    ],
    types: ['GlassDockProps', 'GlassDockItemProps'],
    accessibility:
      'GlassDock adds no landmark or name, so wrap it in a nav or give it aria-label when it is navigation.',
    pageToc: standardToc,
  },
  {
    id: 'glass-breadcrumb',
    name: 'Glass Breadcrumb',
    category: 'Navigation',
    isNew: true,
    status: 'ready',
    route: '/components/glass-breadcrumb',
    description: 'A breadcrumb trail to the current page, with an ellipsis for folded steps.',
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
        description:
          'A nav landmark labelled Breadcrumb around an ordered list. Works in Server Components.',
        extends: 'HTML nav attributes',
        props: [
          {
            name: 'aria-label',
            type: 'string',
            default: "'Breadcrumb'",
            description: 'Accessible name of the landmark.',
          },
        ],
      },
      {
        name: 'GlassBreadcrumbItem',
        description: 'One step. It draws a chevron after itself, except on the last step.',
        extends: 'HTML li attributes',
        props: [],
      },
      {
        name: 'GlassBreadcrumbLink',
        description: 'A link step.',
        extends: 'HTML anchor attributes',
        props: [
          {
            name: 'asChild',
            type: 'boolean',
            default: 'false',
            description: "Renders your own link, such as a router's, with the link styles.",
          },
        ],
      },
      {
        name: 'GlassBreadcrumbPage',
        description: 'The current page, as text with aria-current="page".',
        extends: 'HTML span attributes',
        props: [],
      },
      {
        name: 'GlassBreadcrumbEllipsis',
        description:
          'A button that stands in for folded steps, so it can trigger a GlassMenu of them.',
        extends: 'HTML button attributes',
        props: [
          {
            name: 'aria-label',
            type: 'string',
            default: "'Show hidden pages'",
            description: 'Accessible name of the button.',
          },
        ],
      },
    ],
    types: ['GlassBreadcrumbLinkProps'],
    pageToc: standardToc,
  },
  {
    id: 'glass-pagination',
    name: 'Glass Pagination',
    category: 'Navigation',
    isNew: true,
    status: 'ready',
    route: '/components/glass-pagination',
    description:
      'Numbered page buttons with previous and next, folding long runs into an ellipsis.',
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
        description: 'A nav landmark labelled Pagination, with a button for each shown page.',
        extends: 'HTML nav attributes (except onChange)',
        props: [
          {
            name: 'page',
            type: 'number',
            default: '—',
            description:
              'The current page, counting from 1. Values outside 1 to pageCount are clamped.',
            required: true,
          },
          {
            name: 'pageCount',
            type: 'number',
            default: '—',
            description: 'How many pages there are.',
            required: true,
          },
          {
            name: 'onPageChange',
            type: '(page: number) => void',
            default: '—',
            description: 'Called with the page to show. Store it and pass it back as page.',
            required: true,
          },
          {
            name: 'siblingCount',
            type: 'number',
            default: '1',
            description: 'Pages shown on each side of the current page.',
          },
          {
            name: 'boundaryCount',
            type: 'number',
            default: '1',
            description: 'Pages always shown at each end.',
          },
          {
            name: 'previousLabel',
            type: 'string',
            default: "'Previous page'",
            description: 'Accessible name of the previous button.',
          },
          {
            name: 'nextLabel',
            type: 'string',
            default: "'Next page'",
            description: 'Accessible name of the next button.',
          },
        ],
      },
    ],
    types: ['GlassPaginationProps'],
    accessibility: 'Page buttons are named Page N and the current one has aria-current="page".',
    pageToc: standardToc,
  },
  {
    id: 'glass-sheet',
    name: 'Glass Sheet',
    category: 'Overlays',
    status: 'ready',
    route: '/components/glass-sheet',
    description:
      'A modal glass panel that slides in from a screen edge; bottom sheets drag down to close.',
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
      {
        name: 'GlassSheet',
        extends: 'Radix Dialog.Root props',
        props: [
          {
            name: 'open / defaultOpen',
            type: 'boolean',
            default: '—',
            description: 'Controlled or initial open state.',
          },
          {
            name: 'onOpenChange',
            type: '(open: boolean) => void',
            default: '—',
            description: 'Called when the sheet opens or closes.',
          },
        ],
      },
      {
        name: 'GlassSheetTrigger',
        extends: 'Radix Dialog.Trigger props',
        props: [
          {
            name: 'asChild',
            type: 'boolean',
            default: 'false',
            description: 'Uses your own element, such as a GlassButton, as the trigger.',
          },
        ],
      },
      {
        name: 'GlassSheetContent',
        description: 'Portal, overlay, glass panel and a close button in the top corner.',
        extends: 'Radix Dialog.Content props',
        props: [
          {
            name: 'side',
            type: "'top' | 'right' | 'bottom' | 'left'",
            default: "'bottom'",
            description:
              'Edge the sheet slides in from. Only bottom sheets get a drag handle that dismisses them.',
          },
          {
            name: 'closeLabel',
            type: 'string',
            default: "'Close sheet'",
            description: 'Accessible name of the close button.',
          },
          {
            name: 'thickness',
            type: 'number',
            default: 'thickness preference',
            description: 'Glass thickness as a multiple of regular.',
          },
          {
            name: 'onCloseAutoFocus',
            type: '(event: Event) => void',
            default: '—',
            description:
              'Radix focus hook; use it to send focus back when the sheet has no trigger.',
          },
        ],
      },
      {
        name: 'GlassSheetTitle',
        extends: 'Radix Dialog.Title props',
        props: [],
      },
      {
        name: 'GlassSheetDescription',
        extends: 'Radix Dialog.Description props',
        props: [],
      },
      {
        name: 'GlassSheetClose',
        extends: 'Radix Dialog.Close props',
        props: [
          {
            name: 'asChild',
            type: 'boolean',
            default: 'false',
            description: 'Uses your own element as an extra close control.',
          },
        ],
      },
    ],
    types: ['GlassSheetContentProps', 'GlassSheetSide'],
    accessibility:
      'Render a GlassSheetTitle in every sheet, and when a sheet opens from a menu item rather than a trigger, return focus to the menu button in onCloseAutoFocus.',
    pageToc: standardToc,
  },
  {
    id: 'glass-menu',
    name: 'Glass Menu',
    category: 'Overlays',
    status: 'ready',
    route: '/components/glass-menu',
    description: 'A glass dropdown menu with shortcuts, checkbox and radio items, and submenus.',
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
        extends: 'Radix DropdownMenu.Root props',
        props: [
          {
            name: 'modal',
            type: 'boolean',
            default: 'false',
            description:
              'Locks page scroll and hides the page from assistive technology while open. Off by default, so the page keeps its scroll.',
          },
          {
            name: 'open / defaultOpen',
            type: 'boolean',
            default: '—',
            description: 'Controlled or initial open state.',
          },
          {
            name: 'onOpenChange',
            type: '(open: boolean) => void',
            default: '—',
            description: 'Called when the menu opens or closes.',
          },
        ],
      },
      {
        name: 'GlassMenuTrigger',
        extends: 'Radix DropdownMenu.Trigger props',
        props: [
          {
            name: 'asChild',
            type: 'boolean',
            default: 'false',
            description: 'Uses your own element, such as a GlassButton, as the trigger.',
          },
        ],
      },
      {
        name: 'GlassMenuContent',
        description: 'The glass panel, rendered in a portal.',
        extends: 'Radix DropdownMenu.Content props',
        props: [
          {
            name: 'sideOffset',
            type: 'number',
            default: '8',
            description: 'Gap in pixels between the trigger and the menu.',
          },
          {
            name: 'thickness',
            type: 'number',
            default: 'thickness preference',
            description: 'Glass thickness as a multiple of regular.',
          },
        ],
      },
      {
        name: 'GlassMenuItem',
        extends: 'Radix DropdownMenu.Item props',
        props: [
          {
            name: 'tone',
            type: "'default' | 'destructive'",
            default: "'default'",
            description: 'destructive colours the item for actions such as Delete.',
          },
          {
            name: 'inset',
            type: 'boolean',
            default: 'false',
            description: 'Indents the label to line up with checkbox and radio items.',
          },
          {
            name: 'onSelect',
            type: '(event: Event) => void',
            default: '—',
            description: 'Called when the item is chosen by click or keyboard.',
          },
        ],
      },
      {
        name: 'GlassMenuCheckboxItem',
        description: 'An item with a check mark.',
        extends: 'Radix DropdownMenu.CheckboxItem props',
        props: [
          {
            name: 'checked',
            type: "boolean | 'indeterminate'",
            default: '—',
            description: 'Whether the check shows.',
          },
          {
            name: 'onCheckedChange',
            type: '(checked: boolean) => void',
            default: '—',
            description: 'Called when the item is toggled.',
          },
        ],
      },
      {
        name: 'GlassMenuRadioGroup',
        extends: 'Radix DropdownMenu.RadioGroup props',
        props: [
          {
            name: 'value / onValueChange',
            type: 'string / (value: string) => void',
            default: '—',
            description: "The selected item's value, and the handler that changes it.",
          },
        ],
      },
      {
        name: 'GlassMenuRadioItem',
        description: 'An item with a dot when selected.',
        extends: 'Radix DropdownMenu.RadioItem props',
        props: [
          {
            name: 'value',
            type: 'string',
            default: '—',
            description: 'The value this item selects in its GlassMenuRadioGroup.',
            required: true,
          },
        ],
      },
      {
        name: 'GlassMenuGroup',
        extends: 'Radix DropdownMenu.Group props',
        props: [],
      },
      {
        name: 'GlassMenuLabel / GlassMenuSeparator',
        description: 'A section label and a hairline divider.',
        extends: 'Radix DropdownMenu.Label / Separator props',
        props: [],
      },
      {
        name: 'GlassMenuShortcut',
        description: 'A keyboard shortcut hint pushed to the end of an item.',
        extends: 'HTML span attributes',
        props: [],
      },
      {
        name: 'GlassMenuSub',
        extends: 'Radix DropdownMenu.Sub props',
        props: [],
      },
      {
        name: 'GlassMenuSubTrigger',
        description: 'The item that opens a submenu, with a chevron.',
        extends: 'Radix DropdownMenu.SubTrigger props',
        props: [
          {
            name: 'inset',
            type: 'boolean',
            default: 'false',
            description: 'Indents the label to line up with checkbox and radio items.',
          },
        ],
      },
      {
        name: 'GlassMenuSubContent',
        description: "The submenu's glass panel, rendered in a portal.",
        extends: 'Radix DropdownMenu.SubContent props',
        props: [
          {
            name: 'sideOffset',
            type: 'number',
            default: '6',
            description: 'Gap in pixels between the submenu and its trigger.',
          },
          {
            name: 'alignOffset',
            type: 'number',
            default: '-6',
            description: 'Shifts the submenu along its trigger so the first item lines up.',
          },
        ],
      },
    ],
    types: ['GlassMenuContentProps', 'GlassMenuItemProps'],
    pageToc: standardToc,
  },
  {
    id: 'glass-command',
    name: 'Glass Command',
    category: 'Overlays',
    isNew: true,
    status: 'ready',
    route: '/components/glass-command',
    description: 'A searchable command list that filters as you type, alone or in a dialog.',
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
        description:
          'The searchable list, with no glass of its own. Place it in GlassCommandDialog, a GlassPanel or a GlassPopover.',
        extends: 'cmdk Command props',
        props: [
          {
            name: 'label',
            type: 'string',
            default: '—',
            description: 'Accessible name of the list. Not shown.',
          },
          {
            name: 'value / onValueChange',
            type: 'string / (value: string) => void',
            default: '—',
            description: "The highlighted item's value, and the handler that changes it.",
          },
          {
            name: 'shouldFilter',
            type: 'boolean',
            default: 'true',
            description: 'Set to false to filter the items yourself.',
          },
          {
            name: 'filter',
            type: '(value: string, search: string, keywords?: string[]) => number',
            default: "cmdk's fuzzy score",
            description: 'Scores each item from 0 (hidden) to 1 (best match).',
          },
          {
            name: 'loop',
            type: 'boolean',
            default: 'false',
            description: 'Wraps the arrow keys from the last item to the first.',
          },
        ],
      },
      {
        name: 'GlassCommandDialog',
        description: 'A glass dialog near the top of the page that holds a GlassCommand.',
        extends: 'Radix Dialog.Root props',
        props: [
          {
            name: 'open / onOpenChange',
            type: 'boolean / (open: boolean) => void',
            default: '—',
            description: 'Controlled open state and its handler.',
          },
          {
            name: 'title',
            type: 'string',
            default: "'Command menu'",
            description: 'Accessible name of the dialog. Not shown.',
          },
          {
            name: 'className',
            type: 'string',
            default: '—',
            description: 'Classes for the glass panel.',
          },
        ],
      },
      {
        name: 'GlassCommandInput',
        description: 'The search field, with a magnifier icon.',
        extends: 'cmdk Command.Input props',
        props: [
          {
            name: 'value / onValueChange',
            type: 'string / (search: string) => void',
            default: '—',
            description: 'Controlled search text and its handler.',
          },
        ],
      },
      {
        name: 'GlassCommandList',
        description:
          'The scrolling results. Its height follows the results, up to 22rem or 60% of the viewport.',
        extends: 'cmdk Command.List props',
        props: [],
      },
      {
        name: 'GlassCommandEmpty',
        description: 'Shown only when the search matches nothing.',
        extends: 'cmdk Command.Empty props',
        props: [],
      },
      {
        name: 'GlassCommandGroup',
        extends: 'cmdk Command.Group props',
        props: [
          {
            name: 'heading',
            type: 'ReactNode',
            default: '—',
            description: "The group's heading. Without one, pass a unique value.",
          },
        ],
      },
      {
        name: 'GlassCommandItem',
        extends: 'cmdk Command.Item props',
        props: [
          {
            name: 'onSelect',
            type: '(value: string) => void',
            default: '—',
            description: 'Runs on Enter or click.',
          },
          {
            name: 'value',
            type: 'string',
            default: "the item's text",
            description:
              'Unique value used for search and selection. Pass one if the text changes.',
          },
          {
            name: 'keywords',
            type: 'string[]',
            default: '—',
            description: 'Extra words the search matches.',
          },
          {
            name: 'disabled',
            type: 'boolean',
            default: 'false',
            description: 'Skips the item in navigation and selection.',
          },
        ],
      },
      {
        name: 'GlassCommandSeparator',
        description: 'A decorative divider between groups, hidden from assistive technology.',
        extends: 'HTML div attributes',
        props: [
          {
            name: 'alwaysRender',
            type: 'boolean',
            default: 'false',
            description: 'Keeps the divider while a search is typed; by default it hides.',
          },
        ],
      },
      {
        name: 'GlassCommandShortcut',
        description: 'A shortcut hint pushed to the end of an item. Put GlassKbd keys inside.',
        extends: 'HTML span attributes',
        props: [],
      },
    ],
    types: ['GlassCommandDialogProps', 'GlassCommandSeparatorProps'],
    accessibility:
      'GlassCommandDialog returns focus to the element that had it when the dialog opened.',
    pageToc: standardToc,
  },
  {
    id: 'glass-lens',
    name: 'Glass Lens',
    category: 'Effects',
    status: 'ready',
    route: '/components/glass-lens',
    description: 'A draggable magnifier with a glass rim that bends the content beneath it.',
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
        description: 'A stage that renders its children with a draggable lens over them.',
        extends: 'HTML div attributes',
        props: [
          {
            name: 'children',
            type: 'ReactNode',
            default: '—',
            description:
              'Content to magnify. It renders twice, so give it its own background and avoid ids.',
            required: true,
          },
          {
            name: 'size',
            type: 'number',
            default: '160',
            description: 'Lens diameter in pixels.',
          },
          {
            name: 'zoom',
            type: 'number',
            default: '1.6',
            description: 'Magnification inside the lens.',
          },
          {
            name: 'defaultPosition',
            type: '{ x: number; y: number }',
            default: '{ x: 0.5, y: 0.5 }',
            description: "Starting centre as fractions of the stage's width and height.",
          },
          {
            name: 'label',
            type: 'string',
            default: "'Magnifier'",
            description: 'Accessible name of the lens.',
          },
        ],
      },
    ],
    types: ['GlassLensProps'],
    accessibility: 'The lens is focusable: arrow keys move it 10px, or 50px with Shift.',
    pageToc: standardToc,
  },
  {
    id: 'glass-scene',
    name: 'Glass Scene',
    category: 'Effects',
    status: 'ready',
    route: '/components/glass-scene',
    description:
      'A WebGL2 canvas that refracts a backdrop image through the glass components inside it.',
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
          'Paints the backdrop and the glass inside it on one canvas. GlassSurface, GlassPanel, GlassButton (except ghost) and GlassDrop join it; portalled overlays and glass nested in other glass keep their CSS glass.',
        extends: 'HTML div attributes',
        props: [
          {
            name: 'backdrop',
            type: 'string',
            default: '—',
            description:
              'The image the glass refracts: a URL, or a CSS url() or var() value. Without it, or --lg-scene-backdrop in CSS, the scene keeps its CSS glass.',
          },
          {
            name: 'backdropSpace',
            type: "'local' | 'viewport'",
            default: "'local'",
            description:
              'local covers the scene with the backdrop; viewport pins it to the viewport, like background-attachment: fixed.',
          },
          {
            name: 'flow',
            type: 'boolean',
            default: 'false',
            description:
              'Lets GlassDrops ripple like liquid. Held still under reduced motion and low quality.',
          },
          {
            name: 'optics.ior',
            type: 'number',
            default: '1.5',
            description: 'Refractive index. Higher values bend the backdrop more.',
          },
          {
            name: 'optics.thickness',
            type: 'number',
            default: '40 × thickness preference',
            description: 'Slab height in CSS pixels. Thicker glass bends further.',
          },
          {
            name: 'optics.bevel',
            type: 'number',
            default: '28 × (0.6 + 0.4 × thickness preference)',
            description: 'Width of the curved rim in CSS pixels.',
          },
          {
            name: 'optics.dispersion',
            type: 'number',
            default: '0.15 × thickness preference',
            description: 'How far the rim splits light into colour. 0 turns it off.',
          },
          {
            name: 'optics.frost',
            type: 'number',
            default: '1',
            description: "Multiplier on every piece's frost.",
          },
          {
            name: 'optics.merge',
            type: 'number',
            default: '12',
            description: 'Distance in CSS pixels within which neighbouring pieces melt together.',
          },
          {
            name: 'optics.specular',
            type: 'number',
            default: '1',
            description: 'Strength of reflections and highlights.',
          },
        ],
      },
      {
        name: 'GlassDrop',
        description: 'A plain piece of glass for a scene. Size, round and place it with CSS.',
        extends: 'HTML div attributes',
        props: [
          {
            name: 'merge',
            type: 'number',
            default: "the scene's optics.merge",
            description: "This drop's merge distance in CSS pixels.",
          },
        ],
      },
    ],
    types: ['GlassSceneProps', 'GlassSceneOptics', 'GlassDropProps'],
    requires:
      'WebGL2 and a backdrop image from your origin or served with CORS. Without either, every piece keeps its CSS glass.',
    accessibility:
      'Scene glass keeps text in its --lg-scene-ink colour at 4.5:1 contrast over any backdrop; set --lg-scene-ink to transparent on custom glass that carries no text.',
    pageToc: standardToc,
  },
  {
    id: 'glass-logo-reveal',
    name: 'Glass Logo Reveal',
    category: 'Effects',
    isNew: true,
    status: 'ready',
    route: '/components/glass-logo-reveal',
    searchTitle: 'Glass Logo Reveal: a WebGL logo animation for React',
    description:
      'A logo sting: a ball of thick glass swells around your mark, squares into a glass tile and clears, leaving the real mark.',
    usage: `import { GlassLogoReveal } from "@/components/glassyui/glass-logo-reveal";

export function Intro() {
  return (
    <GlassLogoReveal
      className="w-full max-w-3xl rounded-3xl"
      markSrc="/logo.svg"
      label="Acme"
    />
  );
}`,
    examples: [
      {
        title: 'Play it again',
        code: `const [run, setRun] = useState(0);

return (
  <>
    <GlassLogoReveal key={run} markSrc="/logo.svg" label="Acme" />
    <button type="button" onClick={() => setRun(run + 1)}>
      Replay
    </button>
  </>
);`,
      },
      {
        title: 'Scrub it with a slider',
        code: `const [moment, setMoment] = useState<number>();

return (
  <>
    <GlassLogoReveal markSrc="/logo.svg" label="Acme" progress={moment} />
    <input
      aria-label="Moment"
      max={100}
      min={0}
      type="range"
      onChange={(event) => setMoment(Number(event.target.value) / 100)}
    />
  </>
);`,
      },
      {
        title: 'Open a splash screen',
        code: `const [splash, setSplash] = useState(true);

return splash ? (
  <GlassLogoReveal
    className="fixed inset-0 aspect-auto"
    markSrc="/logo.svg"
    label="Acme"
    play="mount"
    onComplete={() => setTimeout(() => setSplash(false), 600)}
  />
) : (
  <App />
);`,
      },
      {
        title: 'Set the stage and the size',
        code: `<GlassLogoReveal
  className="aspect-[3/1] bg-black [--lg-logo-reveal-size:40cqmin]"
  markSrc="/logo-white.svg"
  label="Acme"
/>`,
      },
    ],
    api: [
      {
        name: 'GlassLogoReveal',
        description:
          "A figure with role img: the stage, drawn on a canvas, and the mark it lands on. Its background is the stage; --lg-logo-reveal-size sets the mark's height, a third of the stage by default. The glass is ray-traced, so it bends the mark as real glass would and lands on it exactly.",
        extends: 'HTML figure attributes (no children)',
        props: [
          {
            name: 'markSrc',
            type: 'string',
            default: '—',
            description:
              'The mark, from your origin or served with CORS. An SVG stays sharp under the glass.',
            required: true,
          },
          {
            name: 'label',
            type: 'string',
            default: '—',
            description: "The mark's accessible name, such as your product's name.",
            required: true,
          },
          {
            name: 'play',
            type: "'visible' | 'mount'",
            default: "'visible'",
            description: 'Plays once: when half the figure is on screen, or as soon as it mounts.',
          },
          {
            name: 'progress',
            type: 'number',
            default: '—',
            description:
              'Holds one moment, from 0 (the empty stage) to 1 (the mark at rest), instead of playing. Clearing it plays on from there.',
          },
          {
            name: 'duration',
            type: 'number',
            default: '1700',
            description: 'Milliseconds from the empty stage to the mark at rest.',
          },
          {
            name: 'onComplete',
            type: '() => void',
            default: '—',
            description: 'Called once the mark has landed, or at once under reduced motion.',
          },
        ],
      },
    ],
    types: ['GlassLogoRevealProps', 'GlassLogoRevealPlay'],
    requires:
      'WebGL2 and a mark from your origin or served with CORS. Without WebGL2 the mark shows at once.',
    accessibility:
      'The figure is named by label. Reduced motion and reduced transparency show the mark at once.',
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
    description: 'A CSS 3D laptop mockup whose screen shows your screenshot or React content.',
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
        description: 'A figure that draws the laptop. Its children fill the screen.',
        extends: 'HTML figure attributes',
        props: [
          {
            name: 'children',
            type: 'ReactNode',
            default: '—',
            description:
              'Screen content, laid out at resolution CSS pixels wide and scaled to fit. It mounts only while the lid is open and still.',
          },
          {
            name: 'open',
            type: 'boolean',
            default: 'true',
            description: 'Whether the lid is up. Changing it opens or closes the lid.',
          },
          {
            name: 'finish',
            type: "'black' | 'silver'",
            default: "'black'",
            description: 'Case colour.',
          },
          {
            name: 'resolution',
            type: 'number',
            default: '1728',
            description:
              'Width in CSS pixels the content is laid out at before it is scaled to the screen.',
          },
          {
            name: 'glare',
            type: 'boolean',
            default: 'true',
            description: 'A faint reflection across the screen. Turn it off for flat screenshots.',
          },
        ],
      },
    ],
    types: ['GlassLaptopProps', 'GlassLaptopFinish'],
    accessibility:
      'Give the figure an aria-label that says what the screen shows, and mark display-only screen content inert.',
    pageToc: standardToc,
  },
  {
    id: 'glass-phone-duo',
    name: 'Glass Phone Duo',
    category: 'Mockups',
    isNew: true,
    status: 'ready',
    route: '/components/glass-phone-duo',
    description: 'A WebGL2 folding phone mockup with your screenshots on both displays.',
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
      {
        name: 'GlassPhoneDuo',
        description: 'A figure with role img that draws the phone on a canvas.',
        extends: 'HTML figure attributes (no children)',
        props: [
          {
            name: 'screenSrc',
            type: 'string',
            default: '—',
            description:
              'Landscape screenshot for the inner display, at a 2670:1878 ratio. Same origin or served with CORS.',
            required: true,
          },
          {
            name: 'coverSrc',
            type: 'string',
            default: '—',
            description:
              'Portrait screenshot for the outer display, at a 1398:2034 ratio. Same origin or served with CORS.',
            required: true,
          },
          {
            name: 'screenAlt',
            type: 'string',
            default: "'App on the unfolded phone display'",
            description: 'Accessible label while the front of the open phone shows.',
          },
          {
            name: 'coverAlt',
            type: 'string',
            default: "'App on the outer phone display'",
            description:
              'Accessible label while the closed phone shows, or the back of the open phone.',
          },
          {
            name: 'open',
            type: 'boolean',
            default: 'true',
            description: 'Opens or closes the hinge. Ignored when angle is set.',
          },
          {
            name: 'angle',
            type: 'number',
            default: '—',
            description:
              'Hinge angle from 0 (closed) to 180 (flat), clamped. Overrides open; while it is set, view and pose changes apply at once.',
          },
          {
            name: 'finish',
            type: "'night-sky' | 'star-white'",
            default: "'night-sky'",
            description: 'Frame colour.',
          },
          {
            name: 'view',
            type: "'front' | 'back'",
            default: "'front'",
            description: 'Which side faces you. back shows the rear cameras.',
          },
          {
            name: 'pose',
            type: "'upright' | 'book' | 'tent' | 'laptop' | 'side'",
            default: "'upright'",
            description:
              'Device orientation; angle still sets the hinge. tent and laptop show screenSrc on the outer display and coverSrc across the inner one.',
          },
          {
            name: 'glare',
            type: 'boolean',
            default: 'true',
            description: 'A faint reflection across the displays.',
          },
        ],
      },
    ],
    types: ['GlassPhoneDuoProps', 'GlassPhoneDuoFinish', 'GlassPhoneDuoPose'],
    requires: 'WebGL2 and screenshots from your origin or served with CORS.',
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
    install: installCommand([item.name], 'react'),
    installedDependencies: unique(closure.flatMap((closureItem) => closureItem.dependencies ?? [])),
    installedFiles: unique(
      closure.flatMap((closureItem) => closureItem.files.map((file) => file.target)),
    ),
    localFiles: item.files.map((file) => file.path),
    registryDependencies: [...(item.registryDependencies ?? [])],
    registryItem: item.name,
  };
});

export const initializeShadcn = 'npx shadcn@4.14.1 init';

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
