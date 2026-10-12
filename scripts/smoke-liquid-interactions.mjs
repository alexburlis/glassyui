import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.argv[2];

if (!url) {
  console.error(
    'Usage: pnpm exec node scripts/smoke-liquid-interactions.mjs <url> [artifact-directory]',
  );
  process.exit(1);
}

if (new URL(url).pathname !== '/diagnostics') {
  console.error('This development-only smoke must target an explicit /diagnostics URL.');
  process.exit(1);
}

const artifactDirectory = path.resolve(process.argv[3] ?? '.artifacts/liquid-interactions');

const viewport =
  process.argv[4] === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 900 };

const manifest = {
  url,
  startedAt: new Date().toISOString(),
  status: 'running',
  checks: [],
  viewport,
};

fs.mkdirSync(artifactDirectory, { recursive: true });

const writeManifest = () =>
  fs.writeFileSync(
    path.join(artifactDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

writeManifest();

let browser;

let context;

let tracing = false;

let failure;

try {
  browser = await chromium.launch({
    args: ['--disable-updater-scheduler'],
    channel: 'chrome',
    headless: true,
  });
  manifest.browserVersion = browser.version();
  context = await browser.newContext({
    reducedMotion: 'no-preference',
    viewport,
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  tracing = true;

  const page = await context.newPage();

  async function capture(name) {
    const file = `${name}.png`;
    const destination = path.join(artifactDirectory, file);
    await page.screenshot({ path: destination, animations: 'disabled' });
    manifest.checks.push({
      name,
      url: page.url(),
      screenshot: { file, sha256: hash(destination) },
    });
  }

  await page.goto(url, { waitUntil: 'networkidle' });

  const privacy = page.getByRole('region', { name: 'Analytics privacy settings' });

  await privacy.getByRole('button', { name: 'Reject analytics', exact: true }).click();
  await privacy.waitFor({ state: 'hidden' });

  // The diagnostics panel can cover the real controls on a narrow screen.
  await page.getByRole('button', { name: 'Hide Debug Panel', exact: true }).click();
  await page.getByRole('button', { name: 'Show Debug Panel', exact: true }).waitFor();

  await page.getByRole('button', { name: 'Launch' }).focus();

  const focused = await page.evaluate(() =>
    document.activeElement?.textContent?.includes('Launch'),
  );

  if (!focused) throw new Error('Launch button did not receive focus');
  await capture('01-button-focus');

  await page.getByRole('button', { name: 'Open dialog' }).click();
  await page.getByText('Glassy UI Dialog').waitFor();
  await capture('02-dialog-open');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });

  await page.getByRole('button', { name: 'Show popover' }).click();
  await page.getByText('Popovers inherit the panel recipe').waitFor();
  await capture('03-popover-open');
  await page.keyboard.press('Escape');
  await page.getByText('Popovers inherit the panel recipe').waitFor({ state: 'hidden' });

  await page.getByRole('button', { name: 'Hover me' }).hover();
  await page
    .locator('[data-radix-popper-content-wrapper] > [data-state$="open"]')
    .filter({ hasText: 'Glassy clarity!' })
    .waitFor();
  await capture('04-tooltip-open');

  await page.getByRole('tab', { name: 'Specs' }).click();
  await page.getByText('Tokens ship as CSS variables').waitFor();
  await capture('05-tab-specs');

  await page.getByRole('button', { name: 'What is Glassy UI?' }).click();
  await page.getByText('tailored for the web').waitFor();
  await capture('06-accordion-open');

  await page.getByRole('button', { name: 'Trigger toast' }).click();
  await page.locator('li[data-state="open"]').filter({ hasText: 'Saved to Library' }).waitFor();
  await capture('07-toast-open');

  for (const [name, attribute] of [
    ['Reduce Motion', 'data-lg-reduce-motion'],
    ['Reduce Transparency', 'data-lg-reduce-transparency'],
  ]) {
    const control = page.getByRole('button', { name, exact: true });

    if ((await page.locator('html').getAttribute(attribute)) === '1') {
      await control.click();
      await page.waitForFunction(
        (key) => document.documentElement.getAttribute(key) === '0',
        attribute,
      );
    }

    await control.click();
    await page.waitForFunction(
      (key) => document.documentElement.getAttribute(key) === '1',
      attribute,
    );
  }

  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-lg-theme') === 'light',
  );

  const preferences = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('glassy-ui-preferences'));

    return {
      theme: stored.theme,
      reduceMotion: stored.reduceMotion,
      reduceTransparency: stored.reduceTransparency,
    };
  });

  assert.deepEqual(preferences, { theme: 'light', reduceMotion: true, reduceTransparency: true });
  await page.getByRole('button', { name: 'Launch' }).waitFor();
  await capture('08-preferences');
  manifest.preferences = preferences;
  manifest.status = 'passed';
} catch (error) {
  manifest.status = 'failed';
  manifest.error = error.message;
  failure = error;
} finally {
  try {
    if (tracing) {
      const file = 'trace.zip';
      const destination = path.join(artifactDirectory, file);
      await context.tracing.stop({ path: destination });
      manifest.trace = { file, sha256: hash(destination) };
    }
  } catch (error) {
    manifest.status = 'failed';
    manifest.error ??= error.message;
    manifest.evidenceError = error.message;
    failure ??= error;
  } finally {
    manifest.finishedAt = new Date().toISOString();

    try {
      writeManifest();
    } finally {
      await browser?.close();
    }
  }
}

if (failure) throw failure;

console.log(`Liquid interaction smoke passed. Artifacts: ${artifactDirectory}`);
