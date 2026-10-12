import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// The installed-consumer smoke owns installation, build and browser startup.
// Chrome's real media emulation changes both CSS and matchMedia, with no mocks.
export async function checkConsumerTransparency(browser, fixtureUrl, artifactDirectory) {
  const directory = path.join(artifactDirectory, 'system-transparency');
  fs.mkdirSync(directory, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 800, height: 900 } });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  const samples = [];
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

  const setSystemTransparency = async (value) => {
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-transparency', value }],
    });
  };

  const readMaterial = () =>
    page.evaluate(() => {
      const panel = document.querySelector('[data-testid="transparency-panel"]');
      const style = getComputedStyle(panel, '::before');
      const pixel = document.createElement('canvas');
      pixel.width = pixel.height = 1;
      const painter = pixel.getContext('2d');
      painter.fillStyle = style.backgroundColor;
      painter.fillRect(0, 0, 1, 1);

      return {
        system: matchMedia('(prefers-reduced-transparency: reduce)').matches,
        explicit: document.documentElement.getAttribute('data-lg-reduce-transparency'),
        panel: {
          backdrop: style.backdropFilter,
          alpha: painter.getImageData(0, 0, 1, 1).data[3],
          generated: panel.getAttribute('data-lg-generated-refraction'),
        },
        scene: document
          .querySelector('[data-testid="transparency-scene"]')
          .getAttribute('data-lg-scene-renderer'),
        inputBackdrop: getComputedStyle(document.querySelector('.lg-input')).backdropFilter,
        dropBackdrop: getComputedStyle(document.querySelector('.lg-scene-drop')).backdropFilter,
      };
    });

  const checkMaterial = async (label, opaque) => {
    // Media styles are synchronous. Opacity gives a useful baseline failure
    // before waiting for React or WebGL transitions. A generated glass backdrop
    // already owns its filter, so its pseudo-element can have no filter normally.
    const initial = await readMaterial();
    samples.push({ label, ...initial });
    assert.equal(initial.panel.alpha === 255, opaque, `${label}: the panel opacity is wrong`);

    if (opaque) {
      assert.equal(initial.panel.backdrop, 'none', `${label}: panel frost must stop`);
    }

    await page.waitForFunction(
      (expectedOpaque) => {
        const panel = document.querySelector('[data-testid="transparency-panel"]');
        const scene = document.querySelector('[data-testid="transparency-scene"]');

        return (
          panel.getAttribute('data-lg-generated-refraction') === String(!expectedOpaque) &&
          scene.getAttribute('data-lg-scene-renderer') === (expectedOpaque ? 'off' : 'webgl')
        );
      },
      opaque,
      { timeout: 10_000 },
    );
    const final = await readMaterial();
    assert.equal(final.inputBackdrop === 'none', opaque, `${label}: input frost is wrong`);
    assert.equal(final.dropBackdrop, 'none', `${label}: the scene owns its droplet material`);
    samples.push({ label: `${label}-settled`, ...final });
    await page.screenshot({ path: path.join(directory, `${label}.png`), fullPage: true });
  };

  try {
    await setSystemTransparency('reduce');
    await page.goto(new URL('/preferences', fixtureUrl).href, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('data-lg-reduce-transparency'), null);
    assert.equal((await readMaterial()).system, true, 'Chrome must emulate the real media query');
    await checkMaterial('providerless-initial-reduce', true);

    await page.getByRole('button', { name: 'Open transparency dialog' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();

    const dialogMaterial = await dialog.evaluate((node) => {
      const style = getComputedStyle(node);

      return { backdrop: style.backdropFilter, background: style.backgroundColor };
    });

    assert.equal(dialogMaterial.backdrop, 'none', 'System transparency must protect portal layers');
    assert.match(
      dialogMaterial.background,
      /^rgb\([^/]+\)$/,
      'The dialog must have an opaque fill',
    );
    samples.push({ label: 'providerless-dialog', ...dialogMaterial });
    await page.keyboard.press('Escape');

    await setSystemTransparency('no-preference');
    await checkMaterial('providerless-live-glass', false);
    await setSystemTransparency('reduce');
    await checkMaterial('providerless-live-reduce', true);

    await page.getByRole('button', { name: 'Enable preference controls' }).click();
    await page.waitForFunction(
      () => document.documentElement.getAttribute('data-lg-reduce-transparency') === '1',
    );
    await checkMaterial('provider-system-reduce', true);
    await page.getByRole('button', { name: 'Use glass', exact: true }).click();
    await checkMaterial('provider-explicit-glass', false);
    await setSystemTransparency('no-preference');
    await setSystemTransparency('reduce');
    await checkMaterial('provider-glass-after-system-change', false);
    await page.getByRole('button', { name: 'Use opaque surfaces', exact: true }).click();
    await setSystemTransparency('no-preference');
    await checkMaterial('provider-explicit-opaque', true);
    assert.deepEqual(runtimeErrors, [], 'Installed transparency controls must not throw');

    // CSS must protect the first paint before any provider or hook runs.
    const staticContext = await browser.newContext({ javaScriptEnabled: false });

    try {
      const staticPage = await staticContext.newPage();
      const staticSession = await staticContext.newCDPSession(staticPage);
      await staticSession.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
      });
      await staticPage.goto(new URL('/preferences', fixtureUrl).href, {
        waitUntil: 'networkidle',
      });

      const backdrop = await staticPage
        .getByTestId('transparency-panel')
        .evaluate((node) => getComputedStyle(node, '::before').backdropFilter);

      assert.equal(backdrop, 'none', 'System transparency must protect the CSS-only first paint');
      await staticPage.screenshot({
        path: path.join(directory, 'providerless-before-javascript.png'),
        fullPage: true,
      });
    } finally {
      await staticContext.close();
    }
  } catch (error) {
    samples.push({ label: 'failure', message: error.message, ...(await readMaterial()) });
    await page.screenshot({ path: path.join(directory, 'failure.png'), fullPage: true });
    throw error;
  } finally {
    fs.writeFileSync(
      path.join(directory, 'report.json'),
      `${JSON.stringify({ samples, runtimeErrors }, null, 2)}\n`,
    );
    await context.tracing.stop({ path: path.join(directory, 'trace.zip') });
    await context.close();
  }
}
