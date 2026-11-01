import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.argv[2];

const artifactDirectory = process.argv[3] ?? '.artifacts/prelaunch/launch';

const base = baseUrl ? new URL(baseUrl) : null;

if (
  !base ||
  (!['127.0.0.1', 'localhost'].includes(base.hostname) && base.origin !== 'https://glassyui.com')
) {
  throw new Error(
    'Usage: node scripts/smoke-launch.mjs <loopback-url|https://glassyui.com> [artifact-directory]',
  );
}

await fs.mkdir(artifactDirectory, { recursive: true });

const browser = await chromium.launch({
  args: ['--disable-updater-scheduler'],
  channel: 'chrome',
  headless: true,
});

const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  permissions: ['clipboard-read', 'clipboard-write'],
});

const page = await context.newPage();

const errors = [];

const missingAssets = [];

const checks = [];

const imageUrls = new Set();

const report = { baseUrl, browser: 'Google Chrome', checks, errors, missingAssets, passed: false };

page.on('pageerror', (error) => errors.push(error.message));

page.on('response', (response) => {
  if (
    response.status() >= 400 &&
    ['image', 'stylesheet', 'script'].includes(response.request().resourceType())
  ) {
    missingAssets.push({ url: response.url(), status: response.status() });
  }
});

async function visit(route) {
  const response = await page.goto(new URL(route, baseUrl).href, { waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200, `${route} must resolve`);
}

async function assertContained(route) {
  const dimensions = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));

  assert.ok(
    dimensions.scroll <= dimensions.viewport + 1,
    `${route} overflows: ${JSON.stringify(dimensions)}`,
  );
}

// One route serves every template's preview, so a first visit to a preview must fetch only the
// faces it draws, and draw only those its own font variables name, never another template's. A new
// context starts with an empty cache.
async function assertFetchesOnlyOwnFonts(route, fontVariables) {
  const firstVisit = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const fetched = new Set();

  try {
    const preview = await firstVisit.newPage();
    preview.on('request', (request) => {
      if (request.resourceType() === 'font') {
        fetched.add(request.url());
      }
    });
    await preview.goto(new URL(route, baseUrl).href, { waitUntil: 'networkidle' });

    // The files behind the faces the page has drawn with, and any face not its template's own.
    const { drawnFiles, foreignFaces } = await preview.evaluate(async (variables) => {
      await document.fonts.ready;

      const root = getComputedStyle(document.documentElement);

      const own = new Set(
        variables.flatMap((variable) =>
          root
            .getPropertyValue(variable)
            .split(',')
            .map((family) => family.trim().replaceAll(/["']/g, '')),
        ),
      );

      const drawn = new Set();

      for (const face of document.fonts) {
        if (face.status === 'loaded') {
          drawn.add(`${face.family.replaceAll('"', '')} ${face.style}`);
        }
      }

      const files = [];

      for (const sheet of document.styleSheets) {
        for (const rule of sheet.cssRules) {
          if (!(rule instanceof CSSFontFaceRule)) {
            continue;
          }

          const family = rule.style.getPropertyValue('font-family').replaceAll(/["']/g, '');
          const style = rule.style.getPropertyValue('font-style') || 'normal';
          const sources = rule.style.getPropertyValue('src').matchAll(/url\("?([^")]+)/g);

          if (drawn.has(`${family} ${style}`)) {
            for (const [, file] of sources) {
              files.push(new URL(file, sheet.href ?? document.baseURI).href);
            }
          }
        }
      }

      return {
        drawnFiles: files,
        foreignFaces: [...drawn].filter((face) => !own.has(face.slice(0, face.lastIndexOf(' ')))),
      };
    }, fontVariables);

    const unused = [...fetched].filter((file) => !drawnFiles.includes(file));

    assert.ok(fetched.size > 0, `${route} fetches its own fonts`);
    assert.deepEqual(unused, [], `${route} fetches only the fonts it draws`);
    assert.deepEqual(foreignFaces, [], `${route} draws only its own template's fonts`);

    return fetched.size;
  } finally {
    await firstVisit.close();
  }
}

try {
  await visit('/');
  await page.screenshot({ path: path.join(artifactDirectory, 'home-desktop.png'), fullPage: true });
  assert.ok(
    await page.locator('a[href="https://github.com/alexburlis/glassyui"]').count(),
    'Home must link to source',
  );

  for (const slug of ['glass-scene', 'glass-lens', 'glass-dock']) {
    await visit('/');
    await page.locator(`main a[href="/components/${slug}"]`).first().click();
    await page.waitForURL(`**/components/${slug}`);
    const usage = page.locator('#usage .docs-code-block').first();
    const displayedSource = await usage.locator('pre code').innerText();
    await usage.getByRole('button', { name: 'Copy', exact: true }).click();
    const copiedSource = await page.evaluate(() => navigator.clipboard.readText());
    assert.equal(
      copiedSource,
      displayedSource,
      `${slug}: clipboard must contain the full displayed example`,
    );
    assert.match(
      copiedSource,
      /@\/components\/glassyui\//,
      'Examples must use installed component imports',
    );
    assert.doesNotMatch(
      copiedSource,
      /@\/components\/(?:site|liquid)|\/wallpaper\.jpg|\/icons\/(?:files|mail|trash)\.png/,
      'Examples cannot depend on site-only or missing assets',
    );
    await fs.writeFile(path.join(artifactDirectory, `${slug}-example.tsx`), copiedSource);
    const preview = page.locator('.docs-preview').first();
    await preview.scrollIntoViewIfNeeded();
    await preview.screenshot({ path: path.join(artifactDirectory, `${slug}.png`) });

    const imageUrl = await page
      .locator('meta[property="og:image"]')
      .first()
      .getAttribute('content');

    assert.ok(imageUrl, `${slug}: share image must exist`);
    const publishedImageUrl = new URL(imageUrl, baseUrl);
    assert.equal(
      publishedImageUrl.origin,
      'https://glassyui.com',
      'Share metadata must use the public canonical origin',
    );

    const image = await context.request.get(
      new URL(publishedImageUrl.pathname + publishedImageUrl.search, baseUrl).href,
    );

    assert.equal(image.status(), 200, `${slug}: share image must load`);
    assert.match(image.headers()['content-type'], /image\/jpeg/);
    const bytes = await image.body();
    assert.equal(bytes.readUInt16BE(0), 0xffd8, `${slug}: share image must be a JPEG`);
    await fs.writeFile(path.join(artifactDirectory, `${slug}-share.jpg`), bytes);
    imageUrls.add(imageUrl);
    checks.push({ component: slug, copiedBytes: copiedSource.length, imageUrl });
  }

  assert.equal(imageUrls.size, 3, 'Each launch component needs its own share image');

  // The free portfolio template was retired: its addresses, its guide and the old templates
  // index lead to Glassy UI Pro. Free templates have their own pages under /templates/<slug>.
  for (const route of [
    '/templates',
    '/templates/portfolio',
    '/templates/portfolio/preview',
    '/guides/portfolio',
  ]) {
    const response = await context.request.get(new URL(route, baseUrl).href, {
      maxRedirects: 0,
    });

    assert.equal(response.status(), 308, `${route} must move permanently`);

    const location = new URL(response.headers().location).href;

    assert.equal(location, 'https://pro.glassyui.com/', `${route} must lead to Pro`);
    checks.push({ route, movedTo: location });
  }

  const guideRoutes = ['/guides/shadcn', '/guides/laptop-mockup', '/guides/glass-accessibility'];

  await page.setViewportSize({ width: 390, height: 844 });
  const sitemapResponse = await context.request.get(new URL('/sitemap.xml', baseUrl).href);
  assert.equal(sitemapResponse.status(), 200);
  const sitemap = await sitemapResponse.text();

  assert.equal(
    sitemap.includes('/templates/portfolio'),
    false,
    'The retired template is out of the sitemap',
  );
  assert.ok(
    sitemap.includes('<loc>https://glassyui.com/templates/halcyon</loc>'),
    'The Halcyon template page is in the sitemap',
  );
  assert.ok(
    sitemap.includes('<loc>https://glassyui.com/templates/fieldnotes</loc>'),
    'The Fieldnotes template page is in the sitemap',
  );
  assert.ok(
    sitemap.includes('<loc>https://glassyui.com/templates/still</loc>'),
    'The Still template page is in the sitemap',
  );
  assert.equal(sitemap.includes('/preview<'), false, 'Template previews are out of the sitemap');

  // A free template's page frames its live preview; the preview stands alone, unindexed.
  await visit('/templates/halcyon');
  await assertContained('/templates/halcyon');
  assert.equal(await page.locator('main h1').innerText(), 'Halcyon');
  assert.match(
    await page.locator('link[rel="canonical"]').getAttribute('href'),
    /\/templates\/halcyon$/,
  );
  assert.equal(
    await page.locator('iframe[src="/templates/halcyon/preview"]').count(),
    1,
    'The Halcyon page frames its preview',
  );
  assert.match(
    await page.locator('.copy-chip-command').innerText(),
    /shadcn@4\.14\.1 add @glassyui\/template-halcyon/,
  );
  await visit('/templates/halcyon/preview');
  await assertContained('/templates/halcyon/preview');

  const halcyonFonts = await assertFetchesOnlyOwnFonts('/templates/halcyon/preview', [
    '--halcyon-serif',
    '--halcyon-sans',
  ]);

  assert.match(
    await page.locator('meta[name="robots"]').getAttribute('content'),
    /noindex, follow/,
  );
  assert.match(
    await page.locator('link[rel="canonical"]').getAttribute('href'),
    /\/templates\/halcyon$/,
  );
  assert.equal(await page.locator('html').getAttribute('data-lg-theme'), 'dark');
  assert.equal(
    await page.locator('.analytics-consent').count(),
    0,
    'No consent notice in a preview',
  );
  checks.push({
    route: '/templates/halcyon',
    sitemap: true,
    preview: '/templates/halcyon/preview',
    previewFontFiles: halcyonFonts,
  });

  await visit('/templates/fieldnotes');
  await assertContained('/templates/fieldnotes');
  assert.equal(await page.locator('main h1').innerText(), 'Fieldnotes');
  assert.match(
    await page.locator('link[rel="canonical"]').getAttribute('href'),
    /\/templates\/fieldnotes$/,
  );
  assert.equal(
    await page.locator('iframe[src="/templates/fieldnotes/preview"]').count(),
    1,
    'The Fieldnotes page frames its preview',
  );
  assert.match(
    await page.locator('.copy-chip-command').innerText(),
    /shadcn@4\.14\.1 add @glassyui\/template-fieldnotes/,
  );
  await visit('/templates/fieldnotes/preview');
  await assertContained('/templates/fieldnotes/preview');

  const fieldnotesFonts = await assertFetchesOnlyOwnFonts('/templates/fieldnotes/preview', [
    '--fieldnotes-display',
    '--fieldnotes-serif',
  ]);

  assert.match(
    await page.locator('meta[name="robots"]').getAttribute('content'),
    /noindex, follow/,
  );
  assert.match(
    await page.locator('link[rel="canonical"]').getAttribute('href'),
    /\/templates\/fieldnotes$/,
  );
  assert.equal(await page.locator('html').getAttribute('data-lg-theme'), 'light');
  assert.equal(
    await page.locator('.analytics-consent').count(),
    0,
    'No consent notice in a preview',
  );
  checks.push({
    route: '/templates/fieldnotes',
    sitemap: true,
    preview: '/templates/fieldnotes/preview',
    previewFontFiles: fieldnotesFonts,
  });

  await visit('/templates/still');
  await assertContained('/templates/still');
  assert.equal(await page.locator('main h1').innerText(), 'Still');
  assert.match(
    await page.locator('link[rel="canonical"]').getAttribute('href'),
    /\/templates\/still$/,
  );
  assert.equal(
    await page.locator('iframe[src="/templates/still/preview"]').count(),
    1,
    'The Still page frames its preview',
  );
  assert.match(
    await page.locator('.copy-chip-command').innerText(),
    /shadcn@4\.14\.1 add @glassyui\/template-still/,
  );
  await visit('/templates/still/preview');
  await assertContained('/templates/still/preview');

  const stillFonts = await assertFetchesOnlyOwnFonts('/templates/still/preview', [
    '--still-serif',
    '--still-sans',
  ]);

  assert.match(
    await page.locator('meta[name="robots"]').getAttribute('content'),
    /noindex, follow/,
  );
  assert.match(
    await page.locator('link[rel="canonical"]').getAttribute('href'),
    /\/templates\/still$/,
  );
  assert.equal(await page.locator('html').getAttribute('data-lg-theme'), 'dark');
  assert.equal(
    await page.locator('.analytics-consent').count(),
    0,
    'No consent notice in a preview',
  );
  checks.push({
    route: '/templates/still',
    sitemap: true,
    preview: '/templates/still/preview',
    previewFontFiles: stillFonts,
  });

  for (const route of guideRoutes) {
    await visit(route);
    await assertContained(route);
    assert.ok(await page.locator('main h1').innerText(), `${route} has a heading`);
    assert.match(
      await page.locator('link[rel="canonical"]').getAttribute('href'),
      new RegExp(`${route}$`),
    );
    assert.ok(
      sitemap.includes(`https://glassyui.com${route}`),
      `${route} must be discoverable in sitemap`,
    );
    checks.push({ route, sitemap: true });
  }

  await visit('/');
  await assertContained('mobile home');
  await page.screenshot({ path: path.join(artifactDirectory, 'home-mobile.png'), fullPage: true });
  const missing = await context.request.get(new URL('/guides/not-a-guide', baseUrl).href);
  assert.equal(missing.status(), 404);

  for (const route of ['/templates/not-a-template', '/templates/not-a-template/preview']) {
    const missingTemplate = await context.request.get(new URL(route, baseUrl).href, {
      maxRedirects: 0,
    });

    assert.equal(missingTemplate.status(), 404, `${route} must not exist`);
  }

  assert.deepEqual(errors, [], 'No unhandled browser exceptions');
  assert.deepEqual(missingAssets, [], 'No required assets may be missing');
} catch (error) {
  report.failure = error.message;
  await page.screenshot({ path: path.join(artifactDirectory, 'failure.png'), fullPage: true });
  throw error;
} finally {
  await context.close();
  await browser.close();
  report.passed = !report.failure;
  await fs.writeFile(
    path.join(artifactDirectory, 'manifest.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}

console.log(`Launch journey passed. Evidence: ${artifactDirectory}/manifest.json`);
