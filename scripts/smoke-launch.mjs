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

  // The free portfolio template was retired: its addresses and guide lead to Glassy UI Pro.
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

  assert.equal(sitemap.includes('/templates'), false, 'The retired template is out of the sitemap');

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
