// Fast scrolling must reach the current turn frame without an easing tail, and moving
// feature text must not redraw a phone whose body and reflections have stopped turning.
// Real wheel input and native WebGL draws exercise those contracts without a production seam.
// Existing check:keynote turn-live owns live edits, reversal and reduced motion.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const [baseUrl, directory] = process.argv.slice(2);

if (!baseUrl || !directory || !['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)) {
  throw new Error(
    'Usage: node scripts/check-home-scroll.mjs http://127.0.0.1:3000 <evidence-directory>',
  );
}

await fs.mkdir(directory, { recursive: true });

const report = { baseUrl, cases: [], failures: [] };

const browser = await chromium.launch({
  args: ['--disable-updater-scheduler'],
  channel: 'chrome',
  headless: true,
});

try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: 'light',
    });

    await context.addInitScript(() => {
      localStorage.setItem('glassy-ui-intro', 'seen');
      const counts = new Map();
      const draw = WebGL2RenderingContext.prototype.drawArrays;
      WebGL2RenderingContext.prototype.drawArrays = function (...args) {
        counts.set(this.canvas, (counts.get(this.canvas) ?? 0) + 1);

        return draw.apply(this, args);
      };

      window.readTurnDraws = () =>
        [...counts].flatMap(([canvas, draws]) =>
          canvas.isConnected &&
          canvas.closest('.turn-player, .turn-desk-face') &&
          !canvas.closest('.desk-screen')
            ? [{ draws }]
            : [],
        );
    });
    const page = await context.newPage();
    await context.tracing.start({ screenshots: true, snapshots: true });
    const result = { width };
    report.cases.push(result);

    try {
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      const privacy = page.getByRole('region', { name: 'Analytics privacy settings' });
      await privacy.getByRole('button', { name: 'Reject analytics', exact: true }).click();
      await page.waitForSelector('.turn-player [data-slab]', { state: 'attached' });

      const geometry = await page.evaluate(() => {
        const track = document.querySelector('.turn');

        return {
          top: track.getBoundingClientRect().top + scrollY,
          range: track.offsetHeight - document.querySelector('.turn-stage').clientHeight,
        };
      });

      const at = async (frame) => {
        await page.evaluate(
          (y) => scrollTo({ top: y, behavior: 'instant' }),
          geometry.top + (geometry.range * frame) / 719,
        );
        await page.waitForFunction(
          (target) =>
            Math.abs(Number(document.querySelector('.turn-stage').dataset.frame) - target) < 0.5,
          frame,
        );
        await page.waitForTimeout(300);
      };

      await at(320);
      const initial = await page.evaluate(() => window.readTurnDraws());
      // Move the features through their arrival while the settled phone remains still.
      await page.evaluate(async ({ top, range }) => {
        const start = performance.now();
        await new Promise((resolve) => {
          const tick = (now) => {
            const progress = Math.min((now - start) / 750, 1);
            scrollTo({ top: top + (range * (320 + 350 * progress)) / 719, behavior: 'instant' });

            if (progress === 1) resolve();
            else requestAnimationFrame(tick);
          };

          requestAnimationFrame(tick);
        });
      }, geometry);
      await at(670);
      const final = await page.evaluate(() => window.readTurnDraws());
      result.stationaryDraws = final.map((canvas, index) => canvas.draws - initial[index].draws);

      if (result.stationaryDraws.some((draws) => draws > 0)) {
        report.failures.push(
          `${width}: stationary phone shaders redrew ${result.stationaryDraws.join(', ')} times`,
        );
      }

      await at(110);
      await page.mouse.move(width / 2, 850);
      await page.mouse.wheel(0, (geometry.range * 300) / 719);
      await page.waitForFunction(
        (y) => scrollY > y + 100,
        geometry.top + (geometry.range * 110) / 719,
      );
      // After two display frames the turn should be within two composition frames of scroll.
      result.fling = await page.evaluate(async ({ top, range }) => {
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        return {
          expected: Math.min(Math.max((scrollY - top) / range, 0), 1) * 719,
          actual: Number(document.querySelector('.turn-stage').dataset.frame),
        };
      }, geometry);
      result.fling.error = Math.abs(result.fling.expected - result.fling.actual);

      if (result.fling.error > 2)
        report.failures.push(
          `${width}: turn trails wheel input by ${result.fling.error.toFixed(1)} frames`,
        );
      await page.screenshot({ path: path.join(directory, `${width}-fling.png`) });
      await at(719);
      await page.screenshot({ path: path.join(directory, `${width}-landed.png`) });
      await page.evaluate(
        (y) => scrollTo({ top: y, behavior: 'instant' }),
        geometry.top + geometry.range + 1200,
      );
      await page.waitForTimeout(1000);
      const hiddenBefore = await page.evaluate(() => window.readTurnDraws());
      await page.mouse.move(5, 5, { steps: 3 });
      await page.waitForTimeout(500);
      const hiddenAfter = await page.evaluate(() => window.readTurnDraws());
      result.offscreenDraws = hiddenAfter.map(
        (canvas, index) => canvas.draws - hiddenBefore[index].draws,
      );

      if (result.offscreenDraws.some((draws) => draws > 0)) {
        report.failures.push(
          `${width}: offscreen pointer movement redrew phone shaders ${result.offscreenDraws.join(', ')} times`,
        );
      }
    } catch (error) {
      report.failures.push(`${width}: ${error.message}`);
    } finally {
      await context.tracing.stop({ path: path.join(directory, `${width}-trace.zip`) });
      await context.close();
    }
  }
} finally {
  await browser.close();
  report.artifacts = [];

  for (const file of await fs.readdir(directory)) {
    if (file === 'report.json') continue;
    const data = await fs.readFile(path.join(directory, file));
    report.artifacts.push({
      file,
      bytes: data.length,
      sha256: createHash('sha256').update(data).digest('hex'),
    });
  }

  await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
}

console.log(JSON.stringify(report, null, 2));

assert.deepEqual(report.failures, []);
