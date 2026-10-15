import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

// Keep the editable namespace graph, but publish a complete install at each existing URL.
const root = process.cwd();

const args = process.argv.slice(2);

const outputIndex = args.indexOf('--output');

const output = outputIndex === -1 ? undefined : args[outputIndex + 1];

assert.ok(outputIndex === -1 || output, '--output requires a directory');

const positional = args.filter(
  (_, index) => outputIndex === -1 || (index !== outputIndex && index !== outputIndex + 1),
);

assert.ok(
  positional.length <= 1,
  'Usage: build-install-registry.mjs [registry.json] [--output DIR]',
);

assert.ok(!output || positional.length === 1, '--output requires an explicit source registry');

const sources = positional.length ? positional : ['registry.json', 'registry-native.json'];

const require = createRequire(import.meta.url);

const packagePath = path.resolve(path.dirname(require.resolve('shadcn')), '..', 'package.json');

const manifest = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

assert.equal(manifest.version, '4.14.1', 'publication requires the pinned shadcn CLI');

const shadcnBin = path.resolve(path.dirname(packagePath), manifest.bin);

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'glassyui-install-registry-'));

function completeItem(name, items, namespace, visiting = new Set(), cache = new Map()) {
  assert.ok(!visiting.has(name), `registry dependency cycle at ${name}`);

  if (cache.has(name)) return cache.get(name);
  const item = items.get(name);
  assert.ok(item, `unknown registry item ${name}`);
  visiting.add(name);
  const members = [];

  for (const dependency of item.registryDependencies ?? []) {
    assert.ok(dependency.startsWith(namespace), `${name}: unsupported dependency ${dependency}`);

    const child = completeItem(
      dependency.slice(namespace.length),
      items,
      namespace,
      visiting,
      cache,
    );

    for (const field of ['css', 'cssVars', 'envVars', 'devDependencies'])
      assert.equal(
        child[field],
        undefined,
        `${name}: dependency ${dependency} contributes ${field}`,
      );
    members.push(child);
  }

  members.push(item);
  const files = new Map();
  const packages = new Map();

  for (const member of members) {
    for (const file of member.files ?? []) {
      assert.ok(file.target, `${name}: ${file.path} needs a target`);

      if (files.has(file.target))
        assert.deepEqual(
          files.get(file.target),
          file,
          `${name}: conflicting target ${file.target}`,
        );
      else files.set(file.target, file);
    }

    for (const dependency of member.dependencies ?? []) {
      const packageName = dependency.match(/^(@[^/]+\/[^@]+|[^@]+)(?:@.*)?$/)?.[1];
      assert.ok(packageName, `${name}: invalid package declaration ${dependency}`);

      if (packages.has(packageName))
        assert.equal(
          packages.get(packageName),
          dependency,
          `${name}: conflicting package ${packageName}`,
        );
      else packages.set(packageName, dependency);
    }
  }

  const published = { ...item };
  delete published.registryDependencies;

  if (files.size) published.files = [...files.values()];

  if (packages.size) published.dependencies = [...packages.values()];
  visiting.delete(name);
  cache.set(name, published);

  return published;
}

try {
  for (const source of sources) {
    const sourcePath = path.resolve(root, source);
    const registry = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const native = registry.name === 'glassyui-native';
    assert.ok(native || registry.name === 'glassyui', `unsupported registry ${registry.name}`);
    const officialDirectory = path.join(temporaryRoot, registry.name);

    const result = spawnSync(
      process.execPath,
      [shadcnBin, 'build', sourcePath, '--output', officialDirectory],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      },
    );

    if (result.status !== 0)
      throw new Error(
        `official build failed (${result.status})\n${result.stdout}\n${result.stderr}`,
      );

    const items = new Map(
      registry.items.map((item) => [
        item.name,
        JSON.parse(fs.readFileSync(path.join(officialDirectory, `${item.name}.json`), 'utf8')),
      ]),
    );

    assert.equal(items.size, registry.items.length, 'duplicate registry item names');
    const destination = path.resolve(root, output ?? (native ? 'public/r/native' : 'public/r'));
    fs.mkdirSync(destination, { recursive: true });

    const published = registry.items.map((item) =>
      completeItem(item.name, items, native ? '@glassyui-native/' : '@glassyui/'),
    );

    for (const item of published) {
      fs.writeFileSync(path.join(destination, `${item.name}.json`), JSON.stringify(item, null, 2));
    }

    // The catalogue describes the same closures without duplicating all source content.
    const catalogue = JSON.parse(
      fs.readFileSync(path.join(officialDirectory, 'registry.json'), 'utf8'),
    );

    catalogue.items = published.map((publishedItem) => {
      const item = { ...publishedItem };
      delete item.$schema;

      if (item.files)
        item.files = item.files.map((source) => {
          const file = { ...source };
          delete file.content;

          return file;
        });

      return item;
    });
    fs.writeFileSync(path.join(destination, 'registry.json'), JSON.stringify(catalogue, null, 2));
    console.log(
      `Published ${published.length} complete ${registry.name} items to ${path.relative(root, destination)}.`,
    );
  }

  if (!positional.length) {
    const names = (file) =>
      JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')).items.map((item) => item.name);

    fs.writeFileSync(
      path.join(root, 'src/lib/install-items.json'),
      `${JSON.stringify({ react: names('registry.json'), 'react-native': names('registry-native.json') }, null, 2)}\n`,
    );
  }
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
