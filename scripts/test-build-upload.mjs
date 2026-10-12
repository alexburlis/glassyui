import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import './register-tsx.mjs';

// Release-contract failure modes: release creation fails; source-map upload fails
// after release creation; tokenless local builds still work; provider text stays private.
// Use the real Next configuration and installed SDK post-compile hook. Only the
// supported SENTRY_BINARY_PATH process boundary supplies a deterministic failure.
const require = createRequire(import.meta.url);

const scriptPath = fileURLToPath(import.meta.url);

const projectDirectory = path.resolve(path.dirname(scriptPath), '..');

const privateMarker = 'PRIVATE_BUILD_UPLOAD_PROVIDER_SENTINEL';

const safeFailure = 'Sentry release or source-map upload failed.';

if (process.argv[2] === '--worker') {
  const config = require(path.join(projectDirectory, 'next.config.ts')).default;

  assert.ok(config.compiler?.runAfterProductionCompile, 'The configured build hook must exist.');
  await config.compiler.runAfterProductionCompile({
    distDir: process.argv[3],
    projectDir: projectDirectory,
  });
} else {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'glassyui-build-upload-'));

  const checks = [];

  const failures = [];

  // This script owns only this new directory: CLI stub, tiny output fixtures and
  // command journals are disposable. An optional result file stays outside it.
  try {
    fs.symlinkSync(path.join(projectDirectory, 'node_modules'), path.join(scratch, 'node_modules'));
    const binaryPath = path.join(scratch, 'sentry-cli');

    fs.writeFileSync(
      binaryPath,
      `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const operation = args.slice(0, 2).join(' ');
const failed = operation === process.env.GLASSYUI_UPLOAD_FAILURE;
fs.appendFileSync(process.env.GLASSYUI_UPLOAD_CALLS, JSON.stringify({ operation, failed }) + '\\n');
if (failed) {
  process.stderr.write('${privateMarker}\\n');
  process.exit(64);
}
`,
      { mode: 0o700 },
    );

    for (const scenario of ['release-creation', 'source-map-upload', 'local-no-upload']) {
      const directory = path.join(scratch, scenario);

      const distDir = path.join(directory, '.next');

      const mapPath = path.join(distDir, 'static/chunks/regression.js.map');

      const journalPath = path.join(directory, 'cli-calls.jsonl');

      fs.mkdirSync(path.dirname(mapPath), { recursive: true });
      fs.mkdirSync(path.join(distDir, 'server'));
      fs.writeFileSync(
        path.join(distDir, 'static/chunks/regression.js'),
        'console.log("fixture");\n',
      );

      const sourceMap = JSON.stringify({
        version: 3,
        sources: ['regression.ts'],
        sourcesContent: ['console.log("fixture");'],
        names: [],
        mappings: '',
      });

      fs.writeFileSync(mapPath, sourceMap);

      const failureOperation =
        scenario === 'release-creation' ? 'releases new' : 'sourcemaps upload';

      // Do not inherit credentials, provider settings or Node preload hooks.
      // The SDK reads its build env file relative to this isolated working directory.
      const environment = {
        PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
        NODE_ENV: 'production',
        TURBOPACK: '1',
        NEXT_TELEMETRY_DISABLED: '1',
        SOURCE_COMMIT: 'a'.repeat(40),
        SENTRY_BINARY_PATH: binaryPath,
        GLASSYUI_UPLOAD_FAILURE: failureOperation,
        GLASSYUI_UPLOAD_CALLS: journalPath,
      };

      if (scenario !== 'local-no-upload')
        environment.SENTRY_AUTH_TOKEN = 'LOCAL_ONLY_AUTH_SENTINEL';

      const child = spawnSync(process.execPath, [scriptPath, '--worker', distDir], {
        cwd: scratch,
        env: environment,
        encoding: 'utf8',
        timeout: 15000,
        maxBuffer: 1024 * 1024,
      });

      assert.ifError(child.error);
      assert.equal(child.signal, null, `${scenario}: the worker must exit normally.`);
      const output = `${child.stdout}${child.stderr}`;

      const calls = fs.existsSync(journalPath)
        ? fs.readFileSync(journalPath, 'utf8').trim().split('\n').map(JSON.parse)
        : [];

      assert.ok(
        !output.includes(privateMarker),
        `${scenario}: provider text reached public output.`,
      );
      assert.ok(
        !output.includes('LOCAL_ONLY_AUTH_SENTINEL'),
        `${scenario}: the auth-token sentinel reached public output.`,
      );

      if (scenario === 'local-no-upload') {
        assert.equal(child.status, 0, 'Tokenless local post-compile processing must succeed.');
        assert.equal(calls.length, 0, 'A tokenless local build must never invoke Sentry CLI.');
        checks.push({ scenario, exitCode: child.status, cliCalls: 0, passed: true });
        continue;
      }

      assert.ok(
        calls.some((call) => call.operation === failureOperation && call.failed),
        `${scenario}: the intended CLI failure must be reached.`,
      );

      if (scenario === 'source-map-upload') {
        assert.ok(
          calls.some((call) => call.operation === 'releases new' && !call.failed),
          'The upload-failure case must first create its release successfully.',
        );
      }

      const mapsPreserved =
        fs.existsSync(mapPath) && fs.readFileSync(mapPath, 'utf8') === sourceMap;

      const rejectedSafely = child.status !== 0 && output.includes(safeFailure);

      const passed = rejectedSafely && mapsPreserved;

      checks.push({ scenario, exitCode: child.status, rejectedSafely, mapsPreserved, passed });

      if (!passed) {
        failures.push(
          `${scenario}: expected a content-free build rejection with source maps preserved; ` +
            `exit=${child.status}, safeFailure=${rejectedSafely}, mapsPreserved=${mapsPreserved}`,
        );
      }
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
    assert.ok(!fs.existsSync(scratch), 'Task-owned scratch must be removed.');
  }

  const result = {
    ok: failures.length === 0,
    surface:
      'real Next configuration and installed Sentry post-compile hook; local CLI process stub',
    checks,
    failures,
    storage: { scratch, removed: true },
  };

  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  assert.equal(failures.length, 0, failures.join('\n'));
}
