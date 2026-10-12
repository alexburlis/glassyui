import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import './register-tsx.mjs';

const require = createRequire(import.meta.url);

const wires = [];

const server = http.createServer((request, response) => {
  if (request.method !== 'POST' || request.url?.split('?')[0] !== '/api/1/envelope/') {
    response.writeHead(404);
    response.end();

    return;
  }

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

process.env.NEXT_PUBLIC_SENTRY_DSN = `http://0123456789abcdef0123456789abcdef@127.0.0.1:${server.address().port}/1`;

process.env.NEXT_PUBLIC_SENTRY_RELEASE = `glassyui@${'a'.repeat(40)}`;

process.env.NODE_ENV = 'production';

// The real Sentry build plugin injects this dist directory into the server artifact.
process.env._sentryRewriteFramesDistDir = '.next';

const Sentry = require('@sentry/nextjs');

const marker = 'PRIVATE_SERVER_SENTINEL_password_customer_body';

try {
  // A local health probe must not count as a diagnostic envelope.
  await fetch(`http://127.0.0.1:${server.address().port}/`);
  require('../src/sentry.server.config.ts');
  const { onRequestError } = require('../src/instrumentation.ts');
  const error = new TypeError(marker);
  error.stack = `TypeError: ${marker}\n    at render (${process.cwd()}/.next/server/chunks/render.js:12:6)`;
  await onRequestError(
    error,
    {
      path: `/components?password=${marker}`,
      method: 'GET',
      headers: { cookie: marker, authorization: marker },
    },
    { routerKind: 'App Router', routePath: '/components', routeType: 'render' },
  );
  await Sentry.flush(3000);
  assert.equal(wires.length, 1, 'Actual Next request-error owner sends one event.');
  assert.ok(
    !wires[0].includes(marker),
    'Final SDK wire excludes error text, request headers, query, context and breadcrumbs.',
  );
  const event = JSON.parse(wires[0].split('\n')[2]);
  assert.equal(event.tags.runtime, 'server');
  assert.equal(event.sdk.settings.infer_ip, 'never');
  assert.equal(event.exception.values[0].type, 'TypeError');
  assert.equal(
    event.exception.values[0].stacktrace.frames[0].filename,
    'app:///_next/server/chunks/render.js',
    'Keep the actual SDK rewrite for uploaded source-map matching.',
  );
  assert.equal(event.release, process.env.NEXT_PUBLIC_SENTRY_RELEASE);

  for (const key of ['request', 'user', 'contexts', 'extra', 'breadcrumbs', 'transaction'])
    assert.equal(event[key], undefined);

  const result = {
    ok: true,
    checks: [
      'real Next request-error hook',
      'one event',
      'final serialized privacy and release identity',
      'no usage/session/trace/replay envelope',
    ],
  };

  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await Sentry.close(1000);
  await new Promise((resolve) => server.close(resolve));
}
