import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

// Installs every Expo item from a running local server into a clean copy of the Expo fixture with
// the pinned shadcn CLI, then type-checks it and bundles it for iOS, Android and the web.

const baseUrl = process.argv[2];

const artifactDirectory = path.resolve(process.argv[3] ?? '.artifacts/expo-consumer');

const manualOnly = process.argv.includes('--manual-only');

if (!baseUrl) {
  console.error(
    'Usage: node scripts/smoke-expo-consumer.mjs http://127.0.0.1:3100 [artifact-dir] [--manual-only]',
  );
  process.exit(1);
}

const root = process.cwd();

const require = createRequire(import.meta.url);

const shadcnPackage = path.resolve(path.dirname(require.resolve('shadcn')), '..', 'package.json');

const shadcnManifest = JSON.parse(fs.readFileSync(shadcnPackage, 'utf8'));

assert.equal(
  shadcnManifest.version,
  '4.14.1',
  `expected pinned shadcn 4.14.1, found ${shadcnManifest.version}`,
);

const shadcnBin = path.resolve(path.dirname(shadcnPackage), shadcnManifest.bin);

const fixture = path.join(root, 'fixtures', 'expo-consumer');

const sourceDirectory = path.join(root, 'registry', 'glassyui-native');

const registry = JSON.parse(fs.readFileSync(path.join(root, 'registry-native.json'), 'utf8'));

// The packages the items bring with them. The fixture lists them for local development; the
// smoke removes them so the CLI has to install them.
const glassPackages = [...new Set(registry.items.flatMap((item) => item.dependencies ?? []))];

// Installing every item must install exactly the library's source tree, byte for byte. This is
// read from the source folder, not from the payloads under test.
const expectedFiles = fs
  .readdirSync(sourceDirectory, { recursive: true })
  .filter((entry) => /\.tsx?$/.test(entry))
  .map((entry) => path.join('components', 'glassyui', entry))
  .sort();

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'glassyui-expo-consumer-'));

const manualRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'glassyui-expo-manual-'));

if (!temporaryRoot.startsWith(path.join(os.tmpdir(), 'glassyui-expo-consumer-'))) {
  throw new Error(`refusing to use unexpected temporary directory ${temporaryRoot}`);
}

const skipped = new Set([
  'node_modules',
  'components',
  'ios',
  'android',
  'dist',
  '.expo',
  'package-lock.json',
]);

function run(command, args, cwd = temporaryRoot) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.status})\n${result.stdout}\n${result.stderr}`,
    );
  }

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

const report = {
  baseUrl,
  shadcn: shadcnManifest.version,
  items: manualOnly ? ['glass-button'] : registry.items.map((item) => item.name),
  status: 'running',
  mode: manualOnly ? 'manual-only' : 'complete',
  scratch: {
    cli: temporaryRoot,
    manual: manualRoot,
    purpose:
      'Disposable clean Expo consumers; recreated from fixtures/expo-consumer and published registry payloads.',
  },
};

fs.mkdirSync(artifactDirectory, { recursive: true });

fs.writeFileSync(
  path.join(artifactDirectory, 'report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);

async function checkManualButton() {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/r/native/glass-button.json`);
  assert.equal(response.status, 200, 'native Manual source must load');
  const payload = await response.json();
  assert.equal(payload.registryDependencies, undefined, 'native button needs no registry mapping');
  assert.equal(payload.files.length, 8, 'native button must include provider and surface');

  for (const file of ['package.json', 'components.json', 'tsconfig.json', 'index.ts', 'app.json'])
    fs.copyFileSync(path.join(fixture, file), path.join(manualRoot, file));
  const manifestPath = path.join(manualRoot, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  for (const name of glassPackages) delete manifest.dependencies[name];
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const configPath = path.join(manualRoot, 'components.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.registries = {};
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  fs.writeFileSync(
    path.join(manualRoot, 'App.tsx'),
    `import { GlassButton } from './components/glassyui/glass-button';\nimport { GlassProvider } from './components/glassyui/glass-provider';\nexport default function App() { return <GlassProvider><GlassButton>Manual button</GlassButton></GlassProvider>; }\n`,
  );
  run('pnpm', ['install'], manualRoot);

  // Establish an SDK-matched initialized app before exercising the Manual package recipe.
  const baseline = spawnSync('npx', ['expo', 'install', '--check'], {
    cwd: manualRoot,
    encoding: 'utf8',
    env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
  });

  const baselineOutput = `${baseline.stdout}\n${baseline.stderr}`.trim();

  if (baseline.status !== 0)
    assert.match(
      baselineOutput,
      /Found outdated dependencies/,
      'baseline check failed for an unrelated reason',
    );
  const baselineBefore = { sdkMatched: baseline.status === 0, output: baselineOutput.slice(-3000) };
  run('npx', ['expo', 'install', '--fix'], manualRoot);
  run('npx', ['expo', 'install', '--check'], manualRoot);
  run('npx', ['expo', 'install', ...payload.dependencies], manualRoot);
  assert.ok(
    fs.existsSync(path.join(manualRoot, 'pnpm-lock.yaml')),
    'Expo must retain the consumer pnpm lockfile',
  );
  assert.equal(
    fs.existsSync(path.join(manualRoot, 'package-lock.json')),
    false,
    'Expo must use the consumer package manager',
  );
  const files = {};

  for (const file of payload.files) {
    assert.equal(
      file.content,
      fs.readFileSync(path.join(root, file.path), 'utf8'),
      `native Manual source differs: ${file.target}`,
    );
    const target = path.resolve(manualRoot, file.target);
    assert.ok(
      target.startsWith(`${manualRoot}${path.sep}`),
      'native Manual target escaped consumer',
    );
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
    files[file.target] = createHash('sha256').update(file.content).digest('hex');
  }

  run('npx', ['expo', 'install', '--check'], manualRoot);
  run('npx', ['tsc', '--noEmit'], manualRoot);
  run(
    'npx',
    [
      'expo',
      'export',
      '--platform',
      'ios',
      '--platform',
      'android',
      '--platform',
      'web',
      '--output-dir',
      'dist',
    ],
    manualRoot,
  );
  const bundles = listFiles(path.join(manualRoot, 'dist', '_expo', 'static', 'js'));

  for (const platform of ['ios', 'android', 'web'])
    assert.ok(
      bundles.some((bundle) => bundle.startsWith(`${platform}${path.sep}`)),
      `native Manual produced no ${platform} bundle`,
    );

  return {
    baselineBefore,
    baselineAfter: 'SDK matched',
    packageManager: 'pnpm',
    expoPackageManager: 'pnpm',
    files,
    packages: payload.dependencies,
    typecheck: 'passed',
    bundles,
  };
}

try {
  if (!manualOnly) {
    fs.cpSync(fixture, temporaryRoot, {
      recursive: true,
      filter: (source) => !skipped.has(path.relative(fixture, source).split(path.sep)[0]),
    });

    const manifestPath = path.join(temporaryRoot, 'package.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    for (const name of glassPackages) delete manifest.dependencies[name];

    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const configPath = path.join(temporaryRoot, 'components.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    config.registries = {}; // A first URL install must not inherit the fixture's mapping.
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

    run('npm', ['install', '--no-audit', '--no-fund']);
    run(process.execPath, [
      shadcnBin,
      'add',
      ...registry.items.map((item) => `${baseUrl.replace(/\/$/, '')}/r/native/${item.name}.json`),
      '--yes',
    ]);

    const installedFiles = listFiles(path.join(temporaryRoot, 'components', 'glassyui'))
      .map((entry) => path.join('components', 'glassyui', entry))
      .sort();

    assert.deepEqual(
      installedFiles,
      expectedFiles,
      'installed files differ from the library source',
    );

    for (const file of expectedFiles) {
      const installed = fs.readFileSync(path.join(temporaryRoot, file), 'utf8');

      const source = fs.readFileSync(
        path.join(sourceDirectory, path.relative(path.join('components', 'glassyui'), file)),
        'utf8',
      );

      assert.equal(installed, source, `${file} differs from its registry source`);
    }

    const installedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    report.installedByCli = Object.fromEntries(
      glassPackages.map((name) => [name, installedManifest.dependencies[name]]),
    );

    for (const name of glassPackages) {
      assert.ok(installedManifest.dependencies[name], `the CLI did not install ${name}`);
    }

    // The pinned CLI hands packages to `npx expo install` after `--`, which skips Expo's version
    // matching, so the guide asks for `npx expo install --fix`. Prove the fixed versions match.
    run('npx', ['expo', 'install', '--fix']);
    run('npx', ['expo', 'install', '--check']);

    const fixedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    report.matchedToSdk = Object.fromEntries(
      glassPackages.map((name) => [name, fixedManifest.dependencies[name]]),
    );

    run('npx', ['tsc', '--noEmit']);
    run('npx', [
      'expo',
      'export',
      '--platform',
      'ios',
      '--platform',
      'android',
      '--platform',
      'web',
      '--output-dir',
      'dist',
    ]);

    const bundles = listFiles(path.join(temporaryRoot, 'dist', '_expo', 'static', 'js'));

    report.bundles = Object.fromEntries(
      bundles.map((bundle) => [
        bundle,
        fs.statSync(path.join(temporaryRoot, 'dist', '_expo', 'static', 'js', bundle)).size,
      ]),
    );

    for (const platform of ['ios', 'android', 'web']) {
      assert.ok(
        bundles.some((bundle) => bundle.startsWith(`${platform}${path.sep}`)),
        `expo export produced no ${platform} bundle`,
      );
    }

    // An existing namespace config must still resolve the same files without an overwrite prompt.
    config.registries = {
      '@glassyui-native': `${baseUrl.replace(/\/$/, '')}/r/native/{name}.json`,
    };
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    run(process.execPath, [shadcnBin, 'add', '@glassyui-native/glass-button', '--yes']);

    for (const file of expectedFiles) {
      const relative = path.relative(path.join('components', 'glassyui'), file);
      assert.equal(
        fs.readFileSync(path.join(temporaryRoot, file), 'utf8'),
        fs.readFileSync(path.join(sourceDirectory, relative), 'utf8'),
        `namespace compatibility changed ${file}`,
      );
    }

    report.namespaceCompatibility = true;
    report.installedFiles = installedFiles;
  }

  report.manual = await checkManualButton();
  fs.mkdirSync(artifactDirectory, { recursive: true });

  for (const file of manualOnly ? [] : ['package.json', 'package-lock.json']) {
    fs.copyFileSync(path.join(temporaryRoot, file), path.join(artifactDirectory, file));
  }

  report.status = 'passed';

  console.log(
    manualOnly
      ? `Manual Expo consumer smoke passed: pnpm, SDK matching, 8 source files, type-check and iOS/Android/web bundles. Report: ${path.join(artifactDirectory, 'report.json')}`
      : `Expo consumer smoke passed: ${registry.items.length} items, ${report.installedFiles.length} files and ${glassPackages.length} packages installed with shadcn ${shadcnManifest.version}; type-checked and bundled for iOS, Android and the web. Report: ${path.join(artifactDirectory, 'report.json')}`,
  );
} catch (error) {
  report.status = 'failed';
  report.error = error.message.slice(-16000);
  throw error;
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
  fs.rmSync(manualRoot, { recursive: true, force: true });
  report.cleanup = {
    cliAbsent: !fs.existsSync(temporaryRoot),
    manualAbsent: !fs.existsSync(manualRoot),
  };
  fs.writeFileSync(
    path.join(artifactDirectory, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}
