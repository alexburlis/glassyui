import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

const baseUrl = process.argv[2];

if (!baseUrl) {
  console.error(
    'Usage: node scripts/smoke-release-ui.mjs http://127.0.0.1:3100 [artifact-directory]',
  );
  process.exit(1);
}

const components = [
  'glass-provider',
  'glass-surface',
  'glass-button',
  'glass-panel',
  'glass-header',
  'glass-input',
  'glass-tabs',
  'glass-dialog',
  'glass-popover',
  'glass-tooltip',
  'glass-toast',
  'glass-accordion',
  'glass-switch',
  'glass-slider',
  'glass-segmented-control',
  'glass-badge',
  'glass-dock',
  'glass-sheet',
  'glass-menu',
  'glass-lens',
  'glass-checkbox',
  'glass-radio-group',
  'glass-textarea',
  'glass-select',
  'glass-progress',
  'glass-spinner',
  'glass-skeleton',
  'glass-alert',
  'glass-avatar',
  'glass-kbd',
  'glass-command',
  'glass-breadcrumb',
  'glass-pagination',
  'glass-scene',
  'glass-laptop',
  'glass-phone-duo',
];

const modes = [
  { name: 'dark-normal', theme: 'dark', transparency: '0' },
  { name: 'dark-reduced', theme: 'dark', transparency: '1' },
  { name: 'light-normal', theme: 'light', transparency: '0' },
  { name: 'light-reduced', theme: 'light', transparency: '1' },
];

const viewports = [320, 390, 768, 1280];

const artifactDirectory =
  process.argv[3] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'glassyui-release-ui-'));

fs.mkdirSync(artifactDirectory, { recursive: true });

const moderateFindings = [];

const publicSiteUrl = 'https://glassyui.com';

const preferenceStorageKey = 'glassy-ui-preferences';

function demo(page, id) {
  return page.locator(`[data-release-demo="${id}"]`);
}

async function exactlyOne(locator, description) {
  assert.equal(await locator.count(), 1, `${description} must exist exactly once`);

  return locator;
}

// Text that arrives a moment after the action that caused it.
async function expectText(locator, expected, description) {
  try {
    await locator.filter({ hasText: expected }).waitFor({ state: 'attached', timeout: 2_000 });
  } catch {
    // The assertion below reports what the text was instead.
  }

  assert.equal((await locator.textContent())?.trim(), expected, description);
}

async function assertFocusReturned(page, trigger, description) {
  const handle = await trigger.elementHandle();
  assert.ok(handle, `${description} trigger must remain mounted`);
  await page.waitForFunction((node) => document.activeElement === node, handle, { timeout: 2_000 });
}

// React commits some updates after the event returns, so poll before asserting.
async function assertAttribute(page, locator, name, value, message) {
  const handle = await locator.elementHandle();
  assert.ok(handle, `${message}: the element must remain mounted`);
  await page
    .waitForFunction(
      ({ node, attribute, expected }) => node.getAttribute(attribute) === expected,
      { node: handle, attribute: name, expected: value },
      { timeout: 2_000 },
    )
    .catch(() => {});
  assert.equal(await locator.getAttribute(name), value, message);
}

async function selectRadioWithArrow(page, key, radio, message) {
  // Radix defers focus and checks the radio while the arrow key is held.
  await page.keyboard.down(key);

  try {
    await assertAttribute(page, radio, 'aria-checked', 'true', message);
  } finally {
    await page.keyboard.up(key);
  }
}

async function assertBodyInteractive(page, description) {
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.body).pointerEvents),
    'auto',
    `${description} must give pointer events back to the page`,
  );
}

async function waitForScrollToSettle(page) {
  await page.evaluate(async () => {
    let previous = window.scrollY;
    let stableFrames = 0;

    for (let frame = 0; frame < 60 && stableFrames < 2; frame += 1) {
      await new Promise(requestAnimationFrame);
      const current = window.scrollY;
      stableFrames = current === previous ? stableFrames + 1 : 0;
      previous = current;
    }

    if (stableFrames < 2) {
      throw new Error('Page scrolling did not settle before the focus assertion.');
    }
  });
}

// Returns null when the page fits the viewport. Otherwise it names the outermost elements
// that reach past the right edge with no clipping ancestor, so the failure shows its cause.
// Fixed boxes are skipped: they never widen the document's scrollable area.
async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const { scrollWidth } = document.documentElement;

    if (scrollWidth <= viewportWidth) return null;

    const contained = (node) => {
      for (
        let current = node;
        current && current !== document.documentElement;
        current = current.parentElement
      ) {
        const style = getComputedStyle(current);

        if (style.position === 'fixed' || (current !== node && style.overflowX !== 'visible'))
          return true;
      }

      return false;
    };

    const overflows = (node) =>
      node.getBoundingClientRect().right > viewportWidth + 0.5 && !contained(node);

    const offenders = [...document.body.querySelectorAll('*')]
      .filter((node) => overflows(node) && !overflows(node.parentElement))
      .slice(0, 8)
      .map((node) => {
        const rect = node.getBoundingClientRect();
        const label = [node.tagName.toLowerCase(), ...node.classList].join('.');
        const text = (node.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);

        return `${label} spans ${Math.round(rect.left)}-${Math.round(rect.right)}px "${text}"`;
      });

    return `scrollWidth ${scrollWidth}px exceeds ${viewportWidth}px: ${offenders.join('; ') || 'no unclipped element found'}`;
  });
}

async function assertProductionRouteContract() {
  for (const route of [
    '/diagnostics',
    '/mockup',
    '/materials',
    '/shader-samples',
    '/glass',
    '/wallpapers/glass-test.svg',
    '/test',
    '/toggle',
  ]) {
    const response = await fetch(new URL(route, baseUrl));
    assert.equal(response.status, 404, `${route} must return production 404`);
  }
}

async function announcementText(page) {
  const announcement = await exactlyOne(
    page.getByRole('status', { name: 'Release feedback' }),
    'polite release feedback announcement',
  );

  assert.equal(
    await announcement.getAttribute('aria-live'),
    'polite',
    'release feedback must be polite',
  );

  return announcement.textContent();
}

async function assertAnnouncementChanged(page, before, description) {
  await page.waitForFunction(
    ({ beforeText }) => {
      const node = document.querySelector('[role="status"][aria-label="Release feedback"]');

      return Boolean(node && node.textContent && node.textContent !== beforeText);
    },
    { beforeText: before },
    { timeout: 2_000 },
  );
  const after = await announcementText(page);
  assert.notEqual(after, before, `${description} must announce its user-visible result`);
}

async function requireDemoContract(page) {
  const ids = await page
    .locator('[data-release-demo]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-release-demo')));

  assert.equal(
    ids.length,
    components.length,
    `expected one real release demo for each public component; received ${ids.join(', ') || 'none'}`,
  );
  assert.equal(
    new Set(ids).size,
    components.length,
    'release demos must not duplicate public components',
  );

  for (const id of components) assert.ok(ids.includes(id), `release demo is missing ${id}`);
  await exactlyOne(
    page.getByRole('status', { name: 'Release feedback' }),
    'polite release feedback announcement',
  );
}

function parseColor(value) {
  const match = value.match(/rgba?\(([^)]+)\)/);

  if (!match) return null;

  const [red, green, blue, alpha = 1] = match[1]
    .split(',')
    .map((part) => Number.parseFloat(part.trim()));

  return [red, green, blue, alpha];
}

function composite([red, green, blue, alpha], [baseRed, baseGreen, baseBlue]) {
  return [
    red * alpha + baseRed * (1 - alpha),
    green * alpha + baseGreen * (1 - alpha),
    blue * alpha + baseBlue * (1 - alpha),
  ];
}

function luminance([red, green, blue]) {
  const channel = (value) => {
    const normalized = value / 255;

    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrast(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));

  return (lighter + 0.05) / (darker + 0.05);
}

async function assertVisualContract(page, mode) {
  const result = await page.evaluate(() => {
    const surface = document.querySelector('[data-release-demo] .lg-glass-surface');

    const control = document.querySelector(
      '[data-release-demo] button:not([disabled]), [data-release-demo] input:not([disabled]), [data-release-demo] [role="tab"]',
    );

    if (!(surface instanceof HTMLElement) || !(control instanceof HTMLElement)) return null;
    const surfaceStyle = getComputedStyle(surface);
    const beforeStyle = getComputedStyle(surface, '::before');
    const controlStyle = getComputedStyle(control);
    const root = document.documentElement;
    const originalQuality = root.getAttribute('data-lg-quality');
    root.setAttribute('data-lg-quality', 'low');
    const lowQualityBackdropFilter = getComputedStyle(surface, '::before').backdropFilter;
    root.setAttribute('data-lg-quality', 'high');
    const highQualityBackdropFilter = getComputedStyle(surface, '::before').backdropFilter;

    if (originalQuality) {
      root.setAttribute('data-lg-quality', originalQuality);
    } else {
      root.removeAttribute('data-lg-quality');
    }

    const foreground = controlStyle.color;
    const unfocusedShadow = controlStyle.boxShadow;
    control.focus();
    const focusedStyle = getComputedStyle(control);

    return {
      active: document.activeElement === control,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      foreground,
      surfaceBackground: beforeStyle.backgroundColor,
      focusOutline: focusedStyle.outlineColor,
      focusOutlineWidth: focusedStyle.outlineWidth,
      focusShadow: focusedStyle.boxShadow,
      highQualityBackdropFilter,
      lowQualityBackdropFilter,
      unfocusedShadow,
      surfaceBackdropFilter: beforeStyle.backdropFilter,
      surfaceBackgroundColor: surfaceStyle.backgroundColor,
    };
  });

  assert.ok(
    result,
    `${mode.name} requires a real liquid surface and an interactive foreground control`,
  );
  assert.ok(result.active, `${mode.name} release control must receive focus`);
  const background = parseColor(result.bodyBackground);
  const foreground = parseColor(result.foreground);
  const surface = parseColor(result.surfaceBackground) ?? parseColor(result.surfaceBackgroundColor);
  assert.ok(
    background && foreground && surface,
    `${mode.name} must expose resolved RGB foreground and surface colors`,
  );
  const resolvedSurface = composite(surface, background);
  assert.ok(
    contrast(foreground.slice(0, 3), resolvedSurface) >= 4.5,
    `${mode.name} foreground contrast must be at least 4.5:1`,
  );

  const focusRing = parseColor(result.focusOutline);

  const focusChanges =
    result.focusOutlineWidth !== '0px' || result.focusShadow !== result.unfocusedShadow;

  assert.ok(focusChanges, `${mode.name} keyboard focus must change a visible focus style`);

  if (focusRing && result.focusOutlineWidth !== '0px') {
    assert.ok(
      contrast(composite(focusRing, resolvedSurface), resolvedSurface) >= 3,
      `${mode.name} focus outline contrast must be at least 3:1`,
    );
  } else {
    assert.notEqual(
      result.focusShadow,
      'none',
      `${mode.name} focus ring must have a visible rendered shadow`,
    );
    const shadowRing = parseColor(result.focusShadow);
    assert.ok(shadowRing, `${mode.name} focus shadow must resolve to an RGB ring color`);
    assert.ok(
      contrast(composite(shadowRing, resolvedSurface), resolvedSurface) >= 3,
      `${mode.name} focus ring contrast must be at least 3:1`,
    );
  }

  if (mode.name === 'dark-reduced') {
    assert.equal(
      surface[3],
      1,
      'dark reduced-transparency fallback must be opaque, not translucent',
    );
    assert.ok(
      luminance(resolvedSurface) < 0.5,
      'dark reduced-transparency fallback must remain dark, not light',
    );
  }

  if (mode.transparency === '0') {
    assert.ok(
      surface[3] > 0 && surface[3] < 1,
      `${mode.name} material glass must render a translucent tint layer`,
    );
    assert.match(
      result.surfaceBackdropFilter,
      /blur\(/,
      `${mode.name} material glass must retain its standard backdrop blur in the production CSS`,
    );
    assert.notEqual(
      result.lowQualityBackdropFilter,
      result.highQualityBackdropFilter,
      `${mode.name} material glass must respond to low versus high quality`,
    );
  }
}

async function assertButtonState(page, mode, audit, capture) {
  const root = demo(page, 'glass-button');

  const action = await exactlyOne(
    root.getByRole('button', { name: 'Continue', exact: true }),
    'glass button prominent action',
  );

  await exactlyOne(
    root.getByRole('button', { name: 'Not now', exact: true }),
    'glass button secondary action',
  );

  if (mode.transparency === '0') {
    // Chromium upgrades the CSS frost to an SVG edge lens; the lens carries its
    // own blur, so either path must still frost the backdrop. The lens leads the
    // filter list: the prominent variant tints the bent backdrop after it.
    const material = await action.evaluate((node) => {
      const backdropFilter = getComputedStyle(
        node.querySelector('.lg-button__distortion'),
      ).backdropFilter;

      const filterId = backdropFilter.match(/^url\("?#([^")]+)"?\)/)?.[1];
      const filter = filterId ? document.getElementById(filterId) : null;

      return {
        backdropFilter,
        lens: node.getAttribute('data-lg-lens'),
        lensBlur: Number(
          filter?.querySelector('feGaussianBlur')?.getAttribute('stdDeviation') ?? 0,
        ),
        lensScale: Number(filter?.querySelector('feDisplacementMap')?.getAttribute('scale') ?? 0),
      };
    });

    if (material.lens === 'active') {
      assert.ok(material.lensBlur > 0, `${mode.name} GlassButton lens must frost its backdrop`);
      assert.ok(material.lensScale > 0, `${mode.name} GlassButton lens must bend its edges`);
    } else {
      assert.match(
        material.backdropFilter,
        /blur\(/,
        `${mode.name} GlassButton must retain its standard backdrop blur in the production CSS`,
      );
    }
  }

  const before = await announcementText(page);
  await action.focus();
  await page.keyboard.down('Space');
  assert.equal(
    await action.getAttribute('data-pressed'),
    'true',
    'GlassButton must expose its pressed state while keyboard activation is held',
  );
  await audit('glass-button-pressed');
  await capture('glass-button-pressed');
  await page.keyboard.up('Space');
  assert.equal(
    await action.getAttribute('data-pressed'),
    'false',
    'GlassButton must clear its pressed state after keyboard activation',
  );
  await assertAnnouncementChanged(page, before, 'GlassButton action');
}

async function assertToggleState(page, id, name, audit, capture, state = `${id}-active`) {
  const toggle = await exactlyOne(
    demo(page, id).getByRole('button', { name }),
    `${id} ${name} control`,
  );

  assert.equal(
    await toggle.getAttribute('aria-pressed'),
    'false',
    `${id} ${name} must begin in its reset state`,
  );
  const before = await announcementText(page);
  await toggle.click();
  assert.equal(
    await toggle.getAttribute('aria-pressed'),
    'true',
    `${id} ${name} must expose its active state semantically`,
  );
  await assertAnnouncementChanged(page, before, `${id} ${name} state change`);
  await audit(state);
  await capture(state);
}

async function assertPanelState(page, audit, capture) {
  const root = demo(page, 'glass-panel');
  const panel = await exactlyOne(root.locator('.lg-glass-surface'), 'glass panel surface');

  const toggle = await exactlyOne(
    root.getByRole('button', { name: 'Toggle panel emphasis' }),
    'glass panel state control',
  );

  const before = await panel.evaluate((node) => {
    const style = getComputedStyle(node);

    return {
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
    };
  });

  assert.equal(before.borderRadius, '16px', 'GlassPanel card variant must retain its 2xl radius');
  assert.equal(
    await toggle.getAttribute('aria-pressed'),
    'false',
    'glass-panel must begin in its reset state',
  );

  const announcement = await announcementText(page);
  await toggle.click();
  assert.equal(
    await toggle.getAttribute('aria-pressed'),
    'true',
    'glass-panel must expose its active state semantically',
  );
  await assertAnnouncementChanged(page, announcement, 'glass-panel state change');

  const after = await panel.evaluate((node) => {
    const style = getComputedStyle(node);

    return {
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
    };
  });

  assert.equal(after.borderRadius, '16px', 'GlassPanel card radius must survive elevation changes');
  assert.notEqual(
    after.boxShadow,
    before.boxShadow,
    'GlassPanel raised elevation must visibly differ from its base elevation',
  );
  await audit('glass-panel-active');
  await capture('glass-panel-active');
}

async function assertInputState(page, audit, capture) {
  const root = demo(page, 'glass-input');
  const input = await exactlyOne(root.getByRole('textbox', { name: 'Name' }), 'glass input');

  const validate = await exactlyOne(
    root.getByRole('button', { name: 'Save' }),
    'glass input save control',
  );

  assert.notEqual(
    await input.getAttribute('aria-invalid'),
    'true',
    'GlassInput must begin valid after reset',
  );

  const validStyle = await input.evaluate((node) => {
    const style = getComputedStyle(node);

    return {
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
    };
  });

  const before = await announcementText(page);
  await validate.click();
  assert.equal(
    await input.getAttribute('aria-invalid'),
    'true',
    'GlassInput must expose invalid input with aria-invalid',
  );

  const invalidStyle = await input.evaluate((node) => {
    const style = getComputedStyle(node);

    return {
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
    };
  });

  assert.notEqual(
    invalidStyle.borderColor,
    validStyle.borderColor,
    'GlassInput invalid state must visibly change its border color',
  );
  assert.notEqual(
    invalidStyle.boxShadow,
    validStyle.boxShadow,
    'GlassInput invalid state must visibly change its rendered ring',
  );
  await assertAnnouncementChanged(page, before, 'GlassInput validation failure');
  await audit('glass-input-invalid');
  await capture('glass-input-invalid');
}

async function assertTabTokenColors(root, description) {
  const result = await root.locator('[role="tab"]').evaluateAll((nodes) => {
    const resolveColor = (token) => {
      const probe = document.createElement('span');
      probe.style.color = `var(${token})`;
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();

      return color;
    };

    return {
      foreground: resolveColor('--lg-foreground'),
      muted: resolveColor('--lg-muted-foreground'),
      tabs: nodes.map((node) => ({
        color: getComputedStyle(node).color,
        name: node.textContent?.trim(),
        selected: node.getAttribute('aria-selected') === 'true',
      })),
    };
  });

  for (const tab of result.tabs) {
    assert.equal(
      tab.color,
      tab.selected ? result.foreground : result.muted,
      `${description} ${tab.name} must use the ${tab.selected ? 'foreground' : 'muted foreground'} token`,
    );
  }
}

async function assertTabsState(page, audit, capture) {
  const root = demo(page, 'glass-tabs');

  const overview = await exactlyOne(
    root.getByRole('tab', { name: 'Overview' }),
    'glass tabs overview tab',
  );

  const details = await exactlyOne(
    root.getByRole('tab', { name: 'Details' }),
    'glass tabs details tab',
  );

  assert.equal(
    await overview.getAttribute('aria-selected'),
    'true',
    'GlassTabs must reset to the overview tab',
  );
  await assertTabTokenColors(root, 'GlassTabs reset state');
  const before = await announcementText(page);
  await details.click();
  assert.equal(
    await details.getAttribute('aria-selected'),
    'true',
    'GlassTabs must expose the selected tab with aria-selected',
  );
  await assertTabTokenColors(root, 'GlassTabs selected state');
  const panelId = await details.getAttribute('aria-controls');
  assert.ok(panelId, 'GlassTabs selected tab must own a tab panel');
  const panel = page.locator(`#${panelId}`);
  await panel.waitFor({ state: 'visible' });
  await assertAnnouncementChanged(page, before, 'GlassTabs selection');
  await audit('glass-tabs-details-selected');
  await capture('glass-tabs-details-selected');
}

async function assertDialogState(page, audit, capture) {
  const trigger = await exactlyOne(
    demo(page, 'glass-dialog').getByRole('button', { name: 'Open dialog' }),
    'glass dialog trigger',
  );

  const before = await announcementText(page);
  await trigger.focus();
  await page.keyboard.press('Enter');
  assert.equal(
    await trigger.getAttribute('aria-expanded'),
    'true',
    'GlassDialog trigger must expose its open state',
  );

  const content = await exactlyOne(
    page.getByRole('dialog', { name: 'Glass dialog' }),
    'GlassDialog portal content',
  );

  await content.waitFor({ state: 'visible' });
  await exactlyOne(
    content.getByRole('button', { name: 'Close dialog' }),
    'named GlassDialog close control',
  );

  const containment = await content.evaluate((node) => {
    const rect = node.getBoundingClientRect();

    return {
      bottom: rect.bottom,
      left: rect.left,
      overflowY: getComputedStyle(node).overflowY,
      right: rect.right,
      top: rect.top,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });

  assert.ok(
    ['auto', 'scroll'].includes(containment.overflowY),
    'GlassDialog content must scroll vertically when needed',
  );
  assert.ok(
    containment.left >= 0 &&
      containment.top >= 0 &&
      containment.right <= containment.viewportWidth &&
      containment.bottom <= containment.viewportHeight,
    'GlassDialog content must remain within the viewport',
  );
  await assertAnnouncementChanged(page, before, 'GlassDialog open');
  await audit('glass-dialog-open');
  await capture('glass-dialog-open');
  await page.keyboard.press('Escape');
  assert.equal(
    await trigger.getAttribute('aria-expanded'),
    'false',
    'GlassDialog trigger must expose its closed state',
  );
  await assertFocusReturned(page, trigger, 'GlassDialog');
}

async function assertPopoverState(page, audit, capture) {
  const trigger = await exactlyOne(
    demo(page, 'glass-popover').getByRole('button', { name: 'Open popover' }),
    'glass popover trigger',
  );

  const before = await announcementText(page);
  await trigger.click();
  assert.equal(
    await trigger.getAttribute('aria-expanded'),
    'true',
    'GlassPopover trigger must expose its open state',
  );

  const content = await exactlyOne(
    page.getByRole('dialog', { name: 'Glass popover' }),
    'GlassPopover portal content',
  );

  await content.waitFor({ state: 'visible' });
  await assertAnnouncementChanged(page, before, 'GlassPopover open');
  await audit('glass-popover-open');
  await capture('glass-popover-open');
  await page.keyboard.press('Escape');
  assert.equal(
    await trigger.getAttribute('aria-expanded'),
    'false',
    'GlassPopover trigger must expose its closed state',
  );
  await assertFocusReturned(page, trigger, 'GlassPopover');
}

async function assertTooltipState(page, audit, capture) {
  const trigger = await exactlyOne(
    demo(page, 'glass-tooltip').getByRole('button', { name: 'Show tooltip' }),
    'glass tooltip trigger',
  );

  await trigger.scrollIntoViewIfNeeded();
  await waitForScrollToSettle(page);
  await trigger.focus();
  const triggerHandle = await trigger.elementHandle();
  assert.ok(triggerHandle, 'GlassTooltip trigger must remain mounted');
  await page.waitForFunction(
    (node) => Boolean(node.getAttribute('aria-describedby')),
    triggerHandle,
    { timeout: 2_000 },
  );
  const descriptionId = await trigger.getAttribute('aria-describedby');
  assert.ok(descriptionId, 'GlassTooltip trigger must reference its accessible description');

  const accessibleTooltip = await exactlyOne(
    page.locator(`[id="${descriptionId}"][role="tooltip"]`),
    'GlassTooltip accessible description',
  );

  assert.match(
    (await accessibleTooltip.textContent()) ?? '',
    /Opens on hover and on keyboard focus\./,
    'GlassTooltip accessible description must own the tooltip text',
  );

  const visualTooltip = await exactlyOne(
    page
      .locator('[data-radix-popper-content-wrapper] > [data-state$="open"]')
      .filter({ hasText: 'Opens on hover and on keyboard focus.' }),
    'GlassTooltip visible portal content',
  );

  await visualTooltip.waitFor({ state: 'visible' });
  await audit('glass-tooltip-visible');
  await capture('glass-tooltip-visible');
}

async function assertToastState(page, audit, capture) {
  const trigger = await exactlyOne(
    demo(page, 'glass-toast').getByRole('button', { name: 'Show toast' }),
    'glass toast trigger',
  );

  const before = await announcementText(page);
  await trigger.click();

  const toast = await exactlyOne(
    page.locator('[aria-label="Glass toast"][data-state="open"]'),
    'GlassToast visible content',
  );

  await toast.waitFor({ state: 'visible' });

  const viewport = await exactlyOne(toast.locator('xpath=ancestor::ol'), 'GlassToast viewport');

  assert.equal(
    await viewport.evaluate(
      (node) =>
        node.closest('[data-release-demo]') === null &&
        node.parentElement?.parentElement === document.body,
    ),
    true,
    'GlassToast viewport must portal outside transformed consumer containers',
  );
  assert.equal(
    await toast.getAttribute('tabindex'),
    '0',
    'GlassToast content must be keyboard focusable',
  );

  const announcementLocator = page
    .locator('[role="status"][aria-live="assertive"]')
    .filter({ hasText: 'Glass toast' });

  await announcementLocator.first().waitFor({ state: 'attached', timeout: 2_000 });

  const announcement = await exactlyOne(announcementLocator, 'GlassToast assertive announcement');

  assert.match(
    (await announcement.textContent()) ?? '',
    /It stays until you dismiss it\./,
    'GlassToast announcement must include its description',
  );
  await assertAnnouncementChanged(page, before, 'GlassToast open');
  await audit('glass-toast-visible');
  await capture('glass-toast-visible');
  await toast.focus();
  await page.keyboard.press('Escape');
  await toast.waitFor({ state: 'detached' });

  // A visible button dismisses it too.
  await trigger.click();

  const closable = await exactlyOne(
    page.locator('[aria-label="Glass toast"][data-state="open"]'),
    'GlassToast with a dismiss button',
  );

  await closable.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await closable.waitFor({ state: 'detached' });
  await assertBodyInteractive(page, 'a dismissed GlassToast');
}

async function assertAccordionState(page, audit, capture) {
  const trigger = await exactlyOne(
    demo(page, 'glass-accordion').getByRole('button', { name: 'What makes it glass?' }),
    'glass accordion trigger',
  );

  assert.equal(
    await trigger.getAttribute('aria-expanded'),
    'false',
    'GlassAccordion must begin collapsed after reset',
  );
  const before = await announcementText(page);
  await trigger.click();
  assert.equal(
    await trigger.getAttribute('aria-expanded'),
    'true',
    'GlassAccordion must expose its expanded state',
  );
  const contentId = await trigger.getAttribute('aria-controls');
  assert.ok(contentId, 'GlassAccordion trigger must own its expandable content');
  await page.locator(`#${contentId}`).waitFor({ state: 'visible' });
  await assertAnnouncementChanged(page, before, 'GlassAccordion open');
  await audit('glass-accordion-open');
  await capture('glass-accordion-open');
}

async function assertProviderState(page, mode, audit, capture) {
  const control = await exactlyOne(
    demo(page, 'glass-provider').getByRole('button', { name: 'Toggle theme' }),
    'GlassProvider theme control',
  );

  const requestedTheme = mode.theme;
  const toggledTheme = requestedTheme === 'light' ? 'dark' : 'light';
  assert.equal(
    await page.locator('html').getAttribute('data-lg-theme'),
    requestedTheme,
    'GlassProvider must begin at the requested mode theme',
  );
  const beforeToggle = await announcementText(page);
  await control.click();
  assert.equal(
    await page.locator('html').getAttribute('data-lg-theme'),
    toggledTheme,
    'GlassProvider must toggle away from the requested mode theme',
  );
  await assertAnnouncementChanged(
    page,
    beforeToggle,
    'GlassProvider theme toggle away from requested mode',
  );
  const beforeRestore = await announcementText(page);
  await control.click();
  assert.equal(
    await page.locator('html').getAttribute('data-lg-theme'),
    requestedTheme,
    'GlassProvider must restore the exact requested mode theme',
  );
  await assertAnnouncementChanged(
    page,
    beforeRestore,
    'GlassProvider theme restoration to requested mode',
  );
  await audit('glass-provider-requested-theme-restored');
  await capture('glass-provider-requested-theme-restored');
}

async function assertSwitchThumb(page, control, checked, description) {
  const handle = await control.elementHandle();
  assert.ok(handle, `${description} must remain mounted`);
  await page.waitForFunction(
    ({ node, end }) => {
      const thumb = node.querySelector('.lg-switch-thumb');

      if (!thumb) return false;
      const track = node.getBoundingClientRect();
      const knob = thumb.getBoundingClientRect();
      const centre = knob.left + knob.width / 2;
      const middle = track.left + track.width / 2;

      return end ? centre > middle : centre < middle;
    },
    { node: handle, end: checked },
    { timeout: 2_000 },
  );
}

async function assertSwitchState(page, audit, capture) {
  const root = demo(page, 'glass-switch');

  const notifications = await exactlyOne(
    root.getByRole('switch', { name: 'Notifications' }),
    'GlassSwitch Notifications control',
  );

  const autosave = await exactlyOne(
    root.getByRole('switch', { name: 'Autosave' }),
    'GlassSwitch Autosave control',
  );

  assert.equal(
    await notifications.getAttribute('aria-checked'),
    'true',
    'GlassSwitch must begin at its checked default',
  );
  assert.equal(
    await autosave.getAttribute('aria-checked'),
    'false',
    'GlassSwitch must begin at its unchecked default',
  );
  await assertSwitchThumb(page, notifications, true, 'checked GlassSwitch thumb');
  const before = await announcementText(page);
  await notifications.focus();
  await page.keyboard.press('Space');
  await assertAttribute(
    page,
    notifications,
    'aria-checked',
    'false',
    'GlassSwitch must toggle from the keyboard',
  );
  await assertSwitchThumb(page, notifications, false, 'unchecked GlassSwitch thumb');
  await assertAnnouncementChanged(page, before, 'GlassSwitch keyboard toggle');
  const beforeClick = await announcementText(page);
  await autosave.click();
  await assertAttribute(
    page,
    autosave,
    'aria-checked',
    'true',
    'GlassSwitch must toggle from a click',
  );
  await assertSwitchThumb(page, autosave, true, 'clicked GlassSwitch thumb');
  await assertAnnouncementChanged(page, beforeClick, 'GlassSwitch click toggle');
  await audit('glass-switch-toggled');
  await capture('glass-switch-toggled');
}

async function assertSliderState(page, audit, capture) {
  const root = demo(page, 'glass-slider');
  const thumb = await exactlyOne(root.getByRole('slider', { name: 'Volume' }), 'GlassSlider thumb');
  assert.equal(
    await thumb.getAttribute('aria-valuenow'),
    '60',
    'GlassSlider must begin at its default value',
  );
  const before = await announcementText(page);
  await thumb.focus();
  await page.keyboard.press('ArrowRight');
  await assertAttribute(
    page,
    thumb,
    'aria-valuenow',
    '61',
    'GlassSlider must step with the arrow keys',
  );
  await assertAnnouncementChanged(page, before, 'GlassSlider keyboard commit');
  const fill = await root.locator('.lg-slider-range').evaluate((node) => node.style.right);
  assert.equal(fill, '39%', 'GlassSlider range must fill to the committed value');
  await audit('glass-slider-stepped');
  await capture('glass-slider-stepped');
}

async function assertSegmentedIndicator(page, group, description) {
  const handle = await group.elementHandle();
  assert.ok(handle, `${description} must remain mounted`);
  await page.waitForFunction(
    (node) => {
      const indicator = node.querySelector('.lg-segmented-indicator');
      const checked = node.querySelector('[role="radio"][aria-checked="true"]');

      if (!indicator || !checked) return false;
      const from = indicator.getBoundingClientRect();
      const to = checked.getBoundingClientRect();

      return Math.abs(from.left + from.width / 2 - (to.left + to.width / 2)) < 2;
    },
    handle,
    { timeout: 2_000 },
  );
}

async function assertSegmentedControlState(page, audit, capture) {
  const group = await exactlyOne(
    demo(page, 'glass-segmented-control').getByRole('radiogroup', { name: 'View' }),
    'GlassSegmentedControl',
  );

  const week = await exactlyOne(group.getByRole('radio', { name: 'Week' }), 'Week segment');
  const month = await exactlyOne(group.getByRole('radio', { name: 'Month' }), 'Month segment');
  assert.equal(
    await week.getAttribute('aria-checked'),
    'true',
    'GlassSegmentedControl must begin at Week',
  );
  await assertSegmentedIndicator(page, group, 'GlassSegmentedControl indicator at Week');
  const before = await announcementText(page);
  await month.click();
  await assertAttribute(
    page,
    month,
    'aria-checked',
    'true',
    'GlassSegmentedControl must check the clicked segment',
  );
  assert.equal(
    await week.getAttribute('aria-checked'),
    'false',
    'GlassSegmentedControl must uncheck the previous segment',
  );
  await assertSegmentedIndicator(page, group, 'GlassSegmentedControl indicator at Month');
  await assertAnnouncementChanged(page, before, 'GlassSegmentedControl selection');
  const beforeKeyboard = await announcementText(page);
  await selectRadioWithArrow(
    page,
    'ArrowLeft',
    week,
    'GlassSegmentedControl arrow keys must move the selection',
  );
  await assertAttribute(
    page,
    week,
    'aria-checked',
    'true',
    'GlassSegmentedControl arrow keys must move the selection',
  );
  await assertSegmentedIndicator(page, group, 'GlassSegmentedControl indicator after ArrowLeft');
  await assertAnnouncementChanged(page, beforeKeyboard, 'GlassSegmentedControl keyboard selection');
  await audit('glass-segmented-control-selected');
  await capture('glass-segmented-control-selected');
}

async function assertBadgeContrast(page, mode) {
  // Site examples follow the brand; the optional library tones still need the same contrast bar.
  const badges = await demo(page, 'glass-badge')
    .locator('.lg-badge')
    .first()
    .evaluate((node) => {
      const originalTone = node.getAttribute('data-tone');
      const tones = ['neutral', 'blue', 'green', 'orange', 'red', 'purple'];

      try {
        return tones.map((tone) => {
          node.setAttribute('data-tone', tone);
          const style = getComputedStyle(node);

          return {
            background: style.backgroundColor,
            color: style.color,
            label: tone,
            tone,
          };
        });
      } finally {
        node.setAttribute('data-tone', originalTone);
      }
    });

  // The stylesheet promises 4.5:1 over pure white and pure black, whatever sits behind.
  for (const badge of badges) {
    const fill = parseColor(badge.background);
    const ink = parseColor(badge.color);
    assert.ok(fill && ink, `${mode.name} ${badge.label} badge must resolve RGB colors`);

    for (const [backdropName, backdrop] of [
      ['white', [255, 255, 255]],
      ['black', [0, 0, 0]],
    ]) {
      const surface = composite(fill, backdrop);
      const ratio = contrast(composite(ink, surface), surface);
      assert.ok(
        ratio >= 4.5,
        `${mode.name} ${badge.tone} badge text must reach 4.5:1 over ${backdropName}; measured ${ratio.toFixed(2)}`,
      );
    }
  }
}

async function dockItemWidths(dock) {
  return dock
    .locator('.lg-dock-item')
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width));
}

async function assertDockState(page, audit, capture) {
  const dock = await exactlyOne(
    demo(page, 'glass-dock').getByRole('group', { name: 'Dock' }),
    'GlassDock',
  );

  const gallery = await exactlyOne(
    dock.getByRole('button', { name: 'Gallery' }),
    'Gallery dock item',
  );

  assert.equal(
    await gallery.getAttribute('data-active'),
    'false',
    'Gallery must begin without a running dot',
  );
  await gallery.scrollIntoViewIfNeeded();
  // A scroll-linked reveal moves the element on the next frame, so measure after it.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const box = await dock.boundingBox();
  assert.ok(box, 'GlassDock must render a box');
  const rest = await dockItemWidths(dock);

  // Icons keep their size wherever the pointer is.
  for (const fraction of [0.3, 0.5, 0.7]) {
    await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2);
  }

  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  assert.deepEqual(
    await dockItemWidths(dock),
    rest,
    'GlassDock icons must keep their size under the pointer',
  );
  const before = await announcementText(page);
  await gallery.click();
  await assertAttribute(
    page,
    gallery,
    'data-active',
    'true',
    'GlassDock item must show its running dot after opening',
  );
  await assertAnnouncementChanged(page, before, 'GlassDock item');
  await audit('glass-dock-opened');
  await capture('glass-dock-opened');
  await page.mouse.move(0, 0);
}

async function assertSheetPlacement(page, sheet, description) {
  const handle = await sheet.elementHandle();
  assert.ok(handle, `${description} must remain mounted`);
  // The sheet rests 8px above the bottom edge, centred, once its entrance settles.
  await page
    .waitForFunction(
      (node) => {
        const rect = node.getBoundingClientRect();

        return (
          Math.abs(rect.bottom - (window.innerHeight - 8)) < 1.5 &&
          Math.abs((rect.left + rect.right) / 2 - window.innerWidth / 2) < 1.5
        );
      },
      handle,
      { timeout: 2_000 },
    )
    .catch(() => {});

  const placement = await sheet.evaluate((node) => {
    const rect = node.getBoundingClientRect();

    return {
      bottom: rect.bottom,
      centre: (rect.left + rect.right) / 2,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });

  assert.ok(
    Math.abs(placement.bottom - (placement.viewportHeight - 8)) < 1.5,
    `${description} must rest at the bottom edge; its bottom is ${placement.bottom} in a ${placement.viewportHeight}px viewport`,
  );
  assert.ok(
    Math.abs(placement.centre - placement.viewportWidth / 2) < 1.5,
    `${description} must be centred horizontally`,
  );
  assert.ok(
    placement.left >= 0 && placement.top >= 0 && placement.right <= placement.viewportWidth,
    `${description} must remain within the viewport`,
  );
}

async function assertSheetState(page, audit, capture) {
  const trigger = await exactlyOne(
    demo(page, 'glass-sheet').getByRole('button', { name: 'Open sheet' }),
    'GlassSheet trigger',
  );

  // A modal sheet hides the page from role queries, so read the trigger through its node.
  const triggerNode = await trigger.elementHandle();
  const before = await announcementText(page);
  await trigger.click();
  assert.equal(
    await triggerNode.getAttribute('aria-expanded'),
    'true',
    'GlassSheet trigger must expose its open state',
  );

  const sheet = await exactlyOne(
    page.getByRole('dialog', { name: 'Glass sheet' }),
    'GlassSheet portal content',
  );

  await sheet.waitFor({ state: 'visible' });
  await exactlyOne(
    sheet.getByRole('button', { name: 'Close sheet' }),
    'named GlassSheet close control',
  );
  await assertSheetPlacement(page, sheet, 'GlassSheet');
  await audit('glass-sheet-open');
  await capture('glass-sheet-open');
  await page.keyboard.press('Escape');
  await sheet.waitFor({ state: 'detached' });
  assert.equal(
    await trigger.getAttribute('aria-expanded'),
    'false',
    'GlassSheet trigger must expose its closed state',
  );
  await assertFocusReturned(page, trigger, 'GlassSheet');
  await assertBodyInteractive(page, 'a closed GlassSheet');
  // A modal sheet hides the live region while open, so the change is read after close.
  await assertAnnouncementChanged(page, before, 'GlassSheet open and close');
}

async function assertMenuState(page, audit, capture) {
  const trigger = await exactlyOne(
    demo(page, 'glass-menu').getByRole('button', { name: 'Options' }),
    'GlassMenu trigger',
  );

  const before = await announcementText(page);
  await trigger.click();
  const menu = await exactlyOne(page.getByRole('menu'), 'GlassMenu portal content');
  await menu.waitFor({ state: 'visible' });

  const sidebar = await exactlyOne(
    menu.getByRole('menuitemcheckbox', { name: 'Show sidebar' }),
    'GlassMenu checkbox item',
  );

  assert.equal(
    await sidebar.getAttribute('aria-checked'),
    'true',
    'Show sidebar must begin checked',
  );
  await exactlyOne(menu.getByRole('menuitemradio', { name: 'Name' }), 'GlassMenu radio item');
  await audit('glass-menu-open');
  await capture('glass-menu-open');
  await sidebar.click();
  await menu.waitFor({ state: 'detached' });
  await assertFocusReturned(page, trigger, 'GlassMenu after a pointer choice');
  await assertAnnouncementChanged(page, before, 'GlassMenu checkbox item');
  await trigger.focus();
  await page.keyboard.press('Enter');
  const reopened = await exactlyOne(page.getByRole('menu'), 'reopened GlassMenu');
  await reopened.waitFor({ state: 'visible' });
  await assertAttribute(
    page,
    reopened.getByRole('menuitemcheckbox', { name: 'Show sidebar' }),
    'aria-checked',
    'false',
    'Show sidebar must keep its new state',
  );
  await page.keyboard.press('Escape');
  await reopened.waitFor({ state: 'detached' });
  await assertFocusReturned(page, trigger, 'GlassMenu after Escape');
  await assertBodyInteractive(page, 'a closed GlassMenu');
}

async function lensCentre(lens) {
  return lens.evaluate((node) => ({
    x: Number.parseFloat(node.style.getPropertyValue('--lg-lens-x')),
    y: Number.parseFloat(node.style.getPropertyValue('--lg-lens-y')),
  }));
}

// The stage shrinks, the lens's observer reports it, and the stage grows back before
// React commits that stale size. The lens must stay over the same spot.
async function assertLensSurvivesStaleResize(lens) {
  const fractions = await lens.evaluate(
    (node) =>
      new Promise((resolve) => {
        const stage = node.parentElement;
        const originalWidth = stage.style.width;

        const fraction = () =>
          Number.parseFloat(node.style.getPropertyValue('--lg-lens-x')) / stage.clientWidth;

        const before = fraction();
        let restored = false;

        // Created after the component's observer, so this callback runs after its callback.
        const observer = new ResizeObserver(() => {
          if (restored || stage.clientWidth > 20) return;
          restored = true;
          stage.style.width = originalWidth;
        });

        observer.observe(stage);
        requestAnimationFrame(() => {
          stage.style.width = '8px';
        });
        setTimeout(() => {
          observer.disconnect();
          resolve({ after: fraction(), before, restored });
        }, 500);
      }),
  );

  assert.ok(fractions.restored, 'GlassLens stale-resize check must observe the collapsed stage');
  assert.ok(
    Math.abs(fractions.after - fractions.before) < 0.001,
    `GlassLens must keep its place across a stale resize; moved from ${fractions.before} to ${fractions.after}`,
  );
}

async function assertLensState(page, audit, capture) {
  const lens = await exactlyOne(
    demo(page, 'glass-lens').getByRole('group', { name: 'Magnifier' }),
    'GlassLens',
  );

  const start = await lensCentre(lens);
  assert.ok(
    Number.isFinite(start.x) && Number.isFinite(start.y),
    'GlassLens must position itself on its stage',
  );
  await assertLensSurvivesStaleResize(lens);
  await lens.focus();
  await page.keyboard.press('ArrowRight');
  const moved = await lensCentre(lens);
  // The stage can sit on a fractional pixel, so compare the step, not two sums of floats.
  assert.ok(
    Math.abs(moved.x - start.x - 10) < 0.01,
    `GlassLens must move 10px per arrow key (moved ${moved.x - start.x}px)`,
  );
  assert.equal(moved.y, start.y, 'GlassLens horizontal arrow keys must not move it vertically');
  await lens.scrollIntoViewIfNeeded();
  // A scroll-linked reveal moves the element on the next frame, so measure after it.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const box = await lens.boundingBox();
  assert.ok(box, 'GlassLens must render a box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 24, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  const dragged = await lensCentre(lens);
  assert.ok(
    Math.abs(dragged.x - (moved.x - 24)) < 1,
    `GlassLens must follow a drag; moved from ${moved.x} to ${dragged.x}`,
  );
  await audit('glass-lens-moved');
  await capture('glass-lens-moved');
}

async function assertCheckboxState(page, audit, capture) {
  const root = demo(page, 'glass-checkbox');

  const all = await exactlyOne(
    root.getByRole('checkbox', { name: 'All channels' }),
    'parent checkbox',
  );

  const email = await exactlyOne(root.getByRole('checkbox', { name: 'Email' }), 'Email checkbox');
  const push = await exactlyOne(root.getByRole('checkbox', { name: 'Push' }), 'Push checkbox');

  const text = await exactlyOne(
    root.getByRole('checkbox', { name: 'Text message' }),
    'Text message checkbox',
  );

  // Reduced motion shows the end state at once: a drawn tick when checked, none when cleared.
  const tick = (box) =>
    box.locator('.lg-check-tick').evaluate((node) => getComputedStyle(node).strokeDashoffset);

  assert.equal(await all.getAttribute('aria-checked'), 'mixed', 'the parent begins indeterminate');
  assert.equal(await email.getAttribute('aria-checked'), 'true', 'Email begins checked');
  assert.equal(await tick(email), '0px', 'a checked box shows its tick');
  assert.equal(await tick(push), '1px', 'an unchecked box hides its tick');

  const before = await announcementText(page);
  await push.click();
  await assertAttribute(page, push, 'aria-checked', 'true', 'a click must check the box');
  await assertAnnouncementChanged(page, before, 'GlassCheckbox click');
  await text.focus();
  await page.keyboard.press('Space');
  await assertAttribute(page, text, 'aria-checked', 'true', 'Space must check the box');
  await assertAttribute(
    page,
    all,
    'aria-checked',
    'true',
    'the parent follows when every child is checked',
  );

  await root.getByText('Push', { exact: true }).click();
  await assertAttribute(page, push, 'aria-checked', 'false', 'the label must toggle its box');
  await assertAttribute(
    page,
    all,
    'aria-checked',
    'mixed',
    'the parent goes back to indeterminate',
  );
  await audit('glass-checkbox-mixed');
  await capture('glass-checkbox-mixed');
  await all.click();
  await assertAttribute(
    page,
    all,
    'aria-checked',
    'true',
    'an indeterminate parent checks every child',
  );
  await all.click();
  await assertAttribute(page, all, 'aria-checked', 'false', 'a checked parent clears every child');
  assert.equal(
    await email.getAttribute('aria-checked'),
    'false',
    'clearing the parent clears Email',
  );
  assert.equal(await tick(email), '1px', 'a cleared box hides its tick');
}

async function assertRadioGroupState(page, audit, capture) {
  const root = demo(page, 'glass-radio-group');

  const group = await exactlyOne(
    root.getByRole('radiogroup', { name: 'Plan' }),
    'plan radio group',
  );

  const radios = group.getByRole('radio');
  assert.equal(await radios.count(), 3, 'the plan group has three options');
  const pro = await exactlyOne(group.getByRole('radio', { name: 'Pro' }), 'Pro radio');
  const scale = await exactlyOne(group.getByRole('radio', { name: 'Scale' }), 'Scale radio');
  const starter = await exactlyOne(group.getByRole('radio', { name: 'Starter' }), 'Starter radio');

  assert.equal(await pro.getAttribute('aria-checked'), 'true', 'Pro begins chosen');
  assert.match(
    (await pro.getAttribute('aria-describedby')) ?? '',
    /-description$/,
    'a description must be linked to its radio',
  );

  const before = await announcementText(page);
  await pro.focus();
  await selectRadioWithArrow(page, 'ArrowDown', scale, 'ArrowDown must move the choice');
  await assertAttribute(page, scale, 'aria-checked', 'true', 'ArrowDown must move the choice');
  await assertAttribute(page, pro, 'aria-checked', 'false', 'the previous choice must clear');
  await assertAnnouncementChanged(page, before, 'GlassRadioGroup keyboard choice');
  await starter.click();
  await assertAttribute(page, starter, 'aria-checked', 'true', 'a click must choose the option');

  const chosen = await group.locator('[role="radio"][aria-checked="true"]').count();
  assert.equal(chosen, 1, 'exactly one radio may be chosen');
  await audit('glass-radio-group-chosen');
  await capture('glass-radio-group-chosen');
}

async function assertTextareaState(page, audit, capture) {
  const root = demo(page, 'glass-textarea');

  const field = await exactlyOne(
    root.getByRole('textbox', { name: 'Message' }),
    'message textarea',
  );

  assert.match(
    (await field.getAttribute('aria-describedby')) ?? '',
    /-hint$/,
    'the hint must be linked to the textarea',
  );

  const height = () => field.evaluate((node) => Math.round(node.getBoundingClientRect().height));
  const empty = await height();
  await field.fill('one\ntwo\nthree\nfour');
  const grown = await height();
  assert.ok(
    grown > empty,
    `an auto-resizing textarea must grow with its text (${empty}px to ${grown}px)`,
  );
  await field.fill(Array.from({ length: 12 }, (_, line) => `line ${line + 1}`).join('\n'));
  const capped = await height();
  await field.fill(Array.from({ length: 30 }, (_, line) => `line ${line + 1}`).join('\n'));
  assert.equal(await height(), capped, 'the textarea must stop growing at maxRows');
  assert.equal(
    await field.evaluate((node) => getComputedStyle(node).overflowY),
    'auto',
    'a capped textarea must scroll',
  );
  await field.fill('');
  assert.equal(await height(), empty, 'clearing the text shrinks the textarea back');

  const before = await announcementText(page);
  await root.getByRole('button', { name: 'Send' }).click();
  await assertAnnouncementChanged(page, before, 'GlassTextarea empty submit');
  await field.fill('Hello there');
  await audit('glass-textarea-filled');
  await capture('glass-textarea-filled');
}

async function assertSelectState(page, audit, capture) {
  const root = demo(page, 'glass-select');

  const trigger = await exactlyOne(
    root.getByRole('combobox', { name: 'Framework' }),
    'framework select',
  );

  assert.equal(await trigger.getAttribute('aria-expanded'), 'false', 'the select begins closed');

  const before = await announcementText(page);
  await trigger.click();
  const list = await exactlyOne(page.getByRole('listbox'), 'GlassSelect portal content');
  await list.waitFor({ state: 'visible' });
  assert.equal(await list.getByRole('option').count(), 4, 'the select lists four options');
  // Radix Select hides the page behind it, so the open list is audited on its own.
  await audit('glass-select-open', '[role="listbox"]');
  await capture('glass-select-open', { fullPage: false });

  // Typing a letter jumps to a matching option; Escape closes without choosing.
  await page.keyboard.press('s');
  await assertAttribute(
    page,
    list.getByRole('option', { name: 'SvelteKit' }),
    'data-highlighted',
    '',
    'typeahead must highlight the matching option',
  );
  await page.keyboard.press('Escape');
  await list.waitFor({ state: 'detached' });
  await assertFocusReturned(page, trigger, 'GlassSelect after Escape');
  assert.match(
    (await trigger.textContent()) ?? '',
    /Choose a framework/,
    'Escape must not choose an option',
  );

  await trigger.press('Enter');
  const reopened = await exactlyOne(page.getByRole('listbox'), 'reopened GlassSelect');
  await reopened.waitFor({ state: 'visible' });
  await reopened.getByRole('option', { name: 'Astro' }).click();
  await reopened.waitFor({ state: 'detached' });
  await assertFocusReturned(page, trigger, 'GlassSelect after a choice');
  assert.match(
    (await trigger.textContent()) ?? '',
    /Astro/,
    'the trigger must show the chosen option',
  );
  await assertAnnouncementChanged(page, before, 'GlassSelect choice');
  await assertBodyInteractive(page, 'a closed GlassSelect');
}

async function assertProgressState(page, audit, capture) {
  const root = demo(page, 'glass-progress');

  const bar = await exactlyOne(
    root.getByRole('progressbar', { name: 'Uploading' }),
    'upload progress bar',
  );

  assert.equal(await bar.getAttribute('aria-valuenow'), '35', 'the bar begins at 35');

  const unknown = await exactlyOne(
    root.getByRole('progressbar', { name: 'Working' }),
    'indeterminate bar',
  );

  assert.equal(await unknown.getAttribute('aria-valuenow'), null, 'an unknown length has no value');

  const fill = () =>
    bar.locator('.lg-progress-fill').evaluate((node) => getComputedStyle(node).translate);

  const start = await fill();
  await root.getByRole('button', { name: 'Advance' }).click();
  await assertAttribute(page, bar, 'aria-valuenow', '60', 'Advance must move the bar');
  assert.notEqual(await fill(), start, 'the fill must move with the value');
  await root.getByRole('button', { name: 'Advance' }).click();
  await root.getByRole('button', { name: 'Advance' }).click();
  await assertAttribute(page, bar, 'aria-valuenow', '100', 'the bar must stop at its maximum');
  await exactlyOne(root.getByRole('button', { name: 'Restart' }), 'restart control at 100%');
  assert.equal(
    await bar.locator('xpath=..').getAttribute('data-state'),
    'complete',
    'a full bar reports complete',
  );
  await audit('glass-progress-complete');
  await capture('glass-progress-complete');
}

async function assertSpinnerState(page, audit) {
  const root = demo(page, 'glass-spinner');
  const spinners = root.getByRole('status');
  assert.equal(await spinners.count(), 3, 'the spinner demo shows three sizes');

  for (const name of ['Loading small', 'Loading', 'Loading large'])
    await exactlyOne(
      root.getByRole('status').filter({ hasText: new RegExp(`^${name}$`) }),
      `${name} spinner`,
    );

  await audit('glass-spinner');
}

async function assertSkeletonState(page, audit, capture) {
  const root = demo(page, 'glass-skeleton');
  const card = root.locator('[aria-busy]').first();
  assert.equal(await card.getAttribute('aria-busy'), 'true', 'the loading region must be busy');
  assert.equal(await root.getByText('Ada Lovelace').count(), 0, 'no content before loading');
  const placeholders = card.locator('.lg-skeleton');
  assert.ok((await placeholders.count()) >= 3, 'the loading card shows placeholders');
  assert.equal(
    await placeholders.evaluateAll((nodes) =>
      nodes.every((node) => node.closest('[aria-hidden="true"]')),
    ),
    true,
    'placeholders are hidden from assistive technology',
  );

  const before = await announcementText(page);
  await root.getByRole('button', { name: 'Load content' }).click();
  await assertAttribute(page, card, 'aria-busy', 'false', 'loading must clear aria-busy');
  await exactlyOne(card.getByText('Ada Lovelace', { exact: true }), 'loaded name');
  assert.equal(
    await card.locator('.lg-skeleton').count(),
    0,
    'placeholders leave when content arrives',
  );
  await assertAnnouncementChanged(page, before, 'GlassSkeleton load');
  await audit('glass-skeleton-loaded');
  await capture('glass-skeleton-loaded');
}

async function assertAlertState(page, audit, capture) {
  const root = demo(page, 'glass-alert');

  // In the gallery a demo alert is a note, so scrolling past it announces nothing. Its roles are
  // checked on the component's own page below.
  assert.equal(await root.getByRole('alert').count(), 0, 'gallery alerts must not interrupt');
  assert.equal(
    await root.getByRole('note').count(),
    4,
    'the gallery shows its four alerts as notes',
  );

  const danger = await exactlyOne(
    root.getByRole('note').filter({ hasText: 'Payment failed' }),
    'danger alert',
  );

  await audit('glass-alert-open');
  await capture('glass-alert-open');

  const before = await announcementText(page);
  await danger.getByRole('button', { name: 'Dismiss' }).click();
  await danger.waitFor({ state: 'detached' });
  await assertAnnouncementChanged(page, before, 'GlassAlert dismiss');
  assert.equal(await root.getByRole('note').count(), 3, 'dismissing removes the alert');

  // On its own page the demo keeps each tone's role: warnings and errors interrupt, the rest wait.
  const own = await page.context().newPage();

  await own.goto(new URL('/components/glass-alert', baseUrl).href, { waitUntil: 'networkidle' });

  const alerts = demo(own, 'glass-alert');

  assert.equal(await alerts.getByRole('alert').count(), 2, 'warnings and errors are alerts');
  assert.equal(await alerts.getByRole('status').count(), 2, 'info and success are statuses');
  await own.close();
}

async function assertAvatarState(page, audit, capture) {
  const root = demo(page, 'glass-avatar');
  await exactlyOne(root.getByRole('img', { name: 'Grace Hopper, online' }), 'online avatar');
  await exactlyOne(root.getByRole('img', { name: 'Katherine Johnson, busy' }), 'busy avatar');
  const group = await exactlyOne(root.getByRole('group', { name: 'Team' }), 'avatar group');
  await exactlyOne(group.getByRole('img', { name: '1 more' }), 'avatar overflow');
  assert.equal(
    await group.locator('.lg-avatar').count(),
    5,
    'the group shows four avatars and the overflow',
  );

  // The initials are decoration for assistive technology: the avatar is one image.
  assert.equal(
    await root.locator('.lg-avatar-fallback').first().getAttribute('aria-hidden'),
    'true',
    'initials must be hidden from assistive technology',
  );
  await audit('glass-avatar');
  await capture('glass-avatar');
}

async function assertKbdState(page, audit) {
  const root = demo(page, 'glass-kbd');
  assert.equal(await root.locator('kbd.lg-kbd').count(), 5, 'the demo shows five keycaps');
  await audit('glass-kbd');
}

async function assertCommandState(page, audit, capture) {
  const root = demo(page, 'glass-command');

  const trigger = await exactlyOne(
    root.getByRole('button', { name: 'Open command menu' }),
    'command trigger',
  );

  const before = await announcementText(page);
  await trigger.click();

  const dialog = await exactlyOne(
    page.getByRole('dialog', { name: 'Command menu' }),
    'command dialog',
  );

  await dialog.waitFor({ state: 'visible' });
  const input = await exactlyOne(dialog.getByRole('combobox'), 'command search field');
  await page.waitForFunction(
    (node) => document.activeElement === node,
    await input.elementHandle(),
    { timeout: 2_000 },
  );
  assert.equal(await dialog.getByRole('option').count(), 5, 'the palette lists five commands');
  await audit('glass-command-open');
  await capture('glass-command-open');

  await page.keyboard.type('zzzz');
  await exactlyOne(dialog.getByText('No results found.'), 'empty state');
  await input.fill('the');
  assert.equal(await dialog.getByRole('option').count(), 1, 'typing filters the list');
  await page.keyboard.press('Enter');
  await dialog.waitFor({ state: 'detached' });
  await assertFocusReturned(page, trigger, 'GlassCommand after a choice');
  await assertAnnouncementChanged(page, before, 'GlassCommand choice');
  await assertBodyInteractive(page, 'a closed GlassCommand');

  // Escape closes it and hands the page back.
  await trigger.click();

  const reopened = await exactlyOne(
    page.getByRole('dialog', { name: 'Command menu' }),
    'reopened command dialog',
  );

  await reopened.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await reopened.waitFor({ state: 'detached' });
  await assertFocusReturned(page, trigger, 'GlassCommand after Escape');
  await assertBodyInteractive(page, 'a GlassCommand closed with Escape');
}

async function assertBreadcrumbState(page, audit, capture) {
  const root = demo(page, 'glass-breadcrumb');

  const nav = await exactlyOne(
    root.getByRole('navigation', { name: 'Breadcrumb' }),
    'breadcrumb landmark',
  );

  // The steps between Home and the current page fold into a menu, so the trail fits one line.
  assert.equal(await nav.getByRole('listitem').count(), 3, 'the trail has three steps');
  const page_ = await exactlyOne(nav.locator('[aria-current="page"]'), 'current page step');
  assert.equal(
    (await page_.textContent())?.trim(),
    'Breadcrumb',
    'the last step is the current page',
  );
  assert.equal(await nav.getByRole('link').count(), 1, 'only earlier steps are links');
  await audit('glass-breadcrumb');
  await capture('glass-breadcrumb');

  const ellipsis = await exactlyOne(
    nav.getByRole('button', { name: 'Show hidden pages' }),
    'folded steps button',
  );

  const before = await announcementText(page);
  await ellipsis.click();
  const menu = await exactlyOne(page.getByRole('menu'), 'folded steps menu');
  await menu.waitFor({ state: 'visible' });
  await menu.getByRole('menuitem', { name: 'Components' }).click();
  await menu.waitFor({ state: 'detached' });
  await assertFocusReturned(page, ellipsis, 'GlassBreadcrumb menu');
  await assertAnnouncementChanged(page, before, 'GlassBreadcrumb menu choice');
}

async function assertPaginationState(page, audit, capture) {
  const root = demo(page, 'glass-pagination');

  const nav = await exactlyOne(
    root.getByRole('navigation', { name: 'Pagination' }),
    'pagination landmark',
  );

  const current = () => nav.locator('[aria-current="page"]');
  assert.equal((await current().textContent())?.trim(), '5', 'page 5 begins current');

  const before = await announcementText(page);
  await nav.getByRole('button', { name: 'Next page' }).click();
  await assertAttribute(
    page,
    nav.getByRole('button', { name: 'Page 6', exact: true }),
    'aria-current',
    'page',
    'Next must move on',
  );
  await assertAnnouncementChanged(page, before, 'GlassPagination step');
  await nav.getByRole('button', { name: 'Page 12', exact: true }).click();
  assert.equal(
    await nav.getByRole('button', { name: 'Next page' }).isDisabled(),
    true,
    'the last page disables Next',
  );
  await nav.getByRole('button', { name: 'Page 1', exact: true }).click();
  assert.equal(
    await nav.getByRole('button', { name: 'Previous page' }).isDisabled(),
    true,
    'the first page disables Previous',
  );

  await nav.getByRole('button', { name: 'Page 1', exact: true }).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await assertAttribute(
    page,
    nav.getByRole('button', { name: 'Page 2', exact: true }),
    'aria-current',
    'page',
    'the keyboard must reach and press the next page',
  );
  await audit('glass-pagination');
  await capture('glass-pagination');
}

async function assertComponentStates(page, mode, audit, capture) {
  await assertProviderState(page, mode, audit, capture);
  await assertToggleState(page, 'glass-surface', 'Toggle surface emphasis', audit, capture);
  await assertButtonState(page, mode, audit, capture);
  await assertPanelState(page, audit, capture);
  await assertInputState(page, audit, capture);
  await assertCheckboxState(page, audit, capture);
  await assertRadioGroupState(page, audit, capture);
  await assertTextareaState(page, audit, capture);
  await assertSelectState(page, audit, capture);
  await assertTabsState(page, audit, capture);
  await assertDialogState(page, audit, capture);
  await assertPopoverState(page, audit, capture);
  await assertTooltipState(page, audit, capture);
  await assertToastState(page, audit, capture);
  await assertAccordionState(page, audit, capture);
  await assertSwitchState(page, audit, capture);
  await assertSliderState(page, audit, capture);
  await assertSegmentedControlState(page, audit, capture);
  await assertBadgeContrast(page, mode);
  await assertProgressState(page, audit, capture);
  await assertSpinnerState(page, audit);
  await assertSkeletonState(page, audit, capture);
  await assertAlertState(page, audit, capture);
  await assertAvatarState(page, audit, capture);
  await assertKbdState(page, audit);
  await assertDockState(page, audit, capture);
  await assertSheetState(page, audit, capture);
  await assertMenuState(page, audit, capture);
  await assertCommandState(page, audit, capture);
  await assertBreadcrumbState(page, audit, capture);
  await assertPaginationState(page, audit, capture);
  await assertLensState(page, audit, capture);
  await assertToggleState(page, 'glass-scene', 'Merge', audit, capture);
  await assertToggleState(page, 'glass-scene', 'Flow', audit, capture, 'glass-scene-flow');
}

// The widest displacement the sheet's lens applies, in CSS pixels. Null when the lens is off.
async function readLensReach(settings) {
  return settings.evaluate((node) => {
    if (node.getAttribute('data-lg-lens') !== 'active') return null;

    const id = getComputedStyle(node).backdropFilter.match(/^url\("?#([^")]+)"?\)/)?.[1];
    const filter = id ? document.getElementById(id) : null;

    const scales = [...(filter?.querySelectorAll('feDisplacementMap') ?? [])].map((map) =>
      Number(map.getAttribute('scale')),
    );

    return scales.length ? Math.max(...scales) : null;
  });
}

// The thickness preference drives every lens: thicker glass has a wider rim that bends the
// page further. The slider must set the preference, persist it and reshape the sheet's lens.
async function assertThicknessControl(page, settings, capture) {
  const thumb = await exactlyOne(
    settings.getByRole('slider', { name: 'Glass thickness', exact: true }),
    'desk Glass thickness slider',
  );

  assert.equal(await thumb.getAttribute('aria-valuemin'), '0.25', 'thickness starts at 0.25');
  assert.equal(await thumb.getAttribute('aria-valuemax'), '2', 'thickness stops at 2');
  assert.equal(await thumb.getAttribute('aria-valuenow'), '1', 'regular glass is 1');

  const rootThickness = () =>
    page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--lg-glass-thickness').trim(),
    );

  const reading = () => settings.locator('.desk-settings-value').textContent();
  const before = await readLensReach(settings);
  await thumb.focus();

  const settle = async (value, description) => {
    await page.waitForFunction(
      (expected) =>
        document.documentElement.style.getPropertyValue('--lg-glass-thickness').trim() === expected,
      value,
      { timeout: 2_000 },
    );
    assert.equal(await rootThickness(), value, description);
  };

  await page.keyboard.press('End');
  await settle('2', 'the slider must set --lg-glass-thickness to 2');
  assert.match((await reading()) ?? '', /^2\.00/, 'the reading follows the slider');

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('glassy-ui-preferences') ?? '{}'),
  );

  assert.equal(stored.thickness, 2, 'the thickness preference must persist');

  if (before !== null) {
    await page.waitForFunction(
      ([node, floor]) => {
        const id = getComputedStyle(node).backdropFilter.match(/^url\("?#([^")]+)"?\)/)?.[1];

        const scales = [
          ...(document.getElementById(id)?.querySelectorAll('feDisplacementMap') ?? []),
        ].map((map) => Number(map.getAttribute('scale')));

        return scales.length > 0 && Math.max(...scales) > floor;
      },
      [await settings.elementHandle(), before * 1.15],
      { timeout: 3_000 },
    );
  }

  const thick = await readLensReach(settings);
  await capture('home-settings-thickness-max');
  await page.keyboard.press('Home');
  await settle('0.25', 'the slider must set --lg-glass-thickness to 0.25');
  await page.waitForTimeout(400);
  const thin = await readLensReach(settings);
  await capture('home-settings-thickness-min');

  if (before !== null) {
    assert.ok(
      thick !== null && thin !== null && thick > before && before > thin,
      `thicker glass must bend further: 0.25x reaches ${thin}, 1x ${before} and 2x ${thick}`,
    );
  }

  // Back to regular glass, so the rest of the flow sees the default.
  await page.keyboard.press('End');
  await settle('2', 'the slider must return to its maximum');

  for (let step = 0; step < 20; step += 1) await page.keyboard.press('ArrowLeft');

  await settle('1', 'the slider must return to regular glass');
  assert.equal(await thumb.getAttribute('aria-valuenow'), '1', 'regular glass is 1 again');
}

async function assertHomeSettingsFlow(page, audit, capture) {
  const desk = page.locator('.home-desk');

  const app = await exactlyOne(
    desk.getByRole('button', { name: 'Glassy UI', exact: true }),
    'desk app menu trigger',
  );

  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  await app.scrollIntoViewIfNeeded();
  await app.click();
  await (
    await exactlyOne(
      page.getByRole('menuitem', { name: 'Settings…', exact: true }),
      'desk Settings… item',
    )
  ).click();
  await settings.waitFor({ state: 'visible' });
  await assertSheetPlacement(page, settings, 'desk Settings sheet');
  await audit('home-settings-open');
  await capture('home-settings-open');
  await assertThicknessControl(page, settings, capture);
  await settings.getByRole('button', { name: 'Close settings', exact: true }).click();
  await settings.waitFor({ state: 'detached' });
  await assertBodyInteractive(page, 'the desk Settings sheet opened from a menu');
  // A stuck layer would swallow this click, so the next menu must still open.
  const viewTrigger = desk.getByRole('button', { name: 'View', exact: true });
  await viewTrigger.click();
  const view = await exactlyOne(page.getByRole('menu'), 'desk View menu');
  await view
    .getByRole('menuitemcheckbox', { name: 'Show Widgets', exact: true })
    .waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await view.waitFor({ state: 'detached' });
  // Radix restores focus after unmount; let it finish before opening another menu.
  await assertFocusReturned(page, viewTrigger, 'desk View menu closed with Escape');
  await app.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => document.activeElement?.getAttribute('role') === 'menuitem',
    null,
    { timeout: 2_000 },
  );
  await page.keyboard.press('ArrowDown');
  // Radix moves roving focus in a timeout after the keydown.
  await page.waitForFunction(
    () => document.activeElement?.textContent?.trim() === 'Settings…',
    null,
    { timeout: 2_000 },
  );
  await page.keyboard.press('Enter');
  await settings.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await settings.waitFor({ state: 'detached' });
  await assertBodyInteractive(page, 'the desk Settings sheet closed with Escape');
  // The Settings… item is gone, so focus returns to the menu that held it.
  await assertFocusReturned(page, app, 'desk Settings sheet opened from the menu');
}

// With motion allowed the home page opens with the keynote's opener (scripts/check-keynote.mjs
// checks it), which plays over the top of the page as it loads; a key press moves it on, and the
// ordinary page, its header and its desk are there once it lands.
async function landHome(page) {
  if (!(await page.evaluate(() => document.documentElement.hasAttribute('data-keynote-intro')))) {
    return;
  }

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-keynote-intro'));
  await page.waitForTimeout(400);
}

// The keynote turns the desk into a phone whose live screen runs the same components, in the
// page's appearance, and brings in all six features. Under reduced motion the phone and features
// stand still below the desk, the phone showing that appearance's iOS capture alone.
async function assertHomeTurn(page, mode, context) {
  const moving = await page.evaluate(() => document.documentElement.hasAttribute('data-keynote'));

  if (!moving) {
    const still = await page.evaluate(() => ({
      features: [...document.querySelectorAll('.turn-still-features li')].filter(
        (item) => item.getBoundingClientRect().height > 0,
      ).length,
      shown: [...document.querySelectorAll('.turn-still .home-phone-shot')].flatMap((image) =>
        getComputedStyle(image).display === 'none' ? [] : [image.dataset.theme],
      ),
    }));

    assert.deepEqual(
      still.shown,
      [mode.theme],
      `${context}: the still phone must show the ${mode.theme} capture alone`,
    );
    assert.equal(still.features, 6, `${context}: all six features must stand beside the phone`);

    return;
  }

  const end = await page.evaluate(() => {
    const track = document.querySelector('.turn');
    const stage = document.querySelector('.turn-stage');

    return (
      track.getBoundingClientRect().top + window.scrollY + track.offsetHeight - stage.offsetHeight
    );
  });

  await page.evaluate((top) => window.scrollTo({ behavior: 'instant', top }), end);
  await page.waitForFunction(
    () => Number(document.querySelector('.turn-stage')?.dataset.frame) === 719,
    null,
    { timeout: 5_000 },
  );

  const state = await page.evaluate(() => ({
    desk: Boolean(document.querySelector('.turn-desk .desk-screen')),
    features: [...document.querySelectorAll('.turn-player [data-feature]')].length,
    images: [...document.querySelectorAll('.turn-player img')].map(
      (image) => new URL(image.src).pathname,
    ),
    livePhone: Boolean(document.querySelector('.turn-player .turn-phone [role="switch"]')),
    screen: document.querySelector('.turn-player .turn-phone')?.dataset.theme,
  }));

  assert.ok(
    state.desk &&
      state.livePhone &&
      state.screen === mode.theme &&
      state.images.includes(`/keynote/phone-wallpaper-${mode.theme}.webp`),
    `${context}: the turn must retain its live desk and show the ${mode.theme} live phone`,
  );
  assert.equal(state.features, 6, `${context}: the turn must bring in all six features`);
  await page.evaluate(() => window.scrollTo({ behavior: 'instant', top: 0 }));
}

// What a visitor from GitHub, a search engine or a language model finds. Every GitHub link goes
// to this one repository, the footer and the docs rail offer ways to help, the structured data
// parses, and llms.txt lists every page of the library with a link that works.
async function assertLaunchLinks() {
  const repository = 'https://github.com/alexburlis/glassyui';
  const site = 'https://glassyui.com';
  const browserContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await browserContext.newPage();
  await configureMode(page, modes[2]);

  const githubLinks = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('a[href*="github.com"]')].map((link) => link.href),
    );

  const structuredData = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('script[type="application/ld+json"]')].map((script) =>
        JSON.parse(script.textContent),
      ),
    );

  await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });

  const header = page.getByRole('banner').getByRole('link', { name: 'GitHub', exact: true });
  assert.equal(await header.getAttribute('href'), repository, 'the header links to the repository');

  const project = page.getByRole('navigation', { name: 'Project' });

  for (const [name, href] of [
    ['GitHub', repository],
    ['Report an issue', `${repository}/issues/new?template=bug_report.yml`],
    ['Contributing', `${repository}/blob/main/CONTRIBUTING.md`],
    ['Changelog', `${repository}/blob/main/CHANGELOG.md`],
    ['MIT license', `${repository}/blob/main/LICENSE`],
    ['Security', `${repository}/blob/main/SECURITY.md`],
    ['Registry JSON', '/r/registry.json'],
    ['llms.txt', '/llms.txt'],
  ]) {
    assert.equal(
      await project.getByRole('link', { name, exact: true }).getAttribute('href'),
      href,
      `the footer's project links must include ${name}`,
    );
  }

  const cta = page.getByRole('region', { name: 'Start with one component.' });
  assert.equal(
    await cta.getByRole('link', { name: /Star on GitHub/ }).getAttribute('href'),
    repository,
    'the closing call to action links to the repository',
  );

  // The demos on the home page and in the gallery are pictures of components: a warning in one
  // must not be read out as if it had just happened to the page.
  for (const path of ['/', '/components']) {
    await page.goto(new URL(path, baseUrl).href, { waitUntil: 'networkidle' });

    const height = await page.evaluate(() => document.documentElement.scrollHeight);

    for (let y = 0; y < height; y += 600) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(80);
    }

    // Next's own route announcer is an alert, and the only one there should be.
    assert.equal(
      await page.locator('[role="alert"]:not(#__next-route-announcer__)').count(),
      0,
      `${path}: no demo interrupts a screen reader`,
    );

    // The home page's breadcrumb is a picture of one; none of its steps is the page you are on.
    if (path === '/') {
      const trail = page.locator('.component-card nav[aria-label="Breadcrumb"]');

      assert.equal(await trail.count(), 1, 'the home page shows a breadcrumb');
      assert.equal(
        await trail.locator('[aria-current]').count(),
        0,
        'the home page breadcrumb does not claim to be the current page',
      );
    }
  }

  await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });

  const home = await structuredData();
  assert.equal(home.length, 1, 'the home page carries one block of structured data');
  assert.equal(home[0]['@type'], 'WebSite', 'the home page describes the website');
  assert.equal(home[0].url, site, 'the website is named by its address');

  for (const link of await githubLinks()) {
    assert.ok(link.startsWith(repository), `every GitHub link goes to the repository (${link})`);
  }

  await page.goto(new URL('/components/glass-toast', baseUrl).href, { waitUntil: 'networkidle' });

  const rail = page.getByRole('complementary', { name: 'On this page' });

  const issue = new URL(
    await rail.getByRole('link', { name: 'Report an issue' }).getAttribute('href'),
  );

  assert.equal(
    issue.origin + issue.pathname,
    `${repository}/issues/new`,
    "the issue form is the repository's",
  );
  assert.equal(issue.searchParams.get('template'), 'bug_report.yml', 'it opens the bug template');
  assert.equal(issue.searchParams.get('title'), '[Bug]: Glass Toast: ', 'it names the component');
  assert.ok(
    (await rail.getByRole('link', { name: 'Request a component' }).getAttribute('href')).includes(
      'template=component_request.yml',
    ),
    'the rail offers the component request form',
  );
  assert.equal(
    await rail.getByRole('link', { name: 'View source' }).getAttribute('href'),
    `${repository}/blob/main/registry/glassyui/glass-toast.tsx`,
    'the rail links to the component source',
  );
  assert.equal(
    await page.locator('a[href*="/discussions"]').count(),
    0,
    'nothing links to GitHub Discussions, which this repository does not use',
  );

  const crumbs = (await structuredData()).find((data) => data['@type'] === 'BreadcrumbList');
  assert.ok(crumbs, 'a component page carries breadcrumb data');
  assert.deepEqual(
    crumbs.itemListElement.map((entry) => [entry.position, entry.name, entry.item]),
    [
      [1, 'Glassy UI', site],
      [2, 'Components', `${site}/components`],
      [3, 'Glass Toast', `${site}/components/glass-toast`],
    ],
    'the breadcrumbs lead from the home page to the component',
  );

  for (const link of await githubLinks()) {
    assert.ok(link.startsWith(repository), `every GitHub link goes to the repository (${link})`);
  }

  await browserContext.close();

  const fetchText = async (path) => {
    const response = await fetch(new URL(path, baseUrl));
    assert.equal(response.status, 200, `${path} must answer`);

    return { text: await response.text(), type: response.headers.get('content-type') ?? '' };
  };

  const summary = await fetchText('/llms.txt');
  assert.match(summary.type, /^text\/plain/, 'llms.txt is plain text');
  assert.ok(summary.text.startsWith('# Glassy UI\n'), 'llms.txt opens with the project name');
  assert.match(summary.text, /^> .+/m, 'llms.txt summarises the project');

  for (const id of components) {
    assert.ok(summary.text.includes(`](${site}/components/${id}):`), `llms.txt lists ${id}`);
  }

  // Every page it lists answers on this server, not just on the public one.
  const listed = [...summary.text.matchAll(/\]\((https:\/\/glassyui\.com[^)]*)\)/g)].map(
    (match) => match[1].slice(site.length) || '/',
  );

  assert.ok(listed.length > components.length, 'llms.txt lists the docs as well as the components');

  for (const path of new Set(listed)) {
    const response = await fetch(new URL(path, baseUrl), { method: 'HEAD' });
    assert.equal(response.status, 200, `llms.txt lists ${path}, which must answer`);
  }

  const full = await fetchText('/llms-full.txt');
  assert.match(full.type, /^text\/plain/, 'llms-full.txt is plain text');

  for (const id of components) {
    assert.ok(
      full.text.includes(`@glassyui/${id}`),
      `llms-full.txt carries the install command for ${id}`,
    );
  }

  assert.ok(full.text.includes('```tsx'), 'llms-full.txt carries code');
  assert.ok(
    full.text.length > 30_000,
    `llms-full.txt carries the documentation (${full.text.length} characters)`,
  );

  const robots = await fetchText('/robots.txt');
  assert.ok(!/disallow:\s*\/llms/i.test(robots.text), 'robots.txt lets crawlers read llms.txt');
}

// axe skips text it cannot resolve a background for, and text inside a closed <details>. The site's
// own text (navigation, headings, chips, code, lists of files) sits on flat fills, so its contrast
// can be computed: every piece of it, with the details open, must reach WCAG AA. Text inside library
// components is held to its own contract by check:glass-material and the component contracts.
async function assertSiteTextContrast() {
  const paths = [
    '/',
    '/components',
    '/components/glass-toast',
    '/components/glass-select',
    '/docs',
    '/guides/shadcn',
    '/imprint',
    '/privacy',
  ];

  for (const [theme, width] of [
    ['light', 1280],
    ['dark', 1280],
    ['light', 390],
    ['dark', 390],
  ]) {
    const context = await browser.newContext({
      colorScheme: theme,
      viewport: { width, height: 900 },
    });

    const page = await context.newPage();
    await configureMode(page, { name: `${theme}-normal`, theme, transparency: '0' });

    for (const path of paths) {
      await page.goto(new URL(path, baseUrl).href, { waitUntil: 'networkidle' });
      await page.evaluate(() =>
        document.querySelectorAll('details').forEach((node) => (node.open = true)),
      );

      const height = await page.evaluate(() => document.documentElement.scrollHeight);

      for (let y = 0; y < height; y += 700) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(40);
      }

      await page.evaluate(() => window.scrollTo(0, 0));

      const short = await page.evaluate(() => {
        const parse = (value) => {
          const match = value.match(/rgba?\(([^)]+)\)/);

          if (!match) return null;

          const [r, g, b, a = 1] = match[1]
            .split(/[ ,/]+/)
            .filter(Boolean)
            .map(Number);

          return { a, b, g, r };
        };

        const over = (top, under) => {
          const a = top.a + under.a * (1 - top.a);

          if (a === 0) return { a: 0, b: 0, g: 0, r: 0 };

          const mix = (key) => (top[key] * top.a + under[key] * under.a * (1 - top.a)) / a;

          return { a, b: mix('b'), g: mix('g'), r: mix('r') };
        };

        const luminance = ({ b, g, r }) => {
          const channel = (value) => {
            const unit = value / 255;

            return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
          };

          return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        };

        const ratio = (first, second) => {
          const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a);

          return (high + 0.05) / (low + 0.05);
        };

        const white = { a: 1, b: 255, g: 255, r: 255 };

        const page = over(
          parse(getComputedStyle(document.documentElement).backgroundColor) ?? white,
          white,
        );

        const bodyFill = parse(getComputedStyle(document.body).backgroundColor);
        const canvas = bodyFill && bodyFill.a > 0 ? over(bodyFill, page) : page;
        const found = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node.textContent.trim();
          const element = node.parentElement;

          if (!text || !element) continue;

          const box = element.getBoundingClientRect();
          const style = getComputedStyle(element);

          if (box.width === 0 || box.height === 0 || style.visibility === 'hidden') continue;

          // Text inside a library component is checked by that component's own contract, and the
          // skip link is off screen until it is focused.
          if (
            element.closest(
              'script, style, svg, canvas, .lg-visually-hidden, .skip-link, [class*="lg-"]',
            )
          )
            continue;

          const chain = [];

          for (let current = element; current; current = current.parentElement) chain.push(current);

          let opacity = 1;
          let fill = { a: 0, b: 0, g: 0, r: 0 };
          let unknown = false;

          for (const current of chain) opacity *= Number(getComputedStyle(current).opacity);

          for (const current of chain.reverse()) {
            const own = getComputedStyle(current);
            const glass = own.backdropFilter && own.backdropFilter !== 'none';

            if (own.backgroundImage !== 'none' || glass) {
              unknown = true;
              fill = { a: 0, b: 0, g: 0, r: 0 };
            }

            const colour = parse(own.backgroundColor);

            if (colour && colour.a > 0) fill = over(colour, fill);
          }

          if (unknown) continue;

          const ground = over(fill, canvas);
          const ink = parse(style.color);

          if (!ink) continue;

          const shown = over({ ...ink, a: ink.a * opacity }, ground);
          const size = parseFloat(style.fontSize);
          const large = size >= 24 || (Number(style.fontWeight) >= 700 && size >= 18.66);
          const measured = ratio(shown, ground);

          if (measured < (large ? 3 : 4.5) - 0.005) {
            found.push(
              `${element.tagName.toLowerCase()}.${String(element.className).split(' ')[0]} "${text.slice(0, 30)}" ${measured.toFixed(2)}:1`,
            );
          }
        }

        return [...new Set(found)];
      });

      assert.deepEqual(short, [], `${theme} ${width}px ${path}: text below WCAG AA contrast`);
    }

    await context.close();
  }
}

// A first-time visitor gets light whatever their system prefers, in every engine. The server's
// markup already says so, a choice made with the header toggle sticks across a reload, and the
// system setting never overrides either.
async function assertDefaultTheme() {
  const storageKey = preferenceStorageKey;

  for (const [engineName, engine] of [
    ['chromium', chromium],
    ['firefox', firefox],
    ['webkit', webkit],
  ]) {
    const engineBrowser = engine === chromium ? browser : await engine.launch({ headless: true });

    try {
      for (const system of ['dark', 'light']) {
        const context = await engineBrowser.newContext({
          colorScheme: system,
          viewport: { width: 1280, height: 900 },
        });

        try {
          const page = await context.newPage();
          const label = `${engineName} on a ${system} system`;
          const theme = () => page.locator('html').getAttribute('data-lg-theme');
          console.log(`Release UI: default theme, ${label}.`);
          page.on('pageerror', (error) => console.error(`${label}: ${error.message}`));

          const chooseTheme = async (next) => {
            const observation = await page.evaluateHandle(() => {
              const started = performance.now();
              const mutations = [];

              const observer = new MutationObserver(() => {
                mutations.push({
                  theme: document.documentElement.getAttribute('data-lg-theme'),
                  elapsed: performance.now() - started,
                });
              });

              observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['data-lg-theme'],
              });

              return { started, mutations, disconnect: () => observer.disconnect() };
            });

            try {
              await page.getByRole('button', { name: 'Change appearance' }).click();
              await observation.evaluate((state) => {
                state.clickedAt = performance.now() - state.started;
              });
              // GTK view-transition snapshots can block the page beyond two seconds.
              await page.waitForFunction(
                (theme) => document.documentElement.getAttribute('data-lg-theme') === theme,
                next,
                { timeout: 15_000, polling: 50 },
              );
            } catch (error) {
              const state = await page.evaluate(
                (key) => ({
                  theme: document.documentElement.getAttribute('data-lg-theme'),
                  saved: window.localStorage.getItem(key),
                  visibility: document.visibilityState,
                  intro: document.documentElement.hasAttribute('data-keynote-intro'),
                  viewTransitions: 'startViewTransition' in document,
                }),
                storageKey,
              );

              const observationState = await observation.evaluate((state) => ({
                mutations: state.mutations,
                clickedAt: state.clickedAt,
              }));

              const prefix = `default-theme-${engineName}-${system}-${next}`;

              fs.writeFileSync(
                path.join(artifactDirectory, `${prefix}.json`),
                `${JSON.stringify({ label, next, error: error.message, state, observation: observationState }, null, 2)}\n`,
              );
              console.error(
                `${label}: failed to choose ${next}; ${JSON.stringify({ state, observation: observationState })}`,
              );

              try {
                await page.screenshot({
                  path: path.join(artifactDirectory, `${prefix}.png`),
                  timeout: 15_000,
                });
              } catch (captureError) {
                console.error(`${label}: failure screenshot unavailable: ${captureError.message}`);
              }

              throw error;
            } finally {
              await observation.evaluate((state) => state.disconnect());
              await observation.dispose();
            }
          };

          const markup = await (await context.request.get(new URL('/', baseUrl).href)).text();
          assert.match(
            markup,
            /<html[^>]*data-lg-theme="light"/,
            `${label}: the server must render light`,
          );

          await page.goto(new URL('/', baseUrl).href, { waitUntil: 'domcontentloaded' });
          assert.equal(await theme(), 'light', `${label}: the first paint must be light`);

          await page.waitForLoadState('networkidle');
          assert.equal(await theme(), 'light', `${label}: hydration must keep light`);
          assert.equal(
            await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
            'rgb(250, 249, 247)',
            `${label}: the page must be painted light`,
          );
          assert.equal(
            await page.evaluate((key) => window.localStorage.getItem(key), storageKey),
            null,
            `${label}: the default must not be saved for the visitor`,
          );

          // The system changing its mind is not a choice.
          await page.emulateMedia({ colorScheme: system === 'dark' ? 'light' : 'dark' });
          await page.waitForTimeout(300);
          assert.equal(
            await theme(),
            'light',
            `${label}: a system change must not override the default`,
          );

          // Choosing dark with the header toggle sticks, including before scripts run after a reload.
          await landHome(page);
          // With motion the page crossfades into the new theme, which lands on the next frame.
          await chooseTheme('dark');
          assert.equal(await theme(), 'dark', `${label}: the toggle must switch to dark`);
          assert.deepEqual(
            JSON.parse(await page.evaluate((key) => window.localStorage.getItem(key), storageKey)),
            { theme: 'dark' },
            `${label}: the choice must be saved`,
          );
          await page.reload({ waitUntil: 'domcontentloaded' });
          assert.equal(await theme(), 'dark', `${label}: a saved dark must paint dark on reload`);
          await page.waitForLoadState('networkidle');
          assert.equal(await theme(), 'dark', `${label}: hydration must keep a saved dark`);

          await landHome(page);
          // With motion the page crossfades into the new theme, which lands on the next frame.
          await chooseTheme('light');
          assert.equal(await theme(), 'light', `${label}: the toggle must switch back to light`);
        } finally {
          await context.close();
        }
      }
    } finally {
      if (engineBrowser !== browser) await engineBrowser.close();
    }
  }
}

// The header search is built from GlassCommandDialog. It opens from the pill and ⌘K / Ctrl K, with
// no single-key shortcut (WCAG 2.1.4); it finds by title, tells a screen reader how many results
// it found, opens the page you choose and hands focus back when it closes.
async function assertSiteSearch() {
  for (const [width, mode] of [
    [1280, modes[0]],
    [390, modes[2]],
  ]) {
    const browserContext = await browser.newContext({ viewport: { width, height: 900 } });
    await browserContext.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: new URL(baseUrl).origin,
    });
    const page = await browserContext.newPage();
    await configureMode(page, mode);
    await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });
    await landHome(page);
    const context = `${width}px ${mode.name} site search`;

    const pill = await exactlyOne(
      page.getByRole('banner').getByRole('button', { name: 'Search', exact: true }),
      'header search button',
    );

    await pill.click();

    const dialog = await exactlyOne(
      page.getByRole('dialog', { name: 'Search Glassy UI' }),
      'search dialog',
    );

    await dialog.waitFor({ state: 'visible' });
    const input = await exactlyOne(dialog.getByRole('combobox'), 'search field');
    await page.waitForFunction(
      (node) => document.activeElement === node,
      await input.elementHandle(),
      {
        timeout: 2_000,
      },
    );
    // The list is fetched the first time the search opens.
    await dialog.getByRole('option', { name: /^Checkbox/ }).waitFor({ state: 'visible' });
    await runAxe(page, `${context} open`, '[role="dialog"]');

    // What a screen reader hears is a live region that was already there, not one that appears.
    const heard = dialog.getByRole('status');

    assert.equal(await heard.count(), 1, `${context}: the search has one live region`);
    assert.equal(
      (await heard.textContent()).trim(),
      '',
      `${context}: it says nothing before a query`,
    );

    await page.keyboard.type('pagi');
    assert.equal(await dialog.getByRole('option').count(), 1, 'typing "pagi" leaves one result');
    await exactlyOne(dialog.getByRole('option', { name: /^Pagination/ }), 'the Pagination result');
    await expectText(heard, '1 result.', `${context}: one result is announced`);
    await input.fill('avatar');
    await exactlyOne(dialog.getByRole('option', { name: /^Avatar/ }), 'a title match ranks');
    await input.fill('zzzzzz');
    await exactlyOne(dialog.getByText('No results.', { exact: true }).first(), 'the empty state');
    await expectText(heard, 'No results.', `${context}: an empty list is announced`);
    await input.fill('dark');
    await dialog
      .getByRole('option', { name: /Switch to (dark|light)/ })
      .first()
      .waitFor({ state: 'visible' });

    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    await assertFocusReturned(page, pill, `${context} after Escape`);

    // Copying the install command says so, then closes.
    await pill.click();
    await dialog.waitFor({ state: 'visible' });
    await input.fill('install');
    await dialog.getByRole('option', { name: 'Copy the install command' }).click();

    // The write finishes a moment after the click, so wait for the item to say so.
    const copied = dialog.getByRole('option', { name: 'Copied to the clipboard' });

    await copied.waitFor({ state: 'visible', timeout: 2_000 });
    await exactlyOne(copied, 'the copy confirmation');

    // It is announced from outside the dialog, which closes a moment later.
    await page
      .getByRole('banner')
      .getByRole('status')
      .filter({ hasText: 'Copied the install command' })
      .waitFor({ state: 'attached', timeout: 2_000 });
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      'pnpm dlx shadcn@4.14.1 add @glassyui/glass-button',
      'the search must copy the same command the home page offers',
    );

    await dialog.waitFor({ state: 'detached' });

    // Opening the search again starts from the label, not the last confirmation.
    await pill.click();
    await dialog.waitFor({ state: 'visible' });
    await input.fill('install');
    await exactlyOne(
      dialog.getByRole('option', { name: 'Copy the install command' }),
      'the copy item after reopening',
    );
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });

    if (width >= 1024) {
      // A bare key must never open it: a shortcut of one character has to be switchable off.
      await page.locator('body').click({ position: { x: 5, y: 300 } });
      await page.keyboard.press('/');
      await page.waitForTimeout(300);
      assert.equal(await dialog.count(), 0, 'a slash must not open the search');
      await page.keyboard.press('Control+k');
      await dialog.waitFor({ state: 'visible' });
      await page.keyboard.press('Control+k');
      await dialog.waitFor({ state: 'detached' });
    }

    if (width >= 1024) {
      // The server draws the command key; a browser elsewhere swaps in Ctrl after it hydrates. The
      // header must not move when it does.
      const linux =
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

      const measure = async (javaScriptEnabled) => {
        const other = await browser.newContext({
          javaScriptEnabled,
          userAgent: linux,
          viewport: { width: 1280, height: 900 },
        });

        const tab = await other.newPage();
        await tab.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });

        const result = await tab.evaluate(() => ({
          keys: document.querySelector('.site-search-keys')?.textContent,
          left: Math.round(
            document.querySelector('.site-nav .lg-header-links a').getBoundingClientRect().left,
          ),
        }));

        await other.close();

        return result;
      };

      const served = await measure(false);
      const hydrated = await measure(true);

      assert.equal(served.keys, '⌘K', 'the server draws the command key');
      assert.equal(hydrated.keys, 'CtrlK', 'another system gets Ctrl once it hydrates');
      assert.ok(
        Math.abs(served.left - hydrated.left) <= 1,
        `the header must not move when Ctrl replaces the command key (${served.left}px then ${hydrated.left}px)`,
      );
    }

    if (width >= 1024) {
      // A list that fails to load says so, keeps the pages, and loads on the next opening.
      const failing = await browserContext.newPage();
      await failing.route('**/search-index.json', (route) => route.abort());
      await failing.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });
      await landHome(failing);
      await failing
        .getByRole('banner')
        .getByRole('button', { name: 'Search', exact: true })
        .click();

      const failingDialog = failing.getByRole('dialog', { name: 'Search Glassy UI' });
      const failedNote = failingDialog.getByRole('status').filter({ hasText: 'did not load' });

      await failedNote.waitFor();
      await exactlyOne(
        failingDialog.getByRole('option', { name: /^Getting started/ }),
        'the pages still list',
      );
      assert.equal(
        await failingDialog.getByRole('option', { name: /^Checkbox/ }).count(),
        0,
        'no components without the list',
      );
      await failing.keyboard.press('Escape');
      await failingDialog.waitFor({ state: 'detached' });
      await failing.unroute('**/search-index.json');
      await failing
        .getByRole('banner')
        .getByRole('button', { name: 'Search', exact: true })
        .click();
      await failingDialog.getByRole('option', { name: /^Checkbox/ }).waitFor({ state: 'visible' });
      assert.equal(await failedNote.count(), 0, 'the note goes once the list loads');
      await failing.close();
    }

    if (width >= 1024) {
      // The desk's Go menu opens the same search, and focus returns to the menu that asked.
      const go = await exactlyOne(
        page.locator('.home-desk').getByRole('button', { name: 'Go', exact: true }),
        'desk Go menu',
      );

      await go.scrollIntoViewIfNeeded();

      // A slow frame must not let the search open before the menu has handed focus back.
      const cdp = await browserContext.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
      await go.click();
      await page.getByRole('menuitem', { name: /^Search…/ }).click();
      await dialog.waitFor({ state: 'visible' });
      assert.equal(
        await page.getByRole('menu').count(),
        0,
        'the menu is gone when the search opens',
      );
      await page.waitForFunction(
        (node) => document.activeElement === node,
        await input.elementHandle(),
        { timeout: 2_000 },
      );
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      await assertFocusReturned(page, go, `${context} opened from the desk menu`);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    }

    await pill.click();
    await dialog.waitFor({ state: 'visible' });
    await page.keyboard.type('pagi');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/components/glass-pagination');
    await exactlyOne(
      page.getByRole('heading', { name: 'Glass Pagination', level: 1 }),
      'the page it opens',
    );
    await assertBodyInteractive(page, `${context} after choosing a result`);
    await browserContext.close();
  }
}

// The gallery shares the docs sidebar: the same links, in the same place, as a component page, so
// moving between them does not shift the page. Nothing else sticks under the header.
async function assertGallerySidebar() {
  const browserContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await browserContext.newPage();
  await configureMode(page, modes[0]);

  const readSidebar = async (route) => {
    await page.goto(new URL(route, baseUrl).href, { waitUntil: 'networkidle' });

    const sidebar = await exactlyOne(
      page.getByRole('complementary', { name: 'Documentation' }),
      `${route} sidebar`,
    );

    return {
      box: await sidebar.boundingBox(),
      current: await sidebar
        .locator('[aria-current="page"]')
        .evaluateAll((nodes) => nodes.map((node) => node.textContent.trim())),
      links: await sidebar
        .getByRole('link')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href'))),
      sidebar,
    };
  };

  const article = await readSidebar('/components/glass-button');
  const gallery = await readSidebar('/components');

  assert.deepEqual(gallery.links, article.links, "the gallery lists a component page's links");

  for (const id of components)
    assert.ok(gallery.links.includes(`/components/${id}`), `the gallery sidebar links ${id}`);

  assert.deepEqual(gallery.current, ['All components'], 'the gallery marks itself current');
  assert.ok(
    ['x', 'y', 'width'].every((key) => Math.abs(gallery.box[key] - article.box[key]) < 1),
    `the sidebar must not move between the gallery and a component page (${JSON.stringify({
      article: article.box,
      gallery: gallery.box,
    })})`,
  );
  assert.equal(
    await page.getByRole('navigation', { name: 'Categories' }).count(),
    0,
    'the gallery has no chapter bar',
  );

  await page.evaluate(() => window.scrollTo(0, 2600));
  await page.waitForTimeout(300);

  const top = await gallery.sidebar.evaluate((node) =>
    Math.round(node.getBoundingClientRect().top),
  );

  assert.equal(top, 84, `the sidebar must stick under the header (top ${top})`);

  // A control scrolled into view for focus stops below the header, not behind it.
  const control = page.locator('.components-category .component-card-stage button').first();

  await control.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const target = document.querySelector('.components-category .component-card-stage button');

    window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY - 20);
  });
  await control.focus();

  const focusedTop = await control.evaluate((node) => Math.round(node.getBoundingClientRect().top));

  const headerBottom = await page
    .getByRole('banner')
    .evaluate((node) => Math.round(node.getBoundingClientRect().bottom));

  assert.ok(
    focusedTop >= headerBottom,
    `a focused control must not sit behind the header (top ${focusedTop}px, header ${headerBottom}px)`,
  );
  await browserContext.close();

  // Below 860 px the sidebar folds into the Browse docs menu, which names the gallery. From 860 px
  // it sits beside the cards. Neither may push the page sideways.
  for (const width of [320, 390, 768, 860]) {
    const narrowContext = await browser.newContext({ viewport: { width, height: 800 } });
    const narrow = await narrowContext.newPage();
    await configureMode(narrow, modes[2]);
    await narrow.goto(new URL('/components', baseUrl).href, { waitUntil: 'networkidle' });

    const label = `${width}px gallery`;
    const folded = width < 860;
    const menu = narrow.locator('details.docs-mobile-nav');

    assert.equal(
      await narrow.getByRole('complementary', { name: 'Documentation' }).isVisible(),
      !folded,
      `${label}: the sidebar must ${folded ? 'fold into the menu' : 'show'}`,
    );
    assert.equal(await menu.isVisible(), folded, `${label}: the Browse docs menu`);

    if (folded)
      assert.match(
        await menu.locator('summary').innerText(),
        /Components$/,
        `${label}: the menu names the gallery`,
      );

    assert.equal(
      await narrow.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      `${label}: the page must not scroll sideways`,
    );
    await narrowContext.close();
  }
}

// Deactivating moves as well as activating does: nothing that opens, expands or appears may
// vanish in a single frame. Each closes while its size, position or opacity is sampled.
async function assertExitMotion() {
  const browserContext = await browser.newContext({
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
    viewport: { width: 1280, height: 900 },
  });

  await browserContext.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: new URL(baseUrl).origin,
  });

  const page = await browserContext.newPage();
  await page.addInitScript(
    ({ storageKey }) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ theme: 'dark', reduceMotion: false, reduceTransparency: false }),
      );
    },
    { storageKey: preferenceStorageKey },
  );

  // Seek the component's real exit effect; CI scheduling must not decide whether it animates.
  const closingFrames = async (selector, measure, timeout = 1500, openTimeout = timeout) => {
    const watcher = await page.evaluateHandle(
      ({ selector, measure, timeout, openTimeout }) => {
        const result = new Promise((resolve) => {
          const start = performance.now();
          const initial = document.querySelector(selector);

          if (!initial) throw new Error(`Missing closing element: ${selector}`);
          const closingAtStart = ['closed', 'folding'].includes(initial.getAttribute('data-state'));
          let closingStart = closingAtStart ? start : null;
          const tested = new Set(closingAtStart ? [] : initial.getAnimations());
          const seen = new Set();
          const animations = [];
          let frames = 0;
          let interpolatedStates = 0;

          const read = (node) => {
            const style = getComputedStyle(node);
            const rect = node.getBoundingClientRect();

            if (
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              Number(style.opacity) === 0 ||
              rect.width === 0 ||
              rect.height === 0
            )
              return null;

            return measure === 'size'
              ? `${Math.round(rect.height)}|${style.opacity}`
              : `${style.opacity}|${style.scale}|${style.translate}|${style.transform}|${Math.round(rect.top)}|${Math.round(rect.left)}`;
          };

          const sample = () => {
            const node = document.querySelector(selector);

            if (!node || !['closed', 'folding'].includes(node.getAttribute('data-state'))) return;
            closingStart ??= performance.now();

            for (const animation of node.getAnimations()) {
              if (tested.has(animation) || animation.playState !== 'running') continue;
              tested.add(animation);
              const timing = animation.effect.getComputedTiming();

              if (!(timing.activeDuration > 0 && Number.isFinite(timing.activeDuration))) continue;
              const time = animation.currentTime ?? 0;
              const states = [];

              try {
                animation.pause();

                for (const fraction of [0.25, 0.5, 0.75]) {
                  animation.currentTime = timing.delay + timing.activeDuration * fraction;
                  states.push(read(node));
                }
              } finally {
                animation.currentTime = time;
                animation.play();
              }

              interpolatedStates = Math.max(
                interpolatedStates,
                new Set(states.filter((state) => state !== null)).size,
              );
              animations.push({
                name: animation.animationName ?? animation.transitionProperty,
                duration: timing.activeDuration,
                states,
              });
            }
          };

          const observer = new MutationObserver(sample);
          observer.observe(initial, { attributes: true });

          const tick = () => {
            const node = document.querySelector(selector);

            if (
              !node ||
              performance.now() >
                (closingStart === null ? start + openTimeout : closingStart + timeout)
            ) {
              observer.disconnect();
              resolve({ frames, changes: seen.size, interpolatedStates, animations, gone: !node });

              return;
            }

            sample();
            frames += 1;
            seen.add(read(node));
            requestAnimationFrame(tick);
          };

          requestAnimationFrame(tick);
        });

        return { result };
      },
      { selector, measure, timeout, openTimeout },
    );

    return {
      result: watcher.evaluate(({ result }) => result).finally(() => watcher.dispose()),
    };
  };

  const measurements = [];

  const expectExit = (name, result) => {
    measurements.push({ name, ...result });
    fs.writeFileSync(
      path.join(artifactDirectory, 'exit-motion.json'),
      JSON.stringify(measurements, null, 2) + '\n',
    );
    assert.equal(result.gone, true, `${name} must finish closing`);
    assert.ok(
      result.interpolatedStates >= 3,
      `${name} must animate out, not vanish (${result.interpolatedStates} interpolated states; ${result.frames} observed frames)`,
    );
  };

  const overlays = [
    ['glass-dialog', 'Open dialog', '[role="dialog"]'],
    ['glass-popover', 'Open popover', '[role="dialog"]'],
    ['glass-sheet', 'Open sheet', '[role="dialog"]'],
    ['glass-menu', 'Options', '[role="menu"]'],
    ['glass-command', 'Open command menu', '[role="dialog"]'],
    ['glass-select', 'Framework', '[role="listbox"]', 'combobox'],
  ];

  for (const [id, label, selector, role = 'button'] of overlays) {
    await page.goto(new URL(`/components/${id}`, baseUrl).href, { waitUntil: 'networkidle' });
    await demo(page, id).getByRole(role, { name: label }).click();
    await page.locator(selector).first().waitFor({ state: 'visible' });
    await page.waitForTimeout(600);

    const closing = await closingFrames(selector, 'motion');
    await page.keyboard.press('Escape');
    expectExit(id, await closing.result);
  }

  await page.goto(new URL('/components/glass-tooltip', baseUrl).href, { waitUntil: 'networkidle' });
  await demo(page, 'glass-tooltip').getByRole('button', { name: 'Show tooltip' }).hover();
  await page.locator('.lg-tooltip-content').first().waitFor({ state: 'visible' });
  await page.waitForTimeout(500);

  const tipClosing = await closingFrames('.lg-tooltip-content', 'motion');
  await page.keyboard.press('Escape');
  expectExit('glass-tooltip', await tipClosing.result);

  await page.goto(new URL('/components/glass-toast', baseUrl).href, { waitUntil: 'networkidle' });
  await demo(page, 'glass-toast').getByRole('button', { name: 'Show toast' }).click();
  await page.locator('.lg-toast[data-state="open"]').first().waitFor();
  await page.waitForTimeout(600);

  const toastClosing = await closingFrames('.lg-toast', 'motion');
  await page.locator('.lg-toast-close').first().click();
  expectExit('glass-toast', await toastClosing.result);

  // A swipe drags the toast along and a long one sends it away.
  await demo(page, 'glass-toast').getByRole('button', { name: 'Show toast' }).click();

  const swiped = await exactlyOne(
    page.locator('.lg-toast[data-state="open"]'),
    'GlassToast to swipe',
  );

  await page.waitForTimeout(600);

  const box = await swiped.boundingBox();
  assert.ok(box, 'the toast must render a box');
  await page.mouse.move(box.x + 100, box.y + 30);
  await page.mouse.down();

  for (let step = 1; step <= 3; step += 1)
    await page.mouse.move(box.x + 100 + step * 8, box.y + 30);

  assert.equal(
    await swiped.evaluate((node) => getComputedStyle(node).translate),
    '24px',
    'a swiped toast must follow the pointer',
  );
  await page.mouse.up();
  await page.waitForFunction(
    (node) =>
      getComputedStyle(node).translate === '0px' || getComputedStyle(node).translate === 'none',
    await swiped.elementHandle(),
    { timeout: 2_000 },
  );

  const dragged = await swiped.boundingBox();
  await page.mouse.move(dragged.x + 100, dragged.y + 30);
  await page.mouse.down();

  for (let step = 1; step <= 8; step += 1)
    await page.mouse.move(dragged.x + 100 + step * 24, dragged.y + 30);

  await page.mouse.up();
  await swiped.waitFor({ state: 'detached', timeout: 3_000 });

  await page.goto(new URL('/components/glass-accordion', baseUrl).href, {
    waitUntil: 'networkidle',
  });

  const trigger = demo(page, 'glass-accordion').locator('.lg-accordion-trigger').first();
  await trigger.click();
  await page.locator('[role="region"]').first().waitFor({ state: 'visible' });
  await page.waitForTimeout(600);

  const accordionClosing = await closingFrames(
    '[data-release-demo="glass-accordion"] [role="region"]',
    'size',
  );

  await trigger.click();
  expectExit('glass-accordion', await accordionClosing.result);

  await page.goto(new URL('/components/glass-alert', baseUrl).href, { waitUntil: 'networkidle' });

  const alertClosing = await closingFrames(
    '[data-release-demo="glass-alert"] .lg-alert-fold:has(.lg-alert[data-tone="danger"])',
    'size',
    2500,
  );

  await demo(page, 'glass-alert').getByRole('button', { name: 'Dismiss' }).click();
  expectExit('glass-alert', await alertClosing.result);

  // The header search says it copied the install command and then fades out. The item must keep
  // saying so while the dialog fades, not go back to its label for the last few frames.
  await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });
  await landHome(page);
  await page.getByRole('banner').getByRole('button', { name: 'Search', exact: true }).click();

  const searchDialog = page.getByRole('dialog', { name: 'Search Glassy UI' });

  await searchDialog.getByRole('combobox').fill('install');
  const searchClosing = await closingFrames('[role="dialog"]', 'motion', 1500, 3000);
  await searchDialog.getByRole('option', { name: 'Copy the install command' }).click();
  await searchDialog
    .getByRole('option', { name: 'Copied to the clipboard' })
    .waitFor({ state: 'visible', timeout: 2_000 });

  const said = [];

  while ((await searchDialog.count()) > 0) {
    said.push(...(await searchDialog.getByRole('option').allTextContents()));
    await page.waitForTimeout(40);
  }

  expectExit('site search', await searchClosing.result);
  assert.ok(said.includes('Copied to the clipboard'), 'the search must say it copied');
  assert.ok(
    !said.includes('Copy the install command'),
    'the copy item must not go back to its label while the search fades',
  );
  await browserContext.close();
}

async function assertMotionEffects() {
  const browserContext = await browser.newContext({
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
    viewport: { width: 1280, height: 900 },
  });

  const page = await browserContext.newPage();
  await rejectAnalyticsForContext(browserContext);
  await page.addInitScript(
    ({ storageKey }) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ theme: 'dark', reduceMotion: false, reduceTransparency: false }),
      );
    },
    { storageKey: preferenceStorageKey },
  );
  await page.goto(new URL('/components', baseUrl).href, { waitUntil: 'networkidle' });
  assert.equal(
    await page.locator('html').getAttribute('data-lg-reduce-motion'),
    '0',
    'the motion pass must run with motion enabled',
  );

  const dock = await exactlyOne(
    demo(page, 'glass-dock').getByRole('group', { name: 'Dock' }),
    'GlassDock',
  );

  const gallery = await exactlyOne(
    dock.getByRole('button', { name: 'Gallery', exact: true }),
    'Gallery dock item',
  );

  await gallery.scrollIntoViewIfNeeded();
  // A scroll-linked reveal moves the element on the next frame, so measure after it.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const rest = await dockItemWidths(dock);
  const box = await gallery.boundingBox();
  assert.ok(box, 'Gallery dock item must render a box');

  // Hovering an icon shows its label; no icon grows, wherever the pointer rests.
  const label = await (
    await exactlyOne(gallery.locator('.lg-dock-label'), 'Gallery dock label')
  ).elementHandle();

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
  await page.waitForFunction((node) => getComputedStyle(node).opacity === '1', label, {
    timeout: 2_000,
  });
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8, { steps: 3 });
  await page.waitForTimeout(300);
  assert.deepEqual(
    await dockItemWidths(dock),
    rest,
    'GlassDock must keep every icon its size under the pointer',
  );
  await page.screenshot({ path: path.join(artifactDirectory, 'motion-dock-hover-1280.png') });
  await page.mouse.move(0, 0);
  await page.waitForFunction((node) => getComputedStyle(node).opacity === '0', label, {
    timeout: 2_000,
  });

  const view = await exactlyOne(
    demo(page, 'glass-lens').locator('.lg-lens-view'),
    'GlassLens view',
  );

  await view.scrollIntoViewIfNeeded();
  await page.waitForFunction(
    (node) => node.style.filter.startsWith('url('),
    await view.elementHandle(),
    { timeout: 5_000 },
  );

  const filter = await view.evaluate((node) => {
    const id = node.style.filter.match(/url\(["']?#([^"')]+)["']?\)/)?.[1];
    const element = id ? document.getElementById(id) : null;

    return {
      displaces: Boolean(element?.querySelector('feDisplacementMap')),
      tag: element?.tagName.toLowerCase() ?? null,
    };
  });

  assert.equal(filter.tag, 'filter', 'GlassLens must reference a mounted SVG filter');
  assert.ok(filter.displaces, 'GlassLens filter must displace the scene behind it');
  await demo(page, 'glass-lens').screenshot({
    path: path.join(artifactDirectory, 'motion-lens-filter-1280.png'),
  });
  await browserContext.close();
}

function reviewModerateViolation(violation, context) {
  const isReviewedTooltipPortalRegion =
    violation.id === 'region' &&
    context.endsWith(' glass-tooltip-visible') &&
    violation.nodes.every(
      (node) =>
        node.html.includes('lg-glass-text') &&
        node.html.includes('Opens on hover and on keyboard focus.') &&
        node.failureSummary?.includes('not contained by landmarks'),
    );

  if (isReviewedTooltipPortalRegion) {
    return {
      status: 'reviewed-nonblocking',
      review:
        'Radix Tooltip.Portal appends transient tooltip content to document.body by default. The Deque region rule is a moderate best-practice check; adding a fake landmark would misrepresent tooltip semantics. Keyboard, description ownership, and visible portal behavior are asserted separately.',
      sources: [
        'https://www.radix-ui.com/primitives/docs/components/tooltip',
        'https://dequeuniversity.com/rules/axe/html/4.10/region',
      ],
    };
  }

  // axe exempts portaled dialogs through its default regionMatcher, but not menus.
  const isReviewedMenuPortalRegion =
    violation.id === 'region' &&
    context.endsWith(' glass-menu-open') &&
    violation.nodes.every(
      (node) =>
        node.target.join(' ') === 'div[data-radix-popper-content-wrapper=""]' &&
        node.failureSummary?.includes('not contained by landmarks'),
    );

  if (isReviewedMenuPortalRegion) {
    return {
      status: 'reviewed-nonblocking',
      review:
        'Radix DropdownMenu.Portal appends the open menu to document.body so overflow cannot clip it. Focus stays inside the menu while it is open and the menu closes when focus leaves, so landmark navigation never reaches it; a fake landmark would misrepresent menu semantics. Focus entry, dismissal and focus return are asserted in assertMenuState.',
      sources: [
        'https://www.radix-ui.com/primitives/docs/components/dropdown-menu',
        'https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/',
        'https://dequeuniversity.com/rules/axe/html/4.10/region',
      ],
    };
  }

  const isReviewedSelectPortalRegion =
    violation.id === 'region' &&
    context.endsWith(' glass-select-open') &&
    violation.nodes.every(
      (node) =>
        node.target.join(' ').startsWith('div[role="group"]') &&
        node.failureSummary?.includes('not contained by landmarks'),
    );

  if (isReviewedSelectPortalRegion) {
    return {
      status: 'reviewed-nonblocking',
      review:
        'Radix Select.Portal appends the open list to document.body so overflow cannot clip it. Focus stays inside the list while it is open and the list closes when focus leaves, so landmark navigation never reaches it; a fake landmark would misrepresent listbox semantics. Focus entry, typeahead, dismissal and focus return are asserted in assertSelectState.',
      sources: [
        'https://www.radix-ui.com/primitives/docs/components/select',
        'https://www.w3.org/WAI/ARIA/apg/patterns/combobox/',
        'https://dequeuniversity.com/rules/axe/html/4.10/region',
      ],
    };
  }

  return {
    status: 'pending-explicit-review',
    review: null,
    sources: [],
  };
}

// A modal Radix layer hides the rest of the page with aria-hidden while focus stays trapped inside
// it, which axe reads as focusable hidden content. `scope` audits the layer on its own.
async function runAxe(page, context, scope) {
  let AxeBuilder;

  try {
    ({ AxeBuilder } = await import('@axe-core/playwright'));
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(
        '@axe-core/playwright is required for a release UI pass; install the Task 2-pinned package before claiming success.',
      );
    }

    throw error;
  }

  const builder = new AxeBuilder({ page });
  const results = await (scope ? builder.include(scope) : builder).analyze();

  const serious = results.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact),
  );

  if (serious.length)
    throw new Error(
      `serious/critical axe violations in ${context}: ${serious.map((item) => item.id).join(', ')}`,
    );

  for (const violation of results.violations.filter((item) => item.impact === 'moderate')) {
    const review = reviewModerateViolation(violation, context);
    moderateFindings.push({
      context,
      ...review,
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        html: node.html,
        failureSummary: node.failureSummary,
      })),
    });
  }
}

// Component checks use a visitor who has refused analytics. The consent suite owns
// first-visit choices; use the real action here so its notice cannot cover controls.
async function rejectAnalyticsForContext(context) {
  const remembered = (await context.cookies(baseUrl)).find(
    (cookie) => cookie.name === 'glassy-ui-analytics-consent',
  );

  if (remembered) {
    assert.equal(JSON.parse(decodeURIComponent(remembered.value)).decision, 'rejected');

    return;
  }

  const choicePage = await context.newPage();

  try {
    await choicePage.goto(new URL('/docs', baseUrl).href, { waitUntil: 'networkidle' });

    const privacy = choicePage.getByRole('region', { name: 'Analytics privacy settings' });

    await privacy.getByRole('button', { name: 'Reject analytics', exact: true }).click();
    await privacy.waitFor({ state: 'hidden' });
  } finally {
    await choicePage.close();
  }
}

async function configureMode(page, mode) {
  await rejectAnalyticsForContext(page.context());
  await page.emulateMedia({
    colorScheme: mode.theme,
    reducedMotion: 'reduce',
  });
  await page.addInitScript(
    ({ storageKey, theme, reduceTransparency }) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          theme,
          reduceMotion: true,
          reduceTransparency,
        }),
      );
    },
    {
      storageKey: preferenceStorageKey,
      theme: mode.theme,
      reduceTransparency: mode.transparency === '1',
    },
  );
}

async function assertMode(page, mode) {
  assert.equal(
    await page.locator('html').getAttribute('data-lg-theme'),
    mode.theme,
    `${mode.name} must apply the requested provider theme`,
  );
  assert.equal(
    await page.locator('html').getAttribute('data-lg-reduce-transparency'),
    mode.transparency,
    `${mode.name} must apply the requested provider transparency preference`,
  );

  const duration = await page
    .locator('html')
    .evaluate((node) => getComputedStyle(node).getPropertyValue('--lg-motion-duration').trim());

  assert.ok(
    duration === '0ms' || duration === '0s',
    `${mode.name} must honor reduced motion through provider state; received ${duration || '<empty>'}`,
  );
}

async function assertRequestedTheme(page, mode, phase) {
  assert.equal(
    await page.locator('html').getAttribute('data-lg-theme'),
    mode.theme,
    `${phase} must preserve requested ${mode.theme} theme`,
  );
}

async function assertReleaseMetadata() {
  const metadataChecks = [
    {
      path: '/',
      canonical: 'https://glassyui.com',
      title: 'Glassy UI — Glass components for React',
    },
    {
      path: '/docs',
      canonical: 'https://glassyui.com/docs',
      title: 'Getting Started | Glassy UI',
    },
    {
      path: '/components',
      canonical: 'https://glassyui.com/components',
      title: 'Components | Glassy UI',
    },
    {
      path: '/components/glass-button',
      canonical: 'https://glassyui.com/components/glass-button',
      title: 'Glass Button for React | Glassy UI',
    },
  ];

  for (const check of metadataChecks) {
    const response = await fetch(new URL(check.path, baseUrl));
    assert.equal(response.status, 200, `${check.path} metadata route must return 200`);
    const html = await response.text();
    assert.ok(html.includes(`<title>${check.title}</title>`), `${check.path} must own its title`);

    const canonicalTag =
      html.match(/<link[^>]*rel="canonical"[^>]*>/)?.[0] ??
      html.match(/<link[^>]*href="[^"]+"[^>]*rel="canonical"[^>]*>/)?.[0] ??
      '';

    assert.ok(
      canonicalTag.includes(`href="${check.canonical}"`),
      `${check.path} must own canonical ${check.canonical}`,
    );
    assert.ok(
      html.includes('property="og:image"'),
      `${check.path} must expose an Open Graph image`,
    );
    assert.ok(
      html.includes('name="twitter:card"'),
      `${check.path} must expose Twitter card metadata`,
    );
  }

  const robotsResponse = await fetch(new URL('/robots.txt', baseUrl));
  assert.equal(robotsResponse.status, 200, '/robots.txt must return 200');
  assert.match(
    robotsResponse.headers.get('content-type') ?? '',
    /^text\/plain\b/,
    '/robots.txt must be plain text',
  );
  const robots = await robotsResponse.text();
  assert.match(robots, /^User-Agent: \*\s*$/im, '/robots.txt must address all crawlers');
  assert.match(robots, /^Allow: \/\s*$/im, '/robots.txt must allow public routes');
  assert.ok(
    robots.includes('Sitemap: https://glassyui.com/sitemap.xml'),
    'robots.txt must own the sitemap URL',
  );

  for (const route of ['/diagnostics', '/test', '/toggle', '/search-index.json']) {
    assert.ok(robots.includes(`Disallow: ${route}`), `robots.txt must disallow ${route}`);
  }

  const sitemapResponse = await fetch(new URL('/sitemap.xml', baseUrl));
  assert.equal(sitemapResponse.status, 200, '/sitemap.xml must return 200');
  assert.match(
    sitemapResponse.headers.get('content-type') ?? '',
    /application\/xml|text\/xml/,
    '/sitemap.xml must be XML',
  );
  const sitemap = await sitemapResponse.text();

  for (const route of [
    '/',
    '/docs',
    '/components',
    ...components.map((component) => `/components/${component}`),
  ]) {
    const canonical = route === '/' ? publicSiteUrl : `${publicSiteUrl}${route}`;
    assert.ok(sitemap.includes(`<loc>${canonical}</loc>`), `sitemap.xml must include ${canonical}`);
  }

  // The home card and the loop Messages plays in its place. Messages only attaches a loop it
  // can read by byte range, so the loop must answer a range request with 206.
  const home = await (await fetch(new URL('/', baseUrl))).text();

  const shareUrl = (property) => {
    const content = home.match(new RegExp(`<meta property="${property}" content="([^"]+)"`))?.[1];

    assert.ok(content, `/ must expose ${property}`);

    const published = new URL(content.replaceAll('&amp;', '&'));

    assert.equal(published.origin, publicSiteUrl, `${property} must use the public origin`);

    return new URL(published.pathname + published.search, baseUrl);
  };

  const imageResponse = await fetch(shareUrl('og:image'));
  assert.equal(imageResponse.status, 200, 'the home card must return 200');
  assert.match(imageResponse.headers.get('content-type') ?? '', /^image\/jpeg(?:;|$)/);
  assert.ok(
    (await imageResponse.arrayBuffer()).byteLength > 10_000,
    'the home card must not be empty',
  );

  const loopResponse = await fetch(shareUrl('og:video'), { headers: { Range: 'bytes=0-1' } });
  assert.equal(loopResponse.status, 206, 'the home loop must answer a range request');
  assert.match(loopResponse.headers.get('content-type') ?? '', /^video\/mp4(?:;|$)/);
  assert.match(loopResponse.headers.get('content-range') ?? '', /^bytes 0-1\/\d+$/);
}

await assertReleaseMetadata();

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--disable-updater-scheduler'],
});

try {
  await assertProductionRouteContract();

  // Run the short contracts before the full gallery matrix for useful failure feedback.
  console.log('Release UI: checking default theme.');
  await assertDefaultTheme();
  console.log('Release UI: checking site text contrast.');
  await assertSiteTextContrast();
  console.log('Release UI: checking launch links.');
  await assertLaunchLinks();
  console.log('Release UI: checking site search.');
  await assertSiteSearch();
  console.log('Release UI: checking gallery sidebar.');
  await assertGallerySidebar();
  console.log('Release UI: checking exit motion.');
  await assertExitMotion();
  console.log('Release UI: checking motion effects.');
  await assertMotionEffects();

  for (const width of viewports) {
    for (const mode of modes) {
      const started = Date.now();
      const context = `${width}px ${mode.name}`;
      console.log(`Release UI: starting ${context}.`);
      const browserContext = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await browserContext.newPage();
      await configureMode(page, mode);
      await page.goto(new URL('/components', baseUrl).href, { waitUntil: 'networkidle' });
      await requireDemoContract(page);
      await assertMode(page, mode);
      await assertVisualContract(page, mode);

      const audit = async (state, scope) => {
        await assertRequestedTheme(page, mode, `before ${state} axe audit`);
        await runAxe(page, `${context} ${state}`, scope);
      };

      // A full-page screenshot resizes the window, and Radix Select closes its list on resize.
      const capture = async (state, { fullPage = true } = {}) => {
        await assertRequestedTheme(page, mode, `before ${state} screenshot`);
        await page.screenshot({
          path: path.join(artifactDirectory, `${state}-${width}-${mode.name}.png`),
          fullPage,
        });
      };

      await assertComponentStates(page, mode, audit, capture);
      const overflow = await horizontalOverflow(page);
      assert.equal(overflow, null, `${width}px ${mode.name} has horizontal overflow: ${overflow}`);
      await assertRequestedTheme(page, mode, `before final ${context} gallery screenshot`);
      await page.screenshot({
        path: path.join(artifactDirectory, `gallery-${width}-${mode.name}.png`),
        fullPage: true,
      });
      console.log(
        `Release UI: ${context} gallery passed in ${Math.round((Date.now() - started) / 1000)}s.`,
      );
      await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });
      await assertMode(page, mode);
      await landHome(page);
      await assertHomeSettingsFlow(page, audit, capture);
      await assertHomeTurn(page, mode, context);
      // Back at the top of the page for its audit and picture.
      await page.evaluate(() => window.scrollTo({ behavior: 'instant', top: 0 }));
      await page.waitForTimeout(400);
      const homeOverflow = await horizontalOverflow(page);
      assert.equal(
        homeOverflow,
        null,
        `${width}px ${mode.name} homepage has horizontal overflow: ${homeOverflow}`,
      );
      await audit('home');
      await capture('home');
      await browserContext.close();
      console.log(
        `Release UI: ${context} passed in ${Math.round((Date.now() - started) / 1000)}s.`,
      );
    }
  }

  const pendingModerateFindings = moderateFindings.filter(
    (finding) => finding.status === 'pending-explicit-review',
  );

  assert.equal(
    pendingModerateFindings.length,
    0,
    `release UI smoke has unreviewed moderate axe findings: ${pendingModerateFindings
      .map((finding) => `${finding.context} ${finding.id}`)
      .join(', ')}`,
  );
  const moderatePath = path.join(artifactDirectory, 'axe-moderate-findings.json');
  fs.writeFileSync(moderatePath, `${JSON.stringify(moderateFindings, null, 2)}\n`);
  console.log(
    `Release UI smoke passed. Screenshots: ${artifactDirectory}. Reviewed non-blocking moderate axe findings: ${moderateFindings.length}.`,
  );
} finally {
  if (moderateFindings.length) {
    fs.writeFileSync(
      path.join(artifactDirectory, 'axe-moderate-findings.json'),
      `${JSON.stringify(moderateFindings, null, 2)}\n`,
    );
  }

  await browser.close();
}
