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
      let openerBuffer;
      let countDeskStyles = false;
      let deskStyles = 0;
      const computedStyle = window.getComputedStyle;
      window.getComputedStyle = function (element, ...args) {
        if (countDeskStyles && element.tagName !== 'CANVAS' && element.closest('.desk-screen'))
          deskStyles += 1;

        return computedStyle.call(this, element, ...args);
      };

      window.startDeskStyleCount = () => {
        deskStyles = 0;
        countDeskStyles = true;
      };

      window.stopDeskStyleCount = () => {
        countDeskStyles = false;

        return deskStyles;
      };

      for (const method of ['drawArrays', 'drawElements']) {
        const draw = WebGL2RenderingContext.prototype[method];
        WebGL2RenderingContext.prototype[method] = function (...args) {
          counts.set(this.canvas, (counts.get(this.canvas) ?? 0) + 1);

          if (this.canvas.closest('.keynote-stage .lg-phone-duo')) {
            const pixels = this.canvas.width * this.canvas.height;

            if (!openerBuffer || pixels > openerBuffer.pixels) {
              openerBuffer = {
                pixels,
                width: this.canvas.width,
                height: this.canvas.height,
                cssWidth: this.canvas.clientWidth,
                cssHeight: this.canvas.clientHeight,
              };
            }
          }

          return draw.apply(this, args);
        };
      }

      window.readTurnDraws = () =>
        [...counts].flatMap(([canvas, draws]) =>
          canvas.isConnected &&
          canvas.closest('.turn-player, .turn-desk-face') &&
          !canvas.closest('.desk-screen')
            ? [{ draws }]
            : [],
        );
      window.readOpenerBuffer = () => openerBuffer;
      window.readBodyDraws = () =>
        [...counts].reduce(
          (sum, [canvas, draws]) =>
            canvas.isConnected && canvas.closest('.turn-player') && !canvas.closest('[data-slab]')
              ? sum + draws
              : sum,
          0,
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

      await page.getByRole('button', { name: 'Replay intro', exact: true }).click();
      await page.waitForFunction(() => document.documentElement.hasAttribute('data-keynote-intro'));
      await page.waitForFunction(
        () => !document.documentElement.hasAttribute('data-keynote-intro'),
      );
      result.openerBuffer = await page.evaluate(() => window.readOpenerBuffer());
      assert.ok(result.openerBuffer, 'the opener phone never drew');
      const buffer = result.openerBuffer;
      const density = await page.evaluate(() => Math.min(4, Math.max(2, devicePixelRatio * 2)));
      assert.equal(
        buffer.width,
        Math.min(4096, Math.round(buffer.cssWidth * density)),
        'the intro phone lost its original horizontal sampling',
      );
      assert.equal(
        buffer.height,
        Math.min(4096, Math.round(buffer.cssHeight * density)),
        'the intro phone lost its original vertical sampling',
      );

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

      await at(0);

      const beforeLift = await page.evaluate(() => window.readBodyDraws());

      await at(30);
      await at(55);
      result.invisibleBodyDraws = await page.evaluate(
        (before) => window.readBodyDraws() - before,
        beforeLift,
      );
      assert.equal(result.invisibleBodyDraws, 0, 'the invisible zero-depth phone body redrew');

      await at(320);
      result.visibleBodyDraws = await page.evaluate(() => window.readBodyDraws());
      assert.ok(result.visibleBodyDraws > 0, 'the visible phone body never drew');
      await page.evaluate(() => window.startDeskStyleCount());
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
      result.hiddenDeskStyleReads = await page.evaluate(() => window.stopDeskStyleCount());
      assert.equal(result.hiddenDeskStyleReads, 0, 'the hidden desk kept measuring its panes');
      result.stationaryDraws = final.map((canvas, index) => canvas.draws - initial[index].draws);

      if (result.stationaryDraws.some((draws) => draws > 0)) {
        report.failures.push(
          `${width}: stationary phone shaders redrew ${result.stationaryDraws.join(', ')} times`,
        );
      }

      const checkShift = () =>
        page.waitForFunction(() => {
          const track = document.querySelector('.turn');

          const expected =
            Math.min(
              1,
              Math.max(
                0,
                -track.getBoundingClientRect().top /
                  (track.offsetHeight - document.querySelector('.turn-stage').clientHeight),
              ),
            ) * 719;

          return (
            Math.abs(Number(document.querySelector('.turn-stage').dataset.frame) - expected) < 0.5
          );
        });

      try {
        await page.evaluate(() => {
          const spacer = document.createElement('div');
          spacer.id = 'scroll-check-spacer';
          spacer.style.height = '160px';
          document.querySelector('main').before(spacer);
        });
        await checkShift();
      } finally {
        await page.evaluate(() => document.getElementById('scroll-check-spacer')?.remove());
      }

      await checkShift();
      result.layoutShiftTracked = true;
      await at(30);
      await page.waitForFunction(
        () =>
          document.querySelector('.desk-screen.lg-scene').getAttribute('data-lg-scene-state') !==
          'paused',
      );
      result.deskResumed = true;

      try {
        await page.evaluate(() => {
          const style = document.createElement('style');
          style.id = 'scene-visibility-check';
          style.textContent =
            '.turn-desk-face[data-state="scroll-hidden"] .desk-screen { visibility: hidden; }';
          document.head.append(style);
          document.querySelector('.turn-desk-face').setAttribute('data-state', 'scroll-hidden');
        });
        await page.waitForFunction(
          () =>
            document.querySelector('.desk-screen.lg-scene').getAttribute('data-lg-scene-state') ===
            'paused',
        );
        await page.evaluate(() =>
          document.querySelector('.turn-desk-face').removeAttribute('data-state'),
        );
        await page.waitForFunction(
          () =>
            document.querySelector('.desk-screen.lg-scene').getAttribute('data-lg-scene-state') !==
            'paused',
        );
        result.stateVisibilityResumed = true;
      } finally {
        await page.evaluate(() => {
          document.querySelector('.turn-desk-face').removeAttribute('data-state');
          document.getElementById('scene-visibility-check')?.remove();
        });
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
