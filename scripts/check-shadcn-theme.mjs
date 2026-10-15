// Proves the `glassy-theme` registry item on two stock shadcn/ui apps, and on
// the new-york app in four of shadcn's colour themes.
//
//   node scripts/check-shadcn-theme.mjs [artifact-dir] [--baseline-only] [--install-only]
//     [--fixture new-york|base-nova|new-york-blue|…] [--guide-images <dir>]
//
// For each fixture in fixtures/shadcn-theme-consumer: copy it to a temporary
// directory, give it its colour theme from palettes.json when it has one,
// install its locked dependencies, build it and capture the stock baseline; install the theme from this repository's public/r with the shadcn
// CLI the docs pin, and again with the fixture's own newer CLI when it has one;
// prove each wrote exactly the item, the same bytes, and nothing else; rebuild;
// then check geometry, rendered contrast, motion, fades, the lens, accessibility
// preferences and the className contract in Chrome, and that WebKit and Firefox,
// which draw no lens, get none of it. Needs Playwright's WebKit and Firefox
// (`pnpm exec playwright install webkit firefox`). Writes report.json,
// screenshots and a Playwright trace per fixture (default .artifacts/shadcn-theme)
// and exits 1 if any assertion fails. --install-only retains CLI byte, dependency,
// API and production-build checks, without browser setup or rendered assertions.
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium, firefox, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {
  DROPIN_COMPONENTS,
  DROPIN_SETS,
  expectedContribution,
  themeContribution,
  THEME_ITEM_NAME,
} from './build-shadcn-theme.mjs';

const require = createRequire(import.meta.url);

const root = process.cwd();

const argv = process.argv.slice(2);

const flag = (name) => argv.includes(name);

const option = (name) => {
  const index = argv.indexOf(name);

  return index === -1 ? null : argv[index + 1];
};

const positional = argv.filter(
  (value, index) =>
    !value.startsWith('--') && !['--fixture', '--guide-images'].includes(argv[index - 1]),
);

// --dropins installs the drop-in component sets instead of the theme alone.
const dropins = flag('--dropins');

const artifactDirectory = path.resolve(
  positional[0] ?? (dropins ? '.artifacts/shadcn-dropins' : '.artifacts/shadcn-theme'),
);

const baselineOnly = flag('--baseline-only');

const installOnly = flag('--install-only');

const guideImages = option('--guide-images') ? path.resolve(option('--guide-images')) : null;

const onlyFixture = option('--fixture');

if (installOnly && (baselineOnly || guideImages))
  throw new Error('--install-only cannot be combined with --baseline-only or --guide-images');

// shadcn's own colour themes, applied to the new-york app: blue puts a dark label
// on its dark-mode buttons and yellow on its light ones; violet and orange keep
// light labels in both modes.
const PALETTES = JSON.parse(
  fs.readFileSync(path.join(root, 'fixtures', 'shadcn-theme-consumer', 'palettes.json'), 'utf8'),
).palettes;

const FIXTURES = [
  { name: 'new-york', app: 'new-york' },
  { name: 'base-nova', app: 'base-nova' },
  ...Object.keys(PALETTES).map((palette) => ({
    name: `new-york-${palette}`,
    app: 'new-york',
    palette,
  })),
].filter((fixture) => !onlyFixture || fixture.name === onlyFixture);

if (FIXTURES.length === 0) throw new Error(`unknown fixture ${onlyFixture}`);

const SCENARIOS = [
  { id: 'plain-light', backdrop: 'plain', scheme: 'light', gate: true },
  { id: 'plain-dark', backdrop: 'plain', scheme: 'dark', gate: true },
  { id: 'wallpaper-light', backdrop: 'wallpaper', scheme: 'light', gate: false },
  { id: 'wallpaper-dark', backdrop: 'wallpaper', scheme: 'dark', gate: false },
];

const OVERLAYS = ['dropdown', 'select', 'popover', 'tooltip', 'dialog', 'sheet', 'command'];

// Slots the theme styles, with the role whose computed signature they must show.
// Buttons are found by the kitchen sink's own marks: base-nova buttons carry no
// data-variant attribute.
const ROLE_SAMPLES = [
  { selector: '[data-slot="card"][data-check="card"]', role: 'pane' },
  { selector: '[data-slot="alert"]', role: 'pane' },
  { selector: '[data-check="button-default"]', role: 'slab' },
  { selector: '[data-check="button-outline"]', role: 'slab' },
  { selector: '[data-check="button-secondary"]', role: 'slab' },
  { selector: '[data-check="button-destructive"]', role: 'slab' },
  { selector: '[data-check="trigger-menu"]', role: 'slab' },
  { selector: '[data-slot="input"][data-check="input"]', role: 'field' },
  { selector: '[data-slot="textarea"]', role: 'field' },
  { selector: '[data-slot="select-trigger"]', role: 'field' },
  { selector: '[data-slot="switch-thumb"]', role: 'knob' },
  { selector: '[data-slot="slider-thumb"]', role: 'thumb' },
  { selector: '[data-slot="tabs-list"][data-check="tabs-list"]', role: 'pill' },
  { selector: '[data-slot="badge"]', role: 'chip' },
];

// Decoration layers that must sit exactly on their host.
const BOUND_SAMPLES = [
  '[data-slot="card"][data-check="card"]',
  '[data-slot="alert"]',
  '[data-check="button-default"]',
  '[data-check="button-outline"]',
  '[data-check="button-secondary"]',
  '[data-check="button-destructive"]',
  '[data-check="trigger-menu"]',
  '[data-slot="badge"]',
];

// Labels whose rendered contrast is measured, on the stock page and the themed
// one. Disabled controls are left out: WCAG exempts them.
const LABEL_SELECTORS = [
  '[data-slot="button"]:not(:disabled)',
  '[data-slot="badge"]',
  '[data-slot="tabs-trigger"]',
  '[data-slot="kbd"]',
  '[data-slot="avatar-fallback"]',
  '[data-slot="card-title"]',
  '[data-slot="alert-title"]',
];

const MENU_LABEL_SELECTORS = [
  '[data-slot="dropdown-menu-label"]',
  '[data-slot="dropdown-menu-item"]',
  '[data-slot="dropdown-menu-checkbox-item"]',
  '[data-slot="dropdown-menu-shortcut"]',
];

const report = {
  status: 'pass',
  mode: installOnly ? 'install-only' : 'full',
  startedAt: new Date().toISOString(),
  fixtures: {},
};

let current;

function check(name, pass, observed) {
  current.assertions.push({ name, pass: Boolean(pass), observed });

  if (!pass) {
    current.failures += 1;
    console.error(`  ✗ ${name}: ${JSON.stringify(observed)}`);
  }
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: 'pipe' });

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.status})\n${result.stdout}\n${result.stderr}`,
    );
  }

  return `${result.stdout}\n${result.stderr}`.trim();
}

function runAsync(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';

    const capture = (chunk) => {
      output += chunk;
    };

    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve(output.trim());
      else reject(new Error(`${command} ${args.join(' ')} failed (${code})\n${output}`));
    });
  });
}

async function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

// Next starts a server process of its own, so the whole process group stops.
async function startApp(cwd) {
  const port = await getAvailablePort();
  const url = `http://127.0.0.1:${port}`;
  let output = '';

  const child = spawn('pnpm', ['exec', 'next', 'start', '-H', '127.0.0.1', '-p', String(port)], {
    cwd,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const capture = (chunk) => {
    output = `${output}${chunk}`.slice(-20_000);
  };

  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  const deadline = Date.now() + 30_000;

  try {
    while (Date.now() < deadline) {
      if (child.exitCode !== null)
        throw new Error(`app exited early (${child.exitCode})\n${output}`);

      try {
        if ((await fetch(url, { signal: AbortSignal.timeout(2_000) })).ok) return { child, url };
      } catch {
        // The server has not bound its port or answered yet.
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error(`app did not become ready\n${output}`);
  } catch (error) {
    await stopApp({ child, url });
    throw error;
  }
}

async function stopApp(app) {
  if (!app) return;
  const child = app.child;

  if (child.exitCode !== null || child.signalCode !== null) return;

  const exited =
    child.exitCode !== null || child.signalCode !== null
      ? Promise.resolve()
      : new Promise((resolve) => child.once('exit', resolve));

  const signalGroup = (signal) => {
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  };

  signalGroup('SIGTERM');
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3_000))]);

  if (child.exitCode === null && child.signalCode === null) signalGroup('SIGKILL');

  await exited;
}

// Serves this repository's public/r, as glassyui.com does, for the CLI install.
async function startRegistryServer() {
  const directory = path.join(root, 'public', 'r');

  const server = http.createServer((request, response) => {
    const name = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname).replace(
      /^\/r\//,
      '',
    );

    const file = path.join(directory, name);

    // Local tools probe new ports too; only registry files are served.
    if (
      !file.startsWith(directory + path.sep) ||
      !fs.statSync(file, { throwIfNoEntry: false })?.isFile()
    ) {
      response.writeHead(404).end();

      return;
    }

    try {
      response.writeHead(200, { 'content-type': 'application/json' }).end(fs.readFileSync(file));
    } catch (error) {
      response.writeHead(500).end(String(error));
    }
  });

  const port = await getAvailablePort();
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

  return { server, url: `http://127.0.0.1:${port}` };
}

function shadcnBin(packageDirectory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'));
  // shadcn declares its one bin either as a string or as { shadcn: path }.
  const bin = manifest.bin.shadcn ?? manifest.bin;

  return { bin: path.resolve(packageDirectory, bin), version: manifest.version };
}

// Writes a colour theme's light and dark tokens over the stock ones in the app's
// globals.css, the way a person pastes a theme from ui.shadcn.com. Every token
// must already exist there, so a palette never adds what the app lacks.
function applyPalette(appDirectory, palette) {
  const file = path.join(appDirectory, 'app', 'globals.css');
  let css = fs.readFileSync(file, 'utf8');

  for (const [scope, tokens] of [
    [':root', palette.light],
    ['.dark', palette.dark],
  ]) {
    const start = css.indexOf(`${scope} {`);
    const end = css.indexOf('}', start);
    let block = css.slice(start, end);

    for (const [token, value] of Object.entries(tokens)) {
      const pattern = new RegExp(`(${token}:\\s*)[^;]+;`);

      if (!pattern.test(block)) throw new Error(`${scope} in ${file} has no ${token}`);
      block = block.replace(pattern, `$1${value};`);
    }

    css = css.slice(0, start) + block + css.slice(end);
  }

  fs.writeFileSync(file, css);
}

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// Every file of an app outside node_modules and .next, with a hash of its bytes.
function snapshotFiles(directory) {
  const files = {};

  const walk = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;

      const full = path.join(folder, entry.name);

      if (entry.isDirectory()) walk(full);
      else files[path.relative(directory, full)] = sha256(full);
    }
  };

  walk(directory);

  return files;
}

const changedFiles = (before, after) =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((file) => before[file] !== after[file])
    .sort();

// ---------- drop-in components ----------

// The set a fixture app takes: base-nova's app is on Base UI, the others on Radix.
const dropinSetFor = (fixture) =>
  DROPIN_SETS.find((set) => set.style === (fixture.app === 'base-nova' ? 'base-nova' : 'new-york'));

// The names a stock file exports, from its closing export list.
function stockExports(source) {
  const list = source.match(/export\s*\{([^}]*)\}/);

  return list
    ? list[1]
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
    : [];
}

const hasClientDirective = (source) => /^['"]use client['"]/.test(source.trimStart());

// Puts the pristine stock files into the app beside a module that compiles only when the
// drop-ins keep their API: every stock export exists in the drop-in, every stock
// component's props fit the drop-in's, and every stock *Variants call fits the drop-in's.
// Adds a Server Component route, with no directive, that uses the drop-ins as server code
// does. next build type-checks both.
function writeParityGate(appDirectory, stockSources, set) {
  const parityDirectory = path.join(appDirectory, 'glassy-parity');
  fs.mkdirSync(path.join(parityDirectory, 'stock'), { recursive: true });
  const lines = ["import type * as React from 'react';"];

  for (const [component, source] of Object.entries(stockSources)) {
    fs.writeFileSync(path.join(parityDirectory, 'stock', `${component}.tsx`), source);
    const id = component.replaceAll(/-(\w)/g, (_, letter) => letter.toUpperCase());
    lines.push(
      `import * as Stock_${id} from './stock/${component}';`,
      `import * as Drop_${id} from '@/components/ui/${component}';`,
      `export const ${id}Exports: Record<keyof typeof Stock_${id}, unknown> = Drop_${id};`,
    );

    for (const name of stockExports(source)) {
      if (name.endsWith('Variants')) {
        lines.push(
          `export const ${id}_${name}: (...args: Parameters<typeof Stock_${id}.${name}>) => string = Drop_${id}.${name};`,
        );
      } else if (/^[A-Z]/.test(name)) {
        lines.push(
          `export const ${id}_${name}Props = (props: React.ComponentProps<typeof Stock_${id}.${name}>): React.ComponentProps<typeof Drop_${id}.${name}> => props;`,
        );
      }
    }
  }

  fs.writeFileSync(path.join(parityDirectory, 'parity.ts'), `${lines.join('\n')}\n`);

  // Base UI renders another element through render, Radix through asChild.
  const asLink =
    set.style === 'base-nova'
      ? `<Button data-check="server-as-child" variant="outline" nativeButton={false} render={<Link href="/" />}>Home</Button>`
      : `<Button data-check="server-as-child" variant="outline" asChild><Link href="/">Home</Link></Button>`;

  const route = path.join(appDirectory, 'app', 'glassy-server');
  fs.mkdirSync(route, { recursive: true });
  fs.writeFileSync(
    path.join(route, 'page.tsx'),
    `import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function GlassyServerPage() {
  return (
    <main className="flex flex-wrap gap-4 p-10" data-check="server">
      <a data-check="server-variants" className={buttonVariants({ variant: "outline" })} href="#top">Styled link</a>
      <Button data-check="server-button" variant="outline">Server button</Button>
      ${asLink}
      <Tabs defaultValue="one">
        <TabsList data-check="server-tabs">
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
      </Tabs>
      <Dialog>
        <DialogTrigger data-check="server-dialog-trigger">Open dialog</DialogTrigger>
        <DialogContent data-check="server-dialog">
          <DialogTitle>From a Server Component</DialogTitle>
        </DialogContent>
      </Dialog>
    </main>
  )
}
`,
  );
}

// Every data-slot on the kitchen-sink page with its data-variant and data-size, as a sorted
// list, the page's element count and its size, so the drop-ins can be held to the stock
// page's.
// Every stock element keeps its slot and any variant or size it had; a drop-in may add
// them, as base-nova's buttons gain the variant and size that new-york's carry.
function keepsStockAttributes(stock, dropins) {
  const remaining = [...dropins];

  return stock.every((entry) => {
    const [slot, variant, size] = entry.split('|');

    const index = remaining.findIndex((candidate) => {
      const [otherSlot, otherVariant, otherSize] = candidate.split('|');

      return (
        otherSlot === slot &&
        (!variant || otherVariant === variant) &&
        (!size || otherSize === size)
      );
    });

    if (index === -1) return false;
    remaining.splice(index, 1);

    return true;
  });
}

async function collectDataAttributes(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await load(page, await scenarioUrl(base, SCENARIOS[0]));

  const attributes = await page.evaluate(() => ({
    slots: [...document.querySelectorAll('[data-slot]')]
      .map(
        (node) => `${node.dataset.slot}|${node.dataset.variant ?? ''}|${node.dataset.size ?? ''}`,
      )
      .sort(),
    // The engine's lens filters live in document.body, outside the components.
    elements: [...document.body.querySelectorAll('*')].filter(
      (node) => !node.closest('svg.lg-refraction-filter'),
    ).length,
    size: `${document.documentElement.scrollWidth}x${document.documentElement.scrollHeight}`,
  }));

  await context.close();

  return attributes;
}

// The content element each overlay of the kitchen sink opens; the command palette is a
// dialog.
const FLOAT_SLOTS = {
  dropdown: 'dropdown-menu-content',
  select: 'select-content',
  popover: 'popover-content',
  dialog: 'dialog-content',
  sheet: 'sheet-content',
  command: 'dialog-content',
};

// What the engine drew for one element: its kind, its glass, the size of the lens map it
// measured against the element's border box, and the brightness slopes of its filter.
function readGlass(page, selector) {
  return page.evaluate((target) => {
    const node = document.querySelector(target);

    if (!node) return null;
    const id = /#([^)"]+)/.exec(node.style.getPropertyValue('--glassy-measured-lens'))?.[1];
    const filter = id ? document.getElementById(id) : null;
    const map = filter?.querySelector('feImage');

    return {
      engine: node.dataset.glassyEngine ?? null,
      backdrop: getComputedStyle(node).backdropFilter,
      opacity: Number(getComputedStyle(node).opacity),
      box: [node.offsetWidth, node.offsetHeight],
      map: map ? [Number(map.getAttribute('width')), Number(map.getAttribute('height'))] : null,
      slopes: filter
        ? [...filter.querySelectorAll('feFuncR')]
            .map((slope) => Number(slope.getAttribute('slope')))
            .sort((a, b) => a - b)
        : [],
    };
  }, selector);
}

const mapFitsBox = (glass) =>
  glass.map !== null &&
  Math.abs(glass.map[0] - glass.box[0]) < 0.5 &&
  Math.abs(glass.map[1] - glass.box[1]) < 0.5;

// The engine in Chrome: a card and a clear button run Glassy UI's lens, measured for their
// own size, and a tinted button keeps the theme's frost; a Server Component can call buttonVariants and
// render drop-ins, asChild or render included; nothing logs an error.
async function dropinAssertions(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await load(page, await scenarioUrl(base, SCENARIOS[0]));
  await page.waitForTimeout(300);

  const engine = await page.evaluate(() => {
    const read = (selector) => {
      const node = document.querySelector(selector);

      return {
        engine: node.dataset.glassyEngine ?? null,
        lens: node.style.getPropertyValue('--glassy-measured-lens'),
        backdrop: getComputedStyle(node, '::before').backdropFilter,
      };
    };

    return {
      clear: read('[data-check="button-outline"]'),
      tinted: read('[data-check="button-default"]'),
      pane: read('[data-check="card"]'),
    };
  });

  check(
    "a card runs Glassy UI's lens, measured for its own size and corners",
    engine.pane.engine === 'pane' &&
      engine.pane.lens.startsWith('url(#') &&
      engine.pane.backdrop.includes('#lg-lens-'),
    engine.pane,
  );

  check(
    "a clear button runs Glassy UI's lens, measured for its own size",
    engine.clear.engine === 'slab' &&
      engine.clear.lens.startsWith('url(#') &&
      engine.clear.backdrop.includes('#lg-lens-'),
    engine.clear,
  );
  check(
    'a filled button keeps its CSS frost',
    engine.tinted.engine === null && !engine.tinted.backdrop.includes('url('),
    engine.tinted,
  );

  // shadcn/ui apps switch to dark with a class on <html>: the engine measures again, so a
  // card's lens takes the dark tokens without a resize.
  const cardSaturation = () =>
    page.evaluate(() => {
      const card = document.querySelector('[data-check="card"]');
      const id = /#([^)"]+)/.exec(card.style.getPropertyValue('--glassy-measured-lens'))?.[1];

      const matrix = id
        ? document.getElementById(id)?.querySelector('feColorMatrix[type="saturate"]')
        : null;

      return {
        lens: matrix ? Number(matrix.getAttribute('values')) : null,
        expected: Number.parseFloat(
          getComputedStyle(card).getPropertyValue('--lg-lens-saturation'),
        ),
      };
    });

  const darkOnly = await page.addStyleTag({
    content: ".dark [data-check='card'] { --lg-lens-saturation: 1.9 !important; }",
  });

  const light = await cardSaturation();
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(300);
  const dark = await cardSaturation();
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await darkOnly.evaluate((node) => node.remove());
  check(
    "a card's measured lens follows the page into dark mode",
    light.lens === light.expected &&
      dark.lens === dark.expected &&
      light.expected !== dark.expected,
    { light, dark },
  );

  // Floats and the tabs list draw their glass on the element itself, so their lens map must
  // cover the whole box, border included.
  const track = await readGlass(page, '[data-check="tabs-list"]');
  check(
    "the tabs list runs Glassy UI's lens over its whole box",
    track?.engine === 'track' && track.backdrop.includes('#lg-lens-') && mapFitsBox(track),
    track,
  );

  const floats = {};

  for (const [overlay, slot] of Object.entries(FLOAT_SLOTS)) {
    await load(page, await scenarioUrl(base, SCENARIOS[0], overlay));
    floats[overlay] = await readGlass(page, `[data-slot="${slot}"]`);
  }

  check(
    "menus, selects, popovers, dialogs, sheets and the command palette run Glassy UI's lens over their whole box",
    Object.values(floats).every(
      (glass) =>
        glass?.engine === 'float' && glass.backdrop.includes('#lg-lens-') && mapFitsBox(glass),
    ),
    floats,
  );

  // Dark slabs dim the page under their glass, less at their rim, as the components' do.
  await load(page, await scenarioUrl(base, SCENARIOS[1], 'dialog'));
  const darkDialog = await readGlass(page, '[data-slot="dialog-content"]');
  check(
    'in dark mode a dialog dims the page under its glass, less at its rim',
    darkDialog?.engine === 'float' && JSON.stringify(darkDialog.slopes) === '[0.38,0.46]',
    darkDialog,
  );

  // The lens sits on the menu itself, so it stays while the menu fades in: slow every
  // animation tenfold and read the menu mid-fade.
  const cdp = await context.newCDPSession(page);
  await load(page, await scenarioUrl(base, SCENARIOS[0]));
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.1 });
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.waitForTimeout(600);
  const fading = await readGlass(page, '[data-slot="dropdown-menu-content"]');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
  check(
    'a fading menu keeps its lens',
    fading !== null && fading.opacity < 1 && fading.backdrop.includes('#lg-lens-'),
    fading,
  );

  await page.goto(`${base}/glassy-server`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const server = await page.evaluate(() => {
    const link = document.querySelector('[data-check="server-as-child"]');

    return {
      variants: document.querySelector('[data-check="server-variants"]').className,
      button: document.querySelector('[data-check="server-button"]').dataset.glassyEngine ?? null,
      link: {
        tag: link.tagName,
        slot: link.dataset.slot,
        engine: link.dataset.glassyEngine ?? null,
      },
    };
  });

  check(
    'a Server Component calls buttonVariants and renders drop-ins, a link through them included',
    server.variants.includes('inline-flex') &&
      server.button === 'slab' &&
      server.link.tag === 'A' &&
      server.link.slot === 'button' &&
      server.link.engine === 'slab',
    server,
  );

  const serverTabs = await readGlass(page, '[data-check="server-tabs"]');
  await page.locator('[data-check="server-dialog-trigger"]').click();
  await page.waitForTimeout(500);
  const serverDialog = await readGlass(page, '[data-check="server-dialog"]');
  check(
    'a Server Component renders drop-in tabs and a dialog that run the engine',
    serverTabs?.engine === 'track' && serverDialog?.engine === 'float',
    { tabs: serverTabs, dialog: serverDialog },
  );
  check('the drop-in pages log no errors', errors.length === 0, errors.slice(0, 5));
  await context.close();
}

// ---------- in-page measurements ----------

// A computed box-shadow list, split on the commas between shadows rather than
// the commas inside colour functions.
function splitShadows(value) {
  const shadows = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1;
    else if (value[index] === ')') depth -= 1;
    else if (value[index] === ',' && depth === 0) {
      shadows.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  if (value.trim() && value.trim() !== 'none') shadows.push(value.slice(start).trim());

  return shadows;
}

const shadowColour = (shadow) =>
  shadow.match(/(?:rgba?|oklab|oklch|color)\([^()]*\)/)?.[0] ?? 'transparent';

function parseAlpha(colour) {
  if (!colour || colour === 'transparent') return 0;
  const slash = colour.match(/\/\s*([\d.]+%?)\s*\)\s*$/);

  if (slash) return slash[1].endsWith('%') ? Number.parseFloat(slash[1]) / 100 : Number(slash[1]);

  const rgba = colour.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);

  return rgba ? Number(rgba[1]) : 1;
}

async function scenarioUrl(base, scenario, open) {
  const params = new URLSearchParams({ backdrop: scenario.backdrop, scheme: scenario.scheme });

  if (open) params.set('open', open);

  return `${base}/?${params}`;
}

async function load(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
}

async function readRoles(page) {
  return page.evaluate((samples) => {
    const read = (element, pseudo) => {
      const style = getComputedStyle(element, pseudo);

      return {
        content: style.content,
        backdrop: style.backdropFilter,
        filter: style.filter,
        mask: style.maskImage,
        background: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        boxShadow: style.boxShadow,
        position: style.position,
        positionAnchor: style.positionAnchor ?? '',
        easing: style.transitionTimingFunction,
        width: style.width,
        height: style.height,
      };
    };

    return samples.map(({ selector, role }) => {
      const element = document.querySelector(selector);

      if (!element) return { selector, role, missing: true };

      return {
        selector,
        role,
        host: read(element),
        before: read(element, '::before'),
        after: read(element, '::after'),
        box: { width: element.clientWidth, height: element.clientHeight },
      };
    });
  }, ROLE_SAMPLES);
}

// The signatures as Chrome draws them, with the lens: a pane frosts the page and
// bends it at the rim in one layer under its content, evenly to the edge, and its
// rims ride above it; a slab's rims, split into colour, ride above its face,
// which draws the page once, frosted (and bent, unless its tint hides the page).
function roleSignature(sample) {
  const { role, host, before, after } = sample;
  const insets = (shadow) => (shadow.match(/inset/g) ?? []).length;

  switch (role) {
    case 'pane':
      return (
        host.backdrop === 'none' &&
        // The theme frosts with blur() and bends with url(); a drop-in's measured lens does both
        // inside its filter.
        ((after.backdrop.includes('blur') && after.backdrop.includes('url(')) ||
          after.backdrop.includes('#lg-lens-')) &&
        after.mask === 'none' &&
        insets(before.boxShadow) >= 2
      );
    case 'slab':
      return (
        before.backdrop === 'none' &&
        insets(before.boxShadow) >= 2 &&
        before.filter.includes('drop-shadow') &&
        // The theme frosts with blur(); a drop-in's measured lens frosts inside its filter.
        (after.backdrop.includes('blur') || after.backdrop.includes('#lg-lens-')) &&
        host.position === 'relative'
      );
    case 'field':
      return (
        host.backdrop !== 'none' &&
        host.backgroundImage.includes('gradient') &&
        insets(host.boxShadow) >= 2
      );
    case 'knob':
      return host.easing.includes('linear(');
    case 'thumb':
      return before.content !== 'none' && insets(before.boxShadow) >= 1;
    case 'pill':
      return (
        host.backdrop !== 'none' &&
        before.content !== 'none' &&
        before.positionAnchor.includes('glassy-tab')
      );
    case 'chip':
      return after.content !== 'none' && insets(after.boxShadow) >= 1;
    default:
      return false;
  }
}

// Captures a label as drawn and with its text hidden. A popover that follows its
// trigger can still be moving after a scroll, so the pair is retaken until the
// label held still across both captures. Returns why it could not be measured
// otherwise.
async function captureLabel(page, element) {
  const readRect = () => element.evaluate((node) => node.getBoundingClientRect().toJSON());

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await element.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);

    const before = await readRect();
    // Only the part of the label inside the viewport can be captured.
    const viewport = page.viewportSize();
    const left = Math.max(0, before.x);
    const top = Math.max(0, before.y);

    const clip = {
      x: left,
      y: top,
      width: Math.min(viewport.width, before.x + before.width) - left,
      height: Math.min(viewport.height, before.y + before.height) - top,
    };

    if (clip.width < 1 || clip.height < 1) return { reason: 'off screen' };

    const regions = await element.evaluate((node, origin) => {
      const range = document.createRange();
      range.selectNodeContents(node);

      return [...range.getClientRects()].map((rect) => ({
        left: rect.left - origin.x,
        top: rect.top - origin.y,
        right: rect.right - origin.x,
        bottom: rect.bottom - origin.y,
      }));
    }, clip);

    const shown = await page.screenshot({ clip });
    await element.evaluate((node) => {
      node.dataset.contrastHide = 'true';
    });
    await page.waitForTimeout(60);
    const background = await page.screenshot({ clip });
    await element.evaluate((node) => {
      delete node.dataset.contrastHide;
    });

    const after = await readRect();

    if (Math.abs(after.x - before.x) < 0.5 && Math.abs(after.y - before.y) < 0.5) {
      return { shown, background, regions, clip };
    }
  }

  return { reason: 'kept moving' };
}

// Worst contrast between each label's text and the pixels right behind it: the
// label is captured as drawn and with its text made transparent, and the pixels
// around every glyph are compared with the text colour.
// Measures every label's rendered contrast; with `directory`, keeps the two
// captures of any label under 4.5:1, so a regression can be traced to pixels.
async function measureLabelContrast(page, selectors, directory) {
  const targets = await page.evaluate((list) => {
    const found = [];
    let index = 0;

    for (const selector of list) {
      for (const [nth, element] of [...document.querySelectorAll(selector)].entries()) {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);

        if (rect.width === 0 || style.visibility === 'hidden') continue;
        const range = document.createRange();
        range.selectNodeContents(element);
        const boxes = [...range.getClientRects()].filter((box) => box.width > 1 && box.height > 1);

        if (boxes.length === 0) continue;
        element.dataset.contrastTarget = String(index);
        found.push({
          index: index++,
          selector,
          nth,
          label: element.textContent.trim().slice(0, 40),
          color: style.color,
          fontSize: Number.parseFloat(style.fontSize),
          fontWeight: Number(style.fontWeight),
        });
      }
    }

    return found;
  }, selectors);

  const results = [];
  // Hiding a label must leave its colour alone, since the theme's label-aware
  // layer reads currentColor, and must not fade: shadcn's buttons transition
  // every property, and a capture taken mid-fade counts part of the label as
  // background. So only the glyph fill goes, at once.
  await page.addStyleTag({
    content:
      '[data-contrast-hide="true"], [data-contrast-hide="true"] * { -webkit-text-fill-color: transparent !important; transition: none !important; } [data-contrast-hide="true"] svg { visibility: hidden !important; }',
  });

  for (const target of targets) {
    const element = page.locator(`[data-contrast-target="${target.index}"]`);
    const { shown, background, regions, clip, reason } = await captureLabel(page, element);

    if (reason) {
      results.push({
        selector: target.selector,
        nth: target.nth,
        label: target.label,
        ratio: null,
        reason,
      });
      continue;
    }

    // The glyphs are where drawing the text changed the picture. Each glyph
    // pixel, and the background one pixel around it, is compared with the
    // text colour; rims and fills elsewhere in the label's box do not count.
    const ratio = await page.evaluate(
      async ({ shownPng, backgroundPng, color, regions, clip }) => {
        const decode = async (source) => {
          const image = new Image();
          image.src = source;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0);

          return context.getImageData(0, 0, image.width, image.height);
        };

        const withText = await decode(shownPng);
        const behind = await decode(backgroundPng);
        const { width, height } = behind;
        // Computed colours can be lab(), oklch() and so on; a canvas pixel turns
        // any of them into sRGB.
        const swatch = document.createElement('canvas').getContext('2d');
        swatch.fillStyle = color;
        swatch.fillRect(0, 0, 1, 1);
        const [r, g, b, alpha] = swatch.getImageData(0, 0, 1, 1).data;
        const a = alpha / 255;

        const channel = (value) => {
          const c = value / 255;

          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };

        const luminance = (data, index) =>
          0.2126 * channel(data[index]) +
          0.7152 * channel(data[index + 1]) +
          0.0722 * channel(data[index + 2]);

        const glyph = new Uint8Array(width * height);

        for (let pixel = 0; pixel < width * height; pixel += 1) {
          const x = ((pixel % width) + 0.5) * (clip.width / width);
          const y = (Math.floor(pixel / width) + 0.5) * (clip.height / height);

          // A separately rasterized rim can change between captures. It is not text.
          if (
            !regions.some(
              (rect) => x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom,
            )
          )
            continue;

          const index = pixel * 4;

          if (Math.abs(luminance(withText.data, index) - luminance(behind.data, index)) > 0.03)
            glyph[pixel] = 1;
        }

        let worst = Infinity;

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            let near = false;

            for (let dy = -1; dy <= 1 && !near; dy += 1) {
              for (let dx = -1; dx <= 1 && !near; dx += 1) {
                const yy = y + dy;
                const xx = x + dx;
                near =
                  yy >= 0 && yy < height && xx >= 0 && xx < width && glyph[yy * width + xx] === 1;
              }
            }

            if (!near) continue;

            const index = (y * width + x) * 4;

            const [br, bg, bb] = [
              behind.data[index],
              behind.data[index + 1],
              behind.data[index + 2],
            ];

            // Text with alpha blends into the pixel behind it.
            const text = luminance(
              [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)],
              0,
            );

            const back = luminance(behind.data, index);
            worst = Math.min(worst, (Math.max(text, back) + 0.05) / (Math.min(text, back) + 0.05));
          }
        }

        // Text that changed no pixel is indistinguishable from its background.
        return Number.isFinite(worst) ? worst : 1;
      },
      {
        shownPng: `data:image/png;base64,${shown.toString('base64')}`,
        backgroundPng: `data:image/png;base64,${background.toString('base64')}`,
        color: target.color,
        regions,
        clip,
      },
    );

    const large = target.fontSize >= 24 || (target.fontSize >= 18.66 && target.fontWeight >= 700);

    if (directory && ratio < 4.5) {
      fs.mkdirSync(directory, { recursive: true });
      const name = `${target.selector.replace(/[^a-z-]+/g, '-')}${target.nth}`;
      fs.writeFileSync(path.join(directory, `${name}-shown.png`), shown);
      fs.writeFileSync(path.join(directory, `${name}-behind.png`), background);
    }

    results.push({
      selector: target.selector,
      nth: target.nth,
      label: target.label,
      // Rounded down, never up: 4.499:1 does not meet 4.5:1.
      ratio: Math.floor(ratio * 100) / 100,
      required: large ? 3 : 4.5,
    });
  }

  await page.evaluate(() => {
    for (const node of document.querySelectorAll('[data-contrast-target]'))
      delete node.dataset.contrastTarget;
  });

  return results;
}

// Opens the dropdown the way a person does: its trigger in view, then a click.
// Opened on load instead, the menu pins to the bottom of the viewport under a
// trigger below the fold, and its modal scroll lock keeps most items off screen.
async function openMenu(page) {
  const strip = page.locator('[data-check="overlays"]');
  await strip.scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.mouse.move(4, 4);

  const menu = page.locator('[data-slot="dropdown-menu-content"]');
  await menu.waitFor();
  await menu.evaluate((node) =>
    Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );

  return { strip, menu };
}

// Stripe contrast along one row: high where the stripes show, low where glass blurs them.
async function stripeContrast(page, clip) {
  const png = await page.screenshot({ clip });

  return page.evaluate(
    async (source) => {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const row = context.getImageData(0, Math.floor(image.height / 2), image.width, 1).data;
      let min = 255;
      let max = 0;

      for (let i = 0; i < row.length; i += 4) {
        const level = (row[i] + row[i + 1] + row[i + 2]) / 3;
        min = Math.min(min, level);
        max = Math.max(max, level);
      }

      return max - min;
    },
    `data:image/png;base64,${png.toString('base64')}`,
  );
}

// The RGBA bytes of one clip of the page.
async function readPixels(page, clip, file) {
  const png = await page.screenshot({ clip });

  if (file) fs.writeFileSync(file, png);

  return page.evaluate(
    async (source) => {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);

      return Array.from(context.getImageData(0, 0, image.width, image.height).data);
    },
    `data:image/png;base64,${png.toString('base64')}`,
  );
}

// How two captures of one clip differ: the mean change of a channel, and the
// mean gap between how far red and blue moved, which stays zero over grey
// stripes unless the channels bent apart.
function compareCaptures(on, off) {
  let change = 0;
  let split = 0;

  for (let index = 0; index < on.length; index += 4) {
    const red = on[index] - off[index];
    const green = on[index + 1] - off[index + 1];
    const blue = on[index + 2] - off[index + 2];
    change += (Math.abs(red) + Math.abs(green) + Math.abs(blue)) / 3;
    split += Math.abs(red - blue);
  }

  const pixels = on.length / 4;

  return {
    change: Math.round((change / pixels) * 100) / 100,
    split: Math.round((split / pixels) * 100) / 100,
  };
}

async function encodeWebp(page, png, file) {
  const dataUrl = await page.evaluate(
    async (source) => {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext('2d').drawImage(image, 0, 0);

      return canvas.toDataURL('image/webp', 0.86);
    },
    `data:image/png;base64,${png.toString('base64')}`,
  );

  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
}

// ---------- phases ----------

async function capture(browser, base, phase, directory) {
  fs.mkdirSync(directory, { recursive: true });
  const shots = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  for (const scenario of SCENARIOS) {
    await load(page, await scenarioUrl(base, scenario));
    const file = path.join(directory, `${scenario.id}.png`);
    await page.screenshot({ path: file, fullPage: true });
    shots.push({ file: path.relative(artifactDirectory, file), sha256: sha256(file) });

    if (scenario.id === 'wallpaper-light') continue;

    for (const overlay of OVERLAYS) {
      await load(page, await scenarioUrl(base, scenario, overlay));
      const overlayFile = path.join(directory, `${scenario.id}-${overlay}.png`);
      await page.screenshot({ path: overlayFile });
      shots.push({
        file: path.relative(artifactDirectory, overlayFile),
        sha256: sha256(overlayFile),
      });
    }
  }

  check(`${phase}: kitchen sink renders without runtime errors`, errors.length === 0, errors);
  await context.close();

  return shots;
}

// Rendered contrast of every label in one scenario, the page's and then the
// menu's, and axe's colour-contrast findings.
async function measureScenarioContrast(browser, base, scenario, directory) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await load(page, await scenarioUrl(base, scenario));

  const labels = await measureLabelContrast(
    page,
    LABEL_SELECTORS,
    directory && path.join(directory, scenario.id),
  );

  await load(page, await scenarioUrl(base, scenario));
  // The stripes under the menu are the fade test's pattern, not a page: here the
  // menu opens over the scenario's own backdrop.
  await page.addStyleTag({
    content: '[data-check="overlays"] { background: none !important; }',
  });
  await openMenu(page);
  labels.push(...(await measureLabelContrast(page, MENU_LABEL_SELECTORS)));
  await load(page, await scenarioUrl(base, scenario));
  const axe = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();

  // axe names an element by its rarest classes, and a drop-in changes the classes, so
  // the stock page and the drop-ins name one link differently. Each flagged element is
  // named by its part, variant and text instead.
  const violations = await page.evaluate(
    (targets) =>
      targets.map((target) => {
        const node = document.querySelector(target);

        if (!node) return target;
        const part = node.closest('[data-slot]');
        const text = node.textContent.trim().replace(/\s+/g, ' ').slice(0, 40);

        return `${part?.dataset.slot ?? node.localName}|${part?.dataset.variant ?? ''}|${text}`;
      }),
    axe.violations.flatMap((violation) => violation.nodes.map((node) => node.target.join(' '))),
  );

  await context.close();

  return {
    labels,
    axe: {
      violations,
      incomplete: axe.incomplete.reduce((sum, violation) => sum + violation.nodes.length, 0),
    },
  };
}

async function baselineAssertions(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await load(page, await scenarioUrl(base, SCENARIOS[0]));
  const roles = await readRoles(page);

  for (const sample of roles) {
    check(
      `baseline: ${sample.selector} renders`,
      !sample.missing,
      sample.missing ? 'missing' : 'present',
    );

    if (sample.missing) continue;
    check(
      `baseline: ${sample.selector} has no theme frost`,
      sample.host.backdrop === 'none',
      sample.host.backdrop,
    );
  }

  const stockPseudo = await page.evaluate(() =>
    [...document.querySelectorAll('[data-slot="tabs-trigger"]')].map(
      (node) => getComputedStyle(node, '::after').content,
    ),
  );

  current.baselineStockPseudo = { tabsTriggerAfter: stockPseudo };
  await context.close();

  // What stock shadcn/ui gives on the gated backdrops, for the themed gate.
  current.stockContrast = {};

  for (const scenario of SCENARIOS.filter((candidate) => candidate.gate)) {
    current.stockContrast[scenario.id] = await measureScenarioContrast(browser, base, scenario);
  }
}

// Glassy UI's own look on the drop-ins, read in Chrome: clear glass panels with the bevel
// and the specular ring, pills of glass, a default button filled with the palette's primary
// colour, glass fields, the capsule switch, the accent checkbox, the raised tabs pill and
// tinted chips, each at the components' size. A class written on a component still wins.
async function nativeLookAssertions(page) {
  const look = await page.evaluate(() => {
    const read = (selector, pseudo) => {
      const node = document.querySelector(selector);

      if (!node) return null;
      const style = getComputedStyle(node, pseudo);
      const box = node.getBoundingClientRect();

      return {
        width: Math.round(box.width),
        height: Math.round(box.height),
        radius: Number.parseFloat(style.borderTopLeftRadius),
        background: style.backgroundColor,
        image: style.backgroundImage,
        insets: (style.boxShadow.match(/inset/g) ?? []).length,
        backdrop: style.backdropFilter,
        mask: style.maskImage,
        content: style.content,
      };
    };

    // The palette's primary colour as Chrome resolves it, to compare fills with.
    const probe = document.createElement('span');
    probe.style.backgroundColor = 'var(--primary)';
    document.body.append(probe);
    const primary = getComputedStyle(probe).backgroundColor;
    probe.remove();

    return {
      primary,
      card: [
        read('[data-check="card"]'),
        read('[data-check="card"]', '::before'),
        read('[data-check="card"]', '::after'),
      ],
      button: [
        read('[data-check="button-outline"]'),
        read('[data-check="button-outline"]', '::before'),
        read('[data-check="button-outline"]', '::after'),
      ],
      filled: read('[data-check="button-default"]', '::before'),
      field: read('[data-check="input"]'),
      track: read('[data-slot="switch"]'),
      knob: read('[data-slot="switch-thumb"]'),
      checkbox: read('[data-slot="checkbox"]'),
      tabs: [read('[data-check="tabs-list"]'), read('[data-check="tabs-list"]', '::before')],
      badge: read('[data-slot="badge"]'),
    };
  });

  const [card, cardGlass, cardRing] = look.card;
  const [button, buttonGlass, buttonRing] = look.button;
  const [tabs, bubble] = look.tabs;
  check(
    "cards are Glassy UI's clear glass: frost, bevel and a specular ring",
    card.background === 'rgba(0, 0, 0, 0)' &&
      cardGlass.backdrop !== 'none' &&
      cardGlass.insets >= 8 &&
      cardRing.mask !== 'none' &&
      card.radius === 16,
    look.card,
  );
  check(
    "buttons are pills of glass at the components' 44 px, with the bevel and the ring",
    button.height === 44 &&
      button.radius >= button.height / 2 &&
      buttonGlass.insets >= 8 &&
      buttonRing.mask !== 'none',
    look.button,
  );
  check(
    "a default button is filled with the palette's primary colour",
    look.filled.background === look.primary,
    { fill: look.filled.background, primary: look.primary },
  );
  check(
    'fields are 52 px wells of frosted glass with 16 px corners',
    look.field.height === 52 &&
      look.field.radius === 16 &&
      look.field.backdrop.includes('blur(16px)'),
    look.field,
  );
  check(
    'the switch is a 60 by 28 track with a 36 by 24 capsule knob',
    look.track.width === 60 &&
      look.track.height === 28 &&
      look.knob.width === 36 &&
      look.knob.height === 24,
    { track: look.track, knob: look.knob },
  );
  check(
    'the checkbox is a 20 px square with 7 px corners',
    look.checkbox.width === 20 && look.checkbox.height === 20 && look.checkbox.radius === 7,
    look.checkbox,
  );
  check(
    'the tabs list is a 48 px pill whose selected tab rides a glass bubble',
    tabs.height === 48 &&
      tabs.radius >= 24 &&
      bubble.content !== 'none' &&
      bubble.image.includes('gradient'),
    look.tabs,
  );
  check(
    'badges are 22 px tinted chips',
    look.badge.height === 22 &&
      look.badge.radius >= 11 &&
      look.badge.background !== 'rgba(0, 0, 0, 0)',
    look.badge,
  );

  // A class written on a component still wins over the glass.
  const contract = await page.evaluate(() => {
    const button = document.querySelector('[data-check="button-outline"]');
    const card = document.querySelector('[data-check="card"]');

    const read = () => ({
      radius: getComputedStyle(button).borderTopLeftRadius,
      shadow: getComputedStyle(card).boxShadow,
      background: getComputedStyle(card).backgroundColor,
    });

    const before = read();
    button.classList.add('rounded-none');
    card.classList.add('shadow-none', 'bg-red-500/40');

    const after = read();
    button.classList.remove('rounded-none');
    card.classList.remove('shadow-none', 'bg-red-500/40');

    return { before, after };
  });

  check(
    'a class on a component still wins: rounded-none, shadow-none and a background colour',
    contract.after.radius === '0px' &&
      splitShadows(contract.after.shadow).every(
        (shadow) => parseAlpha(shadowColour(shadow)) === 0,
      ) &&
      contract.after.background !== contract.before.background,
    contract,
  );
}

// The theme's design, read in Chrome: role signatures and decoration bounds, buttons the
// theme finds by their classes, the palette's light, the className contract and the
// slabs' press.
async function themeLookAssertions(page) {
  // Role signatures and decoration bounds.
  for (const sample of await readRoles(page)) {
    if (sample.missing) {
      check(`${sample.selector} renders`, false, 'missing');
      continue;
    }

    check(`${sample.selector} shows the ${sample.role} signature`, roleSignature(sample), {
      host: sample.host,
      before: sample.before,
      after: sample.after,
    });
  }

  const bounds = await page.evaluate((selectors) => {
    // A sample missing from a fixture is reported by the role check above.
    return selectors.flatMap((selector) => {
      const element = document.querySelector(selector);

      if (!element) return [];

      const result = { selector, host: [element.clientWidth, element.clientHeight] };

      for (const pseudo of ['::before', '::after']) {
        const style = getComputedStyle(element, pseudo);

        if (style.content !== 'none' && style.position === 'absolute') {
          result[pseudo] = [Number.parseFloat(style.width), Number.parseFloat(style.height)];
        }
      }

      return [result];
    });
  }, BOUND_SAMPLES);

  for (const entry of bounds) {
    for (const pseudo of ['::before', '::after']) {
      if (!entry[pseudo]) continue;
      const [width, height] = entry[pseudo];
      check(
        `${entry.selector}${pseudo} sits on its host`,
        Math.abs(width - entry.host[0]) <= 1 && Math.abs(height - entry.host[1]) <= 1,
        entry,
      );
    }
  }

  // Buttons found without data-slot="button" or data-variant: a Button that
  // opens a menu or tooltip carries the trigger's slot, and one copied before
  // shadcn added data-variant carries only its classes. Ghost buttons stay clear
  // until a pointer finds them. Small base-nova buttons cap their own radius.
  const found = await page.evaluate(() => {
    const read = (selector) => {
      const node = document.querySelector(selector);
      const style = getComputedStyle(node);

      return {
        slot: node.dataset.slot,
        variant: node.dataset.variant ?? null,
        fill: style.backgroundColor,
        layers: getComputedStyle(node, '::before').opacity,
        radius: Number.parseFloat(style.borderTopLeftRadius),
        height: node.getBoundingClientRect().height,
      };
    };

    return {
      menu: read('[data-check="trigger-menu"]'),
      ghostTrigger: read('[data-check="trigger-ghost"]'),
      outline: read('[data-check="legacy-outline"]'),
      ghost: read('[data-check="legacy-ghost"]'),
      small: read('[data-check="button-small"]'),
    };
  });

  check(
    'a button that opens a menu is a clear slab',
    found.menu.slot === 'dropdown-menu-trigger' && parseAlpha(found.menu.fill) < 1,
    found.menu,
  );
  check(
    'an outline button without data-variant is a clear slab',
    found.outline.variant === null && parseAlpha(found.outline.fill) < 1,
    found.outline,
  );
  check(
    'ghost buttons stay clear at rest, as triggers and without data-variant',
    found.ghostTrigger.slot === 'tooltip-trigger' &&
      found.ghostTrigger.layers === '0' &&
      found.ghost.variant === null &&
      found.ghost.layers === '0',
    { ghostTrigger: found.ghostTrigger, ghost: found.ghost },
  );
  check(
    'small buttons round into pills',
    found.small.radius >= found.small.height * 0.4,
    found.small,
  );

  // A pill's round ends take room from its label: a labelled slab widens 0.75rem
  // past its content in Chromium, while a ghost button keeps shadcn's width.
  const room = await page.evaluate(() => {
    const extra = (selector) => {
      const node = document.querySelector(selector);
      const style = getComputedStyle(node);
      const range = document.createRange();
      range.selectNodeContents(node);

      const used =
        range.getBoundingClientRect().width +
        Number.parseFloat(style.paddingLeft) +
        Number.parseFloat(style.paddingRight) +
        Number.parseFloat(style.borderLeftWidth) +
        Number.parseFloat(style.borderRightWidth);

      return Math.round((node.getBoundingClientRect().width - used) * 10) / 10;
    };

    return {
      slab: extra('[data-check="button-default"]'),
      ghost: extra('[data-check="button-ghost"]'),
    };
  });

  check(
    'labelled slabs widen 0.75rem past their content; ghost buttons keep their width',
    Math.abs(room.slab - 12) <= 1 && Math.abs(room.ghost) <= 1,
    room,
  );

  // Glass carries the palette's own colour as light, as strongly as that colour
  // is vivid, so a grey palette keeps clear glass.
  const light = await page.evaluate(() => {
    const image = getComputedStyle(
      document.querySelector('[data-check="card"]'),
      '::before',
    ).backgroundImage;

    const colour = image.slice(image.indexOf('radial-gradient')).match(/oklch\([^)]*\)/);

    return { colour: colour?.[0] ?? null };
  });

  const lightAlpha = light.colour ? parseAlpha(light.colour) : null;

  check(
    current.palette === 'neutral'
      ? 'a grey palette leaves the glass clear'
      : "glass carries the palette's colour as light",
    lightAlpha !== null && (current.palette === 'neutral' ? lightAlpha < 0.005 : lightAlpha > 0.05),
    { ...light, alpha: lightAlpha },
  );

  // The default slab is translucent primary.
  const slabFill = await page.evaluate(
    () => getComputedStyle(document.querySelector('[data-check="button-default"]')).backgroundColor,
  );

  check(
    'default button fill is translucent primary',
    parseAlpha(slabFill) > 0.5 && parseAlpha(slabFill) < 1,
    slabFill,
  );

  // A covered element that carries .dark itself keeps a valid, opaque palette.
  const darkRoot = await page.evaluate(() => {
    const node = document.querySelector('[data-check="dark-root-button"]');
    const style = getComputedStyle(node);

    return {
      primary: style.getPropertyValue('--primary').trim(),
      background: style.backgroundColor,
    };
  });

  check(
    '.dark on a covered element keeps a valid palette',
    darkRoot.primary !== '' && parseAlpha(darkRoot.background) > 0.5,
    darkRoot,
  );

  // className contract.
  const contract = await page.evaluate(() => {
    const style = (selector) => getComputedStyle(document.querySelector(selector));

    return {
      radius: style('[data-check="override-radius"]').borderTopLeftRadius,
      cardBackground: style('[data-check="override-bg"]').backgroundColor,
      noShadow: style('[data-check="override-shadow"]').boxShadow,
      noInset: style('[data-check="override-inset"]').boxShadow,
      ownFill: {
        image: style('[data-check="override-fill"]').backgroundImage,
        color: style('[data-check="override-fill"]').backgroundColor,
      },
    };
  });

  check('rounded-none keeps a button square', contract.radius === '0px', contract.radius);
  check(
    'bg-red-500/40 shows on a card',
    /oklab|rgb|color/.test(contract.cardBackground) &&
      parseAlpha(contract.cardBackground) > 0.3 &&
      parseAlpha(contract.cardBackground) < 0.5,
    contract.cardBackground,
  );

  const visible = (shadows, inset) =>
    splitShadows(shadows).filter(
      (shadow) => /\binset\b/.test(shadow) === inset && parseAlpha(shadowColour(shadow)) > 0,
    );

  check(
    'shadow-none removes elevation but keeps the rim',
    visible(contract.noShadow, false).length === 0 && visible(contract.noShadow, true).length > 0,
    contract.noShadow,
  );
  check(
    'inset-shadow-none removes the rim',
    visible(contract.noInset, true).length === 0,
    contract.noInset,
  );
  check(
    'bg-none with a colour class recolours a field',
    contract.ownFill.image === 'none' && parseAlpha(contract.ownFill.color) > 0.9,
    contract.ownFill,
  );

  // Stock focus rings survive.
  await page.locator('[data-check="input"]').focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  // The stock field transitions its box-shadow, so the ring is read once it lands.
  await page.waitForTimeout(400);
  const focusShadow = await page.evaluate(() => getComputedStyle(document.activeElement).boxShadow);
  check(
    'stock 3px focus ring survives on a field',
    splitShadows(focusShadow).some(
      (shadow) =>
        !/\binset\b/.test(shadow) &&
        /0px 0px 0px 3px/.test(shadow) &&
        parseAlpha(shadowColour(shadow)) > 0,
    ),
    focusShadow,
  );

  // Slabs set down; they never scale.
  const slab = page.locator('[data-check="button-default"]');

  const readSlab = () =>
    slab.evaluate((node) => {
      const after = getComputedStyle(node, '::after');
      const host = getComputedStyle(node);

      return {
        translate: after.translate,
        shadow: after.boxShadow,
        scale: host.scale,
        transform: host.transform,
      };
    });

  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
  const rest = await readSlab();
  const box = await slab.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(450);
  const hover = await readSlab();
  await page.mouse.down();
  await page.waitForTimeout(450);
  const pressed = await readSlab();
  await page.mouse.up();
  check(
    'a pointer lowers the slab and a press sets it down, without scaling',
    rest.shadow !== hover.shadow &&
      hover.shadow !== pressed.shadow &&
      [rest, hover, pressed].every((state) => state.scale === 'none' && state.transform === 'none'),
    { rest, hover, pressed },
  );
}

async function themedAssertions(browser, base, fixtureDirectory) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.tracing.start({ snapshots: true, screenshots: false });
  const page = await context.newPage();
  const plainLight = SCENARIOS[0];
  await load(page, await scenarioUrl(base, plainLight));

  if (dropins) await nativeLookAssertions(page);
  else await themeLookAssertions(page);

  // The tabs pill slides on the spring.
  await page.mouse.move(5, 5);

  const motion = await page.evaluate(async () => {
    const list = document.querySelector('[data-check="tabs-list"]');

    const target = [...list.querySelectorAll('[data-slot="tabs-trigger"]')].find(
      (node) => node.textContent.trim() === 'Reports',
    );

    const read = () => Number.parseFloat(getComputedStyle(list, '::before').left);
    const start = read();
    target.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }),
    );
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    target.click();
    const samples = [];
    const t0 = performance.now();

    while (performance.now() - t0 < 1000) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      samples.push([Math.round(performance.now() - t0), read()]);
    }

    const listBox = list.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    const border = Number.parseFloat(getComputedStyle(list).borderLeftWidth) || 0;

    return { start, end: targetBox.left - listBox.left - border, samples };
  });

  const travel = motion.end - motion.start;
  const firstMove = motion.samples.find(([, value]) => Math.abs(value - motion.start) > 0.5);

  const overshoot = Math.max(
    ...motion.samples.map(([, value]) => (value - motion.end) * Math.sign(travel)),
  );

  const settled = motion.samples.filter(([time]) => time >= 800);
  check(
    'the tabs pill moves toward the target, overshoots at most 6% and settles by 800 ms',
    Math.abs(travel) > 20 &&
      firstMove &&
      Math.sign(firstMove[1] - motion.start) === Math.sign(travel) &&
      overshoot <= Math.abs(travel) * 0.06 &&
      settled.length > 0 &&
      settled.every(([, value]) => Math.abs(value - motion.end) <= 1),
    {
      start: motion.start,
      end: motion.end,
      overshoot,
      samples: motion.samples.filter((_, i) => i % 6 === 0),
    },
  );

  // Floats keep their frost while they fade in: slow every animation tenfold,
  // open the menu over the striped strip and measure the stripes mid-fade. The
  // menu's rows are hidden, so the sampled row crosses only its glass.
  const cdp = await context.newCDPSession(page);
  await load(page, await scenarioUrl(base, plainLight));
  await page.addStyleTag({
    content: "[data-slot='dropdown-menu-content'] * { visibility: hidden !important; }",
  });
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.1 });
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.waitForTimeout(900);
  const content = await page.locator('[data-slot="dropdown-menu-content"]').boundingBox();
  const strip = await page.locator('[data-check="overlays"]').boundingBox();

  // A row inside both the menu and the striped strip, whichever ends first.
  const row = Math.min(content.y + content.height, strip.y + strip.height) - 6;

  const inside = await stripeContrast(page, {
    x: content.x + 4,
    y: row,
    width: content.width - 8,
    height: 2,
  });

  const outside = await stripeContrast(page, {
    x: strip.x + strip.width - 80,
    y: row,
    width: 70,
    height: 2,
  });

  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
  check('a fading menu keeps its frost', outside > 120 && inside <= outside * 0.5, {
    inside,
    outside,
  });

  await context.tracing.stop({ path: path.join(fixtureDirectory, 'trace.zip') });
  await context.close();

  // Rendered contrast and axe in every scenario; the plain ones are gated against
  // the stock page. A label must reach its WCAG minimum. Where stock shadcn/ui
  // already falls short, the theme may only keep or raise that contrast (ratios
  // are rounded to two places, hence the allowance). A label that could not be
  // measured fails, so nothing passes unseen.
  current.contrast = {};
  current.axe = {};
  current.stockShortfalls = {};

  for (const scenario of SCENARIOS) {
    const measured = await measureScenarioContrast(
      browser,
      base,
      scenario,
      path.join(fixtureDirectory, 'contrast'),
    );

    current.contrast[scenario.id] = measured.labels;
    current.axe[scenario.id] = measured.axe;

    if (!scenario.gate) continue;

    const stock = current.stockContrast[scenario.id];

    const stockRatio = (label) =>
      stock.labels.find((entry) => entry.selector === label.selector && entry.nth === label.nth)
        ?.ratio ?? null;

    const shortfalls = [];

    const failing = measured.labels.flatMap((label) => {
      if (label.ratio !== null && label.ratio >= label.required) return [];

      const before = stockRatio(label);

      if (
        label.ratio !== null &&
        before !== null &&
        before < label.required &&
        label.ratio >= before - 0.05
      ) {
        shortfalls.push({ ...label, stock: before });

        return [];
      }

      return [{ ...label, stock: before }];
    });

    current.stockShortfalls[scenario.id] = shortfalls;
    check(
      `${scenario.id}: every label meets its WCAG minimum, or keeps the stock contrast where that falls short`,
      measured.labels.length > 0 && failing.length === 0,
      failing,
    );

    const added = measured.axe.violations.filter(
      (target) => !stock.axe.violations.includes(target),
    );

    check(
      `${scenario.id}: axe finds no colour-contrast violation the stock page did not have`,
      added.length === 0,
      { added, stock: stock.axe.violations },
    );
  }

  // Reduced motion: no movement on covered slots, end states kept.
  const reduced = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });

  const reducedPage = await reduced.newPage();
  await load(reducedPage, await scenarioUrl(base, plainLight, 'dialog'));
  await reducedPage.waitForSelector('[data-slot="dialog-content"]');

  const motionOnOpen = await reducedPage.evaluate(
    () => document.getAnimations().filter((animation) => animation.playState === 'running').length,
  );

  await reducedPage.keyboard.press('Escape');

  const motionOnClose = await reducedPage.evaluate(
    () => document.getAnimations().filter((animation) => animation.playState === 'running').length,
  );

  await reducedPage.waitForSelector('[data-slot="dialog-content"]', { state: 'detached' });

  const dialogGone = await reducedPage.evaluate(
    () => document.querySelector('[data-slot="dialog-content"]') === null,
  );

  await reducedPage.getByText('Does it need JavaScript?').click();

  const motionOnFold = await reducedPage.evaluate(
    () => document.getAnimations().filter((animation) => animation.playState === 'running').length,
  );

  const foldOpen = await reducedPage.getByText('No. This theme is CSS only.').isVisible();
  check(
    'reduced motion: dialogs and accordions jump to their end states',
    motionOnOpen === 0 && motionOnClose === 0 && dialogGone && motionOnFold === 0 && foldOpen,
    { motionOnOpen, motionOnClose, dialogGone, motionOnFold, foldOpen },
  );
  await reduced.close();

  // Reduced transparency, increased contrast and forced colours: no frost, opaque fills.
  for (const preference of ['reduced-transparency', 'contrast-more', 'forced-colors']) {
    const preferenceContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      forcedColors: preference === 'forced-colors' ? 'active' : 'none',
      contrast: preference === 'contrast-more' ? 'more' : 'no-preference',
    });

    const preferencePage = await preferenceContext.newPage();

    if (preference === 'reduced-transparency') {
      const session = await preferenceContext.newCDPSession(preferencePage);
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
      });
    }

    await load(preferencePage, await scenarioUrl(base, SCENARIOS[1], 'dropdown'));

    const fills = await preferencePage.evaluate(() => {
      const read = (selector) => {
        const node = document.querySelector(selector);
        const style = getComputedStyle(node);

        const gradient = style.backgroundImage.match(
          /(oklab|oklch|rgba?|color)\([^()]*(\([^()]*\)[^()]*)*\)/,
        );

        return {
          selector,
          backdrop: style.backdropFilter,
          layers: [
            getComputedStyle(node, '::before').backdropFilter,
            getComputedStyle(node, '::after').backdropFilter,
          ],
          color: style.backgroundColor,
          image: gradient ? gradient[0] : style.backgroundImage,
        };
      };

      return [
        read('[data-check="card"]'),
        read('[data-check="input"]'),
        read('[data-slot="dropdown-menu-content"]'),
        read('[data-check="button-default"]'),
      ];
    });

    const opaque = (fill) =>
      Math.max(parseAlpha(fill.color), fill.image === 'none' ? 0 : parseAlpha(fill.image)) >= 0.95;

    // Forced colours hand every fill to the browser's system colours, so there the
    // theme only has to stop frosting.
    check(
      preference === 'forced-colors'
        ? `${preference}: no frost`
        : `${preference}: no frost and opaque fills`,
      fills.every(
        (fill) =>
          fill.backdrop === 'none' &&
          fill.layers.every((layer) => layer === 'none') &&
          (preference === 'forced-colors' || opaque(fill)),
      ),
      fills,
    );
    await preferenceContext.close();
  }
}

// The least a lens must change a rim over the bands: the mean change of a
// channel, and the mean gap between how far red and blue moved. Without the lens
// both are 0.02 or less; through the tint of a card on new-york the lens moved its
// rim 2.1 levels and split it 0.6.
const LENS_BEND = 1;

const LENS_SPLIT = 0.3;

// Fine stripes behind the whole page, and the same stripes moved half a period:
// frost wipes them out, so wherever glass is clearer than its frost the two
// captures differ.
const STRIPES = `html body {
  background: repeating-linear-gradient(45deg, #000 0 4px, #fff 4px 10px) !important;
}`;

const STRIPES_MOVED = `html body {
  background: repeating-linear-gradient(45deg, #fff 0 5px, #000 5px 9px, #fff 9px 10px) !important;
}`;

// Wide bands behind the whole page, which frost softens but keeps, so a bend in
// either direction shows through frosted glass.
const BANDS = `html body {
  background: repeating-linear-gradient(45deg, #000 0 24px, #fff 24px 48px) !important;
}`;

// The lens alone switched off: a pane keeps its frost and saturation, a slab its
// frost and its face's light.
const LENS_OFF = `[data-slot='card']::after, [data-slot='alert']::after {
  backdrop-filter: blur(var(--glassy-lens-frost)) saturate(var(--glassy-saturate)) !important;
}
[data-slot='button']::after {
  backdrop-filter: blur(var(--glassy-lens-frost)) var(--glassy-face) !important;
}`;

// The drop-ins draw their glass on ::before; with the lens alone switched off it keeps the
// lens's own frost and saturation.
const LENS_OFF_NATIVE = `[data-slot='card']::before, [data-slot='alert']::before {
  backdrop-filter: blur(var(--lg-lens-blur)) saturate(var(--lg-lens-saturation)) !important;
}
[data-slot='button']::before {
  backdrop-filter: blur(var(--lg-lens-blur)) !important;
}`;

const lensOffStyle = () => (dropins ? LENS_OFF_NATIVE : LENS_OFF);

// Captures each clip with the lens, then without it.
async function withAndWithoutLens(page, clips) {
  const on = [];

  for (const clip of clips) on.push(await readPixels(page, clip));

  const off = await page.addStyleTag({ content: lensOffStyle() });
  await page.waitForTimeout(150);
  const result = [];

  for (const [index, clip] of clips.entries()) {
    result.push(compareCaptures(on[index], await readPixels(page, clip)));
  }

  await off.evaluate((node) => node.remove());

  return result;
}

// Glassy UI's own lens, as its components build it (useLensFilter in
// registry/glassyui/lib/use-refraction-filter.tsx): the map comes from the
// component library's refraction-map.ts, compiled for the page here.
const LIBRARY_LENS_MAP = (() => {
  const ts = require('typescript');

  const compile = (file) => {
    const source = fs.readFileSync(path.join(root, 'registry', 'glassyui', 'lib', file), 'utf8');

    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });

    return outputText.replace(/^export /gm, '');
  };

  const optics = compile('slab-optics.ts');

  const lensMap = compile('refraction-map.ts').replace(
    /^import .* from ['"]\.\/slab-optics['"];$/gm,
    '',
  );

  return `(() => {\n${optics}\n${lensMap}\nwindow.glassyLensMap = buildLensMapDataUrl;\n})();`;
})();

// Lays the components' lens over one element's box, with the theme's frost and
// saturation, and hides the element: the filter is useLensFilter's, primitive for
// primitive.
function placeLibraryLens({ selector, frostOnly, rimWidth, dispersion = 0.16, saturate }) {
  const element = document.querySelector(selector);
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const after = getComputedStyle(element, '::after');

  // A drop-in's engine frosts by its own token; the theme by --glassy-lens-frost.
  const frost = Number.parseFloat(
    style.getPropertyValue(element.dataset.glassyEngine ? '--lg-lens-blur' : '--glassy-lens-frost'),
  );

  const saturation = saturate ?? Number.parseFloat(style.getPropertyValue('--glassy-saturate'));
  // Both the theme's inset pseudo-element and useLensFilter fill the padding box.
  const left = rect.left + element.clientLeft;
  const top = rect.top + element.clientTop;
  const width = element.clientWidth;
  const height = element.clientHeight;

  const radius = Math.min(
    Number.parseFloat(after.borderTopLeftRadius),
    Math.min(width, height) / 2,
  );

  const bevel = rimWidth ?? Math.min(Math.max(radius, 6), 36, Math.min(width, height) / 2);

  const { href, metrics } = window.glassyLensMap({
    bevel,
    depth: 1,
    devicePixelRatio: window.devicePixelRatio,
    height,
    ior: 1.5,
    radii: [radius, radius, radius, radius],
    thickness: (rimWidth ?? Math.min(Math.max(radius, 6), 36)) * 1.4,
    width,
  });

  const padding = Math.ceil(frost * 3) + 2;
  const scale = Math.round(2 * metrics.reach * 100) / 100;
  const ns = 'http://www.w3.org/2000/svg';

  const add = (parent, name, attributes) => {
    const node = document.createElementNS(ns, name);

    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    parent.append(node);

    return node;
  };

  document.querySelector('#glassy-library-lens')?.remove();
  const svg = add(document.body, 'svg', { id: 'glassy-library-lens', width: 0, height: 0 });

  const filter = add(add(svg, 'defs', {}), 'filter', {
    id: 'glassy-library-filter',
    x: -padding,
    y: -padding,
    width: metrics.width + padding * 2,
    height: metrics.height + padding * 2,
    filterUnits: 'userSpaceOnUse',
    primitiveUnits: 'userSpaceOnUse',
    'color-interpolation-filters': 'sRGB',
  });

  add(filter, 'feGaussianBlur', { in: 'SourceGraphic', stdDeviation: frost, result: 'frost' });
  add(filter, 'feImage', {
    href,
    x: 0,
    y: 0,
    width: metrics.width,
    height: metrics.height,
    preserveAspectRatio: 'none',
    result: 'lens',
  });

  // Match refractColours in use-refraction-filter.tsx, including its coverage.
  // Blending three translucent copies at zero dispersion changes the rim's alpha.
  if (dispersion <= 0.005) {
    add(filter, 'feDisplacementMap', {
      in: 'frost',
      in2: 'lens',
      scale,
      xChannelSelector: 'R',
      yChannelSelector: 'G',
      result: 'bent',
    });
  } else {
    const channels = [
      ['red', '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1', 1 - dispersion / 2],
      ['green', '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 1', 1],
      ['blue', '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 1', 1 + dispersion / 2],
    ];

    for (const [name, values, factor] of channels) {
      add(filter, 'feDisplacementMap', {
        in: 'frost',
        in2: 'lens',
        scale: Math.round(scale * factor * 100) / 100,
        xChannelSelector: 'R',
        yChannelSelector: 'G',
        result: `${name}-scene`,
      });
      add(filter, 'feColorMatrix', {
        in: `${name}-scene`,
        type: 'matrix',
        values,
        result: `${name}-bent`,
      });
    }

    add(filter, 'feBlend', { in: 'red-bent', in2: 'green-bent', mode: 'screen', result: 'rg' });
    add(filter, 'feBlend', { in: 'rg', in2: 'blue-bent', mode: 'screen', result: 'rgb' });
    add(filter, 'feComposite', { in: 'rgb', in2: 'green-scene', operator: 'in', result: 'bent' });
  }

  if (saturation !== 1)
    add(filter, 'feColorMatrix', { in: 'bent', type: 'saturate', values: saturation });
  document.querySelector('#glassy-library-glass')?.remove();
  const glass = document.createElement('div');
  glass.id = 'glassy-library-glass';
  Object.assign(glass.style, {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    borderRadius: `${radius}px`,
    backdropFilter: frostOnly
      ? `blur(${frost}px) saturate(${saturation})`
      : 'url(#glassy-library-filter)',
  });
  element.style.visibility = 'hidden';
  document.body.append(glass);

  return { bevel, radius };
}

// How two captures of one box differ between `near` and `far` pixels inside its
// rounded outline: the mean change of a channel, and the mean gap between how
// far red and blue moved.
function regionDifference(a, b, { width, height, radius }, near, far) {
  let change = 0;
  let split = 0;
  let count = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = Math.abs(x + 0.5 - width / 2) - (width / 2 - radius);
      const py = Math.abs(y + 0.5 - height / 2) - (height / 2 - radius);

      const outside =
        Math.hypot(Math.max(px, 0), Math.max(py, 0)) + Math.min(Math.max(px, py), 0) - radius;

      if (outside > -near || outside < -far) continue;
      const index = (y * width + x) * 4;
      const red = a[index] - b[index];
      const green = a[index + 1] - b[index + 1];
      const blue = a[index + 2] - b[index + 2];
      change += (Math.abs(red) + Math.abs(green) + Math.abs(blue)) / 3;
      split += Math.abs(red - blue);
      count += 1;
    }
  }

  return {
    change: Math.round((change / count) * 100) / 100,
    split: Math.round((split / count) * 100) / 100,
  };
}

// Over the rim: from the outline, less its antialiased pixel, to the rim's depth.
const rimDifference = (a, b, rim) => regionDifference(a, b, rim, 1, rim.bevel);

// One element's box in whole pixels, with its corner radius and the rim the
// components would give it: as wide as the corner, at most 36 px and half the box.
async function rimOf(page, selector) {
  return page.evaluate((target) => {
    const element = document.querySelector(target);
    const rect = element.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);

    const radius = Math.min(
      Number.parseFloat(getComputedStyle(element, '::after').borderTopLeftRadius),
      Math.min(width, height) / 2,
    );

    return {
      clip: { x: Math.round(rect.left), y: Math.round(rect.top), width, height },
      width,
      height,
      radius,
      bevel: Math.min(Math.max(radius, 6), 36, Math.min(width, height) / 2),
    };
  }, selector);
}

// How far one lens's change to the frosted page strays from another's: the mean,
// between `near` and `far` pixels inside the outline, of how differently the two
// lenses moved a channel from their own frost.
function lensDifference(lens, frost, otherLens, otherFrost, { width, height, radius }, near, far) {
  let sum = 0;
  let count = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = Math.abs(x + 0.5 - width / 2) - (width / 2 - radius);
      const py = Math.abs(y + 0.5 - height / 2) - (height / 2 - radius);

      const outside =
        Math.hypot(Math.max(px, 0), Math.max(py, 0)) + Math.min(Math.max(px, py), 0) - radius;

      if (outside > -near || outside < -far) continue;
      const index = (y * width + x) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        const at = index + channel;
        sum += Math.abs(lens[at] - frost[at] - (otherLens[at] - otherFrost[at])) / 3;
      }

      count += 1;
    }
  }

  return Math.round((sum / count) * 100) / 100;
}

// One element's lens against the components' over the bands. The theme's glass
// alone (its tint, light, rims and content hidden) is captured with its lens and
// with only its frost; the components' lens, in the same box with the theme's
// frost and saturation, is captured with its lens and with only its frost. Each
// lens's change to its own frost is compared, from 2 px in. Both frost by the
// components' least, half a pixel, so the comparison sees the bend itself: a
// theme frosts through CSS blur(), which mirrors the glass at its outline, and
// the components through an SVG blur that reads the page beyond it.
async function libraryParity(page, selector, strip, directory, name, themeRim) {
  // A drop-in's engine measured its lens with the theme's frost and the element's split, on
  // its padding box, with the components' rim as wide as the corner, so the comparison keeps
  // that frost and gives the reference the same split, box and rim.
  const engine = await page.evaluate((target) => {
    const element = document.querySelector(target);

    return {
      active: Boolean(element.dataset.glassyEngine),
      dispersion:
        Number.parseFloat(getComputedStyle(element).getPropertyValue('--lg-lens-dispersion')) || 0,
      saturate:
        Number.parseFloat(getComputedStyle(element).getPropertyValue('--lg-lens-saturation')) || 1,
    };
  }, selector);

  const rimWidth = engine.active ? null : themeRim;

  const stripped = await page.addStyleTag({
    content: engine.active ? strip.replace('--glassy-lens-frost: 0.5px !important;', '') : strip,
  });

  await page.waitForTimeout(200);
  const measured = await rimOf(page, selector);
  const rim = rimWidth ? { ...measured, bevel: rimWidth } : measured;
  const file = (label) => path.join(directory, `lens-${name}-${label}.png`);
  const theme = await readPixels(page, rim.clip, file('theme'));
  const off = await page.addStyleTag({ content: lensOffStyle() });
  await page.waitForTimeout(200);
  const themeFrost = await readPixels(page, rim.clip, file('theme-frost'));
  await off.evaluate((node) => node.remove());
  await page.addScriptTag({ content: LIBRARY_LENS_MAP });

  const reference = engine.active
    ? {
        selector,
        rimWidth,
        dispersion: engine.dispersion,
        saturate: engine.saturate,
      }
    : { selector, rimWidth };

  await page.evaluate(placeLibraryLens, { ...reference, frostOnly: false });
  await page.waitForTimeout(200);
  const library = await readPixels(page, rim.clip, file('library'));
  await page.evaluate(placeLibraryLens, { ...reference, frostOnly: true });
  await page.waitForTimeout(200);
  const libraryFrost = await readPixels(page, rim.clip, file('library-frost'));
  await page.evaluate((target) => {
    document.querySelector('#glassy-library-glass')?.remove();
    document.querySelector(target).style.visibility = '';
  }, selector);
  await stripped.evaluate((node) => node.remove());

  return {
    corner: measured.radius,
    bevel: rim.bevel,
    frostOff: regionDifference(themeFrost, libraryFrost, rim, 2, rim.bevel).change,
    lens: regionDifference(library, libraryFrost, rim, 2, rim.bevel).change,
    off: lensDifference(theme, themeFrost, library, libraryFrost, rim, 2, rim.bevel),
  };
}

// The theme's glass alone: no tint, palette light, sheen, rims, shadow or content,
// frosted by half a pixel.
const PANE_ALONE = `[data-check='card'] {
  --card: transparent !important; --glassy-lens-frost: 0.5px !important;
}
[data-check='card'] > * { opacity: 0 !important; }
[data-check='card']::before { background: none !important; box-shadow: none !important; }`;

// A drop-in's glass alone: no gloss, bevel, ring, shadow or content.
const PANE_ALONE_NATIVE = `[data-check='card'] { box-shadow: none !important; }
[data-check='card'] > * { opacity: 0 !important; }
[data-check='card']::before { background: none !important; box-shadow: none !important; }
[data-check='card']::after { display: none !important; }`;

const SLAB_ALONE_NATIVE = `[data-check='button-outline'] {
  box-shadow: none !important; -webkit-text-fill-color: transparent !important;
}
[data-check='button-outline'] svg { visibility: hidden !important; }
[data-check='button-outline']::before { background: none !important; box-shadow: none !important; }
[data-check='button-outline']::after { display: none !important; }`;

const SLAB_ALONE = `[data-check='button-outline'] {
  --glassy-lens-frost: 0.5px !important; --glassy-face: saturate(1) !important;
  background: none !important; box-shadow: none !important; border-color: transparent !important;
  -webkit-text-fill-color: transparent !important;
}
[data-check='button-outline'] svg { visibility: hidden !important; }
[data-check='button-outline']::before {
  background: none !important; backdrop-filter: none !important; box-shadow: none !important;
}
[data-check='button-outline']::after {
  background: none !important; box-shadow: none !important;
}`;

// The lens in Chrome: glass is as frosted at its rim as in its body, so fine
// stripes, moved half a period, change nothing under it; over wide bands the rims
// of a pane and of a slab bend the frosted page, a pane's splitting it into
// colour, while the pane's body stays exactly as it is without the lens; and both match Glassy
// UI's own lens, built from the component library's code. Inside a frosted dialog
// a slab sees only the dialog, which the lens must leave untouched. The captures
// are saved beside the report.
async function lensAssertions(browser, base, fixtureDirectory) {
  const directory = path.join(fixtureDirectory, 'lens');
  fs.mkdirSync(directory, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await load(page, await scenarioUrl(base, SCENARIOS[0]));
  await page.mouse.move(5, 5);
  const pane = await rimOf(page, '[data-check="card"]');
  const slab = await rimOf(page, '[data-check="button-outline"]');

  const capture = async (backdrop, label) => {
    const style = await page.addStyleTag({ content: backdrop });
    await page.waitForTimeout(400);

    const captures = {
      pane: await readPixels(page, pane.clip, path.join(directory, `pane-${label}.png`)),
      slab: await readPixels(page, slab.clip, path.join(directory, `slab-${label}.png`)),
    };

    await style.evaluate((node) => node.remove());

    return captures;
  };

  const stripes = await capture(STRIPES, 'stripes');
  const moved = await capture(STRIPES_MOVED, 'stripes-moved');

  const frost = {
    pane: rimDifference(stripes.pane, moved.pane, pane).change,
    slab: rimDifference(stripes.slab, moved.slab, slab).change,
  };

  check(
    'lens: glass is as frosted at its rim as in its body, so fine stripes blur away to the edge',
    frost.pane <= 4 && frost.slab <= 4,
    frost,
  );

  const lensOn = await capture(BANDS, 'bands');
  const off = await page.addStyleTag({ content: lensOffStyle() });
  const lensOff = await capture(BANDS, 'bands-lens-off');

  const lensOffFilter = await page.evaluate(
    (layer) =>
      getComputedStyle(document.querySelector('[data-check="card"]'), layer).backdropFilter,
    dropins ? '::before' : '::after',
  );

  await off.evaluate((node) => node.remove());
  const paneBend = { ...rimDifference(lensOn.pane, lensOff.pane, pane), lensOffFilter };
  const slabBend = rimDifference(lensOn.slab, lensOff.slab, slab);
  // The body: everything 24 px or more inside the outline.
  const paneBody = regionDifference(lensOn.pane, lensOff.pane, pane, 24, Infinity);

  // A drop-in pane bends as one colour, as slabs do: the split on every card cost frames
  // at dashboard scale.
  check(
    dropins
      ? 'lens: a pane bends the frosted page at its rim'
      : 'lens: a pane bends the frosted page at its rim and splits it into colour',
    paneBend.change >= LENS_BEND && (dropins || paneBend.split >= LENS_SPLIT),
    paneBend,
  );
  check(
    'lens: the frosted body of a pane is the same with and without the lens',
    paneBody.change <= 0.5,
    paneBody,
  );
  // Buttons bend as one colour: a split on every button cost frames.
  check('lens: a slab bends the frosted page at its rim', slabBend.change >= LENS_BEND, slabBend);

  if (!dropins) {
    // Behind a lens the theme frosts as much as the components do (--lg-lens-blur).
    const componentsFrost = Number(
      fs
        .readFileSync(path.join(root, 'registry', 'glassyui', 'styles', 'liquid.css'), 'utf8')
        .match(/--lg-lens-blur:\s*([\d.]+);/)[1],
    );

    const themeFrost = await page.evaluate(() =>
      getComputedStyle(document.querySelector('[data-check="card"]'))
        .getPropertyValue('--glassy-lens-frost')
        .trim(),
    );

    check(
      "lens: the theme frosts behind its lens as much as Glassy UI's components do",
      themeFrost === `${componentsFrost}px`,
      { theme: themeFrost, components: componentsFrost },
    );
  }

  // Within 30% of what the lens itself changes, over the rim. A small button
  // covers few bands, so font metrics can choose an unrepresentative phase.
  // Average its signal and error over a complete stripe cycle; a pane already
  // spans many periods. Every phase must retain the same frost baseline.
  const bands = await page.addStyleTag({ content: BANDS });

  // A card's rim is 14 px, the corner of shadcn's default card, whatever the
  // palette's radius; a button's is half its height, as on the components. A drop-in
  // card's engine draws the components' own rim, as wide as its corner.
  for (const [name, selector, strip, rimWidth] of [
    ['pane', '[data-check="card"]', dropins ? PANE_ALONE_NATIVE : PANE_ALONE, 14],
    ['slab', '[data-check="button-outline"]', dropins ? SLAB_ALONE_NATIVE : SLAB_ALONE, null],
  ]) {
    const phases = name === 'slab' ? [0, 12, 24, 36] : [0];
    const samples = [];

    for (const phase of phases) {
      const shifted = await page.addStyleTag({
        // A 45-degree band's horizontal period is sqrt(2) times its stripe period.
        content: `html body { background-position: ${phase * Math.SQRT2}px 0 !important; }`,
      });

      try {
        samples.push(
          await libraryParity(page, selector, strip, directory, `${name}-${phase}`, rimWidth),
        );
      } finally {
        await shifted.evaluate((node) => node.remove());
      }
    }

    const parity = {
      corner: samples[0].corner,
      bevel: samples[0].bevel,
      frostOff: Math.max(...samples.map((sample) => sample.frostOff)),
      lens: samples.reduce((sum, sample) => sum + sample.lens, 0) / samples.length,
      off: samples.reduce((sum, sample) => sum + sample.off, 0) / samples.length,
      phases: samples,
    };

    check(
      `lens: a ${name}'s glass matches Glassy UI's own lens`,
      parity.frostOff <= 0.5 &&
        parity.lens >= (dropins ? LENS_BEND : 2) &&
        parity.off <= parity.lens * 0.3,
      parity,
    );
  }

  await bands.evaluate((node) => node.remove());

  await load(page, await scenarioUrl(base, SCENARIOS[0], 'dialog'));
  await page.addStyleTag({ content: STRIPES });
  const dialog = page.locator('[data-slot="dialog-content"]');
  await dialog.evaluate((node) =>
    Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
  const insideDialog = await dialog.locator('[data-slot="button"]').first().boundingBox();
  const [innerSlab] = await withAndWithoutLens(page, [insideDialog]);
  // Chromium lays any backdrop filter over a see-through backdrop once more, which
  // brightens a slab in a dialog by about 3 levels with or without the lens; a lens
  // that loses the page's alpha turns the slab grey, 50 levels or more.
  check('lens: a slab inside a frosted dialog keeps its colour', innerSlab.change <= 6, innerSlab);
  await context.close();
}

// WebKit and Firefox draw no SVG filter behind an element, so none of the lens
// may apply there: a pane keeps its frost on the host and a slab keeps the layers
// it had before the lens. Read from computed styles: Playwright's headless WebKit
// draws no backdrop filter at all, and its headless Firefox only some, so their
// screenshots cannot show frost.
async function plainFrostAssertions(engine, base) {
  const name = engine.browserType().name();
  const context = await engine.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await load(page, await scenarioUrl(base, SCENARIOS[0]));

  const layers = await page.evaluate(() => {
    const card = document.querySelector('[data-check="card"]');
    const slab = document.querySelector('[data-check="button-outline"]');

    return {
      chromiumOnlyQuery: CSS.supports('-webkit-app-region', 'drag'),
      pane: getComputedStyle(card).backdropFilter,
      paneBefore: getComputedStyle(card, '::before').backdropFilter,
      paneAfterMask: getComputedStyle(card, '::after').maskImage,
      slabAfter: getComputedStyle(slab, '::after').backdropFilter,
      slabBefore: getComputedStyle(slab, '::before').backdropFilter,
    };
  });

  // Without the lens, the drop-ins' engine stays out of the way.
  if (dropins) {
    const engines = await page.evaluate(
      () => document.querySelectorAll('[data-glassy-engine]').length,
    );

    check(`${name}: the drop-ins run no engine`, engines === 0, { engines });
  }

  if (dropins) {
    check(
      `${name}: no lens applies and the glass frosts`,
      !layers.chromiumOnlyQuery &&
        layers.paneBefore.includes('blur') &&
        !layers.paneBefore.includes('url(') &&
        layers.slabBefore.includes('blur') &&
        !layers.slabBefore.includes('url('),
      layers,
    );
    await context.close();

    return;
  }

  check(
    `${name}: no lens applies and a pane frosts on its host`,
    !layers.chromiumOnlyQuery &&
      layers.pane.includes('blur') &&
      layers.paneBefore === 'none' &&
      layers.paneAfterMask === 'none' &&
      !layers.slabAfter.includes('url(') &&
      layers.slabBefore === 'none',
    layers,
  );

  await context.close();
}

// The guide's images, all from the new-york fixture (the other one is proof
// only): the stock page, the themed page on three backdrops, and an open menu
// over the striped strip.
const GUIDE_SHOTS = [
  { phase: 'stock', scenario: 'plain-light', part: 'overview' },
  { phase: 'glassy', scenario: 'plain-light', part: 'overview' },
  { phase: 'glassy', scenario: 'plain-dark', part: 'overview' },
  { phase: 'glassy', scenario: 'wallpaper-dark', part: 'overview' },
  { phase: 'glassy', scenario: 'wallpaper-light', part: 'menu' },
];

async function exportGuideImages(browser, base, phase) {
  if (!guideImages || current !== report.fixtures['new-york']) return;
  fs.mkdirSync(guideImages, { recursive: true });

  // The kitchen sink is max-w-5xl, so a 1024-pixel viewport holds it edge to edge.
  const context = await browser.newContext({
    viewport: { width: 1024, height: 820 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  for (const shot of GUIDE_SHOTS.filter((candidate) => candidate.phase === phase)) {
    const scenario = SCENARIOS.find((candidate) => candidate.id === shot.scenario);
    await load(page, await scenarioUrl(base, scenario));
    let clip;

    if (shot.part === 'menu') {
      // The picture is the strip and the menu with a margin, whichever way the
      // menu opened.
      const { strip, menu } = await openMenu(page);

      const stripBox = await strip.boundingBox();
      const menuBox = await menu.boundingBox();
      const viewport = page.viewportSize();
      const left = Math.max(0, stripBox.x - 24);
      const top = Math.max(0, Math.min(stripBox.y, menuBox.y) - 24);
      const right = Math.min(viewport.width, stripBox.x + stripBox.width + 24);

      const bottom = Math.min(
        viewport.height,
        Math.max(stripBox.y + stripBox.height, menuBox.y + menuBox.height) + 24,
      );

      clip = { x: left, y: top, width: right - left, height: bottom - top };
    }

    const png = await page.screenshot(clip ? { clip } : {});
    await encodeWebp(
      page,
      png,
      path.join(guideImages, `${shot.phase}-${shot.scenario}-${shot.part}.webp`),
    );
  }

  await context.close();
}

// ---------- main ----------

const temporaryPrefix = path.join(os.tmpdir(), 'glassyui-shadcn-theme-');

fs.mkdirSync(artifactDirectory, { recursive: true });

const registryServer = baselineOnly ? null : await startRegistryServer();

const repositoryCli = shadcnBin(path.resolve(path.dirname(require.resolve('shadcn')), '..'));

const readPayload = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, 'public', 'r', `${name}.json`), 'utf8'));

const browser = installOnly
  ? null
  : await chromium.launch({
      args: ['--disable-updater-scheduler'],
      channel: 'chrome',
      headless: true,
    });

if (browser) report.chrome = browser.version();

const frostEngines =
  baselineOnly || installOnly ? [] : [await webkit.launch(), await firefox.launch()];

report.engines = Object.fromEntries(
  frostEngines.map((engine) => [engine.browserType().name(), engine.version()]),
);

if (browser) report.engines.chromium = report.chrome;

try {
  for (const fixture of FIXTURES) {
    current = report.fixtures[fixture.name] = {
      palette: fixture.palette ?? 'neutral',
      assertions: [],
      failures: 0,
    };
    const fixtureDirectory = path.join(artifactDirectory, fixture.name);
    fs.rmSync(fixtureDirectory, { recursive: true, force: true });
    fs.mkdirSync(fixtureDirectory, { recursive: true });
    const temporaryContainer = fs.mkdtempSync(temporaryPrefix);

    const temporaryRoot = path.join(
      temporaryContainer,
      'fixtures',
      'shadcn-theme-consumer',
      fixture.app,
    );

    if (!temporaryContainer.startsWith(temporaryPrefix))
      throw new Error(`refusing unexpected temporary directory ${temporaryContainer}`);
    console.log(`\n${fixture.name}: ${temporaryRoot}`);
    let app;

    try {
      const sourceFixture = path.join(root, 'fixtures', 'shadcn-theme-consumer', fixture.app);

      fs.cpSync(sourceFixture, temporaryRoot, {
        recursive: true,
        filter: (source) =>
          !['node_modules', '.next'].includes(
            path.relative(sourceFixture, source).split(path.sep)[0],
          ),
      });

      // Keep the fixture's relative reference to the single repository patch.
      fs.mkdirSync(path.join(temporaryContainer, 'patches'));
      fs.copyFileSync(
        path.join(root, 'patches', 'braces@3.0.3.patch'),
        path.join(temporaryContainer, 'patches', 'braces@3.0.3.patch'),
      );

      if (fixture.palette) applyPalette(temporaryRoot, PALETTES[fixture.palette]);
      run('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], temporaryRoot);

      if (fixture.app === 'base-nova') {
        run(
          process.execPath,
          [path.join(root, 'scripts', 'test-braces-security.mjs'), '--fixture', temporaryRoot],
          temporaryRoot,
        );
        check(
          'the installed CLI rejects unsafe glob nesting and cycles',
          true,
          '15 security scenarios passed',
        );
      }

      if (!installOnly) {
        run('pnpm', ['exec', 'next', 'build'], temporaryRoot);
        app = await startApp(temporaryRoot);
        console.log('  baseline');
        current.baseline = await capture(
          browser,
          app.url,
          'baseline',
          path.join(fixtureDirectory, 'baseline'),
        );
        await baselineAssertions(browser, app.url);
        await exportGuideImages(browser, app.url, 'stock');
      }

      // The stock files and page the drop-ins are held to.
      const set = dropins ? dropinSetFor(fixture) : null;

      const stockSources = Object.fromEntries(
        DROPIN_COMPONENTS.map((component) => [
          component,
          fs.readFileSync(path.join(temporaryRoot, 'components', 'ui', `${component}.tsx`), 'utf8'),
        ]),
      );

      if (set) {
        current.set = set.name;
        current.stock = Object.fromEntries(
          Object.entries(stockSources).map(([component, source]) => [
            component,
            { exports: stockExports(source), client: hasClientDirective(source) },
          ]),
        );

        if (!installOnly) current.stockAttributes = await collectDataAttributes(browser, app.url);
      }

      await stopApp(app);
      app = null;

      if (baselineOnly) continue;

      // The docs pin the repository's CLI. A fixture created by a newer CLI is
      // installed with that one as well, from the same stock files; both must
      // write the same bytes and touch nothing but app/globals.css, so the
      // browser checks below hold for either. The fixture's own CLI goes last
      // and its result stays installed.
      const globalsPath = path.join(temporaryRoot, 'app', 'globals.css');
      const stockGlobals = fs.readFileSync(globalsPath, 'utf8');
      const stockFiles = snapshotFiles(temporaryRoot);
      const item = set ? set.name : THEME_ITEM_NAME;
      const payload = readPayload(item);

      // A drop-in set writes the engine and its drop-ins as well as globals.css.
      const expectedChanges = [
        path.join('app', 'globals.css'),
        ...(set ? payload.files.map((file) => file.target) : []),
      ].sort();

      // Each CLI starts from the stock app: its globals.css, its components/ui files, no engine.
      const restoreStock = () => {
        fs.writeFileSync(globalsPath, stockGlobals);

        for (const [component, source] of Object.entries(stockSources)) {
          fs.writeFileSync(
            path.join(temporaryRoot, 'components', 'ui', `${component}.tsx`),
            source,
          );
        }

        fs.rmSync(path.join(temporaryRoot, 'components', 'glassyui'), {
          recursive: true,
          force: true,
        });
      };

      const clis = [repositoryCli];
      const ownCliDirectory = path.join(temporaryRoot, 'node_modules', 'shadcn');

      if (fs.existsSync(ownCliDirectory)) {
        const ownCli = shadcnBin(ownCliDirectory);

        if (ownCli.version !== repositoryCli.version) clis.push(ownCli);
      }

      const installs = [];

      for (const cli of clis) {
        restoreStock();
        console.log(`  installing ${item} with shadcn ${cli.version}`);
        // The registry server lives in this process, so the CLI must not block it.
        await runAsync(
          process.execPath,
          [
            cli.bin,
            'add',
            `${registryServer.url}/r/${item}.json`,
            '--yes',
            ...(set ? ['--overwrite'] : []),
            '--cwd',
            temporaryRoot,
          ],
          temporaryRoot,
        );
        const after = snapshotFiles(temporaryRoot);
        const changed = changedFiles(stockFiles, after);
        installs.push({
          version: cli.version,
          css: fs.readFileSync(globalsPath, 'utf8'),
          changed,
          hashes: changed.map((file) => `${file}:${after[file]}`),
        });
      }

      current.cli = installs.map((install) => install.version);
      const installed = installs.at(-1).css;
      check(
        set
          ? 'each CLI writes app/globals.css, the engine and the drop-ins, and nothing else'
          : 'each CLI changes app/globals.css and nothing else',
        installs.every(
          (install) => JSON.stringify(install.changed) === JSON.stringify(expectedChanges),
        ),
        installs.map((install) => ({ version: install.version, changed: install.changed })),
      );
      check(
        set
          ? 'every CLI version writes the same bytes'
          : 'every CLI version writes the same globals.css',
        installs.every(
          (install) =>
            install.css === installed &&
            JSON.stringify(install.hashes) === JSON.stringify(installs[0].hashes),
        ),
        installs.map((install) => ({
          version: install.version,
          sha256: crypto.createHash('sha256').update(install.css).digest('hex'),
        })),
      );
      fs.writeFileSync(path.join(fixtureDirectory, 'globals.installed.css'), installed);
      const written = themeContribution(installed);
      const expected = expectedContribution(payload);
      check(
        'the CLI wrote exactly the theme item',
        JSON.stringify(written) === JSON.stringify(expected),
        JSON.stringify(written) === JSON.stringify(expected)
          ? 'equal'
          : {
              written: JSON.stringify(written).slice(0, 400),
              expected: JSON.stringify(expected).slice(0, 400),
            },
      );

      if (set) {
        const directives = Object.entries(stockSources).map(([component, source]) => ({
          component,
          stock: hasClientDirective(source),
          dropin: hasClientDirective(
            fs.readFileSync(
              path.join(temporaryRoot, 'components', 'ui', `${component}.tsx`),
              'utf8',
            ),
          ),
        }));

        check(
          "each drop-in keeps its stock file's server or client status",
          directives.every((entry) => entry.stock === entry.dropin),
          directives,
        );
        writeParityGate(temporaryRoot, stockSources, set);
      }

      // With the drop-ins, next build also type-checks the parity gate and builds the
      // Server Component route.
      try {
        // Build the installed snapshot without the stock app's cached CSS.
        if (set) fs.rmSync(path.join(temporaryRoot, '.next'), { recursive: true, force: true });
        run('pnpm', ['exec', 'next', 'build'], temporaryRoot);
      } catch (error) {
        check('the app builds and type-checks', false, String(error).slice(0, 2000));
        continue;
      }

      if (set) check('the drop-ins keep the stock API: the parity gate type-checks', true, 'built');

      if (installOnly) {
        check('the installed app builds and type-checks', true, 'built');
        continue;
      }

      app = await startApp(temporaryRoot);
      console.log('  themed');
      current.themed = await capture(
        browser,
        app.url,
        'themed',
        path.join(fixtureDirectory, 'themed'),
      );
      await themedAssertions(browser, app.url, fixtureDirectory);
      await lensAssertions(browser, app.url, fixtureDirectory);

      if (set) {
        const attributes = await collectDataAttributes(browser, app.url);
        const stock = current.stockAttributes;
        check(
          'the drop-ins keep every stock data-slot, data-variant and data-size',
          keepsStockAttributes(stock.slots, attributes.slots),
          JSON.stringify(attributes.slots) === JSON.stringify(stock.slots)
            ? `${attributes.slots.length} elements`
            : {
                missing: stock.slots.filter((entry) => !attributes.slots.includes(entry)),
                extra: attributes.slots.filter((entry) => !stock.slots.includes(entry)),
              },
        );
        check('the drop-ins add no elements to the page', attributes.elements === stock.elements, {
          stock: stock.elements,
          dropins: attributes.elements,
        });
        await dropinAssertions(browser, app.url);
      }

      for (const engine of frostEngines) await plainFrostAssertions(engine, app.url);

      await exportGuideImages(browser, app.url, 'glassy');
    } finally {
      await stopApp(app);
      fs.rmSync(temporaryContainer, { recursive: true, force: true });
    }
  }
} finally {
  await browser?.close();

  for (const engine of frostEngines) await engine.close();

  registryServer?.server.close();
}

report.finishedAt = new Date().toISOString();

const failures = Object.values(report.fixtures).reduce((sum, fixture) => sum + fixture.failures, 0);

report.status = failures === 0 ? 'pass' : 'fail';

fs.writeFileSync(
  path.join(artifactDirectory, 'report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);

for (const [name, fixture] of Object.entries(report.fixtures)) {
  console.log(
    `${name}: ${fixture.assertions.length - fixture.failures}/${fixture.assertions.length} assertions passed`,
  );
}

console.log(`report: ${path.relative(root, path.join(artifactDirectory, 'report.json'))}`);

if (failures > 0) process.exit(1);
