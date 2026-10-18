import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Exercise the release-routing contract through real Git history, including
// deletions, renames and bad revisions, rather than importing the classifier.
const scopeScript = fileURLToPath(new URL('./ci-scope.mjs', import.meta.url));

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'glassyui-ci-routing-'));

const previousOutput = process.env.GITHUB_OUTPUT;

const previousNeeds = process.env.CI_NEEDS;

const previousEvent = process.env.CI_EVENT;

const results = [];

process.env.GITHUB_OUTPUT = '';

function git(...args) {
  return execFileSync('git', args, { cwd: temporaryRoot, encoding: 'utf8' }).trim();
}

function write(file) {
  const destination = path.join(temporaryRoot, file);

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, 'routing fixture\n');
}

function route(event, base, head) {
  return spawnSync(process.execPath, [scopeScript, event, base, head], {
    cwd: temporaryRoot,
    encoding: 'utf8',
  });
}

function check(name, file, expected, event = 'pull_request') {
  const base = git('rev-parse', 'HEAD');

  const files = Array.isArray(file) ? file : [file];

  for (const changed of files) write(changed);
  git('add', '--', ...files);
  git('-c', 'commit.gpgsign=false', 'commit', '-qm', name);
  const head = git('rev-parse', 'HEAD');
  const result = route(event, base, head);

  assert.equal(result.status, 0, result.stderr);
  const actual = JSON.parse(result.stdout);

  for (const key of ['site', 'visual', 'native', 'theme', 'dropins']) {
    assert.equal(actual[key], expected[key] ?? key === 'site', `${name}: ${key}`);
  }

  results.push({ name, passed: true });
}

try {
  git('init', '-q');
  git('config', 'user.name', 'CI routing fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  write('README.md');
  git('add', '--', 'README.md');
  git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'Initial fixture');

  check('Documentation only', 'docs/install.md', { site: false });
  check('Root documentation only', 'CONTRIBUTING.md', { site: false });
  check('Issue template only', '.github/ISSUE_TEMPLATE/bug.yml', { site: false });
  check('Documentation on main', 'docs/main.md', { site: false }, 'push');

  for (const file of [
    'src/lib/analytics/browser.ts',
    'src/lib/diagnostics/browser.ts',
    'src/components/site/analytics-consent.tsx',
    'src/app/api/analytics-config/route.ts',
    'scripts/check-analytics-consent.mjs',
    'scripts/check-error-reports.mjs',
    'scripts/test-analytics-consent.mjs',
    'scripts/test-server-error-reports.mjs',
    'scripts/test-error-startup.mjs',
    'scripts/test-build-upload.mjs',
    'scripts/test-braces-security.mjs',
    'scripts/check-agent-discovery.mjs',
    'scripts/check-generated-registry.mjs',
    'scripts/check-registry.mjs',
    'scripts/smoke-docs-routes.mjs',
    'scripts/smoke-launch.mjs',
    'scripts/smoke-pro-links.mjs',
    'scripts/smoke-registry-routes.mjs',
  ]) {
    check(`Base-check input: ${file}`, file, {});
  }

  check(
    'Mixed documentation and privacy source',
    ['docs/mixed.md', 'src/lib/analytics/config.ts'],
    {},
  );
  check('App route behavior', 'src/app/page.tsx', { visual: true });
  check('Source-copy install proof changes', 'scripts/smoke-registry-install.mjs', {
    visual: true,
  });
  check('Visual proof changes', 'scripts/check-refraction-visuals.mjs', {
    visual: true,
    native: true,
    theme: true,
    dropins: true,
  });
  check('CI workflow changes', '.github/workflows/ci.yml', {
    visual: true,
    native: true,
    theme: true,
    dropins: true,
  });
  const empty = route('pull_request', git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD'));

  assert.equal(empty.status, 0, empty.stderr);
  assert.ok(
    ['site', 'visual', 'native', 'theme', 'dropins'].every(
      (key) => JSON.parse(empty.stdout)[key] === true,
    ),
  );
  results.push({ name: 'Empty diff stays conservative', passed: true });
  check('Web behavior', 'src/components/liquid/button.tsx', { visual: true });
  check('Native component', 'registry/glassyui-native/button.tsx', { native: true });
  check('Native docs example', 'fixtures/expo-consumer/usage/button.tsx', {
    visual: true,
    native: true,
  });
  check('Theme source', 'registry/glassyui/themes/glassy-theme.css', {
    visual: true,
    theme: true,
    dropins: true,
  });
  check('Drop-in source', 'registry/glassyui-shadcn/new-york/button.tsx', {
    visual: true,
    dropins: true,
  });
  check('Shared glass engine', 'registry/glassyui/lib/slab-optics.ts', {
    visual: true,
    theme: true,
    dropins: true,
  });

  for (const file of [
    'registry/glassyui/styles/liquid.css',
    'scripts/build-shadcn-theme.mjs',
    'fixtures/shadcn-theme-consumer/new-york/pnpm-lock.yaml',
  ]) {
    check(`Shared shadcn input: ${file}`, file, {
      visual: true,
      theme: true,
      dropins: true,
    });
  }

  check('Native payload', 'public/r/native/glass-button.json', { native: true });
  check('Drop-in payload', 'public/r/glassy-ui-new-york.json', {
    visual: true,
    dropins: true,
  });
  check('Toolchain lock', 'pnpm-lock.yaml', {
    visual: true,
    native: true,
    theme: true,
    dropins: true,
  });
  check('Unknown input', 'new-package/settings.json', {
    visual: true,
    native: true,
    theme: true,
    dropins: true,
  });
  check('Protected main uses prior candidate proof', 'src/app/layout.tsx', {}, 'push');
  check(
    'Release dispatch runs all consumers',
    'docs/release.md',
    {
      visual: true,
      native: true,
      theme: true,
      dropins: true,
    },
    'workflow_dispatch',
  );

  const beforeRename = git('rev-parse', 'HEAD');

  git('mv', 'registry/glassyui-native/button.tsx', 'docs/renamed-native.md');
  git('-c', 'commit.gpgsign=false', 'commit', '-qam', 'Rename native into docs');
  const renamed = route('pull_request', beforeRename, git('rev-parse', 'HEAD'));

  assert.equal(renamed.status, 0, renamed.stderr);
  assert.equal(JSON.parse(renamed.stdout).native, true, 'Renames must include old input');
  results.push({ name: 'Renamed native input', passed: true });

  const beforeDelete = git('rev-parse', 'HEAD');

  git('rm', '-q', '--', 'registry/glassyui-shadcn/new-york/button.tsx');
  git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'Delete drop-in');
  const deleted = route('pull_request', beforeDelete, git('rev-parse', 'HEAD'));

  assert.equal(deleted.status, 0, deleted.stderr);
  assert.equal(JSON.parse(deleted.stdout).dropins, true, 'Deleted inputs still need coverage');
  results.push({ name: 'Deleted drop-in input', passed: true });

  for (const [name, event, base] of [
    ['Unknown event', 'pull_request_target', beforeDelete],
    ['Missing revision', 'pull_request', 'f'.repeat(40)],
    ['Invalid revision', 'pull_request', 'HEAD; exit 0'],
  ]) {
    const rejected = route(event, base, git('rev-parse', 'HEAD'));

    assert.notEqual(rejected.status, 0, `${name} must fail visibly`);
    results.push({ name, passed: true });
  }

  const gateScript = fileURLToPath(new URL('./ci-release-gate.mjs', import.meta.url));

  const passing = {
    changes: {
      result: 'success',
      outputs: {
        site: 'false',
        visual: 'false',
        native: 'false',
        theme: 'false',
        dropins: 'false',
      },
    },
    'site-checks': { result: 'success' },
    'install-smoke': { result: 'skipped' },
    'native-consumer': { result: 'skipped' },
    'shadcn-consumers': { result: 'skipped' },
    'release-smokes': { result: 'skipped' },
    'release-install': { result: 'skipped' },
    'release-visuals': { result: 'skipped' },
    'release-material': { result: 'skipped' },
    'release-ui': { result: 'skipped' },
  };

  const allSelected = {
    result: 'success',
    outputs: { site: 'true', visual: 'true', native: 'true', theme: 'true', dropins: 'true' },
  };

  const releaseParts = Object.fromEntries(
    ['release-smokes', 'release-install', 'release-visuals', 'release-material', 'release-ui'].map(
      (job) => [job, { result: 'success' }],
    ),
  );

  for (const [name, needs, expectedPass, event = 'pull_request'] of [
    ['Documentation-only site job succeeds without consumers', passing, true],
    [
      'Base site checks succeed without consumers',
      {
        ...passing,
        changes: { result: 'success', outputs: { ...passing.changes.outputs, site: 'true' } },
      },
      true,
    ],
    ...['site', 'visual', 'native', 'theme', 'dropins'].map((key) => [
      `Missing ${key} output rejects release`,
      {
        ...passing,
        changes: { result: 'success', outputs: { ...passing.changes.outputs, [key]: undefined } },
      },
      false,
    ]),
    [
      'Invalid site output rejects release',
      {
        ...passing,
        changes: { result: 'success', outputs: { ...passing.changes.outputs, site: 'yes' } },
      },
      false,
    ],
    [
      'Visual work requires site checks',
      {
        ...passing,
        changes: { result: 'success', outputs: { ...passing.changes.outputs, visual: 'true' } },
      },
      false,
    ],
    ['Skipped site rejects release', { ...passing, 'site-checks': { result: 'skipped' } }, false],
    ['Failed site rejects release', { ...passing, 'site-checks': { result: 'failure' } }, false],
    ['Cancelled scope rejects release', { ...passing, changes: { result: 'cancelled' } }, false],
    ['Missing jobs reject release', {}, false],
    [
      'Needed native cannot skip',
      {
        ...passing,
        changes: {
          result: 'success',
          outputs: {
            site: 'true',
            visual: 'false',
            native: 'true',
            theme: 'false',
            dropins: 'false',
          },
        },
      },
      false,
    ],
    [
      'Needed theme cannot skip',
      {
        ...passing,
        changes: {
          result: 'success',
          outputs: {
            site: 'true',
            visual: 'true',
            native: 'false',
            theme: 'true',
            dropins: 'false',
          },
        },
      },
      false,
    ],
    [
      'All consumers passed',
      {
        ...passing,
        changes: allSelected,
        'install-smoke': { result: 'success' },
        'native-consumer': { result: 'success' },
        'shadcn-consumers': { result: 'success' },
      },
      true,
    ],
    [
      'Visual pull request needs the install smoke',
      {
        ...passing,
        changes: allSelected,
        'native-consumer': { result: 'success' },
        'shadcn-consumers': { result: 'success' },
      },
      false,
    ],
    [
      'Release dispatch needs every release part',
      {
        ...passing,
        changes: allSelected,
        'native-consumer': { result: 'success' },
        'shadcn-consumers': { result: 'success' },
      },
      false,
      'workflow_dispatch',
    ],
    [
      'Release dispatch passes with every part',
      {
        ...passing,
        ...releaseParts,
        changes: allSelected,
        'native-consumer': { result: 'success' },
        'shadcn-consumers': { result: 'success' },
      },
      true,
      'workflow_dispatch',
    ],
    [
      'A failed release part rejects the sweep',
      {
        ...passing,
        ...releaseParts,
        changes: allSelected,
        'native-consumer': { result: 'success' },
        'shadcn-consumers': { result: 'success' },
        'release-ui': { result: 'failure' },
      },
      false,
      'workflow_dispatch',
    ],
    ['Unknown event rejects release', passing, false, 'pull_request_target'],
  ]) {
    process.env.CI_NEEDS = JSON.stringify(needs);
    process.env.CI_EVENT = event;
    const gate = spawnSync(process.execPath, [gateScript], { encoding: 'utf8' });

    assert.equal(gate.status === 0, expectedPass, name);
    results.push({ name, passed: true });
  }

  console.log(JSON.stringify({ status: 'pass', checks: results.length, results }, null, 2));
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });

  if (previousOutput === undefined) delete process.env.GITHUB_OUTPUT;
  else process.env.GITHUB_OUTPUT = previousOutput;

  if (previousNeeds === undefined) delete process.env.CI_NEEDS;
  else process.env.CI_NEEDS = previousNeeds;

  if (previousEvent === undefined) delete process.env.CI_EVENT;
  else process.env.CI_EVENT = previousEvent;
}
