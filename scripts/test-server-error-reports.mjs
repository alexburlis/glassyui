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
  const cause = Object.assign(new RangeError(marker), { code: 'ECONNREFUSED' });
  Sentry.setUser({ id: marker, email: marker, ip_address: '192.0.2.10' });
  Sentry.setContext('private', { body: marker });
  Sentry.setTag('private', marker);
  Sentry.addBreadcrumb({ message: marker });
  Sentry.getCurrentScope().addAttachment({ filename: marker, data: marker });
  cause.stack = `RangeError: ${marker}\n    at dependency (${process.cwd()}/.next/server/chunks/dependency.js:7:3)`;
  const error = new TypeError(marker, { cause });
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
  assert.equal(event.exception.values.at(-1).type, 'TypeError');
  assert.equal(
    event.exception.values.at(-1).stacktrace.frames[0].filename,
    'app:///_next/server/chunks/render.js',
    'Keep the actual SDK rewrite for uploaded source-map matching.',
  );
  assert.equal(event.release, process.env.NEXT_PUBLIC_SENTRY_RELEASE);

  for (const key of ['request', 'user', 'contexts', 'extra', 'breadcrumbs', 'transaction'])
    assert.equal(event[key], undefined);

  const diagnosticChecks = {
    causeFrames: event.exception.values.some((value) =>
      value.stacktrace?.frames.some(
        (frame) => frame.filename === 'app:///_next/server/chunks/dependency.js',
      ),
    ),
    causeRelation:
      event.exception.values[0].mechanism?.parent_id === 0 &&
      event.exception.values[0].mechanism?.exception_id === 1 &&
      event.exception.values.at(-1).mechanism?.exception_id === 0,
    terminalOperation: event.tags.operation === 'render',
    nestedTransportCause: event.tags.failure_code === 'ECONNREFUSED',
  };

  // Same wrapper and source, different actual dependency cause; no string inference.
  const dns = Object.assign(new Error(marker), { code: 'ENOTFOUND' });
  dns.stack = cause.stack;
  const second = new TypeError(marker, { cause: dns });
  second.stack = error.stack;
  await onRequestError(
    second,
    { path: marker, method: 'GET', headers: {} },
    {
      routerKind: 'App Router',
      routePath: marker,
      routeType: 'route',
    },
  );
  await Sentry.flush(3000);
  assert.equal(wires.length, 2, 'Distinct terminal request errors each produce one logical event.');
  const secondEvent = JSON.parse(wires[1].split('\n')[2]);
  diagnosticChecks.distinctCause = secondEvent.tags.failure_code === 'ENOTFOUND';
  diagnosticChecks.isolatedOperation = secondEvent.tags.operation === 'route';
  assert.ok(
    wires.every((wire) => !wire.includes(marker)),
    'Nested evidence never exposes content.',
  );

  const overlap = ['render', 'route'].map((operation, index) => {
    const failure = new Error(marker);
    failure.stack = `Error: ${marker}\n    at overlapping (${process.cwd()}/.next/server/chunks/overlap-${index}.js:8:2)`;

    return onRequestError(
      failure,
      { path: marker, method: 'GET', headers: {} },
      {
        routerKind: 'App Router',
        routePath: marker,
        routeType: operation,
      },
    );
  });

  await Promise.all(overlap);
  await Sentry.flush(3000);
  assert.deepEqual(
    wires.slice(-2).map((wire) => JSON.parse(wire.split('\n')[2]).tags.operation),
    ['render', 'route'],
    'Overlapping requests keep their own terminal boundary.',
  );

  const cycle = Object.assign(new Error(marker), { code: marker });
  cycle.cause = cycle;
  let deep = Object.assign(new Error(marker), { code: 'ECONNRESET' });

  for (let depth = 0; depth < 6; depth += 1) deep = new Error(marker, { cause: deep });
  const inherited = Object.create({ code: 'ECONNREFUSED' });
  const accessor = {};
  Object.defineProperty(accessor, 'code', {
    get() {
      throw new Error(marker);
    },
  });

  for (const [index, invalidCause] of [cycle, deep, inherited, accessor].entries()) {
    const unknown = new Error(marker, { cause: invalidCause });
    unknown.stack = `Error: ${marker}\n    at processFailure (${process.cwd()}/.next/server/chunks/process.js:${index + 1}:3)`;
    Sentry.captureException(unknown);
    await Sentry.flush(3000);
    console.log(JSON.stringify({ case: index, wireCount: wires.length, expected: index + 5 }));
    const latest = JSON.parse(wires.at(-1).split('\n')[2]);
    assert.equal(
      latest.tags.operation,
      'unknown',
      'A process event cannot borrow a request scope.',
    );
    assert.equal(
      latest.tags.failure_code,
      'unknown',
      'Unestablished or out-of-bounds cause stays unknown.',
    );
    assert.ok(latest.exception.values.length <= 4, 'Cause frame carrier is bounded.');
  }

  assert.equal(wires.length, 8, 'Cause cycles/unknowns still retain the eligible terminal error.');

  for (const wire of wires) {
    assert.ok(
      !wire.includes(marker),
      'All final envelopes reject private scope/cause/attachment input.',
    );
    assert.deepEqual(Object.keys(JSON.parse(wire.split('\n')[0])), ['event_id']);
    assert.equal(JSON.parse(wire.split('\n')[1]).type, 'event');
    assert.equal(wire.trim().split('\n').length, 3, 'No attachment or usage items survive.');
  }

  console.log(JSON.stringify({ diagnosticChecks }));
  assert.ok(
    Object.values(diagnosticChecks).every(Boolean),
    'Final Node SDK wire retains bounded causal evidence.',
  );

  const result = {
    ok: true,
    checks: [
      'real Next request-error hook',
      'one logical event per terminal failure',
      'original cause frames, fixed operation and distinct nested transport codes',
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
