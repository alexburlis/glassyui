import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import os from 'node:os';
import { once } from 'node:events';
import { chromium } from 'playwright';

// A real Next route and generated client against a local Mailwerk protocol fixture.
// This proves the product boundary; it sends no email and does not prove SES delivery.
const output = path.resolve(process.argv[2] ?? '.artifacts/updates');

const port = Number(process.env.UPDATES_CHECK_PORT ?? 3116);

const base = `http://127.0.0.1:${port}`;

const wires = [];

const children = new Set();

const checks = [];

let browser;

let snapshot;

const sourceRoot = process.cwd();

const transport = http.createServer(async (request, response) => {
  const chunks = [];

  for await (const chunk of request) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString());

  assert.equal(request.url, '/v1/consent/request');
  assert.equal(request.method, 'POST');
  wires.push({ body, authorization: request.headers.authorization });
  response.setHeader('Content-Type', 'application/json');

  if (body.email.startsWith('refused')) {
    response.writeHead(503);
    response.end(JSON.stringify({ error: { code: 'unavailable', message: 'Provider refused' } }));

    return;
  }

  const status = body.email.startsWith('failed')
    ? 'failed'
    : body.email.startsWith('confirmed')
      ? 'already_confirmed'
      : body.email.startsWith('suppressed')
        ? 'suppressed'
        : 'sent';

  response.end(
    JSON.stringify({ status, contactId: 'fixture', requestId: 'fixture', alreadyConfirmed: [] }),
  );
});

await new Promise((resolve) => transport.listen(0, '127.0.0.1', resolve));

const transportUrl = `http://127.0.0.1:${transport.address().port}`;

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  const timeout = setTimeout(() => child.kill('SIGKILL'), 10_000);

  await once(child, 'exit');
  clearTimeout(timeout);
  children.delete(child);
}

async function start(key) {
  // A synthetic runtime key is intentionally passed only to this test child.
  const child = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'dev', '--webpack', '-H', '127.0.0.1', '-p', String(port)],
    {
      cwd: snapshot,
      env: {
        ...process.env,
        MAILWERK_URL: transportUrl,
        MAILWERK_API_KEY: key,
        NEXT_TELEMETRY_DISABLED: '1',
        RAYON_NUM_THREADS: '2',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  children.add(child);
  let log = '';

  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (chunk) => {
      log = (log + chunk).slice(-16000);
    });
  const deadline = Date.now() + 300_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      await fs.writeFile(
        path.join(output, 'startup-isolated.log'),
        log.replaceAll(key, '<synthetic-key>'),
      );
      throw new Error('Owned Next server exited before readiness; inspect startup-isolated.log.');
    }

    try {
      const response = await fetch(`${base}/api/updates`, { signal: AbortSignal.timeout(1000) });

      if (response.status === 405) return child;
    } catch {
      // Startup is bounded; a listener that is not ready is not acceptance.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await fs.writeFile(path.join(output, 'startup.log'), log.replaceAll(key, '<synthetic-key>'));
  throw new Error('Owned Next server did not become ready within five minutes.');
}

async function post(body, options = {}) {
  return fetch(`${base}/api/updates`, {
    method: 'POST',
    headers: { Origin: base, 'Content-Type': 'application/json', ...options.headers },
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Exercise raw malformed input and valid JSON at the HTTP boundary.
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

try {
  await fs.mkdir(output, { recursive: true });
  // A disposable frozen source avoids shared Next locks, watchers and generated build output.
  snapshot = await fs.mkdtemp(path.join(os.tmpdir(), 'glassy-updates-'));
  const omitted = new Set(['.git', '.next', 'node_modules', '.agent-worktrees', '.artifacts']);

  for (const entry of await fs.readdir(sourceRoot)) {
    if (omitted.has(entry) || entry.startsWith('.env')) continue;
    execFileSync('/bin/cp', [
      process.platform === 'darwin' ? '-ac' : '-a',
      path.join(sourceRoot, entry),
      path.join(snapshot, entry),
    ]);
  }

  await fs.symlink(path.join(sourceRoot, 'node_modules'), path.join(snapshot, 'node_modules'));
  const first = await start('synthetic-updates-key-a');

  if (process.argv.includes('--preview')) {
    console.log(JSON.stringify({ preview: base, pid: process.pid }));
    const bound = setTimeout(() => process.emit('SIGTERM'), 20 * 60 * 1000);
    await once(process, 'SIGTERM');
    clearTimeout(bound);
  } else {
    const before = wires.length;

    const invalid = [
      [{ email: 'ignored@example.test' }, 400],
      [{ email: 'ignored@example.test', consent: false }, 400],
      [{ email: 'ignored@example.test', consent: 'true' }, 400],
      [{ email: 'ignored@example.test', consent: true, purposes: ['other'] }, 400],
      [{ email: 'bad', consent: true }, 400],
      [{ email: 'a\r\nb@example.test', consent: true }, 400],
      ['{', 400],
      ['x'.repeat(1025), 413],
    ];

    for (const [body, status] of invalid) assert.equal((await post(body)).status, status);
    assert.equal(
      (
        await post(
          { email: 'ignored@example.test', consent: true },
          { headers: { Origin: 'https://foreign.example' } },
        )
      ).status,
      403,
    );
    assert.equal((await post('{}', { headers: { 'Content-Type': 'text/plain' } })).status, 415);
    assert.equal(wires.length, before, 'Rejected requests never reach the email service.');
    checks.push('consent, origin, schema and body limits before provider access');

    for (const local of ['accepted', 'confirmed', 'suppressed']) {
      const response = await post({ email: `${local}@example.test`, consent: true });

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true });
      assert.match(response.headers.get('cache-control'), /no-store/);
    }

    const baseline = wires[0].body;

    assert.equal(baseline.email, 'accepted@example.test');
    assert.deepEqual(baseline.purposes, ['updates']);
    assert.equal(baseline.source, 'website_footer');
    assert.match(baseline.externalId, /^updates:[a-f0-9]{64}$/);
    assert.ok(!JSON.stringify(baseline.externalId).includes(baseline.email));

    for (const local of ['failed', 'refused'])
      assert.equal((await post({ email: `${local}@example.test`, consent: true })).status, 503);
    const firstStableId = baseline.externalId;

    await post({ email: ' ACCEPTED@example.test ', consent: true });
    assert.equal(wires.at(-1).body.externalId, firstStableId);
    await post({ email: 'accepted@example.test', consent: true });
    const limited = await post({ email: 'accepted@example.test', consent: true });

    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
    checks.push('neutral membership acknowledgement, truthful provider failure and rate limit');

    browser = await chromium.launch({ channel: 'chrome', headless: true });

    for (const width of [320, 390, 1280]) {
      for (const colorScheme of ['light', 'dark']) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          colorScheme,
          reducedMotion: 'reduce',
        });

        await context.addInitScript((theme) => {
          localStorage.setItem(
            'glassy-ui-preferences',
            JSON.stringify({ theme, reduceMotion: true }),
          );
        }, colorScheme);
        const page = await context.newPage();

        await page.goto(`${base}/docs`, { waitUntil: 'networkidle' });
        assert.equal(await page.locator('html').getAttribute('data-lg-theme'), colorScheme);

        const form = page
          .locator('form')
          .filter({ has: page.getByRole('button', { name: 'Subscribe', exact: true }) });

        await form.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, `signup-${width}-${colorScheme}.png`) });
        assert.ok(await form.isVisible());
        assert.ok(await form.locator('input[type="email"]').isVisible());
        assert.equal(await form.locator('input[type="checkbox"]').count(), 0);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
        const email = `browser-${width}-${colorScheme}@example.test`;

        const visibleNotice = await page.locator('.updates-signup-notice').textContent();

        await form.locator('input[type="email"]').fill(email);
        await form.locator('input[type="email"]').press('Enter');
        await page.getByText('Check your inbox to confirm.', { exact: true }).waitFor();
        const sent = wires.find((entry) => entry.body.email === email);

        assert.ok(sent, 'Keyboard submit reaches the real route and generated HTTP client.');
        assert.ok(sent.body.noticeText.includes('Pro') && sent.body.noticeText.includes('offers'));
        assert.ok(sent.body.noticeVersion);

        assert.ok(visibleNotice.includes(sent.body.noticeText));
        await context.close();
      }
    }

    const chunksRoot = path.join(snapshot, '.next', 'dev', 'static');
    let clientFiles = 0;

    for (const entry of await fs.readdir(chunksRoot, { recursive: true })) {
      if (!entry.endsWith('.js')) continue;
      const chunk = await fs.readFile(path.join(chunksRoot, entry), 'utf8');

      assert.ok(
        !chunk.includes('synthetic-updates-key-a'),
        'Private runtime key never reaches a browser chunk.',
      );
      assert.ok(
        !chunk.includes('MAILWERK_API_KEY'),
        'Mailwerk client stays outside the client module graph.',
      );
      clientFiles += 1;
    }

    assert.ok(clientFiles > 0);
    checks.push('runtime credential and Mailwerk client excluded from built browser JavaScript');
    checks.push('real browser keyboard signup at 320/390/1280px in light/dark without overflow');
    await browser.close();
    browser = undefined;
    await stop(first);

    const second = await start('synthetic-updates-key-b');

    assert.equal((await post({ email: 'accepted@example.test', consent: true })).status, 200);
    assert.equal(
      wires.at(-1).body.externalId,
      firstStableId,
      'Credential rotation preserves recipient identity.',
    );
    assert.equal(wires.at(-1).authorization, 'Bearer synthetic-updates-key-b');
    checks.push('stable subscriber identity after runtime credential rotation');
    await stop(second);

    const result = {
      ok: true,
      surface: 'local Next HTTP/browser with Mailwerk protocol fixture; no live delivery',
      checks,
    };

    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  }
} finally {
  if (browser) await browser.close();

  for (const child of children) await stop(child);
  await new Promise((resolve) => transport.close(resolve));

  if (snapshot) await fs.rm(snapshot, { recursive: true });
}
