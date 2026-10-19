import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium, expect } from 'playwright/test';

const [baseUrl, evidenceDirectory] = process.argv.slice(2);

if (
  !baseUrl ||
  !evidenceDirectory ||
  !(
    ['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname) ||
    new URL(baseUrl).origin === 'https://glassyui.com'
  )
) {
  throw new Error(
    'Usage: pnpm smoke:blog <loopback-url|https://glassyui.com> <artifact-directory>',
  );
}

await fs.mkdir(evidenceDirectory, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });

const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });

const page = await context.newPage();

const errors = [];

const checks = [];

page.on('pageerror', (error) => errors.push(error.message));

async function checkDemo() {
  const demo = page.locator('main [data-blog-demo]');
  await expect(demo).toHaveCount(1);
  await demo.scrollIntoViewIfNeeded();
  const variant = await demo.getAttribute('data-blog-demo');

  if (variant === 'scene') {
    const scene = demo.locator('.lg-scene');
    await expect(scene).toHaveAttribute('data-lg-scene-renderer', 'webgl');
    await expect(scene).toHaveAttribute('data-lg-scene-backdrop', 'ready');
    const stageBefore = await scene.screenshot();
    const thickness = demo.getByRole('slider', { name: 'Thickness' });
    await thickness.focus();
    await page.keyboard.press('End');
    await expect(thickness).toHaveAttribute('aria-valuenow', '80');
    await expect(demo.locator('code').filter({ hasText: 'optics=' })).toContainText('80');
    await expect(scene).toHaveAttribute('data-lg-scene-state', 'idle');
    assert.notDeepEqual(await scene.screenshot(), stageBefore, 'Thickness must change the glass.');
    await demo.getByRole('switch', { name: 'Move drop to card' }).click();
    await expect(scene).toHaveAttribute('data-merged', 'true');
    await demo.getByRole('radio', { name: 'Frost only', exact: true }).click();
    await expect(scene).toHaveCount(0);
    await expect(thickness).toBeDisabled();
    await demo.getByRole('radio', { name: 'Refraction', exact: true }).click();
    await expect(scene).toHaveAttribute('data-lg-scene-renderer', 'webgl');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('html')).toHaveAttribute('data-lg-reduce-motion', '1');
    assert.equal(
      await demo
        .locator('.blog-demo-drop')
        .evaluate((node) => getComputedStyle(node).transitionDuration),
      '0s',
    );
    await demo.getByRole('switch', { name: 'Move drop to card' }).click();
    await expect(scene).toHaveAttribute('data-merged', 'false');
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    return { variant, optics: 'rendered', frost: 'passed', reducedMotion: 'passed' };
  }

  const solid = demo.getByRole('switch', {
    name: variant === 'expo' ? 'Reduce Transparency' : 'Solid glass',
    exact: true,
  });

  await expect(solid).not.toBeChecked();
  const timer = demo.locator('.blog-demo-time');
  const initialTime = await timer.innerText();
  await demo
    .getByRole('button', { name: variant === 'expo' ? 'Start' : 'Play', exact: true })
    .click();
  await expect(timer).not.toHaveText(initialTime, { timeout: 4000 });
  await demo.getByRole('button', { name: 'Pause', exact: true }).click();
  await solid.focus();
  await page.keyboard.press('Space');
  await expect(solid).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-lg-reduce-transparency', '1');
  assert.match(
    await demo
      .locator('.blog-demo-native-card')
      .evaluate((node) => getComputedStyle(node, '::before').backgroundColor),
    /^rgb\(/,
    'Reduced transparency must produce an opaque surface.',
  );

  if (variant === 'expo') {
    await expect(demo.getByText('Material: solid', { exact: true })).toBeVisible();
    // The preview uses the real site preference, which must also disable the web scene.
    await page.goto(new URL('/blog/liquid-glass-css-react', baseUrl).href);
    await expect(page.locator('[data-blog-demo="scene"] .lg-scene')).toHaveAttribute(
      'data-lg-scene-renderer',
      'off',
    );
    await page.goto(new URL('/blog/liquid-glass-react-native-expo', baseUrl).href);
  }

  await solid.click();
  await expect(solid).not.toBeChecked();

  if (variant === 'android') {
    assert.match(
      await demo
        .locator('.blog-demo-native-card')
        .evaluate((node) => getComputedStyle(node, '::before').backdropFilter),
      /blur\(/,
      'The normal Android preview must draw its blur.',
    );
    await demo.getByRole('switch', { name: 'Inside GlassBackdrop', exact: true }).click();
    await expect(demo.getByText('Tint only: no blur target.', { exact: true })).toBeVisible();
    assert.equal(
      await demo
        .locator('.blog-demo-native-card')
        .evaluate((node) => getComputedStyle(node, '::before').backdropFilter),
      'none',
    );
  }

  return { variant, timer: 'advanced', solid: 'opaque', keyboard: 'passed' };
}

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
      path: path.join(evidenceDirectory, `index-${viewport.width}.jpg`),
      type: 'jpeg',
      quality: 65,
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
      const demoResult = await checkDemo();
      await page.locator('main [data-blog-demo]').scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(evidenceDirectory, `${slug}-${viewport.width}.jpg`),
        type: 'jpeg',
        quality: 65,
      });
      checks.push({
        articlePath,
        viewport,
        canonical,
        copy: 'passed',
        theme: 'passed',
        demo: demoResult,
      });
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
    if (!file.endsWith('.jpg')) continue;
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
