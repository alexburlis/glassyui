import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { chromium, firefox, webkit } from 'playwright';
import { checkConsumerCommand } from './check-consumer-command.mjs';
import { checkConsumerTransparency } from './check-consumer-transparency.mjs';

// Read the picture the installed consumer actually paints, without a renderer test hook.
async function readPicture(page, buffer) {
  return page.evaluate(
    async (png) => {
      const image = new Image();
      image.src = png;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      const stripe = [];
      let clipped = 0;

      for (let x = 0; x < canvas.width; x++) {
        let weight = 0;
        let centre = 0;

        for (let y = 0; y < canvas.height; y++) {
          const at = (y * canvas.width + x) * 4;
          const [r, g, b] = data.slice(at, at + 3);

          if (
            // A screenshot rounds fractional figure bounds up; its final pixel
            // can belong to the page background, outside the component.
            x > 0 &&
            x < canvas.width - 1 &&
            y > 0 &&
            y < canvas.height - 1 &&
            (x < 4 || x >= canvas.width - 4 || y < 4 || y >= canvas.height - 4) &&
            r + g + b < 300
          )
            clipped++;

          if (g - r > 25 && g - b > 25) {
            const amount = g - Math.max(r, b);
            weight += amount;
            centre += y * amount;
          }
        }

        if (weight > 100) stripe.push({ x, y: centre / weight });
      }

      const n = stripe.length;
      const sx = stripe.reduce((sum, p) => sum + p.x, 0);
      const sy = stripe.reduce((sum, p) => sum + p.y, 0);
      const sxx = stripe.reduce((sum, p) => sum + p.x * p.x, 0);
      const sxy = stripe.reduce((sum, p) => sum + p.x * p.y, 0);
      const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
      const intercept = (sy - slope * sx) / n;

      const residual = Math.sqrt(
        stripe.reduce((sum, p) => sum + (p.y - slope * p.x - intercept) ** 2, 0) / n,
      );

      return { columns: n, residual, clipped };
    },
    `data:image/png;base64,${buffer.toString('base64')}`,
  );
}

async function pictureDifference(page, before, after) {
  return page.evaluate(
    async (pictures) => {
      const images = await Promise.all(
        pictures.map(async (src) => {
          const image = new Image();
          image.src = src;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0);

          return context.getImageData(0, 0, canvas.width, canvas.height).data;
        }),
      );

      if (images[0].length !== images[1].length) throw new Error('Pose screenshots changed size.');
      let difference = 0;

      for (let index = 0; index < images[0].length; index++)
        difference += Math.abs(images[0][index] - images[1][index]);

      return difference / images[0].length;
    },
    [before, after].map((buffer) => `data:image/png;base64,${buffer.toString('base64')}`),
  );
}

const nextPaint = (page) =>
  page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );

// --install-only keeps real CLI, dependency, source and production-build contracts;
// the default also exercises the installed consumer in all three browsers.
const argv = process.argv.slice(2);

const installOnly = argv.includes('--install-only');

const positional = argv.filter((argument) => argument !== '--install-only');

const baseUrl = positional[0];

const artifactDirectory = path.resolve(positional[1] ?? '.artifacts/prelaunch/registry-install');

fs.mkdirSync(artifactDirectory, { recursive: true });

if (!baseUrl) {
  console.error(
    'Usage: node scripts/smoke-registry-install.mjs <base-url> [artifact-dir] [--install-only]',
  );
  process.exit(1);
}

const require = createRequire(import.meta.url);

let shadcnPackage;

try {
  shadcnPackage = path.resolve(path.dirname(require.resolve('shadcn')), '..', 'package.json');
} catch {
  console.error(
    'ERROR: registry-install smoke requires the pinned local shadcn CLI (shadcn@4.14.1). Run pnpm install before this release gate.',
  );
  process.exit(1);
}

const shadcnManifest = JSON.parse(fs.readFileSync(shadcnPackage, 'utf8'));

assert.equal(shadcnManifest.name, 'shadcn', `resolved unexpected CLI package at ${shadcnPackage}`);

assert.equal(
  shadcnManifest.version,
  '4.14.1',
  `expected pinned shadcn 4.14.1, found ${shadcnManifest.version}`,
);

// The pinned 4.14.1 manifest declares its one entrypoint as a bin string.
const binRelativePath = shadcnManifest.bin;

assert.match(
  binRelativePath,
  /^\.\/.+\.js$/,
  'pinned shadcn package must expose a shadcn bin entrypoint',
);

const shadcnBin = path.resolve(path.dirname(shadcnPackage), binRelativePath);

assert.ok(
  path.isAbsolute(shadcnBin),
  'pinned shadcn bin entrypoint must resolve to an absolute path',
);

assert.ok(fs.statSync(shadcnBin).isFile(), `pinned shadcn bin is not a file: ${shadcnBin}`);

const root = process.cwd();

const fixture = path.join(root, 'fixtures/shadcn-consumer');

const fixtureManifest = JSON.parse(fs.readFileSync(path.join(fixture, 'package.json'), 'utf8'));

const fixtureDependencies = { ...fixtureManifest.dependencies };

// This is a deliberately hand-derived v0.1 install contract for the public
// dialog closure, installed into the clean fixture. It must not be inferred from
// the live registry payload being installed, or a bad payload could teach this
// smoke to accept its own drift.
const expectedDialogDependencies = ['@radix-ui/react-dialog', 'clsx'];

// A clean dialog install must include the slab helper used by glass-surface.
// Omitting it from the registry closure breaks consumer imports. The existing
// exact-set assertions own this install boundary; no runtime test hook is needed.
const expectedDialogFiles = [
  'components/glassyui/glass-dialog.tsx',
  'components/glassyui/glass-panel.tsx',
  'components/glassyui/glass-surface.tsx',
  'components/glassyui/glass-provider.tsx',
  'components/glassyui/liquid-filters.tsx',
  'components/glassyui/lib/preferences.ts',
  'components/glassyui/styles/liquid.css',
  'components/glassyui/lib/merge-refs.ts',
  'components/glassyui/lib/refraction-map.ts',
  'components/glassyui/lib/slab-optics.ts',
  'components/glassyui/lib/use-refraction-filter.tsx',
  'components/glassyui/lib/scene-context.ts',
];

// The rest of the library, added on top of the dialog. Also hand-derived, from
// each component's imports rather than from the payload being installed.
const remainingItems = [
  'glass-accordion',
  'glass-alert',
  'glass-avatar',
  'glass-badge',
  'glass-breadcrumb',
  'glass-button',
  'glass-checkbox',
  'glass-command',
  'glass-dock',
  'glass-header',
  'glass-input',
  'glass-kbd',
  'glass-laptop',
  'glass-lens',
  'glass-logo-reveal',
  'glass-menu',
  'glass-pagination',
  'glass-phone-duo',
  'glass-popover',
  'glass-progress',
  'glass-radio-group',
  'glass-scene',
  'glass-scroll-area',
  'glass-segmented-control',
  'glass-select',
  'glass-sheet',
  'glass-skeleton',
  'glass-slider',
  'glass-spinner',
  'glass-switch',
  'glass-tabs',
  'glass-textarea',
  'glass-toast',
  'glass-tooltip',
];

const expectedLibraryDependencies = [
  '@radix-ui/react-accordion',
  '@radix-ui/react-avatar',
  '@radix-ui/react-checkbox',
  '@radix-ui/react-dialog',
  '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-popover',
  '@radix-ui/react-radio-group',
  '@radix-ui/react-scroll-area',
  '@radix-ui/react-select',
  '@radix-ui/react-slider',
  '@radix-ui/react-slot',
  '@radix-ui/react-switch',
  '@radix-ui/react-tabs',
  '@radix-ui/react-toast',
  '@radix-ui/react-tooltip',
  'clsx',
  'cmdk',
];

const expectedLibraryFiles = [
  ...new Set([
    ...expectedDialogFiles,
    ...remainingItems.map((name) => `components/glassyui/${name}.tsx`),
    // The motion springs behind the controls and the scene, and the scene's renderer.
    'components/glassyui/lib/liquid-motion.ts',
    'components/glassyui/lib/scene-renderer.ts',
    'components/glassyui/lib/phone-duo-renderer.ts',
    'components/glassyui/lib/logo-reveal-renderer.ts',
    // The laptop's own stylesheet.
    'components/glassyui/styles/laptop.css',
    'components/glassyui/styles/header.css',
    'components/glassyui/styles/phone-duo.css',
    'components/glassyui/styles/logo-reveal.css',
  ]),
];

for (const dependency of expectedLibraryDependencies) {
  assert.equal(
    fixtureDependencies[dependency],
    undefined,
    `fixture must begin without ${dependency}`,
  );
}

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'glassyui-shadcn-consumer-'));

const auxiliaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'glassyui-install-methods-'));

const expectedPrefix = path.join(os.tmpdir(), 'glassyui-shadcn-consumer-');

if (!temporaryRoot.startsWith(expectedPrefix))
  throw new Error(`refusing to clean unexpected temporary directory ${temporaryRoot}`);

const report = {
  baseUrl,
  mode: installOnly ? 'install-only' : 'full',
  shadcn: shadcnManifest.version,
  status: 'running',
  scratch: {
    consumer: temporaryRoot,
    methods: auxiliaryRoot,
    purpose:
      'Disposable clean web consumers from fixtures/shadcn-consumer and the served registry.',
  },
  browsers: [],
};

fs.writeFileSync(
  path.join(artifactDirectory, 'report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);

function run(command, args, cwd = temporaryRoot) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.status})\n${result.stdout}\n${result.stderr}`,
    );

  return `${result.stdout}\n${result.stderr}`.trim();
}

function listFiles(directory, prefix = '') {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(prefix, entry.name);

    return entry.isDirectory()
      ? listFiles(path.join(directory, entry.name), relativePath)
      : [relativePath];
  });
}

function assertExactSet(label, actual, expected) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), `${label} differs`);
}

async function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();

      // A TCP listener reports an address object; anything else has no port.
      if (!address?.port) {
        probe.close();
        reject(new Error('Could not resolve an available loopback port'));

        return;
      }

      probe.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

async function waitForServer(url, child, getOutput) {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`installed consumer server exited early (${child.exitCode})\n${getOutput()}`);
    }

    try {
      const response = await fetch(url);

      if (response.ok) return;
    } catch {
      // The child has not bound its loopback port yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`installed consumer server did not become ready\n${getOutput()}`);
}

// Reads a consumer-tinted material, then the same material with Reduce
// Transparency on. The preference guard must beat the consumer utility.
function readGuardedMaterial(node, { pseudo, tint }) {
  const root = document.documentElement;
  const sample = document.createElement('div');
  sample.className = tint;
  document.body.append(sample);
  const expectedTint = getComputedStyle(sample).backgroundColor;
  const tinted = getComputedStyle(node, pseudo).backgroundColor;
  root.setAttribute('data-lg-reduce-transparency', '1');
  sample.className = '';
  sample.style.backgroundColor = getComputedStyle(root).getPropertyValue('--lg-opaque-surface');
  const opaqueSurface = getComputedStyle(sample).backgroundColor;
  const guarded = getComputedStyle(node, pseudo);

  const result = {
    backdrop: guarded.backdropFilter,
    background: guarded.backgroundColor,
    expectedTint,
    opaqueSurface,
    tinted,
  };

  sample.remove();
  root.removeAttribute('data-lg-reduce-transparency');

  return result;
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

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

let fixtureServer;

let browser;

async function startConsumer() {
  const port = await getAvailablePort();
  const url = `http://127.0.0.1:${port}`;
  let output = '';
  fixtureServer = spawn('pnpm', ['exec', 'next', 'start', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: temporaryRoot,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const capture = (chunk) => {
    output = `${output}${chunk}`.slice(-20_000);
  };

  fixtureServer.stdout.on('data', capture);
  fixtureServer.stderr.on('data', capture);
  await waitForServer(url, fixtureServer, () => output);

  return url;
}

async function captureDisplayedExamples() {
  let page;

  if (!installOnly) {
    browser = await chromium.launch({
      args: ['--disable-updater-scheduler'],
      channel: 'chrome',
      headless: true,
    });
    page = await browser.newPage();
  }

  const directory = path.join(temporaryRoot, 'components', 'examples');
  fs.mkdirSync(directory, { recursive: true });

  for (const name of ['scene', 'lens', 'dock']) {
    const url = `${baseUrl.replace(/\/$/, '')}/components/glass-${name}`;
    let source;

    if (installOnly) {
      // These are the real served examples, compiled in the clean consumer below.
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        // Synchronous CLI installs below can outlive the server's idle socket timeout.
        headers: { Connection: 'close' },
      });

      assert.equal(response.status, 200, `${name} documentation must resolve`);
      const { JSDOM } = await import('jsdom');
      const dom = new JSDOM(await response.text());

      try {
        source = dom.window.document.querySelector('#usage .docs-code-block pre code')?.textContent;
        assert.ok(source, `${name} documentation must contain its usage example`);
      } finally {
        dom.window.close();
      }
    } else {
      const response = await page.goto(url, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, `${name} documentation must resolve`);
      source = await page.locator('#usage .docs-code-block pre code').first().innerText();
    }

    assert.match(source, /@\/components\/glassyui\//, `${name} example needs installed imports`);
    fs.writeFileSync(path.join(directory, `${name}-example.tsx`), source);
    fs.writeFileSync(path.join(artifactDirectory, `${name}-example.tsx`), source);
  }

  await browser?.close();
  browser = undefined;
}

async function checkNpmAndManualButton() {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/r/glass-button.json`);
  assert.equal(response.status, 200, 'button Manual source must load');
  const payload = await response.json();
  assert.equal(payload.registryDependencies, undefined, 'button payload needs no registry mapping');
  // A fixed button contract catches missing source while content is checked against the real source.
  assert.equal(payload.files.length, 10, 'button must include its provider closure');
  const report = { npm: {}, manual: {}, namespaceCompatibility: true, pnpmUrlInstall: true };

  for (const method of ['npm', 'manual']) {
    const directory = path.join(auxiliaryRoot, method);
    fs.mkdirSync(path.join(directory, 'app'), { recursive: true });

    for (const file of [
      'package.json',
      'components.json',
      'tsconfig.json',
      'postcss.config.mjs',
      'app/globals.css',
      'app/layout.tsx',
    ])
      fs.copyFileSync(path.join(fixture, file), path.join(directory, file));
    const configPath = path.join(directory, 'components.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.registries = {};
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    fs.writeFileSync(
      path.join(directory, 'app/page.tsx'),
      `import { GlassButton } from '@/components/glassyui/glass-button';\nimport { GlassProvider } from '@/components/glassyui/glass-provider';\nexport default function Page() { return <GlassProvider><GlassButton>Installed button</GlassButton></GlassProvider>; }\n`,
    );
    run('npm', ['install', '--no-audit', '--no-fund'], directory);

    if (method === 'npm') {
      run(
        'npx',
        [
          '--yes',
          'shadcn@4.14.1',
          'add',
          `${baseUrl.replace(/\/$/, '')}/r/glass-button.json`,
          '--yes',
        ],
        directory,
      );
    } else {
      run('npm', ['install', '--no-audit', '--no-fund', ...payload.dependencies], directory);

      for (const file of payload.files) {
        assert.equal(
          file.content,
          fs.readFileSync(path.join(root, file.path), 'utf8'),
          `Manual source differs: ${file.target}`,
        );
        const target = path.resolve(directory, file.target);
        assert.ok(target.startsWith(`${directory}${path.sep}`), 'Manual target escaped consumer');
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.content);
      }
    }

    const actual = listFiles(path.join(directory, 'components/glassyui'), 'components/glassyui');
    assertExactSet(
      `${method} button closure`,
      actual,
      payload.files.map((file) => file.target),
    );

    const installedManifest = JSON.parse(
      fs.readFileSync(path.join(directory, 'package.json'), 'utf8'),
    );

    for (const dependency of ['@radix-ui/react-slot', 'clsx'])
      assert.ok(installedManifest.dependencies[dependency], `${method} omitted ${dependency}`);
    run('npm', ['run', 'build'], directory);
    report[method] = {
      files: Object.fromEntries(
        actual.map((file) => [
          file,
          createHash('sha256')
            .update(fs.readFileSync(path.join(directory, file)))
            .digest('hex'),
        ]),
      ),
      packages: payload.dependencies,
      build: 'passed',
    };
  }

  const imports = (source) =>
    [...source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g)]
      .map((match) => match[1])
      .sort();

  for (const file of payload.files.filter((file) => /\.tsx?$/.test(file.target)))
    assert.deepEqual(
      imports(fs.readFileSync(path.join(auxiliaryRoot, 'npm', file.target), 'utf8')),
      imports(fs.readFileSync(path.join(auxiliaryRoot, 'manual', file.target), 'utf8')),
      `Manual import graph differs from CLI: ${file.target}`,
    );
  fs.writeFileSync(
    path.join(artifactDirectory, 'installation-methods.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}

try {
  fs.cpSync(fixture, temporaryRoot, { recursive: true });
  const configPath = path.join(temporaryRoot, 'components.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.registries = {}; // The primary workflow must not inherit the fixture's optional mapping.
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

  await captureDisplayedExamples();

  const beforeManifest = JSON.parse(
    fs.readFileSync(path.join(temporaryRoot, 'package.json'), 'utf8'),
  );

  const beforeDependencies = { ...beforeManifest.dependencies };

  const beforeInstalledFiles = listFiles(
    path.join(temporaryRoot, 'components', 'glassyui'),
    'components/glassyui',
  );

  run('pnpm', ['install', '--ignore-scripts']);
  const versionOutput = run(process.execPath, [shadcnBin, '--version']);
  assert.match(
    versionOutput,
    /4\.14\.1/,
    `absolute shadcn CLI did not report version 4.14.1: ${versionOutput}`,
  );
  run('pnpm', [
    'dlx',
    'shadcn@4.14.1',
    'add',
    `${baseUrl.replace(/\/$/, '')}/r/glass-dialog.json`,
    '--yes',
  ]);

  const installed = JSON.parse(fs.readFileSync(path.join(temporaryRoot, 'package.json'), 'utf8'));
  const installedDependencies = installed.dependencies ?? {};

  const addedDependencies = Object.keys(installedDependencies).filter(
    (name) => !(name in beforeDependencies),
  );

  assertExactSet('added runtime dependencies', addedDependencies, expectedDialogDependencies);
  assertExactSet('runtime dependency names after install', Object.keys(installedDependencies), [
    ...Object.keys(beforeDependencies),
    ...expectedDialogDependencies,
  ]);

  for (const [name, version] of Object.entries(beforeDependencies)) {
    assert.equal(
      installedDependencies[name],
      version,
      `installer changed existing dependency ${name}`,
    );
  }

  assert.deepEqual(
    installed.devDependencies ?? {},
    beforeManifest.devDependencies ?? {},
    'installer changed fixture devDependencies',
  );

  const installedFiles = listFiles(
    path.join(temporaryRoot, 'components', 'glassyui'),
    'components/glassyui',
  );

  assertExactSet(
    'new installed Glassy UI files',
    installedFiles.filter((file) => !beforeInstalledFiles.includes(file)),
    expectedDialogFiles,
  );
  assertExactSet('installed Glassy UI file closure', installedFiles, expectedDialogFiles);

  run(process.execPath, [
    shadcnBin,
    'add',
    ...remainingItems.map((name) => `${baseUrl.replace(/\/$/, '')}/r/${name}.json`),
    '--yes',
  ]);
  const library = JSON.parse(fs.readFileSync(path.join(temporaryRoot, 'package.json'), 'utf8'));
  const libraryDependencies = library.dependencies ?? {};
  assertExactSet(
    'runtime dependency names after the full library install',
    Object.keys(libraryDependencies),
    [...Object.keys(fixtureDependencies), ...expectedLibraryDependencies],
  );

  for (const [name, version] of Object.entries(installedDependencies)) {
    assert.equal(
      libraryDependencies[name],
      version,
      `full library install changed dependency ${name}`,
    );
  }

  assert.deepEqual(
    library.devDependencies ?? {},
    beforeManifest.devDependencies ?? {},
    'full library install changed fixture devDependencies',
  );
  assertExactSet(
    'full library file closure',
    listFiles(path.join(temporaryRoot, 'components', 'glassyui'), 'components/glassyui'),
    expectedLibraryFiles,
  );

  // Existing configured namespace users resolve to the same complete URL and unchanged bytes.
  const beforeCompatibility = Object.fromEntries(
    expectedLibraryFiles.map((file) => [
      file,
      fs.readFileSync(path.join(temporaryRoot, file), 'utf8'),
    ]),
  );

  config.registries = { '@glassyui': `${baseUrl.replace(/\/$/, '')}/r/{name}.json` };
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  run(process.execPath, [shadcnBin, 'add', '@glassyui/glass-dialog', '--yes']);

  for (const file of expectedLibraryFiles)
    assert.equal(
      fs.readFileSync(path.join(temporaryRoot, file), 'utf8'),
      beforeCompatibility[file],
      `namespace compatibility changed ${file}`,
    );

  report.primary = {
    packageManager: 'pnpm',
    urlWithoutMapping: true,
    namespaceCompatibility: true,
    files: expectedLibraryFiles,
    packages: expectedLibraryDependencies,
  };
  await checkNpmAndManualButton();
  report.installationMethods = 'installation-methods.json';
  // next build type-checks every installed file, not only the ones the page imports.
  run('pnpm', ['build']);
  const nextStaticDirectory = path.join(temporaryRoot, '.next', 'static');

  const cssAssets = listFiles(nextStaticDirectory)
    .filter((relativePath) => relativePath.endsWith('.css'))
    .map((relativePath) => fs.readFileSync(path.join(nextStaticDirectory, relativePath), 'utf8'));

  const liquidCssSentinel = '--lg-refraction-blur-a';
  assert.ok(
    cssAssets.some((css) => css.includes(liquidCssSentinel)),
    `built consumer CSS is missing the installed liquid.css sentinel ${liquidCssSentinel}`,
  );

  report.build = 'passed';
  const fixtureUrl = installOnly ? null : await startConsumer();

  const browserTypes = installOnly
    ? []
    : [
        ['Chromium', chromium],
        ['Firefox', firefox],
        ['WebKit', webkit],
      ];

  for (const [browserName, browserType] of browserTypes) {
    browser = await browserType.launch(
      browserName === 'Chromium'
        ? { args: ['--disable-updater-scheduler'], channel: 'chrome', headless: true }
        : { headless: true },
    );
    const contractFailures = [];

    if (browserName === 'Chromium') {
      try {
        await checkConsumerTransparency(browser, fixtureUrl, artifactDirectory);
      } catch (error) {
        contractFailures.push(error);
      }
    }

    try {
      await checkConsumerCommand(browser, fixtureUrl, artifactDirectory, browserName.toLowerCase());
    } catch (error) {
      contractFailures.push(error);
    }

    if (contractFailures.length) {
      const messages = contractFailures.map((error) => error.message);
      fs.writeFileSync(
        path.join(artifactDirectory, 'consumer-contract-failures.json'),
        `${JSON.stringify({ browserName, messages }, null, 2)}\n`,
      );
      throw new AggregateError(contractFailures, messages.join('\n'));
    }

    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const runtimeErrors = [];
    const graphicsMessages = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'warning' || message.type() === 'error')
        graphicsMessages.push(message.text());
    });
    await page.addInitScript(() => {
      window.addEventListener(
        'webglcontextcreationerror',
        (event) => console.error(`WebGL context creation failed: ${event.statusMessage}`),
        true,
      );
    });
    await page.goto(fixtureUrl, { waitUntil: 'networkidle' });
    fs.writeFileSync(
      path.join(artifactDirectory, `${browserName.toLowerCase()}-graphics.json`),
      `${JSON.stringify({ browserName, graphicsMessages, runtimeErrors }, null, 2)}\n`,
    );

    for (const name of ['scene', 'lens', 'dock', 'header'])
      assert.ok(
        await page.locator(`[data-installed-example="${name}"]`).isVisible(),
        `${browserName}: copied ${name} source must render`,
      );

    // A straight line in the source stays straight while the glass lifts above it.
    // This catches screen UVs rotating with the leaf, not just whether a canvas exists.
    const duo = page.locator('[data-installed-example="phone-duo"]');
    const figure = duo.getByRole('img');
    await duo.getByRole('img', { name: 'Inner app screenshot', exact: true }).waitFor();
    assert.equal(await figure.count(), 1, 'Both displays have one accessible description');
    assert.ok(
      await duo
        .locator('img')
        .evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)),
      `${browserName}: consumer screenshots must load`,
    );

    const openPicture = await figure.screenshot({
      path: path.join(artifactDirectory, `installed-phone-duo-${browserName}-open.png`),
    });

    await duo.getByRole('button', { name: 'Pose hinge' }).click();
    await nextPaint(page);

    const partialPicture = await figure.screenshot({
      path: path.join(artifactDirectory, `installed-phone-duo-${browserName}-folding.png`),
    });

    const partial = await readPicture(page, partialPicture);
    assert.ok(partial.columns > 60, `${browserName}: the lifted glass must show the source stripe`);
    assert.ok(
      partial.residual < 1.6,
      `${browserName}: flat screen content bends across the hinge (${partial.residual.toFixed(2)}px)`,
    );
    assert.equal(partial.clipped, 0, `${browserName}: the lifted frame clips at its canvas edge`);
    await duo.getByRole('button', { name: 'Close phone' }).click();
    await duo.getByRole('img', { name: 'Outer app screenshot', exact: true }).waitFor();
    await page.waitForTimeout(1500);

    const closedPicture = await figure.screenshot({
      path: path.join(artifactDirectory, `installed-phone-duo-${browserName}-closed.png`),
    });

    assert.ok(
      (await pictureDifference(page, partialPicture, closedPicture)) > 3,
      `${browserName}: closing must change the visible pose`,
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await duo.getByRole('button', { name: 'Open phone' }).click();
    await nextPaint(page);
    assert.ok(
      (await pictureDifference(page, openPicture, await figure.screenshot())) < 0.6,
      `${browserName}: reduced motion must open directly to the resting picture`,
    );
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => document.documentElement.setAttribute('data-lg-reduce-motion', '1'));
    await duo.getByRole('button', { name: 'Close phone' }).click();
    await nextPaint(page);
    assert.ok(
      (await pictureDifference(page, closedPicture, await figure.screenshot())) < 0.6,
      `${browserName}: the site preference must close directly to the resting picture`,
    );
    await duo.getByRole('button', { name: 'Open phone' }).click();
    await nextPaint(page);

    for (const width of [390, 800]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${browserName}: the installed duo must fit at ${width}px`,
      );

      const responsive = await figure.screenshot({
        path: path.join(artifactDirectory, `installed-phone-duo-${browserName}-${width}.png`),
      });

      assert.equal(
        (await readPicture(page, responsive)).clipped,
        0,
        `${browserName}: frame padding must survive at ${width}px`,
      );
    }

    await page.evaluate(() => document.documentElement.removeAttribute('data-lg-reduce-motion'));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 800, height: 600 });

    // The reveal plays on its own and lands exactly on the mark the page laid out: its
    // canvas's last frame and the real mark make the same picture.
    const reveal = page.locator('[data-installed-example="logo-reveal"]');
    const sting = reveal.locator('.lg-logo-reveal');
    const replay = reveal.getByRole('button', { name: 'Replay reveal', exact: true });

    await reveal
      .getByRole('img', { name: 'Installed reveal', exact: true })
      .scrollIntoViewIfNeeded();
    await replay.click();
    await reveal.locator('.lg-logo-reveal[data-state="playing"]').waitFor();
    assert.equal(
      await sting.getAttribute('data-renderer'),
      'webgl',
      `${browserName}: the reveal must draw with WebGL2`,
    );
    await page.waitForTimeout(450);

    const moving = await sting.screenshot({
      path: path.join(artifactDirectory, `installed-logo-reveal-${browserName}-moving.png`),
    });

    await reveal.locator('.lg-logo-reveal[data-state="ended"]').waitFor({ timeout: 5000 });

    const canvasOnly = await page.addStyleTag({
      content:
        '.lg-logo-reveal-canvas { opacity: 1 !important; transition: none !important; } .lg-logo-reveal-mark { visibility: hidden !important; }',
    });

    await nextPaint(page);

    const lastFrame = await sting.screenshot({
      path: path.join(artifactDirectory, `installed-logo-reveal-${browserName}-last-frame.png`),
    });

    await canvasOnly.evaluate((node) => node.remove());
    await page.waitForTimeout(400);

    const lockup = await sting.screenshot({
      path: path.join(artifactDirectory, `installed-logo-reveal-${browserName}-lockup.png`),
    });

    assert.ok(
      (await pictureDifference(page, moving, lockup)) > 2,
      `${browserName}: the reveal must move before it lands`,
    );

    const landing = await pictureDifference(page, lastFrame, lockup);

    assert.ok(
      landing < 0.6,
      `${browserName}: the last frame must land on the real mark (${landing.toFixed(2)})`,
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await replay.click();
    await nextPaint(page);
    assert.equal(
      await sting.getAttribute('data-state'),
      'ended',
      `${browserName}: reduced motion must show the mark at once`,
    );
    assert.ok(
      (await pictureDifference(page, lockup, await sting.screenshot())) < 0.6,
      `${browserName}: reduced motion must show the same mark`,
    );
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => document.documentElement.setAttribute('data-lg-reduce-motion', '1'));
    await replay.click();
    await nextPaint(page);
    assert.equal(
      await sting.getAttribute('data-state'),
      'ended',
      `${browserName}: the site preference must show the mark at once`,
    );
    await page.evaluate(() => document.documentElement.removeAttribute('data-lg-reduce-motion'));
    assert.deepEqual(runtimeErrors, [], `${browserName}: installed examples must not throw`);

    const installedHeader = page.locator('[data-installed-example="header"]');
    await installedHeader.locator('summary').click();
    await installedHeader.getByRole('link', { name: 'Installed components', exact: true }).click();
    assert.equal(
      await installedHeader.locator('details').getAttribute('open'),
      null,
      `${browserName}: the installed header menu must close after choosing a link`,
    );
    assert.equal(new URL(page.url()).hash, '#installed-components');

    // Library defaults sit in the components layer, so consumer utilities must
    // win regardless of stylesheet order.
    const override = await page.getByTestId('consumer-override').evaluate((node) => {
      const style = getComputedStyle(node);

      return { paddingLeft: style.paddingLeft, radius: style.borderTopLeftRadius };
    });

    assert.equal(
      override.paddingLeft,
      '16px',
      `${browserName}: consumer p-4 must override the panel padding`,
    );
    assert.equal(
      override.radius,
      '0px',
      `${browserName}: consumer rounded-none must override the panel radius`,
    );

    const frost = await page
      .getByTestId('consumer-override')
      .evaluate(readGuardedMaterial, { pseudo: '::before', tint: 'bg-sky-500/30' });

    assert.equal(
      frost.tinted,
      frost.expectedTint,
      `${browserName}: consumer before:bg-sky-500/30 must tint the panel frost`,
    );
    assert.equal(
      frost.background,
      frost.opaqueSurface,
      `${browserName}: Reduce Transparency must beat the consumer frost tint`,
    );
    assert.equal(
      frost.backdrop,
      'none',
      `${browserName}: Reduce Transparency must remove the panel blur`,
    );

    const trigger = page.getByRole('button', { name: 'Open installed dialog' });
    await trigger.focus();
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Installed Glassy UI dialog' });
    await dialog.waitFor({ state: 'visible' });
    // Measure the dialog where it lands, not partway through its entrance.
    await dialog.evaluate((node) =>
      Promise.all(node.getAnimations().map((animation) => animation.finished)),
    );

    const layout = await dialog.evaluate((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const overlay = document.querySelector('.lg-dialog-overlay');
      const overlayStyle = overlay ? getComputedStyle(overlay) : null;
      const close = node.querySelector('button[aria-label="Close dialog"]');
      const closeStyle = close ? getComputedStyle(close) : null;

      return {
        bottom: rect.bottom,
        boxSizing: style.boxSizing,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        left: rect.left,
        maxWidth: style.maxWidth,
        overlayBackdrop: overlayStyle?.backdropFilter,
        overlayPosition: overlayStyle?.position,
        paddingLeft: style.paddingLeft,
        position: style.position,
        right: rect.right,
        top: rect.top,
        translate: style.translate,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        zIndex: style.zIndex,
        closeHeight: closeStyle?.height,
        closePosition: closeStyle?.position,
        closeWidth: closeStyle?.width,
      };
    });

    assert.equal(layout.position, 'fixed', `${browserName}: installed dialog must be fixed`);
    assert.equal(
      layout.boxSizing,
      'border-box',
      `${browserName}: Tailwind preflight must own installed dialog sizing`,
    );
    assert.equal(
      layout.maxWidth,
      '520px',
      `${browserName}: installed dialog must keep its 520px max-width`,
    );
    assert.equal(
      layout.paddingLeft,
      '32px',
      `${browserName}: installed dialog must use its wide-viewport padding`,
    );
    assert.equal(layout.zIndex, '50', `${browserName}: installed dialog must stack at z-index 50`);
    assert.notEqual(
      layout.translate,
      'none',
      `${browserName}: installed dialog must be translated to center`,
    );
    assert.ok(
      Math.abs(layout.centerX - layout.viewportWidth / 2) <= 1,
      `${browserName}: installed dialog must be horizontally centered`,
    );
    assert.ok(
      Math.abs(layout.centerY - layout.viewportHeight / 2) <= 1,
      `${browserName}: installed dialog must be vertically centered`,
    );
    assert.ok(
      layout.left >= 0 &&
        layout.top >= 0 &&
        layout.right <= layout.viewportWidth &&
        layout.bottom <= layout.viewportHeight,
      `${browserName}: installed dialog must remain inside the viewport`,
    );
    assert.equal(
      layout.overlayPosition,
      'fixed',
      `${browserName}: installed dialog overlay must be fixed`,
    );
    assert.notEqual(
      layout.overlayBackdrop,
      'none',
      `${browserName}: installed dialog overlay must blur the page`,
    );
    assert.equal(
      layout.closePosition,
      'absolute',
      `${browserName}: installed dialog close positioning utility must compile`,
    );
    assert.equal(
      layout.closeWidth,
      '36px',
      `${browserName}: installed dialog close width utility must compile`,
    );
    assert.equal(
      layout.closeHeight,
      '36px',
      `${browserName}: installed dialog close height utility must compile`,
    );

    const overlayMaterial = await dialog.evaluate(readGuardedMaterial, {
      pseudo: null,
      tint: 'bg-sky-500/30',
    });

    assert.equal(
      overlayMaterial.tinted,
      overlayMaterial.expectedTint,
      `${browserName}: consumer bg-sky-500/30 must tint the installed dialog`,
    );
    assert.equal(
      overlayMaterial.background,
      overlayMaterial.opaqueSurface,
      `${browserName}: Reduce Transparency must beat the consumer dialog tint`,
    );
    assert.equal(
      overlayMaterial.backdrop,
      'none',
      `${browserName}: Reduce Transparency must remove the dialog blur`,
    );

    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    const triggerHandle = await trigger.elementHandle();
    assert.ok(triggerHandle, `${browserName}: installed dialog trigger must remain mounted`);
    await page.waitForFunction((node) => document.activeElement === node, triggerHandle, {
      timeout: 2_000,
    });

    // A menu item that opens a sheet hands focus across two Radix layers. Whatever
    // versions the installer resolved, the page must stay usable afterwards.
    const menuTrigger = page.getByRole('button', { name: 'Open installed menu' });
    const menu = page.locator('[role="menu"]');
    await menuTrigger.click();
    await page.getByRole('menuitem', { name: 'Open installed sheet' }).click();
    const sheet = page.getByRole('dialog', { name: 'Installed Glassy UI sheet' });
    await sheet.waitFor({ state: 'visible' });
    await menu.waitFor({ state: 'detached' });
    assert.ok(
      await sheet.evaluate((node) => node.contains(document.activeElement)),
      `${browserName}: a sheet opened from a menu must hold focus`,
    );
    await page.keyboard.press('Escape');
    await sheet.waitFor({ state: 'detached' });
    const menuTriggerHandle = await menuTrigger.elementHandle();
    assert.ok(menuTriggerHandle, `${browserName}: installed menu trigger must remain mounted`);
    await page.waitForFunction((node) => document.activeElement === node, menuTriggerHandle, {
      timeout: 2_000,
    });
    assert.notEqual(
      await page.evaluate(() => getComputedStyle(document.body).pointerEvents),
      'none',
      `${browserName}: closing a sheet opened from a menu must leave the page interactive`,
    );
    // A stuck layer would swallow this click, so the menu must open again.
    await menuTrigger.click({ timeout: 5_000 });
    await menu.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await menu.waitFor({ state: 'detached' });
    await browser.close();
    browser = undefined;
    report.browsers.push(browserName);
  }

  report.status = 'passed';
  console.log(
    installOnly
      ? `Registry install-only passed with shadcn ${shadcnManifest.version}, exact source/dependency closures, served examples, Tailwind output and production builds.`
      : `Registry install smoke passed with verified shadcn CLI ${shadcnManifest.version}, Tailwind output, consumer overrides, preference guards, and rendered dialog and menu-to-sheet flow in Chromium, Firefox, and WebKit (${shadcnBin}).`,
  );
} catch (error) {
  report.status = 'failed';
  report.error = error.message.slice(-16000);
  throw error;
} finally {
  try {
    await browser?.close();
  } finally {
    await stopChild(fixtureServer);
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
    fs.rmSync(auxiliaryRoot, { recursive: true, force: true });
    report.cleanup = {
      consumerAbsent: !fs.existsSync(temporaryRoot),
      methodsAbsent: !fs.existsSync(auxiliaryRoot),
    };
    fs.writeFileSync(
      path.join(artifactDirectory, 'report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
  }
}
