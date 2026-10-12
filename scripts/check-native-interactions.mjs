import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

// Exercises the Expo app's actual controls. Native materials and haptics still need device proof.
const baseUrl = process.argv[2];

const artifacts = path.resolve(process.argv[3] ?? '.artifacts/native-interactions');

assert.ok(baseUrl, 'Pass the running Expo web app URL.');

assert.ok(['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname), 'Use a loopback app.');

fs.mkdirSync(artifacts, { recursive: true });

const browser = await chromium.launch({
  args: ['--disable-updater-scheduler'],
  channel: 'chrome',
  headless: true,
});

const context = await browser.newContext({ colorScheme: 'dark' });

await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

const page = await context.newPage();

const failures = [];

page.on('pageerror', (error) => failures.push(error.message));

const checks = [];

async function drag(locator, dx, dy = 0) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert.ok(box, 'The drag target must be visible.');
  const x = box.x + box.width * 0.65;
  const y = box.y + box.height * 0.45;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 18 });
  await page.mouse.up();
}

async function value(id, expected) {
  await page.getByTestId(id).filter({ hasText: expected }).waitFor();
  assert.equal(await page.getByTestId(id).textContent(), expected);
}

try {
  for (const width of [390, 900]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(baseUrl);
    const scene = page.getByTestId('section-native-interactions');
    await scene.waitFor();

    const picker = scene.getByRole('combobox', { name: 'Reminder' });
    await picker.selectOption('evening');
    await value('native-picker-value', 'Evening');
    assert.equal(await picker.inputValue(), 'evening');
    checks.push({ width, behavior: 'Native picker selection reaches app state' });

    const row = page.getByTestId('native-swipe-row');
    await drag(row, -180);
    await scene.getByRole('button', { name: 'Pin', exact: true }).click();
    await value('native-swipe-value', 'Pinned');
    await scene.getByRole('button', { name: 'Actions for Design review' }).focus();
    await page.keyboard.press('Enter');
    await scene.getByRole('button', { name: 'Archive', exact: true }).click();
    await value('native-swipe-value', 'Archived');
    checks.push({ width, behavior: 'Swipe and keyboard-accessible actions both reach app state' });

    const stack = page.getByTestId('native-card-stack');
    const stackBox = await stack.boundingBox();
    assert.ok(stackBox);
    await drag(stack, -stackBox.width * 0.4);
    await value('native-stack-value', 'Afternoon');
    await drag(stack, 18);
    await value('native-stack-value', 'Afternoon');
    await drag(stack, 0, -100);
    await value('native-stack-value', 'Afternoon');
    await scene.getByRole('button', { name: 'Next card in Daily plan' }).click();
    await value('native-stack-value', 'Evening');
    assert.equal(
      await scene.getByRole('button', { name: 'Next card in Daily plan' }).isDisabled(),
      true,
    );
    await scene.getByRole('button', { name: 'Previous card in Daily plan' }).click();
    await value('native-stack-value', 'Afternoon');
    await scene.getByRole('button', { name: 'Previous card in Daily plan' }).click();
    await value('native-stack-value', 'Morning');
    checks.push({
      width,
      behavior: 'Card drag, cancellation, navigation, and bounds preserve selection',
    });

    await page.getByTestId('toggle-motion').click();
    await scene.getByRole('button', { name: 'Next card in Daily plan' }).click();
    await value('native-stack-value', 'Afternoon');
    await scene.getByRole('button', { name: 'Actions for Design review' }).click();
    await scene.getByRole('button', { name: 'Pin', exact: true }).click();
    await value('native-swipe-value', 'Pinned');
    checks.push({ width, behavior: 'Reduced motion keeps card navigation and row actions usable' });

    await scene.screenshot({ path: path.join(artifacts, `${width}-native-controls.png`) });
    await page.getByTestId('toggle-theme').click();
    await page.getByTestId('toggle-transparency').click();
    await value('native-picker-value', 'Evening');
    await value('native-stack-value', 'Afternoon');
    await scene.screenshot({ path: path.join(artifacts, `${width}-opaque-controls.png`) });
    checks.push({ width, behavior: 'Appearance and transparency changes preserve edits' });
  }

  assert.deepEqual(failures, [], 'The Expo app must have no uncaught runtime errors.');
} catch (error) {
  failures.push(error.message);
  await page.screenshot({ path: path.join(artifacts, 'failure.png') });
  throw error;
} finally {
  await context.tracing.stop({ path: path.join(artifacts, 'trace.zip') });
  await browser.close();
  const files = fs.readdirSync(artifacts).filter((file) => file !== 'result.json');
  fs.writeFileSync(
    path.join(artifacts, 'result.json'),
    `${JSON.stringify(
      {
        baseUrl,
        surface: 'Expo web in Chrome',
        passed: failures.length === 0,
        checks,
        failures,
        artifacts: files.map((file) => ({
          file,
          sha256: createHash('sha256')
            .update(fs.readFileSync(path.join(artifacts, file)))
            .digest('hex'),
        })),
      },
      null,
      2,
    )}\n`,
  );
}

console.log(`Passed ${checks.length} Expo interaction checks. Evidence: ${artifacts}`);
