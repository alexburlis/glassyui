import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium, firefox, webkit } from 'playwright';
import './register-tsx.mjs';

// With motion allowed the home page opens with the keynote's opener, which plays over the page as
// it loads; a key press moves it on, and the page under test is there once it lands.
async function landHome(page) {
  if (!(await page.evaluate(() => document.documentElement.hasAttribute('data-keynote-intro')))) {
    return;
  }

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-keynote-intro'));
  await page.waitForTimeout(400);
}

const require = createRequire(import.meta.url);

const {
  computeRefractionMapMetrics,
  MAX_REFRACTION_MAP_PIXELS,
} = require('../src/components/liquid/internal/refraction-map.ts');

const baseUrl = process.argv[2];

if (!baseUrl) {
  console.error(
    'Usage: node scripts/check-refraction-visuals.mjs http://127.0.0.1:3100 [artifact-directory]',
  );
  process.exit(1);
}

const artifactDirectory =
  process.argv[3] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'glassyui-refraction-visuals-'));

const windowSlabOnly = process.argv[4] === '--window-slab';

const magnifierOnly = process.argv[4] === '--magnifier';

// The GlassSurface docs run glass over a fixed wallpaper: a pane that refracts a
// viewport-aligned copy of the band's wallpaper through an SVG filter.
const WINDOW_EXAMPLE = '/components/glass-surface';

fs.mkdirSync(artifactDirectory, { recursive: true });

const preferenceStorageKey = 'glassy-ui-preferences';

// Summed RGB delta per pixel between filtered and unfiltered captures of the window example's pane.
const ENGINE_CENTRE_LIMIT = 12;

const ENGINE_EDGE_MINIMUM = 3.5;

// The wallpaper art is calm, and a smooth gradient barely changes when it is bent
// or shifted, so the alignment audit pins the lab's ripple rings behind the pane.
const ENGINE_WALLPAPER = '/wallpapers/lab-dark.svg';

const screenshotFiles = [];

const results = {};

function checkMapBudgets() {
  const cases = [
    { width: 118, height: 54, radius: 27, strength: 'soft', displacement: 64 },
    { width: 220, height: 56, radius: 28, strength: 'soft', displacement: 72 },
    { width: 360, height: 220, radius: 32, strength: 'strong', displacement: 112 },
    { width: 480, height: 460, radius: 40, strength: 'strong', displacement: 112 },
    { width: 1440, height: 900, radius: 48, strength: 'strong', displacement: 160 },
    { width: 2400, height: 1200, radius: 54, strength: 'strong', displacement: 196 },
  ];

  return cases.map((item) => {
    const metrics = computeRefractionMapMetrics({
      ...item,
      devicePixelRatio: 2,
    });

    assert.ok(
      metrics.mapPixels <= MAX_REFRACTION_MAP_PIXELS,
      `${item.width}x${item.height} produced ${metrics.mapPixels} map pixels`,
    );

    return {
      height: item.height,
      mapPixels: metrics.mapPixels,
      width: item.width,
    };
  });
}

async function createPage(
  browser,
  { reduceMotion = false, reduceTransparency = false, theme = 'dark', viewport },
) {
  const context = await browser.newContext({
    colorScheme: theme,
    deviceScaleFactor: 1,
    viewport,
  });

  await context.addInitScript(
    ({ motion, storageKey, theme: chosenTheme, transparency }) => {
      const preferences = { quality: 'high', theme: chosenTheme };

      if (motion !== null) preferences.reduceMotion = motion;

      if (transparency !== null) preferences.reduceTransparency = transparency;

      localStorage.setItem(storageKey, JSON.stringify(preferences));
    },
    {
      motion: reduceMotion,
      storageKey: preferenceStorageKey,
      theme,
      transparency: reduceTransparency,
    },
  );

  return {
    context,
    page: await context.newPage(),
  };
}

async function stabilize(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
      .docs-mobile-nav,
      .site-nav {
        visibility: hidden !important;
      }
    `,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
}

async function waitForGeneratedRefraction(page, selector) {
  await page.waitForFunction(
    (surfaceSelector) =>
      document.querySelector(surfaceSelector)?.getAttribute('data-lg-generated-refraction') ===
      'true',
    selector,
    { timeout: 7_000 },
  );
}

async function assertGeneratedContract(surface, description) {
  const contract = await surface.evaluate((node) => {
    const background = node.querySelector('.lg-refraction-background');
    const style = background ? getComputedStyle(background) : null;

    const filters = Array.from(node.querySelectorAll('filter[id^="lg-refraction-"]')).map(
      (filter) => filter.id,
    );

    return {
      ariaHidden: background?.getAttribute('aria-hidden') ?? null,
      backdropFilter: style?.backdropFilter ?? null,
      filter: style?.filter ?? null,
      generated: node.getAttribute('data-lg-generated-refraction'),
      pointerEvents: style?.pointerEvents ?? null,
      refraction: node.getAttribute('data-lg-refraction'),
      filters,
    };
  });

  assert.equal(contract.generated, 'true', `${description} did not generate refraction`);
  assert.match(contract.filter ?? '', /url\(/, `${description} does not use an active filter`);
  assert.doesNotMatch(
    contract.backdropFilter ?? '',
    /url\(/,
    `${description} incorrectly uses backdrop-filter as the generated path`,
  );
  assert.equal(contract.ariaHidden, 'true', `${description} background is not aria-hidden`);
  assert.equal(contract.pointerEvents, 'none', `${description} background is not pointer-inert`);
  assert.equal(contract.filters.length, 1, `${description} must own exactly one filter`);

  return contract;
}

async function readPngStats(page, buffer) {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');

    if (!context) throw new Error('Canvas 2D context unavailable for screenshot stats');

    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0;
    let sumSq = 0;

    for (let index = 0; index < data.length; index += 4) {
      const luma = data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722;

      sum += luma;
      sumSq += luma * luma;
    }

    const pixels = data.length / 4;
    const mean = sum / pixels;

    return {
      height: canvas.height,
      pixels,
      variance: sumSq / pixels - mean * mean,
      width: canvas.width,
    };
  }, buffer.toString('base64'));
}

async function diffPngBuffers(page, first, second) {
  return page.evaluate(
    async ({ firstBase64, secondBase64 }) => {
      async function load(base64) {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();

        return image;
      }

      function read(image, width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');

        if (!context) throw new Error('Canvas 2D context unavailable for screenshot diff');
        context.drawImage(image, 0, 0);

        return context.getImageData(0, 0, width, height);
      }

      const firstImage = await load(firstBase64);
      const secondImage = await load(secondBase64);

      if (firstImage.width !== secondImage.width || firstImage.height !== secondImage.height) {
        throw new Error(
          `Screenshot dimensions differ: ${firstImage.width}x${firstImage.height} and ${secondImage.width}x${secondImage.height}`,
        );
      }

      const firstPixels = read(firstImage, firstImage.width, firstImage.height);
      const secondPixels = read(secondImage, secondImage.width, secondImage.height);

      let absolute = 0;
      let centerAbsolute = 0;
      let centerMaxChannelError = 0;
      let centerPixels = 0;
      let changed = 0;
      let edgeAbsolute = 0;
      let edgePixels = 0;

      for (let index = 0; index < firstPixels.data.length; index += 4) {
        const red = Math.abs(firstPixels.data[index] - secondPixels.data[index]);
        const green = Math.abs(firstPixels.data[index + 1] - secondPixels.data[index + 1]);
        const blue = Math.abs(firstPixels.data[index + 2] - secondPixels.data[index + 2]);
        const delta = red + green + blue;
        const pixelIndex = index / 4;
        const x = pixelIndex % firstImage.width;
        const y = Math.floor(pixelIndex / firstImage.width);

        const isCenter =
          x >= firstImage.width * 0.25 &&
          x < firstImage.width * 0.75 &&
          y >= firstImage.height * 0.25 &&
          y < firstImage.height * 0.75;

        absolute += delta;

        if (isCenter) {
          centerAbsolute += delta;
          centerMaxChannelError = Math.max(centerMaxChannelError, red, green, blue);
          centerPixels += 1;
        } else {
          edgeAbsolute += delta;
          edgePixels += 1;
        }

        if (delta > 12) changed += 1;
      }

      const pixels = firstPixels.data.length / 4;

      return {
        absolute,
        centerAbsolutePerPixel: centerAbsolute / centerPixels,
        centerMaxChannelError,
        changed,
        edgeAbsolutePerPixel: edgeAbsolute / edgePixels,
        pixels,
        ratio: changed / pixels,
      };
    },
    {
      firstBase64: first.toString('base64'),
      secondBase64: second.toString('base64'),
    },
  );
}

// Pearson correlation of two captures' luminance over their middle half: near 1 when one is a
// brightened, dimmed or softened copy of the other, near 0 when their shapes do not line up.
async function correlateCentres(page, first, second) {
  return page.evaluate(
    async ({ firstBase64, secondBase64 }) => {
      async function read(base64) {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();

        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;

        const context = canvas.getContext('2d');

        if (!context) throw new Error('Canvas 2D context unavailable for correlation');

        context.drawImage(image, 0, 0);

        const { data } = context.getImageData(
          Math.round(image.width / 4),
          Math.round(image.height / 4),
          Math.round(image.width / 2),
          Math.round(image.height / 2),
        );

        const luminance = new Float64Array(data.length / 4);

        for (let index = 0; index < luminance.length; index += 1) {
          luminance[index] =
            data[index * 4] * 0.2126 + data[index * 4 + 1] * 0.7152 + data[index * 4 + 2] * 0.0722;
        }

        return luminance;
      }

      const first = await read(firstBase64);
      const second = await read(secondBase64);
      const count = Math.min(first.length, second.length);
      let firstMean = 0;
      let secondMean = 0;

      for (let index = 0; index < count; index += 1) {
        firstMean += first[index] / count;
        secondMean += second[index] / count;
      }

      let covariance = 0;
      let firstVariance = 0;
      let secondVariance = 0;

      for (let index = 0; index < count; index += 1) {
        const firstDelta = first[index] - firstMean;
        const secondDelta = second[index] - secondMean;

        covariance += firstDelta * secondDelta;
        firstVariance += firstDelta * firstDelta;
        secondVariance += secondDelta * secondDelta;
      }

      return covariance / Math.sqrt(firstVariance * secondVariance);
    },
    {
      firstBase64: first.toString('base64'),
      secondBase64: second.toString('base64'),
    },
  );
}

// Worst contrast between each text color and the pixels behind its line boxes.
async function readTextContrast(page, buffer, regions) {
  return page.evaluate(
    async ({ base64, regions: textRegions }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();

      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');

      if (!context) throw new Error('Canvas 2D context unavailable for contrast sampling');

      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);

      const channel = (value) => {
        const normalized = value / 255;

        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      };

      const luminance = (red, green, blue) =>
        0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);

      return textRegions.map(({ boxes, color: [red, green, blue, alpha], selector }) => {
        let minimumContrast = Infinity;
        let luminanceSum = 0;
        let pixels = 0;

        for (const box of boxes) {
          const top = Math.max(0, Math.floor(box.y));
          const bottom = Math.min(canvas.height, Math.ceil(box.y + box.height));
          const left = Math.max(0, Math.floor(box.x));
          const right = Math.min(canvas.width, Math.ceil(box.x + box.width));

          for (let y = top; y < bottom; y += 1) {
            for (let x = left; x < right; x += 1) {
              const index = (y * canvas.width + x) * 4;
              const background = luminance(data[index], data[index + 1], data[index + 2]);

              const foreground = luminance(
                red * alpha + data[index] * (1 - alpha),
                green * alpha + data[index + 1] * (1 - alpha),
                blue * alpha + data[index + 2] * (1 - alpha),
              );

              const ratio =
                (Math.max(background, foreground) + 0.05) /
                (Math.min(background, foreground) + 0.05);

              minimumContrast = Math.min(minimumContrast, ratio);
              luminanceSum += background;
              pixels += 1;
            }
          }
        }

        if (!pixels) throw new Error(`${selector} has no text pixels to sample`);

        return {
          meanBackgroundLuminance: luminanceSum / pixels,
          minimumContrast,
          pixels,
          selector,
        };
      });
    },
    { base64: buffer.toString('base64'), regions },
  );
}

// color-mix() resolves to color(srgb ...), whose channels run from 0 to 1.
function parseColor(value) {
  const match = value.match(/(rgba?|color)\(\s*(?:srgb\s+)?([^)]+)\)/);

  if (!match) return null;

  const channels = match[2]
    .replace('/', ' ')
    .split(/[,\s]+/)
    .filter(Boolean)
    .map((part) => Number.parseFloat(part));

  if (channels.length < 3 || channels.some((channel) => !Number.isFinite(channel))) {
    return null;
  }

  const scale = match[1] === 'color' ? 255 : 1;

  return [channels[0] * scale, channels[1] * scale, channels[2] * scale, channels[3] ?? 1];
}

function requireColor(value, description) {
  const color = parseColor(value);
  assert.ok(color, `${description} must resolve to an RGB color; received ${value}`);

  return color;
}

async function saveScreenshot(locator, name) {
  await locator.evaluate(async (node) => {
    node.scrollIntoView({ block: 'center', inline: 'center' });
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  const filePath = path.join(artifactDirectory, name);
  const buffer = await locator.screenshot({ path: filePath });
  screenshotFiles.push({ buffer, name });

  return buffer;
}

async function savePageScreenshot(page, name, options) {
  const filePath = path.join(artifactDirectory, name);
  const buffer = await page.screenshot({ path: filePath, ...options });
  screenshotFiles.push({ buffer, name });

  return buffer;
}

async function captureWithoutFilter(background, screenshotTarget, name) {
  const originalFilter = await background.evaluate((node) => node.style.filter);
  await background.evaluate((node) => {
    node.style.filter = 'none';
  });
  const buffer = await saveScreenshot(screenshotTarget, name);
  await background.evaluate((node, filter) => {
    node.style.filter = filter;
  }, originalFilter);

  return buffer;
}

// An achromatic grid makes channel separation visible without counting the material's
// colored sheen. A symmetric square fixture gives every edge identical source detail.
async function readSlabEdges(page, active, plain) {
  return page.evaluate(
    async ({ activeBase64, plainBase64 }) => {
      const read = async (base64) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();

        if (image.width !== 480 || image.height !== 480) {
          throw new Error('Slab captures must be 480 physical pixels square');
        }

        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');

        if (!context) throw new Error('Canvas 2D context unavailable for slab sampling');
        context.drawImage(image, 0, 0);

        return context.getImageData(0, 0, canvas.width, canvas.height).data;
      };

      const [filtered, unfiltered] = await Promise.all([read(activeBase64), read(plainBase64)]);

      const regions = {
        top: [144, 336, 8, 56],
        bottom: [144, 336, 424, 472],
        left: [8, 56, 144, 336],
        right: [424, 472, 144, 336],
        center: [192, 288, 192, 288],
      };

      return Object.fromEntries(
        Object.entries(regions).map(([edge, [left, right, top, bottom]]) => {
          let pixels = 0;
          let absolute = 0;
          let chromatic = 0;
          let sourceChromatic = 0;

          for (let y = top; y < bottom; y += 1) {
            for (let x = left; x < right; x += 1) {
              const index = (y * 480 + x) * 4;
              const color = Array.from(filtered.subarray(index, index + 3));
              const source = Array.from(unfiltered.subarray(index, index + 3));
              const separation = Math.max(...color) - Math.min(...color);
              absolute += color.reduce(
                (sum, channel, offset) => sum + Math.abs(channel - source[offset]),
                0,
              );
              chromatic += separation;
              sourceChromatic += Math.max(...source) - Math.min(...source);

              pixels += 1;
            }
          }

          return [
            edge,
            {
              bendDelta: absolute / pixels,
              chromaticDelta: chromatic / pixels,
              sourceChromaticDelta: sourceChromatic / pixels,
            },
          ];
        }),
      );
    },
    { activeBase64: active.toString('base64'), plainBase64: plain.toString('base64') },
  );
}

// The magnifier must split an achromatic backdrop at its rim, keep the centre
// clear, and still drag, take arrow keys and respect the material preferences.
async function auditMagnifier(browser, name) {
  const measurements = {};

  const cases = ['light', 'dark'].flatMap((theme) => [
    { theme, size: 'desktop', viewport: { width: 1440, height: 900 } },
    { theme, size: 'mobile', viewport: { width: 390, height: 844 } },
  ]);

  for (const { theme, size, viewport } of cases) {
    const { context, page } = await createPage(browser, { theme, viewport });
    const prefix = `magnifier-${name}-${theme}-${size}`;
    await context.tracing.start({ screenshots: true, snapshots: true });

    try {
      await page.goto(new URL('/#features', baseUrl).href, { waitUntil: 'networkidle' });
      await landHome(page);
      const stage = page.locator('.bento-lens');
      const lens = stage.getByRole('group', { name: 'Magnifier' });
      const view = lens.locator('.lg-lens-view');
      await lens.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('.bento-lens filter'));
      await stabilize(page);
      await saveScreenshot(page.locator('.bento-tile--lens'), `${prefix}-material.png`);

      await page.addStyleTag({
        content: `
          .bento-lens-scene {
            background: repeating-conic-gradient(#111 0% 25%, #eee 0% 50%) 0 0 / 24px 24px !important;
          }
          .bento-lens-scene p { visibility: hidden; }
          .bento-lens .lg-lens::before, .bento-lens .lg-lens::after { display: none; }
        `,
      });

      const read = async (buffer) =>
        page.evaluate(async (base64) => {
          const image = new Image();
          image.src = `data:image/png;base64,${base64}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d');

          if (!context) throw new Error('Canvas 2D context unavailable for magnifier sampling');
          context.drawImage(image, 0, 0);
          const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
          const regions = { centre: { sum: 0, pixels: 0 }, rim: { sum: 0, pixels: 0 } };

          for (let y = 0; y < canvas.height; y += 1) {
            for (let x = 0; x < canvas.width; x += 1) {
              const radius =
                Math.hypot((x + 0.5) / canvas.width - 0.5, (y + 0.5) / canvas.height - 0.5) * 2;

              const region =
                radius < 0.4 ? regions.centre : radius > 0.65 && radius < 0.9 ? regions.rim : null;

              if (!region) continue;
              const index = (y * canvas.width + x) * 4;
              const channels = [data[index], data[index + 1], data[index + 2]];
              region.sum += Math.max(...channels) - Math.min(...channels);
              region.pixels += 1;
            }
          }

          return {
            centre: regions.centre.sum / regions.centre.pixels,
            rim: regions.rim.sum / regions.rim.pixels,
          };
        }, buffer.toString('base64'));

      const active = await saveScreenshot(lens, `${prefix}-grid-active.png`);
      const plain = await captureWithoutFilter(view, lens, `${prefix}-grid-plain.png`);
      const [activeColour, plainColour] = await Promise.all([read(active), read(plain)]);
      assert.ok(plainColour.rim < 0.1, `${prefix}: source must be achromatic`);
      assert.ok(
        activeColour.rim > 3,
        `${prefix}: glass rim must split colours; got ${activeColour.rim}`,
      );
      assert.ok(activeColour.centre < 1, `${prefix}: magnified centre must stay clear`);

      // Authoring gate: translucent content must retain its coverage when RGB
      // disperses. Screen-blending three alpha-bearing images can inflate it;
      // the existing opaque checker and supplied-wallpaper filter miss this
      // magnifier graph. Plain CSS is the independent oracle; no product seam.
      const alphaSamples = [];
      results.magnifierAlpha ??= {};
      results.magnifierAlpha[prefix] = alphaSamples;

      const alphaStyle = await page.addStyleTag({
        content: `
          .bento-lens .lg-lens { --lg-lens-fill: transparent; }
          .bento-lens-scene { background: rgb(128 128 128 / var(--alpha-sample)) !important; }
        `,
      });

      try {
        for (const backdrop of ['#000', '#fff']) {
          await stage.evaluate((node, color) => (node.style.background = color), backdrop);

          for (const alpha of [0, 0.25, 0.5, 0.75, 1]) {
            await stage.evaluate((node, value) => {
              node.style.setProperty('--alpha-sample', String(value));
            }, alpha);
            await page.evaluate(() => new Promise(requestAnimationFrame));
            const suffix = `${backdrop.slice(1)}-${alpha}`;
            const filtered = await saveScreenshot(lens, `${prefix}-alpha-${suffix}-active.png`);

            const reference = await captureWithoutFilter(
              view,
              lens,
              `${prefix}-alpha-${suffix}-plain.png`,
            );

            const difference = await diffPngBuffers(page, filtered, reference);
            alphaSamples.push({ alpha, backdrop, ...difference });
            assert.ok(
              difference.centerMaxChannelError <= 2,
              `${prefix}: translucent magnifier must match plain CSS coverage at ${alpha} over ${backdrop}: ${JSON.stringify(difference)}`,
            );
          }
        }
      } finally {
        await alphaStyle.evaluate((node) => node.remove());
        await stage.evaluate((node) => {
          node.style.removeProperty('background');
          node.style.removeProperty('--alpha-sample');
        });
      }

      // Focus can scroll a narrow page. Measure movement within the stage.
      await lens.focus();
      await lens.scrollIntoViewIfNeeded();

      const geometry = () =>
        lens.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          const stage = node.parentElement.getBoundingClientRect();

          return {
            x: rect.x - stage.x,
            y: rect.y - stage.y,
            pageX: rect.x,
            pageY: rect.y,
            width: rect.width,
            height: rect.height,
          };
        });

      const before = await geometry();
      await page.mouse.move(before.pageX + before.width / 2, before.pageY + before.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        before.pageX + before.width / 2 - 24,
        before.pageY + before.height / 2 + 16,
        {
          steps: 4,
        },
      );
      await page.mouse.up();
      const dragged = await geometry();
      const dragX = dragged.x - before.x;
      const dragY = dragged.y - before.y;
      assert.ok(
        Math.abs(dragX + 24) < 1,
        `${prefix}: lens must follow pointer horizontally; moved ${dragX}; ${JSON.stringify({ before, dragged })}`,
      );
      assert.ok(
        Math.abs(dragY - 16) < 1,
        `${prefix}: lens must follow pointer vertically; moved ${dragY}`,
      );
      await lens.focus();
      await page.keyboard.press('ArrowLeft');
      const keyed = await geometry();
      assert.ok(Math.abs(keyed.x - dragged.x + 10) < 1, `${prefix}: arrow key must move lens`);

      const settings = page.locator('.bento-tile--settings');

      for (const label of ['Reduce motion', 'Reduce transparency']) {
        const toggle = settings.getByRole('switch', { name: label, exact: true });

        const keynoteWasActive =
          label === 'Reduce motion'
            ? await page.evaluate(() => document.documentElement.hasAttribute('data-keynote'))
            : null;

        await toggle.click();

        if (keynoteWasActive !== null) {
          await page.waitForFunction(
            (wasActive) => document.documentElement.hasAttribute('data-keynote') !== wasActive,
            keynoteWasActive,
          );
        }

        await page.waitForFunction(
          () =>
            getComputedStyle(document.querySelector('.bento-lens .lg-lens-view')).filter === 'none',
        );
        await lens.scrollIntoViewIfNeeded();

        const reduced = await read(
          await saveScreenshot(lens, `${prefix}-${label.replaceAll(' ', '-')}.png`),
        );

        assert.ok(reduced.rim < 0.1, `${prefix}: ${label} must keep a plain magnifier`);
        await toggle.click();

        if (keynoteWasActive !== null) {
          await page.waitForFunction(
            (wasActive) => document.documentElement.hasAttribute('data-keynote') === wasActive,
            keynoteWasActive,
          );
        }

        await page.waitForFunction(
          () =>
            getComputedStyle(document.querySelector('.bento-lens .lg-lens-view')).filter !== 'none',
        );
      }

      // Re-enabling reads the inherited setting; zero must remove dispersion.
      await stage.evaluate((node) => node.style.setProperty('--lg-lens-dispersion', '0'));
      const motion = settings.getByRole('switch', { name: 'Reduce motion', exact: true });

      const keynoteWasActive = await page.evaluate(() =>
        document.documentElement.hasAttribute('data-keynote'),
      );

      await motion.click();
      await page.waitForFunction(
        (wasActive) => document.documentElement.hasAttribute('data-keynote') !== wasActive,
        keynoteWasActive,
      );
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector('.bento-lens .lg-lens-view')).filter === 'none',
      );
      await motion.click();
      await page.waitForFunction(
        (wasActive) => document.documentElement.hasAttribute('data-keynote') === wasActive,
        keynoteWasActive,
      );
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector('.bento-lens .lg-lens-view')).filter !== 'none',
      );
      await lens.scrollIntoViewIfNeeded();
      const zeroColour = await read(await saveScreenshot(lens, `${prefix}-zero-dispersion.png`));
      assert.ok(
        zeroColour.rim < 0.1,
        `${prefix}: zero material dispersion must remove colour separation`,
      );
      measurements[`${theme}-${size}`] = { activeColour, plainColour, zeroColour, viewport };
    } finally {
      await context.tracing.stop({ path: path.join(artifactDirectory, `${prefix}-trace.zip`) });
      await context.close();
    }
  }

  return measurements;
}

async function auditWindowSlab(browser) {
  const { context, page } = await createPage(browser, {
    theme: 'light',
    viewport: { width: 1440, height: 900 },
  });

  try {
    await page.goto(new URL(WINDOW_EXAMPLE, baseUrl).href, { waitUntil: 'networkidle' });
    await stabilize(page);
    await waitForGeneratedRefraction(page, '.glass-window-pane');
    await page.addStyleTag({
      content: `
      .glass-window-pane { box-shadow: none !important; background: transparent !important; }
      .glass-window-pane::before, .glass-window-pane::after { display: none !important; }
      .glass-window-pane .glass-window-title, .glass-window-pane .glass-window-lead,
      .glass-window-pane .lg-noise { visibility: hidden !important; }
      .glass-window-wallpaper {
        background: repeating-linear-gradient(0deg, #f0f0f0 0 14px, #202020 14px 16px),
          repeating-linear-gradient(90deg, #f0f0f0 0 14px, #202020 14px 16px) !important;
        background-blend-mode: multiply !important;
      }
    `,
    });
    const surface = page.locator('.glass-window-pane');

    const before = await surface
      .locator('filter[id^="lg-refraction-"] feImage')
      .getAttribute('href');

    await surface.evaluate((node) => {
      document.body.append(node);

      for (const [property, value] of Object.entries({
        display: 'block',
        position: 'fixed',
        top: '48px',
        left: '48px',
        padding: '0',
        width: '480px',
        height: '480px',
        'z-index': '9999',
      }))
        node.style.setProperty(property, value, 'important');
    });
    await page.waitForFunction(
      (previous) => {
        const node = document.querySelector('.glass-window-pane');
        const bounds = node?.getBoundingClientRect();

        const href = node
          ?.querySelector('filter[id^="lg-refraction-"] feImage')
          ?.getAttribute('href');

        return href && href !== previous && bounds?.width === 480 && bounds.height === 480;
      },
      before,
      { timeout: 7_000 },
    );
    const active = await saveScreenshot(surface, 'window-slab-active.png');

    const plain = await captureWithoutFilter(
      surface.locator('.lg-refraction-background'),
      surface,
      'window-slab-plain.png',
    );

    const edges = await readSlabEdges(page, active, plain);
    fs.writeFileSync(
      path.join(artifactDirectory, 'window-slab-metrics.json'),
      `${JSON.stringify(edges, null, 2)}\n`,
    );
    results.windowSlab = edges;

    for (const edge of ['top', 'bottom', 'left', 'right']) {
      const metrics = edges[edge];
      assert.ok(metrics.sourceChromaticDelta < 0.1, `${edge} fixture must be achromatic`);
      assert.ok(
        metrics.bendDelta > 3.5,
        `${edge} slab edge must visibly bend: ${JSON.stringify(metrics)}`,
      );
      assert.ok(
        metrics.chromaticDelta > 1,
        `${edge} slab edge must visibly separate color channels: ${JSON.stringify(metrics)}`,
      );
    }

    for (const metric of ['bendDelta', 'chromaticDelta']) {
      const values = ['top', 'bottom', 'left', 'right'].map((edge) => edges[edge][metric]);
      assert.ok(
        Math.min(...values) / Math.max(...values) > 0.65,
        `Slab ${metric} must be equally strong on all four edges: ${JSON.stringify(values)}`,
      );
    }

    assert.ok(
      edges.center.bendDelta < 2,
      `Slab must keep a flat center: ${JSON.stringify(edges.center)}`,
    );
    assert.ok(edges.center.chromaticDelta < 0.2, 'Slab center must not split color channels');

    // Dispersing RGB must preserve a supplied scene's translucent coverage.
    await page.addStyleTag({
      content: `
      body { background: #808080 !important; }
      body > :not(.glass-window-pane) { visibility: hidden !important; }
      .glass-window-pane .glass-window-wallpaper { opacity: 0.5 !important; }
    `,
    });
    const alphaActive = await saveScreenshot(surface, 'window-slab-alpha-active.png');

    const alphaPlain = await captureWithoutFilter(
      surface.locator('.lg-refraction-background'),
      surface,
      'window-slab-alpha-plain.png',
    );

    const alphaDiff = await diffPngBuffers(page, alphaActive, alphaPlain);
    results.windowSlabAlpha = alphaDiff;
    assert.ok(
      alphaDiff.centerAbsolutePerPixel < 2,
      `Slab must preserve translucent backdrop color and coverage in its flat center: ${JSON.stringify(alphaDiff)}`,
    );

    return edges;
  } finally {
    await context.close();
  }
}

async function auditSmallSurface(browser) {
  const { context, page } = await createPage(browser, {
    viewport: { width: 1280, height: 900 },
  });

  try {
    const surfaceSelector = '[data-release-demo="glass-surface"] .lg-glass-surface';
    await page.goto(new URL('/components', baseUrl).href, { waitUntil: 'networkidle' });
    await stabilize(page);
    await waitForGeneratedRefraction(page, surfaceSelector);

    const surface = page.locator(surfaceSelector);
    const background = surface.locator('.lg-refraction-background');
    const contract = await assertGeneratedContract(surface, 'Small GlassSurface');
    assert.equal(contract.refraction, 'soft', 'Small GlassSurface must begin in soft mode');

    const soft = await saveScreenshot(surface, 'small-soft-active.png');
    const plain = await captureWithoutFilter(background, surface, 'small-soft-plain.png');
    const softStats = await readPngStats(page, soft);
    const softDiff = await diffPngBuffers(page, soft, plain);
    assert.ok(
      softStats.variance > 40,
      `Small refraction fixture is visually blank: ${softStats.variance}`,
    );
    assert.ok(
      softDiff.ratio > 0.01 && softDiff.absolute > 5_000,
      `Small active refraction does not differ enough from its plain layer: ${JSON.stringify(softDiff)}`,
    );
    assert.ok(
      softDiff.edgeAbsolutePerPixel > softDiff.centerAbsolutePerPixel * 1.5,
      `Small refraction must bend edges more than its readable center: ${JSON.stringify(softDiff)}`,
    );

    const toggle = page.getByRole('button', { name: 'Toggle surface emphasis' });
    await toggle.click();
    await page.waitForFunction(
      (selector) =>
        document.querySelector(selector)?.getAttribute('data-lg-refraction') === 'strong',
      surfaceSelector,
      { timeout: 2_000 },
    );
    await waitForGeneratedRefraction(page, surfaceSelector);
    const strong = await saveScreenshot(surface, 'small-strong-active.png');
    const strengthDiff = await diffPngBuffers(page, soft, strong);
    assert.ok(
      strengthDiff.ratio > 0.005 && strengthDiff.absolute > 2_500,
      `Soft and strong refraction are visually indistinguishable: ${JSON.stringify(strengthDiff)}`,
    );

    await saveScreenshot(
      surface.locator('xpath=ancestor::article[1]'),
      'small-surface-context.png',
    );

    return {
      activeVsPlain: softDiff,
      contract,
      softStats,
      softVsStrong: strengthDiff,
    };
  } finally {
    await context.close();
  }
}

async function auditReducedTransparency(browser) {
  const { context, page } = await createPage(browser, {
    reduceTransparency: true,
    viewport: { width: 1280, height: 900 },
  });

  try {
    const surfaceSelector = '[data-release-demo="glass-surface"] .lg-glass-surface';
    await page.goto(new URL('/components', baseUrl).href, { waitUntil: 'networkidle' });
    await stabilize(page);

    const state = await page.locator(surfaceSelector).evaluate((node) => ({
      backgroundExists: Boolean(node.querySelector('.lg-refraction-background')),
      generated: node.getAttribute('data-lg-generated-refraction'),
    }));

    assert.equal(
      state.generated,
      'false',
      'Reduced transparency must disable generated refraction',
    );
    assert.equal(
      state.backgroundExists,
      false,
      'Reduced transparency must remove the generated background layer',
    );

    return state;
  } finally {
    await context.close();
  }
}

async function auditReducedMotion(browser) {
  const { context, page } = await createPage(browser, {
    reduceMotion: true,
    viewport: { width: 1280, height: 900 },
  });

  try {
    const surfaceSelector = '[data-release-demo="glass-surface"] .lg-glass-surface';
    await page.goto(new URL('/components', baseUrl).href, { waitUntil: 'networkidle' });
    await stabilize(page);

    const state = await page.locator(surfaceSelector).evaluate((node) => ({
      backgroundExists: Boolean(node.querySelector('.lg-refraction-background')),
      generated: node.getAttribute('data-lg-generated-refraction'),
    }));

    assert.equal(state.generated, 'false', 'Reduced motion must disable generated displacement');
    assert.equal(
      state.backgroundExists,
      false,
      'Reduced motion must remove the generated displacement layer',
    );

    return state;
  } finally {
    await context.close();
  }
}

async function auditViewportAnchoring(browser) {
  const { context, page } = await createPage(browser, {
    reduceMotion: null,
    viewport: { width: 1280, height: 900 },
  });

  try {
    const surfaceSelector = '.glass-window-pane';
    await page.goto(new URL(WINDOW_EXAMPLE, baseUrl).href, { waitUntil: 'networkidle' });
    await stabilize(page);
    await waitForGeneratedRefraction(page, surfaceSelector);
    // Scroll anchoring would hold the pane still when the layout fixture grows the page above it.
    await page.addStyleTag({ content: 'html, body { overflow-anchor: none !important; }' });

    // Far from the viewport the scene is not kept aligned: doing so costs a layout, a style pass
    // and a repaint on every scroll frame, whatever the page is showing.
    const asleep = await page.locator(surfaceSelector).evaluate(async (node) => {
      const read = () => node.style.getPropertyValue('--lg-refraction-scene-y');

      const settle = async () => {
        for (let frame = 0; frame < 4; frame += 1) await new Promise(requestAnimationFrame);
      };

      const rect = node.getBoundingClientRect();
      const first = read();
      window.scrollBy(0, 240);
      await settle();
      const second = read();
      window.scrollBy(0, -240);
      await settle();

      return { first, gap: rect.top - innerHeight, second, viewport: innerHeight };
    });

    assert.ok(asleep.first, 'Window example must align its scene once when it mounts');
    assert.ok(
      asleep.gap > asleep.viewport * 0.5,
      `The pane must start well below the viewport for this check; it starts ${asleep.gap}px below`,
    );
    assert.equal(
      asleep.second,
      asleep.first,
      'A refraction scene far below the viewport must not realign while the page scrolls',
    );

    await page.locator(surfaceSelector).evaluate(async (node) => {
      node.scrollIntoView({ block: 'center' });
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });

    const measure = () =>
      page.evaluate((selector) => {
        const surface = document.querySelector(selector);

        const visibleArt = document.querySelector('.glass-window-backdrop .glass-window-wallpaper');

        const filteredScene = surface?.querySelector('.lg-refraction-scene');
        const filteredArt = filteredScene?.querySelector('.glass-window-wallpaper');
        const map = surface?.querySelector('filter[id^="lg-refraction-"] feImage');

        const rect = (node) => {
          const bounds = node?.getBoundingClientRect();

          return bounds
            ? {
                height: bounds.height,
                left: bounds.left,
                top: bounds.top,
                width: bounds.width,
              }
            : null;
        };

        return {
          filteredArt: rect(filteredArt),
          filteredScene: rect(filteredScene),
          generated: surface?.getAttribute('data-lg-generated-refraction') ?? null,
          mapHref: map?.getAttribute('href') ?? null,
          scrollY: window.scrollY,
          space: surface?.getAttribute('data-lg-refraction-background-space') ?? null,
          surface: rect(surface),
          visibleArt: rect(visibleArt),
        };
      }, surfaceSelector);

    const assertClose = (actual, expected, description, tolerance = 1) => {
      assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `${description}: expected ${expected}, received ${actual}`,
      );
    };

    const before = await measure();
    assert.equal(before.generated, 'true', 'Window example must generate refraction');
    assert.equal(before.space, 'viewport', 'Window example must use viewport-aligned refraction');
    assert.ok(before.mapHref, 'Window example must own a generated map');
    assert.ok(before.surface, 'Window example pane is missing');
    assert.ok(before.visibleArt, 'Window example fixed wallpaper is missing');
    assert.ok(before.filteredScene, 'Window example filtered scene is missing');
    assert.ok(before.filteredArt, 'Window example filtered wallpaper is missing');
    assertClose(before.filteredScene.left, 0, 'Filtered scene initial left');
    assertClose(before.filteredScene.top, 0, 'Filtered scene initial top');
    assertClose(
      before.filteredArt.width,
      before.visibleArt.width,
      'Visible and filtered wallpaper initial width',
    );
    assertClose(
      before.filteredArt.height,
      before.visibleArt.height,
      'Visible and filtered wallpaper initial height',
    );

    await savePageScreenshot(page, 'viewport-scene-before-scroll.png', {
      fullPage: false,
    });
    await page.evaluate(async () => {
      window.scrollBy(0, 240);
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    const after = await measure();
    await savePageScreenshot(page, 'viewport-scene-after-scroll.png', {
      fullPage: false,
    });

    const scrollDelta = after.scrollY - before.scrollY;
    assert.ok(scrollDelta > 200, `The page did not scroll far enough: ${scrollDelta}`);
    assertClose(after.surface.top - before.surface.top, -scrollDelta, 'Pane scroll delta');
    assertClose(
      after.visibleArt.top - before.visibleArt.top,
      0,
      'Visible wallpaper vertical drift',
    );
    assertClose(
      after.filteredArt.top - before.filteredArt.top,
      0,
      'Filtered wallpaper vertical drift',
    );
    assertClose(after.filteredScene.left, 0, 'Filtered scene scrolled left');
    assertClose(after.filteredScene.top, 0, 'Filtered scene scrolled top');
    assertClose(
      after.filteredArt.left,
      after.visibleArt.left,
      'Visible and filtered wallpaper scrolled left',
    );
    assertClose(
      after.filteredArt.top,
      after.visibleArt.top,
      'Visible and filtered wallpaper scrolled top',
    );
    assert.equal(after.mapHref, before.mapHref, 'Scroll regenerated the displacement map');
    assert.equal(after.generated, 'true', 'Window example refraction deactivated after scroll');

    await page.evaluate(async () => {
      const band = document.querySelector('.glass-window');

      if (!band) throw new Error('Window example band is missing');
      const spacer = document.createElement('div');
      spacer.setAttribute('data-refraction-layout-spacer', '');
      spacer.style.height = '240px';
      band.before(spacer);
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    const afterReflow = await measure();
    const reflowDelta = afterReflow.surface.top - after.surface.top;
    assert.ok(
      Math.abs(reflowDelta) > 20,
      `Layout fixture did not move the stable-size pane: ${reflowDelta}`,
    );
    assertClose(afterReflow.filteredScene.left, 0, 'Filtered scene reflow left');
    assertClose(afterReflow.filteredScene.top, 0, 'Filtered scene reflow top');
    assert.equal(
      afterReflow.mapHref,
      after.mapHref,
      'Stable-size layout reflow regenerated the displacement map',
    );

    await page.locator(surfaceSelector).evaluate(async (node) => {
      node.style.transform = 'translate3d(36px, 44px, 0)';
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    const afterInlineMove = await measure();
    assertClose(
      afterInlineMove.surface.left - afterReflow.surface.left,
      36,
      'Inline horizontal pane move',
    );
    assertClose(
      afterInlineMove.surface.top - afterReflow.surface.top,
      44,
      'Inline vertical pane move',
    );
    assertClose(afterInlineMove.filteredScene.left, 0, 'Inline-moved filtered scene left');
    assertClose(afterInlineMove.filteredScene.top, 0, 'Inline-moved filtered scene top');
    assert.equal(
      afterInlineMove.mapHref,
      afterReflow.mapHref,
      'Inline pane movement regenerated the displacement map',
    );
    await page.locator(surfaceSelector).evaluate(async (node) => {
      node.style.removeProperty('transform');
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });

    await page.evaluate(async (selector) => {
      const surface = document.querySelector(selector);

      if (!(surface instanceof HTMLElement)) {
        throw new Error('Window example pane is missing');
      }

      const bounds = surface.getBoundingClientRect();
      const scroller = document.createElement('div');
      const track = document.createElement('div');
      scroller.setAttribute('data-refraction-scroll-container', '');
      Object.assign(scroller.style, {
        background: '#05070c',
        height: '340px',
        left: '40px',
        overflow: 'auto',
        position: 'fixed',
        top: '60px',
        width: `${Math.min(760, bounds.width + 80)}px`,
        zIndex: '10000',
      });
      Object.assign(track.style, {
        height: `${bounds.height + 420}px`,
        position: 'relative',
        width: `${bounds.width + 420}px`,
      });
      surface.style.setProperty('height', `${bounds.height}px`, 'important');
      surface.style.setProperty('left', '180px', 'important');
      surface.style.setProperty('position', 'absolute', 'important');
      surface.style.setProperty('top', '180px', 'important');
      surface.style.setProperty('width', `${bounds.width}px`, 'important');
      track.append(surface);
      scroller.append(track);
      document.body.append(scroller);
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    }, surfaceSelector);
    await waitForGeneratedRefraction(page, surfaceSelector);
    const nestedBefore = await measure();
    await page.locator('[data-refraction-scroll-container]').evaluate(async (node) => {
      node.scrollTo({ left: 80, top: 120 });
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    const nestedAfter = await measure();
    assertClose(
      nestedAfter.surface.left - nestedBefore.surface.left,
      -80,
      'Nested horizontal pane scroll delta',
    );
    assertClose(
      nestedAfter.surface.top - nestedBefore.surface.top,
      -120,
      'Nested vertical pane scroll delta',
    );
    assertClose(nestedAfter.filteredScene.left, 0, 'Nested filtered scene left');
    assertClose(nestedAfter.filteredScene.top, 0, 'Nested filtered scene top');
    assert.equal(
      nestedAfter.mapHref,
      nestedBefore.mapHref,
      'Nested scroll regenerated the displacement map',
    );

    await page.setViewportSize({ width: 1100, height: 760 });
    await page.evaluate(async () => {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    const resized = await measure();
    assertClose(resized.filteredScene.left, 0, 'Resized filtered scene left');
    assertClose(resized.filteredScene.top, 0, 'Resized filtered scene top');
    assertClose(
      resized.filteredScene.width,
      resized.visibleArt.width,
      'Resized filtered scene width',
    );
    assertClose(
      resized.filteredScene.height,
      resized.visibleArt.height,
      'Resized filtered scene height',
    );

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(
      (selector) =>
        document.querySelector(selector)?.getAttribute('data-lg-generated-refraction') === 'false',
      surfaceSelector,
      { timeout: 2_000 },
    );

    const runtimeReducedMotion = await page.locator(surfaceSelector).evaluate((node) => ({
      backgroundExists: Boolean(node.querySelector('.lg-refraction-background')),
      sceneHeight: node.style.getPropertyValue('--lg-refraction-scene-height'),
      sceneWidth: node.style.getPropertyValue('--lg-refraction-scene-width'),
      sceneX: node.style.getPropertyValue('--lg-refraction-scene-x'),
      sceneY: node.style.getPropertyValue('--lg-refraction-scene-y'),
    }));

    assert.deepEqual(
      runtimeReducedMotion,
      {
        backgroundExists: false,
        sceneHeight: '',
        sceneWidth: '',
        sceneX: '',
        sceneY: '',
      },
      'Runtime reduced motion must remove the generated background and its alignment state',
    );

    return {
      filteredSceneAfter: after.filteredScene,
      generated: after.generated,
      inlineMoveDelta: {
        left: afterInlineMove.surface.left - afterReflow.surface.left,
        top: afterInlineMove.surface.top - afterReflow.surface.top,
      },
      layoutReflowDelta: reflowDelta,
      mapStable: after.mapHref === before.mapHref,
      nestedScrollDelta: {
        left: nestedAfter.surface.left - nestedBefore.surface.left,
        top: nestedAfter.surface.top - nestedBefore.surface.top,
      },
      resizedScene: resized.filteredScene,
      runtimeReducedMotion,
      scrollDelta,
      surfaceDelta: after.surface.top - before.surface.top,
      visibleSceneDelta: after.visibleArt.top - before.visibleArt.top,
    };
  } finally {
    await context.close();
  }
}

// Stripes that change only down the page, in a sequence that never repeats, so a pane that lags
// the wallpaper beside it shows up as one clear vertical offset.
function stripeWallpaper(width, height) {
  let seed = 7;
  let y = 0;
  let dark = true;
  let stripes = '';

  while (y < height) {
    seed = (seed * 16807) % 2147483647;
    const stripe = 3 + Math.floor((seed / 2147483647) * 26);

    if (dark) stripes += `<rect y="${y}" width="${width}" height="${stripe}"/>`;
    y += stripe;
    dark = !dark;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><rect width="${width}" height="${height}" fill="#f4f4f4"/><g fill="#101010">${stripes}</g></svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// Script hears about a scroll a frame after the compositor has drawn it, so a scene moved from
// script trails the page. This reads captured compositor frames while each gesture carries
// the window example through the viewport, and matches the flat middle of the pane against the
// fixed wallpaper beside it.
async function auditScrollSync(browser) {
  const viewport = { width: 1280, height: 900 };
  const { context, page } = await createPage(browser, { viewport });

  try {
    const surfaceSelector = '.glass-window-pane';
    await page.goto(new URL(WINDOW_EXAMPLE, baseUrl).href, { waitUntil: 'networkidle' });
    await stabilize(page);
    await waitForGeneratedRefraction(page, surfaceSelector);
    await page.addStyleTag({
      content: `
        html, body { overflow-anchor: none !important; }
        .glass-window-wallpaper {
          background: url("${stripeWallpaper(viewport.width, viewport.height)}") 0 0 / 100% 100% no-repeat !important;
        }
        .glass-window-title, .glass-window-lead { color: transparent !important; }
        .glass-window-pane .lg-noise { display: none !important; }
      `,
    });

    // Warm the visible material before sampling compositor alignment. The separate
    // performance profile records cold rendering; this check needs in-view frames.
    await page.locator(surfaceSelector).scrollIntoViewIfNeeded();
    await saveScreenshot(page.locator(surfaceSelector), 'scroll-sync-warmup.png');

    // The pane starts below the viewport, past the end of its timeline, then crosses it.
    const geometry = await page.locator(surfaceSelector).evaluate(async (node) => {
      const band = document.querySelector('.glass-window');

      if (!band) throw new Error('Window example band is missing');
      window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY - innerHeight * 1.4);

      for (let frame = 0; frame < 6; frame += 1) {
        await new Promise(requestAnimationFrame);
      }

      const pane = node.getBoundingClientRect();
      const bandBounds = band.getBoundingClientRect();
      window.__sceneStyleWrites = 0;
      new MutationObserver((records) => {
        window.__sceneStyleWrites += records.length;
      }).observe(node, { attributeFilter: ['style'], attributes: true });

      return {
        startScroll: window.scrollY,
        bandHeight: bandBounds.height,
        bandLeft: bandBounds.left,
        bandTop: bandBounds.top + window.scrollY,
        paneHeight: pane.height,
        paneLeft: pane.left,
        paneTop: pane.top + window.scrollY,
        paneWidth: pane.width,
        sceneTimelines: [
          ...(node.querySelector('.lg-refraction-scene')?.getAnimations() ?? []),
        ].map((animation) => animation.timeline?.constructor.name ?? null),
      };
    });

    assert.deepEqual(
      geometry.sceneTimelines,
      ['ViewTimeline'],
      'Chromium must carry the window example scene with a view timeline',
    );

    const cdp = await context.newCDPSession(page);
    const frames = [];
    const gestures = [];

    cdp.on('Page.screencastFrame', (event) => {
      frames.push({
        timestamp: event.metadata.timestamp,
        data: event.data,
        height: event.metadata.deviceHeight,
        scrollY: event.metadata.scrollOffsetY,
        width: event.metadata.deviceWidth,
      });
      cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { everyNthFrame: 1, format: 'png' });
    await page.waitForTimeout(200);

    // Keep the fast-scroll check; the longer sweep gives the capture stream more time.
    for (const gesture of [
      { name: 'fast', speed: 3200 },
      { name: 'capture', speed: 200 },
    ]) {
      await page.evaluate(async (scrollY) => {
        window.scrollTo(0, scrollY);

        for (let frame = 0; frame < 6; frame += 1) await new Promise(requestAnimationFrame);
      }, geometry.startScroll);
      const gestureWindow = { name: gesture.name, speed: gesture.speed, start: Date.now() / 1000 };
      gestures.push(gestureWindow);
      await cdp.send('Input.synthesizeScrollGesture', {
        gestureSourceType: 'mouse',
        preventFling: true,
        speed: gesture.speed,
        x: viewport.width / 2,
        y: viewport.height / 2,
        yDistance: -1800,
      });
      await page.waitForTimeout(300);
      gestureWindow.end = Date.now() / 1000;
    }

    await cdp.send('Page.stopScreencast');
    const sceneStyleWrites = await page.evaluate(() => window.__sceneStyleWrites);

    // The flat middle of the pane, clear of the rim, against the band's wallpaper left of the pane.
    const paneX = Math.round(geometry.paneLeft + geometry.paneWidth / 2);
    const wallpaperX = Math.round((geometry.bandLeft + geometry.paneLeft) / 2);
    const rim = 90;
    const measured = [];
    const previousScroll = new Map(gestures.map((gesture) => [gesture.name, geometry.startScroll]));
    assert.ok(
      frames.every((frame) => Number.isFinite(frame.timestamp)),
      'Captured frames must include their swap timestamps',
    );
    let worst = null;

    for (const [index, frame] of frames.entries()) {
      const gesture = gestures.find(
        (gesture) => frame.timestamp >= gesture.start && frame.timestamp <= gesture.end,
      );

      if (!gesture) continue;
      const paneTop = geometry.paneTop - frame.scrollY;
      const bandTop = geometry.bandTop - frame.scrollY;
      const moving = frame.scrollY !== previousScroll.get(gesture.name);
      previousScroll.set(gesture.name, frame.scrollY);

      const offset = await page.evaluate(
        async ({ bandBottom, bandTop, data, first, height, last, paneX, wallpaperX, width }) => {
          const image = new Image();
          image.src = `data:image/png;base64,${data}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d');

          if (!context) throw new Error('Canvas 2D context unavailable for frame analysis');
          context.drawImage(image, 0, 0);

          // A frame may be scaled down, or cut short of the viewport by the window it comes from.
          const scale = image.width / width;

          const column = (x) => {
            const pixels = context.getImageData(Math.round(x * scale), 0, 1, image.height).data;

            return (y) => {
              const index = Math.round(y * scale) * 4;

              return (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
            };
          };

          const pane = column(paneX);
          const wallpaper = column(wallpaperX);
          const rows = [];

          for (let y = Math.max(0, Math.ceil(first)); y < Math.min(height, last); y += 1) {
            rows.push(y);
          }

          if (rows.length < 60) return null;

          let best = { offset: 0, score: -Infinity };

          for (let offset = -160; offset <= 160; offset += 1) {
            const pairs = [];

            for (const y of rows) {
              const shifted = y + offset;

              if (shifted >= Math.max(0, bandTop) && shifted < Math.min(height, bandBottom)) {
                pairs.push([pane(y), wallpaper(shifted)]);
              }
            }

            if (pairs.length < rows.length * 0.6) continue;
            const meanPane = pairs.reduce((total, pair) => total + pair[0], 0) / pairs.length;
            const meanWallpaper = pairs.reduce((total, pair) => total + pair[1], 0) / pairs.length;
            let product = 0;
            let paneSquares = 0;
            let wallpaperSquares = 0;

            for (const [paneValue, wallpaperValue] of pairs) {
              product += (paneValue - meanPane) * (wallpaperValue - meanWallpaper);
              paneSquares += (paneValue - meanPane) ** 2;
              wallpaperSquares += (wallpaperValue - meanWallpaper) ** 2;
            }

            const score = product / Math.sqrt(paneSquares * wallpaperSquares || 1);

            if (score > best.score) best = { offset, score };
          }

          return best;
        },
        {
          bandBottom: bandTop + geometry.bandHeight,
          bandTop,
          data: frame.data,
          first: paneTop + rim,
          height: frame.height,
          last: paneTop + geometry.paneHeight - rim,
          paneX,
          wallpaperX,
          width: frame.width,
        },
      );

      if (!offset || !moving) continue;

      const entry = {
        frame: index,
        phase: gesture.name,
        offset: offset.offset,
        score: Number(offset.score.toFixed(3)),
        scrollY: frame.scrollY,
      };

      measured.push(entry);

      if (!worst || Math.abs(entry.offset) > Math.abs(worst.offset)) worst = entry;
    }

    const observation = {
      frames: frames.length,
      geometry,
      gestures,
      measured,
      sceneStyleWrites,
      capturedFrames: frames.map(({ timestamp, scrollY }) => ({ timestamp, scrollY })),
    };

    fs.writeFileSync(
      path.join(artifactDirectory, 'scroll-sync.json'),
      JSON.stringify(observation, null, 2) + '\n',
    );
    console.log(
      '[refraction] scroll-sync',
      JSON.stringify({
        frames: frames.length,
        moving: measured.length,
        fast: measured.filter((entry) => entry.phase === 'fast').length,
        capture: measured.filter((entry) => entry.phase === 'capture').length,
        sceneStyleWrites,
      }),
    );
    assert.ok(
      measured.length >= 6,
      `The scroll gesture must carry the pane through the viewport; measured ${measured.length} moving frames`,
    );

    assert.ok(
      measured.filter((entry) => entry.phase === 'capture').length >= 6,
      'The capture sweep must measure at least six moving frames',
    );
    assert.ok(
      measured.some((entry) => entry.phase === 'fast'),
      'The fast sweep must measure a moving frame',
    );

    // A frame whose stripes match nowhere in range trails by more than the search reaches.
    const lagging = measured.filter((entry) => Math.abs(entry.offset) > 1 || entry.score <= 0.8);

    assert.equal(
      lagging.length,
      0,
      `The refracted scene trails the wallpaper while the page scrolls: ${JSON.stringify(lagging)}`,
    );
    assert.equal(
      sceneStyleWrites,
      0,
      `Plain scrolling must leave the scene offsets alone; the pane style changed ${sceneStyleWrites} times`,
    );

    const worstFrame = Buffer.from(frames[worst.frame].data, 'base64');
    fs.writeFileSync(path.join(artifactDirectory, 'scroll-sync-worst-frame.png'), worstFrame);
    screenshotFiles.push({ buffer: worstFrame, name: 'scroll-sync-worst-frame.png' });

    return {
      frames: frames.length,
      measured,
      sceneStyleWrites,
      sceneTimelines: geometry.sceneTimelines,
    };
  } finally {
    await context.close();
  }
}

// The layout checks above only see Chromium. Each engine must draw the filtered scene where the
// wallpaper behind it sits, so the pane's middle matches an unfiltered capture, and still bend the rim.
async function auditEngineAlignment() {
  const engines = { chromium, firefox, webkit };
  const result = {};

  for (const [name, type] of Object.entries(engines)) {
    const engine = await type.launch({
      args: name === 'chromium' ? ['--disable-updater-scheduler'] : undefined,
      channel: name === 'chromium' ? 'chrome' : undefined,
      headless: true,
    });

    try {
      const { context, page } = await createPage(engine, {
        viewport: { width: 1440, height: 900 },
      });

      try {
        const surfaceSelector = '.glass-window-pane';
        await page.goto(new URL(WINDOW_EXAMPLE, baseUrl).href, { waitUntil: 'networkidle' });
        await page.addStyleTag({
          content: `.glass-window { --site-wallpaper: url("${ENGINE_WALLPAPER}"); }`,
        });
        await page.evaluate(async (source) => {
          const image = new Image();
          image.src = source;
          await image.decode();
        }, ENGINE_WALLPAPER);
        await stabilize(page);
        await waitForGeneratedRefraction(page, surfaceSelector);
        const surface = page.locator(surfaceSelector);
        const background = surface.locator(':scope > .lg-refraction-background');
        const active = await saveScreenshot(surface, `engine-${name}-refraction-active.png`);

        const unfiltered = await captureWithoutFilter(
          background,
          surface,
          `engine-${name}-refraction-none.png`,
        );

        const diff = await diffPngBuffers(page, active, unfiltered);
        assert.ok(
          diff.centerAbsolutePerPixel < ENGINE_CENTRE_LIMIT,
          `${name} draws the refracted scene away from the wallpaper behind it: centre delta ${diff.centerAbsolutePerPixel.toFixed(2)}`,
        );
        assert.ok(
          diff.edgeAbsolutePerPixel > ENGINE_EDGE_MINIMUM,
          `${name} does not bend the rim: edge delta ${diff.edgeAbsolutePerPixel.toFixed(2)}`,
        );

        // WebKit screenshots paint the filter in software, so they show a bend that its
        // compositor would drop from a scene on its own layer. Only Chromium may animate it.
        const sceneTimelines = await surface.evaluate((node) =>
          [...(node.querySelector('.lg-refraction-scene')?.getAnimations() ?? [])].map(
            (animation) => animation.timeline?.constructor.name ?? null,
          ),
        );

        assert.deepEqual(
          sceneTimelines,
          name === 'chromium' ? ['ViewTimeline'] : [],
          name === 'chromium'
            ? 'Chromium must carry the viewport scene with a view timeline on the compositor'
            : `${name} must move the viewport scene from script, inside the SVG filter`,
        );
        result[name] = {
          centreDelta: Number(diff.centerAbsolutePerPixel.toFixed(3)),
          edgeDelta: Number(diff.edgeAbsolutePerPixel.toFixed(3)),
          sceneTimelines,
          version: engine.version(),
        };
      } finally {
        await context.close();
      }
    } finally {
      await engine.close();
    }
  }

  return result;
}

// The home page draws its window pane with WebGL over a wallpaper pinned to the viewport. With the
// lab's ripple rings as the wallpaper, the flat middle of the pane must follow the wallpaper behind
// it, which the face may dim and soften but not move, at two scroll positions, and the rim must
// bend it. The middle must stop matching once the wallpaper behind it moves by 8 pixels, so a
// backdrop mapped to the band instead of the viewport, or a frame behind, fails.
async function auditHomepageScene() {
  const engines = { chromium, firefox, webkit };
  const result = {};

  const waitForScene = (page) =>
    page.waitForFunction(
      () => {
        const scene = document.querySelector('.home-window .lg-scene');

        return (
          scene?.getAttribute('data-lg-scene-renderer') === 'webgl' &&
          scene.getAttribute('data-lg-scene-backdrop') === 'ready' &&
          scene.getAttribute('data-lg-scene-state') === 'idle'
        );
      },
      null,
      { timeout: 15_000 },
    );

  for (const [name, type] of Object.entries(engines)) {
    const engine = await type.launch({
      args: name === 'chromium' ? ['--disable-updater-scheduler'] : undefined,
      channel: name === 'chromium' ? 'chrome' : undefined,
      headless: true,
    });

    try {
      const positions = {};

      // Linux WebKit can retain its first canvas snapshot after later draws.
      // Each scroll case captures a fresh live canvas before its plain controls.
      for (const block of ['center', 'end']) {
        const { context, page } = await createPage(engine, {
          viewport: { width: 1440, height: 900 },
        });

        try {
          await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });
          await landHome(page);
          await page.addStyleTag({
            content: `
          .home-window { --site-wallpaper: url("${ENGINE_WALLPAPER}"); }
          .home-window .glass-window-title, .home-window .glass-window-lead {
            color: transparent !important;
          }
        `,
          });
          await page.evaluate(async (source) => {
            const image = new Image();
            image.src = source;
            await image.decode();
          }, ENGINE_WALLPAPER);
          await stabilize(page);

          const surface = page.locator('.home-window .glass-window-pane');

          // saveScreenshot centres what it captures; these captures keep the position under test.
          const capture = async (fileName) => {
            await page.evaluate(async () => {
              await new Promise(requestAnimationFrame);
              await new Promise(requestAnimationFrame);
            });

            const buffer = await surface.screenshot({
              path: path.join(artifactDirectory, fileName),
            });

            screenshotFiles.push({ buffer, name: fileName });

            return buffer;
          };

          // The scroll wakes the canvas within two frames; it then redraws and settles.
          await surface.evaluate(async (node, position) => {
            node.scrollIntoView({ block: position });
            await new Promise(requestAnimationFrame);
            await new Promise(requestAnimationFrame);
          }, block);
          await waitForScene(page);

          const scrollY = await page.evaluate(() => Math.round(window.scrollY));
          const active = await capture(`home-scene-${name}-${block}-active.png`);

          const capturePlain = async (shift, label) => {
            const hide = await page.addStyleTag({
              content: `
              .home-window .lg-scene-canvas { visibility: hidden !important; }
              .home-window .lg-scene-backdrop { translate: ${shift}px ${shift}px; }
            `,
            });

            const buffer = await capture(`home-scene-${name}-${block}-${label}.png`);

            await hide.evaluate((node) => node.remove());

            return buffer;
          };

          const plain = await capturePlain(0, 'plain');
          const aligned = await correlateCentres(page, active, plain);
          const shifted = await correlateCentres(page, active, await capturePlain(8, 'shifted'));
          const bend = await diffPngBuffers(page, active, plain);

          assert.ok(
            aligned >= 0.85 && aligned - shifted >= 0.3,
            `${name} draws the home page scene away from the wallpaper behind it at ${block}: correlation ${aligned.toFixed(3)} aligned, ${shifted.toFixed(3)} shifted by 8 pixels`,
          );
          assert.ok(
            bend.edgeAbsolutePerPixel > ENGINE_EDGE_MINIMUM,
            `${name} does not bend the home page rim at ${block}: edge delta ${bend.edgeAbsolutePerPixel.toFixed(2)}`,
          );

          positions[block] = {
            aligned: Number(aligned.toFixed(3)),
            edge: Number(bend.edgeAbsolutePerPixel.toFixed(3)),
            scrollY,
            shifted: Number(shifted.toFixed(3)),
          };
        } finally {
          await context.close();
        }
      }

      assert.notEqual(
        positions.center.scrollY,
        positions.end.scrollY,
        `${name} must measure the home page scene at two scroll positions`,
      );
      result[name] = { positions, version: engine.version() };
    } finally {
      await engine.close();
    }
  }

  return result;
}

async function auditWindowLightTheme(browser) {
  const { context, page } = await createPage(browser, {
    theme: 'light',
    viewport: { width: 1440, height: 900 },
  });

  try {
    const surfaceSelector = '.glass-window-pane';
    const textSelectors = ['.glass-window-title', '.glass-window-lead'];
    await page.goto(new URL(WINDOW_EXAMPLE, baseUrl).href, { waitUntil: 'networkidle' });
    await stabilize(page);
    await waitForGeneratedRefraction(page, surfaceSelector);

    const surface = page.locator(surfaceSelector);
    const contract = await assertGeneratedContract(surface, 'Light window example window');

    const state = await surface.evaluate((node) => {
      const bounds = node.getBoundingClientRect();

      return {
        generated: node.getAttribute('data-lg-generated-refraction'),
        height: bounds.height,
        radius: getComputedStyle(node).borderTopLeftRadius,
        refraction: node.getAttribute('data-lg-refraction'),
        space: node.getAttribute('data-lg-refraction-background-space'),
        theme: document.documentElement.getAttribute('data-lg-theme'),
        thickness:
          Number.parseFloat(getComputedStyle(node).getPropertyValue('--lg-glass-thickness')) || 1,
        width: bounds.width,
      };
    });

    assert.equal(state.theme, 'light', 'Window example light audit must load the light theme');
    assert.equal(state.generated, 'true', 'Light window example window must generate refraction');
    assert.equal(
      state.refraction,
      'strong',
      'Light window example window must use strong refraction',
    );
    assert.equal(
      state.space,
      'viewport',
      'Light window example window must refract a viewport-aligned scene',
    );

    const active = await saveScreenshot(surface, 'window-light-refraction-active.png');
    await savePageScreenshot(page, 'window-light-context.png', {
      fullPage: false,
    });

    // Measured against the refracted wallpaper behind each line, which token math cannot see.
    const text = await surface.evaluate((node, selectors) => {
      const bounds = node.getBoundingClientRect();

      return selectors.map((selector) => {
        const element = node.querySelector(selector);

        if (!element) throw new Error(`Window example is missing ${selector}`);
        const boxes = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);

        for (let textNode = walker.nextNode(); textNode; textNode = walker.nextNode()) {
          const range = document.createRange();
          range.selectNodeContents(textNode);

          for (const line of range.getClientRects()) {
            boxes.push({
              height: line.height,
              width: line.width,
              x: line.left - bounds.left,
              y: line.top - bounds.top,
            });
          }
        }

        return { boxes, color: getComputedStyle(element).color, selector };
      });
    }, textSelectors);

    const setTextVisibility = (visibility) =>
      surface.evaluate(
        (node, { selectors, value }) => {
          for (const element of node.querySelectorAll(selectors.join(','))) {
            if (value) element.style.setProperty('visibility', value);
            else element.style.removeProperty('visibility');
          }
        },
        { selectors: textSelectors, value: visibility },
      );

    await setTextVisibility('hidden');
    const textless = await saveScreenshot(surface, 'window-light-refraction-textless.png');
    await setTextVisibility(null);

    const textContrast = await readTextContrast(
      page,
      textless,
      text.map(({ boxes, color, selector }) => ({
        boxes,
        color: requireColor(color, `Light window example ${selector} color`),
        selector,
      })),
    );

    for (const { minimumContrast, selector } of textContrast) {
      assert.ok(
        minimumContrast >= 4.5,
        `Light window example ${selector} must keep 4.5:1 over the refracted wallpaper; received ${minimumContrast}`,
      );
    }

    // The map holds a unit field, so the scale is the rim pull in both directions.
    const expected = computeRefractionMapMetrics({
      devicePixelRatio: 1,
      height: state.height,
      radius: Number.parseFloat(state.radius),
      strength: 'strong',
      thickness: state.thickness,
      width: state.width,
    });

    const displacementMaps = surface.locator('filter[id^="lg-refraction-"] feDisplacementMap');

    const displacementScales = await displacementMaps.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('scale')),
    );

    const displacementScale = displacementScales[Math.floor(displacementScales.length / 2)];
    assert.equal(
      Number(displacementScale),
      expected.filterScale,
      `Light window example displacement scale must be twice the rim pull (${expected.filterScale})`,
    );
    await displacementMaps.evaluateAll((nodes) =>
      nodes.forEach((node) => node.setAttribute('scale', '0')),
    );
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));

    const zeroDisplacement = await saveScreenshot(
      surface,
      'window-light-refraction-zero-displacement.png',
    );

    await displacementMaps.evaluateAll(
      (nodes, scales) => nodes.forEach((node, index) => node.setAttribute('scale', scales[index])),
      displacementScales,
    );
    const activeVsZeroDisplacement = await diffPngBuffers(page, active, zeroDisplacement);
    assert.ok(
      activeVsZeroDisplacement.ratio > 0.005 && activeVsZeroDisplacement.absolute > 75_000,
      `Light window example refraction is visually ineffective: ${JSON.stringify(activeVsZeroDisplacement)}`,
    );
    assert.ok(
      activeVsZeroDisplacement.edgeAbsolutePerPixel >
        activeVsZeroDisplacement.centerAbsolutePerPixel * 1.5,
      `Light window example refraction must bend edges more than its readable center: ${JSON.stringify(activeVsZeroDisplacement)}`,
    );

    return {
      activeVsZeroDisplacement,
      contract,
      displacementScale: Number(displacementScale),
      textContrast,
    };
  } finally {
    await context.close();
  }
}

async function auditLargeSurface(browser) {
  const { context, page } = await createPage(browser, {
    viewport: { width: 1440, height: 900 },
  });

  try {
    const demoSurfaceSelector = '[data-release-demo="glass-surface"] .lg-glass-surface';
    const surfaceSelector = '.lg-glass-surface[data-refraction-audit="large"]';
    await page.goto(new URL('/components', baseUrl).href, { waitUntil: 'networkidle' });
    await stabilize(page);
    await page.getByRole('button', { name: 'Toggle surface emphasis' }).click();
    await waitForGeneratedRefraction(page, demoSurfaceSelector);

    let surface = page.locator(demoSurfaceSelector);

    const initialMapHref = await surface
      .locator('filter[id^="lg-refraction-"] feImage')
      .getAttribute('href');

    assert.ok(initialMapHref, 'Large GlassSurface must begin with a generated map');
    await surface.evaluate((node) => {
      node.setAttribute('data-refraction-audit', 'large');
      document.body.append(node);
      node.style.setProperty('display', 'grid', 'important');
      node.style.setProperty('height', '460px', 'important');
      node.style.setProperty('left', '48px', 'important');
      node.style.setProperty('place-items', 'center', 'important');
      node.style.setProperty('position', 'fixed', 'important');
      node.style.setProperty('top', '48px', 'important');
      node.style.setProperty('width', '480px', 'important');
      node.style.setProperty('z-index', '9999', 'important');
    });
    await page.waitForFunction(
      ({ before, selector }) => {
        const node = document.querySelector(selector);

        const href = node
          ?.querySelector('filter[id^="lg-refraction-"] feImage')
          ?.getAttribute('href');

        const rect = node?.getBoundingClientRect();

        return Boolean(
          href &&
          href !== before &&
          rect &&
          Math.round(rect.width) === 480 &&
          Math.round(rect.height) === 460,
        );
      },
      { before: initialMapHref, selector: surfaceSelector },
      { timeout: 7_000 },
    );

    surface = page.locator(surfaceSelector);
    const background = surface.locator('.lg-refraction-background');
    const contract = await assertGeneratedContract(surface, 'Large GlassSurface');
    assert.equal(contract.refraction, 'strong', 'Large GlassSurface must use strong refraction');

    const strong = await saveScreenshot(surface, 'large-strong-active.png');
    const plain = await captureWithoutFilter(background, surface, 'large-strong-plain.png');
    const strongStats = await readPngStats(page, strong);
    const strongDiff = await diffPngBuffers(page, strong, plain);
    assert.ok(
      strongStats.variance > 40,
      `Large refraction fixture is visually blank: ${strongStats.variance}`,
    );
    assert.ok(
      strongDiff.ratio > 0.01 && strongDiff.absolute > 50_000,
      `Large active refraction does not differ enough from its plain layer: ${JSON.stringify(strongDiff)}`,
    );
    assert.ok(
      strongDiff.edgeAbsolutePerPixel > strongDiff.centerAbsolutePerPixel * 1.5,
      `Large refraction must bend edges more than its readable center: ${JSON.stringify(strongDiff)}`,
    );

    // A quarter of the live bend must look different, or the scale is not doing the work.
    const displacementMaps = surface.locator('filter[id^="lg-refraction-"] feDisplacementMap');

    const liveScales = await displacementMaps.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('scale')),
    );

    const liveScale = liveScales[Math.floor(liveScales.length / 2)];
    assert.ok(Number(liveScale) > 0, `Large GlassSurface has no bend: ${liveScale}`);
    await displacementMaps.evaluateAll(
      (nodes, scales) =>
        nodes.forEach((node, index) =>
          node.setAttribute('scale', String(Number(scales[index]) / 4)),
        ),
      liveScales,
    );
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
    const low = await saveScreenshot(surface, 'large-displacement-quarter.png');
    await displacementMaps.evaluateAll(
      (nodes, scales) => nodes.forEach((node, index) => node.setAttribute('scale', scales[index])),
      liveScales,
    );
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
    const high = await saveScreenshot(surface, 'large-displacement-live.png');
    const displacementDiff = await diffPngBuffers(page, low, high);
    assert.ok(
      displacementDiff.ratio > 0.005 && displacementDiff.absolute > 25_000,
      `Large displacement values are visually indistinguishable: ${JSON.stringify(displacementDiff)}`,
    );

    await savePageScreenshot(page, 'large-surface-context.png', {
      clip: { height: 508, width: 528, x: 24, y: 24 },
    });

    return {
      activeVsPlain: strongDiff,
      contract,
      quarterVsLiveDisplacement: displacementDiff,
      strongStats,
    };
  } finally {
    await context.close();
  }
}

function gitValue(args, fallback) {
  try {
    return execFileSync('git', args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return fallback;
  }
}

function writeManifest(browserVersion) {
  const files = screenshotFiles
    .map(({ buffer, name }) => ({
      name,
      sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const manifest = {
    browser: {
      engine: 'chromium',
      version: browserVersion,
    },
    configuration: {
      deviceScaleFactor: 1,
      reduceMotion: false,
      reducedMotionFallbackVerified: Boolean(results.reducedMotion),
      reducedTransparencyFallbackVerified: Boolean(results.reducedTransparency),
      themes: windowSlabOnly ? ['light'] : ['dark', 'light'],
      viewports: magnifierOnly
        ? [
            { width: 1440, height: 900 },
            { width: 390, height: 844 },
          ]
        : windowSlabOnly
          ? [{ height: 900, width: 1440 }]
          : [
              { height: 760, width: 1100 },
              { height: 900, width: 1280 },
              { height: 900, width: 1440 },
            ],
    },
    files,
    git: {
      dirty: gitValue(['status', '--porcelain'], '').length > 0,
      revision: gitValue(['rev-parse', 'HEAD'], 'unknown'),
    },
    node: process.version,
    results,
  };

  fs.writeFileSync(
    path.join(artifactDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

results.mapBudgets = checkMapBudgets();

const browser = await chromium.launch({
  args: ['--disable-updater-scheduler'],
  channel: 'chrome',
  headless: true,
});

try {
  if (!windowSlabOnly) {
    results.magnifier = { chromium: await auditMagnifier(browser, 'chromium') };

    for (const [name, type] of Object.entries({ webkit, firefox })) {
      const engine = await type.launch({ headless: true });

      try {
        results.magnifier[name] = await auditMagnifier(engine, name);
      } finally {
        await engine.close();
      }
    }
  }

  if (!magnifierOnly) results.windowSlab = await auditWindowSlab(browser);

  if (!windowSlabOnly && !magnifierOnly) {
    results.viewportAnchoring = await auditViewportAnchoring(browser);
    results.scrollSync = await auditScrollSync(browser);
    results.engineAlignment = await auditEngineAlignment();
    results.homepageScene = await auditHomepageScene();
    results.windowLightTheme = await auditWindowLightTheme(browser);
    results.smallSurface = await auditSmallSurface(browser);
    results.largeSurface = await auditLargeSurface(browser);
    results.reducedMotion = await auditReducedMotion(browser);
    results.reducedTransparency = await auditReducedTransparency(browser);
  }
} catch (error) {
  results.failure = { message: error.message };
  throw error;
} finally {
  writeManifest(browser.version());
  await browser.close();
}

console.log(`Refraction visual check passed. Artifacts: ${artifactDirectory}`);
