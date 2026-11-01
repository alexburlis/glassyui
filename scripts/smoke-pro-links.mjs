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

// The home page's templates in their order, with where each card leads: a Pro template's own
// place on the Pro site, a free template's page, or nowhere until it is out.
const GALLERY = [
  ['Northstar', `${PRO}/#northstar`],
  ['Halcyon', '/templates/halcyon'],
  ['Tempo', `${PRO}/#tempo`],
  ['Fieldnotes', null],
  ['Relay', `${PRO}/#relay`],
  ['Quill', `${PRO}/#quill`],
  ['Penny', `${PRO}/#penny`],
  ['Orbit', `${PRO}/#orbit`],
  ['Still', null],
  ['Beacon', `${PRO}/#beacon`],
  ['Tally', `${PRO}/#tally`],
  ['Cohort', `${PRO}/#cohort`],
  ['Hush', `${PRO}/#hush`],
];

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

function whiteContrast(rgb) {
  const [red, green, blue] = rgb.map((value) => {
    const channel = value / 255;

    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 1.05 / (0.2126 * red + 0.7152 * green + 0.0722 * blue + 0.05);
}

// The lowest contrast white copy has against a card's red, read from rendered pixels in the card's
// right padding, from the top of its first line of copy down to the foot of its last.
async function lowestWhiteContrast(page, card, first, last) {
  const band = await card.evaluate(
    (node, selectors) => {
      const box = node.getBoundingClientRect();

      return {
        top: node.querySelector(selectors.first).getBoundingClientRect().top - box.top,
        bottom: node.querySelector(selectors.last).getBoundingClientRect().bottom - box.top,
        x: box.width - 8,
      };
    },
    { first, last },
  );

  const png = await card.screenshot();

  const column = await page.evaluate(
    async ({ band, source }) => {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const top = Math.ceil(band.top);

      const { data } = context.getImageData(
        Math.round(band.x),
        top,
        1,
        Math.floor(band.bottom) - top,
      );

      return Array.from({ length: data.length / 4 }, (_, index) => ({
        rgb: [data[index * 4], data[index * 4 + 1], data[index * 4 + 2]],
        y: top + index,
      }));
    },
    { band, source: `data:image/png;base64,${png.toString('base64')}` },
  );

  return column
    .map(({ rgb, y }) => ({ ratio: whiteContrast(rgb), rgb, y }))
    .reduce((lowest, pixel) => (pixel.ratio < lowest.ratio ? pixel : lowest));
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

  // The home page's templates: free and Pro mixed in one gallery, the Pro cards and the closing
  // tile leading to the Pro site, two columns down to the narrowest phone, and nothing scrolling
  // sideways.
  for (const width of [320, 360, 390, 768, 1280]) {
    const label = `home templates ${width}px`;
    const { context, failures, page } = await openPage({ width });

    await page.goto(`${MAIN}/#templates`, { waitUntil: 'networkidle' });

    const section = page.locator('#templates');
    const gallery = section.locator('.template-gallery');

    await gallery.scrollIntoViewIfNeeded();

    const cards = await gallery.locator('.template-card').evaluateAll((nodes) =>
      nodes.map((node) => {
        const chip = node.querySelector('.template-chip');
        const chipBox = chip.getBoundingClientRect();
        const poster = node.querySelector('.template-card-poster').getBoundingClientRect();

        return {
          chipInside: chipBox.right <= poster.right && chipBox.bottom <= poster.bottom,
          focusable:
            node.matches('a[href], [tabindex]') || Boolean(node.querySelector('a, [tabindex]')),
          href: node.getAttribute('href'),
          name: node.querySelector('.template-card-title')?.textContent,
          pro: chip.dataset.tier === 'pro',
          source: node.getAttribute('data-analytics-source'),
          tag: node.tagName,
          top: Math.round(node.getBoundingClientRect().top),
        };
      }),
    );

    assert.deepEqual(
      cards.map((card) => card.name),
      GALLERY.map(([name]) => name),
      `${label}: thirteen templates in the gallery's order`,
    );

    for (const [index, [name, href]] of GALLERY.entries()) {
      const card = cards[index];

      if (href) {
        assert.equal(card.tag, 'A', `${label}: ${name} is one link`);
        assert.equal(card.href, href, `${label}: ${name} leads to ${href}`);
      } else {
        assert.equal(card.focusable, false, `${label}: ${name} is not out yet, so it is no link`);
      }

      if (card.pro) {
        assert.equal(card.source, 'template', `${label}: ${name} counts as a template link`);
      }

      assert.equal(card.chipInside, true, `${label}: ${name}'s tier fits on its poster`);
    }

    const firstRow = cards.filter((card) => card.top === cards[0].top);

    assert.equal(firstRow.length, width >= 1024 ? 3 : 2, `${label}: columns`);
    assert.ok(
      firstRow.some((card) => card.pro) && firstRow.some((card) => !card.pro),
      `${label}: the first row shows free and Pro`,
    );

    const tile = gallery.locator('.template-pro-tile');

    const tileState = await tile.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const hush = node.previousElementSibling.getBoundingClientRect();
      const grid = node.parentElement.getBoundingClientRect();
      const main = node.closest('main').cloneNode(true);

      main.querySelector('.template-pro-tile').remove();

      return {
        beside: Math.round(box.top) === Math.round(hush.top) && box.left > hush.right,
        full: Math.abs(box.width - grid.width) < 1,
        href: node.getAttribute('href'),
        priceElsewhere: /\$\d/.test(main.textContent),
        source: node.getAttribute('data-analytics-source'),
        text: node.textContent,
      };
    });

    assert.equal(tileState.href, PRO, `${label}: the Pro tile leads to the Pro site`);
    assert.equal(tileState.source, 'template', `${label}: the Pro tile counts as a template link`);
    assert.match(tileState.text, /Every Pro template, one price/);
    assert.equal(
      tileState.priceElsewhere,
      false,
      `${label}: the tile is the one price on the page`,
    );
    assert.ok(
      width >= 1024 ? tileState.beside : tileState.full,
      `${label}: the Pro tile closes the gallery (${JSON.stringify(tileState)})`,
    );

    const tileRed = await lowestWhiteContrast(
      page,
      tile,
      '.template-pro-tile-title',
      '.template-pro-tile-action',
    );

    assert.ok(
      tileRed.ratio >= 5,
      `${label}: the Pro tile's copy keeps 5:1 (${JSON.stringify(tileRed)})`,
    );
    assert.match(
      await section.locator('.template-gallery-note').textContent(),
      /^Pro images are design previews\. Planned templates have no date yet\.$/,
    );

    // Every poster loads, including those the page holds back until they are near.
    for (const poster of await gallery.locator('img').all()) {
      await poster.scrollIntoViewIfNeeded();
    }

    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('#templates img')].every(
          (image) => image.complete && image.naturalWidth > 0,
        ),
      null,
      { timeout: 15_000 },
    );
    await noSidewaysScroll(page, label);
    await section.screenshot({ path: path.join(artifactDirectory, `home-${width}-templates.png`) });
    screenshots.push(`home-${width}-templates.png`);
    assert.deepEqual(failures, [], `${label}: every file loads`);
    pass(label);
    await closePage(context);
  }

  // The components page: a sticky Pro card beside the gallery on a wide screen, and a link to the
  // home page's templates at the very end on every screen.
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

    const last = await page.evaluate(() => document.querySelector('main')?.lastElementChild?.id);

    assert.equal(last, 'templates', `${label}: the templates link comes last`);

    const templates = page.locator('#templates');

    assert.deepEqual(
      await templates
        .locator('a[href]')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
      ['/#templates'],
      `${label}: leads to the home page's templates`,
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
