import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

// Proves the Glass Logo Reveal on its docs page in Chromium, WebKit and Firefox, at desktop and
// phone widths in both themes: it draws with WebGL2, moves, lands exactly on the real mark,
// holds a scrubbed moment, plays again, and shows the mark at once under reduced motion.
const baseUrl = process.argv[2] ?? 'http://127.0.0.1:3000';

const directory = path.resolve(process.argv[3] ?? '.artifacts/logo-reveal');

const runs = [
  { width: 1280, theme: 'dark' },
  { width: 390, theme: 'light' },
];

const engines = [
  { name: 'chromium', type: chromium, options: { channel: 'chrome' } },
  { name: 'webkit', type: webkit, options: {} },
  { name: 'firefox', type: firefox, options: {} },
];

const manifest = {
  status: 'running',
  surface: 'docs page, local browsers',
  captures: [],
  landings: [],
  errors: [],
};

fs.mkdirSync(directory, { recursive: true });

function keep(file) {
  manifest.captures.push({
    file,
    sha256: crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(directory, file)))
      .digest('hex'),
  });
}

// The mean difference per colour channel between two screenshots of the same element, 0 to 255.
async function difference(page, before, after) {
  return page.evaluate(
    async (pictures) => {
      const pixels = await Promise.all(
        pictures.map(async (src) => {
          const image = new Image();
          image.src = src;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const ink = canvas.getContext('2d');
          ink.drawImage(image, 0, 0);

          return ink.getImageData(0, 0, canvas.width, canvas.height).data;
        }),
      );

      if (pixels[0].length !== pixels[1].length) throw new Error('Screenshots changed size.');

      let total = 0;

      for (let index = 0; index < pixels[0].length; index++)
        total += Math.abs(pixels[0][index] - pixels[1][index]);

      return total / pixels[0].length;
    },
    [before, after].map((buffer) => `data:image/png;base64,${buffer.toString('base64')}`),
  );
}

const hash = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

try {
  for (const engine of engines) {
    const browser = await engine.type.launch({ headless: true, ...engine.options });

    try {
      for (const { width, theme } of runs) {
        const label = `${engine.name} ${width} ${theme}`;
        const prefix = `${engine.name}-${width}-${theme}`;

        const context = await browser.newContext({
          viewport: { width, height: 900 },
          deviceScaleFactor: 2,
        });

        // Once per tab, so a reload keeps a preference the check has changed.
        await context.addInitScript((chosen) => {
          if (sessionStorage.getItem('logo-reveal-check')) return;

          sessionStorage.setItem('logo-reveal-check', '1');
          localStorage.setItem(
            'glassy-ui-preferences',
            JSON.stringify({ theme: chosen, reduceMotion: false, reduceTransparency: false }),
          );
        }, theme);
        await context.tracing.start({ screenshots: true, snapshots: true });

        const page = await context.newPage();

        page.on('pageerror', (error) => manifest.errors.push(`${label}: ${error.message}`));

        const response = await page.goto(`${baseUrl}/components/glass-logo-reveal`, {
          waitUntil: 'networkidle',
        });

        assert.equal(response?.status(), 200, `${label}: the page must load`);

        const consent = page.getByRole('button', { name: 'Reject analytics', exact: true });

        if (await consent.count()) await consent.click();

        const preview = page.locator('.docs-preview');
        const reveal = preview.locator('.lg-logo-reveal');
        const moment = preview.getByRole('slider', { name: 'Moment' });
        const replay = preview.getByRole('button', { name: 'Replay', exact: true });

        await preview.getByRole('img', { name: 'Glassy UI', exact: true }).scrollIntoViewIfNeeded();
        assert.equal(await reveal.getAttribute('data-renderer'), 'webgl', `${label}: WebGL2`);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${label}: the page must not scroll sideways`,
        );

        // Watch one run from its first frame: the canvas must change as the glass moves.
        await replay.click();
        await preview.locator('.lg-logo-reveal[data-state="playing"]').waitFor();

        const frames = [];

        for (let step = 0; step < 4; step++) {
          await page.waitForTimeout(420);
          frames.push(hash(await reveal.screenshot()));
        }

        assert.ok(new Set(frames).size >= 3, `${label}: the reveal must move while it plays`);
        await preview.locator('.lg-logo-reveal[data-state="ended"]').waitFor({ timeout: 6000 });
        assert.equal(await moment.getAttribute('aria-valuenow'), '100', `${label}: it landed`);

        // The canvas's last frame alone, then the page's own mark alone.
        const canvasOnly = await page.addStyleTag({
          content:
            '.lg-logo-reveal-canvas { opacity: 1 !important; transition: none !important; } .lg-logo-reveal-mark { visibility: hidden !important; }',
        });

        await page.waitForTimeout(100);

        const lastFrame = await reveal.screenshot({
          path: path.join(directory, `${prefix}-last-frame.png`),
        });

        await canvasOnly.evaluate((node) => node.remove());
        await page.waitForTimeout(400);

        const lockup = await reveal.screenshot({
          path: path.join(directory, `${prefix}-lockup.png`),
        });

        keep(`${prefix}-last-frame.png`);
        keep(`${prefix}-lockup.png`);

        const landing = await difference(page, lastFrame, lockup);

        manifest.landings.push({ run: label, meanDifference: Number(landing.toFixed(3)) });
        assert.ok(
          landing < 0.6,
          `${label}: the last frame must land on the real mark (${landing.toFixed(2)})`,
        );

        // A scrubbed moment holds; the end of the timeline is the mark itself.
        await moment.focus();
        await page.keyboard.press('Home');

        for (let step = 0; step < 38; step++) await page.keyboard.press('ArrowRight');

        await preview.locator('.lg-logo-reveal[data-state="held"]').waitFor();
        await page.waitForTimeout(150);

        const held = await reveal.screenshot({ path: path.join(directory, `${prefix}-held.png`) });

        keep(`${prefix}-held.png`);
        assert.ok(
          (await difference(page, held, lockup)) > 1,
          `${label}: the held moment must show the glass`,
        );
        await page.waitForTimeout(300);
        assert.equal(
          hash(await reveal.screenshot()),
          hash(held),
          `${label}: a held moment must stand still`,
        );
        await page.keyboard.press('End');
        await preview.locator('.lg-logo-reveal[data-state="ended"]').waitFor();

        // The system setting shows the mark at once.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await replay.click();
        await page.waitForTimeout(100);
        assert.equal(
          await reveal.getAttribute('data-state'),
          'ended',
          `${label}: reduced motion must show the mark at once`,
        );
        assert.ok(
          (await difference(page, lockup, await reveal.screenshot())) < 0.6,
          `${label}: reduced motion must show the same mark`,
        );
        await page.emulateMedia({ reducedMotion: 'no-preference' });

        // So does the site's own preference, from the first frame after a reload.
        await page.evaluate((chosen) => {
          localStorage.setItem(
            'glassy-ui-preferences',
            JSON.stringify({ theme: chosen, reduceMotion: true }),
          );
        }, theme);
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForFunction(() => document.documentElement.dataset.lgReduceMotion === '1');
        await preview.getByRole('img', { name: 'Glassy UI', exact: true }).scrollIntoViewIfNeeded();
        assert.equal(
          await reveal.getAttribute('data-state'),
          'ended',
          `${label}: the site preference must show the mark at once`,
        );

        const still = await reveal.screenshot({
          path: path.join(directory, `${prefix}-still.png`),
        });

        keep(`${prefix}-still.png`);
        assert.ok(
          (await difference(page, lockup, still)) < 0.6,
          `${label}: the site preference must show the same mark`,
        );
        await context.tracing.stop({ path: path.join(directory, `${prefix}-trace.zip`) });
        await context.close();
      }
    } finally {
      await browser.close();
    }
  }

  assert.deepEqual(manifest.errors, [], 'the page must not throw');
  manifest.status = 'passed';
} catch (error) {
  manifest.status = 'failed';
  manifest.errors.push(String(error?.stack ?? error));
  throw error;
} finally {
  fs.writeFileSync(path.join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

console.log(`Logo reveal checks passed. Evidence: ${directory}`);
