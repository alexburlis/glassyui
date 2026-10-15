import fs from 'node:fs';
import path from 'node:path';
import {
  buildThemeItem,
  DROPIN_COMPONENTS,
  DROPIN_SETS,
  THEME_ITEM_NAME,
  THEME_SOURCE,
} from './build-shadcn-theme.mjs';

const root = process.cwd();

const registryPath = path.join(root, 'registry.json');

const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;

const blockedImportFragments = [
  'src/app',
  'src/components/debug-panel',
  'src/styles/liquid-showcase.css',
  '@/app',
  '@/components/debug-panel',
  '@/styles/liquid-showcase.css',
];

const blockedCssSelectors = [
  '.lg-demo-',
  '.glass-test-',
  '.glass-refraction-',
  '.lg-switcher-',
  '.lg-liquid-switcher',
];

const allowedFileTypes = new Set([
  'registry:block',
  'registry:component',
  'registry:file',
  'registry:hook',
  'registry:lib',
  'registry:ui',
]);

const registryDependencyPattern = /^@glassyui\/[a-z0-9-]+$/;

const failures = [];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    failures.push(`${path.relative(root, file)} is not valid JSON: ${error.message}`);

    return null;
  }
}

// The shadcn theme is CSS only: tokens and rules, no files or dependencies. It
// must match a fresh build from its source, and the published payload must
// carry the same tokens and rules.
function checkThemeItem(item) {
  if (item.type !== 'registry:theme') failures.push(`${item.name} must be a registry:theme`);

  for (const field of ['files', 'dependencies', 'registryDependencies']) {
    if (item[field]) failures.push(`${item.name} must not declare ${field}`);
  }

  const layer = item.css?.['@layer components']?.['@layer glassy'];

  if (!layer || Object.keys(layer).length === 0) {
    failures.push(`${item.name} must keep its rules in @layer components { @layer glassy }`);
  }

  if (
    JSON.stringify(item) !== JSON.stringify(buildThemeItem(fs.readFileSync(THEME_SOURCE, 'utf8')))
  ) {
    failures.push(`${item.name} is stale; run node scripts/build-shadcn-theme.mjs`);
  }

  const generatedPath = path.join(root, 'public', 'r', `${item.name}.json`);

  if (!fs.existsSync(generatedPath)) {
    failures.push(`${item.name} is missing generated public/r/${item.name}.json`);

    return;
  }

  const generated = readJson(generatedPath);

  if (
    generated &&
    (JSON.stringify(generated.cssVars) !== JSON.stringify(item.cssVars) ||
      JSON.stringify(generated.css) !== JSON.stringify(item.css))
  ) {
    failures.push(`public/r/${item.name}.json differs from registry.json; run pnpm registry:build`);
  }
}

function checkRegistryFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];

    if (blockedImportFragments.some((blocked) => specifier.includes(blocked))) {
      failures.push(`${relative} imports blocked specifier ${specifier}`);
    }
  }

  if (file.endsWith('.css')) {
    for (const selector of blockedCssSelectors) {
      if (source.includes(selector)) {
        failures.push(`${relative} contains docs/showcase selector ${selector}`);
      }
    }
  }
}

const registry = readJson(registryPath);

if (registry) {
  if (registry.$schema !== 'https://ui.shadcn.com/schema/registry.json') {
    failures.push('registry.json has the wrong $schema');
  }

  if (registry.name !== 'glassyui') {
    failures.push('registry.json name must be glassyui');
  }

  if (!Array.isArray(registry.items) || registry.items.length === 0) {
    failures.push('registry.json must contain items');
  }

  const names = new Set();

  for (const item of registry.items ?? []) {
    if (item.name === THEME_ITEM_NAME) {
      if (names.has(item.name)) failures.push(`duplicate registry item ${item.name}`);
      names.add(item.name);
      checkThemeItem(item);
      continue;
    }

    for (const field of ['name', 'type', 'title', 'description', 'files']) {
      if (!item[field]) failures.push(`${item.name ?? '<unnamed>'} missing ${field}`);
    }

    if (names.has(item.name)) failures.push(`duplicate registry item ${item.name}`);
    names.add(item.name);

    if (item.type !== 'registry:ui') {
      failures.push(`${item.name} must retain its declared primitive type`);
    }

    if (!Array.isArray(item.files)) continue;

    for (const file of item.files) {
      if (!file.path) failures.push(`${item.name} has a file without path`);

      if (!file.type || !allowedFileTypes.has(file.type)) {
        failures.push(`${item.name}:${file.path ?? '<missing path>'} has invalid type`);
      }

      if (!file.target)
        failures.push(`${item.name}:${file.path ?? '<missing path>'} missing target`);

      // A drop-in set replaces shadcn/ui's own files, and only the stock files it ships.
      const dropin =
        DROPIN_SETS.some((set) => set.name === item.name) &&
        DROPIN_COMPONENTS.some((component) => file.target === `components/ui/${component}.tsx`);

      if (
        file.target &&
        !dropin &&
        !/^(components\/glassyui|styles\/glassyui|lib\/glassyui)\//.test(file.target)
      ) {
        failures.push(`${item.name}:${file.path} targets outside glassyui namespace`);
      }

      if (file.path) {
        const fullPath = path.join(root, file.path);

        if (!fs.existsSync(fullPath)) {
          failures.push(`${item.name}:${file.path} does not exist`);
        } else {
          checkRegistryFile(fullPath);
        }
      }
    }

    // A drop-in set installs by URL into an app with no registries mapping.
    if (DROPIN_SETS.some((set) => set.name === item.name) && item.registryDependencies) {
      failures.push(`${item.name} must not declare registryDependencies`);
    }

    for (const dependency of item.registryDependencies ?? []) {
      if (!registryDependencyPattern.test(dependency)) {
        failures.push(`${item.name} has non-namespaced registry dependency ${dependency}`);
        continue;
      }

      const dependencyName = dependency.replace('@glassyui/', '');

      if (!registry.items.some((candidate) => candidate.name === dependencyName)) {
        failures.push(`${item.name} references unknown registry dependency ${dependency}`);
      }
    }

    const generatedPath = path.join(root, 'public', 'r', `${item.name}.json`);

    if (!fs.existsSync(generatedPath)) {
      failures.push(`${item.name} is missing generated public/r/${item.name}.json`);
      continue;
    }

    const generated = readJson(generatedPath);

    if (!generated) continue;

    if (generated.registryDependencies !== undefined)
      failures.push(`${item.name} published payload requires a registry mapping`);

    if (!Array.isArray(generated.files) || generated.files.length === 0) {
      failures.push(`${item.name} generated payload has no files`);
      continue;
    }

    for (const file of generated.files) {
      // Missing or blank content is a failure; content that is not a string throws.
      if (!file.content?.trim()) {
        failures.push(`${item.name}:${file.path ?? '<missing path>'} is missing generated content`);
      }
    }
  }
}

if (failures.length) {
  console.error('Registry check failed:');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log('Registry check passed.');
