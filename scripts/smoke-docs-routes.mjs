import fs from 'node:fs';

const baseUrl = process.env.GLASSYUI_BASE_URL ?? 'http://localhost:3000';

const nativeRegistry = JSON.parse(fs.readFileSync('registry-native.json', 'utf8'));

const nativeOnlyItems = ['glass-picker', 'glass-swipe-row', 'glass-card-stack'];

const checks = [
  {
    path: '/',
    markers: ['Glassy UI', '/components'],
  },
  {
    path: '/components',
    markers: ['Components', 'glass-button', 'Release feedback'],
  },
  {
    path: '/docs',
    markers: ['Getting Started', '@glassyui', 'components.json'],
  },
  {
    path: '/components/glass-button',
    markers: ['Glass Button', 'Installation', 'Usage', 'API'],
  },
  {
    path: '/components/glass-input',
    markers: ['Glass Input', 'Usage'],
  },
  ...[
    ['glass-switch', 'Glass Switch'],
    ['glass-slider', 'Glass Slider'],
    ['glass-segmented-control', 'Glass Segmented Control'],
    ['glass-badge', 'Glass Badge'],
    ['glass-dock', 'Glass Dock'],
    ['glass-header', 'Glass Header'],
    ['glass-sheet', 'Glass Sheet'],
    ['glass-menu', 'Glass Menu'],
    ['glass-lens', 'Glass Lens'],
    ['glass-checkbox', 'Glass Checkbox'],
    ['glass-radio-group', 'Glass Radio Group'],
    ['glass-textarea', 'Glass Textarea'],
    ['glass-select', 'Glass Select'],
    ['glass-progress', 'Glass Progress'],
    ['glass-spinner', 'Glass Spinner'],
    ['glass-skeleton', 'Glass Skeleton'],
    ['glass-alert', 'Glass Alert'],
    ['glass-avatar', 'Glass Avatar'],
    ['glass-kbd', 'Glass Kbd'],
    ['glass-scroll-area', 'Glass Scroll Area'],
    ['glass-command', 'Glass Command'],
    ['glass-breadcrumb', 'Glass Breadcrumb'],
    ['glass-pagination', 'Glass Pagination'],
    ['glass-scene', 'Glass Scene'],
    ['glass-laptop', 'Glass Laptop'],
    ['glass-phone-duo', 'Glass Phone Duo'],
  ].map(([id, name]) => ({
    path: `/components/${id}`,
    markers: [name, 'Installation', 'Usage', 'API', `/r/${id}.json`],
  })),
  {
    path: '/mobile',
    markers: ['Glassy UI, in your app.', '/r/native/glass-button.json', '/guides/expo'],
  },
  {
    path: '/guides/expo',
    markers: ['@glassyui-native', 'npx expo install --fix', 'GlassBackdrop'],
  },
  {
    path: '/guides/shadcn-theme',
    markers: [
      'Make a shadcn/ui app glassy with one command',
      '/r/glassy-theme.json',
      '/r/glassy-ui-new-york.json',
      'glassy-ui-base-nova.json',
      '--overwrite',
    ],
  },
  // Shared items put native usage behind the switch; Expo-only pages label their own example.
  ...nativeRegistry.items.map((item) => ({
    path: `/components/${item.name}`,
    markers: [
      nativeOnlyItems.includes(item.name) ? `${item.title} usage` : 'React Native usage',
      `/r/native/${item.name}.json`,
    ],
  })),
];

for (const check of checks) {
  const url = new URL(check.path, baseUrl);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  const html = await response.text();

  for (const marker of check.markers) {
    if (!html.includes(marker)) {
      throw new Error(`${url} missed marker ${marker}`);
    }
  }
}

console.log('Docs route smoke passed.');
