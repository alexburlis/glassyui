import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const nextPaint = (page) =>
  page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );

/** Checks the command installed by shadcn against unpatched upstream cmdk. */
export async function checkConsumerCommand(
  browser,
  consumerUrl,
  artifactDirectory,
  browserName = 'chromium',
) {
  fs.mkdirSync(artifactDirectory, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  const result = { browser: browserName };
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  try {
    await page.goto(new URL('/command', consumerUrl).href);
    const mountButton = page.getByRole('button', { name: 'Mount command', exact: true });
    await mountButton.focus();
    await mountButton.press('Enter');
    const command = page.locator('[cmdk-root]');
    const input = command.getByRole('combobox');
    await command.waitFor({ state: 'attached' });
    await nextPaint(page);
    result.mountScroll = await page.evaluate(() => window.scrollY);
    assert.ok(result.mountScroll <= 1, 'unfocused command mount preserves page scroll');
    assert.equal(
      await page
        .getByRole('button', { name: 'Unmount command', exact: true })
        .evaluate((element) => element === document.activeElement),
      true,
      'mounting the command preserves the button focus',
    );

    await page.getByRole('button', { name: 'Read item ref', exact: true }).click();
    await page
      .getByRole('status', { name: 'Item ref result' })
      .filter({ hasText: 'Document 01' })
      .waitFor();

    await command.scrollIntoViewIfNeeded();
    await input.click();
    const focusedScroll = await page.evaluate(() => window.scrollY);
    await input.press('End');
    const last = command.getByRole('option', { name: 'Document 32', exact: true });
    await last.and(command.locator('[aria-selected="true"]')).waitFor();
    await nextPaint(page);
    assert.ok(
      await last.evaluate((element) => {
        const item = element.getBoundingClientRect();
        const list = element.closest('[cmdk-list]').getBoundingClientRect();

        return item.top >= list.top - 2 && item.bottom <= list.bottom + 2;
      }),
      'focused End scrolls the last result into its list',
    );
    assert.equal(
      await page.evaluate(() => window.scrollY),
      focusedScroll,
      'End preserves page scroll',
    );
    await input.press('ArrowDown');
    await command
      .getByRole('option', { name: 'Document 01', exact: true })
      .and(command.locator('[aria-selected="true"]'))
      .waitFor();
    await input.press('ArrowDown');
    await input.press('ArrowDown');
    await command
      .getByRole('option', { name: 'Document 04', exact: true })
      .and(command.locator('[aria-selected="true"]'))
      .waitFor();

    await input.fill('32');
    await page.waitForFunction(() => {
      const count = document.querySelectorAll('[cmdk-item]').length;

      return count > 0 && count < 32;
    });
    await last.and(command.locator('[aria-selected="true"]')).waitFor();
    await input.press('Enter');
    assert.equal(
      await page.getByRole('status', { name: 'Activated document' }).textContent(),
      'Document 32',
    );
    result.uncontrolled = {
      focusedListScroll: true,
      loop: true,
      disabledSkipped: true,
      filtering: true,
      activation: true,
    };

    const first = await command
      .getByRole('option', { name: 'Document 32', exact: true })
      .elementHandle();

    await page.getByRole('button', { name: 'Unmount command', exact: true }).click();
    assert.equal(
      await first.evaluate((element) => element.dataset.consumerRef),
      'released',
      'callback ref cleanup releases its result on explicit unmount',
    );
    assert.equal(await first.evaluate((element) => element.isConnected), false);
    assert.equal(
      await first.evaluate((element) => Object.hasOwn(element, 'scrollIntoView')),
      false,
      'unmount restores the item scroll method',
    );
    await page.getByRole('button', { name: 'Use controlled selection', exact: true }).click();
    await page.getByRole('button', { name: 'Select Document 24 externally', exact: true }).click();
    await page.getByRole('button', { name: 'Mount command', exact: true }).click();
    await nextPaint(page);
    assert.ok(
      await page.evaluate(() => window.scrollY <= 1),
      'controlled unfocused mount preserves page scroll',
    );
    await command
      .getByRole('option', { name: 'Document 24', exact: true })
      .and(command.locator('[aria-selected="true"]'))
      .waitFor();
    await command.scrollIntoViewIfNeeded();
    await input.click();
    await input.press('Home');
    await command
      .getByRole('option', { name: 'Document 01', exact: true })
      .and(command.locator('[aria-selected="true"]'))
      .waitFor();
    await input.press('End');
    await input.press('Enter');
    assert.equal(
      await page.getByRole('status', { name: 'Activated document' }).textContent(),
      'Document 32',
    );
    result.controlled = { selectedDefault: true, keyboard: true, activation: true };

    await page.getByRole('button', { name: 'Use prefix filter', exact: true }).click();
    await input.click();
    await input.fill('32');
    await command.getByText('No documents', { exact: true }).waitFor();
    await input.fill('Document 3');
    await page.waitForFunction(() => document.querySelectorAll('[cmdk-item]').length === 3);
    result.customFilter = true;
    await page.getByRole('button', { name: 'Disable built-in filtering', exact: true }).click();
    await input.click();
    await input.fill('unmatched');
    await page.waitForFunction(() => document.querySelectorAll('[cmdk-item]').length === 32);
    result.shouldFilterFalse = true;

    const root = await command.elementHandle();
    const heading = await command.locator('[cmdk-group-heading]').elementHandle();
    await page.getByRole('button', { name: 'Unmount command', exact: true }).click();
    assert.equal(
      await heading.evaluate((element) => Object.hasOwn(element, 'scrollIntoView')),
      false,
      'unmount restores the heading scroll method',
    );
    assert.equal(await root.evaluate((element) => element.isConnected), false);
    result.restoredMethods = true;
    assert.deepEqual(runtimeErrors, [], 'installed command interactions have no runtime errors');
    result.status = 'passed';

    return result;
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
    throw error;
  } finally {
    result.runtimeErrors = runtimeErrors;
    await page.screenshot({ path: path.join(artifactDirectory, `${browserName}-command.png`) });
    await context.tracing.stop({
      path: path.join(artifactDirectory, `${browserName}-command-trace.zip`),
    });
    fs.writeFileSync(
      path.join(artifactDirectory, `${browserName}-command.json`),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    await context.close();
  }
}
