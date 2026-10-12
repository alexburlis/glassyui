import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

// Drives the Expo fixture's web build in Chromium at phone size: every section, each overlay
// open, the light theme and Reduce Transparency's opaque surfaces. It asserts the glass blurs
// what lies behind it, goes opaque when asked, and that nothing logs an error. Run Metro first
// (`npx expo start` in fixtures/expo-consumer) and pass its URL.

const baseUrl = process.argv[2];

const artifactDirectory = path.resolve(process.argv[3] ?? '.artifacts/expo-web');

if (!baseUrl) {
  console.error('Usage: node scripts/check-expo-web.mjs http://localhost:8081 [artifact-dir]');
  process.exit(1);
}

fs.mkdirSync(artifactDirectory, { recursive: true });

const browser = await chromium.launch();

const page = await browser.newPage({
  colorScheme: 'dark',
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  viewport: { height: 874, width: 402 },
});

const problems = [];

page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));

page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
});

const shots = [];

async function shoot(name) {
  const file = path.join(artifactDirectory, `${name}.png`);

  await page.waitForTimeout(600);
  await page.screenshot({ path: file });
  shots.push(file);
}

// The blur layers GlassSurface draws, as the browser computes them. The provider's usage example
// mounts a GlassProvider of its own, so the gallery's preference toggles do not reach it.
function countBlurredGlass() {
  return page.evaluate(
    () =>
      [...document.querySelectorAll('div')].filter(
        (node) =>
          getComputedStyle(node).backdropFilter.includes('blur') &&
          !node.closest('[data-testid="usage-glass-provider"]'),
      ).length,
  );
}

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 180_000 });
  await page.getByText('Glassy UI for Expo').waitFor({ timeout: 120_000 });

  const blurred = await countBlurredGlass();

  assert.ok(blurred >= 10, `expected the gallery's glass to blur its backdrop, found ${blurred}`);
  await shoot('01-material');

  for (const section of ['controls', 'display', 'overlays', 'menus']) {
    await page.getByTestId(`section-${section}`).scrollIntoViewIfNeeded();
    await shoot(`02-${section}`);
  }

  await page.getByTestId('open-dialog').click();
  await page.getByRole('dialog').first().waitFor();
  await shoot('03-dialog');
  await page.getByLabel('Close').first().click();
  await page.getByRole('dialog').first().waitFor({ state: 'detached' });

  await page.getByTestId('open-sheet').click();
  await shoot('04-sheet');
  await page.keyboard.press('Escape');

  await page.getByTestId('show-toast').click();
  await shoot('05-toast');

  await page.getByTestId('open-menu').scrollIntoViewIfNeeded();
  await page.getByTestId('open-menu').click();
  await shoot('06-menu');
  await page.keyboard.press('Escape');

  await page.getByTestId('open-select').click();
  await shoot('07-select');
  await page.keyboard.press('Escape');

  await page.getByTestId('toggle-theme').scrollIntoViewIfNeeded();
  await page.getByTestId('toggle-theme').click();
  await shoot('08-light');

  await page.getByTestId('toggle-transparency').click();
  await page.waitForTimeout(300);

  const opaqueBlurs = await countBlurredGlass();

  assert.equal(opaqueBlurs, 0, `Reduce Transparency left ${opaqueBlurs} blurred surfaces`);
  await shoot('09-opaque');

  assert.deepEqual(problems, [], `the gallery logged errors:\n${problems.join('\n')}`);

  const manifest = shots.map((file) => ({
    file: path.basename(file),
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
  }));

  fs.writeFileSync(
    path.join(artifactDirectory, 'manifest.json'),
    `${JSON.stringify({ baseUrl, blurred, shots: manifest }, null, 2)}\n`,
  );

  console.log(
    `Expo web check passed: ${blurred} blurred glass surfaces, all opaque under Reduce Transparency, ${shots.length} screenshots in ${artifactDirectory}.`,
  );
} finally {
  await browser.close();
}
