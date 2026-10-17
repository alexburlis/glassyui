import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

// Proves the WebGL glass scene end to end in every engine. The canvas may
// replace the CSS material only while it really draws: it must line up with
// the DOM, bend the backdrop at the rim like a thick slab, split its colours
// only where the glass tilts, tint the shadow of tinted glass, merge nearby
// glass, ignore where the pointer is, sleep when nothing moves, and step aside for
// accessibility settings, a missing WebGL2 context, a lost one and a backdrop
// it may not read. It must download a same-origin backdrop once. Headless
// WebKit and Firefox never paint backdrop-filter, so there the canvas is the
// only glass a run can see. The liquid motion of the controls needs no WebGL
// and is proved here too.

const baseUrl = process.argv[2];

if (!baseUrl) {
  console.error(
    'Usage: node scripts/check-glass-scene.mjs http://127.0.0.1:3100 [artifact-directory]',
  );
  process.exit(1);
}

const engines = (process.env.GLASS_ENGINES ?? 'chromium,webkit,firefox').split(',');

// The WebGL scene, backdrop loading, liquid control motion, or the preference switch's own motion.
const suites = new Set((process.env.GLASS_SUITES ?? 'scene,motion').split(','));

const supportedSuites = new Set(['scene', 'contracts', 'preferences', 'motion']);

const invalidSuites = [...suites].filter((suite) => !supportedSuites.has(suite));

if (invalidSuites.length) {
  console.error(
    `Invalid GLASS_SUITES: ${invalidSuites.map((suite) => suite || '(empty)').join(', ')}. Choose scene, contracts, preferences or motion.`,
  );
  process.exit(1);
}

const artifactDirectory =
  process.argv[3] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'glassyui-glass-scene-'));

fs.mkdirSync(artifactDirectory, { recursive: true });

const launchers = { chromium, firefox, webkit };

const preferenceStorageKey = 'glassy-ui-preferences';

const scene = '[data-release-demo="glass-scene"] .lg-scene';

const deskScene = '.home-desk .lg-scene';

const labScene = '.home-lab .lg-scene';

// The lab's largest drop, alone and still, so its rim can be measured.
const labDrop = `${labScene} .lab-drop:nth-child(1)`;

const loneDrop = `
  ${labScene} .lab-drop { transition: none !important; }
  ${labScene} .lab-drop:not(:nth-child(1)) { visibility: hidden !important; }
  ${labDrop} { --lab-x: -150 !important; --lab-y: 0 !important; --lg-scene-frost: 0px !important; }
`;

const warningPrefix = 'Glassy UI GlassScene';

const segmented = '[data-release-demo="glass-segmented-control"] .lg-segmented';

const segmentedBubble = `${segmented} > .lg-segmented-indicator`;

const checkedSegment = `${segmented} [role="radio"][data-state="checked"]`;

const tabList = '[data-release-demo="glass-tabs"] .lg-tabs-list';

const tabBubble = `${tabList} > .lg-tabs-indicator`;

const activeTab = `${tabList} [role="tab"][data-state="active"]`;

const toggle = '[data-release-demo="glass-switch"] .lg-switch';

const slider = '[data-release-demo="glass-slider"] .lg-slider';

const sliderKnob = `${slider} [role="slider"]`;

const pressable = '[data-release-demo="glass-button"] .lg-button';

// Canvas glass and its DOM box may disagree by at most this many CSS pixels.
const maxEdgeError = 1.5;

function svg(body, width = 1200, height = 800) {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;

  return `url("data:image/svg+xml,${encodeURIComponent(markup)}")`;
}

function checker(light, dark, size) {
  return `<defs><pattern id="c" width="${size * 2}" height="${size * 2}" patternUnits="userSpaceOnUse"><rect width="${size * 2}" height="${size * 2}" fill="${light}"/><rect width="${size}" height="${size}" fill="${dark}"/><rect x="${size}" y="${size}" width="${size}" height="${size}" fill="${dark}"/></pattern></defs><rect width="100%" height="100%" fill="url(#c)"/>`;
}

const monoChecker = checker('#f5f5f5', '#101010', 8);

const backdrops = {
  // Fine black and white squares: any bend or blur shows up.
  mono: svg(monoChecker),
  // Coloured squares plus asymmetric shapes catch channel swaps, flips and a
  // wrong cover fit.
  colour: svg(
    `${checker('#ff2a55', '#10b0ff', 10)}<circle cx="310" cy="240" r="150" fill="#ffd60a"/><circle cx="880" cy="540" r="210" fill="#34c759" fill-opacity="0.85"/><path d="M80 620h260v60H150v40h150v60H150v20H80z" fill="#1d1d1f"/>`,
  ),
  black: svg('<rect width="100%" height="100%" fill="#000"/>'),
  white: svg('<rect width="100%" height="100%" fill="#fff"/>'),
  grey: svg('<rect width="100%" height="100%" fill="#808080"/>'),
};

// Thin white lines on black, parallel to the left and right rims of a drop,
// so light split by wavelength shows as coloured fringes.
function lines(width, height) {
  return svg(
    '<defs><pattern id="l" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#000"/><rect width="2" height="16" fill="#fff"/></pattern></defs><rect width="100%" height="100%" fill="url(#l)"/>',
    width,
    height,
  );
}

const failures = [];

// WCAG relative luminance of an sRGB colour given as 0-255 channels.
function relativeLuminance([red, green, blue]) {
  const linear = (value) => {
    const channel = value / 255;

    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

function contrastRatio(first, second) {
  const [light, dark] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);

  return (light + 0.05) / (dark + 0.05);
}

// Reads the rgb() or color(srgb) text browsers serialise for a <color>.
function parseRgb(text) {
  const numbers = text.match(/[\d.]+/g)?.map(Number) ?? [];

  if (text.startsWith('color(srgb'))
    return { rgb: numbers.slice(0, 3).map((value) => value * 255), alpha: numbers[3] ?? 1 };

  return { rgb: numbers.slice(0, 3), alpha: numbers[3] ?? 1 };
}

function readRenderer(page, selector) {
  return page.evaluate((target) => {
    const node = document.querySelector(target);

    return node
      ? {
          renderer: node.getAttribute('data-lg-scene-renderer'),
          state: node.getAttribute('data-lg-scene-state'),
          backdrop: node.getAttribute('data-lg-scene-backdrop'),
        }
      : null;
  }, selector);
}

async function waitForRenderer(page, selector, renderer, timeout = 5_000) {
  await page.waitForFunction(
    ({ target, expected }) =>
      document.querySelector(target)?.getAttribute('data-lg-scene-renderer') === expected,
    { target: selector, expected: renderer },
    { timeout },
  );
}

// Waits until the scene has drawn its current backdrop and its loop has gone
// idle, so a screenshot shows a finished frame.
async function settle(page, selector = scene) {
  await page.waitForTimeout(120);
  await page.waitForFunction(
    (target) => {
      const node = document.querySelector(target);

      return (
        node?.getAttribute('data-lg-scene-renderer') === 'webgl' &&
        node.getAttribute('data-lg-scene-state') === 'idle' &&
        node.getAttribute('data-lg-scene-backdrop') === 'ready'
      );
    },
    selector,
    { timeout: 8_000 },
  );
}

async function setBackdrop(page, value, selector = scene) {
  await page.evaluate(
    ({ target, backdrop }) => {
      const node = document.querySelector(target);

      if (backdrop) node.style.setProperty('--lg-scene-backdrop', backdrop);
      else node.style.removeProperty('--lg-scene-backdrop');
    },
    { target: selector, backdrop: value },
  );
  await settle(page, selector);
}

async function addStyle(page, content) {
  return page.evaluate((css) => {
    const style = document.createElement('style');
    style.setAttribute('data-scene-probe', '');
    style.textContent = css;
    document.head.append(style);
  }, content);
}

async function clearStyles(page) {
  await page.evaluate(() =>
    document.querySelectorAll('style[data-scene-probe]').forEach((node) => node.remove()),
  );
}

async function boxOf(page, selector) {
  const box = await page.locator(selector).first().boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, `${selector} must render a visible box`);

  return box;
}

function roundClip(box) {
  const x = Math.floor(box.x);
  const y = Math.floor(box.y);

  return {
    x,
    y,
    width: Math.ceil(box.x + box.width) - x,
    height: Math.ceil(box.y + box.height) - y,
  };
}

// Decodes screenshots in a Chromium page and runs pixel operations there, so
// the large pixel arrays never cross into Node.
async function analyse(statsPage, images, operations) {
  const sources = Object.fromEntries(
    Object.entries(images).map(([name, png]) => [
      name,
      `data:image/png;base64,${png.toString('base64')}`,
    ]),
  );

  return statsPage.evaluate(
    async ({ sources: encoded, operations: list }) => {
      const decoded = {};

      for (const [name, source] of Object.entries(encoded)) {
        const image = new Image();
        image.src = source;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        decoded[name] = {
          width: image.width,
          height: image.height,
          data: context.getImageData(0, 0, image.width, image.height).data,
        };
      }

      const pixel = (image, x, y) => {
        const index = (y * image.width + x) * 4;

        return [image.data[index], image.data[index + 1], image.data[index + 2]];
      };

      // An area is a rectangle, or a circle when it has a radius.
      const within = (x, y, area) =>
        area.r === undefined
          ? x >= area.x && x < area.x + area.width && y >= area.y && y < area.y + area.height
          : (x + 0.5 - area.cx) ** 2 + (y + 0.5 - area.cy) ** 2 < area.r ** 2;

      // A pixel counts when it lies in the rectangle, in one of the only areas
      // if there are any, and in none of the excluded ones.
      const counts = (x, y, bounds, exclude, only) =>
        x >= bounds.x0 &&
        x < bounds.x1 &&
        y >= bounds.y0 &&
        y < bounds.y1 &&
        (!only.length || only.some((area) => within(x, y, area))) &&
        !exclude.some((area) => within(x, y, area));

      const boundsOf = (image, rect) => ({
        x0: Math.max(0, Math.round(rect.x)),
        y0: Math.max(0, Math.round(rect.y)),
        x1: Math.min(image.width, Math.round(rect.x + rect.width)),
        y1: Math.min(image.height, Math.round(rect.y + rect.height)),
      });

      const eachPixel = (image, rect, exclude, visit, only = []) => {
        const bounds = boundsOf(image, rect);

        for (let y = bounds.y0; y < bounds.y1; y += 1) {
          for (let x = bounds.x0; x < bounds.x1; x += 1) {
            if (counts(x, y, bounds, exclude, only)) visit(x, y);
          }
        }
      };

      const luminance = ([red, green, blue]) => 0.2126 * red + 0.7152 * green + 0.0722 * blue;

      return list.map((operation) => {
        const image = decoded[operation.image ?? 'a'];
        const rect = operation.rect ?? { x: 0, y: 0, width: image.width, height: image.height };
        const exclude = operation.exclude ?? [];
        const only = operation.only ?? [];

        // Chroma is the spread between a pixel's largest and smallest channel.
        if (operation.type === 'colour') {
          const chromas = [];
          let warm = 0;
          let cool = 0;
          let green = 0;
          let darkest = 255;
          eachPixel(
            image,
            rect,
            exclude,
            (x, y) => {
              const [red, middle, blue] = pixel(image, x, y);
              chromas.push(Math.max(red, middle, blue) - Math.min(red, middle, blue));

              if (red > blue + 30) warm += 1;

              if (blue > red + 30) cool += 1;

              if (middle > red + 20 && middle > blue + 20) green += 1;

              darkest = Math.min(darkest, luminance([red, middle, blue]));
            },
            only,
          );
          chromas.sort((a, b) => a - b);

          return {
            count: chromas.length,
            max: chromas.at(-1) ?? 0,
            p99: chromas[Math.floor(chromas.length * 0.99)] ?? 0,
            warm,
            cool,
            green,
            darkest,
          };
        }

        // The largest change of any channel between neighbouring pixels.
        if (operation.type === 'steps') {
          const bounds = boundsOf(image, rect);
          let largest = 0;
          let at = null;
          eachPixel(
            image,
            rect,
            exclude,
            (x, y) => {
              const here = pixel(image, x, y);

              for (const [nx, ny] of [
                [x + 1, y],
                [x, y + 1],
              ]) {
                if (!counts(nx, ny, bounds, exclude, only)) continue;

                const there = pixel(image, nx, ny);

                const step = Math.max(
                  ...here.map((value, channel) => Math.abs(value - there[channel])),
                );

                if (step > largest) {
                  largest = step;
                  at = [x, y];
                }
              }
            },
            only,
          );

          return { max: largest, at };
        }

        if (operation.type === 'mean') {
          const sum = [0, 0, 0];
          let count = 0;
          eachPixel(
            image,
            rect,
            exclude,
            (x, y) => {
              pixel(image, x, y).forEach((value, channel) => {
                sum[channel] += value;
              });
              count += 1;
            },
            only,
          );
          const rgb = sum.map((value) => value / Math.max(1, count));

          return { rgb, luminance: luminance(rgb), count };
        }

        if (operation.type === 'over') {
          const background = decoded.background;
          const face = decoded.face;
          let maxError = 0;
          let sumError = 0;
          let count = 0;
          eachPixel(image, rect, exclude, (x, y) => {
            const behind = pixel(background, x, y);
            const foreground = pixel(face, x, y);
            pixel(image, x, y).forEach((value, channel) => {
              const expected =
                operation.alpha * foreground[channel] + (1 - operation.alpha) * behind[channel];

              const error = Math.abs(value - expected);
              maxError = Math.max(maxError, error);
              sumError += error;
              count += 1;
            });
          });

          return { maxError, meanError: sumError / count, channels: count };
        }

        if (operation.type === 'diff') {
          const other = decoded[operation.other ?? 'b'];
          let total = 0;
          let count = 0;
          eachPixel(
            image,
            rect,
            exclude,
            (x, y) => {
              const first = pixel(image, x, y);
              const second = pixel(other, x, y);
              total +=
                (Math.abs(first[0] - second[0]) +
                  Math.abs(first[1] - second[1]) +
                  Math.abs(first[2] - second[2])) /
                3;
              count += 1;
            },
            only,
          );

          return { meanDiff: total / Math.max(1, count), count };
        }

        if (operation.type === 'line') {
          const values = [];
          const horizontal = operation.axis === 'x';

          for (let step = operation.from; step < operation.to; step += 1) {
            const x = horizontal ? step : operation.at;
            const y = horizontal ? operation.at : step;
            values.push(
              x >= 0 && y >= 0 && x < image.width && y < image.height
                ? luminance(pixel(image, x, y))
                : 0,
            );
          }

          return values;
        }

        throw new Error(`Unknown operation ${operation.type}`);
      });
    },
    { sources, operations },
  );
}

// Finds where a bright shape begins along a luminance line that starts outside
// it. A pixel's value is sampled at its centre, so the crossing lands on the
// edge itself: index + 0.5.
function edgeFrom(values, threshold) {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] >= threshold && values[index - 1] < threshold) {
      const fraction = (threshold - values[index - 1]) / (values[index] - values[index - 1]);

      return index - 1 + fraction + 0.5;
    }
  }

  return null;
}

async function measureEdges(page, statsPage, selector, scale) {
  const box = await boxOf(page, selector);
  const png = await page.screenshot();
  const margin = 24;
  const centreX = Math.round((box.x + box.width / 2) * scale);
  const centreY = Math.round((box.y + box.height / 2) * scale);
  const left = Math.round((box.x - margin) * scale);
  const top = Math.round((box.y - margin) * scale);

  const [row, column] = await analyse(statsPage, { a: png }, [
    {
      type: 'line',
      axis: 'x',
      at: centreY,
      from: left,
      to: Math.round((box.x + box.width + margin) * scale),
    },
    {
      type: 'line',
      axis: 'y',
      at: centreX,
      from: top,
      to: Math.round((box.y + box.height + margin) * scale),
    },
  ]);

  const threshold = 60;

  const found = {
    left: edgeFrom(row, threshold),
    right: edgeFrom([...row].reverse(), threshold),
    top: edgeFrom(column, threshold),
    bottom: edgeFrom([...column].reverse(), threshold),
  };

  assert.ok(
    Object.values(found).every((value) => value !== null),
    `every edge of ${selector} must show on the canvas (${JSON.stringify(found)})`,
  );

  const measured = {
    left: (left + found.left) / scale,
    right: (left + row.length - found.right) / scale,
    top: (top + found.top) / scale,
    bottom: (top + column.length - found.bottom) / scale,
  };

  const expected = {
    left: box.x,
    right: box.x + box.width,
    top: box.y,
    bottom: box.y + box.height,
  };

  const errors = Object.fromEntries(
    Object.keys(expected).map((side) => [
      side,
      Number(Math.abs(measured[side] - expected[side]).toFixed(2)),
    ]),
  );

  return { expected, measured, errors };
}

async function checkAlignment(page, statsPage, scale, label, results) {
  await addStyle(
    page,
    `
      ${scene} .lg-glass-surface {
        --lg-scene-tint: rgb(255 255 255) !important;
        --lg-scene-ink: transparent !important;
      }
      ${scene} .lg-glass-surface > * { visibility: hidden !important; }
    `,
  );
  await setBackdrop(page, backdrops.black);
  const alignment = await measureEdges(page, statsPage, `${scene} .lg-glass-surface`, scale);
  results[label] = alignment;
  await clearStyles(page);
  await setBackdrop(page, null);

  const worst = Math.max(...Object.values(alignment.errors));
  assert.ok(
    worst <= maxEdgeError,
    `canvas glass must meet its DOM box within ${maxEdgeError}px (${JSON.stringify(alignment.errors)})`,
  );
}

function registeredRects(page) {
  return page.evaluate((target) => {
    const root = document.querySelector(target);
    const origin = root.getBoundingClientRect();

    return [...root.querySelectorAll('[data-lg-scene="active"]')].map((node) => {
      const rect = node.getBoundingClientRect();

      return { x: rect.x - origin.x, y: rect.y - origin.y, width: rect.width, height: rect.height };
    });
  }, scene);
}

function grow(rect, amount) {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  };
}

async function sceneShot(page, file, selector = scene) {
  const clip = roundClip(await boxOf(page, selector));

  const png = await page.screenshot({
    clip,
    path: file ? path.join(artifactDirectory, file) : undefined,
  });

  return { png, clip };
}

async function countFrames(page, duration) {
  const before = await page.evaluate(() => window.__glassFrames);
  await page.waitForTimeout(duration);
  const after = await page.evaluate(() => window.__glassFrames);

  return after - before;
}

function instrument(context) {
  return context.addInitScript(() => {
    window.__glassFrames = 0;
    const request = window.requestAnimationFrame.bind(window);

    window.requestAnimationFrame = (callback) => {
      window.__glassFrames += 1;

      return request(callback);
    };
  });
}

function watchConsole(page, log) {
  page.on('console', (message) => {
    const type = message.type();

    if (type === 'warning' || type === 'error') log.push({ type, text: message.text() });
  });
  page.on('pageerror', (error) => log.push({ type: 'pageerror', text: error.message }));
}

// Browser-level noise that says nothing about this code.
const benignConsole = [
  /Automatic fallback to software WebGL has been deprecated/i,
  /GPU stall due to ReadPixels/i,
];

function problems(log, { allowContextLoss = false } = {}) {
  return log.filter((entry) => {
    if (benignConsole.some((pattern) => pattern.test(entry.text))) return false;

    if (allowContextLoss && /context (was )?lost|WebGL context/i.test(entry.text)) return false;

    if (entry.type === 'pageerror') return true;

    return /hydrat|didn't match|GL_INVALID|INVALID_(ENUM|VALUE|OPERATION|FRAMEBUFFER)|WebGL:|GlassScene/i.test(
      entry.text,
    );
  });
}

async function newContext(
  browser,
  { theme = 'dark', preferences = {}, scale = 1, ...options } = {},
) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: scale,
    ...options,
  });

  try {
    // The keynote suite owns the intro. These checks need the actual home controls and glass,
    // rather than sampling the opener's pixels or waiting for it to uncover a pointer target.
    await context.addInitScript(
      ({ key, value }) => {
        localStorage.setItem(key, value);
        localStorage.setItem('glassy-ui-intro', 'seen');
      },
      { key: preferenceStorageKey, value: JSON.stringify({ theme, ...preferences }) },
    );

    // The consent suite owns first-visit choices. Measure glass after a real refusal,
    // so the privacy notice cannot cover a sampled rim or change the scene's layout.
    const choicePage = await context.newPage();

    try {
      await choicePage.goto(new URL('/docs', baseUrl).href, { waitUntil: 'networkidle' });
      const privacy = choicePage.getByRole('region', { name: 'Analytics privacy settings' });

      await privacy.getByRole('button', { name: 'Reject analytics', exact: true }).click();
      await privacy.waitFor({ state: 'hidden' });

      const remembered = (await context.cookies(baseUrl)).find(
        (cookie) => cookie.name === 'glassy-ui-analytics-consent',
      );

      assert.equal(JSON.parse(decodeURIComponent(remembered.value)).decision, 'rejected');
    } finally {
      await choicePage.close();
    }

    return context;
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function openDemo(page) {
  await page.goto(new URL('/components/glass-scene', baseUrl).href, { waitUntil: 'load' });
  await page.locator(scene).scrollIntoViewIfNeeded();
}

async function run(engine, name, results, check) {
  try {
    results[name] = (await check()) ?? 'passed';
  } catch (error) {
    results[name] = { failed: error.message };
    failures.push(`${engine} ${name}: ${error.message}`);
  }
}

async function checkDemo(engine, browser, statsPage, results) {
  const context = await newContext(browser);
  const log = [];

  try {
    await instrument(context);
    const page = await context.newPage();
    watchConsole(page, log);
    await openDemo(page);

    await run(engine, 'F1 reaches webgl', results, async () => {
      await waitForRenderer(page, scene, 'webgl');
      await settle(page);

      return readRenderer(page, scene);
    });

    if (results['F1 reaches webgl']?.failed) return;

    await sceneShot(page, `${engine}-demo.png`);

    await run(engine, 'F4 DOM frost removed', results, async () => {
      const material = await page.evaluate((target) => {
        const root = document.querySelector(target);
        const panel = root.querySelector('.lg-glass-surface');
        const button = root.querySelector('.lg-button');
        const drop = root.querySelector('.lg-scene-drop');
        const hidden = (node, pseudo = null) => getComputedStyle(node, pseudo).display === 'none';

        return {
          panelActive: panel.getAttribute('data-lg-scene'),
          panelFrostHidden: hidden(panel, '::before'),
          panelRingHidden: hidden(panel, '::after'),
          panelShadow: getComputedStyle(panel).boxShadow,
          buttonActive: button.getAttribute('data-lg-scene'),
          buttonLayersHidden: [
            '.lg-button__distortion',
            '.lg-button__tint',
            '.lg-button__rim',
          ].every((layer) => hidden(button.querySelector(layer))),
          buttonShadow: getComputedStyle(button).boxShadow,
          dropActive: drop.getAttribute('data-lg-scene'),
          dropFilter:
            getComputedStyle(drop).backdropFilter ?? getComputedStyle(drop).webkitBackdropFilter,
          canvasDisplay: getComputedStyle(root.querySelector('.lg-scene-canvas')).display,
        };
      }, scene);

      assert.equal(material.panelActive, 'active', 'the panel must register with the scene');
      assert.equal(material.buttonActive, 'active', 'the button must register with the scene');
      assert.equal(material.dropActive, 'active', 'the drop must register with the scene');
      assert.ok(
        material.panelFrostHidden && material.panelRingHidden,
        'the panel must shed its CSS frost and ring',
      );
      assert.equal(material.panelShadow, 'none', 'the panel must shed its CSS shadow');
      assert.ok(material.buttonLayersHidden, 'the button must shed its CSS frost, tint and rim');
      assert.equal(material.buttonShadow, 'none', 'the button must shed its CSS shadow');
      assert.ok(
        !material.dropFilter || material.dropFilter === 'none',
        'the drop must shed its CSS frost',
      );
      assert.notEqual(material.canvasDisplay, 'none', 'the canvas must show');

      return material;
    });

    await run(engine, 'F12 canvas passes clicks through', results, async () => {
      const button = page.locator(`${scene} .lg-button`).first();
      const box = await button.boundingBox();

      const hit = await page.evaluate(
        ({ x, y, target }) => {
          const node = document.elementFromPoint(x, y);

          return {
            onButton: Boolean(document.querySelector(target)?.contains(node)),
            tag: node?.tagName,
            className: String(node?.className),
          };
        },
        { x: box.x + box.width / 2, y: box.y + box.height / 2, target: `${scene} .lg-button` },
      );

      assert.ok(hit.onButton, `the button must receive the hit, not ${hit.tag}.${hit.className}`);
      const before = await button.getAttribute('aria-pressed');
      await button.click();
      await page.waitForFunction(
        ({ target, previous }) =>
          document.querySelector(target)?.getAttribute('aria-pressed') !== previous,
        { target: `${scene} .lg-button`, previous: before },
        { timeout: 2_000 },
      );
      await button.click();
      await page.mouse.move(1, 1);
      await settle(page);

      return hit;
    });

    await run(engine, 'F19 prominent tint', results, async () => {
      await addStyle(page, `${scene} .lg-button__label { color: transparent !important; }`);
      await settle(page);
      const button = await boxOf(page, `${scene} .lg-button--prominent`);
      const origin = await boxOf(page, scene);
      const { png, clip } = await sceneShot(page, `${engine}-prominent.png`);

      const [centre] = await analyse(statsPage, { a: png }, [
        {
          type: 'mean',
          rect: {
            x: button.x - clip.x + button.width * 0.2,
            y: button.y - clip.y + button.height / 2 - 3,
            width: 8,
            height: 6,
          },
        },
      ]);

      await clearStyles(page);
      const [red, green, blue] = centre.rgb;
      assert.ok(
        blue > red + 60 && blue > green + 20,
        `the prominent button must read accent blue (rgb ${centre.rgb.map(Math.round)})`,
      );

      return { rgb: centre.rgb.map(Math.round), origin };
    });

    await run(engine, 'F2 plain backdrop matches CSS', results, async () => {
      await setBackdrop(page, backdrops.colour);
      const exclude = (await registeredRects(page)).map((rect) => grow(rect, 72));
      const webgl = await sceneShot(page, `${engine}-backdrop-webgl.png`);

      await page.evaluate(() =>
        document.documentElement.setAttribute('data-lg-reduce-transparency', '1'),
      );
      await waitForRenderer(page, scene, 'off');
      await page.waitForTimeout(150);

      const css = await page.screenshot({
        clip: webgl.clip,
        path: path.join(artifactDirectory, `${engine}-backdrop-css.png`),
      });

      await page.evaluate(() =>
        document.documentElement.setAttribute('data-lg-reduce-transparency', '0'),
      );
      await waitForRenderer(page, scene, 'webgl');
      await settle(page);

      const [plain, control] = await analyse(statsPage, { a: webgl.png, b: css }, [
        { type: 'diff', exclude },
        { type: 'mean', image: 'a', exclude },
      ]);

      await setBackdrop(page, null);
      assert.ok(
        plain.count > 5_000,
        `the demo must leave backdrop visible around its glass (${plain.count} pixels)`,
      );
      assert.ok(control.luminance > 20, 'the canvas must not draw black');
      assert.ok(
        plain.meanDiff <= 8,
        `the canvas backdrop must match the CSS backdrop (mean diff ${plain.meanDiff.toFixed(2)})`,
      );

      return { meanDiff: Number(plain.meanDiff.toFixed(2)), pixels: plain.count };
    });

    await run(engine, 'F3 glass bends at the rim', results, async () => {
      await addStyle(page, `${scene} .lg-scene-drop { --lg-scene-frost: 0px !important; }`);
      // CSS and a canvas snap the tiles of a scaled SVG pattern differently,
      // so the checker is drawn at the scene's exact size: neither painting
      // scales it and both keep the same tile grid.
      const size = await page.locator(scene).boundingBox();
      await setBackdrop(page, svg(monoChecker, size.width, size.height));

      const drops = await page.evaluate((target) => {
        const root = document.querySelector(target);
        const origin = root.getBoundingClientRect();

        return [...root.querySelectorAll('.lg-scene-drop[data-lg-scene="active"]')].map((node) => {
          const rect = node.getBoundingClientRect();

          return {
            x: rect.x - origin.x,
            y: rect.y - origin.y,
            width: rect.width,
            height: rect.height,
          };
        });
      }, scene);

      assert.ok(drops.length >= 2, 'the demo must draw at least two scene drops');
      const glass = await sceneShot(page, `${engine}-rim-glass.png`);
      await addStyle(page, `${scene} .lg-scene-drop { visibility: hidden !important; }`);
      await settle(page);
      const plain = await sceneShot(page, `${engine}-rim-plain.png`);
      await clearStyles(page);
      await setBackdrop(page, null);

      const rows = [];

      for (const drop of drops) {
        const band = Math.min(12, drop.width / 6);
        const middle = drop.y + drop.height / 2 - drop.height / 8;

        const [left, right, centre] = await analyse(statsPage, { a: glass.png, b: plain.png }, [
          {
            type: 'diff',
            rect: { x: drop.x + 2, y: middle, width: band, height: drop.height / 4 },
          },
          {
            type: 'diff',
            rect: {
              x: drop.x + drop.width - 2 - band,
              y: middle,
              width: band,
              height: drop.height / 4,
            },
          },
          {
            type: 'diff',
            rect: {
              x: drop.x + drop.width * 0.4,
              y: drop.y + drop.height * 0.4,
              width: drop.width * 0.2,
              height: drop.height * 0.2,
            },
          },
        ]);

        const rim = (left.meanDiff + right.meanDiff) / 2;
        rows.push({ rim: Number(rim.toFixed(1)), centre: Number(centre.meanDiff.toFixed(1)) });
        assert.ok(rim > 25, `the rim must bend the backdrop (rim diff ${rim.toFixed(1)})`);
        assert.ok(
          rim > centre.meanDiff * 2,
          `the rim must bend more than the flat centre (${rim.toFixed(1)} vs ${centre.meanDiff.toFixed(1)})`,
        );
      }

      return rows;
    });

    await run(engine, 'F6 drops merge within the merge radius', results, async () => {
      const geometry = `
        ${scene} .lg-scene-drop { visibility: hidden !important; }
        ${scene} .lg-scene-drop:nth-of-type(1), ${scene} .lg-scene-drop:nth-of-type(2) {
          visibility: visible !important;
          position: absolute !important;
          inset: auto !important;
          top: 24px !important;
          width: 96px !important;
          height: 96px !important;
          border-radius: 50% !important;
          transform: none !important;
          animation: none !important;
          transition: none !important;
          --lg-scene-tint: rgb(255 255 255) !important;
        }
        ${scene} .lg-scene-drop:nth-of-type(1) { left: 24px !important; }
        ${scene} .lg-scene-drop:nth-of-type(2) { left: 132px !important; }
        ${scene} > :not(.lg-scene-drop):not(.lg-scene-backdrop):not(.lg-scene-canvas) { visibility: hidden !important; }
      `;

      const measureGap = async (merge, file) => {
        await clearStyles(page);
        await addStyle(
          page,
          `${geometry} ${scene} .lg-scene-drop { --lg-scene-merge: ${merge} !important; }`,
        );
        await settle(page);
        const { png, clip } = await sceneShot(page, file);
        const origin = await boxOf(page, scene);
        const offsetX = origin.x - clip.x;
        const offsetY = origin.y - clip.y;

        const [gap] = await analyse(statsPage, { a: png }, [
          { type: 'mean', rect: { x: offsetX + 124, y: offsetY + 24 + 44, width: 4, height: 8 } },
        ]);

        return gap.luminance;
      };

      await setBackdrop(page, backdrops.black);
      const bridged = await measureGap('40px', `${engine}-merge-40.png`);
      const apart = await measureGap('0px', `${engine}-merge-0.png`);
      await clearStyles(page);
      await setBackdrop(page, null);

      assert.ok(
        bridged > 60,
        `drops 12px apart must bridge at a 40px merge radius (gap luminance ${bridged.toFixed(1)})`,
      );
      assert.ok(apart < 20, `drops must stay apart at merge 0 (gap luminance ${apart.toFixed(1)})`);

      return { bridged: Number(bridged.toFixed(1)), apart: Number(apart.toFixed(1)) };
    });

    await run(engine, 'F5 canvas aligns with the DOM', results, async () => {
      const alignment = {};
      await checkAlignment(page, statsPage, 1, 'initial', alignment);
      await page.mouse.wheel(0, 37);
      await page.waitForTimeout(300);
      await checkAlignment(page, statsPage, 1, 'scrolled', alignment);

      return alignment;
    });

    await run(engine, 'F16 alignment after resize', results, async () => {
      const alignment = {};
      await page.setViewportSize({ width: 1024, height: 780 });
      await page.locator(scene).scrollIntoViewIfNeeded();
      await checkAlignment(page, statsPage, 1, 'resized', alignment);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.locator(scene).scrollIntoViewIfNeeded();
      await settle(page);

      return alignment;
    });

    await run(engine, 'F7 the glass ignores where the pointer is', results, async () => {
      await setBackdrop(page, backdrops.mono);

      // Pairs of spots the pointer rests on: two over open backdrop, two on the
      // card and two on the button. Each pair shares its hover state, so any
      // change between them could only come from where the pointer is.
      const pairs = await page.evaluate((target) => {
        const root = document.querySelector(target);
        const box = root.getBoundingClientRect();

        const rects = [...root.querySelectorAll('[data-lg-scene="active"]')].map((node) =>
          node.getBoundingClientRect(),
        );

        const clear = (x, y) =>
          rects.every(
            (rect) =>
              x < rect.left - 40 ||
              x > rect.right + 40 ||
              y < rect.top - 40 ||
              y > rect.bottom + 40,
          );

        const open = [];

        for (let y = box.top + 20; y < box.bottom - 20; y += 16) {
          for (let x = box.left + 20; x < box.right - 20; x += 16) {
            if (clear(x, y)) open.push({ x, y });
          }
        }

        const across = (selector) => {
          const rect = root.querySelector(selector).getBoundingClientRect();

          return [
            { x: rect.left + rect.width * 0.2, y: rect.top + rect.height * 0.3 },
            { x: rect.left + rect.width * 0.8, y: rect.top + rect.height * 0.7 },
          ];
        };

        return {
          open: open.length > 1 ? [open[0], open.at(-1)] : null,
          card: across('.lg-glass-surface'),
          button: across('.lg-button--prominent'),
        };
      }, scene);

      assert.ok(pairs.open, 'the demo must leave open backdrop for the pointer');
      const outcome = {};

      for (const [name, spots] of Object.entries(pairs)) {
        const shots = [];

        for (const [index, spot] of spots.entries()) {
          await page.mouse.move(spot.x, spot.y, { steps: 4 });
          await settle(page);
          shots.push(await sceneShot(page, `${engine}-pointer-${name}-${index}.png`));
        }

        // Tiles catch a highlight or bend that follows the pointer locally.
        const { width, height } = shots[0].clip;
        const tiles = [];

        for (let y = 0; y < height; y += 48) {
          for (let x = 0; x < width; x += 48)
            tiles.push({ type: 'diff', rect: { x, y, width: 48, height: 48 } });
        }

        const diffs = await analyse(statsPage, { a: shots[0].png, b: shots[1].png }, tiles);
        const worst = Math.max(...diffs.map((tile) => tile.meanDiff));
        outcome[name] = Number(worst.toFixed(2));
        assert.ok(
          worst < 0.5,
          `moving the pointer across the ${name} must change no glass (worst tile diff ${worst.toFixed(2)})`,
        );
      }

      await page.mouse.move(1, 1);
      await setBackdrop(page, null);

      return outcome;
    });

    await run(engine, 'F13 theme change retints the glass', results, async () => {
      await addStyle(page, `${scene} .lg-glass-surface > * { visibility: hidden !important; }`);
      await setBackdrop(page, backdrops.grey);

      const measureCard = async (file) => {
        const card = await boxOf(page, `${scene} .lg-glass-surface`);
        const { png, clip } = await sceneShot(page, file);

        const [centre] = await analyse(statsPage, { a: png }, [
          {
            type: 'mean',
            rect: {
              x: card.x - clip.x + card.width * 0.3,
              y: card.y - clip.y + card.height * 0.3,
              width: card.width * 0.4,
              height: card.height * 0.4,
            },
          },
        ]);

        return centre.luminance;
      };

      const dark = await measureCard(`${engine}-theme-dark.png`);
      const toggle = page.getByRole('button', { name: 'Change appearance' }).first();
      await toggle.click();
      await page.waitForFunction(
        () => document.documentElement.getAttribute('data-lg-theme') === 'light',
      );
      await page.mouse.move(1, 1);
      await settle(page);
      const light = await measureCard(`${engine}-theme-light.png`);
      await toggle.click();
      await page.waitForFunction(
        () => document.documentElement.getAttribute('data-lg-theme') === 'dark',
      );
      await page.mouse.move(1, 1);
      await clearStyles(page);
      await setBackdrop(page, null);

      assert.ok(
        light > dark + 12,
        `light glass must tint brighter than dark glass (${light.toFixed(1)} vs ${dark.toFixed(1)})`,
      );

      return { dark: Number(dark.toFixed(1)), light: Number(light.toFixed(1)) };
    });

    await run(engine, 'F20 text on glass keeps 4.5:1 over any backdrop', results, async () => {
      await addStyle(
        page,
        `${scene} .lg-glass-surface > *, ${scene} .lg-button__label { visibility: hidden !important; }`,
      );

      // The flat middle of each piece of glass, and the colour its text uses.
      const measureFaces = async (file) => {
        const { png, clip } = await sceneShot(page, file);

        const faces = await page.evaluate((target) => {
          const root = document.querySelector(target);

          return Object.entries({
            card: '.lg-glass-surface',
            button: '.lg-button--prominent',
            drop: '.lg-scene-drop',
          }).map(([name, selector]) => {
            const node = root.querySelector(selector);
            const rect = node.getBoundingClientRect();

            return {
              name,
              ink: getComputedStyle(node).getPropertyValue('--lg-scene-ink').trim(),
              rect: {
                x: rect.x + rect.width * 0.4,
                y: rect.y + rect.height * 0.4,
                width: rect.width * 0.2,
                height: rect.height * 0.2,
              },
            };
          });
        }, scene);

        const means = await analyse(
          statsPage,
          { a: png },
          faces.map(({ rect }) => ({
            type: 'mean',
            rect: { ...rect, x: rect.x - clip.x, y: rect.y - clip.y },
          })),
        );

        return Object.fromEntries(
          faces.map(({ name, ink }, index) => {
            const face = means[index].rgb;
            const parsed = parseRgb(ink);

            return [
              name,
              {
                face: face.map(Math.round),
                ink,
                luminance: Number(relativeLuminance(face).toFixed(3)),
                contrast:
                  parsed.alpha > 0 ? Number(contrastRatio(face, parsed.rgb).toFixed(2)) : null,
              },
            ];
          }),
        );
      };

      // Light ink on the brightest backdrop, then dark ink on the darkest.
      await setBackdrop(page, backdrops.white);
      const dark = await measureFaces(`${engine}-legible-dark.png`);
      const toggle = page.getByRole('button', { name: 'Change appearance' }).first();
      await toggle.click();
      await page.waitForFunction(
        () => document.documentElement.getAttribute('data-lg-theme') === 'light',
      );
      await page.mouse.move(1, 1);
      await setBackdrop(page, backdrops.black);
      const light = await measureFaces(`${engine}-legible-light.png`);
      await toggle.click();
      await page.waitForFunction(
        () => document.documentElement.getAttribute('data-lg-theme') === 'dark',
      );
      await page.mouse.move(1, 1);
      await clearStyles(page);
      await setBackdrop(page, null);

      for (const [theme, faces] of Object.entries({ dark, light })) {
        for (const name of ['card', 'button']) {
          assert.ok(
            faces[name].contrast >= 4.5,
            `${theme} ${name} glass must keep its ink ${faces[name].ink} at 4.5:1 (${faces[name].contrast}:1 on rgb ${faces[name].face})`,
          );
        }

        assert.equal(
          faces.drop.contrast,
          null,
          `a drop carries no text, so it must set no ink (${faces.drop.ink})`,
        );
      }

      assert.ok(
        dark.drop.luminance > 0.6,
        `a drop must keep the full brightness of a white backdrop (${dark.drop.luminance})`,
      );
      assert.ok(
        light.drop.luminance < 0.1,
        `a drop must keep the full depth of a black backdrop (${light.drop.luminance})`,
      );

      return { dark, light };
    });

    await run(engine, 'F27 tinted glass casts a tinted shadow', results, async () => {
      await addStyle(
        page,
        `${scene} .lg-glass-surface > *, ${scene} .lg-button__label { visibility: hidden !important; }`,
      );
      await setBackdrop(page, backdrops.white);
      const { png, clip } = await sceneShot(page, `${engine}-shadow-colour.png`);

      // A thin band just under the blue button and under the clear card, away
      // from their corners.
      const bands = await page.evaluate((target) => {
        const root = document.querySelector(target);

        return ['.lg-button--prominent', '.lg-glass-surface'].map((selector) => {
          const rect = root.querySelector(selector).getBoundingClientRect();

          return {
            x: rect.x + rect.width * 0.3,
            y: rect.bottom + 3,
            width: rect.width * 0.4,
            height: 5,
          };
        });
      }, scene);

      const [button, card] = await analyse(
        statsPage,
        { a: png },
        bands.map((rect) => ({
          type: 'mean',
          rect: { ...rect, x: rect.x - clip.x, y: rect.y - clip.y },
        })),
      );

      await clearStyles(page);
      await setBackdrop(page, null);

      const blueness = ([red, , blue]) => blue - red;
      assert.ok(
        blueness(button.rgb) > 5,
        `blue glass must cast a blue-tinted shadow (rgb ${button.rgb.map(Math.round)})`,
      );
      assert.ok(
        Math.abs(blueness(card.rgb)) < 2.5,
        `clear glass must cast a neutral shadow (rgb ${card.rgb.map(Math.round)})`,
      );
      assert.ok(
        card.luminance < 250,
        `clear glass must still shade a white backdrop (luminance ${card.luminance.toFixed(1)})`,
      );

      return { button: button.rgb.map(Math.round), card: card.rgb.map(Math.round) };
    });

    await run(engine, 'F11 context loss falls back and recovers', results, async () => {
      const before = await sceneShot(page);

      await page.evaluate((target) => {
        const canvas = document.querySelector(`${target} .lg-scene-canvas`);
        const context = canvas.getContext('webgl2');
        window.__glassLoss = context.getExtension('WEBGL_lose_context');
        window.__glassLoss.loseContext();
      }, scene);

      await waitForRenderer(page, scene, 'css');

      const lost = await page.evaluate((target) => {
        const root = document.querySelector(target);

        return {
          registered: root.querySelectorAll('[data-lg-scene]').length,
          canvasDisplay: getComputedStyle(root.querySelector('.lg-scene-canvas')).display,
        };
      }, scene);

      assert.equal(
        lost.registered,
        0,
        'a lost context must hand every element back to its CSS material',
      );
      assert.equal(lost.canvasDisplay, 'none', 'a lost context must hide the canvas');
      await page.evaluate(() => window.__glassLoss.restoreContext());
      await waitForRenderer(page, scene, 'webgl');
      await settle(page);
      const after = await sceneShot(page, `${engine}-restored.png`);

      const [difference] = await analyse(statsPage, { a: before.png, b: after.png }, [
        { type: 'diff' },
      ]);

      assert.ok(
        difference.meanDiff < 3,
        `the restored canvas must draw the same scene (mean diff ${difference.meanDiff.toFixed(2)})`,
      );

      return { lost, meanDiff: Number(difference.meanDiff.toFixed(2)) };
    });

    await run(engine, 'F18 frame timings', results, async () => {
      const timing = page.evaluate(
        () =>
          new Promise((resolve) => {
            const deltas = [];
            let last = performance.now();
            const end = last + 2_000;

            const tick = (now) => {
              deltas.push(now - last);
              last = now;

              if (now < end) requestAnimationFrame(tick);
              else {
                deltas.sort((a, b) => a - b);
                resolve({
                  frames: deltas.length,
                  median: Number(deltas[Math.floor(deltas.length / 2)].toFixed(2)),
                  p95: Number(deltas[Math.floor(deltas.length * 0.95)].toFixed(2)),
                  scale: document.querySelector('.lg-scene')?.getAttribute('data-lg-scene-scale'),
                });
              }
            };

            requestAnimationFrame(tick);
          }),
      );

      // Scrolling moves the scene's glass over the page, so every step redraws.
      for (let step = 0; step < 40; step += 1) {
        await page.mouse.wheel(0, step < 20 ? 12 : -12);
        await page.waitForTimeout(40);
      }

      return timing;
    });
  } finally {
    const found = problems(log, { allowContextLoss: true });
    results.console = log;

    if (found.length)
      failures.push(`${engine} demo console: ${found.map((entry) => entry.text).join(' | ')}`);

    await context.close();
  }
}

async function checkReducedTransparency(engine, browser, results) {
  await run(engine, 'F8 reduced transparency turns the canvas off', results, async () => {
    const outcomes = {};

    const variants = [
      { name: 'preference', options: { preferences: { reduceTransparency: true } } },
      ...(engine === 'chromium'
        ? [{ name: 'increased contrast', options: { contrast: 'more' } }]
        : []),
    ];

    for (const variant of variants) {
      const context = await newContext(browser, variant.options);

      try {
        const page = await context.newPage();
        await openDemo(page);
        await page.waitForTimeout(1_200);

        const state = await page.evaluate((target) => {
          const root = document.querySelector(target);
          const panel = root.querySelector('.lg-glass-surface');

          return {
            renderer: root.getAttribute('data-lg-scene-renderer'),
            registered: root.querySelectorAll('[data-lg-scene]').length,
            canvasDisplay: getComputedStyle(root.querySelector('.lg-scene-canvas')).display,
            panelFrostShown: getComputedStyle(panel, '::before').display !== 'none',
          };
        }, scene);

        outcomes[variant.name] = state;
        assert.equal(state.renderer, 'off', `${variant.name} must switch the scene off`);
        assert.equal(
          state.registered,
          0,
          `${variant.name} must leave every element on its CSS material`,
        );
        assert.equal(state.canvasDisplay, 'none', `${variant.name} must hide the canvas`);
        assert.ok(state.panelFrostShown, `${variant.name} must keep the panel's own surface`);
      } finally {
        await context.close();
      }
    }

    return outcomes;
  });
}

async function checkMissingWebgl(engine, browser, results) {
  await run(engine, 'F10 missing WebGL2 warns once', results, async () => {
    const context = await newContext(browser);

    try {
      await context.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;

        HTMLCanvasElement.prototype.getContext = function patched(type, ...rest) {
          return type === 'webgl2' ? null : getContext.call(this, type, ...rest);
        };
      });

      const page = await context.newPage();
      const log = [];
      watchConsole(page, log);

      await page.goto(new URL('/', baseUrl).href, { waitUntil: 'load' });
      await page.waitForTimeout(1_500);

      const state = await page.evaluate(() => ({
        renderers: [...document.querySelectorAll('.lg-scene')].map((node) =>
          node.getAttribute('data-lg-scene-renderer'),
        ),
        registered: document.querySelectorAll('.lg-scene [data-lg-scene]').length,
      }));

      const warnings = log.filter(
        (entry) => entry.type === 'warning' && entry.text.includes(warningPrefix),
      );

      assert.ok(
        state.renderers.length >= 2,
        `the homepage must render its scenes (${state.renderers.length})`,
      );
      assert.ok(
        state.renderers.every((value) => value === 'css'),
        `every scene must fall back to css (${state.renderers})`,
      );
      assert.equal(state.registered, 0, 'no element may shed its CSS material without WebGL2');
      assert.equal(
        warnings.length,
        1,
        `exactly one warning must explain the fallback (${warnings.length})`,
      );

      return { ...state, warning: warnings[0].text };
    } finally {
      await context.close();
    }
  });
}

const assetOrigin = 'http://assets.glassyui.test';

// Sets the demo scene's backdrop to url and records the requests for it, in
// order. A routed answer carries no Sec-Fetch headers, so a CORS request shows
// by its Origin header. Playwright adds a matching CORS header to a routed
// answer without one, so a refusal names another origin.
async function loadBackdrop(browser, url, expected, allowOrigin) {
  const context = await newContext(browser);

  try {
    if (allowOrigin) {
      const body = fs.readFileSync(
        new URL('../public/wallpapers/lagoon-dark.svg', import.meta.url),
      );

      await context.route(`${assetOrigin}/**`, (route) =>
        route.fulfill({
          contentType: 'image/svg+xml',
          headers: { 'Access-Control-Allow-Origin': allowOrigin },
          body,
        }),
      );
    }

    const page = await context.newPage();
    const log = [];
    const events = [];
    const modes = [];
    const kind = (request) => (request.headers().origin ? 'cors' : 'shared');
    watchConsole(page, log);

    page.on('request', (request) => {
      if (request.url() !== url) return;

      events.push(`start ${kind(request)}`);
      modes.push(request.allHeaders().then((headers) => headers['sec-fetch-mode']));
    });

    page.on('requestfinished', (request) => {
      if (request.url() === url) events.push(`end ${kind(request)}`);
    });

    page.on('requestfailed', (request) => {
      if (request.url() === url) events.push(`failed ${kind(request)}`);
    });

    await openDemo(page);
    await settle(page);
    await page.evaluate(
      ({ target, backdrop }) =>
        document.querySelector(target).style.setProperty('--lg-scene-backdrop', backdrop),
      { target: scene, backdrop: `url("${url}")` },
    );

    await page.waitForFunction(
      ({ target, state }) => {
        const node = document.querySelector(target);

        return (
          `${node.getAttribute('data-lg-scene-renderer')}/${node.getAttribute('data-lg-scene-backdrop')}` ===
          state
        );
      },
      { target: scene, state: expected },
      { timeout: 8_000 },
    );

    await page.waitForTimeout(300);

    return {
      events,
      modes: await Promise.all(modes),
      warnings: log.flatMap((entry) => (entry.text.includes(warningPrefix) ? [entry.text] : [])),
    };
  } finally {
    await context.close();
  }
}

async function checkBackdropRequests(engine, browser, results) {
  await run(engine, 'F21 a same-origin backdrop loads once', results, async () => {
    const outcome = await loadBackdrop(
      browser,
      new URL('/wallpapers/lagoon-dark.svg?backdrop-check', baseUrl).href,
      'webgl/ready',
    );

    assert.deepEqual(
      outcome.events,
      ['start shared', 'end shared'],
      'the renderer must share the page request for a same-origin backdrop',
    );
    assert.deepEqual(outcome.modes, ['no-cors'], 'a same-origin backdrop needs no CORS request');
    assert.deepEqual(outcome.warnings, [], 'a same-origin backdrop must load without a warning');

    return outcome;
  });

  await run(engine, 'F22 a cross-origin backdrop needs CORS', results, async () => {
    const allowed = await loadBackdrop(browser, `${assetOrigin}/allowed.svg`, 'webgl/ready', '*');

    const refused = await loadBackdrop(
      browser,
      `${assetOrigin}/refused.svg`,
      'css/error',
      'https://elsewhere.invalid',
    );

    assert.deepEqual(
      allowed.events,
      ['start shared', 'end shared', 'start cors', 'end cors'],
      'another origin must get its CORS copy only after the shared load',
    );
    assert.deepEqual(
      allowed.warnings,
      [],
      'a backdrop that allows any origin must load without a warning',
    );
    assert.deepEqual(
      refused.events.slice(0, 3),
      ['start shared', 'end shared', 'start cors'],
      'a refused backdrop must still share the page request first',
    );
    assert.equal(
      refused.warnings.length,
      1,
      `exactly one warning must explain the refused backdrop (${refused.warnings.length})`,
    );
    assert.match(refused.warnings[0], /failed to load with CORS/, 'the warning must name CORS');

    return { allowed, refused };
  });
}

// Turns the demo's flow on from the keyboard.
async function startFlow(page) {
  await page.locator(scene).getByRole('button', { name: 'Flow' }).focus();
  await page.keyboard.press('Enter');
  await page.locator(`${scene} .lg-button[aria-pressed="true"]`, { hasText: 'Flow' }).waitFor();
}

async function checkFlow(engine, browser, statsPage, results) {
  await run(engine, 'F9 reduced motion stops the flow', results, async () => {
    const outcome = {};

    for (const reducedMotion of ['no-preference', 'reduce']) {
      const context = await newContext(browser, { reducedMotion });

      try {
        const page = await context.newPage();
        await openDemo(page);
        await waitForRenderer(page, scene, 'webgl');
        await startFlow(page);
        await page.waitForTimeout(1_200);
        const { png: first, clip } = await sceneShot(page, `${engine}-flow-${reducedMotion}.png`);
        await page.waitForTimeout(500);
        const second = await page.screenshot({ clip });
        const [difference] = await analyse(statsPage, { a: first, b: second }, [{ type: 'diff' }]);
        outcome[reducedMotion] = Number(difference.meanDiff.toFixed(3));
      } finally {
        await context.close();
      }
    }

    assert.ok(
      outcome['no-preference'] > 0.05,
      `the drops must flow without reduced motion (${outcome['no-preference']})`,
    );
    assert.ok(
      outcome.reduce < 0.01,
      `reduced motion must hold the drops still (${outcome.reduce})`,
    );

    return outcome;
  });

  const context = await newContext(browser);
  const log = [];

  try {
    await instrument(context);
    const page = await context.newPage();
    watchConsole(page, log);
    await run(engine, 'F14 offscreen scenes pause', results, async () => {
      await openDemo(page);
      await waitForRenderer(page, scene, 'webgl');
      await startFlow(page);
      await page.waitForTimeout(500);
      const running = await countFrames(page, 1_000);
      await page.evaluate(() =>
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
      );
      await page.waitForTimeout(1_500);
      const demo = await readRenderer(page, scene);
      const idle = await countFrames(page, 1_000);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));

      assert.equal(demo.state, 'paused', `the offscreen scene must pause (${demo.state})`);
      assert.ok(running > 20, `the flowing scene must animate (${running} frames per second)`);
      assert.ok(idle <= 3, `an offscreen scene must stop requesting frames (${idle} per second)`);

      return { running, idle, demo };
    });

    if (results['F14 offscreen scenes pause']?.failed) return;

    await run(engine, 'F15 navigation leaves no loop', results, async () => {
      await page.waitForTimeout(500);
      const flowing = await countFrames(page, 500);
      await page
        .getByRole('navigation', { name: 'Primary' })
        .getByRole('link', { name: 'Docs' })
        .click();
      await page.waitForURL('**/docs');
      await page.waitForTimeout(1_500);
      const frames = await countFrames(page, 1_000);
      const scenes = await page.evaluate(() => document.querySelectorAll('.lg-scene').length);

      assert.ok(
        flowing > 10,
        `the scene must be flowing before the page leaves (${flowing} frames in 500 ms)`,
      );
      assert.equal(scenes, 0, 'the docs page must not keep a scene');
      assert.ok(
        frames <= 3,
        `an unmounted scene must stop requesting frames (${frames} per second)`,
      );

      return { flowing, frames };
    });
  } finally {
    const found = problems(log);
    results.flowConsole = log;

    if (found.length)
      failures.push(`${engine} flow console: ${found.map((entry) => entry.text).join(' | ')}`);

    await context.close();
  }
}

async function checkHomepage(engine, browser, results) {
  const context = await newContext(browser);
  const log = [];

  try {
    const page = await context.newPage();
    watchConsole(page, log);
    await run(engine, 'desk reaches webgl', results, async () => {
      await page.goto(new URL('/', baseUrl).href, { waitUntil: 'load' });
      await page.locator(deskScene).scrollIntoViewIfNeeded();
      await waitForRenderer(page, deskScene, 'webgl');
      await page.screenshot({ path: path.join(artifactDirectory, `${engine}-home.png`) });
    });
  } finally {
    const found = problems(log);
    results.homeConsole = log;

    if (found.length)
      failures.push(`${engine} homepage console: ${found.map((entry) => entry.text).join(' | ')}`);

    await context.close();
  }
}

function componentPage(slug) {
  return new URL(`/components/${slug}`, baseUrl).href;
}

// Records, once a frame, what the liquid motion writes on an element: its
// size, lift and stretch, whether it is travelling, its knob's scale and the
// largest scale painted on a sibling and any movement of the labels' text boxes.
function sampleMotion(page, selector, duration) {
  return page.evaluate(
    ({ target, span }) =>
      new Promise((resolve) => {
        const node = document.querySelector(target);

        const siblings = [...(node.parentElement?.children ?? [])].filter(
          (child) => child !== node,
        );

        const labels = siblings.filter((child) => child.matches('[role="radio"], [role="tab"]'));

        const textBoxes = () => {
          const parent = node.parentElement.getBoundingClientRect();

          return labels.map((label) => {
            const range = document.createRange();
            range.selectNodeContents(label);
            const box = range.getBoundingClientRect();

            return [box.x - parent.x, box.y - parent.y, box.width, box.height];
          });
        };

        const restingText = textBoxes();

        const frames = [];
        const start = performance.now();

        const tick = (now) => {
          const knob = node.querySelector('.lg-switch-thumb');
          const box = node.getBoundingClientRect();

          frames.push({
            width: box.width,
            height: box.height,
            lift: Number(node.style.getPropertyValue('--lg-lift') || 0),
            stretch: Number(node.style.getPropertyValue('--lg-stretch-x') || 1),
            moving: node.hasAttribute('data-lg-moving'),
            knob: knob ? parseFloat(getComputedStyle(knob).scale) || 1 : 1,
            labels: Math.max(1, ...siblings.map((child) => parseFloat(child.style.scale) || 1)),
            labelDrift: Math.max(
              0,
              ...textBoxes().flatMap((box, index) =>
                box.map((value, axis) => Math.abs(value - restingText[index][axis])),
              ),
            ),
          });

          if (now - start < span) requestAnimationFrame(tick);
          else resolve(frames);
        };

        requestAnimationFrame(tick);
      }),
    { target: selector, span: duration },
  );
}

async function motionShot(page, selector, margin, file) {
  const box = await boxOf(page, selector);

  const clip = roundClip({
    x: box.x - margin,
    y: box.y - margin,
    width: box.width + margin * 2,
    height: box.height + margin * 2,
  });

  await page.screenshot({ clip, path: path.join(artifactDirectory, file) });
}

// How far a bubble sits from the item it belongs on, in CSS pixels, and
// whether it has settled with every label back at its own size.
function bubbleOffset(page, bubble, owner) {
  return page.evaluate(
    ({ bubbleSelector, ownerSelector }) => {
      const drawn = document.querySelector(bubbleSelector);
      const box = drawn.getBoundingClientRect();
      const item = document.querySelector(ownerSelector).getBoundingClientRect();
      const labels = [...drawn.parentElement.children].filter((node) => node !== drawn);

      return {
        centre: Math.abs(box.left + box.width / 2 - (item.left + item.width / 2)),
        width: Math.abs(box.width - item.width),
        lift: drawn.style.getPropertyValue('--lg-lift'),
        magnified: labels.filter((node) => node.style.scale !== '').length,
      };
    },
    { bubbleSelector: bubble, ownerSelector: owner },
  );
}

function assertLanded(offset, what) {
  assert.ok(
    offset.centre < 0.5 && offset.width < 0.5,
    `${what} must land on its item (${JSON.stringify(offset)})`,
  );
}

const widest = (frames, key) => Math.max(...frames.map((frame) => frame[key]));

async function checkSegmented(engine, page, results) {
  await page.goto(componentPage('glass-segmented-control'), { waitUntil: 'load' });
  await page.waitForSelector(`${segmented}[data-lg-indicator="ready"]`);

  const segments = page.locator(`${segmented} [role="radio"]`);
  const last = (await segments.count()) - 1;

  await run(
    engine,
    'L1 segmented bubble slides with restrained stretch and lift',
    results,
    async () => {
      const rest = await boxOf(page, segmentedBubble);
      const sampling = sampleMotion(page, segmentedBubble, 700);

      await segments.nth(last).click();
      await page.waitForTimeout(120);
      await motionShot(page, segmented, 20, `${engine}-segmented-travel.png`);

      const frames = await sampling;

      const outcome = {
        rest: rest.width,
        widest: widest(frames, 'width'),
        tallest: Number((widest(frames, 'height') / rest.height).toFixed(3)),
        shortest: Number(
          (Math.min(...frames.map((frame) => frame.height)) / rest.height).toFixed(3),
        ),
        lift: widest(frames, 'lift'),
        labels: widest(frames, 'labels'),
        labelDrift: widest(frames, 'labelDrift'),
      };

      assert.ok(
        outcome.widest > rest.width * 1.02 && outcome.widest < rest.width * 1.2,
        `the bubble must stretch subtly toward the new item (${JSON.stringify(outcome)})`,
      );
      assert.ok(
        outcome.lift > 0.1 && outcome.lift < 0.3,
        `the bubble must lift slightly while it travels (${outcome.lift})`,
      );
      assert.ok(
        outcome.tallest < 1.02 && outcome.shortest >= 0.95,
        `the bubble must stay near its size while it travels (${JSON.stringify(outcome)})`,
      );
      assert.ok(
        outcome.labelDrift < 0.05,
        `segment labels must stay fixed while the bubble travels (${outcome.labelDrift}px drift)`,
      );

      return outcome;
    },
  );

  await run(engine, 'L2 segmented bubble lands on the checked item', results, async () => {
    await page.waitForTimeout(900);

    const offset = await bubbleOffset(page, segmentedBubble, checkedSegment);

    assertLanded(offset, 'the bubble');
    assert.equal(offset.lift, '0.000', 'the bubble must settle back down');
    assert.equal(offset.magnified, 0, 'every label must return to its own size');

    return offset;
  });

  await run(engine, 'L3 a dragged bubble checks the item it is dropped on', results, async () => {
    const from = await segments.nth(last).boundingBox();
    const to = await segments.nth(0).boundingBox();
    const y = from.y + from.height / 2;
    const start = from.x + from.width / 2;
    const end = to.x + to.width / 2;
    const sampling = sampleMotion(page, segmentedBubble, 700);

    await page.mouse.move(start, y);
    await page.mouse.down();

    for (let step = 1; step <= 12; step += 1) {
      await page.mouse.move(start + (end - start) * (step / 12), y);
      await page.waitForTimeout(16);
    }

    const dragging = await page.locator(segmented).getAttribute('data-lg-dragging');

    await motionShot(page, segmented, 20, `${engine}-segmented-drag.png`);
    await page.mouse.up();
    await page.waitForTimeout(900);

    const outcome = {
      dragging: dragging !== null,
      checked: await segments.nth(0).getAttribute('data-state'),
      released: (await page.locator(segmented).getAttribute('data-lg-dragging')) === null,
      offset: await bubbleOffset(page, segmentedBubble, checkedSegment),
      labelDrift: widest(await sampling, 'labelDrift'),
    };

    assert.ok(outcome.dragging, 'the bubble must follow the pointer');
    assert.equal(outcome.checked, 'checked', 'dropping the bubble must check the item under it');
    assert.ok(outcome.released, 'letting go must end the drag');
    assertLanded(outcome.offset, 'the dropped bubble');
    assert.ok(
      outcome.labelDrift < 0.05,
      `segment labels must stay fixed during a drag (${outcome.labelDrift}px drift)`,
    );

    return outcome;
  });

  await run(engine, 'L4 arrow keys carry the bubble', results, async () => {
    // Radix checks the radio an arrow key focuses only while the key is still
    // down, and it moves focus a task later, so hold the key as a person does.
    await segments.nth(0).focus();
    const sampling = sampleMotion(page, segmentedBubble, 700);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(60);
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(900);

    const checked = await segments.nth(1).getAttribute('data-state');
    const offset = await bubbleOffset(page, segmentedBubble, checkedSegment);

    assert.equal(checked, 'checked', 'the arrow key must check the next item');
    assertLanded(offset, 'the bubble');
    const labelDrift = widest(await sampling, 'labelDrift');
    assert.ok(
      labelDrift < 0.05,
      `segment labels must stay fixed during keyboard selection (${labelDrift}px drift)`,
    );

    return { ...offset, labelDrift };
  });
}

async function checkTabs(engine, page, results) {
  await run(engine, 'L5 tabs hand over to one travelling bubble', results, async () => {
    await page.goto(componentPage('glass-tabs'), { waitUntil: 'load' });
    await page.waitForSelector(`${tabList}[data-lg-indicator="ready"]`);

    const triggers = page.locator(`${tabList} [role="tab"]`);
    const sampling = sampleMotion(page, tabBubble, 700);

    await triggers.nth((await triggers.count()) - 1).click();

    const frames = await sampling;
    const lift = widest(frames, 'lift');
    const labelDrift = widest(frames, 'labelDrift');

    await page.waitForTimeout(900);

    const drawn = await page.evaluate(
      ({ bubble, active }) => ({
        display: getComputedStyle(document.querySelector(bubble)).display,
        triggerBackground: getComputedStyle(document.querySelector(active)).backgroundColor,
      }),
      { bubble: tabBubble, active: activeTab },
    );

    const offset = await bubbleOffset(page, tabBubble, activeTab);

    assert.ok(lift > 0.5, `the bubble must lift while it travels (${lift})`);
    assert.equal(drawn.display, 'block', 'the shared bubble must be drawn');
    assert.match(
      drawn.triggerBackground,
      /rgba\(0, 0, 0, 0\)|transparent/,
      'the active tab must not draw a second bubble',
    );
    assertLanded(offset, 'the bubble');
    assert.ok(
      labelDrift < 0.05,
      `tab labels must stay fixed while the bubble travels (${labelDrift}px drift)`,
    );

    return { lift, labelDrift, ...drawn, ...offset };
  });
}

async function checkSwitch(engine, page, results) {
  await run(
    engine,
    'L6 switch knob turns to glass and stretches as it slides',
    results,
    async () => {
      await page.goto(componentPage('glass-switch'), { waitUntil: 'load' });

      const sampling = sampleMotion(page, toggle, 600);

      await page.locator(toggle).first().click();
      await page.waitForTimeout(110);
      await motionShot(page, toggle, 24, `${engine}-switch-travel.png`);

      const frames = await sampling;

      await page.waitForTimeout(300);

      const outcome = {
        moving: frames.some((frame) => frame.moving),
        knob: widest(frames, 'knob'),
        landed: await page
          .locator(toggle)
          .first()
          .evaluate((node) => !node.hasAttribute('data-lg-moving')),
      };

      assert.ok(
        outcome.moving && outcome.knob > 1.45,
        `the knob must stretch while it slides (${JSON.stringify(outcome)})`,
      );
      assert.ok(outcome.landed, 'the knob must turn solid again once it lands');

      return outcome;
    },
  );
}

// Reduce motion is a switch that changes the very setting that governs its own flip. Turning
// it on must show the change, and turning it off must animate as much as any other switch:
// the knob may not snap because the old setting was still on when it moved.
async function checkReduceMotionSwitch(engine, browser, results) {
  const context = await newContext(browser);

  try {
    await context.addInitScript(() => {
      window.__offscreenGlassShaders = 0;
      const compile = WebGL2RenderingContext.prototype.compileShader;

      WebGL2RenderingContext.prototype.compileShader = function (shader) {
        const root = this.canvas.closest('.lg-scene');

        if (root) {
          const box = root.getBoundingClientRect();

          if (box.bottom <= 0 || box.top >= innerHeight || box.width === 0 || box.height === 0)
            window.__offscreenGlassShaders += 1;
        }

        return compile.call(this, shader);
      };
    });

    const page = await context.newPage();
    const knob = '.bento-tile--settings .bento-switch:last-child [role="switch"]';

    // The knob slides when a translate transition runs on it to its end, so the flip records
    // the knob's own transition events instead of its position each frame: a headless engine
    // can paint too few frames to sample a short slide. The record opens before the click and
    // closes once the slide has ended, however long the click takes to land.
    const flip = async () => {
      await page.evaluate((target) => {
        const root = document.querySelector(target);
        const thumb = root.querySelector('.lg-switch-thumb');

        // Translation, independent of the knob's symmetrical stretch (covered by L6). Its
        // left edge moves even when its centre is still.
        const offset = () => {
          const box = thumb.getBoundingClientRect();
          const track = root.getBoundingClientRect();

          return box.left + box.width / 2 - (track.left + track.width / 2);
        };

        const from = offset();
        const slides = [];
        let cancelled = 0;

        const onEnd = (event) => {
          if (event.target === thumb && event.propertyName === 'translate')
            slides.push(Math.round(event.elapsedTime * 1000));
        };

        const onCancel = (event) => {
          if (event.target === thumb && event.propertyName === 'translate') cancelled += 1;
        };

        thumb.addEventListener('transitionend', onEnd);
        thumb.addEventListener('transitioncancel', onCancel);

        window.__knobFlip = {
          settled: () => slides.length + cancelled > 0,
          finish: () => {
            thumb.removeEventListener('transitionend', onEnd);
            thumb.removeEventListener('transitioncancel', onCancel);

            return {
              travel: Math.abs(offset() - from),
              slides,
              cancelled,
              sameKnob: root.querySelector('.lg-switch-thumb') === thumb,
            };
          },
        };
      }, knob);

      await page.locator(knob).click();

      // A knob that snaps never settles, so the wait ends on its own and the record shows it.
      await page
        .waitForFunction(() => window.__knobFlip.settled(), null, { polling: 50, timeout: 3_000 })
        .catch(() => {});

      return page.evaluate(() => window.__knobFlip.finish());
    };

    await run(engine, 'L11 the Reduce motion switch animates both ways', results, async () => {
      await page.goto(new URL('/', baseUrl).href, { waitUntil: 'load' });
      await page.locator(knob).scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);

      const phoneControl = await page.locator('.turn-player .lg-segmented').elementHandle();

      await page.evaluate(() => {
        window.__offscreenGlassShaders = 0;
      });

      const on = await flip();

      await page.waitForTimeout(400);

      const off = await flip();

      const offscreenShaders = await page.evaluate(() => window.__offscreenGlassShaders);
      assert.equal(offscreenShaders, 0, 'the preference flip must not compile offscreen glass');

      assert.ok(
        await page
          .locator('.turn-player .lg-segmented')
          .evaluate((node, original) => node === original, phoneControl),
        'changing the motion preference must preserve the initialized phone controls',
      );

      for (const [direction, outcome] of [
        ['on', on],
        ['off', off],
      ]) {
        assert.ok(
          outcome.travel > 12,
          `the knob must travel turning motion ${direction} (${JSON.stringify(outcome)})`,
        );
        assert.ok(
          outcome.sameKnob,
          `the knob must stay mounted turning motion ${direction} (${JSON.stringify(outcome)})`,
        );
        assert.ok(
          outcome.cancelled === 0 && outcome.slides.some((duration) => duration >= 100),
          `the knob must slide, not snap, turning motion ${direction} (${JSON.stringify(outcome)})`,
        );
      }

      return { on, off };
    });
  } finally {
    await context.close();
  }
}

async function checkSlider(engine, page, results) {
  await run(engine, 'L7 slider knob stretches with its speed and settles', results, async () => {
    await page.goto(componentPage('glass-slider'), { waitUntil: 'load' });
    await page.locator(sliderKnob).waitFor({ state: 'visible' });

    const knob = await boxOf(page, sliderKnob);
    const track = await boxOf(page, slider);
    const y = knob.y + knob.height / 2;
    const start = knob.x + knob.width / 2;
    const sampling = sampleMotion(page, sliderKnob, 900);

    await page.mouse.move(start, y);
    await page.mouse.down();

    for (let step = 1; step <= 10; step += 1) {
      await page.mouse.move(start - (knob.x - track.x) * (step / 10), y);
      await page.waitForTimeout(16);

      if (step === 5) await motionShot(page, slider, 24, `${engine}-slider-drag.png`);
    }

    await page.mouse.up();

    const stretch = widest(await sampling, 'stretch');

    await page.waitForTimeout(1_500);

    const leftover = await page
      .locator(sliderKnob)
      .first()
      .evaluate((node) => node.style.getPropertyValue('--lg-stretch-x'));

    assert.ok(stretch > 1.05, `the knob must stretch while dragged (${stretch})`);
    assert.equal(leftover, '', 'the knob must settle back into shape');

    return { stretch };
  });
}

async function checkButton(engine, page, results) {
  await run(engine, 'L8 a press blooms from where it lands', results, async () => {
    await page.goto(componentPage('glass-button'), { waitUntil: 'load' });

    const box = await boxOf(page, pressable);

    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(90);

    const bloom = await page
      .locator(pressable)
      .first()
      .evaluate((node) => {
        const light = node.querySelector('.lg-button__bloom');

        return {
          running: light.getAnimations().length,
          x: parseFloat(light.style.getPropertyValue('--lg-bloom-x')),
        };
      });

    await motionShot(page, pressable, 24, `${engine}-button-press.png`);
    await page.mouse.up();

    assert.ok(bloom.running > 0, 'a press must start the bloom');
    assert.ok(
      bloom.x < box.width * 0.4,
      `the bloom must start where the press landed (${bloom.x})`,
    );

    return bloom;
  });
}

// Liquid motion needs no WebGL: every engine runs the same controls.
async function checkMotion(engine, browser, results) {
  const context = await newContext(browser, { scale: 2 });

  try {
    const page = await context.newPage();
    const log = [];
    watchConsole(page, log);
    await checkSegmented(engine, page, results);
    await checkTabs(engine, page, results);
    await checkSwitch(engine, page, results);
    await checkSlider(engine, page, results);
    await checkButton(engine, page, results);

    await run(engine, 'L10 liquid motion logs no errors', results, async () => {
      assert.deepEqual(problems(log), [], 'the control pages must log no errors');
    });
  } finally {
    await context.close();
  }
}

// Reduced motion keeps each control's end state and drops the travel.
async function checkReducedMotion(engine, browser, results) {
  await run(engine, 'L9 reduced motion keeps only the end states', results, async () => {
    const context = await newContext(browser, { reducedMotion: 'reduce' });

    try {
      const page = await context.newPage();
      await page.goto(componentPage('glass-segmented-control'), { waitUntil: 'load' });
      await page.waitForSelector(`${segmented}[data-lg-indicator="ready"]`);

      const segments = page.locator(`${segmented} [role="radio"]`);
      const bubbleFrames = sampleMotion(page, segmentedBubble, 400);

      await segments.nth((await segments.count()) - 1).click();

      const bubble = await bubbleFrames;
      const first = bubble[0].width;
      const final = bubble.at(-1).width;
      const offset = await bubbleOffset(page, segmentedBubble, checkedSegment);

      await page.goto(componentPage('glass-switch'), { waitUntil: 'load' });

      const switchFrames = sampleMotion(page, toggle, 500);

      await page.locator(toggle).first().click();

      const knob = await switchFrames;

      await page.goto(componentPage('glass-slider'), { waitUntil: 'load' });
      await page.locator(sliderKnob).waitFor({ state: 'visible' });

      const thumb = await boxOf(page, sliderKnob);
      const track = await boxOf(page, slider);
      const sliderFrames = sampleMotion(page, sliderKnob, 500);

      await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
      await page.mouse.down();
      await page.mouse.move(track.x + 4, thumb.y + thumb.height / 2, { steps: 6 });
      await page.mouse.up();

      const stretched = await sliderFrames;

      await page.goto(componentPage('glass-button'), { waitUntil: 'load' });

      const box = await boxOf(page, pressable);

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(90);

      const blooms = await page
        .locator(pressable)
        .first()
        .evaluate((node) => node.querySelector('.lg-button__bloom').getAnimations().length);

      await page.mouse.up();

      const outcome = {
        lift: widest(bubble, 'lift'),
        widest: widest(bubble, 'width'),
        ends: [first, final],
        offset,
        knobMoved: knob.some((frame) => frame.moving),
        stretch: widest(stretched, 'stretch'),
        blooms,
      };

      assert.equal(outcome.lift, 0, 'the bubble must not lift');
      assert.ok(
        outcome.widest <= Math.max(first, final) + 0.5,
        'the bubble must not stretch on its way',
      );
      assertLanded(offset, 'the bubble');
      assert.ok(!outcome.knobMoved, 'the switch knob must not travel as glass');
      assert.equal(outcome.stretch, 1, 'the slider knob must keep its shape');
      assert.equal(outcome.blooms, 0, 'a press must not bloom');

      return outcome;
    } finally {
      await context.close();
    }
  });
}

async function checkServerHtml(results) {
  await run('server', 'F17 server HTML starts on css', results, async () => {
    const pages = {};

    for (const route of ['/', '/components/glass-scene']) {
      const html = await (await fetch(new URL(route, baseUrl))).text();

      const renderers = [...html.matchAll(/data-lg-scene-renderer="([a-z]+)"/g)].map(
        (match) => match[1],
      );

      pages[route] = renderers;
      assert.ok(renderers.length > 0, `${route} must server-render its scene`);
      assert.ok(
        renderers.every((value) => value === 'css'),
        `${route} must start on the CSS material (${renderers})`,
      );
    }

    return pages;
  });
}

// Drives one of the lab's optics sliders to its minimum or maximum.
async function setOptic(page, label, key) {
  await page.locator(`.home-lab [role="slider"][aria-label="${label}"]`).press(key);
}

async function setOptics(page, keys) {
  for (const [label, key] of Object.entries(keys)) await setOptic(page, label, key);

  await page.mouse.move(1, 1);
  await settle(page, labScene);
}

async function resetLab(page) {
  await clearStyles(page);
  await page.locator('.home-lab').getByRole('button', { name: 'Reset' }).click();
  await page.mouse.move(1, 1);
  await setBackdrop(page, null, labScene);
}

// The measured drop as a circle in screenshot pixels, and its bevel width.
async function dropCircle(page, clip) {
  const box = await boxOf(page, labDrop);
  const r = box.width / 2;

  return { cx: box.x - clip.x + r, cy: box.y - clip.y + box.height / 2, r, bevel: Math.min(28, r) };
}

// The left and right thirds of a drop's rim, where the surface tilts sideways.
function sideRim({ cx, cy, r, bevel }) {
  return {
    only: [{ cx, cy, r: r - 2 }],
    exclude: [
      { cx, cy, r: r - bevel },
      { x: cx - r, y: cy - r, width: r * 2, height: r * 0.6 },
      { x: cx - r, y: cy + r * 0.4, width: r * 2, height: r * 0.6 },
    ],
  };
}

// The whole rim ring, inside the outer anti-aliased pixel.
function rimRing({ cx, cy, r, bevel }) {
  return { only: [{ cx, cy, r: r - 2 }], exclude: [{ cx, cy, r: r - bevel }] };
}

// The flat face, well inside the bevel.
function flatFace({ cx, cy, r, bevel }) {
  return { only: [{ cx, cy, r: r - bevel - 4 }] };
}

async function checkOptics(engine, browser, statsPage, results) {
  const context = await newContext(browser);
  const log = [];

  try {
    const page = await context.newPage();
    watchConsole(page, log);
    await run(engine, 'lab reaches webgl', results, async () => {
      await page.goto(new URL('/', baseUrl).href, { waitUntil: 'load' });
      // Load can precede React's keynote layout setup. Its first frame follows that setup,
      // so the scroll must choose the lab's viewport position after this existing marker.
      await page.locator('.turn-stage[data-frame]').waitFor({
        state: 'attached',
        timeout: 10_000,
      });
      // Lazy rendering observes the scene root, which may sit outside its section's visible part.
      await page.locator(labScene).scrollIntoViewIfNeeded();

      try {
        await waitForRenderer(page, labScene, 'webgl', 10_000);
      } catch (error) {
        results.labReadinessFailure = await page.evaluate((target) => {
          const root = document.querySelector(target);
          const rect = root.getBoundingClientRect();

          return {
            scrollY,
            bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            visible: rect.bottom > 0 && rect.top < innerHeight,
            renderer: root.getAttribute('data-lg-scene-renderer'),
            state: root.getAttribute('data-lg-scene-state'),
            keynoteFrame: document.querySelector('.turn-stage')?.getAttribute('data-frame'),
            canvases: [...root.querySelectorAll('canvas')].map((canvas) => ({
              width: canvas.width,
              height: canvas.height,
            })),
          };
        }, labScene);
        await page.screenshot({
          path: path.join(artifactDirectory, `${engine}-lab-readiness-failure.png`),
        });
        throw error;
      }

      await page.mouse.move(1, 1);
      await settle(page, labScene);
    });

    if (results['lab reaches webgl']?.failed) return;

    const size = await boxOf(page, labScene);

    await run(
      engine,
      'F23 dispersion splits light only where the glass tilts',
      results,
      async () => {
        await addStyle(page, loneDrop);
        await setOptics(page, { Dispersion: 'End' });
        await setBackdrop(page, backdrops.grey, labScene);
        const grey = await sceneShot(page, `${engine}-dispersion-grey.png`, labScene);
        const drop = await dropCircle(page, grey.clip);

        const [flat] = await analyse(statsPage, { a: grey.png }, [
          { type: 'colour', only: [{ cx: drop.cx, cy: drop.cy, r: drop.r + 60 }] },
        ]);

        await setBackdrop(page, lines(size.width, size.height), labScene);
        const split = await sceneShot(page, `${engine}-dispersion-lines.png`, labScene);

        const [rim, face] = await analyse(statsPage, { a: split.png }, [
          { type: 'colour', ...sideRim(drop) },
          { type: 'colour', ...flatFace(drop) },
        ]);

        await setOptics(page, { Dispersion: 'Home' });
        const none = await sceneShot(page, `${engine}-dispersion-none.png`, labScene);

        const [plainRim] = await analyse(statsPage, { a: none.png }, [
          { type: 'colour', ...sideRim(drop) },
        ]);

        await resetLab(page);

        assert.ok(
          flat.max <= 10 && flat.p99 <= 4,
          `glass over flat grey must stay grey at full dispersion (chroma p99 ${flat.p99}, max ${flat.max})`,
        );
        assert.ok(
          rim.p99 >= 40,
          `full dispersion must fringe the rim with colour (chroma p99 ${rim.p99})`,
        );
        assert.ok(
          rim.warm > 20 && rim.cool > 20 && rim.green > 10,
          `the fringes must run from red through green to blue (warm ${rim.warm}, green ${rim.green}, cool ${rim.cool})`,
        );
        assert.ok(face.p99 <= 8, `the flat face must not split light (chroma p99 ${face.p99})`);
        assert.ok(
          plainRim.p99 <= 8,
          `without dispersion the rim must not fringe (chroma p99 ${plainRim.p99})`,
        );

        return { flat, rim, face, plainRim };
      },
    );

    await run(engine, 'F24 thick glass refracts like a slab', results, async () => {
      const clear = `${loneDrop} ${labDrop} { --lg-scene-tint: transparent !important; }`;
      await addStyle(page, clear);
      await setBackdrop(page, svg(monoChecker, size.width, size.height), labScene);

      // The flat face passes light straight through even at the strongest optics.
      await setOptics(page, { Index: 'End', Thickness: 'End' });
      const strong = await sceneShot(page, `${engine}-slab-strong.png`, labScene);
      const drop = await dropCircle(page, strong.clip);
      await setOptics(page, { Thickness: 'Home' });
      const thin = await sceneShot(page, `${engine}-slab-thin.png`, labScene);
      await addStyle(page, `${labDrop} { visibility: hidden !important; }`);
      await settle(page, labScene);
      const plain = await sceneShot(page, `${engine}-slab-plain.png`, labScene);

      const [face, strongRim, thinRim] = await analyse(
        statsPage,
        { a: strong.png, b: plain.png, c: thin.png },
        [
          { type: 'diff', ...flatFace(drop) },
          { type: 'diff', ...rimRing(drop) },
          { type: 'diff', image: 'c', ...rimRing(drop) },
        ],
      );

      // A denser glass reflects more of its surroundings at the rim.
      await clearStyles(page);
      await addStyle(page, clear);
      await setBackdrop(page, backdrops.black, labScene);
      await setOptics(page, { Index: 'Home', Thickness: 'End' });
      const air = await sceneShot(page, `${engine}-slab-index-1.png`, labScene);
      await setOptics(page, { Index: 'End' });
      const dense = await sceneShot(page, `${engine}-slab-index-2.4.png`, labScene);

      const [airRim, denseRim] = await analyse(statsPage, { a: air.png, b: dense.png }, [
        { type: 'mean', ...rimRing(drop) },
        { type: 'mean', image: 'b', ...rimRing(drop) },
      ]);

      await resetLab(page);

      assert.ok(
        face.meanDiff <= 8,
        `the flat face must show the backdrop in place (diff ${face.meanDiff.toFixed(1)})`,
      );
      assert.ok(
        strongRim.meanDiff > 25 && strongRim.meanDiff > face.meanDiff * 3,
        `the rim must bend the backdrop (rim ${strongRim.meanDiff.toFixed(1)}, face ${face.meanDiff.toFixed(1)})`,
      );
      assert.ok(
        strongRim.meanDiff > thinRim.meanDiff + 10,
        `thick glass must bend further than thin glass (${strongRim.meanDiff.toFixed(1)} vs ${thinRim.meanDiff.toFixed(1)})`,
      );
      assert.ok(
        denseRim.luminance > airRim.luminance + 15,
        `a denser glass must reflect more at the rim (${denseRim.luminance.toFixed(1)} vs ${airRim.luminance.toFixed(1)})`,
      );

      return {
        face: Number(face.meanDiff.toFixed(1)),
        strongRim: Number(strongRim.meanDiff.toFixed(1)),
        thinRim: Number(thinRim.meanDiff.toFixed(1)),
        airRim: Number(airRim.luminance.toFixed(1)),
        denseRim: Number(denseRim.luminance.toFixed(1)),
      };
    });

    await run(engine, 'F25 extreme optics stay finite', results, async () => {
      const ends = {
        low: {
          Index: 'Home',
          Thickness: 'Home',
          Bevel: 'Home',
          Dispersion: 'Home',
          Frost: 'Home',
          Merge: 'Home',
        },
        high: {
          Index: 'End',
          Thickness: 'End',
          Bevel: 'End',
          Dispersion: 'End',
          Frost: 'End',
          Merge: 'End',
        },
        steep: {
          Index: 'End',
          Thickness: 'End',
          Bevel: 'Home',
          Dispersion: 'End',
          Frost: 'Home',
          Merge: 'Home',
        },
        soft: {
          Index: 'Home',
          Thickness: 'End',
          Bevel: 'End',
          Dispersion: 'End',
          Frost: 'End',
          Merge: 'End',
        },
      };

      const outcome = {};

      for (const [name, keys] of Object.entries(ends)) {
        await setOptics(page, keys);

        for (const [backdrop, floor] of [
          ['grey', 60],
          ['white', 170],
        ]) {
          await setBackdrop(page, backdrops[backdrop], labScene);
          const shot = await sceneShot(page, `${engine}-extreme-${name}-${backdrop}.png`, labScene);

          const circles = await page.evaluate(
            ({ target, clip }) =>
              [...document.querySelectorAll(`${target} .lab-drop`)].map((node) => {
                const rect = node.getBoundingClientRect();

                return {
                  cx: rect.x - clip.x + rect.width / 2,
                  cy: rect.y - clip.y + rect.height / 2,
                  r: rect.width / 2 - 2,
                };
              }),
            { target: labScene, clip: shot.clip },
          );

          const [glass] = await analyse(statsPage, { a: shot.png }, [
            { type: 'colour', only: circles },
          ]);

          outcome[`${name} ${backdrop}`] = glass;

          assert.ok(
            glass.darkest >= floor,
            `${name} optics must not punch dark holes over ${backdrop} (darkest ${glass.darkest.toFixed(1)})`,
          );
          assert.ok(
            glass.p99 <= 6 && glass.max <= 16,
            `${name} optics must keep ${backdrop} glass neutral (chroma p99 ${glass.p99}, max ${glass.max})`,
          );
        }
      }

      await resetLab(page);

      return outcome;
    });

    await run(engine, 'F26 glass draws without seams', results, async () => {
      // The inspector panel draws its own edges, so it is left out, measured
      // against the shot it belongs to.
      const inspectorIn = async (clip, margin) => {
        const box = await boxOf(page, `${labScene} .lab-inspector`);

        return {
          x: box.x - clip.x - margin,
          y: box.y - clip.y - margin,
          width: box.width + margin * 2,
          height: box.height + margin * 2,
        };
      };

      // Apart: one drop, far from the inspector.
      await addStyle(page, loneDrop);
      await setBackdrop(page, backdrops.grey, labScene);
      const lone = await sceneShot(page, `${engine}-seams-lone.png`, labScene);
      const drop = await dropCircle(page, lone.clip);
      const loneInspector = await inspectorIn(lone.clip, 6);

      // Together: the three drops melt into one body. A smooth-minimum bridge
      // between two drops reaches a quarter of the 40px merge radius past
      // them, and where all three meet the second fold adds 9/64 of it, 15.6px
      // in all.
      await clearStyles(page);
      await addStyle(page, `${labScene} .lab-drop { transition: none !important; }`);
      await settle(page, labScene);
      const merged = await sceneShot(page, `${engine}-seams-merged.png`, labScene);

      const drops = await page.evaluate(
        ({ target, clip }) =>
          [...document.querySelectorAll(`${target} .lab-drop`)].map((node) => {
            const rect = node.getBoundingClientRect();

            return {
              cx: rect.x - clip.x + rect.width / 2,
              cy: rect.y - clip.y + rect.height / 2,
              r: rect.width / 2,
            };
          }),
        { target: labScene, clip: merged.clip },
      );

      // The scene's own rounded corners and border are hard edges too, so the
      // shadows are measured inside them.
      const inset = ({ width, height }) => ({
        x: 24,
        y: 24,
        width: width - 48,
        height: height - 48,
      });

      const [shadow, face, mergedShadow] = await analyse(
        statsPage,
        { a: lone.png, b: merged.png },
        [
          {
            type: 'steps',
            rect: inset(lone.clip),
            exclude: [{ cx: drop.cx, cy: drop.cy, r: drop.r + 5 }, loneInspector],
          },
          { type: 'steps', ...flatFace(drop) },
          {
            type: 'steps',
            image: 'b',
            rect: inset(merged.clip),
            exclude: [
              ...drops.map((circle) => ({ ...circle, r: circle.r + 21 })),
              await inspectorIn(merged.clip, 6),
            ],
          },
        ],
      );

      await resetLab(page);

      assert.ok(
        shadow.max <= 4,
        `the shadow around lone glass must fade without steps (largest ${shadow.max} at ${shadow.at})`,
      );
      assert.ok(
        face.max <= 3,
        `the flat face over flat grey must stay flat (largest ${face.max} at ${face.at})`,
      );
      assert.ok(
        mergedShadow.max <= 4,
        `the shadow around merged glass must fade without steps (largest ${mergedShadow.max} at ${mergedShadow.at})`,
      );

      return { shadow, face, mergedShadow };
    });
  } finally {
    const found = problems(log);
    results.labConsole = log;

    if (found.length)
      failures.push(`${engine} lab console: ${found.map((entry) => entry.text).join(' | ')}`);

    await context.close();
  }
}

async function checkScene(engine, browser, statsPage, results) {
  await checkDemo(engine, browser, statsPage, results);
  await checkOptics(engine, browser, statsPage, results);
  await checkReducedTransparency(engine, browser, results);
  await checkMissingWebgl(engine, browser, results);
  await checkBackdropRequests(engine, browser, results);
  await checkFlow(engine, browser, statsPage, results);
  await checkHomepage(engine, browser, results);
  await checkReduceMotionSwitch(engine, browser, results);

  if (engine !== 'chromium') return;

  const retina = {};
  const context = await newContext(browser, { scale: 2 });

  try {
    const page = await context.newPage();
    await openDemo(page);
    await run(engine, 'F5 alignment at 2x', results, async () => {
      await waitForRenderer(page, scene, 'webgl');
      await settle(page);
      await checkAlignment(page, statsPage, 2, 'retina', retina);

      return retina;
    });
  } finally {
    await context.close();
  }
}

// Authoring gate: this real-pane screenshot protects CSS over compositing across
// WebGL presentation. Encoding premultiplied RGB or applying opacity twice must
// fail. Existing optics/alignment cases do not vary opacity; the oracle uses
// independent full/hidden calibration, not shader math or a production test seam.
async function checkAlphaContract(engine, browser, statsPage, results) {
  for (const scale of [1, 2]) {
    const context = await newContext(browser, { scale, preferences: { reduceMotion: true } });

    try {
      const page = await context.newPage();
      const prefix = `${engine}-alpha-${scale}x`;
      const pane = `${scene} .glassy-scene-example-large`;
      await context.tracing.start({ screenshots: true, snapshots: true });

      try {
        await openDemo(page);
        await waitForRenderer(page, scene, 'webgl');
        await addStyle(
          page,
          `
          ${scene} { --lg-scene-shadow: 0; --lg-scene-highlight: 0; }
          ${scene} .glassy-scene-example-small,
          ${scene} .glassy-scene-example-card,
          ${scene} .glassy-scene-example-actions { visibility: hidden !important; }
          ${pane} {
            --lg-scene-tint: rgb(220 40 120 / 0.8);
            --lg-scene-ink: transparent;
            --lg-scene-frost: 0px;
            --lg-scene-merge: 0px;
            transition: none !important;
          }
        `,
        );

        for (const [name, rgb] of Object.entries({
          black: [0, 0, 0],
          white: [255, 255, 255],
          saturated: [16, 176, 255],
        })) {
          await run(engine, `alpha ${name} ${scale}x`, results, async () => {
            const background = svg(
              `<rect width="100%" height="100%" fill="rgb(${rgb.join(' ')})"/>`,
            );

            await setBackdrop(page, background);
            const box = await page.locator(pane).boundingBox();
            assert.ok(box, 'calibration pane must be visible');

            const clip = {
              x: Math.floor(box.x + box.width / 2) - 4,
              y: Math.floor(box.y + box.height / 2) - 4,
              width: 8,
              height: 8,
            };

            const capture = async (suffix) => {
              await settle(page);

              return page.screenshot({
                clip,
                path: path.join(artifactDirectory, `${prefix}-${name}-${suffix}.png`),
              });
            };

            await page.locator(pane).evaluate((node) => {
              node.style.visibility = 'hidden';
              node.style.opacity = '1';
            });
            const behind = await capture('background');
            await page.locator(pane).evaluate((node) => (node.style.visibility = 'visible'));
            await page.waitForFunction(
              (target) =>
                document.querySelector(target)?.getAttribute('data-lg-scene') === 'active',
              pane,
            );
            const face = await capture('face');

            const [backgroundMean, faceMean] = await analyse(
              statsPage,
              { background: behind, face },
              [
                { type: 'mean', image: 'background' },
                { type: 'mean', image: 'face' },
              ],
            );

            assert.ok(
              backgroundMean.rgb.every((value, channel) => Math.abs(value - rgb[channel]) <= 1),
              `background calibration must match its CSS color: ${JSON.stringify(backgroundMean)}`,
            );
            assert.ok(
              faceMean.rgb.some((value, channel) => Math.abs(value - rgb[channel]) > 20),
              'full-coverage calibration must differ visibly from its background',
            );
            const samples = [];

            for (const alpha of [0, 0.25, 0.5, 0.75, 1]) {
              await page.locator(pane).evaluate((node, value) => {
                node.style.opacity = String(value);
              }, alpha);
              const png = await capture(String(alpha));

              const [sample] = await analyse(statsPage, { background: behind, face, a: png }, [
                { type: 'over', alpha },
              ]);

              samples.push({ alpha, ...sample });
              assert.ok(
                sample.channels > 0 && sample.maxError <= 2,
                `opacity ${alpha} must match CSS over within two channel steps: ${JSON.stringify(sample)}`,
              );
            }

            return { background: backgroundMean, face: faceMean, samples };
          });
        }
      } finally {
        await context.tracing.stop({ path: path.join(artifactDirectory, `${prefix}-trace.zip`) });
      }
    } finally {
      await context.close();
    }
  }
}

const manifest = { baseUrl, suites: [...suites], engines: {}, server: {}, failures };

const statsBrowser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--disable-updater-scheduler'],
});

try {
  const statsPage = await statsBrowser.newPage();

  if (suites.has('scene')) await checkServerHtml(manifest.server);

  for (const engine of engines) {
    const results = {};
    manifest.engines[engine] = results;

    const browser = await launchers[engine].launch({
      channel: engine === 'chromium' ? 'chrome' : undefined,
      headless: true,
      args: engine === 'chromium' ? ['--disable-updater-scheduler'] : undefined,
    });

    try {
      if (suites.has('scene')) await checkScene(engine, browser, statsPage, results);

      if (suites.has('backdrops') && !suites.has('scene'))
        await checkBackdropRequests(engine, browser, results);

      if (suites.has('scene') || suites.has('contracts'))
        await checkAlphaContract(engine, browser, statsPage, results);

      if (suites.has('preferences')) await checkReduceMotionSwitch(engine, browser, results);

      if (suites.has('motion')) {
        await checkMotion(engine, browser, results);
        await checkReducedMotion(engine, browser, results);
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await statsBrowser.close();
}

fs.writeFileSync(
  path.join(artifactDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

for (const [engine, results] of Object.entries(manifest.engines)) {
  for (const [name, outcome] of Object.entries(results)) {
    if (
      name === 'console' ||
      name === 'flowConsole' ||
      name === 'homeConsole' ||
      name === 'labConsole'
    )
      continue;

    const failed = outcome?.failed;
    console.log(
      `${engine.padEnd(8)} ${failed ? 'FAIL' : 'ok  '} ${name}${failed ? `: ${outcome.failed}` : ''}`,
    );
  }
}

if (failures.length) {
  console.error('Glass scene check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error(`Artifacts: ${artifactDirectory}`);
  process.exit(1);
}

console.log(`Glass scene check passed. Artifacts: ${artifactDirectory}`);
