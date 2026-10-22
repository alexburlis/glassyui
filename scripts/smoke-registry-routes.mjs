import assert from 'node:assert/strict';
import fs from 'node:fs';

const baseUrl = process.argv[2] ?? 'http://localhost:3000';

const expectedItems = [
  'glass-provider',
  'glass-surface',
  'glass-button',
  'glass-panel',
  'glass-header',
  'glass-input',
  'glass-tabs',
  'glass-dialog',
  'glass-popover',
  'glass-tooltip',
  'glass-toast',
  'glass-accordion',
  'glass-switch',
  'glass-slider',
  'glass-segmented-control',
  'glass-badge',
  'glass-dock',
  'glass-sheet',
  'glass-menu',
  'glass-lens',
  'glass-scene',
  'glass-logo-reveal',
  'glass-laptop',
  'glass-phone-duo',
  'glass-checkbox',
  'glass-radio-group',
  'glass-textarea',
  'glass-select',
  'glass-progress',
  'glass-spinner',
  'glass-skeleton',
  'glass-alert',
  'glass-avatar',
  'glass-kbd',
  'glass-scroll-area',
  'glass-command',
  'glass-breadcrumb',
  'glass-pagination',
  'glassy-theme',
  'glassy-ui-new-york',
  'glassy-ui-base-nova',
];

const dropinItems = ['glassy-ui-new-york', 'glassy-ui-base-nova'];

const expectedCacheControl = 'public, max-age=300, stale-while-revalidate=86400';

async function request(path, expectedStatus = 200) {
  const url = new URL(path, baseUrl);
  const response = await fetch(url);

  if (response.status !== expectedStatus) {
    throw new Error(`${url.href} returned ${response.status}, expected ${expectedStatus}`);
  }

  return response;
}

function checkRegistryDependencies(item) {
  assert.equal(
    item.registryDependencies,
    undefined,
    `${item.name} must install by URL without a registry mapping`,
  );
}

function checkCssPayload(item) {
  for (const scope of ['theme', 'light', 'dark']) {
    const tokens = item.cssVars?.[scope];

    assert.ok(
      tokens &&
        Object.getPrototypeOf(tokens) === Object.prototype &&
        Object.keys(tokens).length > 0,
      `/r/${item.name}.json returned no cssVars.${scope} tokens`,
    );

    for (const value of Object.values(tokens)) {
      assert.match(value, /\S/, `/r/${item.name}.json returned an empty cssVars.${scope} value`);
    }
  }

  const layer = item.css?.['@layer components']?.['@layer glassy'];

  assert.ok(
    layer && Object.getPrototypeOf(layer) === Object.prototype && Object.keys(layer).length > 0,
    `/r/${item.name}.json returned no @layer components { @layer glassy } rules`,
  );
}

const registryResponse = await request('/r/registry.json');

if (registryResponse.headers.get('cache-control') !== expectedCacheControl) {
  throw new Error(
    `/r/registry.json returned Cache-Control ${registryResponse.headers.get('cache-control') ?? '<missing>'}, expected ${expectedCacheControl}`,
  );
}

const registry = await registryResponse.json();

if (registry.name !== 'glassyui' || !Array.isArray(registry.items)) {
  throw new Error('/r/registry.json returned an invalid registry payload');
}

const catalogNames = registry.items.map((item) => item.name);

if (catalogNames.length !== new Set(catalogNames).size) {
  throw new Error('/r/registry.json returned duplicate catalog item names');
}

if (
  catalogNames.length !== expectedItems.length ||
  expectedItems.some((name) => !catalogNames.includes(name))
) {
  throw new Error(
    `/r/registry.json item names must exactly match the ${expectedItems.length} public items; received ${catalogNames.join(', ')}`,
  );
}

for (const item of registry.items) {
  if (!expectedItems.includes(item.name)) {
    throw new Error(`/r/registry.json exposed unexpected item ${item.name}`);
  }

  checkRegistryDependencies(item);
}

for (const name of expectedItems) {
  const response = await request(`/r/${name}.json`);

  if (response.headers.get('cache-control') !== expectedCacheControl) {
    throw new Error(
      `/r/${name}.json returned Cache-Control ${response.headers.get('cache-control') ?? '<missing>'}, expected ${expectedCacheControl}`,
    );
  }

  const item = await response.json();

  if (item.name !== name) {
    throw new Error(`/r/${name}.json returned the wrong item`);
  }

  if (item.$schema !== 'https://ui.shadcn.com/schema/registry-item.json') {
    throw new Error(`/r/${name}.json returned the wrong schema`);
  }

  checkRegistryDependencies(item);

  // The theme installs tokens and rules into the app's CSS, without component files.
  if (name === 'glassy-theme') {
    assert.equal(item.type, 'registry:theme', `/r/${name}.json returned the wrong item type`);

    for (const field of ['files', 'dependencies', 'registryDependencies']) {
      assert.equal(item[field], undefined, `/r/${name}.json must not declare ${field}`);
    }

    checkCssPayload(item);
    continue;
  }

  assert.equal(item.type, 'registry:ui', `/r/${name}.json returned the wrong item type`);

  // Drop-in sets install by URL, including their engine, with no registry mapping.
  if (dropinItems.includes(name)) {
    assert.equal(
      item.registryDependencies,
      undefined,
      `/r/${name}.json must install without namespaced registry dependencies`,
    );
    checkCssPayload(item);
  }

  if (!Array.isArray(item.files) || item.files.length === 0) {
    throw new Error(`/r/${name}.json returned no installable files`);
  }

  if (dropinItems.includes(name)) {
    for (const target of [
      'components/glassyui/glassy-engine.tsx',
      'components/glassyui/glassy-button-root.tsx',
      'components/ui/button.tsx',
    ]) {
      assert.ok(
        item.files.some((file) => file.target === target),
        `/r/${name}.json omitted install target ${target}`,
      );
    }
  }

  for (const file of item.files) {
    // assert.match also rejects content that is not a string.
    assert.match(
      file.content,
      /\S/,
      `/r/${name}.json has file without generated content: ${file.path ?? '<missing path>'}`,
    );
  }
}

const nativeSource = JSON.parse(fs.readFileSync('registry-native.json', 'utf8'));

const nativeResponse = await request('/r/native/registry.json');

assert.equal(
  nativeResponse.headers.get('cache-control'),
  expectedCacheControl,
  'native catalogue cache contract',
);

const nativeCatalogue = await nativeResponse.json();

assert.deepEqual(
  nativeCatalogue.items.map((item) => item.name),
  nativeSource.items.map((item) => item.name),
  'native served catalogue differs',
);

for (const entry of nativeCatalogue.items) {
  checkRegistryDependencies(entry);
  const response = await request(`/r/native/${entry.name}.json`);
  assert.equal(
    response.headers.get('cache-control'),
    expectedCacheControl,
    `${entry.name} native cache contract`,
  );
  const item = await response.json();
  assert.equal(item.name, entry.name, 'native item identity');
  assert.equal(
    item.$schema,
    'https://ui.shadcn.com/schema/registry-item.json',
    'native item schema',
  );
  checkRegistryDependencies(item);
  assert.ok(item.files.length > 0, `${entry.name} has no native source`);

  for (const file of item.files)
    assert.match(file.content, /\S/, `${entry.name} omitted ${file.target} source`);
}

await request('/r/native/not-a-glassyui-item.json', 404);

await request('/r/not-a-glassyui-item.json', 404);

console.log('Registry route smoke passed.');
