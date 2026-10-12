import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const expectedFiles = [
  'glass-accordion.json',
  'glass-alert.json',
  'glass-avatar.json',
  'glass-badge.json',
  'glass-breadcrumb.json',
  'glass-button.json',
  'glass-checkbox.json',
  'glass-command.json',
  'glass-dialog.json',
  'glass-dock.json',
  'glass-header.json',
  'glass-input.json',
  'glass-kbd.json',
  'glass-laptop.json',
  'glass-lens.json',
  'glass-menu.json',
  'glass-pagination.json',
  'glass-panel.json',
  'glass-phone-duo.json',
  'glass-popover.json',
  'glass-progress.json',
  'glass-provider.json',
  'glass-radio-group.json',
  'glass-scene.json',
  'glass-segmented-control.json',
  'glass-select.json',
  'glass-sheet.json',
  'glass-skeleton.json',
  'glass-slider.json',
  'glass-spinner.json',
  'glass-surface.json',
  'glass-switch.json',
  'glass-tabs.json',
  'glass-textarea.json',
  'glass-toast.json',
  'glass-tooltip.json',
  'glassy-theme.json',
  'glassy-ui-base-nova.json',
  'glassy-ui-new-york.json',
  'registry.json',
];

const root = process.cwd();

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

try {
  const result = spawnSync(
    process.execPath,
    [shadcnBin, 'build', path.join(root, 'registry.json'), '--output', temporaryDirectory],
    {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `official registry build failed (${result.status})\n${result.stdout}\n${result.stderr}`,
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
      `public/r/${relativePath} differs from a fresh official build`,
    );
  }

  console.log(`Generated registry check passed with shadcn ${shadcnManifest.version}.`);
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
