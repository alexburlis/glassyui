import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

// Renders every frosted glass component over a high-frequency stripe backdrop
// and proves the material really frosts it. In Chromium a sibling blend mode,
// a mask, opacity or a filter above a backdrop-filter layer silently turns the
// blur into a no-op, so computed styles alone cannot catch a flat material.

const baseUrl = process.argv[2];

if (!baseUrl) {
  console.error(
    'Usage: node scripts/check-glass-material.mjs http://127.0.0.1:3100 [artifact-directory]',
  );
  process.exit(1);
}

const artifactDirectory =
  process.argv[3] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'glassyui-glass-material-'));

fs.mkdirSync(artifactDirectory, { recursive: true });

const preferenceStorageKey = 'glassy-ui-preferences';

const stripes = 'repeating-linear-gradient(90deg, #000 0 3px, #fff 3px 6px)';

// Unfrosted stripes measure ~127; a working frost or lens lands in single digits.
const maxFrostedDeviation = 12;

// Floating layers replaced opaque surfaces, so their tint must keep muted text
// at WCAG AA over the worst backdrop: white under dark glass, black under light.
// Dialogs, popovers, sheets and menus are slabs of glass, so in Chromium their
// rim bends the backdrop through the lens while the flat top stays frosted.
const minOverlayContrast = 4.5;

const worstBackdrop = { dark: '#fff', light: '#000' };

const engines = (process.env.GLASS_ENGINES ?? 'chromium,webkit,firefox').split(',');

const targets = [
  {
    id: 'panel',
    slug: 'glass-panel',
    selector: '[data-release-demo="glass-panel"] .lg-glass-surface',
    path: 'css',
  },
  {
    id: 'button',
    slug: 'glass-button',
    selector: '[data-release-demo="glass-button"] .lg-button:not(:disabled)',
    path: 'lens',
  },
  {
    id: 'tabs-list',
    slug: 'glass-tabs',
    selector: '[data-release-demo="glass-tabs"] [role="tablist"]',
    path: 'lens',
  },
  {
    id: 'tabs-panel',
    slug: 'glass-tabs',
    selector: '[data-release-demo="glass-tabs"] [role="tabpanel"]',
    path: 'css',
  },
  {
    id: 'input',
    slug: 'glass-input',
    selector: '[data-release-demo="glass-input"] .lg-input',
    path: 'css',
  },
  {
    id: 'dialog',
    slug: 'glass-dialog',
    open: (page) => page.getByRole('button', { name: 'Open dialog' }).click(),
    selector: '[role="dialog"]',
    path: 'overlay',
    lens: true,
  },
  {
    id: 'popover',
    slug: 'glass-popover',
    open: (page) => page.getByRole('button', { name: 'Open popover' }).click(),
    selector: '.lg-popover-content',
    path: 'overlay',
    lens: true,
  },
  {
    id: 'tooltip',
    slug: 'glass-tooltip',
    open: (page) => page.getByRole('button', { name: 'Show tooltip' }).hover(),
    selector: '.lg-tooltip-content',
    path: 'overlay',
  },
  {
    id: 'toast',
    slug: 'glass-toast',
    open: (page) => page.getByRole('button', { name: 'Show toast' }).click(),
    selector: '.lg-toast-root',
    path: 'overlay',
  },
  {
    id: 'accordion',
    slug: 'glass-accordion',
    open: (page) => page.getByRole('button', { name: 'What makes it glass?' }).click(),
    selector: '[data-release-demo="glass-accordion"] [role="region"]',
    path: 'css',
  },
  {
    id: 'segmented',
    slug: 'glass-segmented-control',
    selector: '[data-release-demo="glass-segmented-control"] .lg-segmented',
    path: 'lens',
  },
  {
    id: 'badge',
    slug: 'glass-badge',
    selector: '[data-release-demo="glass-badge"] .lg-badge',
    path: 'css',
  },
  {
    id: 'dock',
    slug: 'glass-dock',
    selector: '[data-release-demo="glass-dock"] .lg-dock-shelf',
    path: 'css',
  },
  {
    id: 'sheet',
    slug: 'glass-sheet',
    open: (page) =>
      page
        .locator('[data-release-demo="glass-sheet"]')
        .getByRole('button', { name: 'Open sheet' })
        .click(),
    selector: '.lg-sheet-content',
    path: 'overlay',
    lens: true,
  },
  {
    id: 'menu',
    slug: 'glass-menu',
    open: (page) =>
      page
        .locator('[data-release-demo="glass-menu"]')
        .getByRole('button', { name: 'Options' })
        .click(),
    selector: '.lg-menu-content',
    path: 'overlay',
    lens: true,
  },
  {
    id: 'select',
    slug: 'glass-select',
    open: (page) =>
      page
        .locator('[data-release-demo="glass-select"]')
        .getByRole('combobox', { name: 'Framework' })
        .click(),
    selector: '.lg-select-content',
    path: 'overlay',
    lens: true,
  },
  {
    id: 'command',
    slug: 'glass-command',
    open: (page) =>
      page
        .locator('[data-release-demo="glass-command"]')
        .getByRole('button', { name: /Open command menu/ })
        .click(),
    selector: '.lg-command-dialog',
    path: 'overlay',
    lens: true,
  },
];

const failures = [];

function luminance([red, green, blue]) {
  const linear = (value) => {
    const channel = value / 255;

    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

function contrast(first, second) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);

  return (light + 0.05) / (dark + 0.05);
}

async function measure(statsPage, png, box) {
  return statsPage.evaluate(
    async ({ source, inset }) => {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const x = Math.round(image.width * inset);
      const y = Math.round(image.height * inset);
      const width = Math.max(1, image.width - x * 2);
      const height = Math.max(1, image.height - y * 2);
      const { data } = context.getImageData(x, y, width, height);
      let sum = 0;
      let squares = 0;
      let stripeSquares = 0;
      let stripeCount = 0;
      let brightest;
      let darkest;
      const count = data.length / 4;

      for (let index = 0; index < data.length; index += 4) {
        const value = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
        sum += value;
        squares += value * value;

        // The stripe changes every three pixels. Compare across that step to separate
        // surviving stripes from a button's broad, smooth specular lighting gradient.
        if ((index / 4) % width < width - 3) {
          const next = index + 12;

          const difference =
            value - (0.2126 * data[next] + 0.7152 * data[next + 1] + 0.0722 * data[next + 2]);

          stripeSquares += difference * difference;
          stripeCount += 1;
        }

        if (!brightest || value > brightest.value)
          brightest = { value, rgb: [data[index], data[index + 1], data[index + 2]] };

        if (!darkest || value < darkest.value)
          darkest = { value, rgb: [data[index], data[index + 1], data[index + 2]] };
      }

      const mean = sum / count;

      return {
        mean,
        deviation: Math.sqrt(Math.max(0, squares / count - mean * mean)),
        stripeDeviation: Math.sqrt(stripeSquares / Math.max(1, stripeCount) / 2),
        brightest: brightest.rgb,
        darkest: darkest.rgb,
      };
    },
    { source: `data:image/png;base64,${png.toString('base64')}`, inset: box.inset },
  );
}

async function prepareStage(page, target) {
  await page.addStyleTag({
    content: `
      .docs-preview { background: ${stripes} !important; }
      .docs-preview::before, .docs-preview::after { display: none !important; }
      [data-glass-probe] .lg-button__label,
      [data-glass-probe].lg-badge,
      [data-glass-probe]::placeholder { color: transparent !important; }
      [data-glass-probe] [role="tab"] { visibility: hidden !important; }
      [data-glass-probe] > :not(svg):not(.lg-noise):not(.lg-refraction-background):not(.lg-button__layers) {
        visibility: hidden !important;
      }
      /* The dock's icons sit on its shelf as later siblings. */
      [data-glass-probe] ~ * { visibility: hidden !important; }
    `,
  });
  const element = page.locator(target.selector).first();
  await element.waitFor({ state: 'visible' });

  if (target.path === 'overlay') {
    await element.evaluate((node, background) => {
      let root = node;

      while (root.parentElement && getComputedStyle(root).position !== 'fixed') {
        root = root.parentElement;
      }

      const layer = document.createElement('div');
      layer.setAttribute('aria-hidden', 'true');
      layer.setAttribute('data-glass-backdrop', '');
      const zIndex = getComputedStyle(root).zIndex;
      layer.style.cssText = `position:fixed;inset:0;pointer-events:none;background:${background};z-index:${zIndex}`;
      root.before(layer);
    }, stripes);
  }

  return element;
}

async function checkTarget(page, statsPage, theme, target, results) {
  await page.goto(new URL(`/components/${target.slug}`, baseUrl).href, {
    waitUntil: 'networkidle',
  });
  await page.locator(`[data-release-demo="${target.slug}"]`).scrollIntoViewIfNeeded();

  if (target.open) await target.open(page);
  const element = await prepareStage(page, target);

  if (target.path === 'lens' || target.lens) {
    await page
      .waitForFunction(
        (selector) => document.querySelector(selector)?.getAttribute('data-lg-lens') === 'active',
        target.selector,
        { timeout: 5_000 },
      )
      .catch(() => {});
  }

  await page.waitForTimeout(700);
  const box = await element.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, 'must render a visible box');
  const clip = { x: box.x, y: box.y, width: box.width, height: box.height };
  const file = `${theme}-${target.id}.png`;
  await page.screenshot({ path: path.join(artifactDirectory, file), clip });
  await element.evaluate((node) => node.setAttribute('data-glass-probe', ''));
  await page.waitForTimeout(150);
  const probeFile = `${theme}-${target.id}-probe.png`;
  const png = await page.screenshot({ path: path.join(artifactDirectory, probeFile), clip });
  const inset = Math.min(0.3, Math.max(12 / Math.min(box.width, box.height), 0.18));
  const { mean, deviation, stripeDeviation } = await measure(statsPage, png, { inset });
  const frostDeviation = target.id === 'button' ? stripeDeviation : deviation;
  const stats = { mean, deviation, stripeDeviation, frostDeviation };

  const material = await element.evaluate((node) => {
    // Buttons frost in their distortion layer, surfaces in ::before, and
    // floating layers on the element itself.
    const layer = node.classList.contains('lg-button')
      ? node.querySelector('.lg-button__distortion')
      : node.classList.contains('lg-glass-surface')
        ? node
        : node.querySelector('.lg-glass-surface');

    const overlay = layer?.matches(
      '.lg-dialog-content, .lg-popover-content, .lg-toast-root, .lg-tooltip-content, .lg-sheet-content, .lg-menu-content, .lg-select-content',
    );

    const style = layer
      ? getComputedStyle(
          layer,
          layer.classList.contains('lg-glass-surface') && !overlay ? '::before' : null,
        )
      : getComputedStyle(node);

    return { backdropFilter: style.backdropFilter, lens: node.getAttribute('data-lg-lens') };
  });

  const row = {
    theme,
    target: target.id,
    path: target.path,
    file,
    probeFile,
    ...stats,
    ...material,
  };

  results.push(row);
  assert.ok(
    stats.frostDeviation <= maxFrostedDeviation,
    `must frost its backdrop (stripe deviation ${stats.frostDeviation.toFixed(1)} > ${maxFrostedDeviation})`,
  );

  if (target.path === 'overlay') {
    await page.evaluate((background) => {
      document.querySelector('[data-glass-backdrop]').style.background = background;
    }, worstBackdrop[theme]);
    await page.waitForTimeout(150);
    const worstFile = `${theme}-${target.id}-worst.png`;

    const worst = await measure(
      statsPage,
      await page.screenshot({ path: path.join(artifactDirectory, worstFile), clip }),
      {
        inset,
      },
    );

    const muted = await element.evaluate((node) => {
      const sample = document.createElement('div');
      sample.style.color = getComputedStyle(node).getPropertyValue('--lg-muted-foreground');
      node.append(sample);
      const color = getComputedStyle(sample).color;
      sample.remove();

      return color.match(/\d+/g).slice(0, 3).map(Number);
    });

    // Light text loses contrast on the brightest pixel, dark text on the darkest.
    const backdrop = theme === 'dark' ? worst.brightest : worst.darkest;
    row.worstFile = worstFile;
    row.mutedContrast = Number(contrast(muted, backdrop).toFixed(2));
    assert.ok(
      row.mutedContrast >= minOverlayContrast,
      `muted text must keep ${minOverlayContrast}:1 over a ${worstBackdrop[theme]} backdrop (${row.mutedContrast}:1 on rgb(${backdrop}))`,
    );
  }

  if (target.path === 'lens' || target.lens) {
    assert.equal(material.lens, 'active', 'must activate the Chromium edge lens');
    assert.match(material.backdropFilter, /^url\(/, 'lens must drive backdrop-filter');
  } else {
    assert.match(material.backdropFilter, /blur\(/, 'must keep the CSS frost');
  }
}

// A consumer tints a button through a Tailwind utility; Reduce Transparency
// must still swap in the opaque control surface.
async function checkTintGuard(page, theme) {
  await page.goto(new URL('/components/glass-button', baseUrl).href, { waitUntil: 'networkidle' });
  await page.addStyleTag({
    content: `
      @layer utilities {
        [data-release-demo="glass-button"] .lg-button {
          --lg-button-fill: rgb(14 165 233 / 0.4);
          --lg-button-fill-hover: rgb(14 165 233 / 0.5);
        }
      }
      .lg-button__distortion { transition: none !important; }
    `,
  });
  // The previous target may have left the pointer over the button.
  await page.mouse.move(0, 0);

  const guard = await page
    .locator('[data-release-demo="glass-button"] .lg-button:not(:disabled)')
    .first()
    .evaluate((node) => {
      const root = document.documentElement;
      const previous = root.getAttribute('data-lg-reduce-transparency');
      const layer = node.querySelector('.lg-button__distortion');
      const tinted = getComputedStyle(layer).backgroundColor;
      root.setAttribute('data-lg-reduce-transparency', '1');
      const sample = document.createElement('div');
      sample.style.backgroundColor =
        getComputedStyle(node).getPropertyValue('--lg-control-surface');
      document.body.append(sample);
      const controlSurface = getComputedStyle(sample).backgroundColor;
      sample.remove();
      const guarded = getComputedStyle(layer).backgroundColor;

      if (previous === null) root.removeAttribute('data-lg-reduce-transparency');
      else root.setAttribute('data-lg-reduce-transparency', previous);

      return { controlSurface, guarded, tinted };
    });

  assert.equal(
    guard.tinted,
    'rgba(14, 165, 233, 0.4)',
    'a consumer utility must tint the button fill',
  );
  assert.equal(
    guard.guarded,
    guard.controlSurface,
    'Reduce Transparency must beat the consumer tint',
  );

  return { theme, ...guard };
}

// The consent suite owns first-visit choices. Measure the material after a real refusal,
// so the notice and its shadow cannot cover or darken the sampled glass.
async function rejectAnalytics(page) {
  await page.goto(new URL('/docs', baseUrl).href, { waitUntil: 'networkidle' });
  const privacy = page.getByRole('region', { name: 'Analytics privacy settings' });

  await privacy.getByRole('button', { name: 'Reject analytics', exact: true }).click();
  await privacy.waitFor({ state: 'hidden' });
}

async function checkChromium(browser, statsPage, theme) {
  const results = [];

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });

  await context.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: preferenceStorageKey,
    value: JSON.stringify({ theme }),
  });
  const page = await context.newPage();

  await rejectAnalytics(page);

  for (const target of targets) {
    try {
      await checkTarget(page, statsPage, theme, target, results);
    } catch (error) {
      failures.push(`chromium ${theme} ${target.id}: ${error.message}`);
    }
  }

  try {
    manifest.guards.push(await checkTintGuard(page, theme));
  } catch (error) {
    failures.push(`chromium ${theme} button tint guard: ${error.message}`);
  }

  await context.close();

  return results;
}

// WebKit and Firefox cannot run an SVG filter as a backdrop, so the lens must
// stay dormant there and the plain CSS frost must carry the material.
const fallbackProbes = [
  { slug: 'glass-button', host: '.lg-button:not(:disabled)', layer: '.lg-button__distortion' },
  { slug: 'glass-tabs', host: '[role="tablist"]', layer: null },
  { slug: 'glass-segmented-control', host: '.lg-segmented', layer: null },
  // Slabs open in a portal and frost on the element itself.
  { slug: 'glass-dialog', host: '[role="dialog"]', layer: null, portal: 'Open dialog', slab: true },
  { slug: 'glass-sheet', host: '.lg-sheet-content', layer: null, portal: 'Open sheet', slab: true },
];

async function checkFallbackEngine(name, launcher) {
  const results = [];
  const browser = await launcher.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await rejectAnalytics(page);

    for (const probe of fallbackProbes) {
      try {
        await page.goto(new URL(`/components/${probe.slug}`, baseUrl).href, {
          waitUntil: 'networkidle',
        });
        await page.waitForTimeout(500);

        if (probe.portal) {
          await page
            .locator(`[data-release-demo="${probe.slug}"]`)
            .getByRole('button', { name: probe.portal })
            .click();
          await page.locator(probe.host).first().waitFor({ state: 'visible' });
          await page.waitForTimeout(500);
        }

        const result = await page.evaluate(({ slug, host, layer, slab }) => {
          const hostNode = slab
            ? document.querySelector(host)
            : document.querySelector(`[data-release-demo="${slug}"] ${host}`);

          const layerNode = layer ? hostNode?.querySelector(layer) : hostNode;

          if (!hostNode || !layerNode) return null;

          const style = getComputedStyle(layerNode, layer || slab ? null : '::before');

          return {
            backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
            lens: hostNode.getAttribute('data-lg-lens'),
          };
        }, probe);

        assert.ok(result, 'must render the release demo');
        results.push({ engine: name, slug: probe.slug, ...result });
        assert.equal(result.lens, null, 'must keep the CSS material instead of the Chromium lens');
        assert.match(result.backdropFilter, /blur\(/, 'must keep the CSS backdrop blur');
      } catch (error) {
        failures.push(`${name} ${probe.slug}: ${error.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

// The prominent button is blue glass, not a fill: what lies behind it must show through it,
// tinted, and the tint must still keep its white label at WCAG AA over the brightest backdrop
// there is. Every way that can fail: an opaque fill crept back (the backdrop no longer changes
// the face); the tint lost its cap (white text fades over white); the colour drifted off blue;
// the lens path dropped the tint in Chromium; an ancestor with opacity cut the glass off from the
// page and the label went pale; reduced transparency left it see-through. Headless WebKit and
// Firefox draw no backdrop filters at all, so there only the computed material is checked.
async function checkProminentGlass(name, browserToUse, statsPage) {
  const results = [];

  for (const theme of ['light', 'dark']) {
    const context = await browserToUse.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1,
    });

    await context.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
      key: preferenceStorageKey,
      value: JSON.stringify({ theme }),
    });
    const page = await context.newPage();
    const label = `${name} ${theme} prominent button`;

    try {
      await page.goto(new URL('/components/glass-button', baseUrl).href, {
        waitUntil: 'networkidle',
      });

      const button = page
        .locator('[data-release-demo="glass-button"] .lg-button--prominent')
        .first();

      await button.scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);

      if (name === 'chromium') {
        await page
          .waitForFunction(
            () =>
              document
                .querySelector('[data-release-demo="glass-button"] .lg-button--prominent')
                ?.getAttribute('data-lg-lens') === 'active',
            null,
            { timeout: 5_000 },
          )
          .catch(() => {});
      }

      await page.addStyleTag({
        content: `
          [data-release-demo="glass-button"] .lg-button__label { color: transparent !important; }
          [data-release-demo="glass-button"] .lg-button__distortion { transition: none !important; }
          .docs-preview::before, .docs-preview::after { display: none !important; }
        `,
      });

      const material = await button.evaluate((node) => {
        const read = () => {
          const face = getComputedStyle(node.querySelector('.lg-button__distortion'));

          return {
            background: face.backgroundColor,
            filter: face.backdropFilter || face.webkitBackdropFilter,
            light: getComputedStyle(node.querySelector('.lg-button__light')).display,
          };
        };

        const glass = read();
        const root = document.documentElement;
        const previous = root.getAttribute('data-lg-reduce-transparency');
        root.setAttribute('data-lg-reduce-transparency', '1');
        const guarded = read();
        root.setAttribute('data-lg-reduce-transparency', previous ?? '0');

        return { glass, guarded };
      });

      const row = { engine: name, theme, filter: material.glass.filter };
      results.push(row);
      assert.match(
        material.glass.filter,
        /grayscale\(1\).*sepia\(1\)/,
        `${label}: the face must tint its backdrop`,
      );
      assert.equal(
        material.glass.light,
        'block',
        `${label}: the light under the glass must be drawn`,
      );
      assert.equal(
        material.guarded.background,
        'rgb(0, 103, 217)',
        `${label}: reduced transparency must give the face the plain fill`,
      );
      assert.equal(
        material.guarded.filter,
        'none',
        `${label}: reduced transparency must drop the tint filter`,
      );
      assert.equal(
        material.guarded.light,
        'none',
        `${label}: reduced transparency must hide the light under the glass`,
      );

      if (name !== 'chromium') continue;

      assert.match(
        material.glass.filter,
        /^url\(/,
        `${label}: the lens must bend the backdrop before the tint`,
      );

      const face = async (backdrop, isolate = false) => {
        await page.evaluate(
          ({ background, cut }) => {
            const demo = document.querySelector('[data-release-demo="glass-button"]');
            demo.closest('.docs-preview').style.setProperty('background', background, 'important');
            demo.style.opacity = cut ? '0.999' : '';
          },
          { background: backdrop, cut: isolate },
        );
        await page.waitForTimeout(350);
        const box = await button.boundingBox();

        return measure(statsPage, await page.screenshot({ clip: box }), { inset: 0.3 });
      };

      const overWhite = await face('#fff');
      const overBlack = await face('#000');
      const cutOff = await face('#fff', true);
      await face('', false);

      const white = [255, 255, 255];
      Object.assign(row, {
        overWhite: overWhite.brightest,
        overBlack: overBlack.brightest,
        labelContrast: Number(contrast(white, overWhite.brightest).toFixed(2)),
        cutOffContrast: Number(contrast(white, cutOff.brightest).toFixed(2)),
        shift: Number(Math.abs(overWhite.mean - overBlack.mean).toFixed(1)),
      });

      assert.ok(
        row.labelContrast >= minOverlayContrast,
        `${label}: white text must keep ${minOverlayContrast}:1 over a white backdrop (${row.labelContrast}:1 on rgb(${overWhite.brightest}))`,
      );
      assert.ok(
        row.cutOffContrast >= minOverlayContrast,
        `${label}: cut off from the page by an ancestor's opacity, white text must still keep ${minOverlayContrast}:1 over white (${row.cutOffContrast}:1 on rgb(${cutOff.brightest}))`,
      );
      assert.ok(
        row.shift >= 6,
        `${label}: the backdrop must show through the glass (the face moved ${row.shift} between white and black)`,
      );

      for (const [where, [red, green, blue]] of [
        ['white', overWhite.brightest],
        ['black', overBlack.brightest],
      ]) {
        assert.ok(
          blue > red + 60 && blue > green + 40,
          `${label}: the face must read blue over ${where} (rgb ${red}, ${green}, ${blue})`,
        );
      }
    } catch (error) {
      failures.push(`${label}: ${error.message.split('\n')[0]}`);
    } finally {
      await context.close();
    }
  }

  return results;
}

const browser = await chromium.launch({
  args: ['--disable-updater-scheduler'],
  channel: 'chrome',
  headless: true,
});

const manifest = {
  baseUrl,
  maxFrostedDeviation,
  minOverlayContrast,
  chromium: [],
  guards: [],
  fallbacks: [],
  prominent: [],
  failures,
};

try {
  const statsPage = await browser.newPage();

  const control = await measure(
    statsPage,
    await (async () => {
      const page = await browser.newPage({ viewport: { width: 200, height: 100 } });
      await page.setContent(`<body style="margin:0;background:${stripes}"></body>`);
      const png = await page.screenshot();
      await page.close();

      return png;
    })(),
    { inset: 0 },
  );

  manifest.control = control;
  assert.ok(control.deviation > 100, 'the unfrosted stripe control must measure as high contrast');
  assert.ok(
    control.stripeDeviation > 100,
    'the three-pixel stripe probe must detect unfrosted stripes',
  );

  for (const theme of ['dark', 'light']) {
    manifest.chromium.push(...(await checkChromium(browser, statsPage, theme)));
  }

  manifest.prominent.push(...(await checkProminentGlass('chromium', browser, statsPage)));

  const launchers = { webkit, firefox };

  for (const engine of engines.filter((name) => name !== 'chromium')) {
    manifest.fallbacks.push(...(await checkFallbackEngine(engine, launchers[engine])));

    const other = await launchers[engine].launch({ headless: true });

    try {
      manifest.prominent.push(...(await checkProminentGlass(engine, other, statsPage)));
    } finally {
      await other.close();
    }
  }
} finally {
  await browser.close();
}

fs.writeFileSync(
  path.join(artifactDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

for (const row of manifest.prominent) {
  console.log(
    row.labelContrast
      ? `${row.engine.padEnd(8)} ${row.theme.padEnd(5)} prominent label ${row.labelContrast}:1 over white (${row.cutOffContrast}:1 cut off), face rgb(${row.overWhite}) / rgb(${row.overBlack}), shift ${row.shift}`
      : `${row.engine.padEnd(8)} ${row.theme.padEnd(5)} prominent ${row.filter}`,
  );
}

for (const row of manifest.chromium) {
  console.log(
    `${row.theme.padEnd(5)} ${row.target.padEnd(10)} ${row.path.padEnd(7)} frost deviation ${row.frostDeviation.toFixed(1).padStart(5)}${row.mutedContrast ? ` muted ${row.mutedContrast}:1` : ''} ${row.backdropFilter}`,
  );
}

if (failures.length) {
  console.error('Glass material check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error(`Artifacts: ${artifactDirectory}`);
  process.exit(1);
}

console.log(`Glass material check passed. Artifacts: ${artifactDirectory}`);
