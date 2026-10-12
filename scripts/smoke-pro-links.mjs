import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [baseArgument, artifactArgument] = process.argv.slice(2);

if (!baseArgument || !artifactArgument) {
  throw new Error('Usage: node scripts/smoke-pro-links.mjs <public-base-url> <artifact-directory>');
}

const base = new URL(baseArgument);

const local = ['127.0.0.1', 'localhost'].includes(base.hostname);

// Chrome uses the public production host on loopback. Pro always remains an external origin.
const main = new URL(base);

if (local) main.hostname = 'glassyui.com';

const MAIN = main.origin;

const PRO = 'https://pro.glassyui.com';

const artifactDirectory = path.resolve(artifactArgument);

fs.mkdirSync(artifactDirectory, { recursive: true });

// The existing override pins only the public host; it never maps the private Pro origin here.
const resolveTo = local ? '127.0.0.1' : process.env.PRO_SMOKE_RESOLVE;

const checks = [];

const screenshots = [];

const startedAt = new Date().toISOString();

let browser;

let activeContext;

let tracing = false;

let failure;

let evidenceError;

let trace;

function pass(name) {
  checks.push(name);
}

async function openPage({ theme = 'light', width = 1280 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  activeContext = context;
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  tracing = true;
  const page = await context.newPage();
  const failures = [];

  // A broken public redirect must fail here without loading the private site.
  await context.route('**/*', async (route) => {
    const request = route.request();

    if (request.isNavigationRequest() && new URL(request.url()).origin !== MAIN) {
      failures.push(`Unexpected external navigation: ${request.url()}`);
      await route.abort('blockedbyclient');

      return;
    }

    await route.continue();
  });

  await page.addInitScript(
    (preferences) => {
      localStorage.setItem('glassy-ui-preferences', JSON.stringify(preferences));
    },
    { theme, reduceMotion: true, reduceTransparency: false },
  );

  page.on('response', (response) => {
    const url = new URL(response.url());

    if (url.origin === MAIN && response.status() >= 400) {
      failures.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('pageerror', (error) => failures.push(`pageerror ${error.message}`));

  return { context, failures, page };
}

async function closePage(context) {
  await context.tracing.stop();
  tracing = false;
  await context.close();
  activeContext = undefined;
}

async function capture(page, name, options = {}) {
  const file = `${name}.png`;

  await page.screenshot({ fullPage: true, path: path.join(artifactDirectory, file), ...options });
  screenshots.push(file);
}

async function noSidewaysScroll(page, label) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
    `${label}: the page must not scroll sideways`,
  );
}

try {
  browser = await chromium.launch({
    args: [
      '--disable-updater-scheduler',
      ...(resolveTo ? [`--host-resolver-rules=MAP ${main.hostname} ${resolveTo}`] : []),
    ],
    channel: 'chrome',
    headless: true,
  });

  {
    const { context } = await openPage();
    const route = '/pro/license?from=source';

    const cases = local
      ? [
          ['glassyui.com', {}],
          ['attacker.example', { 'X-Forwarded-Proto': 'http' }],
          ['attacker.example:8443', { 'X-Forwarded-Proto': 'https' }],
          ['pro.attacker.example', {}],
          [`localhost:${base.port}`, {}],
          [`127.0.0.1:${base.port}`, {}],
          ['pro.glassyui.com', {}],
          [`pro.localhost:${base.port}`, {}],
        ]
      : [[undefined, {}]];

    for (const [host, headers] of cases) {
      const requestHeaders = { ...headers };

      if (host) requestHeaders.Host = host;

      const response = await context.request.get(new URL(route, base).href, {
        headers: requestHeaders,
        maxRedirects: 0,
      });

      assert.equal(response.status(), 308, `${host ?? 'main host'}: Pro path redirects`);
      assert.equal(
        response.headers().location,
        `${PRO}/license?from=source`,
        `${host ?? 'main host'}: Pro redirect uses the external origin and retains path/query`,
      );
    }

    const root = await context.request.get(new URL('/pro', base).href, {
      headers: local ? { Host: 'glassyui.com' } : {},
      maxRedirects: 0,
    });

    assert.equal(root.status(), 308, '/pro on the public server redirects');
    assert.equal(root.headers().location, `${PRO}/`);
    pass('Pro redirect origin, path and query');
    await closePage(context);
  }

  // glassyui.com carries the site-wide legal pages.
  {
    const { context, failures, page } = await openPage();

    for (const [route, heading, link] of [
      ['/imprint', 'Imprint / Impressum', 'Imprint'],
      ['/privacy', 'Privacy policy', 'Privacy'],
      ['/cookie-policy', 'Cookie policy', 'Cookies'],
    ]) {
      const response = await page.goto(`${MAIN}${route}`, { waitUntil: 'networkidle' });

      assert.equal(response?.status(), 200, `${route} answers on glassyui.com`);
      await page.getByRole('heading', { level: 1, name: heading }).waitFor();
      assert.equal(
        await page
          .getByRole('contentinfo')
          .getByRole('navigation', { name: 'Legal' })
          .getByRole('link', { name: link, exact: true })
          .count(),
        1,
        `${route} is linked from the footer`,
      );
      pass(`main ${route}`);
    }

    assert.deepEqual(failures, [], 'legal pages: every file loads');
    await closePage(context);
  }

  // The components page: a sticky Pro card beside the gallery on a wide screen, and a Templates
  // section at the very end on every screen.
  for (const width of [390, 768, 1280]) {
    const label = `components ${width}px`;
    const { context, failures, page } = await openPage({ width });

    await page.goto(`${MAIN}/components`, { waitUntil: 'networkidle' });

    const rail = page.getByRole('complementary', { name: 'Glassy UI Pro' });

    if (width >= 1024) {
      await rail.waitFor({ state: 'visible' });
      assert.equal(
        await rail.getByRole('link').getAttribute('href'),
        'https://pro.glassyui.com',
        `${label}: the Pro card links to the Pro site`,
      );
      await page.evaluate(() => window.scrollTo(0, 2400));
      await page.waitForTimeout(300);
      assert.equal(
        await rail.evaluate((node) => Math.round(node.getBoundingClientRect().top)),
        92,
        `${label}: the Pro card stays put while the gallery scrolls`,
      );
      await capture(page, `components-${width}-rail`, { fullPage: false });
    } else {
      assert.equal(await rail.isVisible(), false, `${label}: the Pro card folds away`);
    }

    const last = await page.evaluate(() => {
      const sections = document.querySelectorAll('main > section');

      return sections[sections.length - 1]?.id;
    });

    assert.equal(last, 'templates', `${label}: the Templates section comes last`);

    const templates = page.locator('#templates');

    assert.deepEqual(
      await templates
        .locator('a[href]')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
      ['https://pro.glassyui.com'],
      `${label}: offers templates only through Pro`,
    );
    await templates.scrollIntoViewIfNeeded();
    await noSidewaysScroll(page, label);
    await templates.screenshot({
      path: path.join(artifactDirectory, `components-${width}-templates.png`),
    });
    screenshots.push(`components-${width}-templates.png`);
    assert.deepEqual(failures, [], `${label}: every file loads`);
    pass(label);
    await closePage(context);
  }
} catch (error) {
  failure = error;
} finally {
  try {
    if (tracing) {
      const file = 'failure-trace.zip';
      const destination = path.join(artifactDirectory, file);
      await activeContext.tracing.stop({ path: destination });
      trace = {
        file,
        sha256: createHash('sha256').update(fs.readFileSync(destination)).digest('hex'),
      };
    }
  } catch (error) {
    evidenceError = error.message;
    failure ??= error;
  } finally {
    try {
      await browser?.close();
    } catch (error) {
      evidenceError = error.message;
      failure ??= error;
    }

    fs.writeFileSync(
      path.join(artifactDirectory, 'results.json'),
      `${JSON.stringify(
        {
          base: base.href,
          publicOrigin: MAIN,
          startedAt,
          finishedAt: new Date().toISOString(),
          passed: !failure,
          checks,
          screenshots,
          trace,
          error: failure?.message,
          evidenceError,
        },
        null,
        2,
      )}\n`,
    );
  }
}

if (failure) throw failure;

console.log(
  `Public Pro links smoke passed: ${checks.length} checks against ${local ? 'a local public server' : base.origin}. Artifacts: ${artifactDirectory}`,
);
