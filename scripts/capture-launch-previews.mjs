import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.argv[2];

if (!baseUrl || !['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)) {
  throw new Error('Usage: node scripts/capture-launch-previews.mjs <loopback-url>');
}

// The launch guides show these three at full quality, as PNG. Link-preview cards come from
// scripts/capture-share-cards.mjs, and the README's artwork from scripts/build-readme-art.mjs.
const LAUNCH_EXAMPLES = ['glass-scene', 'glass-lens', 'glass-dock'];

await fs.mkdir('public/previews', { recursive: true });

const browser = await chromium.launch({
  args: ['--disable-updater-scheduler'],
  channel: 'chrome',
  headless: true,
});

const preferences = () =>
  localStorage.setItem(
    'glassy-ui-preferences',
    JSON.stringify({ theme: 'dark', reduceMotion: false, reduceTransparency: false }),
  );

async function open(context, route) {
  const page = await context.newPage();
  const response = await page.goto(new URL(route, baseUrl).href, { waitUntil: 'networkidle' });

  assert.equal(response?.status(), 200, `${route} must resolve`);
  const privacy = page.getByRole('region', { name: 'Analytics privacy settings' });

  if (await privacy.isVisible()) {
    await privacy.getByRole('button', { name: 'Reject analytics', exact: true }).click();
    await privacy.waitFor({ state: 'detached' });
  }

  assert.equal(await privacy.isVisible(), false, `${route} must have no visible privacy panel`);

  return page;
}

const full = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
});

await full.addInitScript(preferences);

try {
  for (const slug of LAUNCH_EXAMPLES) {
    const page = await open(full, `/components/${slug}`);
    const preview = page.locator('.docs-preview');

    await preview.scrollIntoViewIfNeeded();

    if (slug === 'glass-scene') await preview.locator('[data-lg-scene-renderer="webgl"]').waitFor();

    await page.mouse.move(2, 2);
    await page.waitForTimeout(500);
    assert.equal(
      await page.getByRole('region', { name: 'Analytics privacy settings' }).isVisible(),
      false,
      `${slug} preview must not show the privacy panel`,
    );

    await preview.screenshot({ path: `public/previews/${slug}.png`, animations: 'disabled' });

    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`Captured ${LAUNCH_EXAMPLES.length} launch previews in public/previews.`);
