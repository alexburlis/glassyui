import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';

const baseUrl = new URL(process.argv[2] ?? 'http://127.0.0.1:3000');

const artifactDirectory = path.resolve(process.argv[3] ?? '.artifacts/agent-discovery');

const requests = [];

const checks = [];

const proHost = 'pro.glassyui.com';

function noPrivateContent(body, label) {
  for (const pattern of [
    /buy\.stripe\.com\//,
    /No Pro template has shipped yet/,
    /Glassy UI Pro license/,
    /pro-template-parts/,
  ]) {
    assert.doesNotMatch(body, pattern, `${label}: no private Pro content`);
  }
}

async function read(route, accept, method = 'GET', host, extraHeaders = {}) {
  const headers = { ...extraHeaders };

  if (accept) headers.Accept = accept;

  if (host) headers.Host = host;

  const options = {
    headers,
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
  };

  const url = new URL(route, baseUrl);

  assert.equal(url.origin, baseUrl.origin, 'Discovery requests must stay on the public server');

  // Fetch ignores Host overrides. Keep the network endpoint on this public server instead of Pro.
  const response = host
    ? await new Promise((resolve, reject) => {
        const client = url.protocol === 'https:' ? https : http;

        const request = client.request(url, options, (incoming) => {
          const chunks = [];
          incoming.on('data', (chunk) => chunks.push(chunk));
          incoming.on('error', reject);
          incoming.on('end', () => {
            const responseHeaders = new Headers();

            for (const [key, value] of Object.entries(incoming.headers)) {
              for (const entry of Array.isArray(value) ? value : [value]) {
                if (entry) responseHeaders.append(key, entry);
              }
            }

            resolve(
              new Response(Buffer.concat(chunks), {
                status: incoming.statusCode,
                headers: responseHeaders,
              }),
            );
          });
        });

        request.on('error', reject);
        request.end();
      })
    : await fetch(url, options);

  const body = await response.text();

  requests.push({
    route,
    accept: accept ?? null,
    method,
    host: host ?? null,
    extraHeaders,
    status: response.status,
    contentType: response.headers.get('content-type'),
    vary: response.headers.get('vary'),
    link: response.headers.get('link'),
    cacheControl: response.headers.get('cache-control'),
    location: response.headers.get('location'),
    bodySha256: createHash('sha256').update(body).digest('hex'),
  });

  return { response, body };
}

async function check(name, run) {
  try {
    await run();
    checks.push({ name, passed: true });
  } catch (error) {
    checks.push({ name, passed: false, error: error.message });
  }
}

await check('Homepage advertises reachable agent resources', async () => {
  const { response } = await read('/');
  assert.equal(response.status, 200);
  const link = response.headers.get('link') ?? '';

  const resources = [
    ...link.matchAll(
      /<([^>]+)>;\s*rel="(describedby|service-doc|service-desc)"(?:;\s*type="([^"]+)")?/g,
    ),
  ];

  assert.ok(resources.some((resource) => resource[2] === 'describedby'));
  assert.ok(resources.some((resource) => resource[2] === 'service-doc'));

  for (const [, href, relation, type] of resources) {
    const { response: resource, body } = await read(href);
    assert.equal(resource.status, 200, href);

    if (type) assert.ok(resource.headers.get('content-type')?.startsWith(type), href);
    assert.ok(body.length > 0, href);

    if (relation === 'service-desc') assert.ok(JSON.parse(body).items.length > 0);
  }
});

for (const [accept, mediaType] of [
  ['text/markdown', 'text/markdown'],
  ['text/markdown; q=1, text/html; q=0.5', 'text/markdown'],
  ['text/html, text/markdown', 'text/markdown'],
  ['TEXT/MARKDOWN; Q=0.8, text/html;q=0.2', 'text/markdown'],
  ['application/json, text/markdown;q=0.5', 'text/markdown'],
  ['text/markdown;q=0', 'text/html'],
  ['text/markdown;q=0.2, text/html;q=0.8', 'text/html'],
  ['text/markdown;q=0.2, */*;q=0.8', 'text/html'],
  ['text/html', 'text/html'],
  ['*/*', 'text/html'],
]) {
  await check(`Accept ${accept} returns ${mediaType}`, async () => {
    const { response, body } = await read('/', accept);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type')?.startsWith(mediaType));
    assert.ok(
      response.headers
        .get('vary')
        ?.toLowerCase()
        .split(/\s*,\s*/)
        .includes('accept'),
    );

    if (mediaType === 'text/markdown') {
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.ok(body.includes('Glass without'));
      assert.ok(body.includes('/components'));
      assert.ok(!body.includes('<html'));
      assert.ok(response.headers.get('link')?.includes('rel="describedby"'));
    }
  });
}

await check('HTML remains the default after Markdown requests', async () => {
  const { response, body } = await read('/');
  assert.equal(response.status, 200);
  assert.ok(response.headers.get('content-type')?.startsWith('text/html'));
  assert.ok(body.includes('<html'));

  const vary = response.headers
    .get('vary')
    ?.toLowerCase()
    .split(/\s*,\s*/);

  assert.ok(vary?.includes('accept'));
  assert.ok(vary?.includes('rsc'));
});

await check('HEAD negotiates Markdown without a body', async () => {
  const { response, body } = await read('/', 'text/markdown', 'HEAD');
  assert.equal(response.status, 200);
  assert.ok(response.headers.get('content-type')?.startsWith('text/markdown'));
  assert.equal(body, '');
});

await check('Registry JSON stays JSON when Markdown is requested', async () => {
  const { response, body } = await read('/r/registry.json', 'text/markdown');
  assert.equal(response.status, 200);
  assert.ok(response.headers.get('content-type')?.startsWith('application/json'));
  assert.ok(JSON.parse(body).items.length > 0);
});

await check('RSC requests retain their component format under Markdown Accept', async () => {
  const { response } = await read('/?_rsc', 'text/markdown', 'GET', undefined, { RSC: '1' });
  assert.equal(response.status, 200);
  assert.ok(response.headers.get('content-type')?.startsWith('text/x-component'));
});

await check('Pro robots redirects to the fixed external origin', async () => {
  const { response, body } = await read('/pro/robots.txt', 'text/markdown', 'GET', 'glassyui.com');
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), 'https://pro.glassyui.com/robots.txt');
  noPrivateContent(body, '/pro/robots.txt');
});

for (const route of ['/pro', '/pro/license']) {
  for (const method of ['GET', 'HEAD']) {
    for (const [format, accept, extraHeaders] of [
      ['HTML', 'text/html', {}],
      ['Markdown', 'text/markdown', {}],
      ['RSC', 'text/markdown', { RSC: '1' }],
    ]) {
      await check(
        `${method} ${route} with ${format} redirects without private content`,
        async () => {
          const { response, body } = await read(route, accept, method, undefined, extraHeaders);
          assert.equal(response.status, 308);
          assert.equal(
            response.headers.get('location'),
            `https://pro.glassyui.com${route.slice('/pro'.length) || '/'}`,
          );
          noPrivateContent(body, route);

          if (method === 'HEAD') assert.equal(body, '');
        },
      );
    }
  }
}

for (const [route, extraHeaders] of [
  ['/api/markdown?path=/pro', {}],
  ['/api/markdown', { 'x-glassyui-markdown-path': '/pro' }],
]) {
  for (const method of ['GET', 'HEAD']) {
    await check(`${method} ${route} passes the external Pro redirect without a body`, async () => {
      const { response, body } = await read(
        route,
        'text/markdown',
        method,
        undefined,
        extraHeaders,
      );

      assert.equal(response.status, 308);
      assert.equal(response.headers.get('location'), 'https://pro.glassyui.com/');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(body, '');
    });
  }
}

await check('The public server no longer serves the Pro share image', async () => {
  const { response } = await read('/share/pro.jpg');
  assert.equal(response.status, 404);
});

for (const accept of ['text/html', 'text/markdown']) {
  await check(`Host ${proHost} still serves the free homepage as ${accept}`, async () => {
    const { response, body } = await read('/', accept, 'GET', proHost);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type')?.startsWith(accept));
    assert.ok(body.includes('Glass without'));
    assert.ok(response.headers.get('link')?.includes('rel="service-doc"'));
    assert.ok(!response.headers.get('link')?.includes('rel="payment"'));
    noPrivateContent(body, proHost);
  });
}

for (const [route, text] of [
  ['/docs', 'Add Glassy UI to your app'],
  ['/components/glass-button', 'Glass Button'],
  ['/guides/expo', 'Expo'],
]) {
  await check(`${route} negotiates its own page content`, async () => {
    const { response, body } = await read(route, 'text/markdown');
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type')?.startsWith('text/markdown'));
    assert.ok(body.includes(text));
    assert.ok(body.includes('```'));
    assert.ok(!body.includes('<script'));
  });
}

await check('Unknown pages retain 404 status under Markdown', async () => {
  const { response } = await read('/missing-agent-page', 'text/markdown');
  assert.equal(response.status, 404);
});

for (const [route, host, extraHeaders, text, excluded] of [
  ['/?path=/docs', undefined, {}, 'Glass without', 'Add Glassy UI to your app'],
  ['/docs?path=/', undefined, {}, 'Add Glassy UI to your app', 'Glass without'],
  [
    '/',
    undefined,
    { 'x-glassyui-markdown-path': '/api/analytics-config' },
    'Glass without',
    '<html',
  ],
  [
    '/docs',
    undefined,
    { 'x-glassyui-markdown-path': '/' },
    'Add Glassy UI to your app',
    'Glass without',
  ],
  ['/api/markdown?path=/docs', undefined, {}, 'Add Glassy UI to your app', 'Glass without'],
]) {
  await check(
    `${host ?? baseUrl.host}${route} converts the requested page despite client path overrides`,
    async () => {
      const { response, body } = await read(route, 'text/markdown', 'GET', host, extraHeaders);
      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-type')?.startsWith('text/markdown'));
      assert.ok(body.includes(text));
      assert.ok(!body.includes(excluded));
    },
  );
}

await check('The conversion header cannot bypass the non-page path guard', async () => {
  const { response } = await read('/api/markdown', 'text/markdown', 'GET', undefined, {
    'x-glassyui-markdown-path': '/api/analytics-config',
  });

  assert.equal(response.status, 400);
});

for (const route of [
  '/api/markdown?path=//example.com',
  '/api/markdown?path=/api/markdown',
  '/api/markdown?path=%2F%252e%2Fapi%2Fanalytics-config',
  '/api/markdown?path=%2F%2561pi%2Fanalytics-config',
  '/api/markdown?path=/r/registry.json',
  '/api/markdown?path=%2F%0A%2Fexample.com',
]) {
  await check(`${route} rejects non-page paths`, async () => {
    const { response } = await read(route);
    assert.equal(response.status, 400);
  });
}

await check('Robots declares all three Content Signals in the wildcard group', async () => {
  const { response, body } = await read('/robots.txt');
  assert.equal(response.status, 200);
  const groups = body.split(/\n\s*\n/);
  const group = groups.find((entry) => /^User-agent:\s*\*/im.test(entry));
  assert.ok(group);
  const signals = /^Content-Signal:\s*(.+)$/im.exec(group)?.[1] ?? '';

  for (const purpose of ['search', 'ai-input', 'ai-train']) {
    assert.match(signals, new RegExp(`(?:^|,\\s*)${purpose}=(yes|no)(?:,|$)`));
  }

  assert.match(group, /^Allow:\s*\/$/m);
  assert.match(body, /^Sitemap:\s*https:\/\/glassyui\.com\/sitemap\.xml$/m);
});

await mkdir(artifactDirectory, { recursive: true });

const passed = checks.every((entry) => entry.passed);

const report = {
  baseUrl: baseUrl.href,
  checkedAt: new Date().toISOString(),
  passed,
  checks,
  requests,
};

await writeFile(
  path.join(artifactDirectory, 'result.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);

for (const entry of checks)
  console.log(
    `${entry.passed ? 'PASS' : 'FAIL'} ${entry.name}${entry.error ? `: ${entry.error}` : ''}`,
  );

console.log(`Evidence: ${path.join(artifactDirectory, 'result.json')}`);

if (!passed) process.exitCode = 1;
