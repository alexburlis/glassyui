import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import './register-tsx.mjs';

// Exercise the installed browser SDK and real capture owner in an isolated DOM.
// No production export, route, switch or fake Sentry client is added for this proof.
const require = createRequire(import.meta.url);

const wires = [];

const server = http.createServer((request, response) => {
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
  });
  request.on('end', () => {
    wires.push(body);
    response.end('{}');
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

const origin = `http://127.0.0.1:${server.address().port}`;

const dom = new JSDOM('<html><body></body></html>', { url: origin });

for (const key of ['window', 'document', 'navigator', 'location', 'Event']) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
}

process.env.NODE_ENV = 'production';

process.env.NEXT_PUBLIC_SENTRY_DSN = `http://0123456789abcdef0123456789abcdef@127.0.0.1:${server.address().port}/1`;

process.env.NEXT_PUBLIC_SENTRY_RELEASE = `glassyui@${'a'.repeat(40)}`;

const packageDirectory = path.dirname(require.resolve('@sentry/nextjs/package.json'));

const browserSdk = require(path.join(packageDirectory, 'build/cjs/client/index.js'));

// CommonJS loader selects the server export by default. Select the actual browser
// export for this browser-owner test; SDK implementation and transport remain real.
const entry = require.resolve('@sentry/nextjs');

require.cache[entry] = { id: entry, filename: entry, loaded: true, exports: browserSdk };

const owner = require('../src/lib/diagnostics/browser.ts');

try {
  assert.ok(owner.chooseErrorReports(true));
  const initializing = owner.syncErrorReports();
  const cause = Object.assign(new RangeError('PRIVATE_STARTUP_SENTINEL'), { code: 'ECONNRESET' });
  cause.stack = `RangeError: PRIVATE_STARTUP_SENTINEL\n    at dependency (${origin}/_next/static/dependency.js:7:3)`;
  const failure = new TypeError('PRIVATE_STARTUP_SENTINEL', { cause });
  failure.stack = `TypeError: PRIVATE_STARTUP_SENTINEL\n    at render (${origin}/_next/static/root.js:12:6)`;
  await owner.captureRenderError(failure);
  await initializing;
  await browserSdk.flush(3000);
  assert.equal(
    wires.length,
    1,
    'A root render failure during the consented SDK import must survive initialization.',
  );
  assert.ok(!wires[0].includes('PRIVATE_STARTUP_SENTINEL'));
  const event = JSON.parse(wires[0].split('\n')[2]);

  const diagnosticChecks = {
    originalCauseFrames: event.exception.values.some((value) =>
      value.stacktrace?.frames.some(
        (frame) => frame.filename === `${origin}/_next/static/dependency.js`,
      ),
    ),
    renderBoundary: event.tags.operation === 'render',
    transportCause: event.tags.failure_code === 'ECONNRESET',
  };

  console.log(JSON.stringify({ diagnosticChecks }));
  assert.ok(
    Object.values(diagnosticChecks).every(Boolean),
    'Final browser SDK wire retains bounded causal evidence.',
  );
  assert.ok(owner.chooseErrorReports(true));
  const pending = owner.syncErrorReports();
  owner.chooseErrorReports(false);
  await pending;
  await owner.captureRenderError(new Error('AFTER_WITHDRAWAL_SENTINEL'));
  await browserSdk.flush(1000);
  assert.equal(
    wires.length,
    1,
    'Withdrawal invalidates an in-flight SDK startup and its error capture.',
  );
  owner.chooseErrorReports(true);
  const stale = new SyntaxError('STALE_AFTER_WITHDRAWAL_SENTINEL');
  stale.stack = `SyntaxError: STALE_AFTER_WITHDRAWAL_SENTINEL\n    at render (${origin}/_next/static/root.js:24:6)`;
  const queued = owner.captureRenderError(stale);
  owner.chooseErrorReports(false);
  owner.chooseErrorReports(true);
  await Promise.all([queued, owner.syncErrorReports()]);
  await browserSdk.flush(3000);
  assert.equal(
    wires.length,
    1,
    'Immediate re-acceptance must not revive a capture discarded by withdrawal.',
  );

  const otherDocument = new JSDOM('<html><body></body></html>', {
    url: origin,
    cookieJar: dom.cookieJar,
  });

  try {
    const acrossTabs = new RangeError('OTHER_TAB_WITHDRAWAL_SENTINEL');
    acrossTabs.stack = `RangeError: OTHER_TAB_WITHDRAWAL_SENTINEL\n    at render (${origin}/_next/static/root.js:36:6)`;
    const queuedAcrossTabs = owner.captureRenderError(acrossTabs);
    const now = Date.now();

    for (const decision of ['rejected', 'accepted']) {
      const preference = {
        decision,
        version: 'errors-v1',
        purpose: 'errors',
        updatedAt: now,
        expiresAt: now + 180 * 86400000,
        revision: `other-tab-${decision}`,
      };

      otherDocument.window.document.cookie = `glassy-ui-error-reports=${encodeURIComponent(JSON.stringify(preference))}; Path=/`;
    }

    await queuedAcrossTabs;
    await browserSdk.flush(3000);
    assert.equal(
      wires.length,
      1,
      'Withdrawal and re-acceptance in another document must invalidate a queued capture.',
    );
    browserSdk.captureException(acrossTabs);
    await browserSdk.flush(3000);
    assert.equal(
      wires.length,
      1,
      'The prior client cannot send under a different consent revision.',
    );
    await owner.syncErrorReports();
    const fresh = new ReferenceError('NEW_CONSENT_SENTINEL');
    fresh.stack = `ReferenceError: NEW_CONSENT_SENTINEL\n    at render (${origin}/_next/static/root.js:48:6)`;
    await owner.captureRenderError(fresh);
    await browserSdk.flush(3000);
    assert.equal(wires.length, 2, 'A new consent revision still permits new errors.');
    assert.ok(!wires[1].includes('NEW_CONSENT_SENTINEL'));
  } finally {
    otherDocument.window.close();
  }

  console.log(
    JSON.stringify({
      ok: true,
      checks: [
        'root error during real SDK startup',
        'withdrawal during initialization',
        'withdrawal followed by immediate re-acceptance does not revive old captures',
        'shared-cookie withdrawal invalidates captures and the prior client',
        'new consent revision permits new errors',
        'final wire privacy',
      ],
    }),
  );
} finally {
  await browserSdk.close(1000);
  dom.window.close();
  await new Promise((resolve) => server.close(resolve));
}
