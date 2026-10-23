import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium, expect } from 'playwright/test';

const require = createRequire(import.meta.url);

require('./register-tsx.mjs');

const { remarkHeadingIds } = require('../src/lib/blog-headings.ts');

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

/**
 * The article contract (docs/blog-authoring.md): byline, TL;DR, one table of contents and one
 * components card at each width, and structured data that matches what the page shows.
 */
async function checkArticleContract(slug, canonical, viewport) {
  const main = page.locator('main');
  const byline = main.locator('.blog-byline');
  await expect(byline.getByText('Written by', { exact: true })).toBeVisible();
  const name = byline.getByRole('link', { name: 'Alex Burlis', exact: true });
  await expect(name).toHaveAttribute('href', '#author');
  await expect(byline.getByText('Founder of Glassy UI', { exact: true })).toBeVisible();
  await expect(byline.getByRole('img', { name: 'Alex Burlis', exact: true })).toBeVisible();
  await expect(main.locator('#author h2')).toHaveText('About the author');
  assert.equal(await page.getByText(/reviewed by|expert verified/i).count(), 0, 'No reviewer.');

  // A testing badge needs Alex's own notes in the repository, not an empty file.
  if (await main.locator('[data-blog-tested]').count()) {
    const notes = await fs.readFile(
      new URL(`../docs/testing-evidence/${slug}.md`, import.meta.url),
      'utf8',
    );

    assert.ok(notes.trim(), `docs/testing-evidence/${slug}.md must hold Alex's test notes.`);
  }

  const structured = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((nodes) => nodes.map((node) => JSON.parse(node.textContent)));

  const posting = structured.find((item) => item['@type'] === 'BlogPosting');
  assert.ok(posting, 'Articles need BlogPosting data.');
  assert.ok(!JSON.stringify(structured).includes('reviewedBy'), 'No reviewer in structured data.');
  assert.equal(posting.mainEntityOfPage, canonical);
  assert.equal(posting.author['@type'], 'Person');
  assert.equal(posting.author.name, await name.innerText());
  assert.equal(posting.author.jobTitle, 'Founder of Glassy UI');
  assert.deepEqual(posting.author.sameAs, [
    'https://x.com/AlexBurlis',
    'https://github.com/alexburlis',
  ]);
  assert.equal(
    await page.locator('meta[property="article:author"]').getAttribute('content'),
    'Alex Burlis',
  );

  const [published, updated] = await byline
    .locator('time')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('datetime')));

  assert.equal(published, posting.datePublished);

  // An update on a later day shows beside the publish date; a same-day edit keeps one visible day.
  if (updated) assert.equal(updated, posting.dateModified);
  else assert.equal(posting.dateModified.slice(0, 10), published.slice(0, 10));

  const crumbs = await main
    .getByRole('navigation', { name: 'Breadcrumb' })
    .getByRole('link')
    .allInnerTexts();

  const trail = structured.find((item) => item['@type'] === 'BreadcrumbList').itemListElement;
  assert.deepEqual(
    trail.map((item) => item.name),
    [...crumbs, await main.locator('h1').innerText()],
  );
  assert.equal(trail.at(-1).item, canonical);
  const tldr = main.locator('[data-blog-tldr]');
  await expect(tldr).toBeVisible();
  const points = await tldr.locator('li').count();
  assert.ok(points >= 2 && points <= 4, 'A TL;DR lists 2 to 4 points.');

  // Exactly one table of contents at any width: the rail's, or the closed card above the TL;DR.
  const rail = page.locator('.docs-toc-stack nav[aria-label="Table of contents"]');
  const disclosure = main.locator('details.blog-toc');

  const tocLinks = await page
    .locator('nav[aria-label="Table of contents"] a')
    .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')))]);

  assert.ok(tocLinks.length > 0, 'The table of contents lists the sections.');

  for (const href of tocLinks) {
    await expect(main.locator(`.blog-prose h2[id="${href.slice(1)}"]`)).toHaveCount(1);
    await expect(page.locator(`[id="${href.slice(1)}"]`)).toHaveCount(1);
  }

  if (viewport.width >= 1280) {
    await expect(rail).toBeVisible();
    await expect(disclosure).toBeHidden();
    const second = rail.getByRole('link').nth(1);
    await second.click();
    await expect(second).toHaveAttribute('aria-current', 'location');

    // Narrower, the right column would squeeze the article: the column keeps its measure and the
    // contents and card fold into the article instead.
    await page.setViewportSize({ width: 1100, height: viewport.height });
    await expect(rail).toBeHidden();
    await expect(disclosure).toBeVisible();
    await expect(page.locator('[data-blog-cta]').filter({ visible: true })).toHaveCount(1);

    const [measure, prose] = await main.evaluate((node) => [
      getComputedStyle(node).getPropertyValue('--docs-measure'),
      node.querySelector('.blog-prose').getBoundingClientRect().width,
    ]);

    assert.equal(prose, Number.parseFloat(measure), 'The article keeps its measure at 1100px.');
    await page.setViewportSize(viewport);
  } else {
    await expect(rail).toBeHidden();
    await expect(disclosure).toBeVisible();
    await expect(disclosure).not.toHaveAttribute('open');
    await disclosure.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(disclosure).toHaveAttribute('open');
    await expect(disclosure.getByRole('link').first()).toBeVisible();
  }

  const cta = page.locator('[data-blog-cta]').filter({ visible: true });
  await expect(cta).toHaveCount(1);
  await expect(cta.getByRole('link', { name: 'Browse components', exact: true })).toHaveAttribute(
    'href',
    '/components',
  );

  return {
    byline: 'passed',
    tldr: points,
    toc: tocLinks.length,
    cta: 'one',
    personJsonLd: 'passed',
  };
}

try {
  const index = await page.goto(new URL('/blog', baseUrl).href, { waitUntil: 'networkidle' });
  assert.equal(index.status(), 200);

  const privacy = page.getByRole('region', { name: 'Analytics privacy settings' });

  await privacy.getByRole('button', { name: 'Reject analytics', exact: true }).click();
  await privacy.waitFor({ state: 'hidden' });

  // Heading ids come from any heading text. Each must also work as a selector: "#2026-…" does not.
  const headingIds = [];
  const heading = (value) => ({ type: 'heading', depth: 2, children: [{ type: 'text', value }] });
  remarkHeadingIds(headingIds, [])()({
    type: 'root',
    children: [heading('3 CSS frosts that work'), heading('2026 browser support')],
  });

  for (const { href } of headingIds) {
    await page.evaluate((selector) => document.querySelector(selector), href);
  }

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
      const slug = articlePath.split('/').at(-1);
      const contract = await checkArticleContract(slug, canonical, viewport);
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
        contract,
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
