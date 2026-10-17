// Builds the `glassy-theme` registry item from registry/glassyui/themes/glassy-theme.css.
//
//   node scripts/build-shadcn-theme.mjs          rewrite glassy-lens.svg and the item
//   node scripts/build-shadcn-theme.mjs --check  fail if either is stale
//
// The source's `:root` and `.dark` tokens become cssVars.light and cssVars.dark,
// `@theme inline` becomes cssVars.theme, and the one
// `@layer components { @layer glassy { … } }` block becomes the item's css. Each
// url('./glassy-lens.svg#<id>') in the source becomes a data: URL holding that one
// filter, so the item stays CSS only; glassy-lens.svg itself is written from
// Glassy UI's own lens profile in scripts/shadcn-theme-lens.mjs. CSS is parsed
// with the postcss that the pinned shadcn CLI uses, so the same parser reads the
// source and writes it into an app.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lensSvg } from './shadcn-theme-lens.mjs';

const require = createRequire(import.meta.url);

const postcss = createRequire(require.resolve('shadcn'))('postcss');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const THEME_ITEM_NAME = 'glassy-theme';

export const THEME_SOURCE = path.join(root, 'registry', 'glassyui', 'themes', 'glassy-theme.css');

const LENS_SOURCE = path.join(path.dirname(THEME_SOURCE), 'glassy-lens.svg');

const registryPath = path.join(root, 'registry.json');

// The drop-in components: Glassy UI's engine in shadcn/ui's own files. Each set is one
// self-contained item, Glassy UI's component look plus the engine plus every drop-in of one
// shadcn style, so a stock app installs it by URL with no registries mapping.
const DROPIN_SOURCE = path.join(root, 'registry', 'glassyui-shadcn');

const SET_CSS = path.join(DROPIN_SOURCE, 'glassy-ui.css');

// Stock shadcn/ui file names each set replaces.
export const DROPIN_COMPONENTS = [
  'alert',
  'badge',
  'button',
  'card',
  'checkbox',
  'dialog',
  'dropdown-menu',
  'input',
  'popover',
  'radio-group',
  'select',
  'sheet',
  'slider',
  'switch',
  'tabs',
  'textarea',
];

export const DROPIN_SETS = [
  { name: 'glassy-ui-new-york', style: 'new-york', primitives: 'Radix (radix-ui)' },
  { name: 'glassy-ui-base-nova', style: 'base-nova', primitives: 'Base UI (@base-ui/react)' },
];

const ENGINE_FILES = [
  {
    path: 'registry/glassyui/glassy-engine.tsx',
    type: 'registry:ui',
    target: 'components/glassyui/glassy-engine.tsx',
  },
  {
    path: 'registry/glassyui/lib/refraction-map.ts',
    type: 'registry:lib',
    target: 'components/glassyui/lib/refraction-map.ts',
  },
  {
    path: 'registry/glassyui/lib/slab-optics.ts',
    type: 'registry:lib',
    target: 'components/glassyui/lib/slab-optics.ts',
  },
  {
    path: 'registry/glassyui/lib/scene-context.ts',
    type: 'registry:lib',
    target: 'components/glassyui/lib/scene-context.ts',
  },
];

// The CLI adds a `--color-<name>` alias for any cssVar whose value looks like a
// colour; the theme's tokens must never trigger it.
const colourLookingValue = /^(rgb|#|oklch)/;

// Formatting whitespace only: runs collapse to one space, none inside the edges of
// parentheses, so a value or selector serialises the same however it was wrapped.
const collapse = (text) =>
  text.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();

function fail(node, message) {
  const line = node?.source?.start?.line;
  throw new Error(`glassy-theme.css${line ? `:${line}` : ''}: ${message}`);
}

function declarationValue(declaration) {
  return `${collapse(declaration.value)}${declaration.important ? ' !important' : ''}`;
}

// One container (a layer, @media, @supports or @keyframes block) as the nested
// object the shadcn registry's `css` field holds: selectors and at-rules as
// keys, declarations as string values, in source order.
function containerToObject(container) {
  const result = {};

  for (const node of container.nodes ?? []) {
    if (node.type === 'comment') continue;

    if (node.type === 'decl') fail(node, 'declarations must sit inside a rule');

    const key =
      node.type === 'rule'
        ? node.selectors.map(collapse).join(', ')
        : `@${node.name} ${collapse(node.params)}`;

    if (Object.hasOwn(result, key)) fail(node, `duplicate key ${key} in one block`);

    if (node.type === 'rule') {
      const declarations = {};

      for (const child of node.nodes ?? []) {
        if (child.type === 'comment') continue;

        if (child.type !== 'decl') fail(child, `${key} may hold declarations only`);

        if (Object.hasOwn(declarations, child.prop)) {
          fail(child, `${key} declares ${child.prop} twice`);
        }

        declarations[child.prop] = declarationValue(child);
      }

      result[key] = declarations;
    } else if (node.type === 'atrule') {
      if (node.name === 'property') fail(node, 'the CLI duplicates @property on every install');

      result[key] = containerToObject(node);
    } else {
      fail(node, `unexpected ${node.type}`);
    }
  }

  return result;
}

// The lens filters as the item carries them: one filter per data: URL, with
// comments and formatting dropped and only the characters a data: URL inside a
// quoted CSS string cannot hold escaped.
function inlineLensFilters(cssText) {
  const svg = fs.readFileSync(LENS_SOURCE, 'utf8');

  return cssText.replace(
    /url\((['"])\.\/glassy-lens\.svg#([\w-]+)\1\)/g,
    (reference, quote, id) => {
      const filter = svg.match(new RegExp(`<filter id="${id}"[^>]*>[\\s\\S]*?</filter>`));

      if (!filter) throw new Error(`glassy-lens.svg has no filter with the id ${id}`);

      let data = `<svg xmlns="http://www.w3.org/2000/svg">${filter[0]}</svg>`;
      let previous;

      // Dropping one comment can join the text around it into another, so repeat until none is left.
      do {
        previous = data;
        data = data.replace(/<!--[\s\S]*?-->/g, '');
      } while (data !== previous);

      if (data.includes('<!--'))
        throw new Error(`glassy-lens.svg has an unclosed comment in ${id}`);

      data = data
        .replace(/>\s+</g, '><')
        .replace(/\s+/g, ' ')
        .replaceAll('"', "'")
        .replaceAll('%', '%25')
        .replaceAll('#', '%23')
        .replaceAll('<', '%3C')
        .replaceAll('>', '%3E');

      return `url("data:image/svg+xml,${data}#${id}")`;
    },
  );
}

function tokenBlock(rule, prefix) {
  const tokens = {};

  for (const child of rule.nodes ?? []) {
    if (child.type === 'comment') continue;

    if (child.type !== 'decl' || !child.prop.startsWith(prefix)) {
      fail(child, `${rule.selector} may only declare ${prefix}* tokens`);
    }

    const value = declarationValue(child);

    if (colourLookingValue.test(value)) {
      fail(child, `${child.prop} looks like a colour; the CLI would add a colour alias`);
    }

    tokens[child.prop.slice(2)] = value;
  }

  return tokens;
}

export function buildThemeItem(cssText) {
  const ast = postcss.parse(inlineLensFilters(cssText));
  const cssVars = { theme: {}, light: {}, dark: {} };
  let layer;

  for (const node of ast.nodes) {
    if (node.type === 'comment') continue;

    if (node.type === 'rule' && node.selector === ':root') {
      cssVars.light = tokenBlock(node, '--glassy-');
    } else if (node.type === 'rule' && node.selector === '.dark') {
      cssVars.dark = tokenBlock(node, '--glassy-');
    } else if (node.type === 'atrule' && node.name === 'theme' && node.params === 'inline') {
      cssVars.theme = tokenBlock(node, '--ease-glassy-');
    } else if (node.type === 'atrule' && node.name === 'layer' && node.params === 'components') {
      const children = node.nodes.filter((child) => child.type !== 'comment');

      if (
        layer ||
        children.length !== 1 ||
        children[0].type !== 'atrule' ||
        children[0].name !== 'layer' ||
        children[0].params !== 'glassy'
      ) {
        fail(node, 'expected exactly one @layer components { @layer glassy { … } } block');
      }

      layer = containerToObject(children[0]);
    } else {
      fail(node, 'only :root, .dark, @theme inline and the glassy layer may sit at the top');
    }
  }

  if (!layer) fail(null, 'missing the @layer components { @layer glassy { … } } block');

  for (const scope of ['theme', 'light', 'dark']) {
    if (Object.keys(cssVars[scope]).length === 0) fail(null, `cssVars.${scope} is empty`);
  }

  return {
    name: THEME_ITEM_NAME,
    type: 'registry:theme',
    title: 'Glassy UI theme for shadcn/ui',
    description:
      'Gives stock shadcn/ui components the Glassy UI look, tinted from your own palette, with one command.',
    docs: 'Glassy UI theme installed. To remove or upgrade it, delete the @layer glassy block and every --glassy-* and --ease-glassy-* line from your CSS. Guide: https://glassyui.com/guides/shadcn-theme',
    cssVars,
    css: { '@layer components': { '@layer glassy': layer } },
  };
}

// The two drop-in sets: Glassy UI's component look from glassy-ui.css, its tokens and the
// theme's easing curves, the engine files, and the set's drop-ins over shadcn's own files.
// The theme's own rules stay out: the sets draw every part they cover themselves.
function buildDropinItems(themeCssText, setCssText) {
  const theme = buildThemeItem(themeCssText);
  const nodes = postcss.parse(setCssText).nodes.filter((node) => node.type !== 'comment');
  const tokens = { light: {}, dark: {} };

  // The sets' tokens, in :root and .dark; never a theme token's name, so an app that still
  // has the theme cannot mix their values.
  for (const node of nodes) {
    const scope =
      node.type === 'rule' && node.selector === ':root'
        ? 'light'
        : node.type === 'rule' && node.selector === '.dark'
          ? 'dark'
          : null;

    if (!scope) continue;
    tokens[scope] = tokenBlock(node, '--glassy-');

    for (const name of Object.keys(tokens[scope])) {
      if (name in theme.cssVars[scope]) fail(node, `--${name} is already a theme token`);
    }
  }

  const engineBlocks = nodes.filter(
    (node) => !(node.type === 'rule' && [':root', '.dark'].includes(node.selector)),
  );

  const inner = engineBlocks[0]?.nodes?.filter((child) => child.type !== 'comment') ?? [];

  if (
    engineBlocks.length !== 1 ||
    engineBlocks[0].type !== 'atrule' ||
    engineBlocks[0].name !== 'layer' ||
    engineBlocks[0].params !== 'components' ||
    inner.length !== 1 ||
    inner[0].type !== 'atrule' ||
    inner[0].name !== 'layer' ||
    inner[0].params !== 'glassy'
  ) {
    throw new Error(
      'glassy-ui.css: expected :root and .dark tokens and one @layer components { @layer glassy { … } } block',
    );
  }

  const layer = containerToObject(inner[0]);

  return DROPIN_SETS.map((set) => {
    const item = {
      name: set.name,
      type: 'registry:ui',
      title: `Glassy UI components for shadcn/ui (${set.style})`,
      description: `Replaces shadcn/ui's ${set.style} components (${set.primitives}) with Glassy UI versions that keep their API, so your imports stay as they are.`,
      docs: `Glassy UI components installed over components/ui: Glassy UI's look and lens with shadcn/ui's API. Remove the Glassy UI theme first if you installed it. Install with --overwrite after committing your work: it replaces local edits in those files. Guide: https://glassyui.com/guides/shadcn-theme`,
      cssVars: { theme: theme.cssVars.theme, light: tokens.light, dark: tokens.dark },
      css: { '@layer components': { '@layer glassy': layer } },
      files: [
        ...ENGINE_FILES,
        // Each set's Button root renders its style's primitive: Radix's Slot or Base UI's button.
        {
          path: `registry/glassyui-shadcn/${set.style}/glassy-button-root.tsx`,
          type: 'registry:ui',
          target: 'components/glassyui/glassy-button-root.tsx',
        },
        ...DROPIN_COMPONENTS.map((component) => ({
          path: `registry/glassyui-shadcn/${set.style}/${component}.tsx`,
          type: 'registry:ui',
          target: `components/ui/${component}.tsx`,
        })),
      ],
    };

    if (set.style === 'new-york') item.dependencies = ['radix-ui'];

    return item;
  });
}

// The theme's contribution to an app's globals.css after the CLI installed it:
// its tokens, the theme variables (with any CLI colour aliases) and the glassy
// sublayer, in order. Comparing this with `expectedContribution` proves the CLI
// wrote exactly the item.
export function themeContribution(globalsCss) {
  const ast = postcss.parse(globalsCss);
  const contribution = { light: [], dark: [], theme: [], layer: null };

  ast.walkRules((rule) => {
    const selector = collapse(rule.selector);
    const scope = selector === ':root' ? 'light' : selector === '.dark' ? 'dark' : null;

    if (!scope) return;

    for (const child of rule.nodes ?? []) {
      if (child.type === 'decl' && child.prop.startsWith('--glassy-')) {
        contribution[scope].push([child.prop, declarationValue(child)]);
      }
    }
  });

  ast.walkAtRules('theme', (atRule) => {
    for (const child of atRule.nodes ?? []) {
      if (
        child.type === 'decl' &&
        (child.prop.startsWith('--ease-glassy-') || child.prop.startsWith('--color-glassy-'))
      ) {
        contribution.theme.push([child.prop, declarationValue(child)]);
      }
    }
  });

  ast.walkAtRules('layer', (atRule) => {
    if (atRule.params === 'glassy' && atRule.parent?.params === 'components') {
      if (contribution.layer) throw new Error('globals.css holds two @layer glassy blocks');
      contribution.layer = containerToObject(atRule);
    }
  });

  return contribution;
}

export function expectedContribution(item) {
  const entries = (tokens) => Object.entries(tokens).map(([name, value]) => [`--${name}`, value]);

  return {
    light: entries(item.cssVars.light),
    dark: entries(item.cssVars.dark),
    theme: entries(item.cssVars.theme),
    layer: item.css['@layer components']['@layer glassy'],
  };
}

function readRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function main() {
  const check = process.argv.includes('--check');
  const lens = lensSvg();

  if (check && fs.readFileSync(LENS_SOURCE, 'utf8') !== lens) {
    console.error(
      `${path.relative(root, LENS_SOURCE)} is stale. Run node scripts/build-shadcn-theme.mjs.`,
    );
    process.exit(1);
  }

  if (!check) fs.writeFileSync(LENS_SOURCE, lens);

  const themeCss = fs.readFileSync(THEME_SOURCE, 'utf8');

  const items = [
    buildThemeItem(themeCss),
    ...buildDropinItems(themeCss, fs.readFileSync(SET_CSS, 'utf8')),
  ];

  const registry = readRegistry();

  if (check) {
    for (const item of items) {
      const current = registry.items.find((candidate) => candidate.name === item.name) ?? null;

      if (JSON.stringify(current) !== JSON.stringify(item)) {
        console.error(
          `registry.json's ${item.name} item is stale. Run node scripts/build-shadcn-theme.mjs.`,
        );
        process.exit(1);
      }
    }

    console.log(
      `${items.map((item) => item.name).join(', ')} match ${path.relative(root, THEME_SOURCE)}.`,
    );

    return;
  }

  for (const item of items) {
    const index = registry.items.findIndex((candidate) => candidate.name === item.name);

    if (index === -1) registry.items.push(item);
    else registry.items[index] = item;
  }

  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);

  // registry.json is formatted by the repository's oxfmt.
  const formatted = spawnSync(
    path.join(root, 'node_modules', '.bin', 'oxfmt'),
    [path.relative(root, registryPath)],
    { cwd: root, encoding: 'utf8', stdio: 'pipe' },
  );

  if (formatted.status !== 0) {
    throw new Error(`oxfmt failed on registry.json\n${formatted.stdout}\n${formatted.stderr}`);
  }

  console.log(`Wrote ${items.map((item) => item.name).join(', ')} to registry.json.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
