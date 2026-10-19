import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const [baseUrl, evidenceDirectory] = process.argv.slice(2);

if (
  !baseUrl ||
  !evidenceDirectory ||
  !['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)
) {
  throw new Error('Usage: pnpm smoke:blog <loopback-url> <artifact-directory>');
}

await fs.mkdir(evidenceDirectory, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });

const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });

const page = await context.newPage();

const errors = [];

const checks = [];

page.on('pageerror', (error) => errors.push(error.message));

try {
  const index = await page.goto(new URL('/blog', baseUrl).href, { waitUntil: 'networkidle' });
  assert.equal(index.status(), 200);

  const privacy = page.getByRole('region', { name: 'Analytics privacy settings' });

  await privacy.getByRole('button', { name: 'Reject analytics', exact: true }).click();
  await privacy.waitFor({ state: 'hidden' });

  const articlePaths = await page
    .locator('main h2 a[href^="/blog/"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));

  assert.ok(articlePaths.length > 0, 'The blog index must expose articles.');
  const rssResponse = await context.request.get(new URL('/blog/rss', baseUrl).href);
  assert.equal(rssResponse.status(), 200);
  assert.match(rssResponse.headers()['content-type'], /application\/rss\+xml/);
  const rss = await rssResponse.text();
  const sitemapResponse = await context.request.get(new URL('/sitemap.xml', baseUrl).href);
  assert.equal(sitemapResponse.status(), 200);
  const sitemap = await sitemapResponse.text();

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(new URL('/blog', baseUrl).href);
    await page.screenshot({
      path: path.join(evidenceDirectory, `index-${viewport.width}.png`),
      fullPage: true,
    });

    for (const articlePath of articlePaths) {
      const response = await page.goto(new URL(articlePath, baseUrl).href);
      assert.equal(response.status(), 200, articlePath);
      assert.equal(await page.locator('main h1').count(), 1);
      assert.ok((await page.locator('main h1').innerText()).length > 10);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      assert.equal(canonical, `https://glassyui.com${articlePath}`);
      assert.equal(
        await page.locator('meta[property="og:type"]').getAttribute('content'),
        'article',
      );
      const image = await page.locator('meta[property="og:image"]').getAttribute('content');
      assert.ok(
        image.includes(`/share${articlePath}.jpg`),
        'Each article needs its own share card.',
      );
      assert.ok(
        (
          await context.request.get(
            new URL(new URL(image).pathname + new URL(image).search, baseUrl).href,
          )
        ).ok(),
      );
      assert.ok(rss.includes(`https://glassyui.com${articlePath}`));
      assert.ok(sitemap.includes(`https://glassyui.com${articlePath}`));
      const code = page.locator('main .docs-code-block').first();
      assert.ok(await code.count(), 'Tutorial has a rendered code example.');
      const expectedCode = await code.locator('code').innerText();
      await code.getByRole('button', { name: 'Copy', exact: true }).click();
      await page.waitForFunction(() =>
        document.querySelector('.docs-copy-button[data-state="copied"]'),
      );
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), expectedCode);
      const toggle = page.getByRole('button', { name: 'Change appearance' }).first();
      const before = await page.locator('html').getAttribute('data-lg-theme');
      await toggle.click();
      await page.waitForFunction(
        (previous) => document.documentElement.getAttribute('data-lg-theme') !== previous,
        before,
      );
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        'Article overflows the viewport.',
      );
      const slug = articlePath.split('/').at(-1);
      await page.screenshot({
        path: path.join(evidenceDirectory, `${slug}-${viewport.width}.png`),
        fullPage: true,
      });
      checks.push({ articlePath, viewport, canonical, copy: 'passed', theme: 'passed' });
    }
  }

  const missing = await page.goto(new URL('/blog/does-not-exist', baseUrl).href);
  assert.equal(missing.status(), 404);
  assert.deepEqual(errors, []);

  await page.goto(new URL('/blog', baseUrl).href);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('combobox').fill('liquid glass android');
  await page
    .getByRole('option')
    .filter({ hasText: 'Liquid glass on Android with React Native' })
    .click();
  await page.waitForURL(new URL('/blog/liquid-glass-android', baseUrl).href);

  const artifacts = [];

  for (const file of await fs.readdir(evidenceDirectory)) {
    if (!file.endsWith('.png')) continue;
    const bytes = await fs.readFile(path.join(evidenceDirectory, file));
    artifacts.push({ file, sha256: createHash('sha256').update(bytes).digest('hex') });
  }

  await fs.writeFile(
    path.join(evidenceDirectory, 'result.json'),
    JSON.stringify(
      { ok: true, checkedAt: new Date().toISOString(), baseUrl, checks, artifacts },
      null,
      2,
    ),
  );
  console.log(`Blog smoke passed: ${articlePaths.length} articles at desktop and mobile widths.`);
} catch (error) {
  await fs.writeFile(
    path.join(evidenceDirectory, 'failure.json'),
    JSON.stringify({ ok: false, error: error.message, checks, errors }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
