import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:3000';

const directory = path.resolve(process.argv[3] ?? '.artifacts/phone-duo');

const poses = [
  ['Front', 180],
  ['Rear', 180],
  ['Cover', 0],
  ['Book', 120],
  ['Tent', 60],
  ['Laptop', 90],
  ['Side', 180],
];

const manifest = {
  status: 'running',
  surface: 'local Chrome',
  captures: [],
  motion: [],
  errors: [],
};

fs.mkdirSync(directory, { recursive: true });

async function assertSettled(page, figure, message) {
  await figure.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -180));
  const before = await figure.screenshot();
  await page.waitForTimeout(150);
  const after = await figure.screenshot();

  const difference = await page.evaluate(
    async (urls) => {
      const images = await Promise.all(
        urls.map(async (src) => {
          const image = new Image();
          image.src = src;
          await image.decode();

          return image;
        }),
      );

      const canvas = document.createElement('canvas');
      canvas.width = images[0].width;
      canvas.height = images[0].height;
      const ink = canvas.getContext('2d');

      const pixels = images.map((image) => {
        ink.clearRect(0, 0, canvas.width, canvas.height);
        ink.drawImage(image, 0, 0);

        return ink.getImageData(0, 0, canvas.width, canvas.height).data;
      });

      let largest = 0;

      for (let i = 0; i < pixels[0].length; i++)
        largest = Math.max(largest, Math.abs(pixels[0][i] - pixels[1][i]));

      return largest;
    },
    [before, after].map((buffer) => `data:image/png;base64,${buffer.toString('base64')}`),
  );

  // Allow one colour level of GPU raster rounding, not movement of the phone.
  assert.ok(difference <= 1, `${message}: ${difference} levels of pixel change`);
}

const browser = await chromium.launch({
  args: ['--disable-updater-scheduler'],
  channel: 'chrome',
  headless: true,
});

try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      deviceScaleFactor: 2,
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });

    await context.tracing.start({ screenshots: true, snapshots: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => manifest.errors.push(error.message));

    const response = await page.goto(`${baseUrl}/components/glass-phone-duo`, {
      waitUntil: 'networkidle',
    });

    assert.equal(response.status(), 200);
    await page.getByRole('button', { name: 'Reject analytics', exact: true }).click();
    const figure = page.locator('.lg-phone-duo');
    const hinge = page.getByRole('slider', { name: 'Hinge angle' });
    const choices = page.getByRole('group', { name: 'Phone pose', exact: true });

    for (const finish of ['Star White', 'Night Sky']) {
      await page.getByRole('radio', { name: finish, exact: true }).click();

      for (const [name, angle] of poses) {
        const choice = choices.getByRole('button', { name, exact: true });
        await choice.click({ timeout: 2500 });
        assert.equal(await choice.getAttribute('aria-pressed'), 'true');
        assert.equal(await hinge.getAttribute('aria-valuenow'), String(angle));
        await page.waitForTimeout(150);
        assert.equal(await figure.locator('figcaption').count(), 0);
        assert.ok(
          await figure
            .locator('img')
            .evaluateAll((images) =>
              images.every((image) => image.complete && image.naturalWidth > 0),
            ),
        );
        assert.equal(
          await figure
            .locator('canvas')
            .evaluate((canvas) => canvas.getContext('webgl2').getError()),
          0,
        );
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        await figure.scrollIntoViewIfNeeded();
        await page.evaluate(() => window.scrollBy(0, -180));
        const file = `${width}-${finish.replaceAll(' ', '-').toLowerCase()}-${name.toLowerCase()}.png`;
        await figure.screenshot({ path: path.join(directory, file) });
        manifest.captures.push({
          width,
          finish,
          pose: name,
          angle,
          file,
          sha256: crypto
            .createHash('sha256')
            .update(fs.readFileSync(path.join(directory, file)))
            .digest('hex'),
        });
      }
    }

    await choices.getByRole('button', { name: 'Book', exact: true }).click();
    await hinge.focus();

    for (const [key, angle] of [
      ['Home', 0],
      ['End', 180],
    ]) {
      await hinge.press(key);
      assert.equal(await hinge.getAttribute('aria-valuenow'), String(angle));
      await page.waitForTimeout(100);
      assert.equal(await figure.locator('figcaption').count(), 0);
    }

    await choices.getByRole('button', { name: 'Front', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => document.documentElement.dataset.lgReduceMotion === '0');
    await hinge.focus();

    // Observe the rendered canvas, not the target angle: an instant jump can
    // satisfy the slider's ARIA value while skipping every folding frame.
    // Arm before input, then sample after each complete draw batch and before
    // compositing clears WebGL's drawing buffer.
    const recording = await figure.locator('canvas').evaluateHandle((canvas) => {
      const gl = canvas.getContext('webgl2');
      // Queue a small patch into GPU buffers; synchronous readback can consume
      // the entire 120ms transition while waiting for the previous draw.
      const pixels = new Uint8Array(32 * 32 * 4);
      const frames = [];
      const pending = [];
      const figure = canvas.closest('.lg-phone-duo');
      const draw = gl.drawArrays;
      const packBuffer = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
      let started;
      let queued = false;
      let alive = true;
      let finish;
      let fail;

      const done = new Promise((resolve, reject) => {
        finish = resolve;
        fail = reject;
      });

      let timer = setTimeout(stop, 2500);

      async function collect(error) {
        const deadline = performance.now() + 2000;

        try {
          if (error) throw error;

          for (const { buffer, sync, time, fold } of pending) {
            let status = gl.clientWaitSync(sync, 0, 0);

            while (status === gl.TIMEOUT_EXPIRED) {
              if (performance.now() >= deadline) {
                throw new Error('The phone motion pixel readback exceeded two seconds.');
              }

              await new Promise((resolve) => setTimeout(resolve, 16));
              status = gl.clientWaitSync(sync, 0, 0);
            }

            if (status === gl.WAIT_FAILED) {
              throw new Error('The phone motion pixel readback failed.');
            }

            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
            gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels);
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, packBuffer);
            let hash = 2166136261;
            let visible = 0;

            for (let i = 0; i < pixels.length; i++) {
              hash = Math.imul(hash ^ pixels[i], 16777619);

              if (i % 4 === 3 && pixels[i] > 0) visible++;
            }

            if (visible > 0) frames.push({ time, fold, hash: hash >>> 0 });
          }

          return frames;
        } finally {
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, packBuffer);

          for (const { buffer, sync } of pending) {
            if (sync) gl.deleteSync(sync);

            gl.deleteBuffer(buffer);
          }
        }
      }

      function stop(error) {
        if (!alive) return done;

        alive = false;
        clearTimeout(timer);
        document.removeEventListener('keydown', begin, true);
        gl.drawArrays = draw;
        collect(error).then(finish, fail);

        return done;
      }

      function begin(event) {
        if (event.key !== 'Home' || started !== undefined) return;

        started = performance.now();
        clearTimeout(timer);
        timer = setTimeout(stop, 500);
      }

      function sample() {
        queued = false;

        if (!alive) return;

        try {
          const buffer = gl.createBuffer();

          if (!buffer) throw new Error('The phone motion pixel buffer could not be created.');

          const capture = {
            buffer,
            sync: null,
            time: performance.now() - started,
            fold: Number(getComputedStyle(figure).getPropertyValue('--lg-phone-duo-fold')),
          };

          pending.push(capture);
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
          gl.bufferData(gl.PIXEL_PACK_BUFFER, pixels.length, gl.STREAM_READ);
          gl.readPixels(
            Math.floor(canvas.width / 2) - 16,
            Math.floor(canvas.height / 2) - 16,
            32,
            32,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            0,
          );
          capture.sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);

          if (!capture.sync) throw new Error('The phone motion pixel fence could not be created.');

          gl.flush();
        } catch (error) {
          stop(error);
        } finally {
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, packBuffer);
        }
      }

      document.addEventListener('keydown', begin, true);
      gl.drawArrays = function (...args) {
        const result = draw.apply(this, args);

        if (alive && started !== undefined && !queued) {
          queued = true;
          queueMicrotask(sample);
        }

        return result;
      };

      return { done, stop };
    });

    let frames;

    try {
      await hinge.press('Home');
      frames = await recording.evaluate(({ done }) => done);
    } finally {
      try {
        await recording.evaluate(({ stop }) => stop());
      } finally {
        await recording.dispose();
      }
    }

    manifest.motion.push({ width, action: 'slider close', frames });
    assert.ok(
      new Set(frames.map((frame) => frame.hash)).size >= 3,
      `${width}: the hinge slider must render intermediate folding frames instead of snapping`,
    );
    assert.equal(await hinge.getAttribute('aria-valuenow'), '0');
    await hinge.press('End');
    await page.waitForTimeout(500);

    await hinge.scrollIntoViewIfNeeded();
    const track = await page.locator('.phone-duo-showcase-fold .lg-slider').boundingBox();
    await page.mouse.move(track.x + track.width - 8, track.y + track.height / 2);
    await page.mouse.down();
    await page.mouse.move(track.x + 8, track.y + track.height / 2, { steps: 18 });
    await page.mouse.move(track.x + track.width * 0.7, track.y + track.height / 2, { steps: 12 });
    await page.mouse.move(track.x + track.width * 0.25, track.y + track.height / 2, { steps: 8 });
    await page.mouse.up();
    const reversedAngle = Number(await hinge.getAttribute('aria-valuenow'));
    assert.ok(
      reversedAngle > 30 && reversedAngle < 60,
      `the dragged hinge must follow reversal: ${reversedAngle} degrees`,
    );
    await page.waitForTimeout(250);
    await assertSettled(page, figure, 'the hinge must settle after release');

    await hinge.press('End');
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Close phone', exact: true }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Open phone', exact: true }).click();
    await page.waitForTimeout(1400);
    assert.equal(await figure.getAttribute('data-fold'), 'open');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.documentElement.dataset.lgReduceMotion === '1');

    const lightImages = await figure
      .locator('img')
      .evaluateAll((images) => images.map((image) => image.currentSrc));

    await page.getByRole('button', { name: 'Change appearance', exact: true }).press('Enter');
    await page.waitForFunction(() => document.documentElement.dataset.lgTheme === 'dark');
    await page.waitForFunction((before) => {
      const images = [...document.querySelectorAll('.lg-phone-duo img')];

      return images.every(
        (image, index) =>
          image.complete && image.naturalWidth > 0 && image.currentSrc !== before[index],
      );
    }, lightImages);
    await figure.screenshot({ path: path.join(directory, `${width}-dark-theme.png`) });
    await page.getByRole('button', { name: 'Change appearance', exact: true }).press('Enter');
    await page.waitForFunction(() => document.documentElement.dataset.lgTheme === 'light');
    await page.waitForFunction(
      (before) =>
        [...document.querySelectorAll('.lg-phone-duo img')].every(
          (image, index) => image.complete && image.currentSrc === before[index],
        ),
      lightImages,
    );
    await hinge.press('Home');
    await page.waitForTimeout(100);
    assert.equal(await hinge.getAttribute('aria-valuenow'), '0');
    await assertSettled(page, figure, 'reduced motion must keep the completed state');
    assert.deepEqual(manifest.errors, []);
    await context.tracing.stop({ path: path.join(directory, `trace-${width}.zip`) });
    await context.close();
  }

  manifest.status = 'passed';
} catch (error) {
  manifest.status = 'failed';
  manifest.error = error.message;
  throw error;
} finally {
  fs.writeFileSync(path.join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await browser.close();
}

console.log(`Phone Duo passed: ${manifest.captures.length} desktop/mobile pose captures.`);
