// The home page opens like a keynote as it loads and turns its desk into a phone as it scrolls,
// both drawn by Remotion compositions (src/components/keynote). Every way it can fail:
//
// 1. The opener does not run: with motion allowed, the page loads without the dark stage and its
//    poster, no Remotion player takes over from the poster, or the opener never lands on its own.
// 2. The opener traps the page: under reduced motion (the system setting or the site
//    preference), without JavaScript or when the address names a place on the page, the stage
//    shows, a player mounts, or the hero is covered or out of place.
// 3. The opener flashes: the bootstrap runs after the header or the hero is parsed, or the
//    poster differs from the frame the player takes over with.
// 4. The opener stutters while the page loads: the poster's ribbon is drawn on the main thread,
//    which hydration holds up, instead of by a worker on a canvas handed to it, or the player's
//    frame does not follow time.
// 5. The opener does not land: once it ends, the stage still shows, its player stays mounted,
//    the page has scrolled, or a hero element is more than 1px from the reduced-motion layout.
// 6. The opener answers the wrong input: a wheel turn or a click while it plays scrolls the page
//    under it or cuts it short, or Escape does not bring it to land within two seconds.
// 7. The header misbehaves: it shows during the opener, is missing or condensed once the opener
//    lands, or does not condense once the page scrolls on.
// 8. Glass loses its backdrop: the hero's glass button, the desk or one of their ancestors gets
//    opacity, filter, mask or clip-path while the slide folds away or the turn moves it.
// 9. Keyboard focus hides under the stage: tabbing into the hero during the opener leaves the
//    focused element covered once the opener has made way.
// 10. The turn does not run: scrolling through the desk does not pin it, turn it into the phone
//     and bring every feature in from its own side.
// 11. The turn replaces edits with a capture, remounts a screen, or distorts its live glass.
// 12. A feature is unreadable: at the final hold a callout overlaps another callout or the
//     phone, leaves the viewport or its text falls under 4.5:1 on the page.
// 13. The turn breaks the desk: back above the turn, the desk keeps a transform or its menus do
//     not open.
// 14. Reduced motion is ignored by the turn: the desk spins or pins, or the phone and its
//     features are missing instead of shown in their final place.
// 15. The phone-sized layout breaks: at 390 × 844 the stage, the phone or a feature overflows
//     the viewport sideways.
// 16. The composition does not follow the theme: the turning desk or the phone is the other
//     appearance's picture.
// 17. Remotion does not draw the turn: no Remotion player is mounted while the turn plays, or
//     its frame does not follow the scroll position.
// 18. Skipping waits for hydration, a first click or tap skips instead of saying how to skip
//     ("Click again to skip", "Tap again to skip"), the second does not skip, a keyboard cannot
//     reach Skip intro, or it leaves the stage or scroll lock behind, or the opener restarts once
//     delayed scripts finally arrive.
// 19. The phone's screen is live at the wrong time: once the turn lands, a click through the
//     turned phone misses its switch, checkbox or segment, or the segmented control's bubble
//     lands away from the option it moved to; a visible face cannot be edited during the turn.
// 20. The opener forgets the visitor: once it has landed, a reload plays it again or stops the
//     turn; or Replay intro is missing, shows under reduced motion, crashes the page or does not
//     play the opener again from its first frames over the top of the page.
// 21. The opener keeps the visitor waiting: its five-second sequence leaves the stage up past
//     its last frame, or a natural arrival exceeds the loading allowance.
// 22. The lens retains native shader objects after linking, unmounting or an unsuccessful
//     compile/link/setup; deleting its resources loses a context React can reuse.
//
// Lens contracts own allocation/deletion at the real browser boundary. Existing image/input
// checks cannot detect retained WebGL objects. Native compilation and linking still run during
// fault injection; no production export or flag is needed, and Replay exercises the real owner.

import fs from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

const baseUrl = process.argv[2];

const lensContractsOnly = process.argv[4] === 'lens-contracts';

const lensFaultOnly = lensContractsOnly ? process.argv[5] : undefined;

const lensFaults = [
  'create-program',
  'create-shader',
  'compile-vertex',
  'compile-fragment',
  'link',
  'create-buffer',
  'create-texture',
];

if (lensFaultOnly && !lensFaults.includes(lensFaultOnly)) {
  throw new Error(`Unknown lens fault: ${lensFaultOnly}`);
}

if (!baseUrl || !['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)) {
  console.error('Usage: node scripts/check-keynote.mjs http://127.0.0.1:3100 [artifact-directory]');
  process.exit(1);
}

const artifactDirectory =
  process.argv[3] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'glassyui-keynote-'));

fs.mkdirSync(artifactDirectory, { recursive: true });

const failures = [];

const manifest = { baseUrl, engines: {}, failures, suite: process.argv[4] ?? 'keynote' };

const fail = (engine, message) => failures.push(`${engine}: ${message}`);

const expect = (engine, condition, message) => {
  if (!condition) fail(engine, message);
};

const HERO_ACTIONS = [
  '.home-hero .home-actions > .lg-button--prominent',
  '.home-hero .home-actions a[href="https://pro.glassyui.com"]',
];

const HERO = [
  '.home-announce',
  '.home-title',
  '.home-lead',
  ...HERO_ACTIONS,
  '.home-desk .desk-screen',
];

const OPENER = { end: 306, fold: 233, pull: 207, rest: 70 };

const TURN = { end: 719 };

const liveTurnOnly = process.argv[4] === 'turn-live';

// Track the opener lens, excluding the folding phone's separately owned canvas.
// Preserve native calls and return values.
// Faults change only a shader input or an allocation result, never the cleanup acknowledgement.
async function instrumentLens(context, fault) {
  await context.addInitScript((failure) => {
    const records = new Map();
    const getContext = HTMLCanvasElement.prototype.getContext;
    const prototype = WebGL2RenderingContext.prototype;
    const kinds = ['Shader', 'Program', 'Buffer', 'Texture'];

    HTMLCanvasElement.prototype.getContext = function (...args) {
      const gl = getContext.apply(this, args);

      if (
        gl &&
        args[0] === 'webgl2' &&
        this.closest('.keynote-player') &&
        !this.closest('.lg-phone-duo')
      ) {
        if (!records.has(gl)) {
          records.set(gl, {
            acquisitions: 0,
            compiles: [],
            draws: 0,
            faults: 0,
            id: records.size + 1,
            links: [],
            resources: Object.fromEntries(kinds.map((kind) => [kind, new Map()])),
          });
        }

        records.get(gl).acquisitions += 1;
      }

      return gl;
    };

    for (const kind of kinds) {
      const create = prototype[`create${kind}`];
      const remove = prototype[`delete${kind}`];

      prototype[`create${kind}`] = function (...args) {
        const record = records.get(this);

        if (record && failure === `create-${kind.toLowerCase()}`) {
          record.faults += 1;

          return null;
        }

        const handle = create.apply(this, args);

        if (record && handle) {
          const resources = record.resources[kind];

          resources.set(handle, { deleted: false, id: resources.size + 1 });
        }

        return handle;
      };

      prototype[`delete${kind}`] = function (handle) {
        const result = remove.call(this, handle);
        const resource = records.get(this)?.resources[kind].get(handle);

        if (resource) resource.deleted = true;

        return result;
      };
    }

    const shaderSource = prototype.shaderSource;

    prototype.shaderSource = function (shader, source) {
      const record = records.get(this);
      const type = this.getShaderParameter(shader, this.SHADER_TYPE);

      if (record) {
        if (
          (failure === 'compile-vertex' && type === this.VERTEX_SHADER) ||
          (failure === 'compile-fragment' && type === this.FRAGMENT_SHADER)
        ) {
          source += '\nThis deliberately invalid input must fail native compilation.\n';
          record.faults += 1;
        } else if (failure === 'link' && type === this.VERTEX_SHADER) {
          // A valid vertex output with no matching fragment input makes the native linker fail.
          const varying = source.match(/\bout\s+vec[234]\s+(\w+)\s*;/);

          if (varying) {
            source = source.replace(
              new RegExp(`\\b${varying[1]}\\b`, 'g'),
              'keynoteUnmatchedVarying',
            );
            record.faults += 1;
          }
        }
      }

      return shaderSource.call(this, shader, source);
    };

    const link = prototype.linkProgram;
    const compile = prototype.compileShader;

    prototype.compileShader = function (shader) {
      const result = compile.call(this, shader);
      const record = records.get(this);

      if (record)
        record.compiles.push(Boolean(this.getShaderParameter(shader, this.COMPILE_STATUS)));

      return result;
    };

    prototype.linkProgram = function (program) {
      const result = link.call(this, program);
      const record = records.get(this);

      if (record) record.links.push(Boolean(this.getProgramParameter(program, this.LINK_STATUS)));

      return result;
    };

    const draw = prototype.drawArrays;

    prototype.drawArrays = function (...args) {
      const result = draw.apply(this, args);
      const record = records.get(this);

      if (record) record.draws += 1;

      return result;
    };

    window.__keynoteLensResources = () =>
      [...records].map(([gl, record]) => ({
        acquisitions: record.acquisitions,
        compiles: record.compiles,
        connected: gl.canvas.isConnected,
        contextLost: gl.isContextLost(),
        draws: record.draws,
        faults: record.faults,
        id: record.id,
        links: record.links,
        reusable: getContext.call(gl.canvas, 'webgl2') === gl && !gl.isContextLost(),
        resources: Object.fromEntries(
          kinds.map((kind) => {
            const objects = [...record.resources[kind]];

            return [
              kind.toLowerCase(),
              {
                created: objects.length,
                deleted: objects.filter(([, object]) => object.deleted).length,
                live: objects.filter(([handle]) => gl[`is${kind}`](handle)).length,
                retained: objects.flatMap(([, object]) => (object.deleted ? [] : [object.id])),
              },
            ];
          }),
        ),
      }));
  }, fault);
}

async function open(
  browser,
  {
    clock = false,
    hash = '',
    height = 900,
    javaScriptEnabled = true,
    lensFault = 'none',
    mobile = false,
    preferences = {},
    recordVideo,
    reducedMotion = 'no-preference',
    theme = 'light',
    waitUntil = 'networkidle',
    width = 1440,
  } = {},
) {
  const context = await browser.newContext({
    deviceScaleFactor: 1,
    hasTouch: mobile,
    isMobile: mobile && browser.browserType().name() === 'chromium',
    javaScriptEnabled,
    recordVideo,
    reducedMotion,
    viewport: { height, width },
  });

  await context.addInitScript(
    (value) => localStorage.setItem('glassy-ui-preferences', value),
    JSON.stringify({ theme, ...preferences }),
  );

  if (!liveTurnOnly) await instrumentLens(context, lensFault);

  if (liveTurnOnly) {
    await context.addInitScript(() => {
      window.__keynoteDeskDraws = 0;
      const draw = WebGL2RenderingContext.prototype.drawArrays;

      WebGL2RenderingContext.prototype.drawArrays = function (mode, first, count) {
        if (this.canvas.closest('.desk-screen')) window.__keynoteDeskDraws += 1;

        return draw.call(this, mode, first, count);
      };
    });
  }

  const page = await context.newPage();
  const errors = [];

  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    // Firefox reports a cookie whose Domain does not match the host as an error. The analytics
    // clean-up clears its cookies for glassyui.com and pro.glassyui.com on every host, so a
    // loopback server sees these; they are the browser's, not the page's.
    if (/Cookie “.+” has been rejected for invalid domain\./.test(message.text())) return;

    if (message.type() === 'error') errors.push(message.text());
  });

  // The player's clock can stand still, so the check moves the opener frame by frame; CSS keeps
  // the document's own time.
  if (clock) await page.clock.install();

  await page.goto(`${baseUrl}${hash}`, { waitUntil });

  if (javaScriptEnabled) {
    // A development server's badge floats over the page's corner.
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  }

  return { context, errors, page };
}

const frameOf = (page, selector) =>
  page.evaluate((target) => Number(document.querySelector(target)?.dataset.frame ?? NaN), selector);

// The turn eases its frame toward the scroll position; wait until it stops moving.
async function settle(page, selector = '.turn-stage') {
  let previous = Number.NaN;
  let steady = 0;

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await page.waitForTimeout(80);

    const current = await frameOf(page, selector);

    steady = Object.is(current, previous) ? steady + 1 : 0;
    previous = current;

    if (steady === 3) return current;
  }

  return previous;
}

async function scrollTo(page, top, selector) {
  await page.evaluate((y) => window.scrollTo({ behavior: 'instant', top: y }), Math.round(top));
  await page.waitForTimeout(60);

  return settle(page, selector);
}

function boxes(page, selectors) {
  return page.evaluate((list) => {
    const read = (selector) => {
      const element = document.querySelector(selector);

      if (!element) return null;

      const box = element.getBoundingClientRect();

      return { height: box.height, width: box.width, x: box.left, y: box.top + window.scrollY };
    };

    return Object.fromEntries(list.map((selector) => [selector, read(selector)]));
  }, selectors);
}

function geometry(page) {
  return page.evaluate(() => {
    const track = document.querySelector('.turn');
    const stage = document.querySelector('.turn-stage');

    return {
      turnRange: track && stage ? track.offsetHeight - stage.offsetHeight : 0,
      turnTop: track ? track.getBoundingClientRect().top + window.scrollY : 0,
    };
  });
}

const playing = (page) =>
  page.waitForFunction(() => document.querySelector('.keynote-player[data-playing]'), undefined, {
    timeout: 15000,
  });

const reachFrame = (page, frame) =>
  page.waitForFunction(
    (target) => Number(document.querySelector('.keynote-stage')?.dataset.frame) >= target,
    frame,
    { timeout: 15000 },
  );

const landing = (page, timeout = 15000) =>
  page.waitForFunction(
    () =>
      !document.documentElement.hasAttribute('data-keynote-intro') &&
      !document.querySelector('.keynote-player'),
    undefined,
    { timeout },
  );

// Every ancestor of the hero's glass button and of the desk, up to the root, must leave the glass
// its backdrop: no opacity below 1, filter, mask or clip-path.
function glassCutOff(page) {
  return page.evaluate(() => {
    const problems = [];

    for (const selector of ['.home-hero .home-actions > .lg-button', '.home-desk .desk-screen']) {
      for (let node = document.querySelector(selector); node; node = node.parentElement) {
        const style = getComputedStyle(node);
        const masked = style.maskImage && style.maskImage !== 'none';
        const name = `${selector} ← ${node.tagName.toLowerCase()}.${[...node.classList].join('.')}`;

        if (Number(style.opacity) < 1) problems.push(`${name} opacity ${style.opacity}`);

        if (style.filter !== 'none') problems.push(`${name} filter ${style.filter}`);

        if (masked) problems.push(`${name} mask ${style.maskImage}`);

        if (style.clipPath !== 'none') problems.push(`${name} clip-path ${style.clipPath}`);
      }
    }

    return problems;
  });
}

const header = (page) =>
  page.evaluate(() => {
    const element = document.querySelector('.site-nav');
    const box = element.getBoundingClientRect();

    return { bottom: box.bottom, condensed: element.dataset.condensed, top: box.top };
  });

const coveredBy = (page, selector, cover) =>
  page.evaluate(
    ([target, stage]) => {
      const box = document.querySelector(target).getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);

      return Boolean(hit?.closest(stage));
    },
    [selector, cover],
  );

const reachable = (page, selector) =>
  page.evaluate((target) => {
    const element = document.querySelector(target);
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);

    return Boolean(hit && (hit === element || element.contains(hit) || hit.contains(element)));
  }, selector);

// Playwright hides the caret by writing caret-color into every field's inline style, which a shot
// taken while the page loads leaves for React to find as a hydration mismatch. These shots show no
// focused field, so the caret stays as it is.
const shot = (page, name) =>
  page.screenshot({ caret: 'initial', path: path.join(artifactDirectory, `${name}.png`) });

// Mean absolute difference of two screenshots, in grey levels, measured in the page itself.
async function difference(page, first, second) {
  return page.evaluate(
    async ([a, b]) => {
      const load = (source) =>
        new Promise((resolve, reject) => {
          const image = new Image();

          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = source;
        });

      const [left, right] = await Promise.all([load(a), load(b)]);
      const canvas = document.createElement('canvas');

      canvas.width = left.width;
      canvas.height = left.height;

      const context = canvas.getContext('2d', { willReadFrequently: true });

      context.drawImage(left, 0, 0);

      const one = context.getImageData(0, 0, canvas.width, canvas.height).data;

      context.drawImage(right, 0, 0);

      const two = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let total = 0;

      for (let index = 0; index < one.length; index += 4) {
        total +=
          (Math.abs(one[index] - two[index]) +
            Math.abs(one[index + 1] - two[index + 1]) +
            Math.abs(one[index + 2] - two[index + 2])) /
          3;
      }

      return total / (one.length / 4);
    },
    [
      `data:image/png;base64,${first.toString('base64')}`,
      `data:image/png;base64,${second.toString('base64')}`,
    ],
  );
}

const luminance = ([r, g, b]) => {
  const channel = (value) => {
    const unit = value / 255;

    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (one, two) => {
  const [light, dark] = [luminance(one), luminance(two)].sort((a, b) => b - a);

  return (light + 0.05) / (dark + 0.05);
};

const overlaps = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// The phone and its features at the end of the turn, in viewport pixels, with their colours.
const finalLayout = (page) =>
  page.evaluate(() => {
    const rgb = (value) =>
      value
        .match(/\d+(\.\d+)?/g)
        .slice(0, 3)
        .map(Number);

    const box = (element) => {
      const rect = element.getBoundingClientRect();

      return { height: rect.height, width: rect.width, x: rect.left, y: rect.top };
    };

    const slab = document.querySelector('.turn-player [data-slab]');

    return {
      background: rgb(getComputedStyle(document.body).backgroundColor),
      features: [...document.querySelectorAll('.turn-player [data-feature]')].map((element) => ({
        body: rgb(getComputedStyle(element.lastElementChild).color),
        box: box(element),
        opacity: Number(getComputedStyle(element).opacity),
        side: element.dataset.feature,
        title: element.firstElementChild.textContent,
        titleColour: rgb(getComputedStyle(element.firstElementChild).color),
      })),
      images: [...document.querySelectorAll('.turn-player img')].map((image) => image.src),
      phone: slab ? box(slab) : null,
      phoneTheme: document.querySelector('.turn-player .turn-phone')?.dataset.theme,
      viewport: { height: innerHeight, width: innerWidth },
    };
  });

async function checkReduced(browser, engine, label, options, motionLayout) {
  const { context, page } = await open(browser, options);

  const state = await page.evaluate(() => ({
    intro: document.documentElement.hasAttribute('data-keynote-intro'),
    keynote: document.documentElement.hasAttribute('data-keynote'),
    players: document.querySelectorAll('.__remotion-player').length,
    replay: getComputedStyle(document.querySelector('.keynote-replay')).display,
    stage: getComputedStyle(document.querySelector('.keynote-stage')).display,
    still: document.querySelectorAll('.turn-still-features li').length,
    stillShown: document.querySelector('.turn-still').getBoundingClientRect().height > 200,
    transform: getComputedStyle(document.querySelector('.keynote')).transform,
    turnStage: getComputedStyle(document.querySelector('.turn-stage')).position,
  }));

  expect(engine, !state.keynote && !state.intro, `${label}: the keynote runs`);
  expect(engine, state.stage === 'none', `${label}: the stage is shown`);
  expect(engine, state.replay === 'none', `${label}: Replay intro is offered`);
  expect(engine, state.players === 0, `${label}: a Remotion player is mounted`);
  expect(engine, state.transform === 'none', `${label}: the page is transformed`);
  expect(engine, state.turnStage !== 'sticky', `${label}: the desk is pinned`);
  expect(
    engine,
    state.still === 6 && state.stillShown,
    `${label}: the phone and its six features are not shown standing still`,
  );

  const layout = await boxes(page, HERO);

  expect(engine, await reachable(page, '.home-title'), `${label}: something covers the hero`);

  // Without JavaScript nothing hydrates, so only the hydrated variants share the landed layout.
  if (motionLayout && options.javaScriptEnabled !== false) {
    for (const selector of HERO) {
      const still = layout[selector];
      const moving = motionLayout[selector];

      if (!still || !moving) {
        fail(engine, `${label}: ${selector} is missing`);
        continue;
      }

      const offset = Math.max(
        Math.abs(still.x - moving.x),
        Math.abs(still.y - moving.y),
        Math.abs(still.width - moving.width),
        Math.abs(still.height - moving.height),
      );

      expect(
        engine,
        offset <= 1,
        `${label}: ${selector} is ${offset.toFixed(1)}px from its landed place`,
      );
    }
  }

  await shot(page, `${engine}-${label}`);
  await context.close();

  return layout;
}

async function checkSkip(browser, engine, width, report) {
  const context = await browser.newContext({
    hasTouch: width < 600,
    reducedMotion: 'no-preference',
    viewport: { height: 900, width },
  });

  const page = await context.newPage();
  const scripts = [];
  let released = false;

  await context.tracing.start({ screenshots: true, snapshots: true });
  await page.route('**/_next/static/chunks/**', (route) => {
    if (released || route.request().resourceType() !== 'script') return route.continue();

    scripts.push(route);
  });

  try {
    await page.goto(baseUrl, { waitUntil: 'commit' });
    await page.locator('.keynote-stage').waitFor({ state: 'visible', timeout: 5000 });
    expect(engine, scripts.length > 0, 'the loading skip check did not delay hydration');

    // A first click or tap only says how to skip; a second, within three seconds, skips.
    const touch = width < 600;

    const press = () =>
      touch ? page.touchscreen.tap(width / 2, 450) : page.mouse.click(width / 2, 450);

    await press();
    await page.waitForTimeout(300);

    const hint = await page.evaluate(() => {
      const skip = document.querySelector('.keynote-skip');

      return {
        intro: document.documentElement.hasAttribute('data-keynote-intro'),
        opacity: Number(getComputedStyle(skip).opacity),
        text: [...skip.children].find((label) => getComputedStyle(label).display !== 'none')
          ?.textContent,
      };
    });

    const wording = touch ? 'Tap again to skip' : 'Click again to skip';

    report[`skipHint${width}`] = hint;
    expect(engine, hint.intro, `a first ${touch ? 'tap' : 'click'} skips the intro`);
    expect(
      engine,
      hint.text === wording && hint.opacity > 0.9,
      `a first ${touch ? 'tap' : 'click'} shows "${hint.text}" at ${hint.opacity}, not "${wording}"`,
    );
    // No shot here: the held scripts take the page's connections, so a font the hint brings in
    // cannot load, and a screenshot waits on it. The input check below shoots the hint.
    await press();
    await landing(page, 1000);

    const beforeHydration = await page.evaluate(() => ({
      stage: getComputedStyle(document.querySelector('.keynote-stage')).display,
      skip: getComputedStyle(document.querySelector('.keynote-skip')).display,
    }));

    expect(engine, beforeHydration.stage === 'none', 'Skip intro leaves the loading stage up');
    expect(engine, beforeHydration.skip === 'none', 'Skip intro stays visible after skipping');
    released = true;
    await Promise.all(scripts.map((route) => route.continue()));
    await page.waitForLoadState('networkidle');
    expect(
      engine,
      await page.evaluate(() => !document.documentElement.hasAttribute('data-keynote-intro')),
      'delayed hydration restarts the skipped intro',
    );
    await page.mouse.wheel(0, 250);
    await page.waitForFunction(() => window.scrollY > 0, undefined, { timeout: 2000 });
    await shot(page, `${engine}-skip-landed-${width}`);

    report[`skipLoading${width}`] = { beforeHydration, hydrated: true, scrolling: true };
  } finally {
    await context.tracing.stop({
      path: path.join(artifactDirectory, `${engine}-skip-${width}-trace.zip`),
    });
    await context.close();
  }
}

// A visitor sees the opener once; Replay intro plays it again from its first frame.
async function checkReplay(browser, engine, report) {
  const { context, errors, page } = await open(browser, { waitUntil: 'domcontentloaded' });

  try {
    await playing(page);
    await page.keyboard.press('Escape');
    await landing(page);
    await page.reload({ waitUntil: 'domcontentloaded' });

    const returning = await page.evaluate(() => ({
      intro: document.documentElement.hasAttribute('data-keynote-intro'),
      keynote: document.documentElement.hasAttribute('data-keynote'),
      stage: getComputedStyle(document.querySelector('.keynote-stage')).display,
    }));

    report.returning = returning;
    expect(
      engine,
      !returning.intro && returning.stage === 'none',
      'a returning visitor sees the opener again',
    );
    expect(engine, returning.keynote, 'a returning visitor loses the turn');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo({ behavior: 'instant', top: 300 }));
    await page.getByRole('button', { exact: true, name: 'Replay intro' }).click();
    await playing(page);

    const replay = await page.evaluate(() => ({
      frame: Number(document.querySelector('.keynote-stage').dataset.frame),
      intro: document.documentElement.hasAttribute('data-keynote-intro'),
      scrollY: window.scrollY,
    }));

    report.replay = replay;
    expect(
      engine,
      replay.intro && replay.scrollY === 0 && replay.frame < OPENER.rest,
      `Replay intro shows frame ${replay.frame} at ${replay.scrollY}px, not the opener's start at the top`,
    );
    await shot(page, `${engine}-replay`);
    await landing(page);
    expect(
      engine,
      await reachable(page, '.home-title'),
      'the replayed opener leaves the hero covered',
    );
    expect(engine, errors.length === 0, `the replay logged errors: ${errors.join(' | ')}`);
  } finally {
    await context.close();
  }
}

const lensResources = (page) => page.evaluate(() => window.__keynoteLensResources());

function checkLensReleased(
  engine,
  records,
  label,
  kinds = ['shader', 'program', 'buffer', 'texture'],
) {
  for (const record of records) {
    for (const kind of kinds) {
      const resource = record.resources[kind];

      expect(
        engine,
        resource.retained.length === 0 && resource.live === 0,
        `${label}: lens context ${record.id} retains ${resource.retained.length} ${kind} objects ` +
          `(${resource.created} created, ${resource.deleted} deleted, ${resource.live} native live)`,
      );
    }

    expect(
      engine,
      record.reusable && !record.contextLost,
      `${label}: the lens context cannot be reused`,
    );
  }
}

async function checkLensLifecycle(browser, engine, width, report) {
  const { context, errors, page } = await open(browser, {
    height: width === 390 ? 844 : 900,
    mobile: width === 390,
    waitUntil: 'domcontentloaded',
    width,
  });

  const label = `lens-${width}`;
  const result = {};

  report[label] = result;
  await context.tracing.start({ screenshots: true, snapshots: true });

  try {
    await page.waitForFunction(
      () => window.__keynoteLensResources().some((record) => record.connected && record.draws > 0),
      undefined,
      { timeout: 15000 },
    );
    result.drawing = await lensResources(page);
    expect(
      engine,
      result.drawing.some((record) => record.links.includes(true)),
      `${label}: no native lens program linked`,
    );
    checkLensReleased(engine, result.drawing, `${label} after link`, ['shader']);
    await shot(page, `${engine}-${label}-drawing`);
    await landing(page);
    result.landed = await lensResources(page);
    expect(
      engine,
      result.landed.every((record) => !record.connected),
      `${label}: landing leaves a lens canvas mounted`,
    );
    checkLensReleased(engine, result.landed, `${label} after unmount`);
    await shot(page, `${engine}-${label}-landed`);

    const programsBefore = result.landed.reduce(
      (sum, record) => sum + record.resources.program.created,
      0,
    );

    await page.getByRole('button', { exact: true, name: 'Replay intro' }).click();
    await page.waitForFunction(
      (before) => {
        const records = window.__keynoteLensResources();

        return (
          records.some((record) => record.connected && record.draws > 0) &&
          records.reduce((sum, record) => sum + record.resources.program.created, 0) > before
        );
      },
      programsBefore,
      { timeout: 15000 },
    );
    result.replay = await lensResources(page);
    checkLensReleased(engine, result.replay, `${label} Replay after link`, ['shader']);
    expect(
      engine,
      result.replay.every((record) => record.reusable),
      `${label}: Replay loses a reusable context`,
    );
    await shot(page, `${engine}-${label}-replay`);
    await landing(page);
    result.replayLanded = await lensResources(page);
    checkLensReleased(engine, result.replayLanded, `${label} Replay after unmount`);
    expect(engine, errors.length === 0, `${label}: browser errors: ${errors.join(' | ')}`);
  } finally {
    result.errors = errors;
    await context.tracing.stop({
      path: path.join(artifactDirectory, `${engine}-${label}-trace.zip`),
    });
    await context.close();
  }
}

async function checkLensFailure(browser, engine, fault, report) {
  const { context, errors, page } = await open(browser, {
    lensFault: fault,
    waitUntil: 'domcontentloaded',
  });

  const result = {};

  report[`lens-${fault}`] = result;

  try {
    await page.waitForFunction(
      () => window.__keynoteLensResources().some((record) => record.faults > 0),
      undefined,
      { timeout: 15000 },
    );
    // Creation and cleanup happen synchronously in the layout effect; give browser error
    // delivery a turn without waiting for an opener that intentionally cannot start.
    await page.waitForTimeout(250);
    result.resources = await lensResources(page);
    result.errors = errors;

    if (fault.startsWith('compile-')) {
      expect(
        engine,
        result.resources.some((record) => record.compiles.includes(false)),
        `${fault}: native compilation did not fail`,
      );

      if (fault === 'compile-fragment') {
        expect(
          engine,
          result.resources.some((record) => record.compiles.includes(true)),
          `${fault}: the earlier vertex shader never compiled`,
        );
      }
    }

    if (fault === 'link') {
      expect(
        engine,
        result.resources.some((record) => record.links.includes(false)),
        `${fault}: native linking did not fail`,
      );
      expect(
        engine,
        result.resources.every((record) => record.compiles.every(Boolean)),
        `${fault}: compilation failed before native linking`,
      );
    }

    expect(
      engine,
      errors.some((error) => /keynote lens/i.test(error)),
      `${fault}: the lens failure was not reported`,
    );
    expect(
      engine,
      result.resources.every((record) => record.draws === 0),
      `${fault}: the failed renderer still draws`,
    );
    checkLensReleased(engine, result.resources, `after ${fault}`);
    await shot(page, `${engine}-lens-${fault}`);
  } finally {
    await context.close();
  }
}

async function checkLensContracts(browser, engine, report) {
  if (!lensFaultOnly) {
    for (const width of [1440, 390]) await checkLensLifecycle(browser, engine, width, report);
  }

  // The cleanup contract is cross-engine above. Exercise bounded native/allocation failures
  // in Chrome once; replaying each failure in three engines would duplicate the same owner.
  if (engine === 'chromium') {
    for (const fault of lensFaultOnly ? [lensFaultOnly] : lensFaults) {
      await checkLensFailure(browser, engine, fault, report);
    }
  }
}

// Edits must appear on the moving face and survive both directions of the scroll. These real
// inputs also catch projected coordinates being used a second time by the glass and bubbles.
async function checkLiveTurn(browser, engine, width, report) {
  const { context, page, errors } = await open(browser, {
    hash: '#home-title',
    width,
    height: 900,
    recordVideo:
      engine === 'chromium' && width === 1440
        ? { dir: artifactDirectory, size: { width, height: 900 } }
        : undefined,
  });

  const label = `${engine}-${width}`;
  const result = {};

  report[label] = result;

  try {
    // First-visit consent has its own suite. Exercise live controls after the real refusal,
    // so the notice cannot cover a phone control on the narrow layout.
    const privacy = page.getByRole('region', { name: 'Analytics privacy settings' });

    await privacy.getByRole('button', { name: 'Reject analytics', exact: true }).click();
    await privacy.waitFor({ state: 'hidden' });
    await page.waitForSelector('.turn-player [data-slab]', { state: 'attached' });
    const turn = await geometry(page);
    const at = (frame) => scrollTo(page, turn.turnTop + (turn.turnRange * frame) / TURN.end);
    const desk = page.locator('.turn-desk .desk-screen');
    const identity = await desk.elementHandle();

    const state = () =>
      desk.evaluate((root) => ({
        track: root.querySelector('.desk-track-title').textContent,
        wireless: root.querySelector('[role="switch"]').dataset.state,
        visibility: getComputedStyle(root).visibility,
        canvas: [root.querySelector('canvas').width, root.querySelector('canvas').height],
        renderer: root.dataset.lgSceneRenderer,
      }));

    await at(-1);
    await page.waitForFunction(
      () => document.querySelector('.desk-screen')?.dataset.lgSceneRenderer === 'webgl',
      undefined,
      { timeout: 15000 },
    );
    result.before = await state();
    await at(30);
    expect(
      label,
      (await state()).visibility === 'visible',
      'the lifting desk is replaced by a picture',
    );

    // Continue collecting the phone regression on the old implementation even if its desk is hidden.
    if ((await state()).visibility === 'visible') {
      await desk.getByRole('button', { name: 'Next track', exact: true }).click();
      await desk.getByRole('switch', { name: 'Wireless', exact: true }).click();
      const dark = desk.getByRole('radio', { name: 'Dark', exact: true });
      await dark.evaluate((element) => element.focus({ preventScroll: true }));
      await page.keyboard.press('Space');
      await page.waitForTimeout(650);
      result.edited = await state();
      expect(
        label,
        result.edited.track !== result.before.track && result.edited.wireless === 'unchecked',
        'the lifting desk misses edits',
      );
      expect(
        label,
        (await page.locator('html').getAttribute('data-lg-theme')) === 'dark',
        'the moving desk misses its appearance edit',
      );
      await desk
        .getByRole('radio', { name: 'Light', exact: true })
        .evaluate((element) => element.focus({ preventScroll: true }));
      await page.keyboard.press('Space');
    }

    await shot(page, `${label}-live-lift`);
    await at(40);
    await page.waitForTimeout(1100);
    result.localScrollDraws = await page.evaluate(
      async ({ top, range, end }) => {
        const before = window.__keynoteDeskDraws;

        for (let frame = 40; frame <= 55; frame += 1) {
          window.scrollTo({ top: top + (range * frame) / end, behavior: 'instant' });
          await new Promise(requestAnimationFrame);
        }

        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);

        return window.__keynoteDeskDraws - before;
      },
      { top: turn.turnTop, range: turn.turnRange, end: TURN.end },
    );
    expect(
      label,
      result.localScrollDraws <= 2,
      `scrolling redraws unchanged local glass ${result.localScrollDraws} times`,
    );
    await at(84);
    result.turning = await state();
    expect(label, result.turning.renderer === 'webgl', 'the turning desk loses its glass renderer');
    expect(
      label,
      result.turning.canvas.every((value, index) => value === result.before.canvas[index]),
      'the turn shrinks or distorts the glass raster',
    );
    await shot(page, `${label}-live-spin`);

    await at(120);
    const phone = page.locator('.turn-player .turn-phone');
    const phoneControl = await phone.locator('.lg-segmented').elementHandle();
    const focus = phone.getByRole('switch', { name: 'Focus', exact: true });
    const phoneLive = await phone.evaluate((root) => !root.inert);
    expect(label, phoneLive, 'the visible phone is inert until the turn ends');

    if (phoneLive) {
      await focus.click();
      await phone.getByRole('checkbox', { name: 'Call Sam back', exact: true }).click();
      await phone.getByRole('radio', { name: 'Week', exact: true }).click();
      await page.waitForTimeout(900);
      result.phone = await phone.evaluate((root) => {
        const bubble = root.querySelector('.lg-segmented-indicator').getBoundingClientRect();

        const selected = root
          .querySelector('[role="radio"][data-state="checked"]')
          .getBoundingClientRect();

        return {
          focus: root.querySelector('[role="switch"]').dataset.state,
          period: selected.width,
          bubbleError: Math.abs(
            bubble.left + bubble.width / 2 - selected.left - selected.width / 2,
          ),
        };
      });
      expect(
        label,
        result.phone.focus === 'unchecked' && result.phone.bubbleError < 1.5,
        'the turning phone misses its edit or misplaces its bubble',
      );
      const week = await phone.getByRole('radio', { name: 'Week', exact: true }).boundingBox();
      const day = await phone.getByRole('radio', { name: 'Day', exact: true }).boundingBox();
      await page.mouse.move(week.x + week.width / 2, week.y + week.height / 2);
      await page.mouse.down();
      await page.mouse.move(day.x + day.width / 2, day.y + day.height / 2, { steps: 12 });
      await page.waitForTimeout(500);
      await page.mouse.up();
      expect(
        label,
        (await phone
          .getByRole('radio', { name: 'Day', exact: true })
          .getAttribute('data-state')) === 'checked',
        'dragging the projected bubble misses its destination',
      );
      await page.waitForTimeout(700);

      const dragError = await phone.evaluate((root) => {
        const bubble = root.querySelector('.lg-segmented-indicator').getBoundingClientRect();

        const selected = root
          .querySelector('[role="radio"][data-state="checked"]')
          .getBoundingClientRect();

        return Math.abs(bubble.left + bubble.width / 2 - selected.left - selected.width / 2);
      });

      expect(
        label,
        dragError < 1.5,
        `the oblique drag leaves its bubble ${dragError.toFixed(2)}px from the selected segment`,
      );
      await phone.getByRole('radio', { name: 'Week', exact: true }).click();
      await shot(page, `${label}-live-phone`);
      await at(30);
      await at(150);
      expect(
        label,
        await phone
          .locator('.lg-segmented')
          .evaluate((root, original) => root === original, phoneControl),
        'reversal remounts the phone control',
      );
      expect(
        label,
        (await focus.getAttribute('data-state')) === 'unchecked',
        'reversing the turn loses the phone edit',
      );
      expect(
        label,
        (await phone
          .getByRole('checkbox', { name: 'Call Sam back', exact: true })
          .getAttribute('data-state')) === 'checked',
        'reversing the turn loses the task edit',
      );
      expect(
        label,
        (await phone
          .getByRole('radio', { name: 'Week', exact: true })
          .getAttribute('data-state')) === 'checked',
        'reversing the turn loses the period edit',
      );
    }

    await scrollTo(page, Math.max(0, turn.turnTop - 140));
    result.restored = await state();
    expect(
      label,
      await desk.evaluate((root, original) => root === original, identity),
      'the turn remounts the desk',
    );

    if (result.edited)
      expect(
        label,
        result.restored.track === result.edited.track && result.restored.wireless === 'unchecked',
        'reversing the turn loses desktop edits',
      );
    await desk.getByRole('button', { name: 'View', exact: true }).click();
    expect(
      label,
      await page.getByRole('menuitemcheckbox', { name: 'Show Widgets', exact: true }).isVisible(),
      'the restored desk menu does not work',
    );
    await page.keyboard.press('Escape');
    await shot(page, `${label}-live-restored`);
    expect(label, errors.length === 0, `browser errors: ${errors.join('; ')}`);
  } finally {
    await context.close();

    if (page.video()) {
      const file = `${label}-live-turn.webm`;
      fs.renameSync(await page.video().path(), path.join(artifactDirectory, file));
      result.video = file;
    }
  }
}

async function checkEngine(browserType) {
  const engine = browserType.name();

  const browser = await browserType.launch(
    engine === 'chromium' ? { args: ['--disable-updater-scheduler'], channel: 'chrome' } : {},
  );

  const report = {};

  manifest.engines[engine] = report;

  try {
    if (lensContractsOnly) {
      await checkLensContracts(browser, engine, report);

      return;
    }

    if (liveTurnOnly) {
      for (const width of [1440, 390]) await checkLiveTurn(browser, engine, width, report);
      await checkReduced(browser, engine, 'reduced-motion', { reducedMotion: 'reduce' });
      await checkReduced(browser, engine, 'site-preference', {
        preferences: { reduceMotion: true },
      });

      return;
    }

    for (const width of [1440, 390]) await checkSkip(browser, engine, width, report);

    await checkReplay(browser, engine, report);
    await checkLensContracts(browser, engine, report);

    for (const key of ['Enter', 'Space']) {
      const { context, page } = await open(browser, { waitUntil: 'domcontentloaded' });

      try {
        await playing(page);
        await shot(page, `${engine}-skip-playing-${key}`);
        await page.getByRole('button', { exact: true, name: 'Skip intro' }).focus();
        await page.keyboard.press(key);
        await landing(page, 1000);
        expect(
          engine,
          (await page.locator('.keynote-player').count()) === 0,
          `${key}: Skip intro leaves the player mounted`,
        );
        report[`skip${key}`] = true;
      } finally {
        await context.close();
      }
    }

    // ------------------------------------------------------------ opener
    const { context, errors, page } = await open(browser, {
      recordVideo:
        engine === 'chromium'
          ? { dir: artifactDirectory, size: { height: 900, width: 1440 } }
          : undefined,
      waitUntil: 'domcontentloaded',
    });

    const loadedAt = Date.now();

    // The poster plays while the page hydrates, so a worker draws it: its canvas belongs to the
    // worker, and the page can no longer draw on it.
    const poster = await page.evaluate(() => {
      const canvas = document.querySelector('.keynote-poster canvas');
      let handedOver = false;

      try {
        canvas.getContext('2d');
      } catch (error) {
        handedOver = error.name === 'InvalidStateError';
      }

      return {
        handedOver,
        intro: document.documentElement.hasAttribute('data-keynote-intro'),
        keynote: document.documentElement.hasAttribute('data-keynote'),
        stage: getComputedStyle(document.querySelector('.keynote-stage')).display,
      };
    });

    report.poster = poster;
    expect(engine, poster.keynote && poster.intro, 'with motion allowed the opener does not run');
    expect(engine, poster.stage === 'block', 'the page loads without the stage');
    expect(
      engine,
      poster.handedOver,
      "the poster's ribbon is drawn on the busy main thread, not by a worker",
    );

    // Playwright's Firefox can hold a screenshot, and the page's frames with it, for ten seconds
    // while a worker is drawing on a canvas, so the poster is photographed in the other two.
    if (engine !== 'firefox') await shot(page, `${engine}-opener-poster`);

    await playing(page);

    const handOver = await page.evaluate(() => ({
      drawing: !document.querySelector('.keynote-poster canvas').hasAttribute('data-down'),
      player: Boolean(document.querySelector('.keynote-player .__remotion-player')),
    }));

    expect(engine, handOver.player, 'no Remotion player draws the opener');
    expect(engine, !handOver.drawing, 'the ribbon is still being laid down after the hand-over');
    expect(
      engine,
      await coveredBy(page, '.home-title', '.keynote-stage'),
      'the stage does not cover the hero',
    );

    await reachFrame(page, 190);

    const bar = await header(page);

    expect(engine, bar.bottom <= 0, `the header shows during the opener (bottom ${bar.bottom}px)`);
    expect(engine, bar.condensed === 'false', 'the header condenses during the opener');
    await shot(page, `${engine}-opener-title`);

    await reachFrame(page, 266);

    const fold = await page.evaluate(() =>
      [...document.querySelectorAll('.keynote-player canvas')].some(
        (canvas) => getComputedStyle(canvas).visibility === 'visible' && canvas.width > 0,
      ),
    );

    expect(engine, fold, 'no canvas draws the fold');

    const openingCutOff = await glassCutOff(page);

    expect(
      engine,
      openingCutOff.length === 0,
      `glass loses its backdrop as the slide folds away: ${openingCutOff.join('; ')}`,
    );
    await shot(page, `${engine}-opener-fold`);

    await landing(page);

    const landedAfter = Date.now() - loadedAt;

    report.landedAfter = landedAfter;
    expect(engine, landedAfter < 7000, `the opener takes ${landedAfter}ms to land`);

    const landedState = await page.evaluate(() => ({
      players: document.querySelectorAll('.keynote-stage .__remotion-player').length,
      scrolled: window.scrollY,
      stage: getComputedStyle(document.querySelector('.keynote-stage')).display,
      transform: getComputedStyle(document.querySelector('.keynote')).transform,
    }));

    expect(
      engine,
      landedState.transform === 'none',
      `the landed page keeps the transform ${landedState.transform}`,
    );
    expect(engine, landedState.stage === 'none', 'the stage still shows once the opener lands');
    expect(engine, landedState.players === 0, "the opener's player stays mounted once it lands");
    expect(
      engine,
      landedState.scrolled === 0,
      `the page scrolled ${landedState.scrolled}px under the opener`,
    );
    expect(engine, await reachable(page, '.home-title'), 'something still covers the landed hero');

    for (const selector of HERO_ACTIONS) {
      expect(
        engine,
        await reachable(page, selector),
        `the landed hero action ${selector} does not take its clicks`,
      );
    }

    await page.waitForTimeout(700);

    const openBar = await header(page);

    expect(
      engine,
      openBar.top >= 0,
      `the header is missing once the opener lands (top ${openBar.top}px)`,
    );
    expect(
      engine,
      openBar.condensed === 'false',
      'the header is not the open bar once the opener lands',
    );
    await shot(page, `${engine}-opener-landed`);

    const motionLayout = await boxes(page, HERO);

    await scrollTo(page, 160);
    await page.waitForTimeout(900);
    expect(
      engine,
      (await header(page)).condensed === 'true',
      'the header does not condense once the page scrolls on',
    );

    // The opener plays once a visit: back at the top the page stays the page.
    await scrollTo(page, 0);
    expect(engine, await reachable(page, '.home-title'), 'back at the top the stage returns');

    // -------------------------------------------------------------- turn

    const turn = await geometry(page);
    const turnAt = (frame) => turn.turnTop + (turn.turnRange * frame) / TURN.end;

    await scrollTo(page, turnAt(30));

    const lifting = await page.evaluate(() => {
      const desk = document.querySelector('.turn-desk');
      const live = document.querySelector('.turn-desk .desk-screen').getBoundingClientRect();
      const slab = document.querySelector('.turn-player [data-slab]')?.getBoundingClientRect();

      return {
        liveTransform: getComputedStyle(desk).transform,
        liveVisibility: getComputedStyle(desk).visibility,
        shrinking: Boolean(
          slab &&
          slab.width > 0 &&
          slab.width < document.querySelector('.desk-screen').offsetWidth - 4,
        ),
        aligned: Boolean(
          slab && Math.abs(slab.left - live.left) < 1 && Math.abs(slab.width - live.width) < 1,
        ),
      };
    });

    expect(
      engine,
      lifting.liveVisibility === 'visible' && lifting.aligned,
      `the lifting desk is not live and aligned: ${JSON.stringify(lifting)}`,
    );
    expect(engine, lifting.shrinking, 'the live desk does not lift');
    expect(
      engine,
      (await glassCutOff(page)).length === 0,
      'the desk loses its backdrop while it lifts',
    );
    await shot(page, `${engine}-turn-lift`);

    if (engine === 'chromium') {
      // The same desk crosses into its moving face without a visible jump.
      await scrollTo(page, turnAt(0));

      const desk = await page.evaluate(() => {
        const box = document.querySelector('.turn-desk .desk-screen').getBoundingClientRect();

        return { height: box.height, width: box.width, x: box.left, y: box.top };
      });

      const clip = {
        height: Math.floor(desk.height) - 8,
        width: Math.floor(desk.width) - 8,
        x: Math.ceil(desk.x) + 4,
        y: Math.ceil(desk.y) + 4,
      };

      const before = await page.screenshot({
        clip,
        path: path.join(artifactDirectory, 'handover-live.png'),
      });

      await scrollTo(page, turnAt(0.6));

      const after = await page.screenshot({
        clip,
        path: path.join(artifactDirectory, 'handover-moving.png'),
      });

      const liveHidden = await page.evaluate(
        () => getComputedStyle(document.querySelector('.turn-desk')).visibility === 'hidden',
      );

      const handOverDifference = await difference(page, before, after);

      report.handOverDifference = handOverDifference;
      expect(engine, !liveHidden, 'the turn hides the live desk');
      expect(
        engine,
        handOverDifference < 9,
        `the live desk jumps by ${handOverDifference.toFixed(2)} grey levels as it starts moving`,
      );
    }

    for (const [name, frame] of [
      ['smear', 84],
      ['spin', 150],
      ['phone', 290],
      ['features', TURN.end],
    ]) {
      await scrollTo(page, turnAt(frame));
      await shot(page, `${engine}-turn-${name}`);
    }

    const final = await finalLayout(page);

    report.final = {
      features: final.features.map(({ box, side, title }) => ({ box, side, title })),
      phone: final.phone,
    };
    expect(
      engine,
      final.features.length === 6,
      `the turn ends with ${final.features.length} features`,
    );
    expect(engine, Boolean(final.phone), 'the turn ends without the phone');
    expect(
      engine,
      final.phoneTheme === 'light' &&
        final.images.some((source) => source.includes('/keynote/phone-wallpaper-light.webp')),
      `the light page turns the other appearance's pictures: ${final.images.join(', ')}`,
    );

    for (const feature of final.features) {
      const { box } = feature;
      const centre = box.x + box.width / 2;
      const phoneCentre = final.phone.x + final.phone.width / 2;

      expect(engine, feature.opacity > 0.99, `"${feature.title}" is not fully shown at the end`);
      expect(
        engine,
        feature.side === 'left' ? centre < phoneCentre : centre > phoneCentre,
        `"${feature.title}" is on the wrong side of the phone`,
      );
      expect(engine, !overlaps(box, final.phone), `"${feature.title}" overlaps the phone`);
      expect(
        engine,
        box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= final.viewport.width &&
          box.y + box.height <= final.viewport.height,
        `"${feature.title}" leaves the viewport`,
      );
      expect(
        engine,
        contrast(feature.titleColour, final.background) >= 4.5,
        `"${feature.title}" falls under 4.5:1`,
      );
      expect(
        engine,
        contrast(feature.body, final.background) >= 4.5,
        `the line under "${feature.title}" falls under 4.5:1`,
      );

      for (const other of final.features) {
        if (other !== feature && overlaps(box, other.box)) {
          fail(engine, `"${feature.title}" overlaps "${other.title}"`);
        }
      }
    }

    // Once the phone lands its screen is live: real clicks reach its controls through the turned
    // phone, and the segmented control's bubble lands under the option it moves to.
    const screen = page.locator('.turn-player .turn-phone');

    const screenState = () =>
      page.evaluate(() => {
        const root = document.querySelector('.turn-player .turn-phone');

        const centre = (element) => {
          const box = element.getBoundingClientRect();

          return box.left + box.width / 2;
        };

        return {
          bubble: Math.abs(
            centre(root.querySelector('.lg-segmented-indicator')) -
              centre(root.querySelector('[role="radio"][data-state="checked"]')),
          ),
          call: [...root.querySelectorAll('[role="checkbox"]')].at(-1).dataset.state,
          focus: root.querySelector('[role="switch"]').dataset.state,
          period: root.querySelector('[role="radio"][data-state="checked"]').textContent,
        };
      });

    await screen.getByRole('switch', { exact: true, name: 'Focus' }).click();
    await screen.getByRole('checkbox', { exact: true, name: 'Call Sam back' }).click();
    await screen.getByRole('radio', { exact: true, name: 'Week' }).click();
    await page.waitForTimeout(900);

    const live = await screenState();

    report.liveScreen = live;
    await shot(page, `${engine}-turn-live`);
    expect(engine, live.focus === 'unchecked', 'a click on the landed phone misses its switch');
    expect(engine, live.call === 'checked', 'a click on the landed phone misses its checkbox');
    expect(engine, live.period === 'Week', 'a click on the landed phone misses its segment');
    expect(
      engine,
      live.bubble < 1.5,
      `the bubble lands ${live.bubble.toFixed(1)}px from the option it moved to`,
    );

    // The visible phone also takes input before it lands.
    await scrollTo(page, turnAt(150));

    const drawn = await page.evaluate(() => {
      const box = document
        .querySelector('.turn-player .turn-phone [role="switch"]')
        .getBoundingClientRect();

      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    });

    await page.mouse.click(drawn.x, drawn.y);
    expect(
      engine,
      (await screenState()).focus === 'checked',
      'a click misses the visible phone while it turns',
    );
    await scrollTo(page, turnAt(TURN.end));

    // Back above the turn the desk is the ordinary, working one.
    await scrollTo(page, 0);

    const restored = await page.evaluate(() => {
      const desk = document.querySelector('.turn-desk');

      return {
        transform: getComputedStyle(desk).transform,
        visibility: getComputedStyle(desk).visibility,
      };
    });

    expect(
      engine,
      restored.transform === 'none',
      `back above the turn the desk keeps ${restored.transform}`,
    );
    expect(engine, restored.visibility === 'visible', 'back above the turn the desk is hidden');
    await page.locator('.home-desk').getByRole('button', { exact: true, name: 'View' }).click();
    expect(
      engine,
      await page.getByRole('menu').first().isVisible(),
      "back above the turn the desk's View menu does not open",
    );
    await page.keyboard.press('Escape');

    expect(engine, errors.length === 0, `the page logged errors: ${errors.join(' | ')}`);

    if (engine === 'chromium') {
      // The film: the whole keynote at a reader's pace, recorded from the real page.
      await scrollTo(page, 0);

      const end = turn.turnTop + turn.turnRange;

      for (let top = 0; top <= end; top += 30) {
        await page.evaluate((y) => window.scrollTo({ behavior: 'instant', top: y }), top);
        await page.waitForTimeout(16);
      }

      await page.waitForTimeout(600);
    }

    const video = page.video();

    await context.close();

    if (video)
      fs.renameSync(await video.path(), path.join(artifactDirectory, 'keynote-scroll.webm'));

    // ------------------------------------------------------------- input
    {
      const { context: inputContext, page: inputPage } = await open(browser, {
        waitUntil: 'domcontentloaded',
      });

      const loaded = Date.now();

      await playing(inputPage);
      await reachFrame(inputPage, 110);

      // A wheel turn and a click let the opener play on, and the page holds still under it.
      await inputPage.mouse.move(720, 450);
      await inputPage.mouse.wheel(0, 600);
      await inputPage.mouse.click(720, 450);

      const before = await frameOf(inputPage, '.keynote-stage');

      await inputPage.waitForTimeout(500);

      const after = await frameOf(inputPage, '.keynote-stage');
      const scrolled = await inputPage.evaluate(() => window.scrollY);

      // Photograph after sampling: capture can hold rendering while playback time advances.
      await shot(inputPage, `${engine}-opener-skip-hint`);

      report.inputFrames = [before, after];
      expect(
        engine,
        after < OPENER.pull && after - before < 45,
        `a wheel turn and a click move the opener from frame ${before} to ${after} in half a second`,
      );
      expect(
        engine,
        scrolled === 0,
        `a wheel turn during the opener scrolls the page ${scrolled}px`,
      );

      await landing(inputPage);

      const inputLandedAfter = Date.now() - loaded;

      report.inputLandedAfter = inputLandedAfter;
      expect(
        engine,
        inputLandedAfter > 4200,
        `after a wheel turn and a click the opener lands ${inputLandedAfter}ms after load, cut short`,
      );
      await inputContext.close();
    }

    // Escape is the deliberate way past it.
    {
      const { context: escapeContext, page: escapePage } = await open(browser, {
        waitUntil: 'domcontentloaded',
      });

      await playing(escapePage);
      await reachFrame(escapePage, 110);
      await escapePage.keyboard.press('Escape');

      const pressed = Date.now();

      await landing(escapePage, 6000);

      const skipLandedAfter = Date.now() - pressed;

      report.skipLandedAfter = skipLandedAfter;
      expect(
        engine,
        skipLandedAfter < 2000,
        `after Escape the opener takes ${skipLandedAfter}ms to land`,
      );
      expect(
        engine,
        (await escapePage.evaluate(() => window.scrollY)) === 0,
        'Escape leaves the page scrolled',
      );
      await escapeContext.close();
    }

    // ---------------------------------------------------------- keyboard
    {
      const { context: keyboardContext, page: keyboardPage } = await open(browser, {
        waitUntil: 'domcontentloaded',
      });

      await playing(keyboardPage);

      // Safari moves focus between links and buttons with Option-Tab.
      const tab = engine === 'webkit' ? 'Alt+Tab' : 'Tab';

      for (let press = 0; press < 40; press += 1) {
        await keyboardPage.keyboard.press(tab);

        if (
          await keyboardPage.evaluate(() => Boolean(document.activeElement?.closest('.home-hero')))
        )
          break;
      }

      await landing(keyboardPage, 3000);
      await keyboardPage.waitForTimeout(150);

      const focus = await keyboardPage.evaluate(() => {
        const element = document.activeElement;
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);

        return {
          inHero: Boolean(element.closest('.home-hero')),
          visible: Boolean(hit && (hit === element || element.contains(hit))),
        };
      });

      expect(engine, focus.inHero, 'tabbing never reaches the hero');
      expect(engine, focus.visible, 'the focused hero element stays covered by the stage');
      await keyboardContext.close();
    }

    // ------------------------------------------------------------ frames
    if (engine === 'chromium') {
      // The poster's CSS keeps the document's time while the player's clock stands still, so the
      // opener can be stepped to exact frames.
      const { context: filmContext, page: filmPage } = await open(browser, {
        clock: true,
        waitUntil: 'domcontentloaded',
      });

      // The page's clock runs on while the check reads it; stop it just ahead.
      await filmPage.clock.pauseAt((await filmPage.evaluate(() => Date.now())) + 250);
      await filmPage.waitForSelector('.keynote-player', { state: 'attached', timeout: 15000 });

      let takenOver = false;

      for (let step = 0; step < 200 && !takenOver; step += 1) {
        await filmPage.clock.runFor(16);
        await filmPage.waitForTimeout(20);
        takenOver = await filmPage.evaluate(() =>
          Boolean(document.querySelector('.keynote-player[data-playing]')),
        );
      }

      expect(engine, takenOver, 'the player never takes over from the poster');

      // The poster the server sends is the frame the player takes over with.
      const clip = { height: 400, width: 400, x: 520, y: 250 };
      const player = await filmPage.screenshot({ clip });

      await filmPage.evaluate(() => {
        document.querySelector('.keynote-player').style.visibility = 'hidden';
        document
          .querySelector('.keynote-poster')
          .style.setProperty('visibility', 'visible', 'important');
      });
      await filmPage.waitForTimeout(100);

      const posterShot = await filmPage.screenshot({ clip });
      const posterDifference = await difference(filmPage, player, posterShot);

      report.posterDifference = posterDifference;
      expect(
        engine,
        posterDifference < 1.5,
        `the poster differs from the player's resting frame by ${posterDifference.toFixed(2)} grey levels`,
      );
      await filmPage.evaluate(() => {
        document.querySelector('.keynote-player').style.removeProperty('visibility');
        document.querySelector('.keynote-poster').style.removeProperty('visibility');
      });

      let stepped = 0;

      // One frame of time at a time, so the page renders between frames as a browser lets it.
      const advance = async (frames) => {
        for (let index = 0; index < frames; index += 1) {
          await filmPage.clock.runFor(
            Math.round(((stepped + 1) * 1000) / 60) - Math.round((stepped * 1000) / 60),
          );
          await filmPage.waitForTimeout(16);
          stepped += 1;
        }
      };

      for (const target of [102, 126, 162, 180, 200, 234, 252, 270, 288, 300]) {
        const current = await frameOf(filmPage, '.keynote-stage');

        await advance(target - current);
        await filmPage.waitForTimeout(150);

        let frame = await frameOf(filmPage, '.keynote-stage');

        // The fake clock fires animation frames every 16ms, Remotion floors the time it has played
        // and starts its clock on the first frame after play, so the player may trail by three.
        expect(
          engine,
          Math.abs(frame - target) <= 3,
          `${target - current} frames of time after frame ${current} the opener shows frame ${frame}`,
        );

        for (let nudge = 0; nudge < 3 && frame < target; nudge += 1) {
          await advance(1);
          await filmPage.waitForTimeout(60);
          frame = await frameOf(filmPage, '.keynote-stage');
        }

        await filmPage.screenshot({
          path: path.join(artifactDirectory, `${engine}-frame-${target}.png`),
        });
      }

      await advance(OPENER.end + 4 - (await frameOf(filmPage, '.keynote-stage')));
      await filmPage.waitForTimeout(300);
      expect(
        engine,
        await filmPage.evaluate(() => !document.documentElement.hasAttribute('data-keynote-intro')),
        'the opener does not land on its last frame',
      );
      await filmContext.close();
    }

    // ------------------------------------------------------- phone size
    {
      const { context: phoneContext, page: phonePage } = await open(browser, {
        height: 844,
        mobile: true,
        waitUntil: 'domcontentloaded',
        width: 390,
      });

      const overflow = [];

      const measure = async (label) => {
        const width = await phonePage.evaluate(() => document.documentElement.scrollWidth);

        if (width > 390) overflow.push(`${label}: ${width}px`);
      };

      await measure('poster');
      await playing(phonePage);

      for (const [label, frame] of [
        ['title', 190],
        ['fold', 266],
      ]) {
        await reachFrame(phonePage, frame);
        await measure(label);
        await shot(phonePage, `${engine}-phone-opener-${label}`);
      }

      await landing(phonePage);
      await measure('landed');

      const phoneTurn = await geometry(phonePage);

      for (const frame of [0, 150, 300, TURN.end]) {
        await scrollTo(phonePage, phoneTurn.turnTop + (phoneTurn.turnRange * frame) / TURN.end);
        await measure(`turn ${frame}`);
        await shot(phonePage, `${engine}-phone-turn-${frame}`);
      }

      const phoneFinal = await finalLayout(phonePage);
      const shown = phoneFinal.features.filter((feature) => feature.opacity > 0.99);

      expect(
        engine,
        overflow.length === 0,
        `the phone-sized page overflows sideways: ${overflow.join(', ')}`,
      );
      expect(engine, shown.length >= 1, 'no feature shows at the end of the phone-sized turn');

      for (const feature of shown) {
        const { box } = feature;

        expect(
          engine,
          box.x >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844,
          `"${feature.title}" leaves the phone-sized viewport`,
        );
        expect(
          engine,
          !overlaps(box, phoneFinal.phone),
          `"${feature.title}" overlaps the phone on a phone`,
        );
      }

      await phoneContext.close();
    }

    // ------------------------------------------------------------- dark
    if (engine === 'chromium') {
      const { context: darkContext, page: darkPage } = await open(browser, {
        theme: 'dark',
        waitUntil: 'domcontentloaded',
      });

      // The slide folds away over the dark page; Escape then hurries it.
      await playing(darkPage);
      await reachFrame(darkPage, 266);
      await shot(darkPage, `${engine}-dark-opener-fold`);
      await darkPage.keyboard.press('Escape');
      await landing(darkPage);

      const darkTurn = await geometry(darkPage);

      await scrollTo(darkPage, darkTurn.turnTop + darkTurn.turnRange);

      const darkFinal = await finalLayout(darkPage);

      expect(
        engine,
        darkFinal.phoneTheme === 'dark' &&
          darkFinal.images.some((source) => source.includes('/keynote/phone-wallpaper-dark.webp')),
        `the dark page turns the other appearance's pictures: ${darkFinal.images.join(', ')}`,
      );

      for (const feature of darkFinal.features) {
        expect(
          engine,
          contrast(feature.titleColour, darkFinal.background) >= 4.5,
          `dark: "${feature.title}" falls under 4.5:1`,
        );
        expect(
          engine,
          contrast(feature.body, darkFinal.background) >= 4.5,
          `dark: the line under "${feature.title}" falls under 4.5:1`,
        );
      }

      await shot(darkPage, `${engine}-dark-turn-features`);
      await darkContext.close();
    }

    // -------------------------------------------------------------- hash
    {
      const { context: hashContext, page: hashPage } = await open(browser, {
        hash: '#home-install-title',
      });

      const state = await hashPage.evaluate(() => ({
        intro: document.documentElement.hasAttribute('data-keynote-intro'),
        keynote: document.documentElement.hasAttribute('data-keynote'),
        players: document.querySelectorAll('.keynote-stage .__remotion-player').length,
        scrolled: window.scrollY,
        stage: getComputedStyle(document.querySelector('.keynote-stage')).display,
        target: document.querySelector('#home-install-title').getBoundingClientRect().top,
        viewport: innerHeight,
      }));

      expect(engine, state.keynote, 'with an address on the page the turn does not run');
      expect(
        engine,
        !state.intro && state.stage === 'none' && state.players === 0,
        'with an address on the page the opener still plays',
      );
      expect(
        engine,
        // Native anchor scrolling rounds its position to a CSS pixel, while the box stays fractional.
        state.scrolled > 0 && Math.round(state.target) >= 0 && state.target < state.viewport,
        `the address does not take the page to its place (scrolled ${state.scrolled}px, target at ${state.target}px)`,
      );
      await hashContext.close();
    }

    // ---------------------------------------------------- reduced motion
    await checkReduced(
      browser,
      engine,
      'reduced-motion',
      { reducedMotion: 'reduce' },
      motionLayout,
    );
    await checkReduced(
      browser,
      engine,
      'site-preference',
      { preferences: { reduceMotion: true } },
      motionLayout,
    );

    if (engine === 'chromium') {
      await checkReduced(
        browser,
        engine,
        'no-javascript',
        { javaScriptEnabled: false },
        motionLayout,
      );
    }
  } finally {
    await browser.close();
  }
}

// The bootstrap that turns the keynote on runs before the header and hero are parsed, so neither
// paints before the stage.
if (!lensContractsOnly) {
  const html = await (await fetch(baseUrl)).text();

  const bootstrap = html.indexOf("r.setAttribute('data-keynote'");

  if (
    bootstrap < 0 ||
    bootstrap > html.indexOf('class="lg-header') ||
    bootstrap > html.indexOf('home-hero')
  ) {
    fail('server', 'the keynote bootstrap does not run before the header and hero are parsed');
  }

  if (!html.includes('keynote-poster')) fail('server', 'the server sends no poster for the opener');
}

for (const browserType of [chromium, webkit, firefox]) {
  try {
    await checkEngine(browserType);
  } catch (error) {
    fail(browserType.name(), `the check stopped: ${error.stack ?? error}`);
  }
}

manifest.artifacts = fs
  .readdirSync(artifactDirectory)
  .filter((name) => name.endsWith('.png') || name.endsWith('.webm') || name.endsWith('.zip'))
  .map((name) => ({
    name,
    sha256: createHash('sha256')
      .update(fs.readFileSync(path.join(artifactDirectory, name)))
      .digest('hex'),
  }));

fs.writeFileSync(
  path.join(artifactDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(`Artifacts: ${artifactDirectory}`);

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(
  lensContractsOnly
    ? 'The keynote lens releases its WebGL objects and keeps reusable contexts.'
    : 'The keynote opens, lands, turns and stands still where it should.',
);
