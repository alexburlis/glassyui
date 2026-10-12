import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const [baseArgument, artifactDirectory, proArgument] = process.argv.slice(2);

if (!baseArgument || !artifactDirectory) {
  throw new Error(
    'Usage: node scripts/check-analytics-consent.mjs <free-base-url> <artifact-directory> [pro-base-url]',
  );
}

const base = new URL(baseArgument);

const proBase = proArgument ? new URL(proArgument) : null;

const loopbackTargets = [base, ...(proBase ? [proBase] : [])].every(
  (url) =>
    ['localhost', '127.0.0.1'].includes(url.hostname) &&
    ['http:', 'https:'].includes(url.protocol) &&
    url.username + url.password === '',
);

const productionTargets =
  base.href === 'https://glassyui.com/' && proBase?.href === 'https://pro.glassyui.com/';

assert.ok(
  loopbackTargets || productionTargets,
  'Use loopback servers or the exact Glassy UI production pair with intercepted ingestion.',
);

if (proBase) {
  assert.notEqual(proBase.origin, base.origin, 'The apps must use different server targets.');
}

const scope = proBase ? 'free-and-pro' : 'free-only';

function assertNoSharedCaching(response) {
  const headers = ['cache-control', 'cdn-cache-control'];

  // Cloudflare consumes its targeted header and does not forward it downstream.
  if (loopbackTargets) headers.push('cloudflare-cdn-cache-control');

  for (const header of headers) {
    assert.match(response.headers.get(header) ?? '', /no-store/i, `${header}: no shared caching`);
  }

  if (productionTargets) {
    assert.match(
      response.headers.get('cf-cache-status') ?? '',
      /^(DYNAMIC|BYPASS)$/,
      'The production config must bypass shared caching',
    );
  }
}

const notApplicable = proBase
  ? []
  : [
      'Pro pages, checkout clicks and cross-subdomain synchronization require a separate Pro server.',
    ];

if (productionTargets) {
  notApplicable.push('The host-only loopback cookie case belongs to the local run.');
}

const MAIN = 'https://glassyui.com';

const PRO = 'https://pro.glassyui.com';

const HOST = 'https://eu.i.posthog.com';

const COOKIE = 'glassy-ui-analytics-consent';

const CONFIG = {
  token: 'phc_analytics_consent_test_only',
  host: HOST,
  mode: 'opt-in',
  signal: false,
};

const APPEARANCE = JSON.stringify({
  theme: 'light',
  reduceMotion: true,
  reduceTransparency: false,
});

const checks = [];

const failures = [];

const evidence = [];

fs.mkdirSync(artifactDirectory, { recursive: true });

const browser = await chromium.launch({
  args: ['--disable-updater-scheduler'],
  channel: 'chrome',
  headless: true,
});

function analyticsKey(key) {
  return key === 'glassyui_analytics_sdk_permission' || /^(ph_|__ph)|posthog/i.test(key);
}

function decodeEvents(request) {
  const bytes = request.postDataBuffer();

  if (!bytes) return [];

  let text = bytes.toString('utf8');
  const url = new URL(request.url());

  if (url.searchParams.get('compression') === 'gzip-js') text = gunzipSync(bytes).toString('utf8');

  if (!text.startsWith('{') && !text.startsWith('[')) {
    const data = new URLSearchParams(text).get('data');

    assert.ok(data, `Unrecognized ingestion body at ${url.pathname}`);
    text =
      data.startsWith('{') || data.startsWith('[')
        ? data
        : Buffer.from(data, 'base64').toString('utf8');
  }

  const payload = JSON.parse(text);

  return Array.isArray(payload) ? payload : (payload.batch ?? [payload]);
}

async function until(assertion, label) {
  const deadline = Date.now() + 8000;

  while (Date.now() < deadline) {
    if (assertion()) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }

  throw new Error(`Timed out: ${label}`);
}

async function quiet(page, milliseconds = 800) {
  await page.waitForTimeout(milliseconds);
}

async function storage(session) {
  const cookies = await session.context.cookies([MAIN, PRO, base.origin]);

  const stores = await session.page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    appearance: localStorage.getItem('glassy-ui-preferences'),
  }));

  return {
    cookies,
    ...stores,
    analytics: [...cookies.map((cookie) => cookie.name), ...stores.local, ...stores.session].filter(
      analyticsKey,
    ),
  };
}

async function noCollection(session, label) {
  await quiet(session.page);
  assert.deepEqual(session.requests, [], `${label}: no optional network requests`);
  assert.deepEqual((await storage(session)).analytics, [], `${label}: no analytics storage`);
}

async function openSession(options = {}) {
  const context = await browser.newContext({
    // Exercise ordinary visitors; the real SDK deliberately excludes automation/bot traffic.
    userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36`,
    viewport: { width: options.width ?? 1280, height: 900 },
    serviceWorkers: 'block',
  });

  const page = await context.newPage();
  const requests = [];
  const events = [];
  const pageErrors = [];
  const routingErrors = [];
  let config = { ...CONFIG, ...options.config };
  let unavailable = options.unavailable ?? false;
  let failedIngest = options.failedIngest ?? false;
  let delayChunks = false;
  let releaseChunk;
  let delayedChunkCount = 0;
  let configCount = 0;

  const chunkGate = new Promise((resolve) => {
    releaseChunk = resolve;
  });

  await context.addInitScript(
    (settings) => {
      Object.defineProperty(navigator, 'webdriver', { value: false });

      if (!localStorage.getItem('glassy-ui-preferences')) {
        localStorage.setItem('glassy-ui-preferences', settings.appearance);
      }

      if (settings.gpc) Object.defineProperty(navigator, 'globalPrivacyControl', { value: true });

      if (settings.dnt) Object.defineProperty(navigator, 'doNotTrack', { value: '1' });
    },
    { appearance: APPEARANCE, gpc: options.gpc ?? false, dnt: options.dnt ?? false },
  );

  if (options.preference) {
    await context.addCookies([
      {
        name: COOKIE,
        value: encodeURIComponent(JSON.stringify(options.preference)),
        domain: '.glassyui.com',
        path: '/',
        secure: true,
        sameSite: 'Lax',
        expires: Date.now() / 1000 + 86400,
      },
    ]);
  }

  page.on('pageerror', (error) => pageErrors.push(error.message));

  // The browser sees the real HTTPS subdomains and therefore exercises shared Secure cookies.
  // Only transport is forwarded to loopback; the real SDK is imported from the application's build.
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    try {
      if (/posthog\.(com|net)$/.test(url.hostname)) {
        requests.push({ method: request.method(), path: url.pathname, query: url.search });

        if (request.method() === 'POST') events.push(...decodeEvents(request));

        await route.fulfill({
          status: failedIngest ? 503 : 200,
          contentType: 'application/json',
          body: failedIngest ? '{"status":0}' : '{"status":1}',
        });

        return;
      }

      if (['glassyui.com', 'pro.glassyui.com', base.hostname].includes(url.hostname)) {
        const isPro = url.hostname === 'pro.glassyui.com';

        assert.ok(!isPro || proBase, 'A Pro request requires the explicit private server target.');

        if (url.pathname === '/api/analytics-config') {
          configCount += 1;

          if (unavailable) await route.abort('failed');
          else
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(config),
            });

          return;
        }

        const target = new URL(`${url.pathname}${url.search}`, isPro ? proBase : base);

        const response = await route.fetch({
          url: target.href,
          headers: { ...request.headers(), host: url.host, 'x-forwarded-proto': 'https' },
        });

        // Next also prefetches route chunks. Hold the actual SDK payload so
        // unrelated prefetch timing cannot let analytics start before navigation.
        if (
          delayChunks &&
          delayedChunkCount === 0 &&
          request.resourceType() === 'script' &&
          url.pathname.startsWith('/_next/') &&
          (await response.text()).includes('posthog-js')
        ) {
          delayedChunkCount += 1;
          await chunkGate;
        }

        await route.fulfill({ response });

        return;
      }

      // A checkout click is exercised without visiting or writing to Stripe.
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<title>External navigation intercepted</title>',
      });
    } catch (error) {
      routingErrors.push(error.message);
      await route.abort('failed');
    }
  });

  return {
    context,
    page,
    requests,
    events,
    pageErrors,
    routingErrors,
    configCount: () => configCount,
    delayedChunkCount: () => delayedChunkCount,
    setConfig: (next) => {
      config = { ...config, ...next };
    },
    setUnavailable: (next) => {
      unavailable = next;
    },
    failIngest: (next) => {
      failedIngest = next;
    },
    delayImport: () => {
      delayChunks = true;
    },
    releaseImport: () => {
      delayChunks = false;
      releaseChunk();
    },
  };
}

async function go(session, url = `${MAIN}/privacy`) {
  const count = session.configCount();

  await session.page.goto(url, { waitUntil: 'networkidle' });
  await until(() => session.configCount() > count, 'first-party configuration request');
}

function panel(session) {
  return session.page.getByRole('region', { name: 'Analytics privacy settings' });
}

async function accept(session) {
  await panel(session).getByRole('button', { name: 'Accept analytics', exact: true }).click();
}

async function reject(session) {
  await panel(session)
    .getByRole('button', { name: /^(Reject analytics|Turn off analytics)$/ })
    .click();
}

async function reopen(session) {
  await session.page.getByRole('button', { name: 'Privacy settings', exact: true }).last().click();
  await panel(session).waitFor();
}

async function assertChoice(session, expected) {
  const snapshot = await storage(session);
  const cookie = snapshot.cookies.find((item) => item.name === COOKIE);

  assert.ok(cookie, 'The explicit decision has a preference cookie');
  assert.equal(cookie.domain, '.glassyui.com');
  assert.equal(cookie.path, '/');
  assert.equal(cookie.secure, true);
  assert.equal(cookie.sameSite, 'Lax');
  assert.ok(
    Math.abs(cookie.expires - Date.now() / 1000 - 180 * 86400) < 15,
    'Preference expiry is 180 days',
  );

  const preference = JSON.parse(decodeURIComponent(cookie.value));

  assert.deepEqual(Object.keys(preference).sort(), [
    'decision',
    'expiresAt',
    'purpose',
    'updatedAt',
    'version',
  ]);
  assert.equal(preference.decision, expected);
  assert.equal(preference.purpose, 'analytics');
  assert.equal(preference.version, 'analytics-v1');
  assert.equal(
    snapshot.appearance,
    APPEARANCE,
    'Appearance settings survive the analytics decision',
  );
}

async function assertImplicitPermission(session) {
  const snapshot = await storage(session);

  assert.equal(
    snapshot.cookies.some((cookie) => cookie.name === COOKIE),
    false,
    'A regional default never saves an explicit consent decision',
  );
  assert.deepEqual(
    snapshot.analytics.filter((key) => key !== 'glassyui_analytics_sdk_permission'),
    [],
    'The regional default creates no persistent analytics identifier',
  );
  assert.equal(snapshot.appearance, APPEARANCE, 'Appearance remains independent');

  for (const event of session.events) {
    assert.equal(
      event.properties.analytics_basis,
      'legitimate_interest',
      'Default-on collection never purports to be explicit consent',
    );
  }
}

function assertMinimalEvents(events) {
  for (const event of events) {
    assert.ok(
      ['$pageview', 'pro_checkout_click'].includes(event.event),
      `Unapproved event ${event.event}`,
    );
    const encoded = JSON.stringify(event.properties);

    assert.doesNotMatch(
      encoded,
      /alice|private-email|secret-session|checkout-token|#private-fragment|\?email=/i,
      'Event properties omit URL secrets',
    );

    for (const [key, value] of Object.entries(event.properties ?? {})) {
      if (/(url|referrer|pathname|path)$/i.test(key) && String(value).includes('://')) {
        const url = new URL(String(value));

        assert.equal(url.search, '', `${key}: no query`);
        assert.equal(url.hash, '', `${key}: no fragment`);
      }
    }
  }
}

async function scenario(name, run, options = {}) {
  const session = await openSession(options);

  try {
    await run(session);
    assert.deepEqual(session.routingErrors, [], `${name}: requests can be inspected`);
    assert.deepEqual(session.pageErrors, [], `${name}: no browser runtime errors`);
    assertMinimalEvents(session.events);

    for (const request of session.requests) {
      assert.equal(
        request.method,
        'POST',
        'Optional instrumentation only sends explicit event captures',
      );
      assert.match(
        request.path,
        /\/(e|capture)\/?$/,
        'No feature-flag, replay, survey or configuration requests',
      );
    }

    checks.push(name);
  } catch (error) {
    failures.push(`${name}: ${error.stack ?? error.message}`);
    await session.page
      .screenshot({
        path: path.join(artifactDirectory, `failure-${evidence.length}.png`),
        fullPage: true,
      })
      .catch(() => {});
  } finally {
    session.releaseImport();
    // Drain real route callbacks before disposing their request context. Closing
    // first can reject fulfill and then abort the same already-handled request.
    await session.context.unrouteAll({ behavior: 'wait' });
    evidence.push({
      name,
      requests: session.requests,
      events: session.events,
      pageErrors: session.pageErrors,
    });
    await session.context.close();
  }
}

function preference(decision, overrides = {}) {
  const now = Date.now();

  return {
    decision,
    version: 'analytics-v1',
    purpose: 'analytics',
    updatedAt: now - 1000,
    expiresAt: now + 86400,
    ...overrides,
  };
}

try {
  for (const label of ['EU', 'UK', 'unknown']) {
    await scenario(
      `fresh ${label}: no collection on ${proBase ? 'either host' : 'the free host'}`,
      async (session) => {
        await go(session);
        await panel(session).waitFor();
        assert.equal(
          await panel(session).getByRole('switch').count(),
          0,
          'One purpose needs no invented categories',
        );
        await noCollection(session, `${label} main`);

        if (proBase) {
          await go(session, `${PRO}/`);
          await panel(session).waitFor();
          await noCollection(session, `${label} Pro`);
          assert.equal(
            await session.page
              .getByRole('button', { name: 'Privacy settings', exact: true })
              .count(),
            1,
          );
          assert.equal(
            await session.page.locator('a[href^="https://buy.stripe.com/"]').count(),
            1,
            'Purchases stay accessible before consent',
          );
        }
      },
    );
  }

  await scenario(
    proBase
      ? 'accept, clean page views, route changes, shared choice, checkout and withdrawal'
      : 'accept, clean page views, route changes and withdrawal on the free host',
    async (session) => {
      await go(
        session,
        `${MAIN}/privacy?email=alice%40example.com&session=secret-session#private-fragment`,
      );
      await noCollection(session, 'Initial undecided page');
      await session.page.getByRole('link', { name: 'Cookies', exact: true }).last().click();
      await session.page.waitForURL(`${MAIN}/cookie-policy`);
      await noCollection(session, 'Pre-consent route change');
      await accept(session);
      await until(() => session.events.length === 1, 'one consented page view');
      await quiet(session.page);
      assert.equal(session.events.length, 1, 'No pre-consent queue is flushed');
      assert.equal(session.events[0].event, '$pageview');
      assert.equal(new URL(session.events[0].properties.$current_url).pathname, '/cookie-policy');
      await assertChoice(session, 'accepted');
      await session.page.getByRole('link', { name: 'Privacy', exact: true }).last().click();
      await session.page.waitForURL((url) => url.origin === MAIN && url.pathname === '/privacy');
      await until(() => session.events.length === 2, 'one SPA route page view');
      await quiet(session.page);
      assert.equal(session.events.length, 2, 'A Next.js route does not duplicate a page view');

      if (proBase) {
        await go(session, `${PRO}/?session=secret-session#private-fragment`);
        await until(() => session.events.length === 3, 'shared accepted choice on Pro');
        assert.equal(await panel(session).count(), 0, 'Pro uses the shared explicit choice');
        await session.page.locator('a[href^="https://buy.stripe.com/"]').click();
        await until(
          () => session.events.some((event) => event.event === 'pro_checkout_click'),
          'explicit checkout click',
        );
        await go(session, `${PRO}/thanks?session_id=checkout-token`);
        await until(
          () => session.events.filter((event) => event.event === '$pageview').length === 4,
          'thanks page view',
        );
        assert.ok(
          session.events.every((event) => !/purchase|payment/i.test(event.event)),
          'A thanks visit never proves a purchase',
        );
      }

      await reopen(session);
      await reject(session);
      const count = session.requests.length;

      await assertChoice(session, 'rejected');
      await quiet(session.page);
      assert.equal(session.requests.length, count, 'Withdrawal sends no reset/opt-out event');
      assert.deepEqual(
        (await storage(session)).analytics,
        [],
        'Withdrawal clears analytics identifiers',
      );
      await go(session, `${MAIN}/privacy`);
      await quiet(session.page);
      assert.equal(
        session.requests.length,
        count,
        proBase ? 'Refusal survives host changes' : 'Refusal survives route changes',
      );
      assert.deepEqual(
        (await storage(session)).analytics,
        [],
        'No post-refusal persistence or fallback',
      );
      await session.page.reload({ waitUntil: 'networkidle' });
      await quiet(session.page);
      assert.equal(session.requests.length, count, 'Refusal survives reload');
    },
  );

  await scenario(
    'explicit rejection, reload and refusal overrides reviewed opt-out',
    async (session) => {
      await go(session);
      await reject(session);
      await assertChoice(session, 'rejected');
      await noCollection(session, 'Rejected visit');
      session.setConfig({ mode: 'opt-out' });
      await go(session, proBase ? `${PRO}/` : `${MAIN}/privacy`);
      await noCollection(session, 'Remembered refusal in reviewed opt-out mode');
      await session.page.reload({ waitUntil: 'networkidle' });
      await noCollection(session, 'Refusal reload');
    },
  );

  if (proBase) {
    await scenario(
      'open subdomain tabs synchronize explicit acceptance, their controls and refusal',
      async (session) => {
        await go(session);
        const mainPage = session.page;
        const proPage = await session.context.newPage();

        await proPage.goto(`${PRO}/`, { waitUntil: 'networkidle' });
        await proPage.getByRole('region', { name: 'Analytics privacy settings' }).waitFor();
        await noCollection(session, 'Both undecided tabs');
        await accept(session);
        await until(
          () => session.events.length === 2,
          'shared explicit acceptance starts both open tabs',
        );
        await proPage
          .getByRole('region', { name: 'Analytics privacy settings' })
          .waitFor({ state: 'hidden' });
        await quiet(mainPage);
        assert.equal(
          session.events.length,
          2,
          'One current page view per open tab, after shared acceptance',
        );
        await reopen(session);
        await reject(session);
        const count = session.requests.length;

        await proPage.goto(`${PRO}/thanks`, { waitUntil: 'networkidle' });
        session.page = proPage;
        await quiet(proPage);
        assert.equal(
          session.requests.length,
          count,
          'The already-open Pro tab honors the shared refusal',
        );
        assert.deepEqual(
          (await storage(session)).analytics,
          [],
          'The Pro tab removes optional storage',
        );
        session.page = mainPage;
        await mainPage.getByRole('link', { name: 'Cookies', exact: true }).last().click();
        await mainPage.waitForURL(`${MAIN}/cookie-policy`);
        await quiet(mainPage);
        assert.equal(
          session.requests.length,
          count,
          'The already-open main tab honors the shared refusal',
        );
        assert.deepEqual(
          (await storage(session)).analytics,
          [],
          'The already-open main tab removes optional storage',
        );
      },
    );
  }

  for (const [label, stored] of [
    [
      'expired',
      preference('accepted', {
        updatedAt: Date.now() - 181 * 86400000,
        expiresAt: Date.now() - 86400000,
      }),
    ],
    ['materially changed', preference('accepted', { version: 'analytics-v0' })],
  ]) {
    await scenario(
      `${label} acceptance asks again`,
      async (session) => {
        await go(session);
        await panel(session).waitFor();
        await noCollection(session, label);
      },
      { preference: stored },
    );
  }

  await scenario(
    proBase
      ? 'US opt-out captures routes and both hosts without consent, then stops in a stricter region'
      : 'US opt-out captures free routes without consent, then stops in a stricter region',
    async (session) => {
      await go(session);
      await panel(session)
        .getByRole('button', { name: 'Turn off analytics', exact: true })
        .waitFor();
      await until(() => session.events.length === 1, 'reviewed opt-out page view');
      await assertImplicitPermission(session);
      await session.page.getByRole('link', { name: 'Cookies', exact: true }).last().click();
      await session.page.waitForURL(`${MAIN}/cookie-policy`);
      await until(() => session.events.length === 2, 'one default-on SPA route page view');
      await quiet(session.page);
      assert.equal(session.events.length, 2, 'A default-on route has no duplicate page view');
      assert.equal(new URL(session.events[1].properties.$current_url).pathname, '/cookie-policy');
      await session.page.reload({ waitUntil: 'networkidle' });
      await until(() => session.events.length === 3, 'one default-on page view after reload');
      await assertImplicitPermission(session);

      if (proBase) {
        await go(session, `${PRO}/`);
        await until(() => session.events.length === 4, 'independent US default on Pro');
        await panel(session)
          .getByRole('button', { name: 'Turn off analytics', exact: true })
          .waitFor();
        await assertImplicitPermission(session);
      }

      session.setConfig({ mode: 'opt-in' });
      const count = session.requests.length;

      await go(session, `${MAIN}/privacy`);
      await panel(session).getByRole('button', { name: 'Accept analytics', exact: true }).waitFor();
      await quiet(session.page);
      assert.equal(session.requests.length, count, 'Moving to opt-in stops implicit permission');
      assert.deepEqual(
        (await storage(session)).analytics,
        [],
        'The stricter region clears SDK storage',
      );
      assert.equal(
        (await storage(session)).cookies.some((cookie) => cookie.name === COOKIE),
        false,
        'A stricter region cannot reinterpret a regional default as explicit acceptance',
      );
      await reject(session);
      await assertChoice(session, 'rejected');
    },
    { config: { mode: 'opt-out' } },
  );

  await scenario(
    proBase
      ? 'US opt-out offers immediate withdrawal, remembered on reload and both hosts'
      : 'US opt-out offers immediate withdrawal, remembered on free routes and reload',
    async (session) => {
      await go(session);
      await until(() => session.events.length === 1, 'opt-out page view');
      await reject(session);
      const count = session.requests.length;

      await assertChoice(session, 'rejected');
      await quiet(session.page);
      assert.equal(session.requests.length, count, 'Turning analytics off stops capture');
      assert.deepEqual((await storage(session)).analytics, []);
      await session.page.getByRole('link', { name: 'Cookies', exact: true }).last().click();
      await session.page.waitForURL(`${MAIN}/cookie-policy`);
      await session.page.reload({ waitUntil: 'networkidle' });

      if (proBase) {
        await go(session, `${PRO}/`);
        await session.page.reload({ waitUntil: 'networkidle' });
      }

      await quiet(session.page);
      assert.equal(session.requests.length, count, 'The US default cannot revive a refusal');
      await assertChoice(session, 'rejected');
      assert.deepEqual((await storage(session)).analytics, [], 'No refused fallback or identifier');
    },
    { config: { mode: 'opt-out' } },
  );

  for (const signal of ['gpc', 'dnt']) {
    await scenario(
      `${signal.toUpperCase()} overrides remembered acceptance and opt-out`,
      async (session) => {
        await go(session);
        await noCollection(session, signal);
        await assertChoice(session, 'rejected');

        if (proBase) {
          await go(session, `${PRO}/`);
          await noCollection(session, `${signal} Pro`);
          await assertChoice(session, 'rejected');
        }
      },
      { [signal]: true, preference: preference('accepted'), config: { mode: 'opt-out' } },
    );
  }

  await scenario(
    'server preference signal overrides remembered acceptance',
    async (session) => {
      await go(session);
      await noCollection(session, 'Server signal');
    },
    { preference: preference('accepted'), config: { signal: true } },
  );

  await scenario(
    'missing project configuration keeps the site usable without tracking',
    async (session) => {
      await go(session, proBase ? `${PRO}/` : `${MAIN}/privacy`);
      await noCollection(session, 'Missing project configuration');

      if (proBase) {
        assert.equal(await session.page.locator('a[href^="https://buy.stripe.com/"]').count(), 1);
      } else {
        assert.equal(
          await session.page.getByRole('link', { name: 'Cookies', exact: true }).last().isVisible(),
          true,
        );
      }
    },
    { preference: preference('accepted'), config: { token: null, mode: 'opt-out' } },
  );

  await scenario(
    'unavailable first-party configuration fails closed',
    async (session) => {
      await go(session);
      await noCollection(session, 'Unavailable configuration');
    },
    { preference: preference('accepted'), unavailable: true },
  );

  await scenario(
    'withdrawal while SDK import is pending cannot initialize or replay',
    async (session) => {
      await go(session);
      session.delayImport();
      await accept(session);
      await until(() => session.delayedChunkCount() > 0, 'real lazy SDK chunk');
      await reopen(session);
      await reject(session);
      session.releaseImport();
      await noCollection(session, 'SDK import completed after refusal');
      await assertChoice(session, 'rejected');
    },
  );

  await scenario(
    'navigation during SDK import captures the current route and permits a return',
    async (session) => {
      await go(session, `${MAIN}/`);
      session.delayImport();
      await accept(session);
      await until(() => session.delayedChunkCount() > 0, 'real lazy SDK chunk');
      await session.page.getByRole('link', { name: 'All components', exact: true }).last().click();
      await session.page.waitForURL(`${MAIN}/components`);
      session.releaseImport();
      await until(() => session.events.length === 1, 'current route page view after SDK import');
      assert.equal(new URL(session.events[0].properties.$current_url).pathname, '/components');
      await session.page.getByRole('link', { name: 'Glassy UI', exact: true }).first().click();
      await session.page.waitForURL(`${MAIN}/`);
      await until(() => session.events.length === 2, 'return to the initially pending route');
      await quiet(session.page);
      assert.equal(session.events.length, 2, 'Each visible route produces one consented view');
      assert.equal(new URL(session.events[1].properties.$current_url).pathname, '/');
    },
  );

  await scenario(
    'blocked refusal cookie save keeps the current document refused',
    async (session) => {
      await go(session);
      await accept(session);
      await until(() => session.events.length === 1, 'accepted page before blocked cookie save');
      await session.page.evaluate((cookieName) => {
        const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');

        window.rejectionCookieBlocks = 0;

        Object.defineProperty(document, 'cookie', {
          configurable: true,
          get: () => descriptor.get.call(document),
          set: (value) => {
            const assignment = String(value).split(';', 1)[0];

            if (assignment.startsWith(`${cookieName}=`)) {
              const raw = assignment.slice(cookieName.length + 1);

              if (raw && JSON.parse(decodeURIComponent(raw)).decision === 'rejected') {
                window.rejectionCookieBlocks += 1;

                return;
              }
            }

            descriptor.set.call(document, value);
          },
        });
      }, COOKIE);
      await reopen(session);
      await reject(session);
      const count = session.requests.length;
      const snapshot = await storage(session);

      assert.ok(
        await session.page.evaluate(() => window.rejectionCookieBlocks > 0),
        'The browser actually blocked the rejection write',
      );
      assert.deepEqual(
        snapshot.analytics,
        [],
        'The in-memory refusal still removes optional storage',
      );
      assert.equal(
        snapshot.appearance,
        APPEARANCE,
        'Storage failure never removes appearance preferences',
      );
      await session.page.getByRole('link', { name: 'Cookies', exact: true }).last().click();
      await session.page.waitForURL(`${MAIN}/cookie-policy`);
      await quiet(session.page);
      assert.equal(
        session.requests.length,
        count,
        'A route change cannot revive the stale accepted cookie',
      );
    },
  );

  await scenario(
    'withdrawal discards failed ingestion retry',
    async (session) => {
      await go(session);
      await accept(session);
      await until(() => session.requests.length === 1, 'failed first ingestion');
      await reopen(session);
      await reject(session);
      const count = session.requests.length;

      session.failIngest(false);
      await quiet(session.page, 6000);
      assert.equal(session.requests.length, count, 'A failed event is not retried after refusal');
      assert.deepEqual((await storage(session)).analytics, []);
    },
    { failedIngest: true },
  );

  for (const mode of ['opt-in', 'opt-out']) {
    await scenario(
      `mobile ${mode} banner and persistent settings support the keyboard`,
      async (session) => {
        await go(session);

        const privacy = panel(session);
        const acceptButton = privacy.getByRole('button', { name: 'Accept analytics', exact: true });

        const rejectButton = privacy.getByRole('button', {
          name: mode === 'opt-out' ? 'Turn off analytics' : 'Reject analytics',
          exact: true,
        });

        await privacy.waitFor();

        if (mode === 'opt-out') {
          await until(() => session.events.length === 1, 'default-on mobile page view');
          await assertImplicitPermission(session);
        } else await noCollection(session, 'Fresh mobile opt-in');

        assert.equal(
          await session.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );

        for (const button of [acceptButton, rejectButton]) {
          const bounds = await button.boundingBox();

          assert.ok(
            bounds && bounds.x >= 0 && bounds.x + bounds.width <= 320,
            'Both decisions fit the mobile viewport',
          );
          assert.ok(bounds.height >= 24, 'Both decisions have accessible target height');
        }

        const axe = await new AxeBuilder({ page: session.page })
          .include('[aria-label="Analytics privacy settings"]')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze();

        assert.deepEqual(
          axe.violations
            .filter((violation) => ['serious', 'critical'].includes(violation.impact))
            .map((violation) => violation.id),
          [],
        );
        await session.page.screenshot({
          path: path.join(artifactDirectory, `mobile-${mode}.png`),
          fullPage: true,
        });
        await rejectButton.focus();
        await session.page.keyboard.press('Enter');
        await assertChoice(session, 'rejected');
        const count = session.requests.length;

        const settings = session.page
          .getByRole('button', { name: 'Privacy settings', exact: true })
          .last();

        await settings.focus();
        await session.page.keyboard.press('Enter');
        await privacy.waitFor();
        await session.page.screenshot({
          path: path.join(artifactDirectory, `mobile-${mode}-reopened-settings.png`),
          fullPage: true,
        });
        await quiet(session.page);
        assert.equal(session.requests.length, count, 'Keyboard rejection stops collection');
        assert.deepEqual(
          (await storage(session)).analytics,
          [],
          'Keyboard rejection clears SDK storage',
        );
      },
      { width: 320, config: { mode } },
    );
  }

  if (loopbackTargets) {
    await scenario('loopback preferences use a host-only development cookie', async (session) => {
      await go(session, new URL('/privacy', base).href);
      await noCollection(session, 'Fresh loopback visit');
      await reject(session);
      const cookies = await session.context.cookies(base.origin);
      const cookie = cookies.find((item) => item.name === COOKIE);

      assert.ok(cookie, 'Local rejection is remembered');
      assert.equal(cookie.domain, base.hostname, 'The local preference is host-only');
      assert.equal(cookie.path, '/');
      assert.equal(cookie.sameSite, 'Lax');
      assert.equal(cookie.secure, base.protocol === 'https:');
      assert.equal(
        (await session.context.cookies([MAIN, PRO])).length,
        0,
        'Localhost never creates a production preference',
      );
      await session.page.reload({ waitUntil: 'networkidle' });
      await noCollection(session, 'Remembered loopback refusal');
    });
  }

  // These requests reach the real route rather than the browser's config fixture. Neither
  // forwarded country nor a spoofed XFF chain may override the sanitized connection peer.
  const routeEvidence = [];

  for (const [name, headers] of [
    ['country without peer', { 'cf-ipcountry': 'US' }],
    ['forged XFF without peer', { 'cf-ipcountry': 'US', 'x-forwarded-for': '173.245.48.1' }],
    [
      'forged XFF cannot override direct peer',
      { 'cf-ipcountry': 'US', 'x-real-ip': '203.0.113.10', 'x-forwarded-for': '173.245.48.1' },
    ],
    [
      'forged IPv6 XFF cannot override direct peer',
      { 'cf-ipcountry': 'US', 'x-real-ip': '2001:db8::1', 'x-forwarded-for': '2606:4700::1' },
    ],
  ]) {
    const response = await fetch(new URL('/api/analytics-config', base), { headers });
    const actualConfig = await response.json();

    assert.equal(response.status, 200);
    assert.equal(actualConfig.mode, 'opt-in', `${name}: untrusted origin remains opt-in`);

    if (productionTargets) {
      assert.ok(actualConfig.token, 'The production free app has analytics configuration.');
      assert.equal(actualConfig.signal, false, 'This request sends no privacy signal.');
    }

    assertNoSharedCaching(response);

    routeEvidence.push({
      name,
      mode: actualConfig.mode,
      configured: Boolean(actualConfig.token),
      cacheControl: response.headers.get('cache-control'),
    });
  }

  checks.push('real free config route rejects spoofed region and shared caching');
  evidence.push({ name: 'real free route', probes: routeEvidence });

  if (proBase) {
    const response = await fetch(new URL('/api/analytics-config', proBase), {
      headers: { 'cf-ipcountry': 'US', 'x-forwarded-for': '173.245.48.1' },
    });

    const actualConfig = await response.json();

    assert.equal(response.status, 200);
    assert.equal(actualConfig.mode, 'opt-in', 'The private app does not trust forged ingress.');

    if (productionTargets) {
      assert.ok(actualConfig.token, 'The production Pro app has analytics configuration.');
      assert.equal(actualConfig.signal, false, 'This request sends no privacy signal.');
    }

    assertNoSharedCaching(response);

    checks.push('real private config route preserves ingress and no-store gates');
    evidence.push({
      name: 'real private route',
      mode: actualConfig.mode,
      configured: Boolean(actualConfig.token),
    });
  }
} catch (error) {
  failures.push(error.stack ?? error.message);
} finally {
  await browser.close();
  fs.writeFileSync(
    path.join(artifactDirectory, 'analytics-consent-report.json'),
    `${JSON.stringify({ base: base.href, proBase: proBase?.href ?? null, scope, targetSurface: productionTargets ? 'production' : 'local', browserConfiguration: 'intercepted fixture; real endpoints checked separately', notApplicable, browser: 'Chrome', checks, failures, evidence }, null, 2)}\n`,
  );
}

if (failures.length) {
  console.error(`Analytics consent browser checks failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Analytics consent browser checks passed (${checks.length}, ${scope}); artifacts: ${artifactDirectory}`,
);
