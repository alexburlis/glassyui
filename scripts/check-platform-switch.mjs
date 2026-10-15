import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

// Public installation boundary: discovery, exact clipboard recipes, platform and manager
// persistence, full Manual source, and visible recovery from network/clipboard failure.
const baseUrl = process.argv[2];

if (!baseUrl)
  throw new Error('Usage: node scripts/check-platform-switch.mjs <base-url> [artifacts]');

const artifactDirectory = path.resolve(process.argv[3] ?? '.artifacts/platform-switch');

fs.mkdirSync(artifactDirectory, { recursive: true });

const manifest = { baseUrl, startedAt: new Date().toISOString(), status: 'running', checks: [] };

const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

let browser;

let context;

let failure;

try {
  browser = await chromium.launch({ channel: 'chrome', args: ['--disable-updater-scheduler'] });
  context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const installation = page.getByRole('region', { name: 'Installation', exact: true });
  const cliBlock = () => installation.locator('.docs-code-block').first();

  async function capture(name) {
    const file = `${name}.png`;
    await page.screenshot({ path: path.join(artifactDirectory, file), animations: 'disabled' });
    manifest.checks.push({
      name,
      screenshot: { file, sha256: hash(path.join(artifactDirectory, file)) },
    });
  }

  async function noOverflow() {
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'page fits viewport',
    );
  }

  async function platform(value) {
    await page.getByRole('radio', { name: value, exact: true }).click();
  }

  async function manager(value) {
    await installation
      .getByRole('radiogroup', { name: 'Package manager', exact: true })
      .getByText(value, { exact: true })
      .click();
  }

  async function commandEquals(expected) {
    await page.waitForFunction(
      (text) => document.querySelector('#installation .docs-code-block code')?.textContent === text,
      expected,
    );
    const block = cliBlock();
    await block.getByRole('button', { name: 'Copy', exact: true }).click();
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      expected,
      'clipboard equals displayed complete recipe',
    );
  }

  await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });
  const privacy = page.getByRole('region', { name: 'Analytics privacy settings' });

  if (await privacy.isVisible()) {
    await privacy.getByRole('button', { name: 'Reject analytics', exact: true }).click();
    await privacy.waitFor({ state: 'hidden' });
  }

  const hero = page.locator('.home-hero');
  const browse = hero.getByRole('link', { name: 'Browse components', exact: true });
  const star = hero.getByRole('link', { name: 'Star on GitHub', exact: true });
  assert.equal(await browse.getAttribute('href'), '/components');
  assert.equal(await star.getAttribute('href'), 'https://github.com/alexburlis/glassyui');
  assert.ok(
    (await star.boundingBox()).x > (await browse.boundingBox()).x,
    'secondary GitHub button is on the right',
  );
  assert.equal(await hero.locator('.copy-chip').count(), 0, 'hero leads with discovery');
  await capture('01-hero');
  await browse.click();
  await page.waitForURL('**/components');
  await page.locator('a[href="/components/glass-button"]:visible').first().click();
  await page.waitForURL('**/components/glass-button');
  await installation.getByRole('tab', { name: 'CLI', exact: true }).waitFor();
  assert.equal(
    await installation.getByRole('radio', { name: 'npm', exact: true }).isChecked(),
    true,
  );

  const runners = { npm: 'npx', pnpm: 'pnpm dlx', yarn: 'yarn dlx', bun: 'bunx --bun' };

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });

    for (const target of ['React', 'React Native']) {
      await platform(target);
      const native = target === 'React Native';

      for (const [name, runner] of Object.entries(runners)) {
        await manager(name);
        const expected = `${runner} shadcn@4.14.1 add https://glassyui.com/r/${native ? 'native/' : ''}glass-button.json${native ? ' && npx expo install --fix' : ''}`;
        await commandEquals(expected);
        await noOverflow();
      }

      await capture(`${width}-${native ? 'native' : 'web'}-cli`);
    }
  }

  await page.goto(new URL('/components/glass-switch', baseUrl).href, { waitUntil: 'networkidle' });
  assert.equal(
    await page.getByRole('radio', { name: 'React Native', exact: true }).isChecked(),
    true,
    'platform persists between pages',
  );
  assert.equal(
    await installation.getByRole('radio', { name: 'bun', exact: true }).isChecked(),
    true,
    'manager persists between pages',
  );
  await manager('npm');
  const npm = installation.getByRole('radio', { name: 'npm', exact: true });
  await npm.focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(
    await installation.getByRole('radio', { name: 'pnpm', exact: true }).isChecked(),
    true,
    'manager supports arrow keys',
  );

  // No source closure should be requested until Manual opens.
  let sourceRequests = 0;
  await page.route('**/r/**', async (route) => {
    sourceRequests += 1;
    await route.continue();
  });
  await page.goto(new URL('/components/glass-button?platform=react', baseUrl).href, {
    waitUntil: 'networkidle',
  });
  assert.equal(sourceRequests, 0, 'CLI does not download the source closure');
  await installation.getByRole('tab', { name: 'CLI', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(
    () =>
      document.querySelector('#installation [role=tab][data-state=active]')?.textContent ===
      'Manual',
  );
  assert.equal(
    await installation
      .getByRole('tab', { name: 'Manual', exact: true })
      .getAttribute('aria-selected'),
    'true',
    'method tabs support arrow keys',
  );

  for (const target of ['React', 'React Native']) {
    await platform(target);
    const native = target === 'React Native';

    const payload = await (
      await context.request.get(
        new URL(`/r/${native ? 'native/' : ''}glass-button.json`, baseUrl).href,
      )
    ).json();

    await page.waitForFunction(
      (count) => document.querySelectorAll('#installation .docs-install-file').length === count,
      payload.files.length,
    );
    assert.equal(payload.files.length, native ? 8 : 10);

    for (const file of payload.files) {
      const entry = installation.locator(`.docs-install-file[data-target="${file.target}"]`);
      const toggle = entry.getByRole('button', { expanded: false });

      if (await toggle.count()) await toggle.click();
      await page.waitForFunction(
        ({ target, content }) =>
          [...document.querySelectorAll('#installation .docs-install-file')]
            .find((node) => node.dataset.target === target)
            ?.querySelector('code')?.textContent === content,
        { target: file.target, content: file.content },
      );
      assert.equal(
        await entry.locator('code').textContent(),
        file.content,
        `complete displayed source: ${file.target}`,
      );
      await entry.getByRole('button', { name: 'Copy', exact: true }).click();
      assert.equal(
        await page.evaluate(() => navigator.clipboard.readText()),
        file.content,
        `complete copied source: ${file.target}`,
      );
    }

    await noOverflow();
    await capture(`manual-${native ? 'native' : 'web'}`);
  }

  await page.unroute('**/r/**');

  // A failed request remains visible and Retry uses the same intended endpoint.
  let refuse = true;
  await page.route('**/r/glass-button.json', async (route) =>
    refuse ? route.abort('failed') : route.continue(),
  );
  await page.goto(new URL('/components/glass-button?platform=react', baseUrl).href, {
    waitUntil: 'networkidle',
  });
  await installation.getByRole('tab', { name: 'Manual', exact: true }).click();
  await installation.getByRole('button', { name: 'Try again', exact: true }).waitFor();
  assert.equal(
    await installation.locator('.docs-install-file .docs-copy-button:enabled').count(),
    0,
    'failed source never offers copying',
  );
  refuse = false;
  await installation.getByRole('button', { name: 'Try again', exact: true }).click();
  await installation.locator('.docs-install-file .docs-copy-button:enabled').first().waitFor();
  await capture('manual-retry');
  await page.unroute('**/r/glass-button.json');

  await page.route('**/r/glass-button.json', async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ name: 'glass-button', files: [] }),
    }),
  );
  await page.goto(new URL('/components/glass-button?platform=react', baseUrl).href, {
    waitUntil: 'networkidle',
  });
  await installation.getByRole('tab', { name: 'Manual', exact: true }).click();
  await installation.getByRole('button', { name: 'Try again', exact: true }).waitFor();
  assert.equal(
    await installation.locator('.docs-install-file .docs-copy-button:enabled').count(),
    0,
    'incomplete payload fails visibly',
  );
  await page.unroute('**/r/glass-button.json');

  // A late web response must not replace native source after changing platform.
  let release;
  let requested;

  const arrived = new Promise((resolve) => {
    requested = resolve;
  });

  const gate = new Promise((resolve) => {
    release = resolve;
  });

  await page.route('**/r/glass-button.json', async (route) => {
    requested();
    await gate;
    await route.continue().catch(() => {});
  });
  await page.goto(new URL('/components/glass-button?platform=react', baseUrl).href, {
    waitUntil: 'networkidle',
  });
  await installation.getByRole('tab', { name: 'Manual', exact: true }).click();
  await arrived;
  await platform('React Native');
  await page.waitForFunction(
    () =>
      document.querySelectorAll('#installation .docs-install-file').length === 8 &&
      document
        .querySelector('#installation .docs-install-file code')
        ?.textContent.includes('react-native'),
  );
  release();
  await page.unroute('**/r/glass-button.json');
  assert.ok(
    (await installation.locator('.docs-install-file code').first().textContent()).includes(
      'react-native',
    ),
    'current native file survives late web response',
  );

  await installation.getByRole('tab', { name: 'CLI', exact: true }).click();
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error('Refused by smoke'));
  });
  await cliBlock().getByRole('button', { name: 'Copy', exact: true }).click();
  await cliBlock().getByRole('button', { name: 'Try again', exact: true }).waitFor();
  assert.match(await cliBlock().getByRole('status').textContent(), /Could not copy|couldn.t copy/i);
  assert.ok(
    await page.evaluate(() => getSelection()?.toString().length > 0),
    'failed copy selects visible command',
  );
  await manager('yarn');
  await cliBlock().getByRole('button', { name: 'Copy', exact: true }).waitFor();
  assert.equal(
    (await cliBlock().getByRole('status').textContent()).trim(),
    '',
    'changing command resets feedback',
  );
  await capture('copy-refused');

  await page.goto(new URL('/components/glass-scene?platform=react', baseUrl).href, {
    waitUntil: 'networkidle',
  });
  await manager('pnpm');

  const example = page
    .getByRole('region', { name: 'Install example components', exact: true })
    .filter({ visible: true });

  await example.waitFor();
  assert.match(
    await example.locator('code').textContent(),
    /^pnpm dlx shadcn@4.14.1 add /,
    'manager is shared with example blocks',
  );
  assert.ok(
    ((await example.locator('code').textContent()).match(/https:\/\/glassyui.com\/r\//g) ?? [])
      .length > 1,
    'example includes all additional components',
  );

  const waitForCommand = async (text) =>
    page.waitForFunction(
      (value) =>
        document.querySelector('#installation .docs-command-block code')?.textContent === value,
      text,
    );

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

  // Next client navigation retains this module. An explicit catalogue link must
  // apply its platform once, while still allowing a manual choice on that page.
  await page.locator('a[href="/mobile"]:visible').first().click();
  await page.waitForURL(new URL('/mobile', baseUrl).href);
  await page
    .locator('.mobile-components a[href="/components/glass-menu?platform=react-native"]')
    .click();
  await page.waitForURL(new URL('/components/glass-menu?platform=react-native', baseUrl).href);
  await waitForCommand(
    'pnpm dlx shadcn@4.14.1 add https://glassyui.com/r/native/glass-menu.json && npx expo install --fix',
  );
  assert.equal(
    await page.getByRole('radio', { name: 'React Native' }).getAttribute('aria-checked'),
    'true',
  );
  await checkNativeReference('menu');
  await capture('05-linked-native-menu');
  await page.getByRole('radio', { exact: true, name: 'React' }).click();
  await waitForCommand('pnpm dlx shadcn@4.14.1 add https://glassyui.com/r/glass-menu.json');
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
  await waitForCommand(
    'pnpm dlx shadcn@4.14.1 add https://glassyui.com/r/native/glass-menu.json && npx expo install --fix',
  );
  await page.getByRole('radio', { exact: true, name: 'React' }).click();
  await waitForCommand('pnpm dlx shadcn@4.14.1 add https://glassyui.com/r/glass-menu.json');
  await page.locator('a[href="/components/glass-button"]:visible').first().click();
  await page.waitForURL(new URL('/components/glass-button', baseUrl).href);
  await waitForCommand('pnpm dlx shadcn@4.14.1 add https://glassyui.com/r/glass-button.json');
  assert.ok(await page.locator('#api').getByText('ButtonProps', { exact: true }).isVisible());
  await page.getByRole('radio', { name: 'React Native' }).click();
  await checkNativeReference('button');
  await capture('07-native-button-reference');
  await page.getByRole('radio', { exact: true, name: 'React' }).click();
  await page.goto(new URL('/guides/expo', baseUrl).href, { waitUntil: 'domcontentloaded' });
  await page
    .locator('.docs-section')
    .filter({ has: page.getByRole('heading', { exact: true, name: 'Components' }) })
    .getByRole('link', { exact: true, name: 'Button' })
    .click();
  await waitForCommand(
    'pnpm dlx shadcn@4.14.1 add https://glassyui.com/r/native/glass-button.json && npx expo install --fix',
  );
  await checkNativeReference('button');
  await capture('expo-linked-native-button');
  await page.getByRole('radio', { exact: true, name: 'React' }).click();
  await waitForCommand('pnpm dlx shadcn@4.14.1 add https://glassyui.com/r/glass-button.json');
  await page.goto(new URL('/components/glass-picker', baseUrl).href, { waitUntil: 'networkidle' });
  await installation.waitFor();
  assert.equal(
    await page.getByRole('radio', { name: 'React', exact: true }).count(),
    0,
    'native-only component has no fictitious React choice',
  );
  assert.match(
    await cliBlock().locator('code').textContent(),
    /\/r\/native\/glass-picker.json.*npx expo install --fix/,
  );
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.evaluate(() => {
    document.documentElement.dataset.lgReduceTransparency = '1';
    document.documentElement.style.fontSize = '200%';
  });
  await noOverflow();
  await capture('native-only-zoom');
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  manifest.status = 'passed';
} catch (error) {
  manifest.status = 'failed';
  manifest.error = error.message;
  failure = error;
} finally {
  if (context) await context.tracing.stop({ path: path.join(artifactDirectory, 'trace.zip') });
  manifest.finishedAt = new Date().toISOString();
  fs.writeFileSync(
    path.join(artifactDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await browser?.close();
}

if (failure) throw failure;

console.log(`Installation and platform check passed. Artifacts: ${artifactDirectory}`);
