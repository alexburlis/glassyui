import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootRequire = createRequire(import.meta.url);

const configRequire = createRequire(rootRequire.resolve('eslint-config-next'));

const pluginRequire = createRequire(configRequire.resolve('@next/eslint-plugin-next'));

const fastGlobPath = pluginRequire.resolve('fast-glob');

const fastGlobRequire = createRequire(fastGlobPath);

const micromatchPath = fastGlobRequire.resolve('micromatch');

const micromatchRequire = createRequire(micromatchPath);

const braces = micromatchRequire('braces');

const micromatch = fastGlobRequire('micromatch');

const fastGlob = fastGlobRequire('fast-glob');

const MAX_NESTING = 100;

const MAX_INPUT_LENGTH = 10_000;

const WORKER_TIMEOUT_MS = 5_000;

const SCRIPT_PATH = fileURLToPath(import.meta.url);

function nestedBraces(depth) {
  let pattern = 'a,b';

  for (let index = 0; index < depth; index += 1) {
    pattern = `{a,${pattern}}`;
  }

  return pattern;
}

function nestedMixed(depth) {
  let pattern = 'a,b';

  for (let index = 0; index < depth; index += 1) {
    pattern = index % 2 === 0 ? `(${pattern})` : `{a,${pattern}}`;
  }

  return pattern;
}

function nestedAst(depth) {
  const root = { type: 'root', nodes: [] };
  let current = root;

  for (let index = 0; index < depth; index += 1) {
    const child = { type: 'branch', nodes: [] };
    current.nodes.push(child);
    current = child;
  }

  current.nodes.push({ type: 'text', value: 'x' });

  return root;
}

function cyclicAst() {
  const root = { type: 'root', nodes: [] };
  root.nodes.push(root);

  return root;
}

function sharedAst() {
  const text = { type: 'text', value: 'x' };

  return { type: 'root', nodes: [text, text] };
}

function requireSyntaxError(operation) {
  assert.throws(operation, SyntaxError);
}

function assertUnderInputLimit(pattern) {
  assert.ok(pattern.length < MAX_INPUT_LENGTH);
}

const scenarios = {
  'brace-string-parse': () => {
    const pattern = nestedBraces(MAX_NESTING + 1);
    assertUnderInputLimit(pattern);
    requireSyntaxError(() => braces.parse(pattern));
  },
  'paren-string-compile': () => {
    const depth = 4_500;
    const pattern = '('.repeat(depth) + 'x' + ')'.repeat(depth);
    assertUnderInputLimit(pattern);
    requireSyntaxError(() => braces.compile(pattern));
  },
  'mixed-string-expand': () => {
    const pattern = nestedMixed(MAX_NESTING + 1);
    assertUnderInputLimit(pattern);
    requireSyntaxError(() => braces.expand(pattern));
  },
  'unmatched-brace-stringify': () => {
    const pattern = '{a,'.repeat(MAX_NESTING + 1) + 'x';
    assertUnderInputLimit(pattern);
    requireSyntaxError(() => braces.stringify(pattern));
  },
  'unmatched-paren-parse': () => {
    const pattern = '('.repeat(MAX_NESTING + 1) + 'x';
    assertUnderInputLimit(pattern);
    requireSyntaxError(() => braces.parse(pattern));
  },
  'depth-option-cannot-disable-cap': () => {
    const pattern = nestedBraces(MAX_NESTING + 1);
    assertUnderInputLimit(pattern);
    requireSyntaxError(() => braces.parse(pattern, { maxDepth: Infinity }));
  },
  'direct-ast-compile-depth': () => {
    requireSyntaxError(() => braces.compile(nestedAst(10_000)));
  },
  'direct-ast-expand-depth': () => {
    requireSyntaxError(() => braces.expand(nestedAst(10_000)));
  },
  'direct-ast-stringify-depth': () => {
    requireSyntaxError(() => braces.stringify(nestedAst(10_000)));
  },
  'direct-ast-compile-cycle': () => {
    requireSyntaxError(() => braces.compile(cyclicAst()));
  },
  'direct-ast-expand-cycle': () => {
    requireSyntaxError(() => braces.expand(cyclicAst()));
  },
  'direct-ast-stringify-cycle': () => {
    requireSyntaxError(() => braces.stringify(cyclicAst()));
  },
  'expand-parent-cycle': () => {
    const child = { type: 'paren', nodes: [] };
    child.parent = child;
    requireSyntaxError(() => braces.expand({ type: 'root', nodes: [child] }));
  },
  'shared-subtree': () => {
    const ast = sharedAst();
    assert.equal(braces.compile(ast), 'xx');
    assert.deepEqual(braces.expand(ast), ['xx']);
    assert.equal(braces.stringify(ast), 'xx');
  },
  'valid-glob-consumers': () => {
    const expanded = micromatch.braces('src/components/button.{tsx,ts}', {
      expand: true,
    });

    assert.deepEqual(expanded.sort(), ['src/components/button.ts', 'src/components/button.tsx']);

    const fixture = mkdtempSync(join(tmpdir(), 'braces-security-'));

    try {
      const components = join(fixture, 'src', 'components');
      mkdirSync(components, { recursive: true });
      writeFileSync(join(components, 'button.ts'), 'export {}');
      writeFileSync(join(components, 'button.tsx'), 'export {}');
      const matches = fastGlob.sync('src/**/button.{tsx,ts}', { cwd: fixture }).sort();
      assert.deepEqual(matches, ['src/components/button.ts', 'src/components/button.tsx']);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  },
};

function runScenario(name) {
  const scenario = scenarios[name];
  assert.ok(scenario, 'unknown braces security scenario');
  scenario();
}

if (process.argv[2] === '--case') {
  try {
    runScenario(process.argv[3]);
  } catch (error) {
    process.stderr.write(`${process.argv[3]} failed: ${error.name}
`);
    process.exitCode = 1;
  }
} else {
  let failed = 0;

  for (const name of Object.keys(scenarios)) {
    const result = spawnSync(process.execPath, [SCRIPT_PATH, '--case', name], {
      encoding: 'utf8',
      timeout: WORKER_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
      env: { PATH: process.env.PATH },
    });

    if (result.status !== 0) {
      process.stderr.write(`${name}: failed or timed out
`);
      failed += 1;
    }
  }

  if (failed > 0) {
    process.stderr.write(`${failed} of ${Object.keys(scenarios).length} scenarios failed
`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`${Object.keys(scenarios).length} braces security scenarios passed
`);
  }
}
