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

// Pro's Stripe Payment Link, the same one as the Pro site's own pre-order button.
const CHECKOUT = 'https://buy.stripe.com/3cI3co4IY9aU20qbBNcZa00?prefilled_promo_code=EARLYBIRD';

// The home page's templates in their order: the free ones with the pages they lead to, then Pro's
// first release and its planned templates, each leading to its own place on the Pro site.
const FREE_TEMPLATES = [
  ['Halcyon', '/templates/halcyon'],
  ['Fieldnotes', '/templates/fieldnotes'],
  ['Still', '/templates/still'],
];

const PRO_FIRST_RELEASE = ['Northstar', 'Tempo'];

const PRO_PLANNED = ['Relay', 'Quill', 'Penny', 'Orbit', 'Beacon', 'Tally', 'Cohort', 'Hush'];

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

  // The home page's templates: the free ones first, then Pro's under their own heading, with the
  // first release beside the Pro tile and the planned ones four to a row on a wide screen and two
  // below. A Pro card opens one dialog that sells Pro and switches between the Pro templates, and
  // nothing scrolls sideways.
  for (const width of [320, 360, 390, 768, 1280]) {
    const label = `home templates ${width}px`;
    const wide = width >= 1024;
    const { context, failures, page } = await openPage({ width });

    await page.goto(`${MAIN}/#templates`, { waitUntil: 'networkidle' });

    const section = page.locator('#templates');

    await section.scrollIntoViewIfNeeded();

    const layout = await section.evaluate((node) => {
      const box = (element) => {
        const rect = element.getBoundingClientRect();

        return {
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
        };
      };

      const tile = node.querySelector('.template-pro-tile');
      const main = node.closest('main').cloneNode(true);

      main.querySelector('.template-pro-tile').remove();

      return {
        cards: [...node.querySelectorAll('.template-card')].map((card) => {
          const chip = card.querySelector('.template-chip');
          const chipBox = chip.getBoundingClientRect();
          const poster = card.querySelector('.template-card-poster').getBoundingClientRect();

          return {
            ...box(card),
            chip: chip.textContent,
            chipInside: chipBox.right <= poster.right && chipBox.bottom <= poster.bottom,
            ignored: card.hasAttribute('data-analytics-ignore'),
            href: card.getAttribute('href'),
            name: card.querySelector('h4')?.textContent,
            popup: card.getAttribute('aria-haspopup'),
            tag: card.tagName,
            template: card.getAttribute('data-template'),
          };
        }),
        grids: [...node.querySelectorAll('.template-grid')].map(box),
        headings: [...node.querySelectorAll('h3')].map((heading) => ({
          ...box(heading),
          name: heading.textContent,
        })),
        priceElsewhere: /\$\d/.test(main.textContent),
        tile: {
          ...box(tile),
          href: tile.getAttribute('href'),
          source: tile.getAttribute('data-analytics-source'),
          text: tile.textContent,
        },
      };
    });

    const freeNames = FREE_TEMPLATES.map(([name]) => name);

    assert.deepEqual(
      layout.cards.map((card) => card.name),
      [...freeNames, ...PRO_FIRST_RELEASE, ...PRO_PLANNED],
      `${label}: the free templates, then Pro's first release, then its planned templates`,
    );

    const cards = new Map(layout.cards.map((card) => [card.name, card]));

    for (const [name, href] of FREE_TEMPLATES) {
      const card = cards.get(name);

      assert.equal(card.tag, 'A', `${label}: ${name} is one link`);
      assert.equal(card.href, href, `${label}: ${name} leads to ${href}`);
      assert.equal(card.chip, 'Free', `${label}: ${name} is marked free`);
    }

    for (const name of [...PRO_FIRST_RELEASE, ...PRO_PLANNED]) {
      const card = cards.get(name);
      const slug = name.toLowerCase();
      const chip = PRO_FIRST_RELEASE.includes(name) ? 'Coming November' : 'Coming soon';

      assert.equal(card.tag, 'A', `${label}: ${name} is one link`);
      assert.equal(card.href, `${PRO}/#${slug}`, `${label}: without script ${name} leads to Pro`);
      assert.equal(card.template, slug, `${label}: ${name} names its template`);
      assert.equal(card.popup, 'dialog', `${label}: ${name} says it opens a dialog`);
      assert.equal(
        card.ignored,
        true,
        `${label}: opening ${name}'s dialog is not a Pro link click`,
      );
      assert.equal(card.chip, chip, `${label}: ${name} is marked ${chip}`);
    }

    for (const card of layout.cards) {
      assert.equal(card.chipInside, true, `${label}: ${card.name}'s chip fits on its poster`);
    }

    const [freeHeading, proHeading] = layout.headings;
    const firstPro = cards.get(PRO_FIRST_RELEASE[0]);
    const lastPro = cards.get(PRO_FIRST_RELEASE.at(-1));

    assert.deepEqual(
      layout.headings.map((heading) => heading.name),
      ['Free templates', 'Coming soon to Pro'],
      `${label}: one heading per group`,
    );
    assert.ok(
      freeHeading.bottom <= cards.get(freeNames[0]).top &&
        cards.get(freeNames.at(-1)).bottom <= proHeading.top &&
        proHeading.bottom <= firstPro.top,
      `${label}: each heading stands over its own templates`,
    );

    const cardsPerRow = (names) => {
      const tops = names.map((name) => cards.get(name).top);

      return [...new Set(tops)].map((top) => tops.filter((value) => value === top).length);
    };

    const [freeGrid, firstReleaseGrid] = layout.grids;

    assert.deepEqual(cardsPerRow(freeNames), wide ? [3] : [1, 2], `${label}: free columns`);
    assert.ok(
      wide || cards.get(freeNames[0]).width === freeGrid.width,
      `${label}: below 1024px the first free template spans its row, so none sits alone`,
    );
    assert.deepEqual(
      cardsPerRow(PRO_FIRST_RELEASE),
      [2],
      `${label}: the first release shares one row`,
    );
    assert.deepEqual(
      cardsPerRow(PRO_PLANNED),
      wide ? [4, 4] : [2, 2, 2, 2],
      `${label}: planned columns`,
    );

    const { tile } = layout;

    assert.equal(tile.href, PRO, `${label}: the Pro tile leads to the Pro site`);
    assert.equal(tile.source, 'template', `${label}: the Pro tile counts as a template link`);
    assert.match(tile.text, /Every Pro template, one price/);
    assert.equal(
      layout.priceElsewhere,
      false,
      `${label}: with the dialog closed, the tile is the one price on the page`,
    );
    assert.ok(
      wide
        ? tile.top === lastPro.top && tile.bottom === lastPro.bottom && tile.left > lastPro.right
        : tile.top >= lastPro.bottom && tile.width === firstReleaseGrid.width,
      `${label}: the Pro tile stands ${wide ? 'beside the first release, as tall as its cards' : 'full width under the first release'} (${JSON.stringify({ lastPro, tile })})`,
    );

    const tileLocator = section.locator('.template-pro-tile');

    // A screenshot includes the fixed header and consent panel over the tile, so the tile is
    // measured just under the header, where neither reaches it.
    await tileLocator.evaluate((node) => scrollBy(0, node.getBoundingClientRect().top - 100));

    const tileRed = await lowestWhiteContrast(
      page,
      tileLocator,
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
    for (const poster of await section.locator('img').all()) {
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

    const northstar = section.locator('[data-template="northstar"]');

    // The page's own listener runs after the card's and cancels the navigation it lets through.
    const modifiedClickFollowsLink = await northstar.evaluate((node) => {
      let followed;

      document.addEventListener(
        'click',
        (event) => {
          followed = !event.defaultPrevented;
          event.preventDefault();
        },
        { once: true },
      );
      node.dispatchEvent(
        new MouseEvent('click', { bubbles: true, button: 0, cancelable: true, metaKey: true }),
      );

      return followed;
    });

    assert.equal(
      modifiedClickFollowsLink,
      true,
      `${label}: a modified click on Northstar keeps its link to Pro`,
    );

    // A short screen, like a small phone or a browser with its toolbars showing, makes the dialog
    // taller than the window.
    await page.setViewportSize({ width, height: 560 });
    await northstar.click();

    const dialog = page.getByRole('dialog');

    await page.getByRole('dialog', { name: 'Northstar' }).waitFor();

    const opened = await dialog.evaluate((node) => {
      const parts = [
        ...node.querySelectorAll(
          '.template-dialog-eyebrow, .template-dialog-poster, .template-dialog-title, .template-dialog-description, .template-dialog-benefits, .template-dialog-price, .template-dialog-cta, .template-dialog-tax, .template-dialog-strip',
        ),
      ].map((part) => ({ box: part.getBoundingClientRect(), name: part.className }));

      const face = node.getBoundingClientRect();
      const action = node.querySelector('.template-dialog-cta').getBoundingClientRect();

      const overlaps = parts.flatMap((a, index) =>
        parts
          .slice(index + 1)
          .flatMap((b) =>
            a.box.left < b.box.right - 1 &&
            b.box.left < a.box.right - 1 &&
            a.box.top < b.box.bottom - 1 &&
            b.box.top < a.box.bottom - 1
              ? [`${a.name} over ${b.name}`]
              : [],
          ),
      );

      return {
        actionInView: action.top >= face.top && action.bottom <= face.bottom,
        focused: document.activeElement === node,
        overlaps,
        scrollTop: node.scrollTop,
      };
    });

    assert.deepEqual(opened.overlaps, [], `${label}: on a short screen no part covers another`);
    assert.equal(opened.scrollTop, 0, `${label}: the dialog opens at its poster`);
    assert.equal(opened.focused, true, `${label}: the dialog itself takes focus first`);

    if (width < 768) {
      assert.equal(
        opened.actionInView,
        true,
        `${label}: a phone opens the dialog with its action in view, ahead of the benefits`,
      );
    }

    assert.equal(
      await dialog.evaluate(
        (node) => document.getElementById(node.getAttribute('aria-describedby'))?.textContent,
      ),
      'Pre-order Glassy UI Pro and get Northstar the day it ships.',
      `${label}: the dialog says what pre-ordering Pro gets`,
    );

    const cta = dialog.getByRole('link', { name: 'Pre-order for $99', exact: true });

    assert.equal(
      await cta.getAttribute('href'),
      CHECKOUT,
      `${label}: the dialog's action opens Pro's checkout`,
    );
    assert.equal(
      await cta.getAttribute('data-analytics-source'),
      'template',
      `${label}: the dialog's action counts as a template link`,
    );
    assert.notEqual(
      await cta.getAttribute('data-analytics-checkout'),
      null,
      `${label}: the dialog's action counts as a checkout click`,
    );
    assert.equal(
      await dialog.locator('.template-dialog-price').textContent(),
      '$99Early bird for the first 100, then $199',
      `${label}: the dialog states the regular price as the price after the early bird`,
    );
    assert.equal(
      await dialog.locator('.template-dialog-tax').textContent(),
      'Plus any tax',
      `${label}: like the Pro site's button, the dialog's says tax comes on top`,
    );
    await page.keyboard.press('Tab');
    assert.equal(
      await cta.evaluate((node) => node === document.activeElement),
      true,
      `${label}: Tab reaches the dialog's action first`,
    );
    // A first visit still shows the analytics prompt, which sits over the rest of the page.
    assert.equal(
      await page.locator('.analytics-consent').isVisible(),
      true,
      `${label}: the analytics prompt is still waiting for an answer`,
    );
    await cta.scrollIntoViewIfNeeded();
    assert.equal(
      await cta.evaluate((node) => {
        // The open dialog turns pointer events off outside it, which hides the prompt from hit
        // testing, so they come back for the one reading of what is drawn on top.
        const { style } = document.body;
        const pointerEvents = style.pointerEvents;
        const box = node.getBoundingClientRect();

        style.pointerEvents = 'auto';

        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);

        style.pointerEvents = pointerEvents;

        return node.contains(hit);
      }),
      true,
      `${label}: nothing covers the dialog's action, the analytics prompt included`,
    );

    await dialog.getByRole('button', { name: 'Show Tempo' }).click();
    await page.getByRole('dialog', { name: 'Tempo' }).waitFor();
    assert.equal(
      await dialog.getByRole('button', { name: 'Show Tempo' }).getAttribute('aria-current'),
      'true',
      `${label}: the strip marks Tempo as shown`,
    );
    await noSidewaysScroll(page, `${label} with the dialog open`);
    assert.equal(
      await dialog.evaluate((node) => {
        const box = node.getBoundingClientRect();

        return node.scrollWidth <= node.clientWidth && box.left >= 0 && box.right <= innerWidth;
      }),
      true,
      `${label}: the dialog fits the screen's width`,
    );
    await page.waitForFunction(
      () => {
        const poster = document.querySelector('.template-dialog-poster img');

        return poster?.complete && poster.naturalWidth > 0 && poster.currentSrc.includes('tempo');
      },
      null,
      { timeout: 15_000 },
    );
    await capture(page, `home-${width}-dialog`, { fullPage: false });

    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });

    const focusReturned = await page
      .waitForFunction(
        () => document.activeElement?.getAttribute('data-template') === 'northstar',
        null,
        { timeout: 5_000 },
      )
      .then(
        () => true,
        () => false,
      );

    assert.equal(focusReturned, true, `${label}: closing the dialog returns focus to Northstar`);
    assert.deepEqual(failures, [], `${label}: every file loads and nothing leaves the page`);
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
