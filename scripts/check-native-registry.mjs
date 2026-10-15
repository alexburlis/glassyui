import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

// The Expo registry ships React Native source. shadcn copies only the files an item and its
// registry dependencies declare, and installs only their declared packages, so every import in
// an installed file has to resolve inside that closure.

const root = process.cwd();

const registryPath = path.join(root, 'registry-native.json');

const sourceDirectory = path.join(root, 'registry', 'glassyui-native');

const publishedDirectory = path.join(root, 'public', 'r', 'native');

const namespace = '@glassyui-native/';

// Packages every Expo app already has.
const platformPackages = new Set(['react', 'react-native']);

const blockedImports = ['react-dom', '@radix-ui/', 'clsx', 'next', '@/', 'cmdk'];

const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;

const failures = [];

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

if (registry.$schema !== 'https://ui.shadcn.com/schema/registry.json') {
  failures.push('registry-native.json has the wrong $schema');
}

if (registry.name !== 'glassyui-native')
  failures.push('registry-native.json name must be glassyui-native');

const items = new Map(registry.items.map((item) => [item.name, item]));

if (items.size !== registry.items.length)
  failures.push('registry-native.json has duplicate item names');

function packageName(specifier) {
  const parts = specifier.split('/');

  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function readImports(file) {
  const source = fs.readFileSync(file, 'utf8');

  return [...source.matchAll(importPattern)].map((match) => match[1]);
}

function resolveRelative(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);

  return ['.tsx', '.ts']
    .map((extension) => `${base}${extension}`)
    .find((candidate) => fs.existsSync(candidate));
}

/** The item, followed by every item it depends on, each once. */
function closureOf(name, seen = new Set()) {
  if (seen.has(name)) return seen;

  seen.add(name);

  for (const dependency of items.get(name)?.registryDependencies ?? []) {
    closureOf(dependency.replace(namespace, ''), seen);
  }

  return seen;
}

const coveredFiles = new Set();

for (const item of registry.items) {
  for (const field of ['name', 'type', 'title', 'description', 'files']) {
    if (!item[field]) failures.push(`${item.name ?? '<unnamed>'} is missing ${field}`);
  }

  if (item.type !== 'registry:ui') failures.push(`${item.name} must be a registry:ui item`);

  for (const dependency of item.registryDependencies ?? []) {
    if (!dependency.startsWith(namespace) || !items.has(dependency.replace(namespace, ''))) {
      failures.push(`${item.name} has unknown registry dependency ${dependency}`);
    }
  }

  for (const file of item.files) {
    const relative = path.relative(sourceDirectory, path.join(root, file.path));
    const expectedType = relative.startsWith('lib/') ? 'registry:lib' : 'registry:ui';

    coveredFiles.add(relative);

    if (!fs.existsSync(path.join(root, file.path)))
      failures.push(`${item.name}: ${file.path} does not exist`);

    if (file.target !== `components/glassyui/${relative}`) {
      failures.push(`${item.name}: ${file.path} must target components/glassyui/${relative}`);
    }

    if (file.type !== expectedType)
      failures.push(`${item.name}: ${file.path} must be ${expectedType}`);
  }
}

for (const item of registry.items) {
  const closure = [...closureOf(item.name)].flatMap((name) =>
    items.has(name) ? [items.get(name)] : [],
  );

  const installedFiles = new Set(
    closure.flatMap((member) => member.files.map((file) => path.join(root, file.path))),
  );

  const installedPackages = new Set([
    ...platformPackages,
    ...closure.flatMap((member) => member.dependencies ?? []),
  ]);

  const importedPackages = new Set();

  for (const file of item.files) {
    const fullPath = path.join(root, file.path);

    if (!fs.existsSync(fullPath)) continue;

    for (const specifier of readImports(fullPath)) {
      if (
        blockedImports.some((blocked) => specifier === blocked || specifier.startsWith(blocked))
      ) {
        failures.push(`${item.name}: ${file.path} imports web-only ${specifier}`);
        continue;
      }

      if (specifier.startsWith('.')) {
        const target = resolveRelative(fullPath, specifier);

        if (!target) {
          failures.push(`${item.name}: ${file.path} imports missing ${specifier}`);
        } else if (!installedFiles.has(target)) {
          failures.push(
            `${item.name}: ${file.path} imports ${specifier}, which the item does not install`,
          );
        }

        continue;
      }

      importedPackages.add(packageName(specifier));

      if (!installedPackages.has(packageName(specifier))) {
        failures.push(
          `${item.name}: ${file.path} imports ${specifier}, which the item does not declare`,
        );
      }
    }
  }

  for (const dependency of item.dependencies ?? []) {
    // Reanimated requires Worklets as an installed peer even when a control uses its own callbacks.
    const requiredWorklets =
      dependency === 'react-native-worklets' && importedPackages.has('react-native-reanimated');

    if (!importedPackages.has(dependency) && !requiredWorklets)
      failures.push(`${item.name} declares ${dependency} but never imports it`);
  }
}

for (const entry of fs.readdirSync(sourceDirectory, { recursive: true })) {
  if (!/\.tsx?$/.test(entry)) continue;

  if (!coveredFiles.has(entry))
    failures.push(`registry/glassyui-native/${entry} belongs to no registry item`);
}

// Each component page shows its item's React Native usage from the Expo fixture, which renders
// and type-checks it.
const usageDirectory = path.join(root, 'fixtures', 'expo-consumer', 'usage');

for (const item of registry.items) {
  if (!fs.existsSync(path.join(usageDirectory, `${item.name}.tsx`))) {
    failures.push(`${item.name} has no usage example in fixtures/expo-consumer/usage`);
  }
}

// Validate complete payload content independently from the publication transform.
const publishedCatalogue = JSON.parse(
  fs.readFileSync(path.join(publishedDirectory, 'registry.json'), 'utf8'),
);

assert.deepEqual(
  publishedCatalogue.items.map((item) => item.name),
  registry.items.map((item) => item.name),
  'native catalogue names differ',
);

for (const item of registry.items) {
  const payload = JSON.parse(
    fs.readFileSync(path.join(publishedDirectory, `${item.name}.json`), 'utf8'),
  );

  assert.equal(payload.registryDependencies, undefined, `${item.name} still requires a mapping`);
  const closure = [...closureOf(item.name)].map((name) => items.get(name));
  const expected = new Map();

  for (const member of closure) {
    for (const file of member.files) {
      const entry = { ...file, content: fs.readFileSync(path.join(root, file.path), 'utf8') };

      if (expected.has(file.target))
        assert.deepEqual(expected.get(file.target), entry, `conflicting ${file.target}`);
      expected.set(file.target, entry);
    }
  }

  assert.deepEqual(
    [...payload.files].sort((a, b) => a.target.localeCompare(b.target)),
    [...expected.values()].sort((a, b) => a.target.localeCompare(b.target)),
    `${item.name} published content differs from its source closure`,
  );
  assert.deepEqual(
    [...(payload.dependencies ?? [])].sort(),
    [...new Set(closure.flatMap((member) => member.dependencies ?? []))].sort(),
    `${item.name} published packages differ from its source closure`,
  );
  const entry = publishedCatalogue.items.find((member) => member.name === item.name);
  assert.equal(entry.registryDependencies, undefined, `${item.name} catalogue needs a mapping`);
  assert.deepEqual(
    [...entry.files].sort((a, b) => a.target.localeCompare(b.target)),
    [...expected.values()]
      .map((source) => {
        const file = { ...source };
        delete file.content;

        return file;
      })
      .sort((a, b) => a.target.localeCompare(b.target)),
    `${item.name} native catalogue closure differs`,
  );
  assert.deepEqual(
    [...(entry.dependencies ?? [])].sort(),
    [...(payload.dependencies ?? [])].sort(),
    `${item.name} native catalogue packages differ`,
  );

  for (const field of ['name', 'type', 'title', 'description', 'meta'])
    assert.deepEqual(payload[field], item[field], `${item.name} changed ${field}`);
  assert.equal(
    entry.description,
    item.description,
    `${item.name} native catalogue description differs`,
  );
}

// The published payloads must equal a fresh build with the pinned CLI.
const require = createRequire(import.meta.url);

const shadcnPackage = path.resolve(path.dirname(require.resolve('shadcn')), '..', 'package.json');

const shadcnManifest = JSON.parse(fs.readFileSync(shadcnPackage, 'utf8'));

assert.equal(
  shadcnManifest.version,
  '4.14.1',
  `expected pinned shadcn 4.14.1, found ${shadcnManifest.version}`,
);

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'glassyui-native-registry-'));

try {
  const build = spawnSync(
    process.execPath,
    [
      path.join(root, 'scripts', 'build-install-registry.mjs'),
      registryPath,
      '--output',
      temporaryDirectory,
    ],
    {
      cwd: root,
      encoding: 'utf8',
    },
  );

  if (build.status !== 0) {
    failures.push(`shadcn build failed (${build.status})\n${build.stdout}\n${build.stderr}`);
  } else {
    const generated = fs.readdirSync(temporaryDirectory).sort();

    const published = fs.existsSync(publishedDirectory)
      ? fs.readdirSync(publishedDirectory).sort()
      : [];

    const expected = [...registry.items.map((item) => `${item.name}.json`), 'registry.json'].sort();

    assert.deepEqual(generated, expected, 'a fresh build produced an unexpected file set');

    if (JSON.stringify(published) !== JSON.stringify(expected)) {
      failures.push('public/r/native differs from the catalog; run pnpm registry:build');
    } else {
      for (const name of expected) {
        const fresh = fs.readFileSync(path.join(temporaryDirectory, name));

        if (!fresh.equals(fs.readFileSync(path.join(publishedDirectory, name)))) {
          failures.push(
            `public/r/native/${name} differs from a fresh build; run pnpm registry:build`,
          );
        }
      }
    }
  }
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

if (failures.length) {
  console.error('Native registry check failed:');

  for (const failure of failures) console.error(`- ${failure}`);

  process.exit(1);
}

console.log(
  `Native registry check passed: ${registry.items.length} items with shadcn ${shadcnManifest.version}.`,
);
