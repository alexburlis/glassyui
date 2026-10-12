import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

// Proves a component page's React and React Native switch in Chromium: it starts on React,
// shows the React Native install and usage when chosen, keeps that choice on the next page and
// switches back.

const baseUrl = process.argv[2];

if (!baseUrl) {
  console.error(
    'Usage: node scripts/check-platform-switch.mjs http://127.0.0.1:3000 [artifact-directory]',
  );
  process.exit(1);
}

const artifactDirectory = path.resolve(process.argv[3] ?? '.artifacts/platform-switch');

const manifest = {
  baseUrl,
  startedAt: new Date().toISOString(),
  status: 'running',
  checks: [],
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
  browser = await chromium.launch({ args: ['--disable-updater-scheduler'], channel: 'chrome' });
  manifest.browserVersion = browser.version();
  context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
    viewport: { height: 900, width: 1280 },
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  tracing = true;

  const page = await context.newPage();

  const shown = (text) => page.getByText(text).first().isVisible();

  const waitForCommand = (text) => page.getByText(text).first().waitFor({ state: 'visible' });

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

  async function checkNativeReference(component) {
    const reference = await page.locator('#examples, #api, #notes').allInnerTexts();
    assert.doesNotMatch(
      reference.join('\n'),
      component === 'button' ? /asChild|\bpreset\b|\blens\b/ : /GlassMenuSub/,
      `the native ${component} reference must describe its supported API`,
    );
    assert.ok(
      await page
        .locator(`#api a[href$="registry/glassyui-native/glass-${component}.tsx"]`)
        .isVisible(),
      'the native reference links to its own exported types',
    );
  }

  await page.goto(new URL('/components/glass-button', baseUrl).href, {
    waitUntil: 'domcontentloaded',
  });

  await waitForCommand('pnpm dlx shadcn@4.14.1 add @glassyui/glass-button');

  assert.ok(await shown('pnpm dlx shadcn@4.14.1 add @glassyui/glass-button'), 'React shows first');
  assert.equal(await shown('npx shadcn@4.14.1 add @glassyui-native/glass-button'), false);
  await capture('01-react-button');

  await page.getByRole('radio', { name: 'React Native' }).click();
  await waitForCommand('npx shadcn@4.14.1 add @glassyui-native/glass-button');

  assert.ok(
    await shown('npx shadcn@4.14.1 add @glassyui-native/glass-button'),
    'React Native install',
  );
  assert.ok(await shown('React Native usage'), 'React Native usage');
  await page.getByRole('button', { name: /Copy the .* React Native install command/ }).click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    'npx shadcn@4.14.1 add @glassyui-native/glass-button && npx expo install --fix',
    'the native shortcut copies installation and SDK matching together',
  );
  await capture('02-native-button');

  await page.goto(new URL('/components/glass-switch', baseUrl).href, {
    waitUntil: 'domcontentloaded',
  });
  await waitForCommand('npx shadcn@4.14.1 add @glassyui-native/glass-switch');

  assert.ok(
    await shown('npx shadcn@4.14.1 add @glassyui-native/glass-switch'),
    'the choice carries to the next page',
  );
  await capture('03-native-switch');

  await page.getByRole('radio', { exact: true, name: 'React' }).click();
  await waitForCommand('pnpm dlx shadcn@4.14.1 add @glassyui/glass-switch');

  assert.ok(await shown('pnpm dlx shadcn@4.14.1 add @glassyui/glass-switch'), 'back to React');
  await capture('04-react-switch');

  // Next client navigation retains this module. An explicit catalogue link must
  // apply its platform once, while still allowing a manual choice on that page.
  await page.locator('a[href="/mobile"]:visible').first().click();
  await page.waitForURL(new URL('/mobile', baseUrl).href);
  await page
    .locator('.mobile-components a[href="/components/glass-menu?platform=react-native"]')
    .click();
  await page.waitForURL(new URL('/components/glass-menu?platform=react-native', baseUrl).href);
  await waitForCommand('npx shadcn@4.14.1 add @glassyui-native/glass-menu');
  assert.equal(
    await page.getByRole('radio', { name: 'React Native' }).getAttribute('aria-checked'),
    'true',
  );
  await checkNativeReference('menu');
  await capture('05-linked-native-menu');
  await page.getByRole('radio', { exact: true, name: 'React' }).click();
  await waitForCommand('pnpm dlx shadcn@4.14.1 add @glassyui/glass-menu');
  assert.ok(
    await page
      .locator('#examples')
      .getByText(/GlassMenuSub/)
      .first()
      .isVisible(),
  );
  await capture('06-manual-react-on-native-link');
  await page.locator('a[href="/mobile"]:visible').first().click();
  await page.waitForURL(new URL('/mobile', baseUrl).href);
  await page
    .locator('.mobile-components a[href="/components/glass-menu?platform=react-native"]')
    .click();
  await waitForCommand('npx shadcn@4.14.1 add @glassyui-native/glass-menu');
  await page.getByRole('radio', { exact: true, name: 'React' }).click();
  await waitForCommand('pnpm dlx shadcn@4.14.1 add @glassyui/glass-menu');
  await page.locator('a[href="/components/glass-button"]:visible').first().click();
  await page.waitForURL(new URL('/components/glass-button', baseUrl).href);
  await waitForCommand('pnpm dlx shadcn@4.14.1 add @glassyui/glass-button');
  assert.ok(await page.locator('#api').getByText('ButtonProps', { exact: true }).isVisible());
  await page.getByRole('radio', { name: 'React Native' }).click();
  await checkNativeReference('button');
  await capture('07-native-button-reference');
  await page.setViewportSize({ height: 900, width: 390 });
  await checkNativeReference('button');
  await capture('08-mobile-native-button-reference');
  await page.goto(new URL('/components/glass-menu?platform=react-native', baseUrl).href, {
    waitUntil: 'domcontentloaded',
  });
  await waitForCommand('npx shadcn@4.14.1 add @glassyui-native/glass-menu');
  await checkNativeReference('menu');
  await capture('09-mobile-native-menu-reference');
  await page.goto(new URL('/components/glass-switch', baseUrl).href, {
    waitUntil: 'domcontentloaded',
  });
  await waitForCommand('npx shadcn@4.14.1 add @glassyui-native/glass-switch');
  await page.getByRole('radio', { name: 'React Native' }).click();
  await page.getByRole('button', { name: /Copy the .* React Native install command/ }).click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    'npx shadcn@4.14.1 add @glassyui-native/glass-switch && npx expo install --fix',
    'the mobile shortcut copies the same complete native recipe',
  );
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'the complete native command stays within the mobile page',
  );
  await capture('10-mobile-native-switch');
  await page.getByRole('radio', { exact: true, name: 'React' }).click();
  await waitForCommand('pnpm dlx shadcn@4.14.1 add @glassyui/glass-switch');
  await page.goto(new URL('/guides/expo', baseUrl).href, {
    waitUntil: 'domcontentloaded',
  });
  await page
    .locator('.docs-section')
    .filter({ has: page.getByRole('heading', { exact: true, name: 'Components' }) })
    .getByRole('link', { exact: true, name: 'Button' })
    .click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[role="radio"]')].some(
      (radio) =>
        radio.textContent === 'React Native' && radio.getAttribute('aria-checked') === 'true',
    ),
  );
  await waitForCommand('npx shadcn@4.14.1 add @glassyui-native/glass-button');
  await checkNativeReference('button');
  await capture('11-expo-linked-native-button');
  await page.getByRole('radio', { exact: true, name: 'React' }).click();
  await waitForCommand('pnpm dlx shadcn@4.14.1 add @glassyui/glass-button');
  await capture('12-expo-link-manual-react');
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

console.log(`Platform switch check passed. Artifacts: ${artifactDirectory}`);
