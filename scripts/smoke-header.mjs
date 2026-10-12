import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

const baseUrl = process.argv[2];

const artifactDirectory = process.argv[3];

if (!baseUrl || !artifactDirectory) {
  throw new Error('Usage: node scripts/smoke-header.mjs <base-url> <artifact-directory>');
}

fs.mkdirSync(artifactDirectory, { recursive: true });

const results = [];

const widths = [320, 390, 768, 1280];

const modes = [
  { theme: 'light', reduceTransparency: false },
  { theme: 'dark', reduceTransparency: false },
  { theme: 'light', reduceTransparency: true },
  { theme: 'dark', reduceTransparency: true },
];

for (const [engine, browserType] of [
  ['chrome', chromium],
  ['firefox', firefox],
  ['webkit', webkit],
]) {
  const launchOptions = { headless: true };

  if (engine === 'chrome') {
    launchOptions.channel = 'chrome';
    launchOptions.args = ['--disable-updater-scheduler'];
  }

  const browser = await browserType.launch(launchOptions);

  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));

      await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });
      await page.getByRole('banner').getByRole('button', { name: 'Change appearance' }).waitFor();
      assert.equal(await page.locator('html').getAttribute('data-lg-theme'), 'light');

      for (const mode of modes) {
        await page.evaluate((preferences) => {
          localStorage.setItem('glassy-ui-preferences', JSON.stringify(preferences));
        }, mode);
        await page.reload({ waitUntil: 'networkidle' });
        const header = page.getByRole('banner');
        await header.getByRole('button', { name: 'Change appearance' }).waitFor();

        // The header opens across the page at the top and condenses into the capsule once the
        // page scrolls; each wait lasts until it rests in that shape.
        const settle = (condensed) =>
          page.waitForFunction((state) => {
            const node = document.querySelector('header.lg-header');

            return node?.dataset.condensed === state && !node.getAttribute('style');
          }, String(condensed));

        const pageWidth = await page.evaluate(() => document.documentElement.clientWidth);
        const capsuleWidth = Math.min(920, width - (width <= 700 ? 20 : 32));

        const openWidth =
          width <= 700 ? pageWidth : Math.max(capsuleWidth, Math.min(1200, pageWidth - 48));

        await settle(false);
        const open = await header.boundingBox();
        assert.ok(open, 'The header must be visible.');
        assert.equal(open.height, 56, 'The open header must match the reference height.');
        assert.ok(Math.abs(open.width - openWidth) < 1, 'The open header must span the page.');
        assert.ok(Math.abs(open.x + open.width / 2 - pageWidth / 2) < 1, 'It must be centered.');
        assert.equal(
          open.y,
          width <= 700 ? 8 : 14,
          'The open header must sit at the capsule line.',
        );

        await page.evaluate(() => window.scrollTo(0, 450));
        await settle(true);
        const box = await header.boundingBox();
        assert.ok(box, 'The header must stay visible while scrolling.');
        assert.equal(box.height, 56, 'The header must match the reference height.');
        assert.ok(Math.abs(box.width - capsuleWidth) < 1, 'The header must condense on scroll.');
        assert.ok(Math.abs(box.x + box.width / 2 - pageWidth / 2) < 1, 'It must be centered.');
        assert.equal(box.y, open.y, 'The header must stay fixed while scrolling.');

        const material = await header.locator('.lg-header-glass').evaluate((node) => {
          const style = getComputedStyle(node, '::before');

          return { blur: style.backdropFilter, fill: style.backgroundColor };
        });

        assert.equal(material.blur === 'none', mode.reduceTransparency);

        if (mode.reduceTransparency) {
          assert.match(
            material.fill,
            /^rgb\(/,
            'Reduced transparency must make the header opaque.',
          );
        }

        const targets = await header.locator('a, button, summary').evaluateAll((nodes) =>
          nodes
            .filter(
              (node) =>
                node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden',
            )
            .map((node) => {
              const rect = node.getBoundingClientRect();

              return {
                name: node.textContent || node.getAttribute('aria-label'),
                left: rect.left,
                right: rect.right,
              };
            }),
        );

        assert.ok(
          targets.every((target) => target.left >= box.x && target.right <= box.x + box.width + 1),
          `Header controls must fit: ${JSON.stringify(targets)}`,
        );

        const screenshot = `${engine}-${width}-${mode.theme}-${mode.reduceTransparency ? 'opaque' : 'glass'}.png`;
        await page.screenshot({
          path: path.join(artifactDirectory, screenshot.replace('.png', '-capsule.png')),
          clip: { x: 0, y: 0, width, height: 140 },
        });
        await page.evaluate(() => window.scrollTo(0, 0));
        await settle(false);
        await page.screenshot({
          path: path.join(artifactDirectory, screenshot),
          clip: { x: 0, y: 0, width, height: 140 },
        });
        results.push({ engine, width, ...mode, open, box, screenshot });
      }

      const header = page.getByRole('banner');
      const menu = header.locator('summary');

      if (await menu.isVisible()) {
        await menu.focus();
        await page.keyboard.press('Enter');

        const links = header
          .locator('details')
          .getByRole('navigation', { name: 'Primary', exact: true });

        await links.getByRole('link', { name: 'Docs', exact: true }).waitFor({ state: 'visible' });
        assert.ok(
          await links.getByRole('link', { name: 'Docs', exact: true }).evaluate((node) => {
            const rect = node.getBoundingClientRect();

            return node.contains(
              document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
            );
          }),
          'The glass must not clip the open mobile menu.',
        );
        await page.screenshot({
          path: path.join(artifactDirectory, `${engine}-${width}-menu.png`),
          clip: { x: 0, y: 0, width, height: 340 },
        });
        await links.getByRole('link', { name: 'Components', exact: true }).focus();
        await page.keyboard.press('Escape');
        assert.equal(await header.locator('details').getAttribute('open'), null);
        assert.ok(await menu.evaluate((node) => document.activeElement === node));
        await menu.click();
        await links.getByRole('link', { name: 'Docs', exact: true }).click();
      } else {
        await header.getByRole('link', { name: 'Docs', exact: true }).click();
      }

      await page.waitForURL('**/docs', { waitUntil: 'networkidle' });
      assert.equal(
        await page
          .getByRole('banner')
          .locator('.lg-header-desktop')
          .getByRole('link', { name: 'Docs', exact: true, includeHidden: true })
          .getAttribute('aria-current'),
        'page',
      );

      await page.getByRole('banner').getByRole('button', { name: 'Search', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Search Glassy UI' });
      await dialog.waitFor({ state: 'visible' });
      await dialog.getByRole('combobox').fill('Glass Header');
      await dialog.getByRole('option', { name: /^Header/ }).click();
      await page.waitForURL('**/components/glass-header', { waitUntil: 'networkidle' });

      const preview = page.locator('.docs-preview');
      const example = preview.locator('header');
      assert.equal(
        await example.evaluate((node) => getComputedStyle(node).position),
        'relative',
        'A static header must stay inside its documentation preview.',
      );
      const exampleBox = await example.boundingBox();
      const previewBox = await preview.boundingBox();
      assert.ok(
        exampleBox &&
          previewBox &&
          exampleBox.x >= previewBox.x &&
          exampleBox.x + exampleBox.width <= previewBox.x + previewBox.width + 1,
      );
      await example.locator('summary').click();
      await example
        .locator('details')
        .getByRole('link', { name: 'Components', exact: true })
        .waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      await preview.screenshot({
        path: path.join(artifactDirectory, `${engine}-${width}-preview.png`),
      });

      const theme = await page.locator('html').getAttribute('data-lg-theme');
      await page.getByRole('banner').getByRole('button', { name: 'Change appearance' }).click();
      await page.waitForFunction(
        (before) => document.documentElement.getAttribute('data-lg-theme') !== before,
        theme,
      );

      if (await menu.isVisible()) await menu.click();
      await header.getByRole('link', { name: 'Components', exact: true }).click();
      await page.waitForURL('**/components', { waitUntil: 'networkidle' });
      await page.evaluate(() => {
        window.location.hash = 'navigation';
      });
      const bannerBox = await page.getByRole('banner').boundingBox();

      const headingBox = await page
        .getByRole('main')
        .getByRole('heading', { name: 'Navigation', exact: true })
        .boundingBox();

      assert.ok(
        bannerBox && headingBox && headingBox.y >= bannerBox.y + bannerBox.height + 8,
        'A link to a category must land its heading below the floating header.',
      );
      await page.screenshot({
        path: path.join(artifactDirectory, `${engine}-${width}-category.png`),
        clip: { x: 0, y: 0, width, height: 260 },
      });
      assert.deepEqual(errors, [], `${engine}: the header must not cause runtime errors.`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

fs.writeFileSync(
  path.join(artifactDirectory, 'results.json'),
  `${JSON.stringify({ results }, null, 2)}\n`,
);

console.log(
  `Header smoke passed: ${results.length} appearance/viewport checks across Chrome, Firefox and WebKit. Artifacts: ${artifactDirectory}`,
);
