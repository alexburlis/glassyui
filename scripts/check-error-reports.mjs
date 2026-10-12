import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const [baseArgument, artifactDirectory] = process.argv.slice(2);

const base = new URL(baseArgument);

assert.ok(
  ['localhost', '127.0.0.1'].includes(base.hostname),
  'Loopback only; never inject production failures.',
);

assert.ok(artifactDirectory, 'Supply an artifact directory.');

fs.mkdirSync(artifactDirectory, { recursive: true });

const browser = await chromium.launch({
  args: ['--disable-updater-scheduler'],
  channel: 'chrome',
  headless: true,
});

const checks = [];

const privateMarker = 'PRIVATE_SENTINEL_email@example.test_checkout_token';

async function session({ accepted = false, gpc = false, dnt = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block',
  });

  await context.addInitScript(
    ({ gpc, dnt }) => {
      if (gpc) Object.defineProperty(navigator, 'globalPrivacyControl', { value: true });

      if (dnt) Object.defineProperty(navigator, 'doNotTrack', { value: '1' });
      localStorage.setItem(
        'glassy-ui-preferences',
        JSON.stringify({ theme: 'light', reduceMotion: true }),
      );
    },
    { gpc, dnt },
  );

  if (accepted) {
    const now = Date.now();
    await context.addCookies([
      {
        name: 'glassy-ui-error-reports',
        value: encodeURIComponent(
          JSON.stringify({
            decision: 'accepted',
            version: 'errors-v1',
            purpose: 'errors',
            updatedAt: now,
            expiresAt: now + 180 * 86400000,
          }),
        ),
        url: base.origin,
      },
    ]);
  }

  const envelopes = [];
  const external = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/envelope/')) {
      envelopes.push(route.request().postData());
      await route.fulfill({ status: 200, body: '{}' });
    } else if (url.pathname === '/_next/static/error-proof.js') {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `setTimeout(() => { throw new TypeError(${JSON.stringify(privateMarker)}); }, 0);`,
      });
    } else if (url.origin === base.origin) {
      await route.continue();
    } else {
      external.push(url.origin);
      await route.abort();
    }
  });
  const page = await context.newPage();
  await page.goto(`${base.origin}/components?private=${privateMarker}`, {
    waitUntil: 'networkidle',
  });

  const fail = async () => {
    await page.addScriptTag({ url: `${base.origin}/_next/static/error-proof.js` });
    await page.waitForTimeout(1200);
  };

  return { context, page, fail, envelopes, external };
}

try {
  const accepted = await session({ accepted: true });
  await accepted.fail();
  assert.equal(
    accepted.envelopes.length,
    1,
    'Remembered error-report consent must activate the actual browser handler once.',
  );
  const wire = accepted.envelopes[0];
  assert.ok(
    !wire.includes(privateMarker),
    'Final serialized envelope must exclude private messages and query strings.',
  );
  const lines = wire.split('\n');
  const payload = JSON.parse(lines[2]);
  assert.equal(JSON.parse(lines[1]).type, 'event');
  assert.equal(payload.environment, 'production');
  assert.match(payload.release, /^glassyui@[0-9a-f]{40}$/);
  assert.equal(payload.tags.runtime, 'browser');
  assert.equal(payload.sdk.settings.infer_ip, 'never');
  assert.equal(payload.exception.values[0].type, 'TypeError');
  assert.ok(
    payload.exception.values[0].stacktrace.frames.some((frame) =>
      frame.filename?.endsWith('/_next/static/error-proof.js'),
    ),
  );

  for (const key of ['user', 'request', 'breadcrumbs', 'extra', 'contexts', 'transaction'])
    assert.equal(payload[key], undefined, `${key} excluded`);
  assert.deepEqual(accepted.external, []);
  checks.push(
    'accepted: one useful private-data-free error envelope; no session, trace, replay or other external traffic',
  );
  await accepted.page.getByRole('button', { name: 'Privacy settings', exact: true }).click();
  await accepted.page.getByRole('button', { name: 'Turn off error reports', exact: true }).click();
  await accepted.fail();
  assert.equal(
    accepted.envelopes.length,
    1,
    'Withdrawal stops subsequent errors before transport.',
  );
  await accepted.page.reload({ waitUntil: 'networkidle' });
  await accepted.fail();
  assert.equal(accepted.envelopes.length, 1, 'Refusal survives reload.');
  checks.push('withdrawal and remembered refusal stop delivery');
  await accepted.context.close();

  for (const options of [{}, { accepted: true, gpc: true }, { accepted: true, dnt: true }]) {
    const denied = await session(options);
    await denied.fail();
    assert.deepEqual(denied.envelopes, [], 'Undecided, GPC and DNT never send errors.');
    assert.deepEqual(denied.external, []);
    await denied.page.screenshot({
      path: `${artifactDirectory}/privacy-${checks.length}.png`,
      fullPage: false,
    });
    checks.push(`no collection: ${JSON.stringify(options)}`);
    await denied.context.close();
  }

  const independent = await session();
  await independent.page.getByRole('button', { name: 'Reject analytics', exact: true }).click();
  await independent.page.getByRole('button', { name: 'Privacy settings', exact: true }).click();
  await independent.page.getByRole('button', { name: 'Allow error reports', exact: true }).click();
  await independent.page.waitForTimeout(1200);
  await independent.fail();
  assert.equal(
    independent.envelopes.length,
    1,
    'Error reports remain independent of analytics refusal.',
  );
  assert.deepEqual(independent.external, []);
  checks.push('explicit error-report choice works independently of analytics');
  await independent.context.close();
  fs.writeFileSync(
    `${artifactDirectory}/result.json`,
    JSON.stringify({ ok: true, checks }, null, 2),
  );
  console.log(JSON.stringify({ ok: true, checks }));
} finally {
  await browser.close();
}
