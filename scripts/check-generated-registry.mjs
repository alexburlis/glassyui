import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = process.cwd();

const registry = JSON.parse(fs.readFileSync(path.join(root, 'registry.json'), 'utf8'));

const expectedFiles = [
  ...registry.items.map((item) => `${item.name}.json`),
  'registry.json',
].sort();

const publicRegistryDirectory = path.join(root, 'public', 'r');

const require = createRequire(import.meta.url);

const shadcnPackage = path.resolve(path.dirname(require.resolve('shadcn')), '..', 'package.json');

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

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'glassyui-registry-check-'));

const expectedTemporaryPrefix = path.join(os.tmpdir(), 'glassyui-registry-check-');

if (!temporaryDirectory.startsWith(expectedTemporaryPrefix)) {
  throw new Error(`refusing to clean unexpected temporary directory ${temporaryDirectory}`);
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

function assertExactFileSet(label, actual) {
  assert.deepEqual([...actual].sort(), expectedFiles, `${label} filename set differs`);
}

// This derives the install contract from editable declarations and source bytes, independently
// of the publication transform. Missing transitive files or packages break a URL-first install.
function checkCompleteItems() {
  const sourceItems = new Map(registry.items.map((item) => [item.name, item]));

  const catalogue = JSON.parse(
    fs.readFileSync(path.join(publicRegistryDirectory, 'registry.json'), 'utf8'),
  );

  assert.deepEqual(
    catalogue.items.map((item) => item.name),
    registry.items.map((item) => item.name),
    'published catalogue names differ',
  );

  for (const source of registry.items) {
    const members = new Set();

    const visit = (name, visiting = new Set()) => {
      assert.ok(!visiting.has(name), `source cycle at ${name}`);

      if (members.has(name)) return;
      const item = sourceItems.get(name);
      assert.ok(item, `unknown source item ${name}`);
      visiting.add(name);

      for (const dependency of item.registryDependencies ?? []) {
        assert.ok(dependency.startsWith('@glassyui/'), `unknown dependency ${dependency}`);
        visit(dependency.slice('@glassyui/'.length), visiting);
      }

      visiting.delete(name);
      members.add(name);
    };

    visit(source.name);

    const payload = JSON.parse(
      fs.readFileSync(path.join(publicRegistryDirectory, `${source.name}.json`), 'utf8'),
    );

    assert.equal(payload.registryDependencies, undefined, `${source.name} needs a mapping`);
    const files = new Map();
    const packages = new Set();

    for (const name of members) {
      const member = sourceItems.get(name);

      for (const dependency of member.dependencies ?? []) packages.add(dependency);

      for (const file of member.files ?? []) {
        const expected = { ...file, content: fs.readFileSync(path.join(root, file.path), 'utf8') };

        if (files.has(file.target))
          assert.deepEqual(files.get(file.target), expected, `conflicting target ${file.target}`);
        files.set(file.target, expected);
      }
    }

    assert.deepEqual(
      [...(payload.dependencies ?? [])].sort(),
      [...packages].sort(),
      `${source.name} package closure differs`,
    );
    assert.deepEqual(
      [...(payload.files ?? [])].sort((a, b) => a.target.localeCompare(b.target)),
      [...files.values()].sort((a, b) => a.target.localeCompare(b.target)),
      `${source.name} file content or declaration differs from its source closure`,
    );

    for (const field of ['name', 'type', 'title', 'description', 'meta', 'css', 'cssVars'])
      assert.deepEqual(payload[field], source[field], `${source.name} changed ${field}`);
    const entry = catalogue.items.find((item) => item.name === source.name);
    assert.equal(entry.registryDependencies, undefined, `${source.name} catalogue needs a mapping`);
    assert.deepEqual(
      [...(entry.dependencies ?? [])].sort(),
      [...packages].sort(),
      `${source.name} catalogue packages differ`,
    );
    assert.deepEqual(
      [...(entry.files ?? [])].sort((a, b) => a.target.localeCompare(b.target)),
      [...files.values()]
        .map((source) => {
          const file = { ...source };
          delete file.content;

          return file;
        })
        .sort((a, b) => a.target.localeCompare(b.target)),
      `${source.name} catalogue closure differs`,
    );
    assert.equal(
      entry.description,
      source.description,
      `${source.name} catalogue description differs`,
    );
  }
}

try {
  const nativeRegistry = JSON.parse(
    fs.readFileSync(path.join(root, 'registry-native.json'), 'utf8'),
  );

  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(root, 'src/lib/install-items.json'), 'utf8')),
    {
      react: registry.items.map((item) => item.name),
      'react-native': nativeRegistry.items.map((item) => item.name),
    },
    'client install catalogue is stale; run pnpm registry:build',
  );
  checkCompleteItems();

  const result = spawnSync(
    process.execPath,
    [
      path.join(root, 'scripts', 'build-install-registry.mjs'),
      'registry.json',
      '--output',
      temporaryDirectory,
    ],
    { cwd: root, encoding: 'utf8', stdio: 'pipe' },
  );

  if (result.status !== 0) {
    throw new Error(
      `registry publication build failed (${result.status})\n${result.stdout}\n${result.stderr}`,
    );
  }

  const generatedFiles = listFiles(temporaryDirectory);

  // public/r/native holds the Expo registry, which check-native-registry.mjs verifies.
  const publishedFiles = listFiles(publicRegistryDirectory).filter(
    (file) => !file.startsWith(`native${path.sep}`),
  );

  assertExactFileSet('fresh generated registry', generatedFiles);
  assertExactFileSet('public/r registry', publishedFiles);

  for (const relativePath of expectedFiles) {
    const generated = fs.readFileSync(path.join(temporaryDirectory, relativePath));
    const published = fs.readFileSync(path.join(publicRegistryDirectory, relativePath));
    assert.ok(
      generated.equals(published),
      `public/r/${relativePath} differs from a fresh publication build`,
    );
  }

  console.log(`Generated registry check passed with shadcn ${shadcnManifest.version}.`);
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
