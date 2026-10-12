import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

// Capture the live desk at each display's proportions, with room for the
// rounded corners and the cover camera. Keep that inset in the source images.
const baseUrl = process.argv[2] ?? 'http://127.0.0.1:3000';

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'glassyui-duo-screens-'));

const browser = await chromium.launch({
  args: ['--disable-updater-scheduler'],
  channel: 'chrome',
  headless: true,
});

try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1100 },
      deviceScaleFactor: 2,
      colorScheme: theme,
      reducedMotion: 'reduce',
    });

    await page.goto(`${baseUrl}/#desk`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Reject analytics', exact: true }).click();

    if ((await page.locator('html').getAttribute('data-lg-theme')) !== theme) {
      await page.getByRole('button', { name: 'Change appearance', exact: true }).press('Enter');
    }

    await page.waitForFunction(
      (theme) => document.documentElement.dataset.lgTheme === theme,
      theme,
    );
    const desk = page.locator('.home-desk-frame .desk-screen');
    await desk.locator('xpath=..').locator('[data-lg-scene-renderer="webgl"]').waitFor();
    await page.addStyleTag({
      content: `
      .home-desk-frame { width: 890px; max-width: none; }
      .home-desk-frame .desk-screen {
        --desk-wallpaper: url('/wallpapers/vermilion-desk-duo-${theme}.svg') !important;
        height: 627px; border-radius: 0; box-shadow: none;
      }
      .home-desk-frame .desk-menubar {
        height: 60px; padding: 20px 28px 0 16px; box-sizing: border-box;
      }
      .home-desk-frame .desk-widgets { top: 76px; }
    `,
    });

    for (const name of ['inner', 'cover']) {
      if (name === 'cover') {
        await page.addStyleTag({
          content: `
          .home-desk-frame { width: 466px; }
          .home-desk-frame .desk-screen { height: 679px; }
          .home-desk-frame .desk-menubar {
            height: 70px; padding: 16px 70px 0 8px; align-items: flex-start;
          }
          .home-desk-frame .desk-widgets { top: auto; gap: 12px; padding: 12px 16px 112px; }
          .home-desk-frame .desk-now-playing { gap: 8px; }
          .home-desk-frame .desk-control-center { gap: 6px; }
        `,
        });
      }

      await desk.scrollIntoViewIfNeeded();
      await page.mouse.move(2, 2);
      await page.waitForTimeout(600);

      const layout = await desk.evaluate((element) => {
        const screen = element.getBoundingClientRect();
        const header = element.querySelector('.desk-menubar-item').getBoundingClientRect();
        const controls = element.querySelector('.desk-control-center').getBoundingClientRect();
        const dock = element.querySelector('.desk-dock').getBoundingClientRect();

        return { topInset: header.top - screen.top, dockGap: dock.top - controls.bottom };
      });

      assert.ok(layout.topInset >= 16, `${name}: the header must clear the screen's top`);
      assert.ok(
        layout.dockGap >= 8,
        `${name}: top padding must not push controls into the dock (${layout.dockGap}px gap)`,
      );
      const png = path.join(temporaryDirectory, `${name}.png`);
      await desk.screenshot({ path: png, animations: 'disabled' });
      const output = `public/previews/phone-duo-${name}${theme === 'dark' ? '-dark' : ''}.webp`;
      execFileSync('cwebp', ['-quiet', '-q', '94', png, '-o', output]);
      console.log(
        `Captured ${output}: header inset ${layout.topInset}px, dock gap ${layout.dockGap}px.`,
      );
    }

    await page.close();
  }
} finally {
  await browser.close();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
